---
name: compare
description: Turn several properties' documents into a color-coded cross-home disclosure comparison sheet (disclosure-comparison.html) plus a combined printable booklet (inspection-checklist.html). It evaluates each home first, so you also get every per-home checklist-<slug>.html. Use when the user says "compare these homes/properties", "homewise compare", "which house is the better buy", "side-by-side disclosure comparison", "build a comparison sheet", or drops paperwork for multiple homes. For a single property, use /homewise:evaluate instead.
---

# homewise: compare (multiple properties)

Weigh several homes against each other. This skill **evaluates each property first** (the same rubric
as `/homewise:evaluate`, emitting each `checklist-<slug>.html`), then synthesizes a cross-home
comparison sheet and a combined booklet. Running compare gives you the whole document set.

## Before you start

- Read the shared rubric: `${CLAUDE_PLUGIN_ROOT}/references/evaluation-rubric.md` - all of it,
  including section 8 (comparison specifics). It is the source of truth for judgment and conventions.
- `pdftotext` (poppler) for MLS PDFs; disclosures are read directly (vision). The `homewise` helper is
  on PATH (`homewise inventory|extract|html2pdf`).

## Workflow

1. **Get the documents (flexible intake).** No required layout or naming. If the user hasn't provided
   files, ask them to drop in the documents for each home - a folder, a loose pile, or one home at a
   time. Run `homewise inventory <path...>` on whatever they give.

2. **Classify and group by home** (rubric section 1). Use the snippets (and the Read tool for empty/
   scanned PDFs) to identify each document's type and the **address** it belongs to, then group into
   homes regardless of folder structure. Confirm the grouping with the user if it's ambiguous. Fix a
   consistent home order now - it must match across the matrix columns, flag cards, and booklet.

3. **Evaluate each home** (rubric sections 2-7). For every home: read its MLS (`homewise extract`) and
   its disclosure (vision), build the per-home model, derive priority items, the standard pass, and the
   narrative. Assign each home its accent by position (section 9: blue, green, brown, then cycle).
   **Never invent missing values** (section 0). Render each home's `checklist-<slug>.html` from
   `${CLAUDE_PLUGIN_ROOT}/templates/checklist.html`.

4. **Build the comparison sheet** (section 8). Read `${CLAUDE_PLUGIN_ROOT}/templates/comparison.html`,
   copy it verbatim, and fill: one matrix column per home (grouped rows - Price & value, The house,
   Systems, Disclosure - each cell a status + value per section 4), and one flag card per home (4-7
   status-dotted follow-ups). Drop rows where no home has data. Write `disclosure-comparison.html`.

5. **Build the combined booklet.** Read `${CLAUDE_PLUGIN_ROOT}/templates/booklet.html`, copy it
   verbatim, add one `<section class="home">` per home (same priority + standard content as that home's
   standalone checklist) and one `ctx-home` recap per home. Write `inspection-checklist.html`.

6. **Report, then offer PDF.** List every HTML file written (per-home checklists + comparison +
   booklet) and where. Note they open in any browser and the checklists autosave locally. Then
   **offer** PDFs via `homewise html2pdf <file>` - the slow, opt-in step. Don't generate PDFs unless asked.

## Output (written to the user's output dir, else the cwd)

- `checklist-<slug>.html` - one per home (from the evaluate step)
- `disclosure-comparison.html` - the cross-home matrix + flag cards
- `inspection-checklist.html` - the combined printable booklet

## Guardrails

- Evidence over invention (rubric section 0). Public-record data (AVM, assessor beds, tax, assessment
  history, flood zone) is usually not in the bundle - use it only if provided or you checked with the
  user; otherwise mark `Not provided`. Surface MLS-vs-disclosure conflicts as findings.
- Status colors are relative across the set (section 4) - don't over-use `crit`; reserve it for
  genuine disclosed defects or must-resolve items.
- Keep home order and accents consistent across all three documents.
- Keep the buyer's-aid disclaimer footers. No literal em dashes; use a spaced hyphen " - ".
