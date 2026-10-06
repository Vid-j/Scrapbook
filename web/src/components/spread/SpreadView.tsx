"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Spread } from "@/lib/schemas/spread";
import type { LibrarySticker } from "@/lib/schemas/sticker";
import type { HoverInfo } from "./SpreadCanvas";
import { useElementWidth, useFontsReady, useNow } from "./useCanvasReady";

const SpreadCanvas = dynamic(() => import("./SpreadCanvas"), { ssr: false });

type Props = {
  spread: Spread;
  library: Record<string, LibrarySticker>;
  /** message id -> sender name, for the hover card. Never the text itself. */
  senders: Record<string, string>;
};

export function SpreadView({ spread, library, senders }: Props) {
  const fontsReady = useFontsReady();
  const now = useNow();
  const [boxRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [tagEverything, setTagEverything] = useState(false);

  const aspect = (spread.size.h + 68) / (spread.size.w + 68);

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div ref={boxRef} className="relative w-full" style={{ aspectRatio: `1 / ${aspect}` }}>
        {fontsReady && width > 0 && (
          <SpreadCanvas
            spread={spread}
            library={library}
            width={width}
            now={now}
            tagEverything={tagEverything}
            onHover={setHover}
          />
        )}
        {hover && <HoverCard info={hover} library={library} senders={senders} />}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-5 font-typewriter text-[15px] tracking-[0.18em] text-ink">
        <div className="flex rounded-full bg-[#e3d7c6] p-1" role="group" aria-label="Spread mode">
          <button
            className="rounded-full bg-oxblood px-7 py-2.5 text-cream shadow-sm"
            aria-pressed={spread.mode === "recreate"}
          >
            RECREATE
          </button>
          <button className="rounded-full px-7 py-2.5 text-ink/50" disabled title="Reimagine arrives in M7">
            REIMAGINE
          </button>
        </div>
        <span>
          CHAPTER {spread.chapter.number} OF {spread.chapter.of}
        </span>
        <button
          className="rounded-full border-2 border-ink/70 px-7 py-2 text-ink/50"
          disabled
          title="The editor arrives in M6"
        >
          EDIT PAGE
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] tracking-[0.12em]">
          <input
            type="checkbox"
            className="accent-oxblood"
            checked={tagEverything}
            onChange={(e) => setTagEverything(e.target.checked)}
          />
          TAG EVERY ELEMENT
        </label>
      </div>
    </div>
  );
}

function HoverCard({
  info,
  library,
  senders,
}: {
  info: HoverInfo;
  library: Record<string, LibrarySticker>;
  senders: Record<string, string>;
}) {
  const el = info.element;
  const name =
    el.kind === "sticker"
      ? (library[el.template_id]?.annotation.category.replaceAll("_", " ") ?? el.template_id)
      : el.kind.replaceAll("_", " ");
  const provenance =
    el.provenance === "text" ? "From your texts" : el.provenance === "imagined" ? "Imagined" : "Library decor";
  return (
    <div
      className="pointer-events-none absolute z-10 max-w-64 rounded-sm border border-ink/20 bg-cream px-3 py-2 font-typewriter text-xs text-ink shadow-lg"
      style={{ left: info.x + 14, top: info.y + 14 }}
    >
      <div className="uppercase tracking-widest text-oxblood">{name}</div>
      <div className="mt-1">{provenance}</div>
      {el.source_message_ids.length > 0 && (
        <div className="mt-1 text-ink/70">
          {el.source_message_ids.map((id) => `${id}${senders[id] ? ` (${senders[id]})` : ""}`).join(", ")}
        </div>
      )}
    </div>
  );
}
