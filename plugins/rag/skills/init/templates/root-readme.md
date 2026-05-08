# RAG Memory System

A two-layer retrieval-augmented memory system for investigation work.

## Layers

- **System Knowledge** (`system/`) — Long-term, versioned knowledge about the codebase, schemas, services, and confirmed behaviors. This is the durable layer. Commit it to Git.
- **Issue Memory** (`issues/`) — Active investigation cards, closed cards, and archived cards. This is the working layer.

## Directory Layout

```
rag-memory/
├── README.md              ← You are here
├── BENCHMARKS.md          ← What constitutes a benchmark moment
├── system/
│   ├── README.md
│   ├── architecture/      ← Repo maps, integration topology, deployment layout
│   ├── schemas/           ← DDL summaries, table relationships, schema quirks
│   ├── services/          ← Per-service behavior, config edge cases, controller quirks
│   └── known-behaviors/   ← Promoted findings from issues — confirmed system behaviors
└── issues/
    ├── README.md
    ├── active/            ← Current investigation cards
    ├── closed/            ← Recently closed (rolling 2 quarters)
    └── archive/           ← Older issues, low priority
```

## Navigation

- To understand what goes in `system/`, read `system/README.md`
- To understand the card lifecycle, read `issues/README.md`
- To understand benchmark promotion, read `BENCHMARKS.md`

## Promotion Rules

When analysis on an active issue yields a finding that teaches something **durable** about the system — not just how to fix this card, but how the system behaves in a category of situations — that finding should be promoted from the issue card into `system/known-behaviors/` (or another appropriate `system/` subfolder).

See `BENCHMARKS.md` for the full checklist.

## Curation Policy

| Layer | Location | Retention | Git-versioned? |
|---|---|---|---|
| System knowledge | `system/` | Permanent, updated | Yes |
| Active issues | `issues/active/` | Duration of card | No (local) |
| Closed issues | `issues/closed/` | Rolling 2 quarters | Optional |
| Archived issues | `issues/archive/` | Indefinite, low priority | Optional |
| Promoted benchmarks | `system/known-behaviors/` | Permanent | Yes |
