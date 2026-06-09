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

```markdown
## [Short title]
**Source**: CARD-XXXXX | YYYY-MM-DD
**Finding**: [Body]
**Impact**: [What this affects going forward]
```

## Trace Entry Format

```
---
date: YYYY-MM-DD HH:MM
session: [claude / gemini / manual]
type: [finding | ruled-out | hypothesis | next-step]
---
[Entry body]
```

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
