# System Knowledge

This directory contains long-term, versioned knowledge about the system. Everything here should be **durable** — it describes how the system works, not how a specific issue was investigated.

## What Belongs Here

| Subfolder | Contents |
|---|---|
| `architecture/` | Repo maps, integration topology, deployment layout |
| `schemas/` | DDL summaries, table relationships, known schema quirks |
| `services/` | Per-service behavior docs, config edge cases, controller quirks |
| `known-behaviors/` | Promoted findings from issue investigations — confirmed system gotchas |

## Format Standards

Each file in `system/` opens with a YAML **frontmatter** header (file-level, machine-parseable
metadata) followed by the body. Provenance is **hybrid**: the header aggregates it for the whole
file, while each finding keeps its own `**Source**` line — a single file often gathers findings from
several cards.

```markdown
---
title: [Topic Title — mirrors the H1]
domain: [known-behaviors | services | schemas | architecture]
source_cards: [CARD-XXXXX]
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active
tags: []
---

# [Topic Title]

## Overview
Brief description of what this file covers.

## [Section per finding or topic]
**Source**: CARD-XXXXX | YYYY-MM-DD  (if promoted from an issue)
**Finding**: What was learned
**Impact**: What this affects going forward
```

Files promoted from issue cards should always include the source card ID — both in `source_cards`
(file level) and in the section's `**Source**` line (finding level) — so findings remain traceable.

## Update Policy

- **Add** when a benchmark moment is promoted from an issue card
- **Update** when new investigation refines or corrects existing knowledge
- **Never delete** without moving to an archive or leaving a deprecation note
- **Always commit** changes to Git after updates
