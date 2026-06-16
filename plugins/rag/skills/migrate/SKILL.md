---
name: migrate
description: Upgrade an existing rag-memory/ corpus that was initialized by an older version of the RAG plugin to the current schema (commit boundary + backlog/done lifecycle). Use when the user upgraded the plugin, when /rag:init or the orchestrator reports an un-migrated corpus, when trace.md is being committed, or when issues/backlog or issues/done are missing. Triggers include "migrate rag", "upgrade my rag corpus", "rag schema", "gap fill", or "my rag-memory is on an old version".
---

# RAG Migrate

Bring an existing `rag-memory/` corpus up to current. A corpus created by an older plugin version is
missing the commit boundary (`.gitignore`), the `backlog/` and `done/` lifecycle dirs, the
`.rag-meta.json` stamp, the refreshed instruction docs, the YAML frontmatter on `system/` knowledge
docs, and the header on issue cards' `context.md` — so the current guarantees **silently don't apply**
until you migrate (most importantly, `trace.md` keeps getting committed, and `system/` docs and cards
stay machine-unreadable).

The deterministic `bin/rag-migrate` script (on PATH when the plugin loads; **idempotent and dry-run by
default**) does all of it: structure, `system/` docs, **and** a no-parse header stamp on issue cards'
`context.md`. Enriching a card's content (filling `title`/`opened`, sharpening the body) is a separate,
optional, reviewed step — `/rag:enrich` — never required to upgrade between versions.

## When to use

- Right after upgrading the `rag` plugin, on any pre-existing corpus.
- When `/rag:init` or the `memory` orchestrator reports the corpus is un-migrated.
- When you notice `trace.md` files being committed, or `issues/backlog/` / `issues/done/` missing.

`bin/rag-migrate` does it all deterministically: structure, `system/` docs, and a **no-parse card
header stamp** (`card_id` from the directory name; `title`/`opened`/`closed`/`tags` left empty). The
stamp never parses a card body — that is what kept earlier attempts brittle. Filling those empty fields
and sharpening content is the optional, reviewed `/rag:enrich` pass, kept separate so upgrading between
versions stays review-free.

## Part 1 — `bin/rag-migrate` (structure + system/ docs)

1. **Check.** `rag-migrate --check` exits `10` if migration is needed, `0` if up-to-date.
2. **Preview (dry-run).** Run `rag-migrate` (optionally `--root <path>`). It prints the plan —
   missing dirs, `.gitignore` to write, git-tracked local-state files to untrack, hash-gated doc
   refreshes, the `system/` doc headers, and the `.rag-meta.json` stamp. Nothing is changed.
3. **Apply.** Run `rag-migrate --apply`. It performs the plan and, for a git corpus, runs
   `git rm --cached` on every tracked `trace.md` and `issues/active|backlog|done` file (kept on
   disk) so the boundary takes effect.
4. **Commit.** Follow the printed guidance.

What `bin/rag-migrate` will and won't touch:
- **Creates** missing `issues/backlog/`, `issues/done/` (and any missing `archive/` or `system/*`).
- **Writes** `.gitignore` only if absent; if one exists but lacks `**/trace.md`, it warns instead of editing yours.
- **Refreshes** `README.md`, `issues/README.md`, `BENCHMARKS.md`, `system/README.md` **only if they
  still match a known old template** (hash check). If you edited them, it leaves them and warns.
- **Brings `system/` knowledge docs to the doc `format_gen`** (self-describing). A doc with no
  frontmatter is bootstrapped (header derived from the `**Source**` labels and H1 already in it); one
  with a header gets its `format_gen` swept (legacy `plugin_schema` -> `format_gen`)/stamped; one
  already current is skipped. Writes only the header — **the body is never edited**. Scans every
  subfolder of `system/` (nesting allowed); `README.md` and root-level `*.md` are excluded.
- **Stamps** each issue card's `context.md` with a deterministic no-parse header (`card_id` from the dir
  name; other fields empty), or sweeps/stamps `format_gen` on a carded one. **Never** reads or edits a
  card *body*, touches `trace.md`/`benchmarks.md`, deletes a card, or touches legacy `issues/closed/`.

## Part 2 — (optional) enrich cards with `/rag:enrich`

Part 1 already gives every card a current header, but a freshly stamped card has empty `title`/`opened`
(the stamp never parses a body). To fill those and sharpen content, run the opt-in, **reviewed**
`/rag:enrich` pass. It is **not** required to be up to date — it is a content step you choose to run.

`/rag:enrich` reads the card body (the parsing migration avoids), fills `title`/`opened` (and `closed`
if known), sharpens the template sections, and leaves `card_id`/`format_gen` and `trace.md`/
`benchmarks.md` untouched. New cards already carry a filled header (`rag-new-card` via `/rag:card`), so
enrichment is only for older or thin cards. See `skills/enrich/SKILL.md`.

## Key details

- Idempotent: re-running after a successful migration reports "up to date".
- All files stay on disk; `git rm --cached` only stops tracking them.
- Already-committed `trace.md` must be untracked (which this does) — `.gitignore` alone can't.
