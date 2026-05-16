# Goal Schema Specification v1

**Project**: Personal Decision Engine Plugin
**Schema Version**: 1.0
**Date**: 2026-05-14
**Status**: Initial draft

---

## Purpose

This schema defines the structure of a **Goal** — a first-class object representing a long-term objective that can be queried, evaluated against new inputs, and used as context for workflow runs.

## Design Principles

1. **Human-readable first**: Files should be openable, editable, and reviewable in any text editor without tooling
2. **Migration-friendly**: Markdown + YAML frontmatter parses cleanly into SQLite/Postgres later without schema rewrites
3. **Self-contained**: Each goal file is independently meaningful; references to other goals are by ID, not embedded
4. **Versioned**: Changes are explicit, auditable, and reversible
5. **Maturity-aware**: Evaluation behavior adapts to how well-developed the goal is

## File Format

- **Storage**: Filesystem (per "least demanding strategy" decision)
- **Path convention**: `~/.decision-engine/goals/<goal_id>.md`
- **Format**: Markdown with YAML frontmatter
- **Index layer**: SQLite index (added when query performance demands it)

## Schema Definition

### Frontmatter (Required)

```yaml
---
# === IDENTITY ===
id: <slug>                        # Unique identifier (lowercase, underscores)
title: <string>                   # Human-readable title
version: <integer>                # Monotonically increasing on substantive change
created: <YYYY-MM-DD>             # Initial creation date
last_modified: <YYYY-MM-DD>       # Last substantive change

# === STATUS ===
status: <enum>                    # active | paused | achieved | abandoned | deprecated
maturity: <enum>                  # draft | refined | validated | mature
horizon: <string>                 # e.g. "20-year", "5-year", "indefinite"

# === RELATIONS ===
parent_goals: [<id>, ...]         # Goals this serves
child_goals: [<id>, ...]          # Goals nested under this
related_goals: [<id>, ...]        # Lateral connections
conflicting_goals: [<id>, ...]    # Known tensions to manage

# === WORKFLOWS ===
supporting_workflows: [<id>, ...] # Workflows that typically advance this goal

# === EVALUATION ===
review_cadence: <enum>            # weekly | monthly | quarterly | annual | event-driven
last_evaluated: <YYYY-MM-DD>      # null if never evaluated
effectiveness_weights:            # How much each measure contributes (sums to 1.0)
  outcome: <float>                # Post-hoc: did decisions work out?
  process: <float>                # Did the workflow surface right considerations?
  alignment: <float>              # Did outputs map to success criteria?

# === METADATA ===
tags: [<string>, ...]             # Free-form categorization
---
```

### Body (Required Sections)

The markdown body has required sections in a fixed order to allow programmatic parsing:

```markdown
## Description

[1-3 paragraphs: what the goal is, in plain language]

## Motivation

[1-3 paragraphs: why this goal exists, what life or values it serves]

## Success Criteria

### Primary
- [Measurable outcome 1]
- [Measurable outcome 2]
- ...

### Secondary
- [Soft outcome 1]
- ...

## Constraints

### Hard (non-negotiable)
- [Constraint 1]
- ...

### Soft (preference, can be relaxed)
- [Constraint 1]
- ...

## Assumptions

[Bulleted list of beliefs the goal rests on. When an assumption breaks, re-evaluate goal.]

## Strategy Pillars

1. [Pillar 1 name and brief description]
2. [Pillar 2 name and brief description]
...

## KPIs

[Quantitative metrics with target trajectories where applicable]

## Change Log

| Date | Version | Change | Trigger |
|---|---|---|---|
| YYYY-MM-DD | 1 | Initial draft | [What caused creation] |
```

## Field Semantics

### `maturity` (drives evaluation weighting)

| Level | Meaning | Effectiveness Weight Bias |
|---|---|---|
| `draft` | Just captured; rough; may have errors | Process-heavy (did we even ask right questions?) |
| `refined` | Reviewed and edited; success criteria clarified | Process + Alignment balanced |
| `validated` | Some real evidence; KPIs being tracked | Alignment-heavy |
| `mature` | Sustained track record; outcomes observable | Outcome-heavy |

**Default weight distributions:**

```yaml
draft:     { outcome: 0.1, process: 0.6, alignment: 0.3 }
refined:   { outcome: 0.2, process: 0.4, alignment: 0.4 }
validated: { outcome: 0.4, process: 0.2, alignment: 0.4 }
mature:    { outcome: 0.6, process: 0.1, alignment: 0.3 }
```

### `status`

| Value | Meaning |
|---|---|
| `active` | Currently driving decisions |
| `paused` | Temporarily set aside, may resume |
| `achieved` | Success criteria met; archived for reference |
| `abandoned` | Intentionally stopped; reasons documented in change log |
| `deprecated` | Superseded by another goal (referenced via `related_goals`) |

### `horizon`

Free-form string. Common values: `"1-year"`, `"5-year"`, `"10-year"`, `"20-year"`, `"indefinite"`, `"life"`. Used for review cadence guidance and for sorting near-term vs long-term goals during evaluation.

### Relations (`parent_goals`, `child_goals`, `related_goals`, `conflicting_goals`)

All reference other goal IDs. Bidirectional links should be enforced by the plugin (if A lists B as parent, B should list A as child). The plugin should detect and offer to repair broken references.

## Conflict Detection

When a new input is evaluated against existing goals, the plugin checks for:

1. **Direct conflicts**: New action violates a `hard` constraint of an existing goal
2. **Soft conflicts**: New action violates a `soft` constraint
3. **Assumption breaks**: New input invalidates an `assumption` of an existing goal
4. **Resource conflicts**: New action competes with goals listed in `conflicting_goals`
5. **Time conflicts**: New action's commitment doesn't fit `horizon` of existing goals

For each conflict type, the plugin should surface:
- Which goal(s) are affected
- The nature of the conflict
- Suggested resolutions (modify goal, modify action, defer one)

## Workflow Run Reference

A goal does NOT directly store workflow run results. Instead, workflow runs reference the goal in their own metadata. This keeps goal files clean and allows runs to accumulate without bloating goal documents.

The plugin can query: "show me all runs that referenced goal X in the last 6 months" via the SQLite index layer.

## Versioning Rules

- Increment `version` on any change to: success_criteria, constraints, assumptions, strategy_pillars, or hard re-scoping
- Do NOT increment for: typo fixes, clarifications, change_log additions
- Each version increment must add a row to the change log
- Old versions are preserved via git, not in the file itself

## Validation Checklist

A well-formed goal file:

- [ ] Has all required frontmatter fields
- [ ] Has all required body sections in correct order
- [ ] References to other goals all resolve to existing files
- [ ] `effectiveness_weights` sum to 1.0 ± 0.01
- [ ] Success criteria are measurable (or marked as soft/qualitative)
- [ ] At least one strategy pillar exists
- [ ] Change log has at least one entry (the initial draft)

## Open Questions (for v2)

These were deliberately deferred:

1. **Quantitative KPI schema**: Currently free-form text. Future: structured `kpis:` block in frontmatter with target trajectories, units, current values.
2. **Goal templates**: Reusable shells for common goal types (financial, health, learning, etc.)
3. **Stakeholders**: Currently implicit (just "you"). Future: named stakeholders with consent/approval status (e.g., Joy must approve goals affecting household).
4. **Evaluation history**: Where do past evaluation scores live? Probably in run records, but might need a summary on the goal itself.
5. **Deprecation chains**: When goal A is superseded by goal B, how do we surface that gracefully?

---

*Schema v1 — see retirement goal example for first instance*
