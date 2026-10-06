import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURES_DIR } from "@/lib/paths";
import { FixtureSchema } from "@/lib/schemas/fixture";
import { SpreadSchema } from "@/lib/schemas/spread";
import { checkSpreadAgainstLibrary, loadSpread } from "@/lib/spreads";
import { loadStickerLibrary } from "@/lib/stickers/library";
import { elapsedSince, resolveTextSlots } from "@/lib/stickers/resolve";

const library = loadStickerLibrary();
const fixture = FixtureSchema.parse(JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "sam-rio.json"), "utf8")));
const messageIds = new Set(fixture.messages.map((m) => m.id));

describe("chapter 3 spread (M1 acceptance)", () => {
  const spread = loadSpread("chapter-3")!;

  it("parses and matches the sticker library", () => {
    expect(spread).not.toBeNull();
    expect(checkSpreadAgainstLibrary(spread, library)).toEqual([]);
  });

  it("links every source message id to the fixture", () => {
    for (const el of spread.elements) {
      for (const id of el.source_message_ids) expect(messageIds.has(id), `${el.id} -> ${id}`).toBe(true);
    }
  });

  it("uses verbatim quotes for text-provenance quote stickers", () => {
    const byId = new Map(fixture.messages.map((m) => [m.id, m.text]));
    // Every slot the pack marks verbatim must quote the linked messages exactly.
    for (const el of spread.elements) {
      if (el.kind !== "sticker" || el.provenance !== "text") continue;
      for (const slot of library[el.template_id].annotation.slots) {
        const value = el.slot_values[slot.name];
        if (slot.type === "image" || !slot.verbatim || !value) continue;
        const bare = value.replace(/^"|"$/g, "");
        expect(
          el.source_message_ids.some((m) => byId.get(m)?.toLowerCase().includes(bare.toLowerCase())),
          `${el.id}.${slot.name}`,
        ).toBe(true);
      }
    }
  });

  it("includes all eight M1 sticker categories", () => {
    const categories = new Set(
      spread.elements.flatMap((e) => (e.kind === "sticker" ? [library[e.template_id].annotation.category] : [])),
    );
    for (const c of [
      "time_counter_card",
      "postage_stamp",
      "ticket_stub",
      "license_plate",
      "label_maker_tape",
      "torn_paper_strip",
      "matchbox",
      "wax_seal",
    ]) {
      expect(categories.has(c as never), c).toBe(true);
    }
  });

  it("shows both provenance tags", () => {
    const tags = spread.elements.filter((e) => e.kind === "provenance_tag").map((e) => e.kind === "provenance_tag" && e.tag);
    expect(tags.sort()).toEqual(["imagined", "text"]);
  });

  it("renders the time counter like the mockup on Oct 5, 2026", () => {
    const counter = spread.elements.find((e) => e.id === "counter");
    if (counter?.kind !== "sticker") throw new Error("missing counter");
    const lines = resolveTextSlots(library[counter.template_id].annotation, counter, new Date("2026-10-05T22:00:00")).map(
      (r) => r.text,
    );
    expect(lines).toEqual([
      "SINCE YOUR FIRST TEXT",
      "1 YEAR",
      "19 MONTHS",
      "582 DAYS",
      "13,968 HOURS",
      "838,080 MINUTES",
      '"hi, is this sam?"',
    ]);
  });

  it("rejects a text element with no source messages", () => {
    const bad = structuredClone(spread);
    const el = bad.elements.find((e) => e.id === "share-badly")!;
    el.source_message_ids = [];
    expect(SpreadSchema.safeParse(bad).success).toBe(false);
  });
});

describe("elapsedSince", () => {
  it("does not count a month that hasn't completed", () => {
    const e = elapsedSince(new Date("2025-03-02T21:14:00"), new Date("2025-04-02T20:00:00"));
    expect(e.months).toBe(0);
    expect(e.days).toBe(31);
  });

  it("counts calendar days across a daylight-saving change", () => {
    expect(elapsedSince(new Date("2025-03-02T21:14:00"), new Date("2026-10-05T00:30:00")).days).toBe(582);
  });
});
