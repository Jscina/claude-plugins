---
name: memory
description: Orchestrator and runbook for the RAG memory system — a two-layer knowledge store (System Knowledge + Issue Memory) for investigation work. Use this skill for ANY interaction with the RAG memory system, including starting or resuming investigations, managing cards, logging findings, promoting benchmarks, assembling context, or asking how the system works. This skill routes to the correct sub-skill (rag:init, rag:card, rag:trace, rag:promote, rag:context) based on where the user is in their workflow. Triggers include any mention of "rag", "investigation card", "trace log", "benchmark moment", "system knowledge", "promote finding", "build context", "start investigation", "what do we know about", or any reference to the RAG memory directory structure.
---

# RAG Memory — Orchestrator

This is the master skill for the RAG memory system. It routes requests to the correct sub-skill and guides the user through multi-step workflows. Before acting, read `references/structure.md` in this skill's directory — it is the canonical spec for the entire system.

## Sub-skills

These sibling skills (also under the `rag` plugin) handle individual operations. Each has its own SKILL.md with detailed instructions. When routing to one, read its SKILL.md and follow its workflow.

| Skill | Slash | Purpose | When to route |
|---|---|---|---|
| `init` | `/rag:init` | Scaffold the `rag-memory/` directory from scratch | User wants to set up the system for the first time |
| `migrate` | `/rag:migrate` | Upgrade an existing corpus to the current schema | A corpus was built by an older plugin version (missing `.gitignore`/`backlog`/`done`, or `trace.md` being committed) |
| `card` | `/rag:card` | Create a new `CARD-XXXXX/` for an issue | User is starting work on a ticket, bug, or issue |
| `trace` | `/rag:trace` | Append an entry to a card's `trace.md` | User wants to log a finding, rule-out, hypothesis, or next step |
| `promote` | `/rag:promote` | Promote a finding to `system/` | User has a confirmed durable finding to preserve |
| `context` | `/rag:context` | Assemble a context payload for an AI session | User is starting a new analysis session and needs to load existing knowledge |
| `enrich` | `/rag:enrich` | Fill a card header's `title`/`opened` from the body + sharpen it (opt-in, reviewed) | A migrated card has empty header fields, or a card's `context.md` is thin/stale |

## Workflow state machine

Most RAG interactions follow a predictable lifecycle. Use this to figure out where the user is and what they need next.

```
┌─────────────────────────────────────────────────────────┐
│                    FIRST TIME SETUP                      │
│                                                          │
│  "set up rag" / no rag-memory/ directory found           │
│  ──► /rag:init                                           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  STARTING AN INVESTIGATION               │
│                                                          │
│  "starting work on ADO #XXXXX" / "new bug to look at"   │
│  ──► /rag:card (creates the card)                        │
│  ──► remind user to fill context.md                      │
│  ──► optionally ──► /rag:context (if system/ has         │
│      relevant prior knowledge to load)                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  DURING INVESTIGATION                    │
│  (this is a loop — user may cycle here many times)      │
│                                                          │
│  "found that X" / "ruled out Y" / "I think Z"           │
│  ──► /rag:trace (append entry)                           │
│                                                          │
│  "this is a benchmark moment" / "this is reusable"      │
│  ──► /rag:promote (write to system/, update benchmarks)  │
│                                                          │
│  "starting a new session on this card"                   │
│  ──► /rag:context (assemble payload for fresh session)   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   CLOSING A CARD                         │
│                                                          │
│  "this issue is resolved" / "closing this card"          │
│  ──► Sweep trace.md for missed benchmark moments         │
│  ──► Review benchmarks.md → promote or reject            │
│  ──► Ask destination: done/ (local) or archive/ (commit) │
│  ──► Move there; archive commits, done stays local       │
└─────────────────────────────────────────────────────────┘
```

## Routing logic

When the user sends a message, determine which sub-skill to invoke:

1. **Check if rag-memory/ exists.** If the user references RAG but no directory is found, route to `/rag:init` first. Ask where they want it created. **If it exists, check it's current** — run `rag-migrate --check` (or look for `.rag-meta.json` with the current `format_gen` map, plus `issues/backlog/`, `issues/done/`, and `.gitignore`). If it's from an older plugin version, route to `/rag:migrate` before other operations; otherwise the commit boundary won't apply and `trace.md` may be getting committed.

2. **Match intent to sub-skill.** Use these patterns:

   - **Setup language** ("initialize", "scaffold", "set up", "create the rag structure") → `/rag:init`
   - **Ticket/issue language** ("starting work on", "new card for", "ADO #", "bug", "investigating") → `/rag:card`. But first check if a card already exists for that ID — if so, skip creation and offer `/rag:trace` or `/rag:context` instead.
   - **Logging language** ("found that", "ruled out", "confirmed", "disproved", "suspect", "next step is", "log this") → `/rag:trace`
   - **Promotion language** ("benchmark moment", "promote", "this is durable", "add to system knowledge", "belongs in known-behaviors/services/schemas") → `/rag:promote`
   - **Context/session language** ("build context", "assemble context", "what do we know about", "starting a new session", "load the card", "get me up to speed") → `/rag:context`
   - **Planning language** ("not ready to start", "park this for later", "backlog this", "planned but not active") → create a card in `issues/backlog/` (local, `context.md` only). Activate later by moving it to `issues/active/`.
   - **Closing language** ("resolved", "closing this card", "done with this issue", "wrap up") → Card closing workflow (see below)
   - **General questions** ("how does RAG work", "what's a benchmark moment", "explain the system") → Answer from `references/structure.md` directly

3. **Chain when needed.** Some user intents require multiple skills in sequence:
   - "I'm starting on ADO #12345" → `/rag:card` then offer `/rag:context`
   - "We confirmed the root cause, promote it and log it" → `/rag:trace` first (log the finding), then `/rag:promote` (promote it)
   - "Wrapping up this card" → review `benchmarks.md`, run `/rag:promote` for any pending entries, then move the card

## Card closing workflow

This isn't a separate sub-skill because it's a short orchestration sequence:

1. **Sweep the trace for missed benchmarks.** Read `issues/active/CARD-XXXXX/trace.md` and look for
   `type: finding` (or otherwise confirmed) entries that reveal durable system behavior but were
   never tagged in `benchmarks.md`. Propose each as a candidate `pending` benchmark. The sweep only
   **reads** the trace — it never modifies it. (Same trace read as the Skill-discovery pass below;
   do both at once.)
2. Read `issues/active/CARD-XXXXX/benchmarks.md` and collect all `status: pending` entries (including
   any just added by the sweep).
3. For each pending entry, ask the user: promote or reject? Run `/rag:promote` for each promotion, or
   update its status to `rejected`.
4. **Ask the destination:** `done/` (finished locally, **not committed**) or `archive/` (durable,
   **committed** shared record).
5. **Stamp `closed`.** In the card's `context.md`, set `closed: <today's date>` — but only if `closed:`
   is empty (preserve a manually-set or already-known date). If the card has no header at all (a
   pre-stamp corpus), skip and note it rather than fabricate one — run `rag-migrate --apply` first to
   stamp the header. Never touch `trace.md`/`benchmarks.md`. (`opened` is filled by `rag-new-card` or
   `/rag:enrich`, not here.)
6. Move the entire `CARD-XXXXX/` directory from `issues/active/` to the chosen `issues/done/` or
   `issues/archive/`.
7. If **archived**, remind the user to commit the card's `context.md` + `benchmarks.md` + `artifacts/`
   (its `trace.md` is gitignored) plus `system/` if anything was promoted. If **done**, nothing is committed.

## Skill-discovery pass (mining traces)

Trace logs are the richest signal for *tooling* opportunities, not just investigation history.
Whenever you review a trace — during `/rag:context`, a close ceremony, or ad hoc — also watch for:

- **Repeated multi-step manual sequences** → candidate for a script or a new skill.
- **The same class of mistake or dead-end recurring** across entries or cards → candidate guardrail.
- **A workflow that maps cleanly onto a known, effective skill** → adopt it.

Capture each candidate (adopt-existing vs. build-custom) with the recurring pattern it addresses; see
`features/skill-opportunities.md` for the capture format. This pass shares the same trace read as the
benchmark sweep above — do them together.

## Handling ambiguity

If the user's intent doesn't clearly map to one sub-skill:
- If they mention a card ID, check whether it exists. If it does, they're probably mid-investigation → offer `/rag:trace` or `/rag:context`. If it doesn't, they probably want `/rag:card`.
- If they're describing a finding without specifying a card, ask which card it belongs to.
- If they say "what do we know about X", check if X matches a card ID or a topic in `system/`. Route to `/rag:context` if a card exists, or search `system/` files directly if not.

## Quick reference for the user

If the user asks "what can I do with RAG" or "how do I use this", give them this:

- **First time?** → `/rag:init`
- **Upgraded the plugin?** → `/rag:migrate` (gap-fills an older corpus: boundary, `backlog/`+`done/`, docs)
- **Planning ahead?** → "backlog this" (parks a `context.md`-only card in `issues/backlog/`, local)
- **New issue?** → `/rag:card` (then provide ticket ID)
- **During investigation** → `/rag:trace` for findings, rule-outs, hypotheses, next steps
- **Durable insight?** → `/rag:promote`
- **Card header thin or empty?** → `/rag:enrich` (fill `title`/`opened`, sharpen — opt-in, reviewed)
- **New AI session?** → `/rag:context`
- **Done?** → "close card [card ID]" (orchestrator sweeps the trace, reviews benchmarks, then files it under `done/` or `archive/`)

## Note on actual retrieval

This plugin currently performs **assembly**, not retrieval — `/rag:context` loads files by explicit card ID and folder selection. The "RAG" name reflects the eventual destination, not the current mechanism.

A semantic-retrieval layer (embeddings + vector store) is planned for activation once the corpus crosses ~50 findings/archived cards, at which point browsing-by-filename stops scaling. The plan lives in `features/slot-in-rag.md` at the plugin root. The `.mcp.json` placeholder is already reserved for the search MCP server; the indexer will live in `bin/` alongside the existing `rag-new-card`.

If the user asks about semantic search, similarity-based lookup, or "find me prior cases like this," tell them retrieval isn't wired up yet and point them at `features/slot-in-rag.md` for the activation plan.
