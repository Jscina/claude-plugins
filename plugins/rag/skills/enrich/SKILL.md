---
name: enrich
description: Enrich an existing RAG issue card's context.md as an opt-in, reviewed AI pass -- fill the header's title and opened from the body and sharpen the content -- separate from format migration (which only stamps the header, no parsing). Use after rag-migrate stamps a card (leaving title/opened empty), or when a card's context.md is thin or stale. Triggers include "enrich this card", "fill in the card header", "flesh out CARD-XXXXX", "the card title or opened is empty", or "bring this card up to the template".
---

# RAG Enrich

Bring an existing issue card's `context.md` fully up to the current template and **enrich** it: fill the
header fields the deterministic migrator leaves empty (`title`, `opened`), and sharpen the body (tighten
the symptom, fill obvious gaps in the template sections). This is an **opt-in, reviewed** pass — distinct
from `rag-migrate`, which only *format*-stamps cards (no parsing, no review). Enrichment is never part of
"upgrade my corpus."

## Why this is separate from migration

`rag-migrate` stamps a card header **deterministically and without parsing** — `card_id` comes from the
directory name; `title`/`opened`/`closed`/`tags` are left empty. That is on purpose: parsing free-text
card bodies produced real bugs, so the migrator never reads a body. `/rag:enrich` is the *other* half —
it reads the body (the parsing step), fills the empty fields, and improves content — and because it
edits the body it is **reviewed**, unlike the reviewless migration.

## When to use

- After `rag-migrate --apply` has stamped a card header (so `title`/`opened` are empty) and you want
  them filled and the content sharpened.
- When a card's `context.md` is thin, stale, or has drifted from the current template.
- **Not** for fresh cards — `rag-new-card` (via `/rag:card`) already fills the header from your inputs.

## Scope — read before editing

- **Only `context.md`.** Never touch `trace.md` or `benchmarks.md`: their per-entry `---` blocks would
  collide with a file-level header, and `trace.md` is append-only local state.
- **Preserve `card_id` and `format_gen`.** The migrator owns those. Enrichment fills/sharpens; it does
  **not** re-stamp the format generation or rename the card.
- **Never invent facts or delete real content.** Leave a field empty if the answer is genuinely unknown.

## Workflow

1. **Locate the card.** Find `issues/{backlog,active,done,archive}/CARD-XXXXX/context.md`. If it has no
   YAML header yet, run `rag-migrate --apply` first to stamp it deterministically, then enrich.

2. **Read the template as the spec.** `skills/card/templates/context.md` defines the current shape: the
   header (`card_id`, `title`, `opened`, `closed`, `format_gen`, `tags`) and the body sections (Issue
   Summary, Reproduction Steps, Relevant Repos and File Ranges, Relevant Schema Tables, Related Prior
   Issues, AI Session Log).

3. **Fill the empty header fields from the body:**
   - `title` — a short human title drawn from the H1 or the Issue Summary symptom. Leave `""` if the H1
     is just the card id and nothing better exists.
   - `opened` — the real open date from the Issue Summary "Date Opened" (or the first AI Session Log
     entry). Leave empty if genuinely unknown.
   - `closed` — only for a `done/`/`archive/` card with a known close date (the close ceremony usually
     stamps this). Otherwise leave empty.
   - `tags` — optional topical tags that would help retrieval.
   Keep `card_id` and `format_gen` exactly as the migrator set them.

4. **Sharpen the body.** Tighten the symptom, fill obvious gaps, and align the section structure to the
   template — without inventing facts or removing real content.

5. **Review, then write.** Show the user the proposed `context.md` (or just the changed fields) and get
   approval before writing. Write only `context.md`; leave `trace.md` and `benchmarks.md` alone.

## Relationship to the rest of the plugin

- `rag-migrate` (deterministic, no-parse, no-review) guarantees every card *has* a current header.
- `/rag:enrich` (AI, parses the body, reviewed) fills and sharpens it.
- `/rag:card` + `rag-new-card` create fresh cards already carrying a filled header.

Splitting the deterministic stamp from the reviewed enrichment keeps "upgrade my corpus" safe and
reviewless while still letting you enrich a card whenever you choose to.
