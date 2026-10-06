// Loads the Sam & Rio fixture and the sticker library into ./data/scrapbook.db.
// Re-running replaces the fixture book. Logs counts and ids only, never text.
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { FIXTURES_DIR } from "../src/lib/paths";
import { FixtureSchema } from "../src/lib/schemas/fixture";
import { loadStickerLibrary } from "../src/lib/stickers/library";

const prisma = new PrismaClient();

async function main() {
  const fixture = FixtureSchema.parse(JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "sam-rio.json"), "utf8")));
  const { book } = fixture;

  await prisma.book.deleteMany({ where: { id: book.id } });
  await prisma.book.create({
    data: {
      id: book.id,
      title: book.title,
      startDate: new Date(book.start_date),
      consentMode: book.consent_mode,
      partnerConsent: book.partner_consent,
      participants: {
        create: fixture.participants.map((p) => ({
          id: p.id,
          displayName: p.display_name,
          side: p.side,
          initials: p.initials,
        })),
      },
    },
  });
  await prisma.message.createMany({
    data: fixture.messages.map((m, seq) => ({
      id: m.id,
      bookId: book.id,
      senderId: m.from,
      text: m.text,
      sentAt: new Date(m.at),
      timeConfidence: "exact",
      reactions: JSON.stringify(m.reactions),
      seq,
    })),
  });

  const library = loadStickerLibrary();
  await prisma.stickerTemplate.deleteMany({ where: { id: { notIn: Object.keys(library) } } });
  for (const { annotation: a } of Object.values(library)) {
    await prisma.stickerTemplate.upsert({
      where: { id: a.id },
      create: { id: a.id, category: a.category, annotation: JSON.stringify(a) },
      update: { category: a.category, annotation: JSON.stringify(a) },
    });
  }

  console.log(
    `seeded book=${book.id} participants=${fixture.participants.length} messages=${fixture.messages.length} sticker_templates=${Object.keys(library).length}`,
  );
}

main()
  .catch((err) => {
    console.error("seed failed:", err instanceof Error ? err.message : "unknown error");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
