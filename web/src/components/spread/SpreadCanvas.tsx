"use client";

import type { ReactNode } from "react";
import { Group, Image as KImage, Layer, Rect, Shape, Stage, Text } from "react-konva";
import type Konva from "konva";
import useImage from "use-image";
import { FONT_FAMILIES } from "@/lib/fonts";
import type { Spread, SpreadElement, StickerElement } from "@/lib/schemas/spread";
import type { ImageLayout, LibrarySticker, TextLayout, TextSlot, TransformStep } from "@/lib/schemas/sticker";
import { imageSlotValues, resolveTextSlots } from "@/lib/stickers/resolve";

export const FRAME = 34;

const PROVENANCE_LABEL = { text: "FROM YOUR TEXTS", imagined: "IMAGINED" } as const;
const PROVENANCE_COLOR = { text: "#3a2f28", imagined: "#8e1f1f" } as const;

export type HoverInfo = { element: SpreadElement; x: number; y: number };

type Props = {
  spread: Spread;
  library: Record<string, LibrarySticker>;
  width: number;
  now: Date;
  /** Draw the kraft book frame, cream pages, and spine, and clip to the pages. */
  framed?: boolean;
  /** Badge every element that has provenance, not just the placed tags. */
  tagEverything?: boolean;
  onHover?: (info: HoverInfo | null) => void;
  stageRef?: React.Ref<Konva.Stage>;
};

export default function SpreadCanvas({
  spread,
  library,
  width,
  now,
  framed = true,
  tagEverything = false,
  onHover,
  stageRef,
}: Props) {
  const pad = framed ? FRAME : 0;
  const totalW = spread.size.w + pad * 2;
  const totalH = spread.size.h + pad * 2;
  const scale = width / totalW;
  const elements = [...spread.elements].sort((a, b) => a.z - b.z);
  const clip = framed ? { clipX: 0, clipY: 0, clipWidth: spread.size.w, clipHeight: spread.size.h } : {};

  return (
    <Stage ref={stageRef} width={width} height={totalH * scale} scaleX={scale} scaleY={scale}>
      {framed && (
        <Layer listening={false}>
          <BookBackground spread={spread} totalW={totalW} totalH={totalH} />
        </Layer>
      )}
      <Layer>
        <Group x={pad} y={pad} {...clip}>
          {elements.map((el) => (
            <Group
              key={el.id}
              x={el.x + el.w / 2}
              y={el.y + el.h / 2}
              offsetX={el.w / 2}
              offsetY={el.h / 2}
              rotation={el.rotation}
              onMouseEnter={(e) => {
                const p = e.target.getStage()?.getPointerPosition();
                if (p) onHover?.({ element: el, x: p.x, y: p.y });
              }}
              onMouseLeave={() => onHover?.(null)}
            >
              <ElementNode element={el} library={library} now={now} />
              {tagEverything && el.provenance && el.kind !== "provenance_tag" && (
                <ProvenanceBadge tag={el.provenance} />
              )}
            </Group>
          ))}
        </Group>
      </Layer>
    </Stage>
  );
}

function BookBackground({ spread, totalW, totalH }: { spread: Spread; totalW: number; totalH: number }) {
  const { w, h } = spread.size;
  const spineX = FRAME + w / 2;
  return (
    <>
      <Rect
        width={totalW}
        height={totalH}
        fill={spread.background.frame}
        cornerRadius={18}
        shadowColor="#3b2a1a"
        shadowOpacity={0.25}
        shadowBlur={30}
        shadowOffsetY={12}
      />
      <Rect x={FRAME} y={FRAME} width={w} height={h} fill={spread.background.page} />
      {/* soft shading where the pages curve into the spine */}
      <Rect
        x={spineX - 70}
        y={FRAME}
        width={140}
        height={h}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 140, y: 0 }}
        fillLinearGradientColorStops={[0, "rgba(90,60,30,0)", 0.5, "rgba(90,60,30,0.12)", 1, "rgba(90,60,30,0)"]}
      />
      <Rect
        x={spineX - 8}
        y={FRAME}
        width={16}
        height={h}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 16, y: 0 }}
        fillLinearGradientColorStops={[0, "#b08452", 0.5, "#8f6538", 1, "#b08452"]}
      />
    </>
  );
}

function ElementNode({
  element,
  library,
  now,
}: {
  element: SpreadElement;
  library: Record<string, LibrarySticker>;
  now: Date;
}) {
  switch (element.kind) {
    case "sticker": {
      const sticker = library[element.template_id];
      return sticker ? <StickerNode element={element} sticker={sticker} now={now} /> : null;
    }
    case "image":
      return <CoverImage src={element.asset} box={{ x: 0, y: 0, w: element.w, h: element.h }} />;
    case "text":
      return (
        <Text
          text={element.text}
          width={element.w}
          height={element.h}
          fontFamily={FONT_FAMILIES[element.font]}
          fontSize={element.size}
          fill={element.color}
          align={element.align}
          letterSpacing={element.letter_spacing}
        />
      );
    case "provenance_tag":
      return <ProvenanceTag tag={element.tag} w={element.w} h={element.h} />;
  }
}

/** Art at its native size inside a group scaled to the element's box; slot
 *  text and images are drawn in the same native coordinates on top. */
function StickerNode({ element, sticker, now }: { element: StickerElement; sticker: LibrarySticker; now: Date }) {
  const { annotation, layout, artUrl } = sticker;
  const [art] = useImage(artUrl);
  return (
    <Group scaleX={element.w / annotation.size.w} scaleY={element.h / annotation.size.h}>
      <KImage image={art} width={annotation.size.w} height={annotation.size.h} />
      {imageSlotValues(annotation, element).map(({ slot, src }) =>
        layout.image[slot.name] ? <CoverImage key={slot.name} src={src} box={layout.image[slot.name]} /> : null,
      )}
      {resolveTextSlots(annotation, element, now).map(({ slot, text }) =>
        text && layout.text[slot.name] ? (
          <SlotText key={slot.name} layout={layout.text[slot.name]} fit={slot.fit} text={text} />
        ) : null,
      )}
    </Group>
  );
}

const CANVAS_ALIGN = { start: "left", middle: "center", end: "right" } as const;

/** Draws text exactly as the SVG template positions it: an anchor point on the
 *  baseline, then shrinks to `fit.max_width` (down to `min_font_scale`). */
function SlotText({ layout, fit, text }: { layout: TextLayout; fit?: TextSlot["fit"]; text: string }) {
  const family = FONT_FAMILIES[layout.font];
  return withTransforms(
    layout.transforms,
    <Shape
      listening={false}
      sceneFunc={(context) => {
        const ctx = (context as unknown as { _context: CanvasRenderingContext2D })._context;
        ctx.save();
        const setFont = (size: number) => {
          ctx.font = `${layout.weight} ${size}px ${family}`;
        };
        let size = layout.size;
        setFont(size);
        ctx.letterSpacing = `${layout.letterSpacing}px`;
        if (fit) {
          const width = ctx.measureText(text).width;
          if (width > fit.max_width) {
            size = Math.max(size * fit.min_font_scale, (size * fit.max_width) / width);
            setFont(size);
          }
        }
        ctx.textAlign = CANVAS_ALIGN[layout.anchor];
        ctx.textBaseline = "alphabetic";
        if (layout.echo) {
          ctx.globalAlpha = layout.echo.opacity;
          ctx.fillStyle = layout.echo.color;
          ctx.fillText(text, layout.x + layout.echo.dx, layout.y + layout.echo.dy);
        }
        ctx.globalAlpha = layout.opacity;
        ctx.fillStyle = layout.color;
        ctx.fillText(text, layout.x, layout.y);
        ctx.restore();
      }}
    />,
  );
}

/** Nests groups so Konva applies the same transform chain the SVG did. */
function withTransforms(steps: TransformStep[], child: ReactNode): ReactNode {
  return steps.reduceRight<ReactNode>((inner, step) => {
    if (step.kind === "rotate") {
      return (
        <Group x={step.cx} y={step.cy} offsetX={step.cx} offsetY={step.cy} rotation={step.deg}>
          {inner}
        </Group>
      );
    }
    if (step.kind === "translate") return <Group x={step.x} y={step.y}>{inner}</Group>;
    return <Group scaleX={step.x} scaleY={step.y}>{inner}</Group>;
  }, child);
}

/** An image scaled to cover `box` and clipped to it. */
function CoverImage({ src, box }: { src: string; box: ImageLayout }) {
  const [image] = useImage(src);
  if (!image) return null;
  const s = Math.max(box.w / image.width, box.h / image.height);
  const w = image.width * s;
  const h = image.height * s;
  return (
    <Group clipX={box.x} clipY={box.y} clipWidth={box.w} clipHeight={box.h}>
      <KImage image={image} x={box.x + (box.w - w) / 2} y={box.y + (box.h - h) / 2} width={w} height={h} />
    </Group>
  );
}

function ProvenanceTag({ tag, w, h }: { tag: "text" | "imagined"; w: number; h: number }) {
  const color = PROVENANCE_COLOR[tag];
  return (
    <>
      <Rect width={w} height={h} fill="rgba(241,231,211,0.85)" stroke={color} strokeWidth={1.5} dash={[5, 3]} />
      <Text
        text={PROVENANCE_LABEL[tag]}
        width={w}
        height={h}
        align="center"
        verticalAlign="middle"
        fontFamily={FONT_FAMILIES.typewriter}
        fontSize={Math.min(16, h * 0.55)}
        letterSpacing={3}
        fill={color}
      />
    </>
  );
}

function ProvenanceBadge({ tag }: { tag: "text" | "imagined" }) {
  const label = PROVENANCE_LABEL[tag];
  const w = label.length * 9 + 16;
  return (
    <Group x={-6} y={-12} listening={false}>
      <Rect width={w} height={22} fill="#f8f1e2" stroke={PROVENANCE_COLOR[tag]} strokeWidth={1.2} dash={[4, 2]} />
      <Text
        text={label}
        width={w}
        height={22}
        align="center"
        verticalAlign="middle"
        fontFamily={FONT_FAMILIES.typewriter}
        fontSize={12}
        letterSpacing={1.5}
        fill={PROVENANCE_COLOR[tag]}
      />
    </Group>
  );
}
