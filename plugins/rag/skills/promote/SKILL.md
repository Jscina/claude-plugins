---
name: promote
description: Promote a confirmed finding from an active RAG issue card to the system knowledge layer. Use this skill when the user says "promote this finding", "this is a benchmark moment", "add to system knowledge", "promote to system rag", "this belongs in known-behaviors", or makes any statement that a confirmed finding reveals something durable about the system's behavior, schema design, or service interactions. Also triggers for "move to system", "this is reusable knowledge", or "promote benchmark".
---

# RAG Promote

Take a confirmed finding from an active issue card and promote it to the appropriate `system/` file in the RAG memory system. This is the bridge between issue-specific investigation and long-term system knowledge.

## Prerequisites

- The finding must be **confirmed**, not just hypothesized
- The finding must apply **beyond this specific card** — it teaches something about how the system works in general
- An active card must exist with the finding logged in `trace.md`

## Trace sweep — surface missed benchmarks first

Before promoting (and always during a card's close ceremony), **sweep the trace** so good findings
don't get stranded. A finding only becomes a promotion candidate if it was tagged into
`benchmarks.md`; benchmark-worthy findings logged only in `trace.md` would otherwise be missed entirely.

1. Read the card's `trace.md`.
2. Scan for `type: finding` entries (and confirmed results in other entry types) that reveal something
   **durable** about the system — behavior, schema, or service interaction — i.e. they pass the
   "applies beyond this card" test.
3. Cross-check each against `benchmarks.md`: if its substance isn't already represented there, propose
   it as a new candidate with a recommended `system/` target.
4. Present the candidates; for each, the user chooses promote (run the workflow below) or reject
   (record as `BENCHMARK — rejected`).

This sweep is **read-only on `trace.md`** — never modify the trace. It only adds candidate entries to
`benchmarks.md` and promotes the approved ones.

## Workflow

1. **Identify the finding.** Ask for or infer:
   - **Card ID** — which active card this comes from
   - **Finding text** — the durable insight to promote
   - **Short title** — a concise name for the finding (used as a heading in the target file)
   - **Impact statement** — what this affects going forward

2. **Determine the target.** Ask or infer which `system/` subfolder is appropriate:
   - `architecture/` — repo structure, integration topology, deployment patterns
   - `schemas/` — DDL quirks, table relationships, schema-level gotchas
   - `services/` — service behavior, config edge cases, controller-specific quirks
   - `known-behaviors/` — general system behaviors, cross-cutting concerns (this is the most common target)

   Also determine the **target filename** (e.g., `e3-log-truncation.md`). If the file already exists, the finding will be appended as a new section.

3. **Write to the system file.** Every `system/` knowledge doc carries a YAML **frontmatter** header
   (file-level, machine-parseable metadata — consumable by the retrieval indexer and Obsidian
   properties) followed by the body. The per-section `**Source**` line **stays**: the header aggregates
   provenance at the file level, the `**Source**` line attributes each individual finding.

   **Creating a new file** — write the frontmatter, the H1, then the first section:

   ```markdown
   ---
   title: [Human title — mirrors the H1 below]
   domain: [known-behaviors | services | schemas | architecture — match the subfolder]
   source_cards: [CARD-XXXXX]
   created: YYYY-MM-DD
   updated: YYYY-MM-DD
   status: active
   tags: []
   ---

   # [Title]

   ## [Short title]
   **Source**: CARD-XXXXX | YYYY-MM-DD
   **Finding**: [Body of the finding]
   **Impact**: [What this affects going forward]
   ```

   **Appending to an existing file** — add the new `## [Short title]` section (with its own
   `**Source**` line) at the end, then **update the header**: add this card to `source_cards` if it
   isn't already listed, and set `updated:` to today. Leave existing sections untouched.

   **Frontmatter fields** — `title` (mirrors the H1; double-quote it if it contains a colon or
   backtick), `domain` (the containing `system/` subfolder), `source_cards` (the union of every card
   that contributed a section), `created`/`updated` (earliest / latest contribution dates), `status`
   (`active` or `superseded`), `tags` (free-form; a corpus may use these for its own finer-grained
   taxonomy).

4. **Update the card's benchmarks.md.** Append or update an entry:

   ```
   ---
   date: YYYY-MM-DD
   session: claude / gemini / manual
   finding: [Short description]
   target: system/<subfolder>/<filename>.md
   status: promoted
   ---
   ```

5. **Confirm and remind.** Tell the user:
   - What was written and where
   - Remind them to commit `system/` to Git
   - Remind them that `trace.md` was intentionally not modified (promotion is tracked in `benchmarks.md` only)

## Key constraints

- **Never modify trace.md** during promotion — promotion tracking lives in `benchmarks.md` only
- If the target system file already exists, append the new finding as a new section — never overwrite existing content
- Always include the source card ID in the promoted finding for traceability
