# RAG Memory System — Structure & Usage Guide

This document defines the layout, instruction file locations, and benchmark promotion rules for the two-layer RAG memory system: **System Knowledge** (long-term, versioned) and **Issue Memory** (active work, curated).

---

## Directory Structure

```
rag-memory/
├── README.md
├── BENCHMARKS.md
├── system/
│   ├── README.md
│   ├── architecture/      ← Repo maps, integration topology, deployment layout
│   ├── schemas/           ← DDL summaries, table relationships, schema quirks
│   ├── services/          ← Per-service behavior, config edge cases, controller quirks
│   └── known-behaviors/   ← Promoted findings from issues — confirmed system behaviors
└── issues/
    ├── README.md
    ├── active/            ← Current investigation cards (CARD-XXXXX/)
    ├── closed/            ← Recently closed (rolling 2 quarters)
    └── archive/           ← Older issues, low priority
```

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
| System knowledge | `system/` | Permanent, updated | Yes |
| Active issues | `issues/active/` | Duration of card | No (local) |
| Closed issues | `issues/closed/` | Rolling 2 quarters | Optional |
| Archived issues | `issues/archive/` | Indefinite, low priority | Optional |
| Promoted benchmarks | `system/known-behaviors/` | Permanent | Yes |
