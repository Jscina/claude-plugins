# Skill Opportunities — a planning convention

`features/` is the plugin's own planning space (Claude Code ignores it). This file defines how we turn
investigation traces into concrete tooling improvements: custom skills to build, or known-effective
skills to adopt.

## Why traces

A card's `trace.md` is the append-only, ground-truth record of what an investigation actually did —
including the dead-ends, the repeated manual steps, and the friction that never makes it into a tidy
summary. That makes it the single best signal for *where tooling would help*. Reviewing a trace is
therefore not only an investigation read-through; it is a **skill-discovery pass**.

## When to run the pass

- During `/rag:context` assembly (you are already reading the trace).
- During a card's close ceremony — the same trace read as the benchmark sweep; do them together.
- Ad hoc, when scanning several cards' traces at once for cross-card patterns.

## What to look for

1. **Repeated multi-step manual sequences.** The same ordered set of manual actions recurring across
   entries or cards → collapse it into one command or a skill. (Exactly what motivated
   `bin/rag-new-card`: card creation was a multi-step manual placement repeated for every card.)
2. **A recurring class of mistake or dead-end.** The same wrong turn logged as `ruled-out` again and
   again → a guardrail, a checklist step, or a skill that prevents it.
3. **A workflow that maps cleanly onto a known, effective skill.** Don't rebuild what exists — adopt
   the established skill and note it.

## Capture format

When the pass surfaces a candidate, record it (in the card's `context.md`, a triage note, or a backlog
card) using:

```
### Candidate: <short name>
- **Type:** adopt-existing | build-custom
- **Recurring pattern / pain point:** <what keeps happening, and where it was seen (cards/entries)>
- **Proposed skill or script:** <one line>
- **Evidence:** <trace pointers — card + entry dates>
- **Effort / payoff:** <rough sizing>
```

Candidates that earn a "build" decision become backlog cards (`rag-new-card --backlog`) so they enter
the normal lifecycle.
