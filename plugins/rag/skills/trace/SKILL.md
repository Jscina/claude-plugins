---
name: trace
description: Append a structured, timestamped entry to an active RAG card's trace.md investigation log. Use this skill whenever the user wants to log a finding, append to the trace, record a ruled-out hypothesis, add to the investigation log, update the trace for a specific card, or log that something was confirmed, disproved, or suspected. Triggers include "log finding", "append to trace", "ruled out X", "add to investigation log", "update my trace for CARD-XXXXX", "log that we confirmed/disproved/suspect X", or any request to record investigation progress.
---

# RAG Trace

Append a structured entry to an active card's `trace.md`. This skill is the primary way to record investigation progress — findings, rule-outs, hypotheses, and next steps.

## Critical constraint

This is **append-only**. The skill must never overwrite, truncate, or reorder existing `trace.md` content. Every operation is a file append.

## Workflow

1. **Determine the card.** Ask for or infer the card ID from context. Look for the card directory at `rag-memory/issues/active/CARD-XXXXX/`. If it doesn't exist, warn the user.

2. **Gather the entry details.** Ask for or infer from the conversation:
   - **Entry type** — one of: `finding`, `ruled-out`, `hypothesis`, `next-step`
   - **Entry body** — the content to log (can be multiple lines)
   - **Session label** — `claude`, `gemini`, `manual`, or another label (default to `claude` if running in Claude)

3. **Format the entry block:**
   ```
   ---
   date: YYYY-MM-DD HH:MM
   session: [session label]
   type: [entry type]
   ---
   [Entry body text]
   ```

4. **Append to trace.md.** Read the current file to get a line count, then append the new block with a blank line separator. Report the line count before and after as confirmation.

## Entry type guidance

Help the user pick the right type if they're unsure:
- **finding** — Something confirmed through analysis (e.g., "The truncation occurs because of a hard-coded constant in line 342")
- **ruled-out** — A hypothesis that was investigated and disproven (e.g., "Ruled out buffer overflow — the buffer is dynamically allocated")
- **hypothesis** — A theory that hasn't been confirmed yet (e.g., "Suspect the real-time protocol service drops frames above 4096 bytes")
- **next-step** — What to do next (e.g., "Need to check the Comtrol6k frame size constant against the E3 log buffer")

## Key details

- Use the current timestamp (date + time to the minute) for the `date` field
- If the user provides multiple findings in one message, create separate entries for each
- Preserve all existing content in trace.md — read, then append
