# Issue Memory

This directory contains investigation cards for active, recently closed, and archived issues.

## Card Lifecycle

1. **Create** — When starting work on an issue, create a card in `active/` using `/rag:card`
2. **Investigate** — Use `/rag:trace` to log findings, rule-outs, hypotheses, and next steps
3. **Promote** — When a finding is durable, use `/rag:promote` to move it to `system/`
4. **Close** — When the issue is resolved, move the card from `active/` to `closed/`
5. **Archive** — After two quarters in `closed/`, move to `archive/`

## Directory Layout

| Subfolder | Contents | Retention |
|---|---|---|
| `active/` | Cards currently under investigation | Duration of investigation |
| `closed/` | Recently resolved cards | Rolling 2 quarters |
| `archive/` | Older cards for reference | Indefinite, low priority |

## Card Structure

Each card lives in `CARD-XXXXX/` and contains:

- `context.md` — Issue ID, source, symptom, repos, schema tables, related issues
- `trace.md` — Running analysis log (append-only)
- `benchmarks.md` — Benchmark moments found during this investigation
- `artifacts/` — Code snippets, DDL excerpts, log samples, schema diffs

## When to Archive

Move a card from `closed/` to `archive/` when:
- It has been closed for more than 2 quarters
- All benchmark-worthy findings have been promoted to `system/`
- The card is no longer referenced by active investigations

## Extraction Checklist (Before Archiving)

- [ ] All benchmark moments have been reviewed (promoted or rejected)
- [ ] No pending entries remain in `benchmarks.md`
- [ ] Related issues in other active cards have been updated if needed
