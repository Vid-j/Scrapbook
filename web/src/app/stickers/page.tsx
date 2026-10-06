import fs from "node:fs";
import path from "node:path";
import { connection } from "next/server";
import { StickerPreview } from "@/components/spread/StickerPreview";
import { STICKERS_DIR } from "@/lib/paths";
import { loadStickerLibrary } from "@/lib/stickers/library";

const GROUPS = [
  { title: "Text templates", match: (t: string) => t === "svg_template" },
  { title: "Decor", match: (t: string) => t === "svg_decor" },
  { title: "Backgrounds", match: (t: string) => t === "svg_background" },
];

function readSources(): Record<string, string> {
  const file = path.join(STICKERS_DIR, "sources.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

// Read-only view of the sticker library. The annotation form and live
// editing land with the sticker-library track (PLAN.md, "Annotation workflow").
export default async function StickersPage() {
  await connection();
  const library = Object.values(loadStickerLibrary());
  const sources = readSources();

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-hand text-5xl">Sticker library</h1>
      <p className="mt-2 font-typewriter text-sm text-ink/70">
        {library.length} stickers · each annotation checked against its schema and its SVG · shown with its first
        example fill
      </p>
      {GROUPS.map((group) => {
        const items = library.filter((s) => group.match(s.annotation.asset_type));
        if (!items.length) return null;
        return (
          <section key={group.title} className="mt-10">
            <h2 className="font-hand text-3xl text-oxblood">
              {group.title} ({items.length})
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((sticker) => {
                const a = sticker.annotation;
                return (
                  <article key={a.id} className="flex flex-col bg-cream p-4 shadow-sm">
                    <div className="flex min-h-56 flex-1 items-center justify-center bg-[#e8dcc6]">
                      <div style={{ width: `${Math.min(100, (a.size.w / 340) * 100)}%` }}>
                        <StickerPreview sticker={sticker} />
                      </div>
                    </div>
                    <h3 className="mt-3 font-typewriter text-sm tracking-[0.15em] text-oxblood">{a.id}</h3>
                    <p className="mt-1 font-typewriter text-xs text-ink/70">
                      {a.category.replaceAll("_", " ")} · {sources[a.id] ?? "unknown source"}
                    </p>
                    {a.slots.length > 0 && (
                      <p className="mt-1 font-typewriter text-xs text-ink/70">
                        slots: {a.slots.map((s) => s.name).join(", ")}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
