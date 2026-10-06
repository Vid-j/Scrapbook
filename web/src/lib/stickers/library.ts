import fs from "node:fs";
import path from "node:path";
import { STICKERS_DIR } from "@/lib/paths";
import { StickerAnnotationSchema, type LibrarySticker } from "@/lib/schemas/sticker";
import { parseSvgTemplate, type ParsedTemplate } from "./svgTemplate";

export type StickerLibrary = Record<string, LibrarySticker>;

type Entry = { sticker: LibrarySticker; art: string };

let cache: { key: string; entries: Map<string, Entry> } | null = null;

/** Problems where an annotation and its SVG template disagree. */
export function crossCheck(sticker: LibrarySticker, parsed: ParsedTemplate): string[] {
  const { annotation: a } = sticker;
  const problems: string[] = [];
  if (parsed.width !== a.size.w || parsed.height !== a.size.h) {
    problems.push(`svg is ${parsed.width}x${parsed.height} but annotation size is ${a.size.w}x${a.size.h}`);
  }
  for (const slot of a.slots) {
    const found = slot.type === "image" ? parsed.layout.image[slot.name] : parsed.layout.text[slot.name];
    if (!found) problems.push(`slot "${slot.name}" has no data-slot element in the svg`);
  }
  const declared = new Set(a.slots.map((s) => s.name));
  for (const name of [...Object.keys(parsed.layout.text), ...Object.keys(parsed.layout.image)]) {
    if (!declared.has(name)) problems.push(`svg slot "${name}" is not in the annotation`);
  }
  if (parsed.bakedText.length) problems.push(`svg has text outside slots: ${parsed.bakedText.join(", ")}`);
  if (/https?:\/\//.test(parsed.art.replace(/xmlns(:\w+)?="[^"]*"/g, ""))) {
    problems.push("svg art references a remote URL");
  }
  return problems;
}

function load(dir: string): Map<string, Entry> {
  const annDir = path.join(dir, "annotations");
  const files = fs.readdirSync(annDir).filter((f) => f.endsWith(".json")).sort();
  const key = files.map((f) => `${f}:${fs.statSync(path.join(annDir, f)).mtimeMs}`).join("|");
  if (cache?.key === key && dir === STICKERS_DIR) return cache.entries;

  const entries = new Map<string, Entry>();
  const errors: string[] = [];
  for (const file of files) {
    const parsedAnn = StickerAnnotationSchema.safeParse(JSON.parse(fs.readFileSync(path.join(annDir, file), "utf8")));
    if (!parsedAnn.success) {
      errors.push(`${file}: ${parsedAnn.error.message}`);
      continue;
    }
    const annotation = parsedAnn.data;
    if (`${annotation.id}.json` !== file) {
      errors.push(`${file}: id "${annotation.id}" doesn't match the file name`);
      continue;
    }
    let template: ParsedTemplate;
    try {
      template = parseSvgTemplate(fs.readFileSync(path.join(dir, annotation.asset), "utf8"));
    } catch (err) {
      errors.push(`${annotation.asset}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    const sticker: LibrarySticker = {
      annotation,
      layout: template.layout,
      artUrl: `/api/stickers/${annotation.id}/art`,
    };
    errors.push(...crossCheck(sticker, template).map((p) => `${annotation.id}: ${p}`));
    entries.set(annotation.id, { sticker, art: template.art });
  }
  if (errors.length) throw new Error(`Sticker library has problems:\n- ${errors.join("\n- ")}`);
  if (dir === STICKERS_DIR) cache = { key, entries };
  return entries;
}

/** Every sticker, validated against its schema and its SVG. Throws listing
 *  every problem if anything is off. */
export function loadStickerLibrary(dir = STICKERS_DIR): StickerLibrary {
  return Object.fromEntries([...load(dir)].map(([id, e]) => [id, e.sticker]));
}

/** The art for one sticker: its SVG minus slot text and remote imports. */
export function stickerArt(id: string): string | null {
  return load(STICKERS_DIR).get(id)?.art ?? null;
}
