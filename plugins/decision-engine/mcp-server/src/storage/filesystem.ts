/**
 * Phase 0 storage: filesystem-backed markdown + YAML frontmatter.
 *
 * This module is intentionally simple. Per ARCHITECTURE.md, we migrate to a
 * SQLite index layer only when measured triggers fire (>50 goals, >2s scans,
 * etc.). Until then, linear scans are fine.
 *
 * The Storage interface is the seam at which Phase 1 (SQLite index) will be
 * introduced. All consumer code talks to Storage, never to fs directly.
 */

import { readdir, mkdir, access } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { parseMarkdownFile, writeMarkdownFile, parseGoalBody } from "../utils/markdown.js";
import {
  GoalFrontmatterSchema,
  WorkflowFrontmatterSchema,
  RunFrontmatterSchema,
  type Goal,
  type GoalFrontmatter,
  type Workflow,
  type WorkflowFrontmatter,
  type Run,
  type RunFrontmatter,
} from "../types.js";

// ============================================================================
// STORAGE INTERFACE (the Phase 1 seam)
// ============================================================================

export interface Storage {
  // Goals
  listGoals(): Promise<Goal[]>;
  getGoal(id: string): Promise<Goal | null>;
  saveGoal(goal: Goal): Promise<void>;
  goalExists(id: string): Promise<boolean>;

  // Workflows
  listWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: string): Promise<Workflow | null>;
  workflowExists(id: string): Promise<boolean>;

  // Runs
  listRuns(filter?: RunFilter): Promise<Run[]>;
  getRun(id: string): Promise<Run | null>;
  saveRun(run: Run): Promise<void>;
}

export interface RunFilter {
  workflow_id?: string;
  goal_id?: string;       // any run that touched this goal
  status?: Run["frontmatter"]["status"];
  since?: string;         // ISO datetime
}

// ============================================================================
// FILESYSTEM IMPLEMENTATION
// ============================================================================

export class FilesystemStorage implements Storage {
  constructor(private readonly root: string) {}

  // --- paths ---

  private goalsDir(): string { return join(this.root, "goals"); }
  private workflowsDir(): string { return join(this.root, "workflows"); }
  private runsDir(): string { return join(this.root, "runs"); }

  private goalPath(id: string): string { return join(this.goalsDir(), `${id}.md`); }
  private runPath(id: string): string { return join(this.runsDir(), `${id}.md`); }
  /**
   * Workflows live in subdirectories with a workflow.md file inside them,
   * to allow co-location of stage definitions and supporting docs.
   */
  private workflowPath(id: string): string { return join(this.workflowsDir(), id, "workflow.md"); }

  // --- goals ---

  async listGoals(): Promise<Goal[]> {
    return this.listMarkdownDir<Goal>(this.goalsDir(), async (filepath) => {
      return this.loadGoalFile(filepath);
    });
  }

  async getGoal(id: string): Promise<Goal | null> {
    const filepath = this.goalPath(id);
    if (!(await pathExists(filepath))) return null;
    return this.loadGoalFile(filepath);
  }

  async saveGoal(goal: Goal): Promise<void> {
    await ensureDir(this.goalsDir());
    const validated = GoalFrontmatterSchema.parse(goal.frontmatter);
    await writeMarkdownFile(goal.filepath, validated, goal.body.rawBody);
  }

  async goalExists(id: string): Promise<boolean> {
    return pathExists(this.goalPath(id));
  }

  private async loadGoalFile(filepath: string): Promise<Goal> {
    const { frontmatter, body } = await parseMarkdownFile<unknown>(filepath);
    const validated = GoalFrontmatterSchema.parse(frontmatter);
    return {
      frontmatter: validated as GoalFrontmatter,
      body: parseGoalBody(body),
      filepath,
    };
  }

  // --- workflows ---

  async listWorkflows(): Promise<Workflow[]> {
    if (!(await pathExists(this.workflowsDir()))) return [];

    const subdirs = await readdir(this.workflowsDir(), { withFileTypes: true });
    const workflows: Workflow[] = [];

    for (const entry of subdirs) {
      if (!entry.isDirectory()) continue;
      const filepath = join(this.workflowsDir(), entry.name, "workflow.md");
      if (!(await pathExists(filepath))) continue;
      try {
        workflows.push(await this.loadWorkflowFile(filepath));
      } catch (err) {
        // Log and skip malformed workflows rather than failing the whole listing.
        console.error(`Failed to load workflow at ${filepath}:`, err);
      }
    }

    return workflows;
  }

  async getWorkflow(id: string): Promise<Workflow | null> {
    const filepath = this.workflowPath(id);
    if (!(await pathExists(filepath))) return null;
    return this.loadWorkflowFile(filepath);
  }

  async workflowExists(id: string): Promise<boolean> {
    return pathExists(this.workflowPath(id));
  }

  private async loadWorkflowFile(filepath: string): Promise<Workflow> {
    const { frontmatter, body } = await parseMarkdownFile<unknown>(filepath);
    const validated = WorkflowFrontmatterSchema.parse(frontmatter);
    return {
      frontmatter: validated as WorkflowFrontmatter,
      body,
      filepath,
    };
  }

  // --- runs ---

  async listRuns(filter?: RunFilter): Promise<Run[]> {
    if (!(await pathExists(this.runsDir()))) return [];

    const runs = await this.listMarkdownDir<Run>(this.runsDir(), async (filepath) => {
      return this.loadRunFile(filepath);
    });

    if (!filter) return runs;

    return runs.filter((run) => {
      if (filter.workflow_id && run.frontmatter.workflow_id !== filter.workflow_id) return false;
      if (filter.status && run.frontmatter.status !== filter.status) return false;
      if (filter.goal_id && !run.frontmatter.goal_context.includes(filter.goal_id)) return false;
      if (filter.since && run.frontmatter.started < filter.since) return false;
      return true;
    });
  }

  async getRun(id: string): Promise<Run | null> {
    const filepath = this.runPath(id);
    if (!(await pathExists(filepath))) return null;
    return this.loadRunFile(filepath);
  }

  async saveRun(run: Run): Promise<void> {
    await ensureDir(this.runsDir());
    const validated = RunFrontmatterSchema.parse(run.frontmatter);
    await writeMarkdownFile(run.filepath, validated, run.body);
  }

  private async loadRunFile(filepath: string): Promise<Run> {
    const { frontmatter, body } = await parseMarkdownFile<unknown>(filepath);
    const validated = RunFrontmatterSchema.parse(frontmatter);
    return {
      frontmatter: validated as RunFrontmatter,
      body,
      filepath,
    };
  }

  // --- helpers ---

  /**
   * List all .md files in a directory and parse them with the given loader.
   * Malformed files are logged and skipped, never thrown.
   */
  private async listMarkdownDir<T>(
    dir: string,
    loader: (filepath: string) => Promise<T>
  ): Promise<T[]> {
    if (!(await pathExists(dir))) return [];

    const entries = await readdir(dir, { withFileTypes: true });
    const results: T[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (extname(entry.name) !== ".md") continue;

      const filepath = join(dir, entry.name);
      try {
        results.push(await loader(filepath));
      } catch (err) {
        console.error(`Failed to load ${filepath}:`, err);
      }
    }

    return results;
  }
}

// ============================================================================
// FS HELPERS
// ============================================================================

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p: string): Promise<void> {
  await mkdir(p, { recursive: true });
}
