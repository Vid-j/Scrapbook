import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { getMlHealth } from "@/lib/ml";
import { listSpreadIds } from "@/lib/spreads";

async function getBooks() {
  try {
    return await prisma.book.findMany({
      orderBy: { createdAt: "asc" },
      include: { participants: true, _count: { select: { messages: true } } },
    });
  } catch {
    return null; // database not created yet
  }
}

export default async function LibraryPage() {
  await connection();
  const [books, ml] = await Promise.all([getBooks(), getMlHealth()]);
  const spreads = listSpreadIds();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-hand text-5xl text-ink">Your shelf</h1>

      {books === null ? (
        <p className="mt-6 font-typewriter">
          No database yet. Run <code className="bg-cream px-1">npm run setup</code> from the repo root.
        </p>
      ) : books.length === 0 ? (
        <p className="mt-6 font-typewriter">
          The shelf is empty. Run <code className="bg-cream px-1">npm run seed</code> to load the Sam &amp; Rio fixture.
        </p>
      ) : (
        <div className="mt-8 flex flex-wrap gap-8 border-b-[14px] border-[#8f6538] pb-0">
          {books.map((book) => {
            const initials = book.participants.map((p) => p.initials).join("&");
            return (
              <Link
                key={book.id}
                href={spreads.includes("chapter-3") ? "/spread/chapter-3" : "/"}
                className="group relative flex h-72 w-52 flex-col justify-between rounded-r-md bg-kraft p-5 text-cream shadow-[6px_6px_0_rgba(0,0,0,0.12)] transition-transform hover:-translate-y-2"
              >
                <span className="absolute inset-y-0 left-0 w-3 bg-[#9c7244]" />
                <span className="font-typewriter text-xs tracking-[0.3em]">SCRAPBOOK</span>
                <span className="font-hand text-4xl leading-none">{book.title}</span>
                <span className="flex items-end justify-between font-typewriter text-xs">
                  <span>{book._count.messages} messages</span>
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-oxblood font-slab text-sm text-[#5e1010]">
                    {initials}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <section className="mt-12 grid gap-6 font-typewriter text-sm sm:grid-cols-2">
        <div className="bg-cream p-5 shadow-sm">
          <h2 className="tracking-[0.2em] text-oxblood">SPREADS</h2>
          <ul className="mt-3 space-y-1">
            {spreads.map((id) => (
              <li key={id}>
                <Link className="underline decoration-oxblood/40 hover:text-oxblood" href={`/spread/${id}`}>
                  {id}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-cream p-5 shadow-sm">
          <h2 className="tracking-[0.2em] text-oxblood">ML SERVICE</h2>
          {ml ? (
            <ul className="mt-3 space-y-1">
              <li>status: {ml.status}</li>
              <li>preset: {ml.preset}</li>
              {Object.entries(ml.providers).map(([role, name]) => (
                <li key={role}>
                  {role}: {name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3">Not reachable. Start it with <code>npm run dev</code> from the repo root.</p>
          )}
        </div>
      </section>
    </div>
  );
}
