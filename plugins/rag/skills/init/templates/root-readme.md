# RAG Memory System

A two-layer retrieval-augmented memory system for investigation work.

## Layers

- **System Knowledge** (`system/`) — Long-term, versioned knowledge about the codebase, schemas, services, and confirmed behaviors. The durable layer. **Committed to Git.**
- **Issue Memory** (`issues/`) — Investigation cards across their lifecycle: planned (`backlog/`), active, finished-locally (`done/`), and the durable committed record (`archive/`). Mostly local working state.

## Directory Layout

```
rag-memory/
├── README.md              ← You are here
├── BENCHMARKS.md          ← What constitutes a benchmark moment
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
    ├── active/            ← Current investigation cards (local, gitignored)
    ├── done/              ← Finished locally, kept per-dev (local, gitignored)
    └── archive/           ← Durable, committed shared record (trace.md excluded)
```

> **Legacy:** `issues/closed/` is superseded by `done/` (local) + `archive/` (committed). Existing
> `closed/` cards remain readable; new work uses the two terminal states above.

## Navigation

- To understand what goes in `system/`, read `system/README.md`
- To understand the card lifecycle, read `issues/README.md`
- To understand benchmark promotion, read `BENCHMARKS.md`

## Promotion Rules

When analysis on an active issue yields a finding that teaches something **durable** about the system
— not just how to fix this card, but how the system behaves in a category of situations — promote it
from the issue card into `system/known-behaviors/` (or another appropriate `system/` subfolder). When
closing a card, sweep its `trace.md` for benchmark-worthy findings that were never tagged, so none are
stranded.

See `BENCHMARKS.md` for the full checklist.

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
