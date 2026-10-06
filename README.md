# Text Scrapbook

Local-first web app that turns screenshots of a couple's text conversation into a vintage digital scrapbook. See [PLAN.md](PLAN.md) for the full plan and [docs/mockup-chapter3.webp](docs/mockup-chapter3.webp) for the visual reference.

**Status:** milestones M0 (setup) and M1 (spread renderer) are built.

## Run it

Requires Node 20+ and Python 3.11+.

```bash
npm run setup   # once: installs deps, creates ./data/scrapbook.db, seeds the Sam & Rio fixture, builds the ML venv
npm run dev     # web app on http://localhost:3000 + ML service on http://127.0.0.1:8765
```

Then open:

| URL | What |
|---|---|
| http://localhost:3000 | Library: the seeded book, spread list, ML service status |
| http://localhost:3000/spread/chapter-3 | M1 acceptance: the Chapter 3 spread rendered from `fixtures/spreads/chapter-3.spread.json` |
| http://localhost:3000/stickers | Sticker library, each sticker shown with its example fill |
| http://127.0.0.1:8765/providers | Which providers are active and what (if anything) leaves the machine |

Tests:

```bash
npm test                                   # web: annotations, spread, fixture, live counter
cd ml && .venv/Scripts/python -m pytest    # ML service (use .venv/bin/python on macOS/Linux)
```

## Layout

```
PLAN.md              product plan
providers.yaml       picks parser / llm / embedder / imagegen (local and cloud presets)
fixtures/            Sam & Rio conversation (80 messages) and hand-written spreads
data/                local SQLite DB and future uploads (git-ignored, never leaves the machine)
web/                 Next.js + React + Tailwind + react-konva
  prisma/            schema (10 entities from PLAN.md) and seed script
  stickers/          sticker library in pack layout: annotations/ + svg/, sources.json
  src/lib/schemas/   Zod schemas: sticker annotation, Spread JSON, fixture
  src/components/spread/  Konva renderer
ml/                  FastAPI service; every model behind a provider interface
```

## How the pieces fit

- **Stickers** come from sticker packs (currently *text-scrapbook-stickers v2*, plus a local title card and tape strip). Each one is an SVG template plus an annotation JSON in the PLAN.md schema. The SVG marks slots with `<text data-slot>` and `data-slot-type="image"` elements. The server reads layout from those elements, then serves the art with the slot text and remote font imports removed (`/api/stickers/<id>/art`). Konva draws the slot text with the self-hosted fonts, so it stays editable, shrinking each line to fit its slot's `fit.max_width`. Every annotation is checked against both the Zod schema and its own SVG.
- **Adding a pack:** `npm run stickers:import -- <path-to-pack>` copies it into `web/stickers/`, replacing stickers with matching ids. Then run `npm test` and `npm run seed`.
- **Live keepsakes:** slots with `computed_*` roles count up from the element's `live.since` and refresh every minute.
- **Provenance:** every element is `text` (with `source_message_ids`), `imagined`, or `null` for library decor. The Spread schema rejects `text` elements with no source messages. Hover any element to see where it came from, or switch on *Tag every element*.
- **Providers:** `providers.yaml` selects the implementations. The default `local` preset sends nothing off the machine. Model calls arrive in M2 (parsing), M3 (embeddings and LLM), and M7 (image generation).
- **Privacy:** the ML service logs ids and counts only (`log_event` drops content fields), and the seed script logs counts only.
