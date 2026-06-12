---
name: migrate
description: Upgrade an existing rag-memory/ corpus that was initialized by an older version of the RAG plugin to the current schema (commit boundary + backlog/done lifecycle). Use when the user upgraded the plugin, when /rag:init or the orchestrator reports an un-migrated corpus, when trace.md is being committed, or when issues/backlog or issues/done are missing. Triggers include "migrate rag", "upgrade my rag corpus", "rag schema", "gap fill", or "my rag-memory is on an old version".
---

# RAG Migrate

Bring an existing `rag-memory/` corpus up to the current plugin schema. A corpus created by an older
plugin version is missing the commit boundary (`.gitignore`), the `backlog/` and `done/` lifecycle
dirs, the `.rag-meta.json` version stamp, the refreshed instruction docs, and (schema 3) the YAML
frontmatter on `system/` knowledge docs — so the current guarantees **silently don't apply** until
you migrate (most importantly, `trace.md` keeps getting committed, and `system/` docs stay
machine-unreadable).

Driven by the bundled `bin/rag-migrate` script (on PATH when the plugin loads). It is **idempotent
and dry-run by default**, so it is safe to run anytime.

## When to use

- Right after upgrading the `rag` plugin, on any pre-existing corpus.
- When `/rag:init` or the `memory` orchestrator reports the corpus is un-migrated.
- When you notice `trace.md` files being committed, or `issues/backlog/` / `issues/done/` missing.

## Workflow

1. **Check.** `rag-migrate --check` exits `10` if migration is needed, `0` if up-to-date.
2. **Preview (dry-run).** Run `rag-migrate` (optionally `--root <path>`). It prints the plan —
   missing dirs, `.gitignore` to write, git-tracked local-state files to untrack, hash-gated doc
   refreshes, and the schema stamp. Nothing is changed.
3. **Apply.** Run `rag-migrate --apply`. It performs the plan and, for a git corpus, runs
   `git rm --cached` on every tracked `trace.md` and `issues/active|backlog|done` file (kept on
   disk) so the boundary takes effect.
4. **Commit.** Follow the printed guidance: `git add -A` then commit the new `.gitignore`,
   `.rag-meta.json`, refreshed READMEs, and the trace untrackings.

## What it will and won't touch

- **Creates** missing `issues/backlog/`, `issues/done/` (and any missing `archive/` or `system/*`).
- **Writes** `.gitignore` only if absent; if one exists but lacks `**/trace.md`, it warns instead of editing yours.
- **Refreshes** `README.md`, `issues/README.md`, `BENCHMARKS.md`, `system/README.md` **only if they
  still match a known old template** (hash check). If you edited them, it leaves them and warns.
- **Brings `system/` knowledge docs to the current doc schema** (schema 3+). Docs are
  **self-describing** via a `plugin_schema` field in their frontmatter, so the migration is
  forward-only and idempotent:
  - a doc with **no frontmatter** is bootstrapped — a header (`title`/`domain`/`source_cards`/
    `created`/`updated`/`status`/`plugin_schema`/`tags`) is *prepended*, derived from the `**Source**`
    labels and H1 already in the doc;
  - a doc that **already has frontmatter** just gets its `plugin_schema` stamped/bumped to current;
  - a doc **already at the current `plugin_schema`** is skipped.
  It writes only the header — the body is never edited. The scan covers **every subfolder of
  `system/`** (nesting allowed); `domain` is the doc's path under `system/`. `README.md` files and any
  `*.md` directly under `system/` are excluded. No per-version hash table and no replaying intermediate
  schemas — the doc itself says where it is.
- **Never** deletes a card, edits the *body* of a `system/` doc, or touches legacy `issues/closed/`.

## Key details

- Idempotent: re-running after a successful migration reports "up to date".
- All files stay on disk; `git rm --cached` only stops tracking them.
- Already-committed `trace.md` must be untracked (which this does) — `.gitignore` alone can't.
