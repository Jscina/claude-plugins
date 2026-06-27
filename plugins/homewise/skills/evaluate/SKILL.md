---
name: evaluate
description: Turn one property's documents (MLS listing + Seller's Disclosure + any ancillary PDFs) into a standalone, printable buyer inspection checklist (checklist-<slug>.html) with disclosure-driven priority items, a standard whole-home pass, and a narrative disclosure-context box. Use when the user says "evaluate this property/home/house", "homewise evaluate", "make an inspection checklist", "buyer checklist from these listing PDFs", "analyze this home's disclosure", or provides the paperwork for a single home. For weighing several homes against each other, use compare instead.
---

# homewise: evaluate (single property)

Produce one home's buyer **inspection checklist** as a self-contained HTML file. This is the
single-property building block; `compare` runs this same rubric on each home and aggregates.

Portable baseline: read the provided PDFs directly and emit HTML - no external tools required.

## Before you start

Read the shared rubric: `${CLAUDE_PLUGIN_ROOT}/references/evaluation-rubric.md`. It defines intake,
document reading, the per-home data model, status colors, priority-item selection, the narrative, and
all conventions. **Follow it** - this SKILL.md is just the workflow spine.

## Workflow

1. **Get the documents.** No required layout or naming. If none were provided, ask the user to share
   the documents for the home. Identify the MLS, the Seller's Disclosure, and any ancillary docs
   (rubric section 1); confirm they're one property (if more than one address appears, suggest `compare`).

2. **Read the sources** (rubric section 2). Read each PDF directly - that is the baseline and it handles
   scanned/e-signed disclosures. *Optional, where the tool exists:* you may run `pdftotext -layout` on a
   text-based MLS for cleaner text. **Never invent missing values** (rubric section 0) - mark
   `Unknown` / `Not provided`, or ask.

3. **Build the per-home model** (section 3) and derive the **priority items** (section 5), the
   **standard whole-home pass** (section 6), and the **disclosure-context paragraph** (section 7).

4. **Render the HTML.** Read `${CLAUDE_PLUGIN_ROOT}/templates/checklist.html`, copy it verbatim (the
   `<style>` and `<script>` are the design system - don't rewrite them), substitute the `{{TOKENS}}`,
   and fill the priority + standard regions, the context paragraph, and the footer sources. Slug +
   accent per section 9 (single home: blue `#2f5d7c`). Write `checklist-<slug>.html`.

5. **Deliver, then offer PDF.** Present the HTML so the user can preview and save it (an artifact and/or
   a written file); note it opens in any browser and autosaves checkboxes/notes. Then **offer** a PDF:
   where a renderer exists, run `${CLAUDE_PLUGIN_ROOT}/scripts/html2pdf.py checklist-<slug>.html`;
   otherwise tell the user to Print > Save as PDF from the browser. Never auto-generate the PDF.

## Output

- `checklist-<slug>.html` - one standalone, printable, self-contained file (inline CSS + JS, no assets).

## Guardrails

- Evidence over invention (rubric section 0). Surface MLS-vs-disclosure conflicts; attribute findings to
  their real source (disclosure form vs listing remarks).
- Keep the buyer's-aid disclaimer in the footer. No literal em dashes; use a spaced hyphen " - ".
