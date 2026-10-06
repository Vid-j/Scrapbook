import type { ImageSlot, StickerAnnotation, TextSlot } from "@/lib/schemas/sticker";
import type { StickerElement } from "@/lib/schemas/spread";

export type Elapsed = { years: number; months: number; days: number; hours: number; minutes: number };

/** Totals in each unit since `since`, the way the time counter card reads:
 *  1 YEAR / 19 MONTHS / 582 DAYS / 13,968 HOURS / ... */
export function elapsedSince(since: Date, now: Date): Elapsed {
  // Calendar days in local time, so a daylight-saving shift between the two
  // dates doesn't drop a day. Hours and minutes follow from days, as on the card.
  const dayNumber = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  const days = Math.max(0, dayNumber(now) - dayNumber(since));
  let months = (now.getFullYear() - since.getFullYear()) * 12 + (now.getMonth() - since.getMonth());
  const anchor = new Date(since);
  anchor.setMonth(since.getMonth() + months);
  if (anchor > now) months -= 1;
  return {
    years: Math.floor(Math.max(0, months) / 12),
    months: Math.max(0, months),
    days,
    hours: days * 24,
    minutes: days * 24 * 60,
  };
}

const COMPUTED_ROLES: Record<string, keyof Elapsed> = {
  computed_years: "years",
  computed_months: "months",
  computed_days: "days",
  computed_hours: "hours",
  computed_minutes: "minutes",
};

/** "{n} YEAR(S)" / "{n} DAYS" -> "1 YEAR", "582 DAYS". */
export function formatCount(format: string, n: number): string {
  let f = format;
  if (n === 1) f = f.replace(/\((s)\)/i, "").replace(/([a-z])s(\W*)$/i, "$1$2");
  else f = f.replace(/\((s)\)/i, "$1");
  return f.replaceAll("{n}", n.toLocaleString("en-US"));
}

export type ResolvedSlot = { slot: TextSlot; text: string; truncated: boolean };

/** Final display text for every text slot of a sticker instance. Values are
 *  taken as filled; only live counts and `{value}` formats are applied here. */
export function resolveTextSlots(
  annotation: StickerAnnotation,
  element: Pick<StickerElement, "slot_values" | "live">,
  now: Date = new Date(),
): ResolvedSlot[] {
  const elapsed = element.live ? elapsedSince(new Date(element.live.since), now) : null;
  const out: ResolvedSlot[] = [];

  for (const slot of annotation.slots) {
    if (slot.type === "image") continue;
    const unit = COMPUTED_ROLES[slot.role];
    const filled = element.slot_values[slot.name];
    let text: string;
    if (filled === undefined && unit && elapsed) {
      text = formatCount(slot.format ?? "{n}", elapsed[unit]);
    } else {
      text = filled ?? (slot.default?.includes("{") ? "" : (slot.default ?? ""));
      if (slot.format?.includes("{value}")) text = slot.format.replaceAll("{value}", text);
    }
    if (slot.quote && text && !/^["“].*["”]$/.test(text)) text = `"${text}"`;

    let truncated = false;
    if (slot.max_chars && text.length > slot.max_chars) {
      text = text.slice(0, slot.max_chars - 1).trimEnd() + "…";
      truncated = true;
    }
    if (slot.case === "upper") text = text.toUpperCase();
    else if (slot.case === "lower") text = text.toLowerCase();
    out.push({ slot, text, truncated });
  }
  return out;
}

export function imageSlotValues(annotation: StickerAnnotation, element: Pick<StickerElement, "slot_values">) {
  const out: { slot: ImageSlot; src: string }[] = [];
  for (const slot of annotation.slots) {
    const src = element.slot_values[slot.name];
    if (slot.type === "image" && src) out.push({ slot, src });
  }
  return out;
}
