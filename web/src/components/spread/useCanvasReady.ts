"use client";

import { useEffect, useRef, useState } from "react";
import { FONT_FAMILIES } from "@/lib/fonts";

/** Canvas text can't reflow when a web font arrives, so wait for all three
 *  scrapbook fonts before the first draw. */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const loads = Object.values(FONT_FAMILIES).flatMap((family) => [
      document.fonts.load(`40px ${family}`),
      document.fonts.load(`bold 40px ${family}`),
    ]);
    Promise.allSettled(loads).then(() => setReady(true));
  }, []);
  return ready;
}

/** Tracks an element's content width. */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Current time, refreshed every minute so live keepsakes keep counting. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
