# homewise

A Claude plugin that turns a property's listing paperwork into clean, printable **buyer
due-diligence documents**: a disclosure-driven inspection checklist per home, and - across several
homes - a color-coded comparison sheet and a combined booklet.

## Skills

| Skill | Input | Output |
|---|---|---|
| `/homewise:evaluate` | One property's documents | `checklist-<slug>.html` - a standalone, printable inspection checklist |
| `/homewise:compare` | Several properties' documents | `disclosure-comparison.html` (cross-home matrix + per-home flag cards) and `inspection-checklist.html` (combined booklet). Evaluates each home first, so you also get every per-home `checklist-<slug>.html`. |

## Portable by design (single source, runs anywhere)

homewise is written to a **baseline that works on every surface** - Claude Code, claude.ai, the API:
it **reads the provided PDFs directly and emits self-contained HTML**, with no external tools required.
The judgment + design live in one place - `references/evaluation-rubric.md` and `templates/` - so the
same skill behaves consistently wherever it runs.

Richer capabilities are **optional enhancements**, used only where they exist and never required:
- `pdftotext` for cleaner text from a text-based MLS (native reading is the default and handles scanned
  disclosures fine).
- `scripts/html2pdf.py` to render a PDF where a browser/Node renderer is available; otherwise you print
  to PDF from the browser.

This is what lets the **claude.ai** build be generated from this same source rather than maintained
separately (see "claude.ai" below).

## Giving it the documents

No required folder layout or filenames. Provide the documents however is convenient (a folder, a loose
pile, or files dropped into the conversation); homewise classifies each by content (the address, the
disclosure form header) and groups them by home. Typical per-home docs are an MLS listing and a
Seller's Disclosure, often with extras (utility log, septic permit, etc.). Only what exists is used.

## Output

HTML is produced first - instant, self-contained (inline CSS + JS, no assets), opens in any browser,
and the checklists autosave checkboxes and notes locally. For a PDF, either run
`scripts/html2pdf.py <file>` (where a renderer is available - it tries a local Chrome/Chromium,
wkhtmltopdf, then a cached puppeteer install with `--no-sandbox`) or open the HTML and use the
browser's Print > Save as PDF (the print CSS is tuned for letter paper).

## claude.ai

The same source compiles to uploadable **Skills** for claude.ai (Settings > Customize > Skills >
Create skill > upload a ZIP; requires code execution). Run `./build-claude-skills.sh` to generate
self-contained `evaluate` and `compare` skill ZIPs from this plugin (it bundles the shared rubric +
templates and rewrites asset paths to be relative). On claude.ai the optional PDF step is unavailable,
so you print to PDF from the browser.

## Layout

```
homewise/
|-- build-claude-skills.sh    # compile this plugin into claude.ai upload ZIPs
|-- references/
|   `-- evaluation-rubric.md  # the single source of judgment + conventions
|-- scripts/
|   `-- html2pdf.py           # optional PDF renderer (not required, not on PATH)
|-- templates/
|   |-- checklist.html        # per-home checklist (also the booklet's per-home section)
|   |-- comparison.html       # cross-home matrix + flag cards
|   `-- booklet.html          # combined cover + per-home sections + recap
`-- skills/
    |-- evaluate/SKILL.md
    `-- compare/SKILL.md
```

## Disclaimer

The documents are a buyer's working aid for organizing a professional inspection and negotiation -
they are **not** an inspection report, appraisal, or professional advice. Verify every figure
independently.
