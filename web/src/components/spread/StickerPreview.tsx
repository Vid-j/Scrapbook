"use client";

import dynamic from "next/dynamic";
import type { Spread } from "@/lib/schemas/spread";
import type { LibrarySticker } from "@/lib/schemas/sticker";
import { useElementWidth, useFontsReady, useNow } from "./useCanvasReady";

const SpreadCanvas = dynamic(() => import("./SpreadCanvas"), { ssr: false });

const PAD = 16;
// The fixture's first text, so live stickers count from a real start date.
const PREVIEW_SINCE = "2025-03-02T21:14:00";

/** One sticker rendered with its first example fill, using the same renderer
 *  as full spreads. Live slots count from the fixture's start date. */
export function StickerPreview({ sticker }: { sticker: LibrarySticker }) {
  const fontsReady = useFontsReady();
  const now = useNow();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const { annotation } = sticker;
  const { w, h } = annotation.size;

  const slotValues: Record<string, string> = {};
  for (const [name, value] of Object.entries(annotation.example_fills[0] ?? {})) {
    const slot = annotation.slots.find((s) => s.name === name);
    if (!slot || value.startsWith("<")) continue; // "<photo>" placeholders keep the template's own art
    if (annotation.live && slot.role.startsWith("computed_")) continue;
    slotValues[name] = value;
  }

  const spread: Spread = {
    id: `preview-${annotation.id}`,
    book_id: "preview",
    chapter: { number: 1, of: 1, title: "" },
    moment_id: null,
    mode: "recreate",
    pages: [1, 2],
    size: { w: w + PAD * 2, h: h + PAD * 2 },
    background: { page: "#f1e7d3", frame: "#b8895a" },
    elements: [
      {
        id: annotation.id,
        kind: "sticker",
        template_id: annotation.id,
        slot_values: slotValues,
        live: annotation.live ? { since: PREVIEW_SINCE } : undefined,
        x: PAD,
        y: PAD,
        w,
        h,
        rotation: 0,
        z: 0,
        provenance: null,
        source_message_ids: [],
      },
    ],
  };
  return (
    <div ref={ref} className="w-full" style={{ aspectRatio: `${w + PAD * 2} / ${h + PAD * 2}` }}>
      {fontsReady && width > 0 && (
        <SpreadCanvas spread={spread} library={{ [annotation.id]: sticker }} width={width} now={now} framed={false} />
      )}
    </div>
  );
}
