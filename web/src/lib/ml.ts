export const ML_URL = process.env.ML_URL ?? "http://127.0.0.1:8765";

export type MlHealth = { status: string; preset: string; providers: Record<string, string> };

export async function getMlHealth(): Promise<MlHealth | null> {
  try {
    const res = await fetch(`${ML_URL}/health`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    return res.ok ? ((await res.json()) as MlHealth) : null;
  } catch {
    return null;
  }
}
