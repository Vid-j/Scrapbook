import fs from "node:fs";
import path from "node:path";
import { SPREADS_DIR } from "@/lib/paths";
import { SpreadSchema, type Spread } from "@/lib/schemas/spread";
import type { LibrarySticker } from "@/lib/schemas/sticker";

export function listSpreadIds(dir = SPREADS_DIR): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".spread.json"))
    .map((f) => f.replace(/\.spread\.json$/, ""));
}

export function loadSpread(id: string, dir = SPREADS_DIR): Spread | null {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const file = path.join(dir, `${id}.spread.json`);
  if (!fs.existsSync(file)) return null;
  return SpreadSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

/** Cross-checks a spread against the sticker library. Returns problems as
 *  strings so tests and the page can both report them. */
export function checkSpreadAgainstLibrary(spread: Spread, library: Record<string, LibrarySticker>): string[] {
  const problems: string[] = [];
  for (const el of spread.elements) {
    if (el.kind !== "sticker") continue;
    const tpl = library[el.template_id]?.annotation;
    if (!tpl) {
      problems.push(`${el.id}: unknown template '${el.template_id}'`);
      continue;
    }
    for (const [name, value] of Object.entries(el.slot_values)) {
      const slot = tpl.slots.find((s) => s.name === name);
      if (!slot) problems.push(`${el.id}: template has no slot '${name}'`);
      else if (slot.type !== "image" && slot.max_chars && value.length > slot.max_chars) {
        problems.push(`${el.id}.${name}: ${value.length} chars exceeds max_chars ${slot.max_chars}`);
      }
    }
  }
  return problems;
}
