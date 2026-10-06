# Text Scrapbook: Prototype Plan

Oct 5, 2026 · @Vee

## Overview

Text Scrapbook turns screenshots of a couple's text conversation into a vintage-style digital scrapbook. It reads the screenshots, remembers the relationship over time, finds meaningful moments, and composes each one as an editable scrapbook spread. Visual reference: the Chapter 3 mockup.

### Core loop

1. The user uploads screenshots of a conversation.
2. The app extracts messages and adds them to the relationship's memory.
3. The app proposes moments; the user confirms, edits, or rejects each one.
4. Each confirmed moment becomes a spread built from real quotes and stickers filled with details from the conversation.
5. The user edits the spread, flips through the book, and exports it.

### Design principles

- **Real vs. imagined is always visible.** Content taken from texts is tagged "From your texts"; generated content is tagged "Imagined".
- **The user stays in control.** The system suggests moments and layouts; the user decides.
- **Private by default.** Processing runs locally where possible; cloud models are opt-in.
- **Stickers carry real context.** Sticker text comes from the conversation, never from stock phrases.
- **One visual language.** Vintage ephemera: deep red and cream, kraft paper, torn scraps, typewriter and handwritten type.

## Scope of the prototype

The prototype is a desktop-first web app for one user and one relationship ("book"), running locally.

| In scope | Out of scope (later) |
|---|---|
| Screenshot upload, starting with iMessage, then WhatsApp and Instagram DMs | Direct chat-export import (WhatsApp .txt is an easy follow-up) |
| Message extraction with a correction screen | Accounts, cloud sync, sharing links |
| Memory store with recurring motifs | Multi-user or partner collaboration |
| Moment detection with user review | Native mobile app |
| Auto-composed spreads in Recreate mode | Print-on-demand service |
| Reimagine mode: one generated illustration per spread | Fine-tuned or custom-trained models |
| Drag, rotate, delete, and swap elements on a canvas | |
| Live data keepsakes (time counter, firsts) | |
| Flip-book viewer and PNG/PDF export | |
| Sticker library with annotation tooling | |

## Tech stack and architecture

Two local services: a Next.js web app for the UI and a Python FastAPI service for the ML work. Every model sits behind a provider interface so cloud and local options can swap without touching the pipeline.

| Layer | Choice | Why |
|---|---|---|
| Web app | Next.js, React, TypeScript, Tailwind | Fast UI iteration; API routes proxy to the ML service |
| Canvas editor | Konva (react-konva) | Layered, draggable, rotatable elements; exports to PNG |
| ML service | Python, FastAPI | Best ecosystem for OCR, embeddings, image models |
| Screenshot parsing | Claude vision returning structured JSON (default); PaddleOCR plus layout heuristics (local) | Vision models handle bubbles, reactions, and timestamps well; local path for privacy |
| Language tasks | Claude API (current Sonnet model); Ollama as a local option | Moment scoring, captions, chapter titles |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2), local | Cheap, private, good enough for clustering |
| Database | SQLite via Prisma | Zero setup, local file |
| Vector store | sqlite-vec or LanceDB | Local, sits beside SQLite |
| Image generation | Provider interface: local ComfyUI (SDXL or Flux) or a hosted API; placeholder art when none is set | Reimagine illustrations and raster sticker variants |
| Stickers | SVG templates with named text slots, plus transparent PNG decor | Text stays editable and crisp |
| Export | Konva to PNG; pdf-lib for the book PDF | Simple, client-side |

Config: a `providers.yaml` (or `.env`) chooses `parser`, `llm`, `embedder`, and `imagegen` per provider, with local and cloud presets.

## Data model

Ten entities. Every generated element keeps a `provenance` field (`text` or `imagined`) and links back to the message ids it came from.

| Entity | Key fields | Notes |
|---|---|---|
| Book | id, title, participants, start_date, consent_mode, excluded_ranges | One per relationship; consent_mode is `full` or `my_messages_only` |
| Participant | id, book_id, display_name, side (`me` or `them`), initials | Initials feed wax seals and monograms |
| Screenshot | id, book_id, file_path, phash, source_app, parsed_at, status | Perceptual hash for dedupe |
| Message | id, book_id, screenshot_id, sender_id, text, sent_at, time_confidence, reactions, attachment_type, hidden | time_confidence is `exact`, `inferred`, or `unknown` |
| Motif | id, book_id, phrase, kind (`inside_joke`, `nickname`, `place`, `food`, `object`), first_message_id, occurrence_ids | Recurring things across the conversation |
| Moment | id, book_id, type, title, date, summary, quote_message_ids, entities, mood, status | status is `suggested`, `confirmed`, or `rejected` |
| Chapter | id, book_id, order, title, moment_ids, palette | Groups moments into a story |
| Spread | id, chapter_id, moment_id, mode (`recreate` or `reimagine`), background, elements | One per confirmed moment |
| Element | id, spread_id, kind, x, y, w, h, rotation, z, sticker_instance_id, provenance, source_message_ids | Anything placed on a page |
| StickerTemplate / StickerInstance | template: annotation JSON (see Sticker library); instance: template_id, slot_values, render_cache | Instance = a template filled for one spread |

## Pipeline stages

Eight stages run in order; each writes to the database so the user can stop, review, and correct between them.

1. **Ingestion.** Accept PNG/JPG uploads, compute a perceptual hash to drop duplicates, and detect the source app from layout cues.
2. **Parsing.** Turn each screenshot into JSON: `{messages: [{side, text, time, reactions, attachment_type}]}`.
   - Sender comes from bubble alignment and color (right = `me`).
   - Times come from in-chat separators; missing times are inferred from neighbors and marked `inferred`.
   - Overlapping screenshots are stitched by matching runs of identical messages.
   - The user can flip a sender or fix text on a correction screen.
3. **Memory.** Store messages, embed sliding windows of about 10 messages, and extract entities (places, foods, nicknames, objects).
4. **Motif detection.** Find phrases that recur across days (n-gram frequency over time, at least 3 occurrences on 2+ separate days), then have the LLM confirm which are real inside jokes or nicknames.
5. **Moment detection.** Combine heuristic candidates with LLM scoring:
   - Firsts: first message, first "I love you", first nickname, first plan made.
   - Anniversaries of earlier moments.
   - Spikes in message volume or long late-night threads.
   - Bursts of laughter, emoji, or reactions.
   - First appearance of a motif.
   - Output per moment: type, title, date, 2 to 4 sentence summary, verbatim quote ids, entities, mood. Conflict is not surfaced unless the user turns it on.
6. **Narrative.** Group confirmed moments into chapters by time gaps and theme. The LLM writes chapter titles and short captions in a warm, measured voice; captions are tagged `imagined`.
7. **Page composition.**
   - Pick a background and palette from the chapter mood.
   - Choose a focal element (best quote or illustration) and 4 to 7 supporting stickers by matching moment facts to sticker triggers (see Sticker library).
   - Fill sticker slots from the moment's quotes, dates, and entities, respecting each slot's `max_chars`.
   - Lay out with a simple packing pass: focal element first, then supporting elements with collision avoidance, rotation jitter within each sticker's `rotation_range`, and slight overlaps for a handmade feel.
   - Save as Spread JSON; the editor renders it.
8. **Reimagine.** Build an image prompt from the moment summary, entities, and the book's style tokens. Generate the art only, then overlay any text as editable layers. Tag the result `imagined`.

## Sticker library and annotation schema

Every sticker is an asset plus an annotation JSON file. The annotation does three jobs: it tells the composer when to use the sticker (triggers), how to fill it (slots), and how to regenerate it from new conversation context (description, style, regen prompt).

**Key rule:** image models are unreliable at rendering text, so text is never baked into generated art. Generated stickers are art only; slot text is always an editable overlay layer.

### Categories

| Category | Filled from | Example fill |
|---|---|---|
| Time counter card | Book start date (live) | 1 year, 19 months, 582 days |
| Postage stamp | Anniversary or year | Heart stamp, "20 25" |
| Ticket stub | A plan or outing: place, date, items | No 141025, Café Lumen, 2 lavender lattes |
| License plate | Inside joke or nickname | TINY UMBRELLA, since Oct 14 |
| Label-maker tape | Short quote, 20 chars max | YOU REMEMBERED!! |
| Torn paper strip | Quote, 60 chars max | then we share it badly |
| Typewriter slip | Longer quote, 120 chars max | the tiny umbrella fits one (1) person |
| Envelope and note | Sweet longer message or a date | My Love, Oct 14, 2025 |
| Matchbox | Short phrase about the day | a match made on a rainy tuesday |
| Wax seal | Participant initials; closes a chapter | S&R |
| Polaroid / film strip | Photo sent in chat, or an imagined scene | Café Lumen, imagined |
| Postcard | A place mentioned | Café Lumen |
| Decor (flowers, hearts, pins) | Mood only, no text | Pressed poppies |
| Torn paper backgrounds | Chapter palette | Red plaid, floral, letter script |

### Annotation schema

```json
{
  "id": "plate_inside_joke_01",
  "category": "license_plate",
  "asset": "stickers/plate_inside_joke_01.svg",
  "asset_type": "svg_template",
  "description": "Vintage cream metal license plate with a deep red embossed border, two bolt holes, year digits in the top corners, and large slab-serif text in the center.",
  "style": {
    "era": "mid-century americana",
    "palette": ["#efe6d6", "#8e1f1f"],
    "texture": "embossed metal, light wear",
    "fonts": ["Alfa Slab One", "Special Elite"]
  },
  "slots": [
    {"name": "main", "role": "inside_joke", "max_chars": 14, "case": "upper"},
    {"name": "top", "role": "date_since", "format": "SINCE MMM D"},
    {"name": "bottom", "role": "label", "default": "INSIDE JOKE No. {n}"},
    {"name": "corners", "role": "year", "format": "YY YY"}
  ],
  "triggers": {
    "moment_types": ["motif_first_appearance"],
    "motif_kinds": ["inside_joke", "nickname"],
    "moods": ["playful", "nostalgic"]
  },
  "size": {"w": 300, "h": 150},
  "rotation_range": [-6, 6],
  "example_fills": [
    {"main": "TINY UMBRELLA", "top": "SINCE OCT 14", "bottom": "INSIDE JOKE No. 1", "corners": "20 25"}
  ],
  "regen_prompt": "Die-cut sticker of a vintage cream metal license plate with a deep red embossed border and bolt holes, blank center panel, soft paper shadow, transparent background, no text",
  "license": "original"
}
```

### Annotation workflow

1. Make 30 to 50 original stickers across the categories above. Text-bearing stickers are SVG templates with named slots; decor and backgrounds are transparent PNGs.
2. Annotate each one with the schema above and validate it with a Zod schema in the app.
3. Build a small `/stickers` admin page: grid of stickers, annotation form, live preview with example fills.
4. Bootstrap with vision: give a vision model 5 to 10 hand-annotated stickers as few-shot examples, then have it draft annotations for new stickers. A person reviews every draft before it is saved.
5. Regenerate variants: for raster stickers, send `regen_prompt` plus the original as a style reference to the image model, then overlay slot text. SVG templates only need their slots refilled.
6. Keep the library original: no recognizable characters, brand designs, or logos.

## UI screens

Eight screens, in the order a user meets them. All share the scrapbook look from the mockup.

1. **Library.** Books shown as kraft covers on a shelf; create a new book.
2. **New book.** Names and initials for both people, source app, consent mode (full or my messages only), optional start date.
3. **Upload and correct.** Drag in screenshots, see parsing progress, then review extracted messages side by side with each screenshot. Flip senders, fix text, hide messages.
4. **Timeline and motifs.** Scrollable message timeline with detected motifs highlighted; rename, merge, or remove motifs.
5. **Moment review.** Suggested moments as cards with title, date, summary, and quotes. Confirm, edit, or reject; create a moment manually by selecting messages.
6. **Spread editor.** Konva canvas with the Recreate/Reimagine toggle, a sticker drawer filtered by category, drag/rotate/delete, "regenerate this element", and visible provenance tags.
7. **Flip-book viewer.** Page-turn view of the whole book with chapter navigation.
8. **Export.** Single spread as PNG or the whole book as PDF, with provenance tags on by default.

## Privacy and safety

The app handles intimate messages from two people, so privacy rules are product requirements, not polish.

- **Local-first storage.** SQLite database and images live in a local folder; nothing leaves the machine unless a cloud provider is turned on.
- **Clear cloud opt-in.** Choosing a cloud provider shows exactly which data is sent (screenshots, message text) and to whom.
- **The other person's messages.** Book creation asks the user to confirm their partner is okay with it; "my messages only" mode excludes the partner's text from stickers and captions.
- **Exclusions.** Users can hide individual messages or whole date ranges from all processing.
- **Hard moments.** Conflict is not suggested as a moment unless the user enables it. A book can be archived or closed so it stops resurfacing memories.
- **Provenance.** "From your texts" and "Imagined" tags appear by default in the editor and exports.
- **No logging of content.** Logs record ids and errors only, never message text.
- **Delete everything.** One button removes a book's database rows, images, embeddings, and caches.

## Build milestones for Claude Code

Eight milestones, each ending in something you can run and look at. Build them in order; each depends on the one before.

| Milestone | Builds | Done when |
|---|---|---|
| M0 Setup | Repo, Next.js app, FastAPI service, Prisma schema, provider interfaces, fixture data (the fictional Sam and Rio conversation) | `npm run dev` and the ML service both start; fixture loads into the database |
| M1 Spread renderer | Spread JSON to Konva; first 8 sticker templates as SVG with slots | The Chapter 3 mockup renders from a hand-written Spread JSON file |
| M2 Parsing | Upload, parser providers, stitching, correction screen | 10 test screenshots parse with correct senders and order |
| M3 Memory and motifs | Embeddings, entity extraction, motif detection, timeline screen | "tiny umbrella" is detected as a motif in the fixture |
| M4 Moments | Candidate heuristics, LLM scoring, review screen | The rain-check day is suggested and can be confirmed |
| M5 Composition | Trigger matching, slot filling, layout pass, chapters | A confirmed moment produces a spread close to the mockup with no manual edits |
| M6 Editor and viewer | Drag/rotate/delete, sticker drawer, flip-book | A spread can be edited, saved, and paged through |
| M7 Reimagine and export | Image provider, imagined tags, PNG and PDF export | Toggle produces an illustrated spread; whole book exports as PDF |

Run the sticker library work (annotation schema, admin page, first 30 stickers) alongside M1 to M5, since composition depends on it.

## Kickoff prompt for Claude Code

> Read PLAN.md fully. It describes Text Scrapbook, a local-first web app that turns screenshots of a couple's text conversation into a vintage digital scrapbook.
>
> Build milestones M0 and M1 only, then stop and show me how to run them.
>
> Requirements:
> - Follow the tech stack and data model in PLAN.md. Put every model behind a provider interface so local and cloud options can swap.
> - Create a fixture: a fictional couple, Sam and Rio, with about 80 messages from March 2, 2025 to October 2026, including the rain-check day on October 14, 2025 and the recurring "tiny umbrella" inside joke.
> - For M1, build the Konva spread renderer and these SVG sticker templates with named slots: time counter card, postage stamp, ticket stub, license plate, label-maker tape, torn paper strip, matchbox, wax seal. Each template gets an annotation JSON that matches the schema in PLAN.md, validated with Zod.
> - Recreate the Chapter 3 spread from a hand-written Spread JSON file as the M1 acceptance test.
> - Visual style: deep red #8e1f1f and cream #f1e7d3, kraft paper, Caveat for handwriting, Special Elite for typewriter text, Alfa Slab One for embossed text.
> - All assets must be original. No recognizable characters, brands, or logos.
> - Never log message text. Keep all data in a local ./data folder.
>
> Before writing code, summarize your plan for M0 and M1 in a few bullets and wait for my go-ahead.
