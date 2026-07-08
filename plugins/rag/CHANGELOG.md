# Changelog

All notable changes to the `rag` plugin are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com); the plugin uses semantic versioning.

## [0.6.1] - 2026-07-08

### Fixed
- **`bin/` scripts now run on Windows where `python3` is the Microsoft Store alias stub.**
  `rag-trace`, `rag-new-card`, and `rag-migrate` used `#!/usr/bin/env python3`; on Windows that often
  resolves to the App Execution Alias stub (prints "Python was not found" and exits non-zero) rather
  than a real interpreter, so invoking them bare -- exactly how the skills call them -- silently
  no-opped. Each script is now a POSIX-sh / Python 3 polyglot: a `/bin/sh` prologue health-checks
  `python3` -> `python` -> `py -3` (skipping any that fail `-c ""`, which is how the stub is skipped)
  and re-execs the file under the first working interpreter. On POSIX this simply re-execs `python3`.
  No new dependencies; the `rag-<tool>` call contract is unchanged.

### Internal
- `tests/test_bin_launcher.py` locks the launcher structure (sh shebang, health-checked resolution,
  valid Python module, single docstring before `__future__`) so the bare `python3` shebang cannot
  silently return.

## [0.6.0] - 2026-07-08

### Added
- **`bin/rag-trace` trace-append helper.** A stdlib-only script (sibling to `rag-new-card`/`rag-migrate`,
  on PATH when the plugin loads) that appends one structured entry to an active card's `trace.md`:
  `rag-trace --card CARD-XXXXX --type finding --body "..."` (or pipe a multi-line body on stdin). It
  stamps the timestamp, formats the block, and appends in append mode, so the format cannot drift and
  append-only is guaranteed by the tool. Line counts are read inside the script, so the model no longer
  re-reads the growing trace on every entry (removing an input-token tax); the entry body stays
  model-authored. It bootstraps `trace.md`'s header for a card just activated from backlog, and refuses
  non-active cards with an activation hint.
- **Trace economy convention.** `skills/trace/SKILL.md` gains a "Writing economical entries" section:
  asymmetric economy - cut framing prose, keep evidence (file paths, numbers, commands, errors)
  verbatim. Mirrored as short pointers in the card `trace.md` template and `structure.md`.
- **"The card is the plan" guardrail.** `structure.md` and the orchestrator now state that a card's
  `context.md` is its single plan of record; do not keep a parallel plan (e.g. a plan-mode file) that
  can drift and cause rework on resume.

### Changed
- **`/rag:trace` now calls `rag-trace`** as its primary path (the hand-built append is kept only as a
  fallback for when the helper is not on PATH).



### Added
- **Issue-card headers.** Each card's `context.md` now carries a YAML frontmatter header
  (`card_id`, `title`, `opened`, `closed`, `format_gen`, `tags`) so cards are queryable and migratable.
  The card's origin (`source`) stays in the body's Issue Summary — it goes stale over time and adds no
  durable query value. Lifecycle state stays directory-derived (not in the header). `trace.md`/
  `benchmarks.md` are intentionally headerless (their `---`-fenced entry blocks would collide with a
  file-level header). New cards get a filled header from `rag-new-card` (via `/rag:card`).
- **Deterministic no-parse card stamp in `bin/rag-migrate`.** Existing cards are brought to the current
  card format by the deterministic migrator itself: it adds/sweeps the header using `card_id` from the
  **directory name** and leaves `title`/`opened`/`closed`/`tags` empty — it never reads or parses a card
  body (which is what made earlier parse-the-body attempts brittle). Only `context.md` is touched;
  `trace.md`/`benchmarks.md` are left alone. Cards version on their own `format_gen` lineage, independent
  of `system/` docs.
- **`/rag:enrich` skill.** A separate, opt-in, **reviewed** AI pass that fills a card header's empty
  `title`/`opened` from the body and sharpens the content. Kept distinct from migration so "upgrade my
  corpus" stays deterministic and review-free.
- **`closed:` stamped on close.** The `/rag:memory` close ceremony stamps `closed: <date>`
  (stamp-if-empty) when a card is filed to `done/`/`archive/`.

### Changed
- **The version field is renamed `plugin_schema` -> `format_gen`** in every file and in
  `.rag-meta.json`, and means "the format generation this file conforms to" (a monotonic integer,
  decoupled from the plugin SemVer). `rag-migrate` **sweeps** the legacy `plugin_schema` name to
  `format_gen` and reads either (plus the older `schema` key) so corpora from any prior version upgrade.
- **`.rag-meta.json` carries per-kind generations** — `{"format_gen": {"doc": N, "card": M}, ...}` — so
  docs and cards advance on independent lineages and a card's generation can be checked cheaply.
  `read_corpus_gen` reads the new map and every legacy shape (a flat int / `plugin_schema` / `schema` is
  read as the doc generation, card 0).

## [0.4.0] - 2026-06-12

### Added
- **YAML frontmatter on `system/` knowledge docs** (corpus schema **2 → 3**). Each doc now opens with
  a machine-parseable header — `title`, `domain`, `source_cards`, `created`, `updated`, `status`,
  `plugin_schema`, `tags` — that the planned retrieval indexer and Obsidian properties can consume.
  Provenance is **hybrid**: the header aggregates it at the file level while each finding keeps its
  per-section `**Source**` line for finding-level attribution.
- **Self-describing migration via `plugin_schema`.** Each doc records the corpus generation it was
  last aligned to, so `rag-migrate` upgrades a corpus by reading each doc's `plugin_schema` and applying
  only the forward transforms it lacks — forward-only and idempotent (a doc already at the current
  version is skipped). No per-version hash tables, no replaying intermediate schemas, no guessing from
  content.
- **`rag-migrate` doc gap-fill (recursive).** Brings `system/` docs to the current schema: a doc with
  no frontmatter is bootstrapped (header derived from the `**Source**` labels + H1 already in it, then
  stamped `plugin_schema`); a doc that already has frontmatter just gets `plugin_schema` stamped. It
  writes only the header — the body is never edited. The scan covers **every subfolder of `system/`**
  (nesting allowed), so corpora with custom or nested domain folders are handled; `README.md` and files
  directly under `system/` are excluded. Idempotent, dry-run by default.

### Changed
- **`/rag:promote`** writes frontmatter when creating a `system/` doc, and on append updates the
  header (`source_cards` union, `updated` date) in addition to adding the section.
- **Format docs** (`skills/memory/references/structure.md`, the `system/README.md` template) document
  the frontmatter convention and field meanings. `rag-migrate` now also hash-refreshes `system/README.md`.

## [0.3.0] - 2026-06-09

### Added
- **Bundled `batman` investigative agent** (`agents/batman.md`). Installing `rag` now also delivers
  the investigator that drives the memory system: it opens a card before touching anything, logs
  every finding to the trace, promotes durable findings to `system/`, and runs the close ceremony.
  Claude Code namespaces plugin agents as `plugin:agent`, so it is invoked as `@rag:batman`.

## [0.2.0] - 2026-06-08

### Added
- **Backlog state** (`issues/backlog/`) for planned, not-yet-active cards (local, per-dev).
- **`bin/rag-new-card`** — one-command card scaffolder (Python, stdlib-only). Stamps a card and
  substitutes template tokens; `--backlog` creates a context-only card; refuses to overwrite an
  existing card.
- **Generated corpus `.gitignore`** (`skills/init/templates/corpus-gitignore`), written by `/rag:init`,
  which enforces the commit boundary.
- **Skill-discovery convention** (`features/skill-opportunities.md`) — treat trace review as a pass
  that surfaces custom-skill opportunities and known skills worth adopting.
- **`bin/rag-migrate` + `/rag:migrate`** — idempotent, dry-run-by-default upgrade path for a corpus
  created by an older plugin version: creates `backlog/`+`done/`, writes the `.gitignore` boundary,
  untracks already-committed `trace.md`/local-state via `git rm --cached`, hash-gates doc refreshes,
  and stamps `.rag-meta.json`. `/rag:init` now writes `.rag-meta.json` and routes existing corpora to migrate.

### Changed
- **Lifecycle is now two terminal states:** `active → done` (local, not committed) **or**
  `active → archive` (durable, committed). The close ceremony asks which.
- **Firm commit boundary.** Local working state (`backlog/`, `active/`, `done/`, and every `trace.md`)
  is gitignored; the committed surface is `system/` + `issues/archive/` (context + benchmarks +
  artifacts). `trace.md` is never committed, even inside `archive/`.
- **`/rag:card`** now scaffolds via `bin/rag-new-card` in a single call instead of manual file
  placement (manual fallback documented).
- **Promotion sweeps the trace.** `/rag:promote` and the close ceremony scan `trace.md` for
  benchmark-worthy findings never tagged in `benchmarks.md` and surface them as candidates — read-only
  on the trace.
- **`/rag:context`** locates a card in `active/`, then `done/` / `archive/` (and legacy `closed/`).

### Deprecated
- **`issues/closed/`** — superseded by `done/` (local) + `archive/` (committed). Existing `closed/`
  cards remain readable; no new ones are created.

[0.5.0]: https://github.com/nicholas1513/claude-plugins
[0.4.0]: https://github.com/nicholas1513/claude-plugins
[0.2.0]: https://github.com/nicholas1513/claude-plugins
