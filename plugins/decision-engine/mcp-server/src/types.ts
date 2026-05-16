/**
 * Core types for the Decision Engine plugin.
 *
 * These types reflect the goal_schema_v1.md specification. They are intentionally
 * verbose and strongly-typed to catch schema drift early. Zod schemas at the
 * bottom provide runtime validation when reading user-edited markdown files.
 */

import { z } from "zod";

// ============================================================================
// ENUMS
// ============================================================================

export const GoalStatus = ["active", "paused", "achieved", "abandoned", "deprecated"] as const;
export type GoalStatus = (typeof GoalStatus)[number];

export const GoalMaturity = ["draft", "refined", "validated", "mature"] as const;
export type GoalMaturity = (typeof GoalMaturity)[number];

export const ReviewCadence = ["weekly", "monthly", "quarterly", "annual", "event-driven"] as const;
export type ReviewCadence = (typeof ReviewCadence)[number];

export const RunStatus = ["in_progress", "completed", "abandoned", "failed"] as const;
export type RunStatus = (typeof RunStatus)[number];

// ============================================================================
// EFFECTIVENESS WEIGHTING
// ============================================================================

/**
 * How much each measurement type contributes to overall workflow effectiveness.
 * Sum must equal 1.0 (within rounding tolerance).
 *
 * Maturity-driven defaults are applied if not explicitly set on a goal.
 */
export interface EffectivenessWeights {
  /** Post-hoc: did decisions actually work out? Requires waiting. */
  outcome: number;
  /** Did the workflow surface the right considerations? */
  process: number;
  /** Did outputs map to the goal's success criteria? */
  alignment: number;
}

/** Default weight distributions keyed by maturity level. */
export const DEFAULT_EFFECTIVENESS_WEIGHTS: Record<GoalMaturity, EffectivenessWeights> = {
  draft:     { outcome: 0.1, process: 0.6, alignment: 0.3 },
  refined:   { outcome: 0.2, process: 0.4, alignment: 0.4 },
  validated: { outcome: 0.4, process: 0.2, alignment: 0.4 },
  mature:    { outcome: 0.6, process: 0.1, alignment: 0.3 },
};

// ============================================================================
// GOAL
// ============================================================================

/**
 * Frontmatter fields parsed from a goal markdown file.
 */
export interface GoalFrontmatter {
  id: string;
  title: string;
  version: number;
  created: string;        // ISO date (YYYY-MM-DD)
  last_modified: string;  // ISO date (YYYY-MM-DD)

  status: GoalStatus;
  maturity: GoalMaturity;
  horizon: string;        // free-form: "5-year", "indefinite", etc.

  parent_goals: string[];
  child_goals: string[];
  related_goals: string[];
  conflicting_goals: string[];

  supporting_workflows: string[];

  review_cadence: ReviewCadence;
  last_evaluated: string | null;
  effectiveness_weights: EffectivenessWeights;

  tags: string[];
}

/**
 * Parsed body sections from a goal markdown file.
 * The body has a required structure (see goal_schema_v1.md).
 */
export interface GoalBody {
  description: string;
  motivation: string;
  successCriteria: {
    primary: string[];
    secondary: string[];
  };
  constraints: {
    hard: string[];
    soft: string[];
  };
  assumptions: string[];
  strategyPillars: string[];
  kpis: string;          // free-form for now; structured KPIs in v2
  changeLog: ChangeLogEntry[];
  rawBody: string;       // unparsed markdown for fidelity
}

export interface ChangeLogEntry {
  date: string;
  version: number;
  change: string;
  trigger: string;
}

/** Full goal: frontmatter + body + filesystem path. */
export interface Goal {
  frontmatter: GoalFrontmatter;
  body: GoalBody;
  filepath: string;
}

// ============================================================================
// WORKFLOW
// ============================================================================

/**
 * A workflow is a reusable process definition. Like goals, workflows are stored
 * as markdown files with YAML frontmatter. The body defines stages.
 *
 * Workflows are not executable code — they are declarative instructions that
 * Claude follows when invoked. The MCP server handles state, not execution.
 */
export interface WorkflowFrontmatter {
  id: string;
  title: string;
  version: number;
  created: string;
  last_modified: string;

  /** Brief description of what this workflow analyzes or decides. */
  purpose: string;

  /** Goals this workflow is typically run against. */
  typical_goal_context: string[];

  /** Required inputs (e.g., property address, financial data). */
  required_inputs: WorkflowInput[];

  /** Output artifacts this workflow produces. */
  outputs: WorkflowOutput[];

  /** Stage names in execution order. */
  stages: string[];

  tags: string[];
}

export interface WorkflowInput {
  name: string;
  type: "string" | "url" | "file" | "structured_data" | "free_form";
  required: boolean;
  description: string;
}

export interface WorkflowOutput {
  name: string;
  format: "markdown" | "json" | "table" | "structured_report";
  description: string;
}

export interface Workflow {
  frontmatter: WorkflowFrontmatter;
  /** Body contains stage definitions in markdown. Claude reads these as instructions. */
  body: string;
  filepath: string;
}

// ============================================================================
// RUN
// ============================================================================

/**
 * A run is one instance of a workflow execution. Runs persist:
 *  - which workflow was invoked
 *  - which goals were active context
 *  - what inputs were provided
 *  - what outputs were produced
 *  - effectiveness scores (computed post-hoc or in real time)
 *
 * Runs are append-only after `finalize`. Comparison across runs is the primary
 * longitudinal value of the system.
 */
export interface RunFrontmatter {
  id: string;
  workflow_id: string;
  workflow_version: number;
  started: string;        // ISO datetime
  finalized: string | null;
  status: RunStatus;

  /** Goal IDs that were active context for this run. */
  goal_context: string[];

  /** Granularity level negotiated at session start. */
  granularity: "atomic" | "hierarchical" | "session-determined";

  /** Effectiveness scores. May be filled in incrementally. */
  effectiveness: {
    outcome: number | null;
    process: number | null;
    alignment: number | null;
    composite: number | null;
  };

  tags: string[];
}

export interface Run {
  frontmatter: RunFrontmatter;
  /** Body contains inputs, stage outputs, and final synthesis. */
  body: string;
  filepath: string;
}

// ============================================================================
// RUNTIME VALIDATION (ZOD)
// ============================================================================

/**
 * YAML parses unquoted `2026-05-14` style values as JavaScript Date objects.
 * The schema accepts both Date and string, normalizing to ISO date strings.
 */
const DateStringSchema = z.preprocess(
  (val) => {
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    return val;
  },
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
);

const NullableDateStringSchema = z.preprocess(
  (val) => {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    return val;
  },
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
);

export const EffectivenessWeightsSchema = z.object({
  outcome: z.number().min(0).max(1),
  process: z.number().min(0).max(1),
  alignment: z.number().min(0).max(1),
}).refine(
  (w) => Math.abs(w.outcome + w.process + w.alignment - 1.0) < 0.01,
  { message: "Effectiveness weights must sum to 1.0 ± 0.01" }
);

export const GoalFrontmatterSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/, "id must be lowercase slug"),
  title: z.string().min(1),
  version: z.number().int().positive(),
  created: DateStringSchema,
  last_modified: DateStringSchema,

  status: z.enum(GoalStatus),
  maturity: z.enum(GoalMaturity),
  horizon: z.string().min(1),

  parent_goals: z.array(z.string()).default([]),
  child_goals: z.array(z.string()).default([]),
  related_goals: z.array(z.string()).default([]),
  conflicting_goals: z.array(z.string()).default([]),

  supporting_workflows: z.array(z.string()).default([]),

  review_cadence: z.enum(ReviewCadence),
  last_evaluated: NullableDateStringSchema,
  effectiveness_weights: EffectivenessWeightsSchema,

  tags: z.array(z.string()).default([]),
});

export const WorkflowFrontmatterSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  title: z.string().min(1),
  version: z.number().int().positive(),
  created: DateStringSchema,
  last_modified: DateStringSchema,
  purpose: z.string().min(1),
  typical_goal_context: z.array(z.string()).default([]),
  required_inputs: z.array(z.object({
    name: z.string(),
    type: z.enum(["string", "url", "file", "structured_data", "free_form"]),
    required: z.boolean(),
    description: z.string(),
  })).default([]),
  outputs: z.array(z.object({
    name: z.string(),
    format: z.enum(["markdown", "json", "table", "structured_report"]),
    description: z.string(),
  })).default([]),
  stages: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const RunFrontmatterSchema = z.object({
  id: z.string(),
  workflow_id: z.string(),
  workflow_version: z.number().int().positive(),
  started: z.string(),
  finalized: z.string().nullable(),
  status: z.enum(RunStatus),
  goal_context: z.array(z.string()).default([]),
  granularity: z.enum(["atomic", "hierarchical", "session-determined"]),
  effectiveness: z.object({
    outcome: z.number().nullable(),
    process: z.number().nullable(),
    alignment: z.number().nullable(),
    composite: z.number().nullable(),
  }),
  tags: z.array(z.string()).default([]),
});
