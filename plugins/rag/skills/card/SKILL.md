---
name: card
description: Create a new active issue card in the RAG memory system for a specific ADO card, QA bug, or production issue. Use this skill whenever the user says "new rag card", "start a card for ADO XXXXX", "create issue card", "I'm starting work on [ticket/bug/issue]", or any mention of beginning investigation on a specific issue ID. Also triggers for "open a card", "begin investigation on", or referencing the RAG card system with a ticket number.
---

# RAG Card

Create a new active issue card under `issues/active/` in the RAG memory system. Each card is a self-contained investigation folder with structured files for context, trace logging, and benchmark tracking.

## Prerequisites

The `rag-memory/` directory must already exist (created by `/rag:init`). If it doesn't exist, tell the user to run `/rag:init` first.

## Workflow

1. **Gather card details.** Ask the user for:
   - **Card ID** — e.g., ADO #40576, JIRA-1234, or any identifier. This becomes the folder name as `CARD-XXXXX`.
   - **Issue source** — ADO / QA / prod / other
   - **Symptom** — A one-line description of the problem

2. **Locate the rag-memory root.** Check for `rag-memory/` in the current directory or ask the user for the path.

3. **Create the card directory and files.** Read templates from this skill's `templates/` folder, substitute placeholder tokens, and write:
   ```
   issues/active/CARD-XXXXX/
   ├── context.md      ← from templates/context.md
   ├── trace.md        ← from templates/trace.md
   ├── benchmarks.md   ← from templates/benchmarks.md
   └── artifacts/      ← empty directory with .gitkeep
   ```

4. **Substitute tokens** in templates:
   - `{{CARD_ID}}` → the card ID (e.g., `ADO-40576`)
   - `{{DATE}}` → today's date in YYYY-MM-DD format
   - `{{SOURCE}}` → the issue source
   - `{{SYMPTOM}}` → the one-line symptom description

5. **Confirm creation.** Print the card path and remind the user to:
   - Fill out the remaining sections of `context.md` (repos, schema tables, related issues)
   - Use `/rag:trace` to log findings during investigation
   - Use `/rag:promote` when a durable finding is confirmed

## Key details

- Never overwrite an existing card directory — check first and warn
- The `artifacts/` directory starts empty but should contain a `.gitkeep`
- Card IDs should be normalized: strip `#` symbols, replace spaces with hyphens
