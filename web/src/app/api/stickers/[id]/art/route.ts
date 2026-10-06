import { stickerArt } from "@/lib/stickers/library";

// Sticker art without its slot text: the canvas draws slot text itself with
// the self-hosted fonts, so the text stays editable and never doubles up.
export async function GET(_request: Request, ctx: RouteContext<"/api/stickers/[id]/art">) {
  const { id } = await ctx.params;
  const art = /^[a-z0-9_]+$/.test(id) ? stickerArt(id) : null;
  if (!art) return new Response("Not found", { status: 404 });
  return new Response(art, {
    headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-cache" },
  });
}
