---
name: memory
description: Orchestrator and runbook for the RAG memory system — a two-layer knowledge store (System Knowledge + Issue Memory) for investigation work. Use this skill for ANY interaction with the RAG memory system, including starting or resuming investigations, managing cards, logging findings, promoting benchmarks, assembling context, or asking how the system works. This skill routes to the correct sub-skill (rag:init, rag:card, rag:trace, rag:promote, rag:context) based on where the user is in their workflow. Triggers include any mention of "rag", "investigation card", "trace log", "benchmark moment", "system knowledge", "promote finding", "build context", "start investigation", "what do we know about", or any reference to the RAG memory directory structure.
---

# RAG Memory — Orchestrator

This is the master skill for the RAG memory system. It routes requests to the correct sub-skill and guides the user through multi-step workflows. Before acting, read `references/structure.md` in this skill's directory — it is the canonical spec for the entire system.

## Sub-skills

These five sibling skills (also under the `rag` plugin) handle individual operations. Each has its own SKILL.md with detailed instructions. When routing to one, read its SKILL.md and follow its workflow.

| Skill | Slash | Purpose | When to route |
|---|---|---|---|
| `init` | `/rag:init` | Scaffold the `rag-memory/` directory from scratch | User wants to set up the system for the first time |
| `card` | `/rag:card` | Create a new `CARD-XXXXX/` for an issue | User is starting work on a ticket, bug, or issue |
| `trace` | `/rag:trace` | Append an entry to a card's `trace.md` | User wants to log a finding, rule-out, hypothesis, or next step |
| `promote` | `/rag:promote` | Promote a finding to `system/` | User has a confirmed durable finding to preserve |
| `context` | `/rag:context` | Assemble a context payload for an AI session | User is starting a new analysis session and needs to load existing knowledge |

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
│  ──► Check benchmarks.md for any pending entries         │
│  ──► Prompt user to promote or reject each one           │
│  ──► Move card from issues/active/ to issues/closed/     │
│  ──► Remind user to commit system/ if anything promoted  │
└─────────────────────────────────────────────────────────┘
```

## Routing logic

When the user sends a message, determine which sub-skill to invoke:

1. **Check if rag-memory/ exists.** If the user references RAG but no directory is found, route to `/rag:init` first. Ask where they want it created.

2. **Match intent to sub-skill.** Use these patterns:

   - **Setup language** ("initialize", "scaffold", "set up", "create the rag structure") → `/rag:init`
   - **Ticket/issue language** ("starting work on", "new card for", "ADO #", "bug", "investigating") → `/rag:card`. But first check if a card already exists for that ID — if so, skip creation and offer `/rag:trace` or `/rag:context` instead.
   - **Logging language** ("found that", "ruled out", "confirmed", "disproved", "suspect", "next step is", "log this") → `/rag:trace`
   - **Promotion language** ("benchmark moment", "promote", "this is durable", "add to system knowledge", "belongs in known-behaviors/services/schemas") → `/rag:promote`
   - **Context/session language** ("build context", "assemble context", "what do we know about", "starting a new session", "load the card", "get me up to speed") → `/rag:context`
   - **Closing language** ("resolved", "closing this card", "done with this issue", "wrap up") → Card closing workflow (see below)
   - **General questions** ("how does RAG work", "what's a benchmark moment", "explain the system") → Answer from `references/structure.md` directly

3. **Chain when needed.** Some user intents require multiple skills in sequence:
   - "I'm starting on ADO #12345" → `/rag:card` then offer `/rag:context`
   - "We confirmed the root cause, promote it and log it" → `/rag:trace` first (log the finding), then `/rag:promote` (promote it)
   - "Wrapping up this card" → review `benchmarks.md`, run `/rag:promote` for any pending entries, then move the card

## Card closing workflow

This isn't a separate sub-skill because it's a short orchestration sequence:

1. Read `issues/active/CARD-XXXXX/benchmarks.md`
2. Check for any entries with `status: pending`
3. For each pending entry, ask the user: promote or reject?
4. Run `/rag:promote` for each promotion, or update status to `rejected`
5. Move the entire `CARD-XXXXX/` directory from `issues/active/` to `issues/closed/`
6. If anything was promoted, remind the user to commit `system/` to Git

## Handling ambiguity

If the user's intent doesn't clearly map to one sub-skill:
- If they mention a card ID, check whether it exists. If it does, they're probably mid-investigation → offer `/rag:trace` or `/rag:context`. If it doesn't, they probably want `/rag:card`.
- If they're describing a finding without specifying a card, ask which card it belongs to.
- If they say "what do we know about X", check if X matches a card ID or a topic in `system/`. Route to `/rag:context` if a card exists, or search `system/` files directly if not.

## Quick reference for the user

If the user asks "what can I do with RAG" or "how do I use this", give them this:

- **First time?** → `/rag:init`
- **New issue?** → `/rag:card` (then provide ticket ID)
- **During investigation** → `/rag:trace` for findings, rule-outs, hypotheses, next steps
- **Durable insight?** → `/rag:promote`
- **New AI session?** → `/rag:context`
- **Done?** → "close card [card ID]" (orchestrator handles the wrap-up sequence)

## Note on actual retrieval

This plugin currently performs **assembly**, not retrieval — `/rag:context` loads files by explicit card ID and folder selection. The "RAG" name reflects the eventual destination, not the current mechanism.

A semantic-retrieval layer (embeddings + vector store) is planned for activation once the corpus crosses ~50 findings/closed cards, at which point browsing-by-filename stops scaling. The plan lives in `features/slot-in-rag.md` at the plugin root. Empty `bin/` and `.mcp.json` placeholders are already reserved for the indexer and search MCP server.

If the user asks about semantic search, similarity-based lookup, or "find me prior cases like this," tell them retrieval isn't wired up yet and point them at `features/slot-in-rag.md` for the activation plan.
