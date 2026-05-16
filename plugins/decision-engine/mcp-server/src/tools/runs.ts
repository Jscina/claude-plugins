/**
 * MCP tool definitions for workflow run operations.
 *
 * Runs are the longitudinal value of the system. Every workflow execution
 * creates a run record that captures: workflow + version, goal context,
 * inputs, stage outputs, synthesis, and effectiveness scores.
 *
 * Unlike goals and workflows, RUNS ARE WRITABLE through these tools. They are
 * append-only records — the agent calls start_run, record_stage_output N
 * times, then finalize_run. After finalization, the run is immutable.
 *
 * Comparing runs across instances of the same workflow is how methodology
 * drift gets detected.
 */

import { join } from "node:path";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Storage } from "../storage/filesystem.js";
import {
  DEFAULT_EFFECTIVENESS_WEIGHTS,
  type Run,
  type RunFrontmatter,
  type GoalMaturity,
} from "../types.js";

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const runToolDefinitions: Tool[] = [
  {
    name: "start_run",
    description:
      "Begin a new workflow run. Creates a run record with a unique ID, captures the workflow, goal context, granularity, and initial inputs. " +
      "Call this AFTER you have confirmed which workflow to execute and which goals are in scope, BEFORE executing any stages. " +
      "Returns the run_id to use for subsequent record_stage_output and finalize_run calls.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: {
          type: "string",
          description: "The workflow being executed (e.g., 'house_analyzer')",
        },
        goal_context: {
          type: "array",
          items: { type: "string" },
          description: "Goal IDs that are active context for this run",
        },
        granularity: {
          type: "string",
          enum: ["atomic", "hierarchical", "session-determined"],
          description: "Granularity level negotiated with the user at session start",
        },
        initial_inputs: {
          type: "object",
          description: "Inputs to the workflow (e.g., property address, listing data). Keys should match the workflow's required_inputs.",
        },
        subject_slug: {
          type: "string",
          description: "Optional short identifier for the subject of this run (e.g., '3718-echo-valley'). Used in the run_id for human readability.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags for this run",
        },
      },
      required: ["workflow_id", "goal_context", "granularity", "initial_inputs"],
    },
  },
  {
    name: "record_stage_output",
    description:
      "Append the output of a completed workflow stage to an in-progress run. " +
      "Call once per stage as you execute the workflow. The output should be the substantive content of the stage (analysis, findings, recommendations) in markdown. " +
      "Idempotent: calling twice for the same stage replaces the prior content rather than duplicating.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: {
          type: "string",
          description: "The run ID returned by start_run",
        },
        stage_name: {
          type: "string",
          description: "The stage being recorded (e.g., 'market_analysis'). Should match a stage from the workflow's stages list.",
        },
        output_content: {
          type: "string",
          description: "Markdown content with the stage's findings, analysis, and outputs",
        },
        conflicts_surfaced: {
          type: "array",
          description: "Optional list of conflicts surfaced during this stage (from detect_goal_conflicts)",
          items: {
            type: "object",
            properties: {
              goal_id: { type: "string" },
              conflict_type: { type: "string" },
              conflict_detail: { type: "string" },
              severity: { type: "string" },
              resolution: { type: "string", description: "How the conflict was resolved or noted" },
            },
          },
        },
      },
      required: ["run_id", "stage_name", "output_content"],
    },
  },
  {
    name: "finalize_run",
    description:
      "Mark a run as complete (or abandoned/failed) and record effectiveness scores. " +
      "Call this AFTER all stages have been recorded and the synthesis is done. " +
      "Once finalized, the run is immutable in spirit (the markdown file can still be edited, but the tools won't modify it). " +
      "Outcome score should be null unless enough time has passed to assess real-world results — typically set later by a backfill workflow.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: {
          type: "string",
          description: "The run ID to finalize",
        },
        final_synthesis: {
          type: "string",
          description: "Final synthesis/recommendation produced by the workflow. Written to a 'Synthesis' section in the run body.",
        },
        effectiveness: {
          type: "object",
          description: "Effectiveness scores in [0, 1]. Set outcome to null for fresh runs.",
          properties: {
            process: {
              type: ["number", "null"],
              description: "Did the workflow surface the right considerations for this case? Self-assessed at completion.",
            },
            alignment: {
              type: ["number", "null"],
              description: "Did outputs map to the goals' success criteria? Self-assessed at completion.",
            },
            outcome: {
              type: ["number", "null"],
              description: "Post-hoc: did the resulting decision work out? Null for fresh runs.",
            },
          },
        },
        effectiveness_rationale: {
          type: "object",
          description: "Optional plain-language rationale for the scores",
          properties: {
            process: { type: "string" },
            alignment: { type: "string" },
            outcome: { type: "string" },
          },
        },
        status: {
          type: "string",
          enum: ["completed", "abandoned", "failed"],
          description: "Final status. Default: completed.",
        },
      },
      required: ["run_id", "effectiveness"],
    },
  },
  {
    name: "list_runs",
    description:
      "List past workflow runs, optionally filtered. " +
      "Use this when the user asks about past evaluations, wants to compare against prior runs, or wants to review effectiveness trends over time.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: {
          type: "string",
          description: "Filter to runs of a specific workflow",
        },
        goal_id: {
          type: "string",
          description: "Filter to runs whose goal_context includes this goal",
        },
        status: {
          type: "string",
          enum: ["in_progress", "completed", "abandoned", "failed"],
          description: "Filter by run status",
        },
        since: {
          type: "string",
          description: "ISO datetime — only return runs started after this time",
        },
      },
    },
  },
  {
    name: "get_run",
    description:
      "Retrieve the full content of a specific run, including all stage outputs and synthesis. " +
      "Use this when you need to reference past analysis in detail (e.g., for comparison).",
    inputSchema: {
      type: "object",
      properties: {
        run_id: {
          type: "string",
          description: "The run ID to retrieve",
        },
      },
      required: ["run_id"],
    },
  },
  {
    name: "compare_runs",
    description:
      "Compare two runs side-by-side. Both runs must be from the same workflow for the comparison to be meaningful. " +
      "Returns structured comparison: workflow version delta (methodology drift), goal context overlap, effectiveness scores, and stage-by-stage content. " +
      "The LLM interprets the content deltas; this tool surfaces the structured data.",
    inputSchema: {
      type: "object",
      properties: {
        run_id_a: { type: "string", description: "First run ID" },
        run_id_b: { type: "string", description: "Second run ID" },
      },
      required: ["run_id_a", "run_id_b"],
    },
  },
];

// ============================================================================
// TOOL HANDLERS
// ============================================================================

export class RunToolHandlers {
  constructor(
    private readonly storage: Storage,
    private readonly root: string
  ) {}

  async startRun(args: {
    workflow_id: string;
    goal_context: string[];
    granularity: "atomic" | "hierarchical" | "session-determined";
    initial_inputs: Record<string, unknown>;
    subject_slug?: string;
    tags?: string[];
  }): Promise<{ run_id: string; filepath: string } | { error: string }> {
    // Verify the workflow exists
    const workflow = await this.storage.getWorkflow(args.workflow_id);
    if (!workflow) {
      return { error: `Workflow not found: ${args.workflow_id}` };
    }

    // Verify each goal exists; warn (don't fail) on misses
    const missingGoals: string[] = [];
    for (const goalId of args.goal_context) {
      const exists = await this.storage.goalExists(goalId);
      if (!exists) missingGoals.push(goalId);
    }

    const now = new Date();
    const runId = generateRunId(now, args.workflow_id, args.subject_slug);
    const filepath = join(this.root, "runs", `${runId}.md`);

    const frontmatter: RunFrontmatter = {
      id: runId,
      workflow_id: args.workflow_id,
      workflow_version: workflow.frontmatter.version,
      started: now.toISOString(),
      finalized: null,
      status: "in_progress",
      goal_context: args.goal_context,
      granularity: args.granularity,
      effectiveness: {
        outcome: null,
        process: null,
        alignment: null,
        composite: null,
      },
      tags: args.tags ?? [],
    };

    const body = buildInitialRunBody(workflow.frontmatter.title, args.initial_inputs, missingGoals);

    const run: Run = { frontmatter, body, filepath };
    await this.storage.saveRun(run);

    return { run_id: runId, filepath };
  }

  async recordStageOutput(args: {
    run_id: string;
    stage_name: string;
    output_content: string;
    conflicts_surfaced?: Array<{
      goal_id: string;
      conflict_type: string;
      conflict_detail: string;
      severity: string;
      resolution?: string;
    }>;
  }): Promise<{ success: true; stages_recorded: string[] } | { error: string }> {
    const run = await this.storage.getRun(args.run_id);
    if (!run) {
      return { error: `Run not found: ${args.run_id}` };
    }

    if (run.frontmatter.status !== "in_progress") {
      return { error: `Run ${args.run_id} is not in_progress (status: ${run.frontmatter.status})` };
    }

    const stageHeader = `### Stage: ${args.stage_name}`;
    const conflictsSection = formatConflictsSection(args.conflicts_surfaced);
    const newStageBlock = `${stageHeader}\n\n${args.output_content.trim()}\n${conflictsSection}`;

    const updatedBody = replaceOrAppendStage(run.body, args.stage_name, newStageBlock);

    const updatedRun: Run = {
      ...run,
      body: updatedBody,
    };

    await this.storage.saveRun(updatedRun);

    return {
      success: true,
      stages_recorded: extractRecordedStages(updatedBody),
    };
  }

  async finalizeRun(args: {
    run_id: string;
    final_synthesis?: string;
    effectiveness: {
      process: number | null;
      alignment: number | null;
      outcome: number | null;
    };
    effectiveness_rationale?: {
      process?: string;
      alignment?: string;
      outcome?: string;
    };
    status?: "completed" | "abandoned" | "failed";
  }): Promise<{ success: true; run_id: string; composite_effectiveness: number | null } | { error: string }> {
    const run = await this.storage.getRun(args.run_id);
    if (!run) {
      return { error: `Run not found: ${args.run_id}` };
    }

    if (run.frontmatter.status !== "in_progress") {
      return { error: `Run ${args.run_id} is already finalized (status: ${run.frontmatter.status})` };
    }

    // Compute composite effectiveness using goal maturity-weighted defaults.
    // For multi-goal runs we average the weight profiles across all goals.
    const composite = await this.computeComposite(run, args.effectiveness);

    const finalizedFrontmatter: RunFrontmatter = {
      ...run.frontmatter,
      finalized: new Date().toISOString(),
      status: args.status ?? "completed",
      effectiveness: {
        outcome: args.effectiveness.outcome,
        process: args.effectiveness.process,
        alignment: args.effectiveness.alignment,
        composite,
      },
    };

    let updatedBody = run.body;
    if (args.final_synthesis) {
      updatedBody = upsertSection(updatedBody, "## Synthesis", args.final_synthesis.trim());
    }
    updatedBody = upsertSection(
      updatedBody,
      "## Effectiveness",
      formatEffectivenessSection(args.effectiveness, args.effectiveness_rationale, composite)
    );

    const finalizedRun: Run = {
      ...run,
      frontmatter: finalizedFrontmatter,
      body: updatedBody,
    };

    await this.storage.saveRun(finalizedRun);

    return {
      success: true,
      run_id: args.run_id,
      composite_effectiveness: composite,
    };
  }

  async listRuns(args: {
    workflow_id?: string;
    goal_id?: string;
    status?: RunFrontmatter["status"];
    since?: string;
  }): Promise<{
    runs: Array<{
      id: string;
      workflow_id: string;
      workflow_version: number;
      started: string;
      finalized: string | null;
      status: string;
      goal_context: string[];
      composite_effectiveness: number | null;
      tags: string[];
    }>;
  }> {
    const runs = await this.storage.listRuns(args);
    runs.sort((a, b) => b.frontmatter.started.localeCompare(a.frontmatter.started));

    return {
      runs: runs.map((r) => ({
        id: r.frontmatter.id,
        workflow_id: r.frontmatter.workflow_id,
        workflow_version: r.frontmatter.workflow_version,
        started: r.frontmatter.started,
        finalized: r.frontmatter.finalized,
        status: r.frontmatter.status,
        goal_context: r.frontmatter.goal_context,
        composite_effectiveness: r.frontmatter.effectiveness.composite,
        tags: r.frontmatter.tags,
      })),
    };
  }

  async getRun(args: { run_id: string }): Promise<{ run: Run } | { error: string }> {
    const run = await this.storage.getRun(args.run_id);
    if (!run) return { error: `Run not found: ${args.run_id}` };
    return { run };
  }

  async compareRuns(args: { run_id_a: string; run_id_b: string }): Promise<
    | {
        comparison: {
          same_workflow: boolean;
          workflow_id_a: string;
          workflow_id_b: string;
          workflow_version_a: number;
          workflow_version_b: number;
          methodology_drift_warning: string | null;
          goal_context_a: string[];
          goal_context_b: string[];
          goal_context_overlap: string[];
          goal_context_only_in_a: string[];
          goal_context_only_in_b: string[];
          effectiveness_a: RunFrontmatter["effectiveness"];
          effectiveness_b: RunFrontmatter["effectiveness"];
          stages_in_both: string[];
          stages_only_in_a: string[];
          stages_only_in_b: string[];
          run_a_body: string;
          run_b_body: string;
        };
      }
    | { error: string }
  > {
    const runA = await this.storage.getRun(args.run_id_a);
    const runB = await this.storage.getRun(args.run_id_b);

    if (!runA) return { error: `Run not found: ${args.run_id_a}` };
    if (!runB) return { error: `Run not found: ${args.run_id_b}` };

    const sameWorkflow = runA.frontmatter.workflow_id === runB.frontmatter.workflow_id;
    const methodologyDrift =
      sameWorkflow && runA.frontmatter.workflow_version !== runB.frontmatter.workflow_version
        ? `Runs used different workflow versions (${runA.frontmatter.workflow_version} vs ${runB.frontmatter.workflow_version}). Comparison may not reflect property differences alone.`
        : null;

    const stagesA = new Set(extractRecordedStages(runA.body));
    const stagesB = new Set(extractRecordedStages(runB.body));

    const goalsA = new Set(runA.frontmatter.goal_context);
    const goalsB = new Set(runB.frontmatter.goal_context);

    return {
      comparison: {
        same_workflow: sameWorkflow,
        workflow_id_a: runA.frontmatter.workflow_id,
        workflow_id_b: runB.frontmatter.workflow_id,
        workflow_version_a: runA.frontmatter.workflow_version,
        workflow_version_b: runB.frontmatter.workflow_version,
        methodology_drift_warning: methodologyDrift,
        goal_context_a: runA.frontmatter.goal_context,
        goal_context_b: runB.frontmatter.goal_context,
        goal_context_overlap: [...goalsA].filter((g) => goalsB.has(g)),
        goal_context_only_in_a: [...goalsA].filter((g) => !goalsB.has(g)),
        goal_context_only_in_b: [...goalsB].filter((g) => !goalsA.has(g)),
        effectiveness_a: runA.frontmatter.effectiveness,
        effectiveness_b: runB.frontmatter.effectiveness,
        stages_in_both: [...stagesA].filter((s) => stagesB.has(s)),
        stages_only_in_a: [...stagesA].filter((s) => !stagesB.has(s)),
        stages_only_in_b: [...stagesB].filter((s) => !stagesA.has(s)),
        run_a_body: runA.body,
        run_b_body: runB.body,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /**
   * Composite effectiveness = weighted average of (outcome, process, alignment)
   * where weights are taken from the goal_context's maturity-driven defaults.
   *
   * If multiple goals are in context, weights are averaged across them.
   * Null component scores contribute zero to numerator AND denominator
   * (so the composite reflects only the components actually scored).
   */
  private async computeComposite(
    run: Run,
    eff: { process: number | null; alignment: number | null; outcome: number | null }
  ): Promise<number | null> {
    const maturities: GoalMaturity[] = [];
    for (const goalId of run.frontmatter.goal_context) {
      const g = await this.storage.getGoal(goalId);
      if (g) maturities.push(g.frontmatter.maturity);
    }

    if (maturities.length === 0) return null;

    // Average weights across goals in context.
    const avg = { outcome: 0, process: 0, alignment: 0 };
    for (const m of maturities) {
      const w = DEFAULT_EFFECTIVENESS_WEIGHTS[m];
      avg.outcome += w.outcome;
      avg.process += w.process;
      avg.alignment += w.alignment;
    }
    avg.outcome /= maturities.length;
    avg.process /= maturities.length;
    avg.alignment /= maturities.length;

    // Compute weighted average over non-null components.
    let num = 0;
    let den = 0;
    if (eff.outcome !== null) { num += eff.outcome * avg.outcome; den += avg.outcome; }
    if (eff.process !== null) { num += eff.process * avg.process; den += avg.process; }
    if (eff.alignment !== null) { num += eff.alignment * avg.alignment; den += avg.alignment; }

    if (den === 0) return null;
    return Math.round((num / den) * 100) / 100;
  }
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Run IDs are sortable by start time. Format:
 *   YYYYMMDD_HHmmss_<workflow_id>[_<subject_slug>]
 */
function generateRunId(now: Date, workflowId: string, subjectSlug?: string): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");

  const base = `${yyyy}${mm}${dd}_${hh}${mi}${ss}_${workflowId}`;
  if (!subjectSlug) return base;

  const cleaned = subjectSlug.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
  return `${base}_${cleaned}`;
}

function buildInitialRunBody(
  workflowTitle: string,
  inputs: Record<string, unknown>,
  missingGoals: string[]
): string {
  const lines: string[] = [];
  lines.push(`# Run: ${workflowTitle}`);
  lines.push("");

  if (missingGoals.length > 0) {
    lines.push(`> ⚠️ Goal context references unknown goals: ${missingGoals.join(", ")}. ` +
               "These were declared at start but no file was found.");
    lines.push("");
  }

  lines.push("## Inputs");
  lines.push("");
  for (const [k, v] of Object.entries(inputs)) {
    const renderedValue = typeof v === "string" ? v : JSON.stringify(v, null, 2);
    lines.push(`### ${k}`);
    lines.push("");
    lines.push(renderedValue);
    lines.push("");
  }

  lines.push("## Stages");
  lines.push("");
  lines.push("*Stages are appended via record_stage_output as the workflow executes.*");
  lines.push("");

  return lines.join("\n");
}

/**
 * Insert or replace a stage block under the `## Stages` section.
 * Stage blocks are demarcated by their `### Stage: <name>` heading.
 */
function replaceOrAppendStage(body: string, stageName: string, newBlock: string): string {
  const stageHeading = `### Stage: ${stageName}`;
  const escaped = stageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match the existing stage from its heading up to the next stage heading or section heading.
  const existingRegex = new RegExp(
    `^### Stage: ${escaped}\\s*$[\\s\\S]*?(?=^### Stage: |^## |\\Z)`,
    "m"
  );

  if (existingRegex.test(body)) {
    return body.replace(existingRegex, newBlock.trimEnd() + "\n\n");
  }

  // Append under the Stages section. If no Stages section, create one.
  const stagesSectionRegex = /^## Stages\s*$/m;
  if (stagesSectionRegex.test(body)) {
    // Insert at end of Stages section (before the next ## section or EOF).
    const parts = body.split(/^(## (?!Stages).*?$)/m);
    // Simpler approach: just append at the end of the document if a Synthesis
    // or Effectiveness section doesn't exist yet.
    const hasNextSection = /^## (?:Synthesis|Effectiveness)/m.test(body);
    if (!hasNextSection) {
      return body.trimEnd() + "\n\n" + newBlock + "\n";
    }
    // Insert before Synthesis/Effectiveness.
    return body.replace(
      /^(## (?:Synthesis|Effectiveness))/m,
      newBlock + "\n\n$1"
    );
  }

  return body.trimEnd() + "\n\n## Stages\n\n" + newBlock + "\n";
}

function extractRecordedStages(body: string): string[] {
  const matches = body.matchAll(/^### Stage: (.+?)\s*$/gm);
  return [...matches].map((m) => m[1]!).filter((s): s is string => s !== undefined);
}

function formatConflictsSection(
  conflicts?: Array<{
    goal_id: string;
    conflict_type: string;
    conflict_detail: string;
    severity: string;
    resolution?: string;
  }>
): string {
  if (!conflicts || conflicts.length === 0) return "";

  const lines: string[] = ["", "**Conflicts surfaced:**", ""];
  for (const c of conflicts) {
    lines.push(`- **${c.severity.toUpperCase()}** [${c.conflict_type}] in goal \`${c.goal_id}\`: ${c.conflict_detail}`);
    if (c.resolution) {
      lines.push(`  - Resolution: ${c.resolution}`);
    }
  }
  return lines.join("\n");
}

function formatEffectivenessSection(
  eff: { process: number | null; alignment: number | null; outcome: number | null },
  rationale: { process?: string; alignment?: string; outcome?: string } | undefined,
  composite: number | null
): string {
  const fmt = (n: number | null) => (n === null ? "null" : n.toFixed(2));
  const lines: string[] = [];
  lines.push("| Measure | Score | Rationale |");
  lines.push("|---|---|---|");
  lines.push(`| process | ${fmt(eff.process)} | ${rationale?.process ?? "—"} |`);
  lines.push(`| alignment | ${fmt(eff.alignment)} | ${rationale?.alignment ?? "—"} |`);
  lines.push(`| outcome | ${fmt(eff.outcome)} | ${rationale?.outcome ?? "Pending real-world results"} |`);
  lines.push(`| **composite** | **${fmt(composite)}** | Maturity-weighted across goal context |`);
  return lines.join("\n");
}

/**
 * Insert or replace a top-level section by its `## Heading` line.
 * Used for upserting Synthesis and Effectiveness sections at finalize time.
 */
function upsertSection(body: string, heading: string, content: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped}\\s*$[\\s\\S]*?(?=^## |\\Z)`, "m");

  const newSection = `${heading}\n\n${content.trim()}\n`;

  if (regex.test(body)) {
    return body.replace(regex, newSection + "\n");
  }

  return body.trimEnd() + "\n\n" + newSection;
}
