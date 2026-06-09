# Issue Memory

This directory holds investigation cards across their lifecycle: planned (backlog), under
investigation (active), finished-locally (done), and the durable committed record (archive).

## Card Lifecycle

1. **Plan (optional)** — Park a not-yet-started idea as a card in `backlog/` (local, per-dev).
2. **Create / Activate** — Start work by creating a card in `active/` with `/rag:card`
   (or move one from `backlog/` to `active/`).
3. **Investigate** — Use `/rag:trace` to log findings, rule-outs, hypotheses, and next steps.
4. **Promote** — When a finding is durable, use `/rag:promote` to write it to `system/`.
5. **Close — pick a terminal state:**
   - **Done** → move the card to `done/`. Local, dev-managed; **not committed**. Keep or clean up as you like.
   - **Archive** → move the card to `archive/`. This is the **durable, committed shared record**.

The close ceremony (run via the `memory` orchestrator) sweeps the trace for missed benchmarks,
reviews pending benchmarks, then asks **done or archive**.

## Directory Layout

| Subfolder | Contents | Git |
|---|---|---|
| `backlog/` | Planned, not yet active | Local (gitignored) |
| `active/` | Cards currently under investigation | Local (gitignored) |
| `done/` | Finished locally, kept per-dev | Local (gitignored) |
| `archive/` | Durable shared record | **Committed** (except `trace.md`) |

> **Legacy `closed/`** — superseded by `done/` + `archive/`. Existing `closed/` cards stay readable;
> create no new ones. Migrate when convenient: move to `done/` (keep local) or `archive/` (commit).

## Card Structure

Each card lives in `CARD-XXXXX/` and contains:

- `context.md` — Issue ID, source, symptom, repos, related issues  *(committed in archive/)*
- `trace.md` — Running analysis log (append-only)  *(always local — never committed)*
- `benchmarks.md` — Benchmark moments found during this investigation  *(committed in archive/)*
- `artifacts/` — Code snippets, DDL excerpts, log samples, schema diffs  *(committed in archive/)*

Backlog cards start with `context.md` only; `trace.md` / `benchmarks.md` / `artifacts/` appear when
the card is activated.

## Close Checklist (before moving out of `active/`)

- [ ] `trace.md` swept for un-tagged benchmark-worthy findings
- [ ] All benchmark moments reviewed (promoted or rejected) — no `pending` left in `benchmarks.md`
- [ ] Related issues in other active cards updated if needed
- [ ] Destination chosen: `done/` (local) or `archive/` (committed)
