---
name: compare
description: Turn several properties' documents into a color-coded cross-home disclosure comparison sheet (disclosure-comparison.html) plus a combined printable booklet (inspection-checklist.html). It evaluates each home first, so you also get every per-home checklist-<slug>.html. Use when the user says "compare these homes/properties", "homewise compare", "which house is the better buy", "side-by-side disclosure comparison", "build a comparison sheet", or provides paperwork for multiple homes. For a single property, use evaluate instead.
---

# homewise: compare (multiple properties)

Weigh several homes against each other. This skill **evaluates each property first** (the same rubric
as `evaluate`, emitting each `checklist-<slug>.html`), then synthesizes a cross-home comparison sheet
and a combined booklet. Running compare gives you the whole document set.

Portable baseline: read the provided PDFs directly and emit HTML - no external tools required.

## Before you start

Read the shared rubric: `${CLAUDE_PLUGIN_ROOT}/references/evaluation-rubric.md` - all of it, including
section 8 (comparison specifics). It is the source of truth for judgment and conventions.

## Workflow

1. **Get the documents.** No required layout or naming. If none were provided, ask the user to share
   the documents for each home (a folder, a loose pile, or one home at a time).

2. **Classify and group by home** (rubric section 1) by reading each document's content and the property
   address - regardless of folder structure. Confirm the grouping if ambiguous. Fix a consistent home
   order now; it must match across the matrix columns, flag cards, and booklet.

3. **Evaluate each home** (rubric sections 2-7). Read its MLS and disclosure directly (optional
   `pdftotext` on a text MLS where available), build the per-home model, derive priority items, the
   standard pass, and the narrative. Assign each home its accent by position (section 9: blue, green,
   brown, then cycle). **Never invent missing values** (section 0). Render each home's
   `checklist-<slug>.html` from `${CLAUDE_PLUGIN_ROOT}/templates/checklist.html`.

4. **Build the comparison sheet** (section 8). Read `${CLAUDE_PLUGIN_ROOT}/templates/comparison.html`,
   copy it verbatim, fill one matrix column per home (grouped rows, status-classed cells) and one flag
   card per home. Drop rows where no home has data. Write `disclosure-comparison.html`.

5. **Build the combined booklet.** Read `${CLAUDE_PLUGIN_ROOT}/templates/booklet.html`, copy it
   verbatim, add one `<section class="home">` per home (same priority + standard content as that home's
   checklist) and one `ctx-home` recap per home. Write `inspection-checklist.html`.

6. **Deliver, then offer PDF.** List every HTML file written (per-home checklists + comparison +
   booklet); note they open in any browser and the checklists autosave locally. Then **offer** PDFs:
   where a renderer exists, run `${CLAUDE_PLUGIN_ROOT}/scripts/html2pdf.py <file>` per file; otherwise
   tell the user to Print > Save as PDF from the browser. Never auto-generate PDFs.

## Output

- `checklist-<slug>.html` - one per home (from the evaluate step)
- `disclosure-comparison.html` - the cross-home matrix + flag cards
- `inspection-checklist.html` - the combined printable booklet

## Guardrails

- Evidence over invention (rubric section 0). Public-record data (AVM, assessor beds, tax, assessment
  history, flood zone) is usually in the MLS - use it when present; otherwise mark `Not provided`.
  Surface MLS-vs-disclosure conflicts; attribute findings to their real source.
- Status colors are relative across the set (section 4) - reserve `crit` for genuine disclosed defects
  or must-resolve items. Keep home order + accents consistent across all three documents.
- Keep the buyer's-aid disclaimer footers. No literal em dashes; use a spaced hyphen " - ".
