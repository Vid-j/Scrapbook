import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SpreadView } from "@/components/spread/SpreadView";
import { prisma } from "@/lib/db";
import { FIXTURES_DIR } from "@/lib/paths";
import { FixtureSchema } from "@/lib/schemas/fixture";
import { checkSpreadAgainstLibrary, loadSpread } from "@/lib/spreads";
import { loadStickerLibrary } from "@/lib/stickers/library";

/** message id -> sender display name. Reads the database, falling back to
 *  the fixture file if it hasn't been seeded. */
async function senderNames(ids: string[]): Promise<Record<string, string>> {
  try {
    const rows = await prisma.message.findMany({ where: { id: { in: ids } }, select: { id: true, sender: true } });
    if (rows.length) return Object.fromEntries(rows.map((m) => [m.id, m.sender.displayName]));
  } catch {
    // fall through to fixture
  }
  const fixture = FixtureSchema.parse(JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "sam-rio.json"), "utf8")));
  const names = Object.fromEntries(fixture.participants.map((p) => [p.id, p.display_name]));
  return Object.fromEntries(fixture.messages.filter((m) => ids.includes(m.id)).map((m) => [m.id, names[m.from]]));
}

export default async function SpreadPage({ params }: PageProps<"/spread/[id]">) {
  await connection();
  const { id } = await params;
  const spread = loadSpread(id);
  if (!spread) notFound();

  const library = loadStickerLibrary();
  const problems = checkSpreadAgainstLibrary(spread, library);
  if (problems.length) {
    return (
      <div className="mx-auto max-w-3xl bg-cream p-6 font-typewriter">
        <h1 className="text-oxblood">This spread doesn&apos;t match the sticker library</h1>
        <ul className="mt-4 list-disc pl-6 text-sm">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    );
  }

  const ids = [...new Set(spread.elements.flatMap((e) => e.source_message_ids))];
  return <SpreadView spread={spread} library={library} senders={await senderNames(ids)} />;
}
