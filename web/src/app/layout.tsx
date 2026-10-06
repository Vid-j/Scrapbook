import type { Metadata } from "next";
import Link from "next/link";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Text Scrapbook",
  description: "Turn your texts into a vintage scrapbook. Local-first.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="flex items-baseline gap-6 px-8 pt-6 font-typewriter text-sm tracking-[0.2em] text-ink/70">
          <Link href="/" className="font-hand text-3xl tracking-normal text-oxblood">
            Text Scrapbook
          </Link>
          <Link href="/" className="hover:text-oxblood">
            LIBRARY
          </Link>
          <Link href="/stickers" className="hover:text-oxblood">
            STICKERS
          </Link>
        </header>
        <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
      </body>
    </html>
  );
}
