# Changelog

All notable changes to the `rag` plugin are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com); the plugin uses semantic versioning.

## [0.4.0] - 2026-06-11

### Added
- **YAML frontmatter on `system/` knowledge docs** (corpus schema **2 → 3**). Each doc now opens with
  a machine-parseable header — `title`, `domain`, `source_cards`, `created`, `updated`, `status`,
  `schema_version`, `tags` — that the planned retrieval indexer and Obsidian properties can consume.
  Provenance is **hybrid**: the header aggregates it at the file level while each finding keeps its
  per-section `**Source**` line for finding-level attribution.
- **Self-describing migration via `schema_version`.** Each doc records the doc-format version it
  conforms to, so `rag-migrate` upgrades a corpus by reading each doc's `schema_version` and applying
  only the forward transforms it lacks — forward-only and idempotent (a doc already at the current
  version is skipped). No per-version hash tables, no replaying intermediate schemas, no guessing from
  content.
- **`rag-migrate` doc gap-fill (recursive).** Brings `system/` docs to the current schema: a doc with
  no frontmatter is bootstrapped (header derived from the `**Source**` labels + H1 already in it, then
  stamped `schema_version`); a doc that already has frontmatter just gets `schema_version` stamped. It
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

[0.4.0]: https://github.com/nicholas1513/claude-plugins
[0.2.0]: https://github.com/nicholas1513/claude-plugins
