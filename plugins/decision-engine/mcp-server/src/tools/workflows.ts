/**
 * MCP tool definitions for workflow operations.
 *
 * Workflows are markdown documents that describe reusable processes. The MCP
 * server's job is to expose them for discovery; execution is done by the LLM
 * (Claude) reading the workflow body as instructions.
 *
 * Like goals, workflow files are edited on the filesystem (human source of
 * truth). No write tools are exposed in Phase 0.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Storage } from "../storage/filesystem.js";
import type { Workflow } from "../types.js";

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const workflowToolDefinitions: Tool[] = [
  {
    name: "list_workflows",
    description:
      "List all workflows available in the plugin. Returns workflow metadata: id, title, purpose, typical goal context, and tags. " +
      "Use this when the user asks 'what can the engine do?' or when you need to discover which workflows might apply to a given task.",
    inputSchema: {
      type: "object",
      properties: {
        tag: {
          type: "string",
          description: "Filter to workflows containing this tag",
        },
      },
    },
  },
  {
    name: "get_workflow",
    description:
      "Retrieve the full content of a workflow definition, including its stages, required inputs, and outputs. " +
      "Use this BEFORE running a workflow — you need the stage definitions to execute them. " +
      "The body of the workflow contains your operating instructions.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_id: {
          type: "string",
          description: "The id (slug) of the workflow to retrieve",
        },
      },
      required: ["workflow_id"],
    },
  },
];

// ============================================================================
// TOOL HANDLERS
// ============================================================================

export class WorkflowToolHandlers {
  constructor(private readonly storage: Storage) {}

  async listWorkflows(args: { tag?: string }): Promise<{
    workflows: Array<{
      id: string;
      title: string;
      purpose: string;
      typical_goal_context: string[];
      tags: string[];
      stage_count: number;
    }>;
  }> {
    let workflows = await this.storage.listWorkflows();

    if (args.tag) {
      workflows = workflows.filter((w) => w.frontmatter.tags.includes(args.tag!));
    }

    return {
      workflows: workflows.map((w) => ({
        id: w.frontmatter.id,
        title: w.frontmatter.title,
        purpose: w.frontmatter.purpose,
        typical_goal_context: w.frontmatter.typical_goal_context,
        tags: w.frontmatter.tags,
        stage_count: w.frontmatter.stages.length,
      })),
    };
  }

  async getWorkflow(args: { workflow_id: string }): Promise<{ workflow: Workflow } | { error: string }> {
    const workflow = await this.storage.getWorkflow(args.workflow_id);
    if (!workflow) {
      return { error: `Workflow not found: ${args.workflow_id}` };
    }
    return { workflow };
  }
}
