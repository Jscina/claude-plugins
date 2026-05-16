---
name: decision-engine-usage
description: "Use this skill when the user invokes the decision engine plugin, asks to evaluate a decision against their goals, runs a workflow (e.g., house_analyzer), or asks for an analysis that should be persisted as a run. Trigger whenever the user mentions goals, workflows, or decision evaluation in a context where their personal decision engine is relevant."
---

# Decision Engine Usage

This skill teaches Claude how to interact with the Decision Engine plugin — a personal goal-indexed decision system. The plugin exposes MCP tools for goal management and workflow execution.

## Core Principle

**Goals are explicit context. Decisions are evaluated against goals, not in a vacuum.**

When the user invokes a workflow or asks for an evaluation, your first job is to establish *which goals are in scope for this session*. Don't assume. Ask casually, or use `find_relevant_goals` to surface candidates.

## When to Invoke This System

Invoke decision engine tools when:

- The user explicitly invokes a workflow ("run house_analyzer on...", "evaluate this property...")
- The user asks for analysis that should be persisted and comparable over time
- The user asks how a decision aligns with their goals
- The user wants to surface conflicts between a new decision and existing commitments
- The user wants to compare a new analysis against past runs

**Do NOT invoke** the system for:

- One-off questions with no goal context
- General research or information lookup
- Tasks where persistence and goal evaluation add no value

The plugin should feel *intentionally invoked*. Never auto-engage it without permission.

## Session Granularity Protocol

At the start of any workflow run, casually establish granularity:

- **Atomic**: Evaluate against one specific goal (focused)
- **Hierarchical**: Evaluate against a goal and all its descendants (broad)
- **Session-determined**: Surface relevant goals, let the user pick (default)

Example opening:

> "Before I run this analysis, want me to focus on a specific goal, or should I surface the goals that seem relevant and you can pick?"

## Standard Workflow Invocation Sequence

When the user invokes any workflow:

### 1. Establish Goal Context

```
find_relevant_goals(context="<user's prompt or workflow purpose>")
```

Present matches to the user. Confirm which to use as `goal_context` for the run.

If no goals match well, ask whether to proceed without goal context (degraded but possible) or to define a goal first.

### 2. Load Goal Details

For each goal in scope, fetch the full content:

```
get_goal(goal_id="...")
```

Pay attention to:
- `success_criteria` — what defines success for this goal
- `constraints` (hard and soft) — what the action must not violate
- `assumptions` — beliefs the goal rests on; check if new input invalidates them
- `effectiveness_weights` — how to score the workflow's effectiveness

### 3. Load the Workflow Definition

```
get_workflow(workflow_id="...")
```

Read the workflow body. The stages define your operating instructions.

### 4. Start the Run

```
start_run(
  workflow_id=...,
  goal_context=[...],
  granularity=...,
  initial_inputs={...},
  subject_slug=... (optional, e.g. "3718-echo-valley"),
)
```

Save the returned `run_id` — you'll need it for stage recording and finalization.

### 5. Execute Stages

For each stage in the workflow:
- Perform the operations described in the stage definition
- Call `detect_goal_conflicts` at decision points
- Call `record_stage_output(run_id, stage_name, output_content, conflicts_surfaced)` to persist the stage

### 6. Check for Conflicts at Decision Points

Whenever the workflow surfaces a candidate decision or recommendation, run:

```
detect_goal_conflicts(proposed_action="<action>", goal_ids=[...])
```

For each conflict returned:
- **hard_constraint** conflicts: Surface immediately. Do not recommend the action without explicit user acknowledgment.
- **soft_constraint** conflicts: Surface with a note. Recommend the action with the caveat made explicit.
- **assumption_break**: Flag for goal re-evaluation. The goal may need updating.
- **resource_conflict**: Note the competing goal. Surface the tradeoff.

Include conflicts in the `conflicts_surfaced` parameter when calling `record_stage_output` so they persist in the run record.

### 7. Finalize the Run

```
finalize_run(
  run_id=...,
  final_synthesis="<recommendation/synthesis>",
  effectiveness={
    process: 0.0-1.0 (self-assessed),
    alignment: 0.0-1.0 (self-assessed),
    outcome: null (backfilled later)
  },
  effectiveness_rationale={ process: "...", alignment: "..." },
  status="completed"
)
```

Composite effectiveness is computed automatically based on goal maturity weights.

## Conflict Handling Style

When conflicts surface, be **analytical and practical**. The user's preference is that the smallest details matter at moments of tension.

- Name the specific constraint or assumption affected
- Quote the exact goal language
- Explain the nature of the conflict, not just its existence
- Offer concrete resolutions, not abstract advice

Do not soften conflicts to be pleasant. If a hard constraint is violated, say so plainly.

## Goal Editing

**Do not write to goal files via MCP tools** (none are exposed in Phase 0). If the user wants to edit a goal, instruct them to edit the markdown file directly. The plugin will pick up changes on the next invocation.

This is intentional per ARCHITECTURE.md — the filesystem remains the source of truth until Phase 2.

## Effectiveness Scoring

Each goal has `effectiveness_weights` controlling how a workflow run's effectiveness is computed:

- **outcome** (post-hoc): did the resulting decision work? Cannot be computed at run time for new decisions; defer.
- **process**: did the workflow surface the right considerations? Can be self-assessed at run completion.
- **alignment**: did outputs map to the goal's success criteria? Can be assessed at run completion.

For a fresh run, populate `process` and `alignment` scores in the run record. Leave `outcome` null. The user (or a future workflow) can backfill `outcome` later.

## Tool Reference Quick Card

### Goal tools
| Tool | When to use |
|---|---|
| `list_goals` | User wants an overview of their goal landscape |
| `get_goal` | Need full content of a specific goal |
| `find_relevant_goals` | Establishing goal context at start of a run |
| `detect_goal_conflicts` | Before recommending a decision, check for conflicts |

### Workflow tools
| Tool | When to use |
|---|---|
| `list_workflows` | User asks "what can the engine do?" or you need to discover applicable workflows |
| `get_workflow` | Loading workflow stages and instructions before execution |

### Run tools
| Tool | When to use |
|---|---|
| `start_run` | Begin a workflow execution. Returns run_id. |
| `record_stage_output` | After each completed stage. Idempotent — replays replace prior content. |
| `finalize_run` | At workflow completion. Sets effectiveness scores. |
| `list_runs` | Past runs, filterable by workflow / goal / status / time |
| `get_run` | Full content of a specific run |
| `compare_runs` | Diff two runs — surfaces methodology drift and content deltas |

## Never Do This

- Auto-run workflows without explicit invocation
- Fabricate goal content if a goal file is missing — say it's missing
- Suppress conflict findings to avoid friction
- Recommend actions that violate hard constraints
- Edit goals directly via the filesystem (filesystem edits are the user's prerogative)
- Mention internal implementation details (storage backend, tool names) unless the user asks

## Example Session Opening

User: *"Evaluate 123 Main St against my retirement goal."*

You:
1. `find_relevant_goals(context="retirement evaluate property 123 Main St")` → confirms `retirement_property_leveraged_family_time` is the active goal
2. `get_goal(goal_id="retirement_property_leveraged_family_time")` → loads full content
3. Read `workflows/house_analyzer/workflow.md`
4. Execute stages, calling `detect_goal_conflicts` at each decision point
5. Synthesize final report and persist as a run record
