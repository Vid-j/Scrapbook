import { z } from "zod";
import { FONT_TOKENS } from "./sticker";

// Spread JSON: what the composer (M5) writes and the renderer draws.
// Coordinates are in spread units: (0,0) is the top-left of the left page,
// both pages together are `size.w` wide. Rotation is in degrees about the
// element's center.

const Provenance = z.enum(["text", "imagined"]).nullable().default(null);

const base = {
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number().default(0),
  z: z.number().int().default(0),
  // "text" = taken from the conversation, "imagined" = generated,
  // null = library decor that claims neither.
  provenance: Provenance,
  source_message_ids: z.array(z.string()).default([]),
};

export const StickerElementSchema = z.object({
  ...base,
  kind: z.literal("sticker"),
  template_id: z.string(),
  slot_values: z.record(z.string(), z.string()).default({}),
  // Live keepsakes: slots with elapsed_* roles count up from this instant.
  live: z.object({ since: z.string() }).optional(),
});

export const ImageElementSchema = z.object({
  ...base,
  kind: z.literal("image"),
  asset: z.string(),
});

export const TextElementSchema = z.object({
  ...base,
  kind: z.literal("text"),
  text: z.string(),
  font: z.enum(FONT_TOKENS),
  size: z.number().positive(),
  color: z.string().default("#3a2f28"),
  align: z.enum(["left", "center", "right"]).default("left"),
  letter_spacing: z.number().default(0),
});

export const ProvenanceTagElementSchema = z.object({
  ...base,
  kind: z.literal("provenance_tag"),
  tag: z.enum(["text", "imagined"]),
});

export const ElementSchema = z.discriminatedUnion("kind", [
  StickerElementSchema,
  ImageElementSchema,
  TextElementSchema,
  ProvenanceTagElementSchema,
]);

export const SpreadSchema = z
  .object({
    id: z.string(),
    book_id: z.string(),
    chapter: z.object({ number: z.number().int().positive(), of: z.number().int().positive(), title: z.string() }),
    moment_id: z.string().nullable().default(null),
    mode: z.enum(["recreate", "reimagine"]),
    pages: z.tuple([z.number().int(), z.number().int()]),
    size: z.object({ w: z.number().positive(), h: z.number().positive() }),
    background: z.object({
      page: z.string().default("#f1e7d3"),
      frame: z.string().default("#b8895a"),
    }),
    elements: z.array(ElementSchema),
  })
  .superRefine((s, ctx) => {
    const ids = s.elements.map((e) => e.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "element ids must be unique" });
    }
    s.elements.forEach((e, i) => {
      if (e.provenance === "text" && e.source_message_ids.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["elements", i, "source_message_ids"],
          message: "elements tagged 'text' must link to the messages they came from",
        });
      }
    });
  });

export type Spread = z.infer<typeof SpreadSchema>;
export type SpreadElement = z.infer<typeof ElementSchema>;
export type StickerElement = z.infer<typeof StickerElementSchema>;
