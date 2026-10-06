import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURES_DIR } from "@/lib/paths";
import { FixtureSchema } from "@/lib/schemas/fixture";

const fixture = FixtureSchema.parse(JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "sam-rio.json"), "utf8")));
const day = (iso: string) => iso.slice(0, 10);

describe("Sam & Rio fixture", () => {
  it("has about 80 messages from Mar 2, 2025 to Oct 2026, in order", () => {
    const { messages } = fixture;
    expect(messages.length).toBeGreaterThanOrEqual(75);
    expect(messages.length).toBeLessThanOrEqual(90);
    expect(day(messages[0].at)).toBe("2025-03-02");
    expect(messages.at(-1)!.at.startsWith("2026-10")).toBe(true);
    const times = messages.map((m) => new Date(m.at).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(messages.map((m) => m.id)).size).toBe(messages.length);
  });

  it("every sender is a participant", () => {
    const ids = new Set(fixture.participants.map((p) => p.id));
    for (const m of fixture.messages) expect(ids.has(m.from)).toBe(true);
  });

  it("includes the rain-check day on Oct 14, 2025", () => {
    const onDay = fixture.messages.filter((m) => day(m.at) === "2025-10-14");
    expect(onDay.length).toBeGreaterThanOrEqual(10);
    expect(onDay.some((m) => m.text.includes("rain check"))).toBe(true);
  });

  it("'tiny umbrella' recurs often enough for motif detection (3+ times on 2+ days)", () => {
    const hits = fixture.messages.filter((m) => m.text.toLowerCase().includes("tiny umbrella"));
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(new Set(hits.map((m) => day(m.at))).size).toBeGreaterThanOrEqual(2);
    expect(day(hits[0].at)).toBe("2025-10-14");
  });
});
