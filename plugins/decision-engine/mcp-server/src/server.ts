#!/usr/bin/env node

/**
 * Decision Engine MCP Server
 *
 * Entry point for the plugin's MCP server. Wires goal/workflow/run tools
 * to the MCP protocol via stdio transport.
 *
 * The server is stateless across invocations — it re-reads from the filesystem
 * each time. In Phase 1 (per ARCHITECTURE.md), an in-memory cache backed by a
 * SQLite index will be introduced when query latency demands it.
 *
 * The DECISION_ENGINE_ROOT env var (set by plugin.json) points to the plugin
 * directory. All goal/workflow/run paths are resolved relative to it.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { FilesystemStorage } from "./storage/filesystem.js";
import { goalToolDefinitions, GoalToolHandlers } from "./tools/goals.js";
import { workflowToolDefinitions, WorkflowToolHandlers } from "./tools/workflows.js";
import { runToolDefinitions, RunToolHandlers } from "./tools/runs.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const root = process.env.DECISION_ENGINE_ROOT;
if (!root) {
  console.error("DECISION_ENGINE_ROOT environment variable is required");
  process.exit(1);
}

const storage = new FilesystemStorage(root);
const goalHandlers = new GoalToolHandlers(storage);
const workflowHandlers = new WorkflowToolHandlers(storage);
const runHandlers = new RunToolHandlers(storage, root);

// ============================================================================
// SERVER SETUP
// ============================================================================

const server = new Server(
  {
    name: "decision-engine",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// TOOL REGISTRY
// ============================================================================

const allTools: Tool[] = [
  ...goalToolDefinitions,
  ...workflowToolDefinitions,
  ...runToolDefinitions,
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: allTools };
});

// ============================================================================
// TOOL DISPATCH
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await dispatchTool(name, args ?? {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function dispatchTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    // ---- Goal tools ----
    case "list_goals":
      return goalHandlers.listGoals(args as Parameters<typeof goalHandlers.listGoals>[0]);
    case "get_goal":
      return goalHandlers.getGoal(args as Parameters<typeof goalHandlers.getGoal>[0]);
    case "find_relevant_goals":
      return goalHandlers.findRelevantGoals(
        args as Parameters<typeof goalHandlers.findRelevantGoals>[0]
      );
    case "detect_goal_conflicts":
      return goalHandlers.detectGoalConflicts(
        args as Parameters<typeof goalHandlers.detectGoalConflicts>[0]
      );

    // ---- Workflow tools ----
    case "list_workflows":
      return workflowHandlers.listWorkflows(
        args as Parameters<typeof workflowHandlers.listWorkflows>[0]
      );
    case "get_workflow":
      return workflowHandlers.getWorkflow(
        args as Parameters<typeof workflowHandlers.getWorkflow>[0]
      );

    // ---- Run tools ----
    case "start_run":
      return runHandlers.startRun(args as Parameters<typeof runHandlers.startRun>[0]);
    case "record_stage_output":
      return runHandlers.recordStageOutput(
        args as Parameters<typeof runHandlers.recordStageOutput>[0]
      );
    case "finalize_run":
      return runHandlers.finalizeRun(args as Parameters<typeof runHandlers.finalizeRun>[0]);
    case "list_runs":
      return runHandlers.listRuns(args as Parameters<typeof runHandlers.listRuns>[0]);
    case "get_run":
      return runHandlers.getRun(args as Parameters<typeof runHandlers.getRun>[0]);
    case "compare_runs":
      return runHandlers.compareRuns(args as Parameters<typeof runHandlers.compareRuns>[0]);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============================================================================
// BOOT
// ============================================================================

const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Decision Engine MCP server started");
console.error(`  Root: ${root}`);
console.error(`  Tools: ${allTools.length}`);
