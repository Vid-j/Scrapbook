import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STICKERS_DIR } from "@/lib/paths";
import { StickerAnnotationSchema } from "@/lib/schemas/sticker";
import { loadStickerLibrary, stickerArt } from "@/lib/stickers/library";
import { formatCount, resolveTextSlots } from "@/lib/stickers/resolve";
import { parseSvgTemplate, parseTransform } from "@/lib/stickers/svgTemplate";

const library = loadStickerLibrary();
const stickers = Object.values(library).map((s) => [s.annotation.id, s] as const);

// The eight categories M1 required (PLAN.md kickoff prompt).
const M1_CATEGORIES = [
  "time_counter_card",
  "postage_stamp",
  "ticket_stub",
  "license_plate",
  "label_maker_tape",
  "torn_paper_strip",
  "matchbox",
  "wax_seal",
];

describe("sticker library", () => {
  it("loads every annotation in web/stickers", () => {
    const files = fs.readdirSync(path.join(STICKERS_DIR, "annotations")).filter((f) => f.endsWith(".json"));
    expect(Object.keys(library).sort()).toEqual(files.map((f) => f.replace(/\.json$/, "")).sort());
  });

  it("has a template for each M1 category", () => {
    for (const category of M1_CATEGORIES) {
      expect(
        Object.values(library).some((s) => s.annotation.category === category && s.annotation.asset_type === "svg_template"),
        category,
      ).toBe(true);
    }
  });

  it.each(stickers)("%s: served art has no slot text and no remote imports", (id) => {
    const art = stickerArt(id)!;
    expect(art).not.toMatch(/<text[\s>]/);
    expect(art).not.toMatch(/@import|fonts\.googleapis/);
  });

  it.each(stickers)("%s: every text slot has a layout and example fills fit", (_, sticker) => {
    const { annotation, layout } = sticker;
    for (const slot of annotation.slots) {
      expect(slot.type === "image" ? layout.image[slot.name] : layout.text[slot.name], slot.name).toBeDefined();
    }
    for (const fill of annotation.example_fills) {
      const resolved = resolveTextSlots(annotation, { slot_values: fill });
      expect(resolved.filter((r) => r.truncated).map((r) => r.slot.name)).toEqual([]);
    }
  });

  it("rejects annotations that break the schema", () => {
    const plate = library.plate_inside_joke_01.annotation;
    expect(StickerAnnotationSchema.safeParse({ ...plate, example_fills: [{ main: "A VERY LONG INSIDE JOKE" }] }).success).toBe(
      false,
    );
    expect(StickerAnnotationSchema.safeParse({ ...plate, category: "mystery" }).success).toBe(false);
    expect(StickerAnnotationSchema.safeParse({ ...plate, asset: "svg/other.svg" }).success).toBe(false);
  });
});

describe("svg template parsing", () => {
  const read = (id: string) => fs.readFileSync(path.join(STICKERS_DIR, "svg", `${id}.svg`), "utf8");

  it("reads the plate's emboss highlight as an echo of the main slot", () => {
    const { layout } = parseSvgTemplate(read("plate_inside_joke_01"));
    expect(layout.text.main).toMatchObject({ anchor: "middle", font: "slab", size: 30 });
    expect(layout.text.main.echo).toEqual({ dx: 1, dy: 1, color: "#ffffff", opacity: 0.7 });
  });

  it("keeps ancestor transforms (envelope note is rotated with its card)", () => {
    const { layout } = parseSvgTemplate(read("envelope_note_01"));
    expect(layout.text.note_line_1.transforms).toEqual([{ kind: "rotate", deg: 4, cx: 205, cy: 70 }]);
    expect(layout.text.address.transforms).toEqual([]);
  });

  it("reads image slot boxes", () => {
    expect(parseSvgTemplate(read("film_strip_01")).layout.image.frame_2).toEqual({ x: 28, y: 140, w: 94, h: 100 });
  });

  it("parses transform lists", () => {
    expect(parseTransform("translate(10 5) rotate(90 126 190.0) scale(0.5)")).toEqual([
      { kind: "translate", x: 10, y: 5 },
      { kind: "rotate", deg: 90, cx: 126, cy: 190 },
      { kind: "scale", x: 0.5, y: 0.5 },
    ]);
  });
});

describe("slot formatting", () => {
  it("handles singular and plural counts", () => {
    expect(formatCount("{n} YEAR(S)", 1)).toBe("1 YEAR");
    expect(formatCount("{n} YEAR(S)", 2)).toBe("2 YEARS");
    expect(formatCount("{n} MONTHS", 1)).toBe("1 MONTH");
    expect(formatCount("{n} MINUTES", 838080)).toBe("838,080 MINUTES");
  });

  it("does not render unfilled templated defaults", () => {
    const resolved = resolveTextSlots(library.plate_inside_joke_01.annotation, { slot_values: {} });
    expect(resolved.find((r) => r.slot.name === "bottom")!.text).toBe("");
  });
});
