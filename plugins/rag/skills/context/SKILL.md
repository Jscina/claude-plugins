---
name: context
description: Assemble a focused context payload from the RAG memory system for priming a new AI analysis session. Use this skill when the user says "build context for CARD-XXXXX", "prepare rag context", "assemble session context", "what do we know about X", "I'm starting a new AI session on [issue]", or any request to prime an AI session with existing knowledge from the RAG system. Also triggers for "gather context", "load card context", "prepare investigation context", or "get me up to speed on CARD-XXXXX".
---

# RAG Context

Assemble a focused context payload by pulling from both the active issue card and the system knowledge layer. The output is a formatted markdown block ready to paste as the opening context of a new AI analysis session.

## Workflow

1. **Determine what to load.** Ask for:
   - **Card ID** — which active card to pull from (or an issue description if no card exists yet)
   - **Relevant system sections** — which `system/` subfolders to include: `architecture`, `schemas`, `services`, `known-behaviors` (default: all that have content)
   - **Token budget** — `compact` or `full` (default: `compact`)

2. **Read the card files.** From `issues/active/CARD-XXXXX/`:
   - `context.md` — full content
   - `trace.md` — full content in `full` mode; last 10 entries only in `compact` mode
   - `benchmarks.md` — full content

3. **Read system files.** For each selected `system/` subfolder, read all `.md` files within it.
   - In `full` mode: include full file contents
   - In `compact` mode: include only the file name and top-level headings (##) as a table of contents

4. **Assemble the context block.** Output a single markdown document with these sections:

   ```markdown
   # RAG Context — CARD-XXXXX
   _Generated: YYYY-MM-DD HH:MM | Mode: compact/full_

   ## Active Card Summary
   [Contents of context.md]

   ## Investigation History
   [Contents of trace.md — condensed in compact mode]

   ## Relevant System Knowledge
   [Pulled from system/ files — TOC-only in compact mode]

   ## Promoted Benchmarks on This Card
   [Contents of benchmarks.md, if any entries exist]

   ## Suggested First Prompt
   Based on the current investigation state, consider starting with:
   > [A recommended opening question derived from the latest trace entries and context]
   ```

5. **Remind the user.** After the session:
   - Run `/rag:trace` to log any new findings
   - Run `/rag:promote` for any benchmark moments discovered

## Compact mode rules

Compact mode is designed to fit within tight token budgets while preserving the most important signal:

- **trace.md**: Include only the last 10 entries (each `---` block counts as one entry). Prepend a note: `_Showing last 10 of N entries. Run in full mode to see all._`
- **system/ files**: For each file, show only the filename and a list of `##`-level headings. Prepend: `_Compact mode — showing headings only. Ask for full content on specific files if needed._`
- **context.md and benchmarks.md**: Always included in full regardless of mode

## Key details

- If the card doesn't exist yet but the user provides an issue description, still assemble system knowledge and suggest creating a card first
- If system/ subfolders are empty, note that in the output rather than silently omitting them
- The "Suggested First Prompt" should be actionable — derive it from the most recent hypothesis or next-step in the trace
