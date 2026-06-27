---
name: evaluate
description: Turn one property's documents (MLS listing + Seller's Disclosure + any ancillary PDFs) into a standalone, printable buyer inspection checklist (checklist-<slug>.html) with disclosure-driven priority items, a standard whole-home pass, and a narrative disclosure-context box. Use when the user says "evaluate this property/home/house", "homewise evaluate", "make an inspection checklist", "buyer checklist from these listing PDFs", "analyze this home's disclosure", or drops the paperwork for a single home. For weighing several homes against each other, use /homewise:compare instead.
---

# homewise: evaluate (single property)

Produce one home's buyer **inspection checklist** as a self-contained HTML file. This is the
single-property building block; `/homewise:compare` runs this rubric on each home and then aggregates.

## Before you start

- Read the shared rubric: `${CLAUDE_PLUGIN_ROOT}/references/evaluation-rubric.md`. It defines intake,
  document reading, the per-home data model, status colors, priority-item selection, the narrative,
  and conventions. **Follow it** - this SKILL.md is just the workflow spine.
- `pdftotext` (poppler) helps read text-based MLS PDFs; scanned disclosures are read directly (vision).
- The `homewise` helper is on PATH (`homewise inventory|extract|html2pdf`).

## Workflow

1. **Get the documents (flexible intake).** There is no required folder layout or naming. If the user
   hasn't pointed you at files, ask them to drop in the documents for the home. Then run
   `homewise inventory <path...>` on whatever they gave (a folder, a pile, individual files).

2. **Classify and confirm one home.** Use the snippets (and the Read tool for empty/scanned ones) to
   identify the MLS, the Seller's Disclosure, and any ancillary docs (rubric section 1). Confirm they
   all belong to a single property; if more than one address appears, tell the user and suggest
   `/homewise:compare`.

3. **Read the sources** (rubric section 2). MLS via `homewise extract <mls.pdf>`. Seller's Disclosure
   by reading the pages directly with the Read tool (these are usually scanned/e-signed - an empty
   `extract` snippet is your cue). Read ancillary docs as useful. **Never invent missing values**
   (rubric section 0) - mark `Unknown` / `Not provided`, or ask.

4. **Build the per-home model** (section 3): identity, pricing/value, the house, systems, disclosure
   facts. Then derive the **priority items** (section 5), the **standard whole-home pass** (section 6),
   and the **disclosure-context paragraph** (section 7).

5. **Render the HTML.** Read `${CLAUDE_PLUGIN_ROOT}/templates/checklist.html`. Copy it verbatim
   (the `<style>` and `<script>` are the design system - don't rewrite them), substitute the `{{TOKENS}}`,
   and replace the marked PRIORITY ITEMS and STANDARD PASS regions, the disclosure-context paragraph,
   and the footer sources with the real content. Slug + accent per section 9 (single home: blue
   `#2f5d7c`). Write to `checklist-<slug>.html` in the user's output dir (else the current directory).

6. **Report, then offer PDF.** Tell the user the HTML path and that it opens in any browser and
   autosaves their checkboxes/notes locally. Then **offer** a PDF: `homewise html2pdf checklist-<slug>.html`.
   Do not generate the PDF unless asked - it is the slow, opt-in step.

## Output

- `checklist-<slug>.html` - one standalone, printable, self-contained file (inline CSS + JS, no assets).

## Guardrails

- Evidence over invention (rubric section 0). Surface MLS-vs-disclosure conflicts; don't paper over them.
- Keep the buyer's-aid disclaimer in the footer. The output organizes a professional inspection; it is
  not an inspection report, appraisal, or advice.
- No literal em dashes; use a spaced hyphen " - ".
