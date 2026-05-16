# ARCHITECTURE & EVOLUTION PLAN

**Project**: Decision Engine Plugin
**Version**: 0.1 (Phase 0 — initial design)
**Last Updated**: 2026-05-14
**Status**: Active planning document

> This is a **living document**. It captures the current best thinking on how the plugin should grow, and the explicit triggers that should cause us to advance to the next phase. It is a **plan**, not a **contract**. Revise when reality demands.

---

## Purpose

This document answers two questions:

1. **Where are we now**, and why?
2. **When and how do we evolve**, based on observed needs rather than speculation?

It exists at the root of the plugin to be the first thing future-you (or anyone else) reads before making architectural decisions. The cost of not having this document is panic-driven migration when the system grows past its current shape.

---

## Guiding Principles

These hold across all phases and should not be violated without explicit revision to this document:

### 1. The source of truth should remain human-editable for as long as possible

Markdown + YAML frontmatter can be parsed by any language, edited in any text editor, versioned in git, and migrated to any database. The day we lock the source of truth into a proprietary format is the day flexibility dies.

### 2. Each evolution should be additive, not replacing

Phase N+1 should layer on top of Phase N, not destroy it. Migrations should be reversible until the very latest phases. If a migration is irreversible, that fact should be flagged loudly in this document.

### 3. Solve real problems, not anticipated ones

Premature optimization is the canonical engineering failure. Each phase transition requires an **observed** problem in the prior phase — not a theorized one. Quantitative triggers below are deliberately specific to prevent "this might be useful someday" thinking.

### 4. Flexibility is not free

True flexibility comes from choosing data models that survive change, not from over-engineering. Adding a graph database "just in case" reduces flexibility because it adds operational complexity, vendor lock-in, and cognitive overhead.

### 5. Prefer boring technology

SQLite has been continuously maintained since 2000 and will outlive most current databases. Markdown is from 2004 and isn't going anywhere. Bias toward technologies with 20+ year lifespans.

---

## Current State (Phase 0)

### Architecture

```
~/.decision-engine/
├── ARCHITECTURE.md                    ← this document
├── schemas/
│   └── goal_schema_v1.md
├── goals/
│   └── <goal_id>.md                   ← YAML frontmatter + markdown body
├── workflows/                          ← (not yet defined)
│   └── <workflow_id>.md
└── runs/                               ← (not yet defined)
    └── <run_id>.md
```

### Data Format

- **Goals, Workflows, Runs**: Markdown files with YAML frontmatter
- **Index**: None yet (linear scan of filesystem)
- **Queries**: Filesystem operations (grep, find, parse)
- **Versioning**: Git (assumed; user's choice)

### What This Enables

- Reading and editing any record in any text editor
- Version control of everything through git
- Trivial backup (copy folder)
- Zero infrastructure
- Inspection by humans without tooling

### Known Limitations

- Linear scan for any query that touches multiple records
- No relational integrity (broken `parent_goals` references must be detected by tooling)
- No fast full-text search across bodies
- No transactional guarantees on multi-file updates
- Conflict detection is O(n × m) on every evaluation

### Acceptable Scale

| Record Type | Comfortable | Painful |
|---|---|---|
| Goals | <100 | >200 |
| Workflows | <50 | >100 |
| Runs | <500 | >1,000 |
| Body size per record | <50KB | >200KB |

---

## Evolution Phases

### Phase 1: SQLite as Index Layer

**Filesystem remains source of truth. SQLite caches metadata for fast queries.**

#### Triggers (any one of these justifies the move)

- Goal evaluation queries take > 2 seconds consistently
- Total goal count exceeds 50
- Need to answer queries like: "show me all goals affected by changes to assumption X across all records"
- Conflict detection across the corpus takes > 5 seconds
- Frontmatter parsing time dominates plugin invocation

#### What Changes

- A `~/.decision-engine/.index.sqlite` file is added
- Plugin reconciles the index from the filesystem on launch (using file mtimes for change detection — cheap)
- Frontmatter fields become indexed columns
- Body content remains in markdown files; index stores only metadata + a content hash
- Queries hit SQLite for filtering; filesystem reads only for full content

#### What Doesn't Change

- Source of truth remains in markdown files
- Manual edits to markdown still work (next plugin invocation reconciles)
- Git versioning unchanged
- Backup strategy unchanged (the index is regenerable; only markdown matters)

#### Reversibility

**Fully reversible.** Delete the SQLite file. Filesystem is unchanged.

#### Estimated Migration Effort

4-12 hours of development. Schema is ~10 tables (goals, relations, tags, workflows, runs, assumptions, change_log, KPIs, etc.). Most of the work is the reconciliation logic.

---

### Phase 2: SQLite as Primary, Filesystem as Human View

**SQLite becomes the runtime authority. Filesystem updates flow through the plugin.**

#### Triggers

- Complex queries are routine and SQLite must be involved in writes too (not just reads)
- Run records exceed a few hundred and need querying across them
- Need transactional updates across multiple records (e.g., renaming a goal updates all references atomically)
- Reconciliation from filesystem to index becomes the bottleneck
- Concurrent edits from multiple plugin processes/instances cause issues

#### What Changes

- Writes go to SQLite first, filesystem second (filesystem becomes a projection)
- Direct filesystem edits still work but trigger a reconciliation flow
- Schema migrations become a real concern (track schema version in DB)
- Backup strategy expands: both the markdown corpus AND the SQLite file matter

#### What Doesn't Change

- Markdown + YAML is still the human-facing format
- Records can still be read with `cat` and edited with any editor
- Anyone can use the data without the plugin (just by reading files)

#### Reversibility

**Mostly reversible.** Filesystem is still authoritative-enough to rebuild the index. But if filesystem has fallen behind during a multi-write transaction, partial state is possible.

#### Estimated Migration Effort

20-40 hours. The write path is the hard part — keeping filesystem and DB in sync without races.

---

### Phase 3: Add Graph Traversal Layer (Likely Still Inside SQLite)

**Recursive queries become essential. Most cases solved with SQLite recursive CTEs.**

#### Triggers

- Need to answer: "show me all goals transitively affected if I deprecate goal X"
- Need to answer: "what's the dependency chain from this decision back to the meta-goal?"
- Conflict cascade analysis becomes a frequent operation
- Run lineage / ancestry queries become important

#### What Changes (Most Likely Path)

- Add recursive CTE queries to the plugin's query layer
- No new infrastructure
- Possibly: in-memory graph representation built from SQLite for fast traversal

#### What Changes (Less Likely Path — Only if SQLite recursive CTEs prove insufficient)

- Add a dedicated graph database (Neo4j, Memgraph, KuzuDB)
- Graph DB is **secondary**, synced from SQLite
- SQLite remains primary for tabular queries

#### Why SQLite is Probably Enough

For a personal decision engine with O(hundreds) of goals and O(thousands) of runs, recursive CTEs in SQLite handle graph queries in milliseconds. Dedicated graph databases pay off at millions of nodes, not thousands.

Recommended evaluation: **Try SQLite recursive CTEs first. Only add a graph DB if a specific query type proves unworkably slow.**

#### Reversibility

- SQLite recursive CTEs: fully reversible (just stop using them)
- Adding a graph DB: reversible but more work to undo (cleanup of sync logic)

---

### Phase 4: Distributed / Multi-Device / Multi-User

**Joy participates. Mobile access matters. Multiple devices need consistency.**

#### Triggers

- Joy is actively engaging with goals and runs
- Need mobile access (read-only at minimum, ideally write)
- Multiple devices need synchronized state
- Audit trail of "who changed what when" becomes important

#### Options to Evaluate at That Time

1. **Git-based sync**: Keep filesystem as source of truth, sync via private git repo. Simple, free, but conflicts are merge-conflicts.

2. **CRDT layer**: Conflict-free replicated data types. Eventually-consistent, no conflicts. More complex to implement; Yjs or Automerge are options.

3. **Cloud sync (Dropbox/iCloud/Syncthing)**: Filesystem sync. Easy. Conflict resolution is folder-level, not record-level.

4. **Server-based**: SQLite migrates to Postgres or similar. Real server. Real ops burden. Only justified if Phase 1-3 limitations bite hard.

#### Reversibility

Varies by approach. Git-based sync is most reversible; server-based is the least.

#### Estimated Migration Effort

Wildly variable. 10 hours (git-based) to 200+ hours (server-based).

---

## Decision Framework: How to Know When to Advance

### Quantitative Triggers (Watch These Numbers)

Maintain a small dashboard (could be a `~/.decision-engine/.metrics.log` file) tracking:

| Metric | Watch For | Phase Trigger |
|---|---|---|
| Goal count | >50 | Phase 1 |
| Workflow run count | >500 | Phase 1 |
| Median query time (eval against all goals) | >2 sec | Phase 1 |
| Body size totals | >50MB | Phase 1 |
| Concurrent write conflicts | >0 monthly | Phase 2 |
| Recursive query requests | >5 weekly | Phase 3 |
| Active users | >1 | Phase 4 |
| Devices used | >1 actively | Phase 4 |

### Qualitative Triggers (Watch These Patterns)

- **"I can't query this fast enough to use it in flow"** → Phase 1
- **"The filesystem and my mental model are out of sync"** → Phase 2
- **"I need to reason about cascading effects across goals"** → Phase 3
- **"Joy wants to participate, but our tools don't share state"** → Phase 4

### When NOT to Advance

- "It would be cool to have a graph database" — wrong reason
- "The current setup feels primitive" — primitive is fine if it works
- "What if we need it later?" — let later decide later

---

## Database Selection Criteria (When We Get There)

Decision rubric for picking the next data store when filesystem-only isn't enough:

### Required Capabilities

- **Embeddable** (no separate server process) — preserves "personal plugin" character
- **ACID** (transactional integrity) — multi-record updates must be safe
- **Schema evolution** (can change schema without nuking data) — long-lived data demands this
- **Open source / open format** — no vendor lock-in
- **Active maintenance** — track record of >10 years

### Strongly Preferred

- **JSON support** (semi-structured data without schema rigidity)
- **Full-text search** (body content search)
- **Recursive queries** (graph traversal without separate DB)
- **Single-file storage** (backup, portability)

### Candidates Ranked

| Database | Embedded | ACID | Schema Evol | JSON | FTS | Graph | Notes |
|---|---|---|---|---|---|---|---|
| **SQLite** | ✅ | ✅ | ✅ | ✅ (JSON1) | ✅ (FTS5) | ✅ (CTE) | **Recommended.** Covers all needs through Phase 3. |
| Postgres (embedded) | ⚠️ | ✅ | ✅ | ✅ (JSONB) | ✅ | ⚠️ (CTE) | Overkill at Phase 1. Worth considering at Phase 4. |
| DuckDB | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | Better for analytical workloads than this use case. |
| KuzuDB | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | Graph-first. Only if SQLite CTEs prove too slow. |
| Neo4j | ❌ | ✅ | ✅ | ⚠️ | ✅ | ✅ | Server-based; too much ops for personal plugin. |
| MongoDB | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | ❌ | Schema-less can become schema-everywhere. Avoid. |

### Recommended Path

**SQLite is almost certainly the destination database**, not a stepping stone. It can serve Phases 1, 2, and 3 of this plan. Only Phase 4 (distributed multi-user) might require considering alternatives, and even then, SQLite + a sync layer (Litestream, rqlite, dqlite) may be the right answer.

Plan for SQLite. Build skills for SQLite. Don't waste effort generalizing across databases until a real requirement forces it.

---

## Anti-Patterns to Avoid

### "We might need a graph DB someday"

You won't. Or if you do, SQLite recursive CTEs will probably serve you for years. Until a specific query type is unworkably slow, don't introduce a graph DB.

### "Let's make this configurable across databases"

Database abstraction layers are where projects go to die. Pick one. Commit. Switch only when forced.

### "We need a real server because this feels real now"

Personal plugins should remain embeddable. The day this needs a server is the day Joy is using it from her phone and a sync layer becomes essential — not before.

### "Let's design the schema for the future, not just now"

You don't know the future. Design for the next 12 months. Migrate when reality demands it.

### "The markdown source of truth feels limiting"

It's not limiting; it's *anchoring*. Every time you're tempted to move away from human-editable source files, ask: what specific operation does that prevent that I actually need right now?

### "Let's add a UI"

A UI is appropriate when CLI/markdown editing becomes the bottleneck. For Phases 0-2, a good CLI + filesystem editing is sufficient. UI is a Phase 3+ consideration.

---

## What This Document Doesn't Cover

These are deliberately out of scope (for now):

- **Plugin runtime architecture** (how skills/workflows are invoked, sandboxed, etc.)
- **LLM integration patterns** (prompts, context, streaming)
- **Authentication/authorization** (single-user assumption until Phase 4)
- **Performance budgets** (define when measured, not before)
- **Testing strategy** (defer until plugin is real code)
- **Distribution model** (open source? private? config?)

Add sections when these become real considerations.

---

## Change Log

| Date | Version | Change |
|---|---|---|
| 2026-05-14 | 0.1 | Initial draft. Establishes Phase 0 (filesystem markdown) and Phases 1-4 evolution path. Recommends SQLite as primary destination database. |

---

*This plan is the soul of the project's flexibility. Revise it when reality teaches you something new — and when you do, update the change log so future-you understands the reasoning.*
