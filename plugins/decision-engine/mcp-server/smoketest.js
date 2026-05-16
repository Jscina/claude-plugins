#!/usr/bin/env node
/**
 * Quick smoke test: load the retirement goal through the storage layer and
 * verify the parsing works end-to-end. Not a real test suite — just a sanity
 * check that the markdown/Zod pipeline doesn't blow up.
 */
import { FilesystemStorage } from "./dist/storage/filesystem.js";

const root = process.argv[2];
if (!root) {
  console.error("Usage: node smoketest.js <plugin_root>");
  process.exit(1);
}

const storage = new FilesystemStorage(root);

console.log("=== Listing goals ===");
const goals = await storage.listGoals();
for (const g of goals) {
  console.log(`  ${g.frontmatter.id} (${g.frontmatter.status}, ${g.frontmatter.maturity})`);
  console.log(`    title: ${g.frontmatter.title}`);
  console.log(`    horizon: ${g.frontmatter.horizon}`);
  console.log(`    tags: ${g.frontmatter.tags.join(", ")}`);
  console.log(`    hard constraints: ${g.body.constraints.hard.length}`);
  console.log(`    soft constraints: ${g.body.constraints.soft.length}`);
  console.log(`    assumptions: ${g.body.assumptions.length}`);
  console.log(`    strategy pillars: ${g.body.strategyPillars.length}`);
  console.log(`    primary success criteria: ${g.body.successCriteria.primary.length}`);
  console.log(`    change log entries: ${g.body.changeLog.length}`);
}

console.log("\n=== Listing workflows ===");
const workflows = await storage.listWorkflows();
for (const w of workflows) {
  console.log(`  ${w.frontmatter.id} v${w.frontmatter.version}`);
  console.log(`    title: ${w.frontmatter.title}`);
  console.log(`    stages: ${w.frontmatter.stages.join(" -> ")}`);
  console.log(`    typical goals: ${w.frontmatter.typical_goal_context.join(", ")}`);
}

console.log("\n=== Listing runs ===");
const runs = await storage.listRuns();
console.log(`  ${runs.length} runs`);

console.log("\n✓ Smoke test passed");
