---
name: trace
description: Append a structured, timestamped entry to an active RAG card's trace.md investigation log. Use this skill whenever the user wants to log a finding, append to the trace, record a ruled-out hypothesis, add to the investigation log, update the trace for a specific card, or log that something was confirmed, disproved, or suspected. Triggers include "log finding", "append to trace", "ruled out X", "add to investigation log", "update my trace for CARD-XXXXX", "log that we confirmed/disproved/suspect X", or any request to record investigation progress.
---

# RAG Trace

Append a structured entry to an active card's `trace.md`. This skill is the primary way to record investigation progress — findings, rule-outs, hypotheses, and next steps.

## Critical constraint

This is **append-only**. The skill must never overwrite, truncate, or reorder existing `trace.md` content. Every operation is a file append.

`trace.md` is **local working state and is never committed** — the generated `rag-memory/.gitignore`
ignores `**/trace.md` everywhere, including inside the committed `issues/archive/`. The durable,
committed value of a card is `context.md` + `benchmarks.md` + `artifacts/`. Log freely; the trace
stays on your machine.

## Workflow

1. **Determine the card.** Ask for or infer the card ID from context. Look for the card directory at `rag-memory/issues/active/CARD-XXXXX/`. If it doesn't exist, warn the user.

2. **Gather the entry details.** Ask for or infer from the conversation:
   - **Entry type** — one of: `finding`, `ruled-out`, `hypothesis`, `next-step`
   - **Entry body** — the content to log (can be multiple lines)
   - **Session label** — `claude`, `gemini`, `manual`, or another label (default to `claude` if running in Claude)

3. **Append the entry with `rag-trace`** — the bundled helper (`bin/rag-trace`, on PATH when the
   plugin loads). It stamps the timestamp, formats the block, and appends in append mode, so the
   format can't drift, append-only is guaranteed by the tool, and **nothing re-reads the growing
   trace into your context** — the line counts are computed inside the script (zero model-context
   tokens), eliminating the input re-read tax rather than working around it. Pass a one-line body
   inline, or pipe a multi-line body on stdin:

   ```bash
   rag-trace --card CARD-XXXXX --type finding --body "Truncation is a 4096 const at export.c:342"

   # multi-line body via stdin:
   rag-trace --card CARD-XXXXX --type hypothesis <<'EOF'
   [entry body — can span many lines]
   EOF
   ```

   - Types: `finding | ruled-out | hypothesis | next-step`.
   - Session defaults to `claude` (`--session gemini|manual` to override); `--root` if the corpus
     isn't auto-detected.
   - It bootstraps `trace.md`'s header if the card was just activated from backlog, and **refuses
     non-active cards** (traces are for active cards) with a message pointing at the fix.

   **Fallback — only if `rag-trace` isn't on PATH:** append the block by hand, but still **never read
   the file in first** (that re-read is the tax). Append with a blank-line separator:

   ```
   ---
   date: YYYY-MM-DD HH:MM
   session: [label]
   type: [finding|ruled-out|hypothesis|next-step]
   ---
   [body]
   ```

## Writing economical entries

An entry earns its tokens by what a **cold future session can recover from it**, not by prose. Write
with **asymmetric economy**:

- **Cut hard** — framing sentences, restated context, narrative connective tissue, hedging.
  Fragments are fine. If deleting a phrase would not change what a later session *does*, delete it.
- **Keep verbatim** — the evidence: file paths, line numbers, exact identifiers/constants, commands
  run, and error text. Never paraphrase, summarize, or truncate these; they are the load-bearing
  tokens that make the trace worth re-reading.
- One claim per entry (split multiple findings — see Key details).

This is the community **caveman** skill's one durable rule — be terse, but never touch code,
commands, or errors — scoped to the trace. caveman itself is a *global* output-style tool; this
convention applies the same discipline locally, so no dependency is required.

## Entry type guidance

Help the user pick the right type if they're unsure:
- **finding** — Something confirmed through analysis (e.g., "The truncation occurs because of a hard-coded constant in line 342")
- **ruled-out** — A hypothesis that was investigated and disproven (e.g., "Ruled out buffer overflow — the buffer is dynamically allocated")
- **hypothesis** — A theory that hasn't been confirmed yet (e.g., "Suspect the real-time protocol service drops frames above 4096 bytes")
- **next-step** — What to do next (e.g., "Need to check the Comtrol6k frame size constant against the E3 log buffer")

## Key details

- Use the current timestamp (date + time to the minute) for the `date` field
- If the user provides multiple findings in one message, create separate entries for each
- Append-only: never overwrite or reorder. Use `rag-trace` (or the step-3 fallback append) rather
  than reading the file in first — appending is what guarantees existing content is untouched
- One entry per finding: call `rag-trace` once per entry (loop for multiple findings)
