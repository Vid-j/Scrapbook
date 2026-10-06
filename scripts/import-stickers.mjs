// Copies a sticker pack (manifest.json + annotations/ + svg/) into
// web/stickers/, replacing stickers with the same id and keeping the rest.
// Validation happens when the app loads the library (and in `npm test`).
//
//   npm run stickers:import -- <path-to-pack>
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "web", "stickers");

const arg = process.argv[2];
if (!arg) {
  console.error("usage: npm run stickers:import -- <path-to-pack>");
  process.exit(1);
}
// Packs are sometimes zipped with an extra folder level; accept either.
let pack = resolve(arg);
if (!existsSync(join(pack, "manifest.json"))) {
  const nested = join(pack, pack.split(/[\\/]/).pop());
  if (existsSync(join(nested, "manifest.json"))) pack = nested;
  else {
    console.error(`No manifest.json in ${pack}`);
    process.exit(1);
  }
}

const manifest = JSON.parse(readFileSync(join(pack, "manifest.json"), "utf8"));
mkdirSync(join(dest, "annotations"), { recursive: true });
mkdirSync(join(dest, "svg"), { recursive: true });

for (const s of manifest.stickers) {
  copyFileSync(join(pack, s.annotation), join(dest, "annotations", `${s.id}.json`));
  copyFileSync(join(pack, s.asset), join(dest, "svg", `${s.id}.svg`));
}

// Remember where each sticker came from.
const sourcesFile = join(dest, "sources.json");
const sources = existsSync(sourcesFile) ? JSON.parse(readFileSync(sourcesFile, "utf8")) : {};
for (const s of manifest.stickers) sources[s.id] = `${manifest.pack} v${manifest.version}`;
writeFileSync(sourcesFile, JSON.stringify(Object.fromEntries(Object.entries(sources).sort()), null, 2) + "\n");

console.log(`imported ${manifest.stickers.length} stickers from ${manifest.pack} v${manifest.version} into web/stickers`);
