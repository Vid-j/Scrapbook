import { z } from "zod";

// Sticker annotation schema, following the sticker pack format
// (web/stickers/annotations/*.json, PLAN.md "Annotation schema").
// Slot *layout* is not in the annotation: it comes from the matching
// `<text data-slot>` / `data-slot-type="image"` elements in the SVG, which
// src/lib/stickers/svgTemplate.ts reads. Pack-specific extras the renderer
// doesn't use yet (fill_rule, expands, regen_variables, ...) pass through
// untouched for the composer.

export const STICKER_CATEGORIES = [
  "time_counter_card",
  "postage_stamp",
  "ticket_stub",
  "license_plate",
  "label_maker_tape",
  "torn_paper_strip",
  "typewriter_slip",
  "envelope_note",
  "matchbox",
  "wax_seal",
  "polaroid",
  "film_strip",
  "postcard",
  "title_card",
  "decor_pressed_flowers",
  "decor_push_pin",
  "decor_tape",
  "background_torn_paper",
] as const;
export type StickerCategory = (typeof STICKER_CATEGORIES)[number];

export const MOTIF_KINDS = ["inside_joke", "nickname", "place", "food", "object"] as const;

export const FONT_TOKENS = ["handwriting", "typewriter", "slab"] as const;
export type FontToken = (typeof FONT_TOKENS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected #rrggbb");

const FitSchema = z.object({
  mode: z.literal("shrink_to_width"),
  max_width: z.number().positive(),
  min_font_scale: z.number().gt(0).max(1),
});

const TextSlotSchema = z.looseObject({
  type: z.literal("text").default("text"),
  name: z.string().regex(/^[a-z0-9_]+$/),
  role: z.string().min(1),
  source: z.string().optional(),
  max_chars: z.number().int().positive().optional(),
  case: z.enum(["upper", "lower", "as_is", "as_written"]).default("as_is"),
  // Display format. The renderer only applies `{n}` (live counts) and
  // `{value}`; date formats like "MMM D" are instructions for the M5 filler.
  format: z.string().optional(),
  default: z.string().optional(),
  fit: FitSchema.optional(),
  verbatim: z.boolean().default(false),
  quote: z.boolean().default(false),
  fixed: z.boolean().default(false),
});

const ImageSlotSchema = z.looseObject({
  type: z.literal("image"),
  name: z.string().regex(/^[a-z0-9_]+$/),
  role: z.string().min(1),
  source: z.string().optional(),
  aspect: z.string().regex(/^\d+:\d+$/).optional(),
});

export const SlotSchema = z.union([ImageSlotSchema, TextSlotSchema]);
export type Slot = z.infer<typeof SlotSchema>;
export type TextSlot = z.infer<typeof TextSlotSchema>;
export type ImageSlot = z.infer<typeof ImageSlotSchema>;

export const StickerAnnotationSchema = z
  .looseObject({
    id: z.string().regex(/^[a-z0-9_]+$/),
    category: z.enum(STICKER_CATEGORIES),
    asset: z.string().regex(/^svg\/[a-z0-9_]+\.svg$/),
    asset_type: z.enum(["svg_template", "svg_decor", "svg_background"]),
    description: z.string().min(20),
    style: z.object({
      era: z.string(),
      palette: z.array(hex).min(1),
      texture: z.string(),
      fonts: z.array(z.string()),
    }),
    slots: z.array(SlotSchema),
    triggers: z.looseObject({
      moment_types: z.array(z.string()).default([]),
      motif_kinds: z.array(z.enum(MOTIF_KINDS)).default([]),
      moods: z.array(z.string()).default([]),
      entities_required: z.array(z.string()).default([]),
    }),
    size: z.object({ w: z.number().positive(), h: z.number().positive() }),
    rotation_range: z.tuple([z.number(), z.number()]),
    example_fills: z.array(z.record(z.string(), z.string())).default([]),
    layer: z.enum(["background"]).optional(),
    scale_range: z.tuple([z.number().positive(), z.number().positive()]).optional(),
    max_per_spread: z.number().int().positive().optional(),
    live: z.boolean().default(false),
    regen_prompt: z.string().min(20),
    license: z.literal("original"),
  })
  .superRefine((a, ctx) => {
    if (a.asset !== `svg/${a.id}.svg`) {
      ctx.addIssue({ code: "custom", path: ["asset"], message: `expected svg/${a.id}.svg` });
    }
    const names = a.slots.map((s) => s.name);
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: "custom", path: ["slots"], message: "slot names must be unique" });
    }
    if (a.rotation_range[0] > a.rotation_range[1]) {
      ctx.addIssue({ code: "custom", path: ["rotation_range"], message: "must be [min, max]" });
    }
    if (a.asset_type !== "svg_template" && a.slots.length > 0) {
      ctx.addIssue({ code: "custom", path: ["slots"], message: "only svg_template stickers have slots" });
    }
    if (a.asset_type === "svg_template" && a.example_fills.length === 0) {
      ctx.addIssue({ code: "custom", path: ["example_fills"], message: "templates need at least one example fill" });
    }
    a.example_fills.forEach((fill, i) => {
      for (const [key, value] of Object.entries(fill)) {
        const slot = a.slots.find((s) => s.name === key);
        if (!slot) {
          ctx.addIssue({ code: "custom", path: ["example_fills", i, key], message: "unknown slot" });
        } else if (slot.type !== "image" && slot.max_chars && value.length > slot.max_chars) {
          ctx.addIssue({
            code: "custom",
            path: ["example_fills", i, key],
            message: `${value.length} chars exceeds max_chars ${slot.max_chars}`,
          });
        }
      }
    });
  });

export type StickerAnnotation = z.infer<typeof StickerAnnotationSchema>;

// ---- Layout read from the SVG template -------------------------------------

/** One SVG transform step, applied outermost first. */
export type TransformStep =
  | { kind: "rotate"; deg: number; cx: number; cy: number }
  | { kind: "translate"; x: number; y: number }
  | { kind: "scale"; x: number; y: number };

/** A text slot laid out the way SVG does it: an anchor point on the baseline. */
export type TextLayout = {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  font: FontToken;
  weight: number;
  size: number;
  color: string;
  opacity: number;
  letterSpacing: number;
  transforms: TransformStep[];
  /** A decorative copy drawn under the slot (e.g. the plate's emboss highlight). */
  echo?: { dx: number; dy: number; color: string; opacity: number };
};

export type ImageLayout = { x: number; y: number; w: number; h: number };

export type StickerLayout = {
  text: Record<string, TextLayout>;
  image: Record<string, ImageLayout>;
};

/** What the renderer needs for one sticker. */
export type LibrarySticker = {
  annotation: StickerAnnotation;
  layout: StickerLayout;
  /** URL of the art with slot text and remote font imports removed. */
  artUrl: string;
};
