# homewise

A Claude Code plugin that turns a property's listing paperwork into clean, printable
**buyer due-diligence documents**. Give it the documents for a home (or several) and it produces
the same artifacts a careful buyer's agent would assemble by hand: a disclosure-driven inspection
checklist per home, and - across several homes - a color-coded comparison sheet and a combined
booklet.

## Skills

| Skill | Input | Output |
|---|---|---|
| `/homewise:evaluate` | One property's documents | `checklist-<slug>.html` - a standalone, printable inspection checklist for that home |
| `/homewise:compare` | Several properties' documents | `disclosure-comparison.html` (cross-home matrix + per-home flag cards) and `inspection-checklist.html` (combined booklet). Evaluates each home first, so you also get every per-home `checklist-<slug>.html`. |

`compare` is `evaluate` applied to each home and then aggregated - run `evaluate` when you care about
one house, `compare` when you are weighing several.

## Giving it the documents (flexible intake)

There is **no required folder layout or file-naming convention**. Provide the documents whatever way
is convenient and the skill sorts them out by reading their contents (the property address, the
disclosure form header, etc.):

- point it at a folder (nested subfolders are fine),
- drop in a loose pile of PDFs for one or more homes, or
- add files one home at a time when prompted.

Typical per-home documents are an **MLS listing** and a **Seller's Disclosure**, often with extras
(utility logs, a septic permit, earnest-money / wire instructions, etc.). Only what exists is used;
nothing is required to be present or named a particular way.

## Output

HTML is produced **first** - it is instant, self-contained (inline CSS + JS, no assets), opens in any
browser, and the checklists autosave your checkboxes and notes to that browser. After the HTML is
written, the skill **offers to render PDFs** (letter, print-optimized). PDF generation uses a headless
Chromium via `npx` Puppeteer, so it is the slower, opt-in step - hence HTML-first.

## Requirements

- `pdftotext` (poppler) for reading text-based listing PDFs; scanned disclosures are read directly.
- `node` + `npx` only if you ask for PDF output.

## Layout

```
homewise/
|-- bin/homewise              # helper: inventory | extract-mls | html2pdf
|-- references/
|   `-- evaluation-rubric.md  # shared judgment guide used by both skills
|-- templates/
|   |-- checklist.html        # per-home checklist (also the booklet's per-home section)
|   |-- comparison.html       # cross-home matrix + flag cards + caution banner
|   `-- booklet.html          # combined cover + per-home sections + recap
`-- skills/
    |-- evaluate/SKILL.md
    `-- compare/SKILL.md
```

## Disclaimer

The documents are a buyer's working aid for organizing a professional inspection and negotiation -
they are **not** an inspection report, appraisal, or professional advice. Every figure should be
independently verified.
