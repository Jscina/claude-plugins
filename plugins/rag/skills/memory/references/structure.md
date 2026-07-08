# RAG Memory System — Structure & Usage Guide

This document defines the layout, instruction file locations, and benchmark promotion rules for the two-layer RAG memory system: **System Knowledge** (long-term, versioned) and **Issue Memory** (active work, curated).

---

## Directory Structure

```
rag-memory/
├── README.md
├── BENCHMARKS.md
├── .gitignore             ← Commit boundary: local working state vs. committed record
├── system/
│   ├── README.md
│   ├── architecture/      ← Repo maps, integration topology, deployment layout
│   ├── schemas/           ← DDL summaries, table relationships, schema quirks
│   ├── services/          ← Per-service behavior, config edge cases, controller quirks
│   └── known-behaviors/   ← Promoted findings from issues — confirmed system behaviors
└── issues/
    ├── README.md
    ├── backlog/           ← Planned, not yet active (local, gitignored)
    ├── active/            ← Current investigation cards CARD-XXXXX/ (local, gitignored)
    ├── done/              ← Finished locally, kept per-dev (local, gitignored)
    └── archive/           ← Durable, committed shared record (trace.md excluded)
```

> **Legacy:** `issues/closed/` is superseded by `done/` (local) and `archive/` (committed).
> Existing `closed/` cards remain readable; new work uses the two terminal states above.

## Active Card Structure

Each card lives in `issues/active/CARD-XXXXX/` and contains:

- **context.md** — Issue ID, source (ADO/QA/prod), symptom, repos, schema tables, related issues, AI session log
- **trace.md** — Append-only running analysis log: findings, rule-outs, hypotheses, next steps
- **benchmarks.md** — Benchmark moments found during investigation, with promotion status
- **artifacts/** — Code snippets, DDL excerpts, log samples, schema diffs

> **`context.md` is the card's plan of record — the single source of truth.** It carries the framing,
> current status, and next actions that a resumed session loads via `/rag:context`. **Do not keep a
> parallel plan for a card outside it** (e.g. a plan-mode scratch file) — two plans drift, and a stale
> one causes rework on resume. If a planning step produces an external plan, fold it into `context.md`
> and leave at most a pointer behind once the work lives in the card.

## Benchmark Promotion Lifecycle

A **benchmark moment** is when analysis yields a finding that teaches something durable about the system — not just how to fix this card, but how the system behaves in a category of situations.

1. Finding made during issue analysis
2. Is this specific to this issue only? → Yes: log in trace.md only
3. Does it reveal something about system behavior, schema design, or service interaction? → Yes: tag in card benchmarks.md as `BENCHMARK — pending`
4. Determine target: `system/known-behaviors/`, `system/services/`, `system/schemas/`, or `system/architecture/`
5. Write or append to target system/ file
6. Mark benchmarks.md entry as `BENCHMARK — promoted` with file path and date
7. Commit system/ to Git

> **Sweep at close:** during a card's close ceremony, re-read `trace.md` and apply steps 3–6 to any
> benchmark-worthy `finding` that was never tagged — so findings logged only in the trace still get
> promoted. The sweep reads the trace; it never modifies it.

## Benchmark Tags

- `BENCHMARK — pending` → confirmed, not yet promoted
- `BENCHMARK — promoted` → written to system/, includes target path
- `BENCHMARK — rejected` → reviewed, too issue-specific to promote

## Promotion Checklist

- [ ] Finding has been confirmed (not just hypothesized)
- [ ] It applies beyond this specific card
- [ ] A target file in system/ has been identified
- [ ] The finding has been written in system/ format (context-focused, not issue-specific)
- [ ] benchmarks.md in the card has been updated to PROMOTED
- [ ] `trace.md` swept for un-tagged benchmark-worthy findings (none stranded)

## System File Format

Each `system/` knowledge doc opens with a YAML **frontmatter** header — file-level,
machine-parseable metadata (consumable by the retrieval indexer and Obsidian properties) — then the
body. Provenance is **hybrid**: the header aggregates it at the file level, while each finding keeps
its own `**Source**` line for finding-level attribution (one doc commonly aggregates findings from
several cards).

```markdown
---
title: [Human title — mirrors the H1]
domain: [subfolder under system/ — e.g. known-behaviors, or nested area/subarea]
source_cards: [CARD-XXXXX, CARD-YYYYY]
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active        # active | superseded
format_gen: 3
tags: []
---

# [Title]

## [Short title]
**Source**: CARD-XXXXX | YYYY-MM-DD
**Finding**: [Body]
**Impact**: [What this affects going forward]
```

| Field | Meaning |
|---|---|
| `title` | Human title; mirrors the H1. Double-quote if it contains a colon or backtick. |
| `domain` | The doc's subfolder path under `system/` (e.g. `known-behaviors`; may be nested like `area/subarea`). |
| `source_cards` | Union of every card that contributed a section to this file. |
| `created` / `updated` | Earliest / latest contribution dates. |
| `status` | `active`, or `superseded` when the doc is retired. |
| `format_gen` | The format generation this file conforms to (a monotonic integer). Makes the file **self-describing**, so an upgrade reads it to decide whether the file needs updating — no content guessing, no per-version hash tables, no replaying intermediate schemas. **Docs and cards have independent `format_gen` lineages** (a doc's `3` and a card's `1` are unrelated counters); each only advances when *its own kind's* format changes. |
| `tags` | Free-form; a corpus may use these for its own finer-grained taxonomy. |

> **Self-describing migration.** `rag-migrate` (deterministic) brings **both kinds** to their current
> generation. For **system/ docs** it reads each doc's `format_gen`, bootstrapping a header from labels
> already in the body when absent, idempotently and without altering the body (the scan covers every
> subfolder of `system/`; nesting allowed). For **issue cards** it stamps each `context.md` with a
> **deterministic, no-parse** header (`card_id` from the directory name; `title`/`opened`/`closed`/`tags`
> left empty) — the card body is never read, which is what keeps the stamp free of the free-text parsing
> bugs that motivated this design. The legacy field name `plugin_schema` is swept to `format_gen` for
> both. `.rag-meta.json` records the **per-kind** current generations as
> `{"format_gen": {"doc": N, "card": M}, "plugin": "rag"}`. Filling a card's empty `title`/`opened` and
> sharpening its body is the separate, opt-in, reviewed `/rag:enrich` pass — never part of migration.

## Issue Card Header Format

Each card's `context.md` carries a YAML frontmatter header (so cards are queryable and migratable);
`trace.md` and `benchmarks.md` do **not** (their `---`-fenced entry blocks would collide with a
file-level header). Lifecycle state (`backlog`/`active`/`done`/`archive`) is **not** in the header —
the directory is its single source of truth.

```markdown
---
card_id: CARD-XXXXX
title: ""                 # optional human title; H1 is usually just the id
opened: YYYY-MM-DD
closed:                   # set when filed to done/archive
format_gen: 1
tags: []
---

# CARD-XXXXX

## Issue Summary
- **Card ID**: CARD-XXXXX
- **Source**: ado | qa | prod | other
...
```

The card's **Source** stays in the body's Issue Summary (not the header) — origin systems go stale
over time and add no durable query value. **New** cards are stamped with a filled header by `rag-new-card`
(via `/rag:card`). **Existing** cards are stamped by `rag-migrate` itself: when a card's header is missing
or its `format_gen` is below the current card generation, the migrator adds/sweeps the header
**deterministically and without parsing** — `card_id` from the directory name, `title`/`opened`/`closed`
left empty — and never reads or edits the body. Filling those empty fields and sharpening the body is the
optional, reviewed `/rag:enrich` pass. `closed` is stamped by the close ceremony when the card is filed to
`done/`/`archive/`.

## Trace Entry Format

```
---
date: YYYY-MM-DD HH:MM
session: [claude / gemini / manual]
type: [finding | ruled-out | hypothesis | next-step]
---
[Entry body]
```

**Entry economy.** Write the body with *asymmetric economy* — cut framing/restatement prose, but keep
evidence (file paths, line numbers, exact constants, commands, error text) verbatim; those are the
load-bearing tokens a cold session re-reads. Append entries directly (no full-file re-read on each
append — that is a growing input-token tax). See `skills/trace/SKILL.md` for the mechanics.

## Curation Policy

| Layer | Location | Retention | Git-versioned? |
|---|---|---|---|
| System knowledge | `system/` | Permanent, updated | **Yes** |
| Backlog (planned) | `issues/backlog/` | Until activated or dropped | **No — local** |
| Active issues | `issues/active/` | Duration of card | **No — local** |
| Done (finished locally) | `issues/done/` | Per-dev preference | **No — local** |
| Archived issues | `issues/archive/` | Indefinite, durable | **Yes — except `trace.md`** |
| Trace logs | `**/trace.md` | Local working state | **Never committed** |
| Promoted benchmarks | `system/known-behaviors/` | Permanent | **Yes** |
| Closed (legacy) | `issues/closed/` | Superseded by done/archive | Pre-existing only |
