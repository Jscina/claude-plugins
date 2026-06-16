# RAG Plugin — Design Backlog & Decisions

A living design doc for the `rag` plugin's evolution. It captures open design items surfaced during
the v0.4.0 / v0.5.0 work so we can work them **one at a time**, at whatever pace, without losing
context.

This is maintainer-facing. Specs mirror the monorepo's plugin layout — this one lives at
`.spec/plugins/rag/` (parallel to the code at `plugins/rag/`), so each plugin gets its own spec space
and nothing here ships in the plugin payload.

## How to use this doc
- Each item is a section with a **Status**, the **problem**, the **direction** we've agreed so far,
  **open questions**, and a **proposed action**.
- Discuss/resolve one item at a time. When an item is ready to build, it usually becomes its own
  RAG card (and may spawn a PR). Update the item's Status as it moves.
- Keep decisions and their *rationale* here so we don't re-litigate.

## Status legend
`PROPOSED` · `DECIDED` (direction agreed, not yet built) · `IN PROGRESS` · `DONE` · `DEFERRED`

## Index
| # | Item | Status |
|---|---|---|
| 1 | Card migration: deterministic format-stamp vs AI enrichment | DECIDED |
| 2 | `closed` field needs a writer (stamp on lifecycle exit) | DECIDED |
| 3 | Test-driven development + CI for the `bin/` scripts | DECIDED (new effort) |
| 4 | Stale system-knowledge: reconcile-on-promote + verifiable findings | DECIDED (own card) |
| 5 | "Cards behind" detection after an upgrade | RESOLVED by #1 |
| 6 | Indexer is unbuilt → header schema is unvalidated | DEFERRED (accepted) |
| 7 | Release checklist (`RELEASING.md`) | DECIDED |
| 8 | Per-card `format_gen` as a cheap check against `.rag-meta.json` | DECIDED |

> Several of these are interdependent: **#1, #2, #5, #8** collapse into one coherent revision of the
> card design (currently in flight as PR #4). **#3** and **#4** are their own efforts. **#7** is a
> quick win.

---

## 1. Card migration: deterministic format-stamp vs AI enrichment
**Status:** DECIDED — not yet built.

**Problem.** How should *existing* cards get the new header across plugin versions? We tried two shapes:
(a) deterministic migration that *parsed* the Issue Summary (brittle — produced a list-item-regex bug
and a YAML-colon bug), then (b) "AI rewrites the whole card" (flexible + can enrich, but turns a
no-review operation into a review-required one — fights the "minimize review during migration" goal).

**Direction.** Split the two operations we'd conflated:
- **Format migration** = bring the header current. **Deterministic, minimal, no-parse, no review.**
  The only field we need reliably is `card_id` = the **directory name** (zero parsing). Stamp
  `card_id` + `format_gen` (+ empty `title`/`opened`/`closed`/`tags`). Body byte-preserved,
  dry-runnable, idempotent. This lives in `rag-migrate` (deterministic core).
- **Enrichment** = fill `title`/`opened` from the body, sharpen content. **Separate, opt-in AI pass**,
  reviewed when run. NOT part of "upgrade between versions."

Rationale: the brittleness was caused by *parsing*, not by determinism — so don't parse. This satisfies
both constraints (low review **and** integrity) better than either prior shape.

**Open questions — RESOLVED (2026-06-16, plan review).**
- Enrichment home: its **own thin skill** (`/rag:enrich`) — discoverable, skill-consistent, and keeps
  enrichment decoupled from version-upgrade (a `/rag:migrate` Part 2 would re-couple what #1 split).
  Template-as-spec + AI; no per-version card-parsing code. Separate effort; does NOT gate the stamp.
- Empty `opened`: **yes — leave it empty** on deterministically-stamped cards until enrichment (or a
  human) fills it. Lossless: the real Date Opened stays in the body's Issue Summary; an mtime fallback
  is unreliable and reintroduces a parse. New cards still get `opened` from `rag-new-card`.

**Proposed action.** Revise PR #4: reinstate a deterministic, no-parse card-header stamp in
`rag-migrate`; document enrichment as a separate opt-in step. (Bundles with #2, #5, #8.)

---

## 2. `closed` field needs a writer
**Status:** DECIDED — not yet built.

**Problem.** We added `closed:` to the card header, but nothing populates it (not `rag-new-card`; the
close ceremony moves the card dir but doesn't touch the header). It's permanently empty.

> Note: the deprecated thing from an older schema was the `closed/` *directory* (retired in v0.2.0 for
> `done/` + `archive/`). The `closed:` *header field* is new.

**Direction.** The **close ceremony** (`/rag:memory`) stamps `closed: <date>` when a card leaves
`backlog`/`active` for `done`/`archive`. Works cleanly because #1 gives active cards a header to stamp.

**Open questions.** None significant.

**Decided mechanics (2026-06-16, plan review).**
- Date = the close date (day of the move).
- Stamp on both terminals (`done/` and `archive/`).
- Overwrite policy = **stamp only if `closed:` is empty**; preserve any existing value (idempotent;
  respects a manually-corrected/enriched date on re-close).
- Legacy guard = if a card reaches the ceremony with no header (pre-#1 corpus), stamp nothing and flag
  it rather than fabricate a header mid-close.
- Symmetry: `opened` <- rag-new-card/enrichment; `closed` <- close ceremony (no field has two writers).

**Proposed action.** Wire `closed` stamping into the `/rag:memory` close ceremony. Bundle with #1.

---

## 3. Test-driven development + CI
**Status:** DECIDED — new effort (own card).

**Problem.** Across v0.4.0/v0.5.0 we found ~5 real bugs *purely by manual grilling* (path traversal,
doc-not-bumped, list-item regex, YAML colon, meta-sweep). Manual grilling doesn't scale and leaves
regression risk.

**Direction / where to begin.**
1. `tests/` at the **repo root** (outside `plugins/rag/`, so never shipped).
2. **pytest** as a dev-only dependency (shipped code stays stdlib-only; `unittest` is the zero-dep
   fallback).
3. **Characterization tests first** — lock in current behavior of the two `bin/` scripts:
   - `rag-migrate`: migration matrix (schema-0 / `plugin_schema:3` / `format_gen:3` → expected
     outcome), idempotency, body-preservation, the `plugin_schema` → `format_gen` sweep.
   - `rag-new-card`: scaffold, `--backlog`, overwrite-guard, path-traversal sanitizer.
4. **GitHub Actions** running pytest on every PR — this is what replaces manual grilling.
5. All new work goes **test-first** (the #1 card-stamp is a natural first TDD subject).

**Open questions — RESOLVED (2026-06-16, plan review).** Runner = **pytest, dev-only**
(parametrize/fixtures fit the migration matrix; shipped code stays stdlib-only; `unittest` stays the
zero-dep fallback). The **#3-vs-#1 build sequencing** is deferred to the execution-planning step (with
PR #4's fate).

**Proposed action.** Open a backlog card; first deliverable = test scaffold + characterization tests +
CI workflow.

---

## 4. Stale system-knowledge (the long-term-value risk)
**Status:** DECIDED (direction, 2026-06-16) — own card; Layer 1 (reconcile-on-promote) near-term,
Layer 2 after #3. Still high priority.

**Problem.** Promoted `system/` docs can go wrong when later work contradicts them, and nothing flags
it. Concrete example: `system/known-behaviors/rag-corpus-schema-and-migration.md` still documents the
*old* single-number `plugin_schema` model we replaced. `/rag:promote` only ever **appends** — there is
no reconciliation loop. Stale system knowledge defeats the plugin's whole purpose long-term.

**Direction (two layers).**
- **Reconcile-on-promote.** `/rag:promote` and the close-ceremony sweep must, *before* adding a finding,
  check existing `system/` docs on that topic; if the new finding updates/contradicts one, **edit it or
  mark the superseded section `status: superseded`** (with a link). Catch staleness when you have the
  new knowledge.
- **Tie verifiable findings to tests** (depends on #3). Behavioral claims ("rag-migrate reads its
  target from the template") are testable; a finding linked to a test goes stale → the test fails → you
  know. Not everything is testable, but the highest-churn behavioral claims are.

**Open questions — RESOLVED / DEFERRED (2026-06-16, plan review).**
- Reconcile-on-promote aggressiveness: **AI proposes, human approves** — the skill detects the topic
  overlap and proposes the edit / `status: superseded` with a back-link; the human reviews before it is
  written or committed (safe for the durable, committed knowledge layer). Not silent auto-edit; not a
  passive flag.
- "finding ↔ test" link mechanism: **DEFERRED to #4's design card** (cannot be designed before #3
  exists). Direction confirmed: Layer 2 links verifiable behavioral claims to tests, so a failing test
  flags a stale finding.

**Proposed action.** Open #4's design card; build **Layer 1** (reconcile-on-promote,
AI-proposes/human-approves) near-term; **Layer 2** (finding↔test links) after #3. Immediate
(independent of the card): the close ceremony for CARD-ISSUE-CARD-MIGRATION supersedes/corrects
`rag-corpus-schema-and-migration.md`.

---

## 5. "Cards behind" detection after an upgrade
**Status:** RESOLVED by #1.

**Problem.** With `rag-migrate` fully out of cards, nothing signaled that cards drifted after an
upgrade — you'd have to remember to run the card step.

**Resolution.** #1's deterministic card-header stamp means `rag-migrate` handles card *format* itself,
so cards don't silently drift. Nothing to detect. (If we ever want a pure detector anyway, #8's per-kind
meta map makes it a cheap comparison.)

---

## 6. Indexer is unbuilt → header schema is unvalidated
**Status:** DEFERRED — accepted tech-debt.

**Problem.** The retrieval indexer (`features/slot-in-rag.md`) that justifies the header work doesn't
exist, so the schema (`domain`, `source_cards`, `format_gen`, `tags`) is designed speculatively against
no consumer. Risk: schema churn + migration debt when the indexer ships.

**Decision (user).** Accept the risk. Building a hasty indexer now would enshrine poorly-planned
conventions — worse than reconciling tech-debt later. The headers earn their keep today by making
frontmatter tooling / Obsidian work. Revisit when we build the indexer.

---

## 7. Release checklist (`RELEASING.md`)
**Status:** DECIDED — ready to add.

**Problem.** Releases are a manual multi-step dance (`plugin.json` version → `marketplace.json` ref →
commit → tag `{plugin}--vX.Y.Z` → push tag → `gh release create` with ASCII notes → CHANGELOG). The
ref bump is exactly what `known-behaviors` warns is easy to forget.

**Direction.** A **`RELEASING.md` at the marketplace repo root** (outside `plugins/rag/`, so
maintainer-facing and never bundled). Contains the ordered checklist + the gotchas (ASCII-only notes;
backtick `@handle` to avoid contributor autolinks; ref-bump is what actually ships a version).

**Open questions.** None.

**Proposed action.** Add `RELEASING.md`. Quick win — can land independently of the card work.

---

## 8. Per-card `format_gen` as a cheap check against `.rag-meta.json`
**Status:** DECIDED — not yet built.

**Problem.** We **decoupled** the lineages (system docs at gen `3`, cards at gen `1`), but
`.rag-meta.json` only carries the doc gen — so a card's `format_gen` can't actually be checked against
the meta (different lineages). The "cheap check" the number is supposed to enable doesn't work yet.

**Direction.** `.rag-meta.json` carries **per-kind** current generations:
```json
{ "format_gen": { "doc": 3, "card": 1 }, "plugin": "rag" }
```
Then "is this card current?" = `card.format_gen >= meta.format_gen.card` — a genuinely cheap check.
`rag-migrate` writes the map (it knows both gens as constants), even though card *content* migration is
the deterministic stamp from #1.

**Open questions — RESOLVED (2026-06-16, plan review).**
- `read_corpus_gen` is a **total function → `{doc, card}`**: new map passes through (missing kind → 0);
  a legacy flat int / `plugin_schema` / `schema` → `{doc: <int>, card: 0}` (the flat int was always the
  doc lineage; cards were unmanaged); missing meta → `{doc: 0, card: 0}`.
- **File header stays authoritative** for stamping (meta is only the cheap hint); migration is
  idempotent per-file, so the legacy `card: 0` default never double-stamps an already-headered card.
- **No redundant `--check` detector** (the file-walk already surfaces behind-cards). The map's consumer
  is the deferred indexer (#6); writing it now just avoids a second meta migration later.

**Proposed action.** Update `.rag-meta.json` template + `read_corpus_gen` + the doc that describes the
meta. Bundle with #1.

---

## Execution plan (settled 2026-06-16)

The 8-item walk is complete; every per-item open question is resolved above. Execution decisions:
**min-harness then #1 test-first** · **rework PR #4** (not a fresh PR) · **RELEASING.md bundled into the
rework PR**.

**Umbrella:** `CARD-ISSUE-CARD-MIGRATION` owns the v0.5.0 deliverable (it already owns PR #4 / branch
`feat/rag-card-headers-format-gen`). #3 (full CI) and #4 (reconcile-on-promote) get their own cards
*after* v0.5.0.

1. **Min-harness (test baseline).** `tests/` at repo root + pytest (dev-only). Characterization tests
   that LOCK the current branch behavior #1 does *not* change: doc pass, `plugin_schema`→`format_gen`
   sweep, flat-int meta read, `rag-new-card` scaffold / `--backlog` / overwrite-guard / path-traversal.
   Green against branch HEAD. (Full GitHub Actions CI is deferred to #3's card.)
2. **Cluster-A rework (test-first).** Write failing tests, then implement:
   - **#1** deterministic no-parse card pass in `rag-migrate` (card_id = directory name; + `format_gen`
     + empty `title`/`opened`/`closed`/`tags`; walks all lifecycle `*/context.md`; body byte-preserved;
     idempotent per-file; dry-runnable).
   - **#8** `LATEST_GEN = {doc:3, card:1}`; per-kind meta map; `read_corpus_gen` total fn (map / legacy
     flat-int → `{doc, card:0}` / missing → `{0,0}`).
   - **#2** `closed`-writer in the `/rag:memory` close ceremony (stamp-if-empty; both terminals; legacy
     guard).
3. **`/rag:enrich` skill (#1 enrichment).** New thin skill: AI brings a card's `context.md` up to the
   current template, fills `title`/`opened` from the body, sharpens; stamps `format_gen`; reviewed when
   run. Opt-in, non-gating. (Separable from the PR if scope needs trimming.)
4. **Docs + version + RELEASING.md.** Reframe CHANGELOG 0.5.0 (deterministic card stamp; enrichment =
   `/rag:enrich`; per-kind meta); update `structure.md` + `/rag:migrate` SKILL (Part 1 stamp; enrichment
   → `/rag:enrich`); add `RELEASING.md` at the repo root (bundled per #7). `plugin.json` 0.5.0 +
   marketplace ref `rag--v0.5.0` already set on the branch.
5. **Dogfood re-migration.** Run the new `rag-migrate` on this corpus: meta flat `{format_gen:3}` →
   per-kind `{doc:3, card:1}`; cards already at `format_gen:1` (idempotent — confirmed, not re-stamped);
   verify body-preserving + `--check` clean. Sweep the stray `._CARD-FRONTMATTER-ADOPTION` AppleDouble.
6. **Verify + commit + PR.** `py_compile`; `plugin validate`; `pytest` green. Commit to the branch (no
   co-author trailer). Update PR #4 body (ASCII-only; backtick `@handles`) to the deterministic-stamp +
   enrichment-split + per-kind-meta + closed-writer + RELEASING.md story. Await review/merge.
7. **On merge.** Tag `rag--v0.5.0`; ASCII GitHub release; close ceremony for this card — which now
   stamps `closed:`, supersedes/corrects `rag-corpus-schema-and-migration.md` (#4's immediate action),
   and promotes the per-kind / `format_gen` + card-header findings.

**Deferred to own cards (post-v0.5.0):** #3 full (GitHub Actions CI + comprehensive suite, seeded by the
min-harness) · #4 (reconcile-on-promote Layer 1 near-term; Layer 2 after #3).

## Changelog of this doc
- 2026-06-14 — created from the v0.4.0/v0.5.0 design discussion (items 1–8).
- 2026-06-16 — full plan review: walked items 1–8, settled every open decision (logged per-item above)
  and recorded the execution plan. #4 moved PROPOSED → DECIDED.
