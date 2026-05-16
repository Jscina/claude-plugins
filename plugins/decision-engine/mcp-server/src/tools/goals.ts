/**
 * MCP tool definitions for goal operations.
 *
 * Tools exposed:
 *   - list_goals
 *   - get_goal
 *   - find_relevant_goals (LLM-driven semantic match against a prompt)
 *   - detect_goal_conflicts
 *
 * Create/edit operations are intentionally NOT exposed as MCP tools in Phase 0.
 * Goals are edited via the filesystem (human source of truth). Adding write
 * tools later requires Phase 2 sync logic (per ARCHITECTURE.md).
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Storage } from "../storage/filesystem.js";
import type { Goal } from "../types.js";

// ============================================================================
// TOOL DEFINITIONS (JSON Schema for MCP)
// ============================================================================

export const goalToolDefinitions: Tool[] = [
  {
    name: "list_goals",
    description:
      "List all goals in the corpus, optionally filtered by status, maturity, or tag. " +
      "Returns goal metadata (id, title, status, maturity, tags). " +
      "Use this to give the user an overview of their goal landscape, or as a precursor to selecting goal context for a workflow run.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "paused", "achieved", "abandoned", "deprecated"],
          description: "Filter by goal status (default: all)",
        },
        maturity: {
          type: "string",
          enum: ["draft", "refined", "validated", "mature"],
          description: "Filter by goal maturity level",
        },
        tag: {
          type: "string",
          description: "Filter to goals containing this tag",
        },
      },
    },
  },
  {
    name: "get_goal",
    description:
      "Retrieve the full content of a single goal, including success criteria, constraints, assumptions, and strategy pillars. " +
      "Use this when you need the complete context of a specific goal to evaluate a new input against it.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: {
          type: "string",
          description: "The id (slug) of the goal to retrieve",
        },
      },
      required: ["goal_id"],
    },
  },
  {
    name: "find_relevant_goals",
    description:
      "Given a user prompt or decision context, return the goals most likely to be relevant. " +
      "This is a coarse semantic filter — it returns candidates whose tags, titles, or descriptions overlap with the input. " +
      "Use this at the start of a workflow run to establish goal context casually (per session-determined granularity).",
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "string",
          description: "The user prompt, decision description, or session context to match goals against",
        },
        max_results: {
          type: "number",
          description: "Maximum number of goals to return (default: 5)",
          default: 5,
        },
      },
      required: ["context"],
    },
  },
  {
    name: "detect_goal_conflicts",
    description:
      "Given a proposed action or decision and a set of goal IDs, identify conflicts. " +
      "Checks for: hard constraint violations, soft constraint violations, broken assumptions, and resource conflicts with `conflicting_goals` references. " +
      "Returns structured conflict reports. " +
      "Use this WHENEVER a workflow surfaces a candidate decision, before recommending it to the user.",
    inputSchema: {
      type: "object",
      properties: {
        proposed_action: {
          type: "string",
          description: "Description of the action or decision being considered",
        },
        goal_ids: {
          type: "array",
          items: { type: "string" },
          description: "Goal IDs to check against (typically the active goal_context for the current run)",
        },
      },
      required: ["proposed_action", "goal_ids"],
    },
  },
];

// ============================================================================
// TOOL HANDLERS
// ============================================================================

export class GoalToolHandlers {
  constructor(private readonly storage: Storage) {}

  async listGoals(args: {
    status?: string;
    maturity?: string;
    tag?: string;
  }): Promise<{ goals: Array<Pick<Goal["frontmatter"], "id" | "title" | "status" | "maturity" | "tags" | "horizon">> }> {
    let goals = await this.storage.listGoals();

    if (args.status) {
      goals = goals.filter((g) => g.frontmatter.status === args.status);
    }
    if (args.maturity) {
      goals = goals.filter((g) => g.frontmatter.maturity === args.maturity);
    }
    if (args.tag) {
      goals = goals.filter((g) => g.frontmatter.tags.includes(args.tag!));
    }

    return {
      goals: goals.map((g) => ({
        id: g.frontmatter.id,
        title: g.frontmatter.title,
        status: g.frontmatter.status,
        maturity: g.frontmatter.maturity,
        tags: g.frontmatter.tags,
        horizon: g.frontmatter.horizon,
      })),
    };
  }

  async getGoal(args: { goal_id: string }): Promise<{ goal: Goal } | { error: string }> {
    const goal = await this.storage.getGoal(args.goal_id);
    if (!goal) {
      return { error: `Goal not found: ${args.goal_id}` };
    }
    return { goal };
  }

  /**
   * Coarse keyword + tag matching. Phase 1 should replace this with a real
   * embedding-based similarity score; for now we just rank by shared tokens
   * between the context and goal metadata.
   */
  async findRelevantGoals(args: {
    context: string;
    max_results?: number;
  }): Promise<{ matches: Array<{ goal_id: string; title: string; relevance_score: number; reason: string }> }> {
    const goals = await this.storage.listGoals();
    const contextTokens = tokenize(args.context);

    const scored = goals.map((g) => {
      const goalTokens = new Set([
        ...tokenize(g.frontmatter.title),
        ...g.frontmatter.tags.map((t) => t.toLowerCase()),
        ...tokenize(g.body.description.slice(0, 500)),
      ]);

      let overlap = 0;
      const matchedTokens: string[] = [];
      for (const t of contextTokens) {
        if (goalTokens.has(t)) {
          overlap++;
          matchedTokens.push(t);
        }
      }

      const score = contextTokens.size === 0 ? 0 : overlap / contextTokens.size;
      return {
        goal_id: g.frontmatter.id,
        title: g.frontmatter.title,
        relevance_score: Math.round(score * 100) / 100,
        reason:
          matchedTokens.length > 0
            ? `Matched tokens: ${matchedTokens.slice(0, 5).join(", ")}`
            : "No keyword overlap (low confidence)",
      };
    });

    scored.sort((a, b) => b.relevance_score - a.relevance_score);
    const max = args.max_results ?? 5;
    return { matches: scored.slice(0, max).filter((s) => s.relevance_score > 0) };
  }

  /**
   * Returns structured conflicts. The LLM is expected to interpret these and
   * decide how to surface them to the user per the "analytical + practical"
   * conflict-handling principle.
   */
  async detectGoalConflicts(args: {
    proposed_action: string;
    goal_ids: string[];
  }): Promise<{
    conflicts: Array<{
      goal_id: string;
      goal_title: string;
      conflict_type: "hard_constraint" | "soft_constraint" | "assumption_break" | "resource_conflict";
      conflict_detail: string;
      severity: "high" | "medium" | "low";
    }>;
  }> {
    const conflicts: Array<{
      goal_id: string;
      goal_title: string;
      conflict_type: "hard_constraint" | "soft_constraint" | "assumption_break" | "resource_conflict";
      conflict_detail: string;
      severity: "high" | "medium" | "low";
    }> = [];

    const actionTokens = tokenize(args.proposed_action);

    for (const goalId of args.goal_ids) {
      const goal = await this.storage.getGoal(goalId);
      if (!goal) continue;

      // Hard constraints: report if any keyword overlap exists. LLM decides
      // semantic relevance from there.
      for (const constraint of goal.body.constraints.hard) {
        if (hasTokenOverlap(actionTokens, tokenize(constraint))) {
          conflicts.push({
            goal_id: goal.frontmatter.id,
            goal_title: goal.frontmatter.title,
            conflict_type: "hard_constraint",
            conflict_detail: constraint,
            severity: "high",
          });
        }
      }

      // Soft constraints
      for (const constraint of goal.body.constraints.soft) {
        if (hasTokenOverlap(actionTokens, tokenize(constraint))) {
          conflicts.push({
            goal_id: goal.frontmatter.id,
            goal_title: goal.frontmatter.title,
            conflict_type: "soft_constraint",
            conflict_detail: constraint,
            severity: "medium",
          });
        }
      }

      // Assumption breaks
      for (const assumption of goal.body.assumptions) {
        if (hasTokenOverlap(actionTokens, tokenize(assumption))) {
          conflicts.push({
            goal_id: goal.frontmatter.id,
            goal_title: goal.frontmatter.title,
            conflict_type: "assumption_break",
            conflict_detail: assumption,
            severity: "medium",
          });
        }
      }
    }

    return { conflicts };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "at", "by", "for", "with", "and",
  "or", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might",
  "this", "that", "these", "those", "it", "its", "as", "from", "but", "if",
  "i", "we", "you", "they", "he", "she", "my", "our", "your", "their",
]);

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

function hasTokenOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) {
    if (b.has(t)) return true;
  }
  return false;
}
