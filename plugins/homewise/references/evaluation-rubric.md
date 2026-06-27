# homewise evaluation rubric

The shared judgment guide behind both skills. `/homewise:evaluate` applies sections 1-7 to one
home. `/homewise:compare` applies them to each home, then adds section 8. Conventions (section 9)
apply to both.

This is the part a script can't do: deciding which document is which, what counts as a priority,
which status color a fact deserves, and how to phrase it for a buyer. The `bin/homewise` helper only
moves bytes (inventory, extract text, html2pdf).

---

## 0. Cardinal rule: evidence, not invention

Every figure in the output must trace to a document the user provided (or to a source you explicitly
checked with the user's go-ahead). **Never invent** a price, AVM, tax, square footage, system age, or
disclosure answer. If a value isn't available:

- omit the row/item, or
- write `Not provided` / `Unknown`, or
- ask the user for it.

Distinguish what the seller *disclosed* from what you *inferred*. When the MLS and the disclosure
disagree, that conflict is itself a finding (often a priority item) - surface it, don't silently pick one.

---

## 1. Intake and classification (flexible by design)

There is **no required folder layout or filename convention.** The user may give you a folder, a loose
pile of PDFs, or files one home at a time. If they haven't provided anything yet, ask them to drop in
the documents for the home(s).

1. Run `homewise inventory <path...>` on whatever paths the user gives. It recurses and returns, per
   PDF: `path`, `parent`, `pages`, and a text `snippet`.
2. Classify each document from its snippet (and the Read tool if the snippet is empty):

   | Document | Signals in the snippet |
   |---|---|
   | MLS listing | "Cross Property", "360 Property View", "Listing #", MLS-style field dump (Beds/Baths/Sqft/Lot/Year Built) |
   | Seller's Disclosure | "SELLER'S RESIDENTIAL REAL ESTATE SALES DISCLOSURE", "State Form 46234" (Indiana; other states differ) |
   | Utility log | "Utilities", monthly amounts, electric/gas/water providers |
   | Septic permit / layout | "septic", "permit", absorption field; often a scanned image (empty snippet) |
   | Earnest-money / wire instructions | "Earnest Money", "EMD", "ACH", "Payload" - informational only; do not put in the output |
   | "Ten things I love" / flavor | seller's prose; usable for soft color only, never as fact |

3. **Group documents by home** using the address in the snippet (not the folder). Each home should end
   up with, at minimum, an MLS and/or a disclosure. Note what's missing.

---

## 2. Reading each document

- **MLS listing -> `homewise extract <mls.pdf>`.** These are text PDFs; `pdftotext -layout` reads
  cleanly. Pull price, status/DOM, beds/baths, finished sqft (and above/below grade), lot size, year
  built, county, subdivision, and any remarks about systems/roof/updates.
- **Seller's Disclosure -> read the pages directly (vision).** These are frequently scanned or
  e-signed form PDFs; `extract` often returns garbled or empty text (that empty snippet is your cue).
  Use the Read tool on the PDF and read the actual form: every "yes / no / unknown / not applicable"
  box, the defect write-ins, the systems section, and the dates/signatures. The disclosure is the most
  important source and the least machine-readable - read it carefully.
- **Ancillary docs** - extract or read as needed: utility logs (monthly cost picture), septic permit
  (system size / bedroom rating / age), additional info (schools, etc.). Skip flavor docs for facts.
- **Public-record / AVM data** (CoreLogic AVM, assessor bed count, annual tax, assessment history,
  FEMA flood zone) is usually NOT in the bundle. Use it only if the user provided it or asked you to
  look it up (and you can). Otherwise mark those rows `Not provided` - see section 0.

---

## 3. Per-home data model

Assemble this before writing HTML. Track the source of each field.

- **Identity**: short name (see slug rules), full street address, locality, county, year built,
  water + sewer, list price, lot size, any one-line differentiator (owned propane, walkout basement).
- **Pricing / value**: list price; CoreLogic AVM (if available); list-vs-AVM %; annual tax (w/
  homestead if known); assessment jump. *(AVM/tax/assessment are public-record - section 0/2 rules.)*
- **The house**: year built; beds MLS-vs-assessor (flag mismatches); baths; finished sqft
  (total + above grade); lot size.
- **Systems**: sewer (public/septic); water (public/well); furnace + AC age; roof age/condition;
  water heater age; estimated utilities/mo (from the utility log if present).
- **Disclosure facts**: disclosed defects; the list of questions answered "unknown"; HOA yes/no;
  flood zone; anything seller-noted (cameras, items not conveying, planned repairs).
- **Derived** (sections 5-7): priority items + rationale, standard-pass tailoring, narrative paragraph.

---

## 4. Status classification (comparison cells and flag dots)

| Status | Meaning | Examples |
|---|---|---|
| `good` | Favorable, recently updated, or clean | new roof; furnace/AC both 2 yrs; public sewer; no disclosed defects; flood zone X |
| `warn` | Verify, budget for, or watch | aging system (~14 yr furnace); roof near end of life; "unknown" disclosure answers; bed-count mismatch; septic to inspect; list well above AVM |
| `crit` | Disclosed problem or action needed before closing | seller-disclosed broken/defective item; "to be rebuilt" promises; major conflict; structural concern |
| `neutral` | Plain fact, no judgment | year built; baths; sqft; tax amount; AVM figure |

Status is contextual. In a comparison, judge relative to the other homes too (the cheapest mechanicals
in the set might be `good` even if not brand new). Don't over-`crit`: reserve it for genuine disclosed
defects or must-resolve items.

---

## 5. Priority items (the core of each checklist)

Priority items are the disclosure- and listing-driven checks that a buyer must not skip. Mine them from:

- **Disclosed defects** -> always a priority (e.g. "Jetted tub does not work", "back-door blinds
  defective", "Palladian window cracked 22 yrs").
- **"Unknown" answers on material things** -> foundation, structural, basement moisture, WDO/termite,
  encroachments, underground tank. Many "unknowns" = lean on inspection.
- **MLS vs disclosure conflicts** -> e.g. HVAC "4 yrs" on the disclosure vs "2017" on the MLS:
  "get the real install date."
- **Aging or end-of-life systems** -> furnace/AC age, roof age, water heater.
- **Safety / code** -> basement-bedroom egress, panel capacity, septic sizing vs bedroom count.
- **Promises to verify in writing** -> "two windows to be rebuilt - confirm before closing."
- **Items not conveying / privacy** -> cameras removed and patched; cameras active during showings.

Phrasing: each item = a bold **action/finding headline** + optional `why` (what the source said / why
it matters). Keep headlines imperative and specific. Order by severity (crit first). Aim for ~6-10
items - enough to be useful, not a wall. A home with a clean disclosure will have fewer, milder items
(mostly "verify ... listed as unknown"); a transparent-about-flaws seller will have more.

---

## 6. Standard whole-home pass

A compact, generic inspection grid (~12-15 boxes), lightly tailored to the home. Start from this base
and adjust to the property:

Foundation cracks / settling · Roof, flashing, gutters · Attic insulation / venting · Grading &
drainage · Windows & doors operate · HVAC heat + cool cycle · Water heater · Plumbing: leaks /
pressure · Outlets, GFCIs, alarms · Electrical panel · Appliances tested · Fireplace operation ·
Radon test / WDO · Deck / fence / patio.

Tailor: put the system age in parentheses when known ("Water heater (2022)", "Electrical panel
(200A)"); pick the right fireplace ("Gas" vs "Woodburning / chimney"); reflect sewer type ("Public
water - confirm" vs "Septic - locate & inspect" - though septic usually rises to a priority item);
name the deck material if disclosed.

---

## 7. Disclosure-context narrative

One tight paragraph per home (the checklist's context box; reused in the booklet recap). Cover:
who the sellers are + the disclosure date, the headline issues, and the price read (list vs AVM if
known). Bold the key facts with `<strong>`. Characterize the disclosure honestly - "the cleanest of
the set, every hazard question No" vs "carries the most 'unknown' answers" vs "the most transparent
about flaws." End with the value angle when you have it ("listed ~17% over the AVM - negotiating room").
Keep it factual and buyer-useful; no hype.

---

## 8. Comparison specifics (`/homewise:compare` only)

After evaluating each home (which also emits each `checklist-<slug>.html`), build:

- **The matrix** (`comparison.html`): one column per home, grouped rows (Price & value, The house,
  Systems, Disclosure). Fill each cell with a status + value per section 4. Keep rows where at least
  one home has data; drop fully-empty rows. Use `lead` for the headline value, `note` for the small
  qualifier.
- **Flag cards**: one card per home, 4-7 status-dotted bullets - the specific things to raise with
  that listing agent or inspector. This is the per-home "so what."
- **Combined booklet** (`booklet.html` -> `inspection-checklist.html`): cover + each home's section
  (same priority + standard content as its standalone checklist) + a combined disclosure-context recap.

Assign each home an accent by position (see 9). Keep the home order consistent across the matrix
columns, the flag cards, and the booklet sections.

---

## 9. Conventions

- **Slug**: lowercase the short home name, spaces -> hyphens, strip punctuation
  (`5106 Everett Ave` -> name "Everett" -> slug `everett`). The slug is the `data-home` value and the
  autosave key; keep it stable so a home's standalone checklist and its booklet section share saved state.
- **Accent rotation**: home 1 = blue `#2f5d7c`, home 2 = green `#4a7a4f`, home 3 = brown `#9c6b3f`,
  then cycle. A single `evaluate` run uses blue unless told otherwise. In `compare`, the column /
  card / section accent matches the home's position.
- **Output files** (write to the user's chosen output dir, else the cwd): per-home
  `checklist-<slug>.html`; comparison `disclosure-comparison.html`; booklet `inspection-checklist.html`.
- **Footer sources**: list only what you actually used, e.g. "the Seller's Residential Real Estate
  Sales Disclosure (State Form 46234), MLS remarks & the seller utility log."
- **House style**: no literal em dashes - use a spaced hyphen " - " (matches the reference output).
  Plain ASCII where practical.
- **Standing disclaimer** (already in the templates' footers): a buyer's working aid for organizing a
  professional inspection - not an inspection report, appraisal, or professional advice; verify all
  figures independently. Do not weaken or remove it.
- **HTML first, PDF on request**: always produce the HTML, report the paths, then offer PDF via
  `homewise html2pdf <file>` (it's the slow, opt-in step). Never auto-generate PDFs.
