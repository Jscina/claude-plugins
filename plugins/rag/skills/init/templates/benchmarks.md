# Benchmark Moments — Definition & Policy

## What Is a Benchmark Moment?

A confirmed finding from an issue investigation that reveals something durable and reusable about the system. It answers a question that would recur across future issues.

Examples:
- A hard-coded constant that causes log truncation under specific conditions
- A schema relationship that isn't documented but affects query behavior
- A service interaction pattern that fails silently in edge cases

## Promotion Checklist

- [ ] Finding has been confirmed (not just hypothesized)
- [ ] It applies beyond this specific card
- [ ] A target file in `system/` has been identified
- [ ] The finding has been written in `system/` format (context-focused, not issue-specific)
- [ ] `benchmarks.md` in the card has been updated to `PROMOTED`
- [ ] `trace.md` swept for un-tagged benchmark-worthy findings (none stranded)

## Tags

Use these status tags in each card's `benchmarks.md`:

- `BENCHMARK — pending` → Confirmed finding, not yet promoted to `system/`
- `BENCHMARK — promoted` → Written to `system/`, includes target path and date
- `BENCHMARK — rejected` → Reviewed, determined to be too issue-specific to promote

## Format in Card benchmarks.md

Each entry in a card's `benchmarks.md` should follow this format:

```
---
date: YYYY-MM-DD
session: claude / gemini / manual
finding: Short description of what was learned
target: system/known-behaviors/example-filename.md
status: pending | promoted | rejected
---
```

## Promotion Lifecycle

1. Finding made during issue analysis
2. Determine: is this specific to this issue only? If yes, log in `trace.md` only.
3. If it reveals something about system behavior, schema design, or service interaction → tag in `benchmarks.md` as `BENCHMARK — pending`
4. Identify target: `system/known-behaviors/`, `system/services/`, `system/schemas/`, or `system/architecture/`
5. Write or append to the target `system/` file
6. Mark `benchmarks.md` entry as `BENCHMARK — promoted` with file path and date
7. Commit `system/` to Git

> **Sweep at close.** Before filing a card under `done/` or `archive/`, re-read its `trace.md` and run
> steps 3–6 on any benchmark-worthy finding that was never tagged. Findings logged only in the trace
> must not be lost. The sweep only reads the trace.
