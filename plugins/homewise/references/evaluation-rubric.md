# homewise evaluation rubric

The shared judgment guide behind both skills, and the single source of truth for how homewise
thinks. `evaluate` applies sections 1-7 to one home; `compare` applies them to each home, then adds
section 8. Conventions (section 9) always apply.

It is written to a **portable baseline** that works on every surface (Claude Code, claude.ai, the
API): read the provided PDFs directly and emit self-contained HTML - no external tools required.
Richer tools are **optional enhancements** used only where they exist (section 2 / section 9).

This is the part that needs judgment: deciding which document is which, what counts as a priority,
which status color a fact deserves, and how to phrase it for a buyer.

---

## 0. Cardinal rule: evidence, not invention

Every figure in the output must trace to a document that was provided. **Never invent** a price, AVM,
tax, square footage, system age, or disclosure answer. If a value isn't available: omit the row/item,
write `Not provided` / `Unknown`, or ask. Distinguish what the seller *disclosed* from what you
*inferred*. When the MLS and the disclosure disagree, that conflict is itself a finding (often a
priority item) - surface it, don't silently pick one.

---

## 1. Intake and grouping

The documents arrive however is convenient - a folder, a loose pile, or files dropped into the
conversation. There is no required structure or naming.

- Identify each document from its content: an **MLS listing** ("Cross Property", "360 Property View",
  "Listing #", a field dump of Beds/Baths/Sqft/Lot/Year Built); a **Seller's Disclosure** ("SELLER'S
  RESIDENTIAL REAL ESTATE SALES DISCLOSURE", a state form number); a **utility log**; a **septic
  permit**; etc.
- **Group by property address.** Each home should have at least an MLS and/or a disclosure. Note
  what's missing. Confirm the home count if it's ambiguous.

## 2. Reading each document

**Baseline: read the provided PDFs directly** - you can see PDF contents natively, so nothing else is
required. Read the MLS, the full Seller's Disclosure (every yes/no/unknown box, the defect write-ins,
the systems section and ages, the later "other disclosures" pages - it's the most decision-critical
source), and any ancillary docs (utility log, septic permit, additional info). Skip pure flavor.

- Pull from the MLS: price, status/DOM, beds/baths, finished sqft (total + above grade), lot size,
  year built, county, subdivision, public + agent remarks, any RealAVM/CoreLogic value, tax,
  assessment, flood zone. (Listing remarks often carry defects the disclosure form does not.)
- **Optional enhancement (where the tool exists, e.g. Claude Code):** you *may* run `pdftotext -layout`
  on a text-based MLS for clean tabular text. It is never required and is unavailable in the browser;
  native reading is the default and handles scanned/e-signed disclosures fine.
- Public-record data (AVM, assessor beds, tax, assessment history, flood zone) is usually in the MLS;
  use it when present, otherwise mark `Not provided` (section 0).

## 3. Per-home data model

Assemble before writing HTML:

- **Identity**: short name (slug rules), full address, locality, county, year built, water + sewer,
  list price, lot size, one-line differentiator.
- **Pricing / value**: list price; AVM (if in the MLS); list-vs-AVM %; annual tax; assessment jump.
- **The house**: year built; beds (flag MLS vs assessor / below-grade mismatches); baths; finished
  sqft (total + above grade); lot.
- **Systems**: sewer; water; furnace + AC age; roof age/condition; water heater age; est. utilities/mo.
- **Disclosure facts**: disclosed defects; the "unknown" answers; HOA; flood zone; seller notes
  (cameras, items not conveying, planned repairs).
- **Derived** (sections 5-7): priority items + rationale, standard-pass tailoring, narrative.

## 4. Status classification (comparison cells and flag dots)

- `good` - favorable / recently updated / clean (new roof; 2-yr mechanicals; public sewer; no defects; flood zone X).
- `warn` - verify / budget for / watch (aging system; roof near end of life; "unknown" answers; bed mismatch; septic to inspect; list well above AVM).
- `crit` - disclosed problem or action needed before closing (disclosed defect; "to be rebuilt" promise; structural concern; major conflict).
- `neutral` - plain fact (year built; baths; sqft; tax; AVM figure).

Status is contextual; in a comparison, judge relative to the other homes too. Don't over-use `crit`.

## 5. Priority items (core of each checklist)

The disclosure- and listing-driven checks a buyer must not skip. Mine from: disclosed defects (always);
"unknown" answers on material things (foundation, structural, moisture, WDO/termite, encroachments,
underground tank); MLS-vs-disclosure conflicts (e.g. HVAC age); aging/end-of-life systems; safety/code
(basement-bedroom egress, panel capacity, septic sizing vs bedrooms); promises to verify in writing;
items not conveying / privacy (cameras). Each item = a bold action/finding headline + optional `why`
(what the source said / why it matters). Order by severity (crit first). Aim for ~6-10. Attribute
accurately: if a flaw comes from the listing agent remarks rather than the disclosure form, say so.

## 6. Standard whole-home pass

A compact generic grid (~12-15 boxes), lightly tailored: Foundation cracks / settling; Roof, flashing,
gutters; Attic insulation / venting; Grading & drainage; Windows & doors operate; HVAC heat + cool
cycle; Water heater; Plumbing: leaks / pressure; Outlets, GFCIs, alarms; Electrical panel; Appliances
tested; Fireplace operation; Radon test / WDO; Deck / fence / patio. Tailor with known ages
("Water heater (2022)", "Electrical panel (200A)"), the right fireplace type, and sewer type.

## 7. Disclosure-context narrative

One tight paragraph per home: who the sellers are + disclosure date, the headline issues, and the
price read (list vs AVM if known). Bold key facts. Characterize the disclosure honestly ("cleanest of
the set" / "most 'unknown' answers" / "most transparent about flaws"). Factual, buyer-useful, no hype.

## 8. Comparison specifics (`compare` only)

After evaluating each home (which yields each `checklist-<slug>.html`):
- **Matrix** (`comparison.html`): one column per home, grouped rows (Price & value, The house, Systems,
  Disclosure), each cell a status + value per section 4. Keep rows where at least one home has data.
- **Flag cards**: one per home, 4-7 status-dotted follow-ups.
- **Booklet** (`booklet.html` -> `inspection-checklist.html`): cover + each home's section (same content
  as its standalone checklist) + a combined disclosure-context recap.
Keep home order + accents consistent across all documents.

## 9. Conventions

- **Slug**: lowercase short name, spaces -> hyphens, strip punctuation (`5106 Everett Ave` -> `everett`).
  It's the `data-home` value + autosave key; keep it stable so a home's standalone checklist and its
  booklet section share saved state.
- **Accent rotation**: home 1 blue `#2f5d7c`, home 2 green `#4a7a4f`, home 3 brown `#9c6b3f`, then cycle.
  A single home uses blue.
- **Output filenames**: per-home `checklist-<slug>.html`; comparison `disclosure-comparison.html`;
  booklet `inspection-checklist.html`.
- **Output is HTML, always.** Self-contained (inline CSS + JS); present it so the user can preview and
  save it (an artifact and/or a written file). The checklists auto-save checkboxes/notes in the browser.
- **PDF is optional, on request:**
  - Where a renderer exists (e.g. Claude Code with Node), run the bundled `scripts/html2pdf.py <file>`
    (it finds a browser / wkhtmltopdf / installs puppeteer with `--no-sandbox`).
  - Otherwise (e.g. claude.ai), tell the user to open the HTML and use the browser's Print > Save as
    PDF - the templates' print CSS is tuned for letter paper.
  - Never block on PDF and never auto-generate it.
- **Footer sources**: list only what you used. **House style**: no literal em dashes - use a spaced
  hyphen " - ".
- **Disclaimer** (already in the template footers): a buyer's working aid for organizing a professional
  inspection - not an inspection report, appraisal, or advice; verify all figures independently. Keep it.
