import { ML_URL } from "@/lib/ml";

// Proxies the browser to the local ML service so the UI only ever talks to
// one origin. Bodies pass through untouched and are never logged.
async function proxy(request: Request, ctx: RouteContext<"/api/ml/[...path]">) {
  const { path } = await ctx.params;
  const search = new URL(request.url).search;
  try {
    const res = await fetch(`${ML_URL}/${path.map(encodeURIComponent).join("/")}${search}`, {
      method: request.method,
      headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    });
    return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json" } });
  } catch {
    return Response.json({ error: "ML service unreachable", ml_url: ML_URL }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
