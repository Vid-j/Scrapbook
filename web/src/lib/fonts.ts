import { Alfa_Slab_One, Caveat, Special_Elite } from "next/font/google";
import type { FontToken } from "@/lib/schemas/sticker";

// Self-hosted at build time by next/font, so the running app never calls
// Google Fonts.
export const caveat = Caveat({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-caveat" });
export const specialElite = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--font-special-elite" });
export const alfaSlab = Alfa_Slab_One({ subsets: ["latin"], weight: "400", variable: "--font-alfa-slab" });

export const FONT_FAMILIES: Record<FontToken, string> = {
  handwriting: caveat.style.fontFamily,
  typewriter: specialElite.style.fontFamily,
  slab: alfaSlab.style.fontFamily,
};

export const fontVariables = `${caveat.variable} ${specialElite.variable} ${alfaSlab.variable}`;
