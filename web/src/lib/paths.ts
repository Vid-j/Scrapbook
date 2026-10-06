import path from "node:path";

// The web app runs from <repo>/web; shared folders live at the repo root.
export const REPO_ROOT = path.resolve(process.cwd(), "..");
export const FIXTURES_DIR = path.join(REPO_ROOT, "fixtures");
export const SPREADS_DIR = path.join(FIXTURES_DIR, "spreads");
export const DATA_DIR = path.join(REPO_ROOT, "data");
// Sticker library in pack layout: annotations/<id>.json + svg/<id>.svg.
export const STICKERS_DIR = path.join(process.cwd(), "stickers");
