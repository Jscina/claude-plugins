#!/usr/bin/env node
/**
 * Smoke test for the run lifecycle:
 *   start_run -> record_stage_output (x N) -> finalize_run -> verify
 */
import { FilesystemStorage } from "./dist/storage/filesystem.js";
import { RunToolHandlers } from "./dist/tools/runs.js";

const root = process.argv[2];
if (!root) {
  console.error("Usage: node smoketest_runs.js <plugin_root>");
  process.exit(1);
}

const storage = new FilesystemStorage(root);
const runs = new RunToolHandlers(storage, root);

console.log("=== start_run ===");
const startResult = await runs.startRun({
  workflow_id: "house_analyzer",
  goal_context: ["retirement_property_leveraged_family_time"],
  granularity: "atomic",
  initial_inputs: {
    property_identifier: "3718 Echo Valley Cir, La Grange, KY 40031",
    user_intent: "Primary residence with potential ADU and small homestead",
  },
  subject_slug: "3718-echo-valley",
  tags: ["test", "echo_valley"],
});
console.log(JSON.stringify(startResult, null, 2));

if ("error" in startResult) process.exit(1);
const { run_id } = startResult;

console.log("\n=== record_stage_output: intake ===");
const stage1 = await runs.recordStageOutput({
  run_id,
  stage_name: "intake",
  output_content: "Property snapshot:\n- 3 bed / 2.5 bath\n- 1,706 sqft above grade\n- 1.5 acres corner double lot\n- Built 1972, brick ranch",
});
console.log(JSON.stringify(stage1, null, 2));

console.log("\n=== record_stage_output: market_analysis ===");
const stage2 = await runs.recordStageOutput({
  run_id,
  stage_name: "market_analysis",
  output_content: "Fair market value: $435K-$460K. Most likely $445K.\nComp 3713 sold for $415K (larger).",
  conflicts_surfaced: [
    {
      goal_id: "retirement_property_leveraged_family_time",
      conflict_type: "soft_constraint",
      conflict_detail: "Total leverage <=50% of net worth",
      severity: "medium",
      resolution: "Within tolerance at $440K offer with 20% down",
    },
  ],
});
console.log(JSON.stringify(stage2, null, 2));

console.log("\n=== finalize_run ===");
const finalized = await runs.finalizeRun({
  run_id,
  final_synthesis: "Recommended offer: $440K. Walk-away above $460K. See full report.",
  effectiveness: {
    process: 0.85,
    alignment: 0.9,
    outcome: null,
  },
  effectiveness_rationale: {
    process: "Workflow surfaced disclosure issues, comp deltas, and goal-alignment correctly",
    alignment: "Outputs map directly to retirement goal's success criteria (property cash flow, capital preservation)",
    outcome: "Pending decision and time",
  },
});
console.log(JSON.stringify(finalized, null, 2));

console.log("\n=== Verify run is persisted and finalized ===");
const verified = await runs.getRun({ run_id });
if ("error" in verified) {
  console.error("Failed to retrieve:", verified.error);
  process.exit(1);
}
console.log("Run status:", verified.run.frontmatter.status);
console.log("Composite effectiveness:", verified.run.frontmatter.effectiveness.composite);
console.log("Stages recorded:", verified.run.body.match(/^### Stage:/gm)?.length ?? 0);

console.log("\n=== list_runs ===");
const list = await runs.listRuns({});
console.log(`Found ${list.runs.length} run(s)`);

console.log("\n✓ Run lifecycle smoke test passed");
console.log("Cleaning up test artifact...");
await import("node:fs/promises").then((fs) => fs.unlink(verified.run.filepath));
console.log("Cleaned");
