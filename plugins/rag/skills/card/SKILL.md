---
name: card
description: Create a new active issue card in the RAG memory system for a specific ADO card, QA bug, or production issue. Use this skill whenever the user says "new rag card", "start a card for ADO XXXXX", "create issue card", "I'm starting work on [ticket/bug/issue]", or any mention of beginning investigation on a specific issue ID. Also triggers for "open a card", "begin investigation on", or referencing the RAG card system with a ticket number.
---

# RAG Card

Create a new issue card under `issues/active/` (or `issues/backlog/`) in the RAG memory system. Each
card is a self-contained investigation folder with structured files for context, trace logging, and
benchmark tracking.

## Prerequisites

The `rag-memory/` directory must already exist (created by `/rag:init`). If it doesn't exist, tell the
user to run `/rag:init` first.

## Workflow (one command)

Card creation is a single call to the bundled scaffolding script — `bin/rag-new-card`, which is on
PATH when the plugin is loaded. It stamps the card directory and substitutes template tokens, so you
don't read templates and place files by hand.

1. **Gather card details:**
   - **Card ID** — e.g. ADO #40576, JIRA-1234. A `CARD-` prefix is added automatically if absent.
   - **Source** — ado / qa / prod / other
   - **Symptom** — a one-line description (required for active cards)

2. **Run the scaffolder:**
   ```bash
   rag-new-card --id "<ID>" --source <ado|qa|prod|other> --symptom "<one-liner>"
   ```
   - Add `--backlog` to park a planned, not-yet-active card in `issues/backlog/` (creates
     `context.md` only; symptom optional).
   - Add `--root <path>` if the corpus isn't auto-detected from the working directory.
   - The script **refuses to overwrite** an existing card and exits non-zero.

   For an active card it writes:
   ```
   issues/active/CARD-XXXXX/
   ├── context.md      (tokens filled in)
   ├── trace.md        (local — gitignored, never committed)
   ├── benchmarks.md
   └── artifacts/.gitkeep
   ```

3. **Fill out `context.md`.** The script stamps the scaffold; you complete the framing — repos,
   schema tables, related issues. Then use `/rag:trace` to log findings and `/rag:promote` for the
   durable ones.

## Token reference

The script substitutes these tokens in the templates under `skills/card/templates/`:
- `{{CARD_ID}}` → normalized card name (with `CARD-` prefix)
- `{{DATE}}` → today (YYYY-MM-DD), or `--date`
- `{{SOURCE}}` → the source
- `{{SYMPTOM}}` → the one-line symptom

## Manual fallback

If `rag-new-card` is unavailable (e.g. `bin/` not on PATH in this environment), create the card by
hand: make `issues/active/CARD-XXXXX/`, copy the three templates from `skills/card/templates/`,
substitute the tokens above, and add `artifacts/.gitkeep`. Never overwrite an existing card directory.

## Key details

- Card IDs are normalized: `#` stripped, spaces → hyphens, `CARD-` prefix ensured.
- `trace.md` is created but is **local working state** — the corpus `.gitignore` keeps it out of commits.
- Backlog cards carry `context.md` only until activated (move the folder to `issues/active/`).
