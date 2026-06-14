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

Two parts: the deterministic `bin/rag-migrate` script (on PATH when the plugin loads; **idempotent and
dry-run by default**) handles structure + `system/` docs, and **you** upgrade issue cards with the AI
step below. The script never touches cards.

## When to use

- Right after upgrading the `rag` plugin, on any pre-existing corpus.
- When `/rag:init` or the `memory` orchestrator reports the corpus is un-migrated.
- When you notice `trace.md` files being committed, or `issues/backlog/` / `issues/done/` missing.

Migration has **two parts**: the deterministic `bin/rag-migrate` script (structure + `system/` docs),
and an **AI card-upgrade step** you perform (issue cards). Cards are kept out of the script on purpose —
parsing free-text card bodies is brittle, and an AI rewriting a card to the template can also *enrich*
it, with no per-version parsing code to maintain.

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
- **Never** touches issue cards, deletes a card, edits a doc/card body, or touches legacy `issues/closed/`.

## Part 2 — upgrade issue cards (AI, using the template)

`bin/rag-migrate` does **not** touch cards. To bring existing cards to the current card format, for each
`context.md` under `issues/{backlog,active,done,archive}/CARD-*/` whose header is **missing** or whose
`format_gen` is **below** the current card generation (see `skills/card/templates/context.md`):

1. Rewrite `context.md` to match the current card template — add/repair the YAML header
   (`card_id` from the dir name, `opened`/`title` from the Issue Summary, `closed` if known), and
   optionally **enrich** the body (sharpen the symptom, fill obvious gaps). Preserve real content.
2. Stamp the header's `format_gen` to the current card generation.
3. Leave `trace.md` and `benchmarks.md` alone — their `---`-fenced entry blocks would collide with a
   file-level header.

New cards already carry the header (`rag-new-card` via `/rag:card`), so this is only for cards created
by an older plugin version.

## Key details

- Idempotent: re-running after a successful migration reports "up to date".
- All files stay on disk; `git rm --cached` only stops tracking them.
- Already-committed `trace.md` must be untracked (which this does) — `.gitignore` alone can't.
