import { parse, type HTMLElement } from "node-html-parser";
import type { FontToken, ImageLayout, StickerLayout, TextLayout, TransformStep } from "@/lib/schemas/sticker";

export type ParsedTemplate = {
  width: number;
  height: number;
  layout: StickerLayout;
  /** The SVG with slot text, echoes and remote imports removed. */
  art: string;
  /** Text elements left in the art that aren't slots (should be none). */
  bakedText: string[];
};

const num = (v: string | undefined, fallback = 0) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) ? n : fallback;
};

export function fontToken(family: string): FontToken {
  if (/special elite/i.test(family)) return "typewriter";
  if (/alfa slab/i.test(family)) return "slab";
  if (/caveat/i.test(family)) return "handwriting";
  throw new Error(`unsupported font-family "${family}"`);
}

export function parseTransform(value: string | undefined): TransformStep[] {
  if (!value) return [];
  const steps: TransformStep[] = [];
  for (const [, fn, args] of value.matchAll(/(rotate|translate|scale)\s*\(([^)]*)\)/g)) {
    const a = args.split(/[\s,]+/).filter(Boolean).map(Number);
    if (fn === "rotate") steps.push({ kind: "rotate", deg: a[0] ?? 0, cx: a[1] ?? 0, cy: a[2] ?? 0 });
    else if (fn === "translate") steps.push({ kind: "translate", x: a[0] ?? 0, y: a[1] ?? 0 });
    else steps.push({ kind: "scale", x: a[0] ?? 1, y: a[1] ?? a[0] ?? 1 });
  }
  return steps;
}

/** Transforms from the outermost ancestor down to (and including) `el`. */
function transformChain(el: HTMLElement): TransformStep[] {
  const chain: TransformStep[][] = [];
  for (let node: HTMLElement | null = el; node && node.rawTagName !== "svg"; node = node.parentNode) {
    chain.unshift(parseTransform(node.getAttribute("transform")));
  }
  return chain.flat();
}

function textLayout(el: HTMLElement): TextLayout {
  const anchor = el.getAttribute("text-anchor") ?? "start";
  return {
    x: num(el.getAttribute("x")),
    y: num(el.getAttribute("y")),
    anchor: anchor === "middle" || anchor === "end" ? anchor : "start",
    font: fontToken(el.getAttribute("font-family") ?? ""),
    weight: num(el.getAttribute("font-weight"), 400),
    size: num(el.getAttribute("font-size"), 16),
    color: el.getAttribute("fill") ?? "#000000",
    opacity: num(el.getAttribute("fill-opacity"), 1),
    letterSpacing: num(el.getAttribute("letter-spacing")),
    transforms: transformChain(el),
  };
}

export function parseSvgTemplate(svg: string): ParsedTemplate {
  const doc = parse(svg, { lowerCaseTagName: false, comment: false });
  const root = doc.querySelector("svg");
  if (!root) throw new Error("no <svg> root");

  const layout: StickerLayout = { text: {}, image: {} };
  const slotTexts = new Map<string, HTMLElement>();

  for (const el of root.querySelectorAll("[data-slot]")) {
    const name = el.getAttribute("data-slot")!;
    if (el.getAttribute("data-slot-type") === "image") {
      const [x, y, w, h] = (el.getAttribute("data-box") ?? "").split(",").map(Number);
      if (![x, y, w, h].every(Number.isFinite)) throw new Error(`image slot "${name}" needs data-box="x,y,w,h"`);
      layout.image[name] = { x, y, w, h } satisfies ImageLayout;
    } else if (el.rawTagName === "text") {
      layout.text[name] = textLayout(el);
      slotTexts.set(name, el);
    }
  }

  // Decorative copies of a slot (aria-hidden text with the same content),
  // e.g. the white emboss highlight behind the plate's main text.
  for (const el of root.querySelectorAll("text")) {
    if (el.getAttribute("data-slot") || el.getAttribute("aria-hidden") !== "true") continue;
    for (const [name, slotEl] of slotTexts) {
      if (slotEl.text.trim() === el.text.trim()) {
        const slot = layout.text[name];
        slot.echo = {
          dx: num(el.getAttribute("x")) - slot.x,
          dy: num(el.getAttribute("y")) - slot.y,
          color: el.getAttribute("fill") ?? "#ffffff",
          opacity: num(el.getAttribute("fill-opacity"), 1),
        };
        el.remove();
        break;
      }
    }
  }
  for (const el of slotTexts.values()) el.remove();

  // Local-first: the renderer self-hosts fonts, so drop remote @imports.
  for (const style of root.querySelectorAll("style")) {
    const css = style.text.replace(/@import\s+url\([^)]*\)\s*;?/g, "").trim();
    if (css) style.set_content(css);
    else style.remove();
  }

  return {
    width: num(root.getAttribute("width")),
    height: num(root.getAttribute("height")),
    layout,
    art: root.toString(),
    bakedText: root.querySelectorAll("text").map((t) => t.text.trim()),
  };
}
