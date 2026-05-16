# Decision Engine Plugin

A Claude Code plugin that treats long-term goals as **first-class indexed objects** and evaluates new inputs (decisions, prompts, data, files) against them via reusable workflows. Runs are persisted for longitudinal review.

## What this is

Most decisions are made without reference to the goals they should serve. You optimize for the present moment, then realize months later you've drifted. This plugin makes the goal context explicit at every step:

- **Goals** are markdown files with structured frontmatter — your retirement plan, your fitness target, your career direction
- **Workflows** are reusable processes (evaluate a property, validate a business idea, decide on a major purchase)
- **Runs** are recorded instances of a workflow execution, with the goal context that drove it

When you invoke a workflow, the plugin asks which goals are in play, runs the workflow against them, and stores the run for future comparison. Re-invoke the same workflow on different inputs and you get apples-to-apples deltas.

## Why a plugin (not just MCP, not just a skill)

- **MCP server** alone: tools without guidance. Claude doesn't know when to use them.
- **Skill** alone: instructions without state. Nothing persists.
- **Plugin**: bundles both. The MCP server manages state; the skill teaches Claude when to invoke it.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the persistence evolution plan (Phase 0 → 4) and design rationale.

## Layout

```
decision-engine-plugin/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── ARCHITECTURE.md              # Evolution plan (phases, triggers, anti-patterns)
├── README.md                    # This file
├── mcp-server/                  # MCP server providing CRUD tools
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts            # MCP entry point
│       ├── types.ts             # Core types
│       ├── storage/             # Phase 0 filesystem storage
│       ├── tools/               # MCP tool definitions
│       └── utils/               # Markdown + frontmatter parsing
├── agents/
│   └── decision-engineer.md     # Persona invoked at session start (@decision-engineer)
├── skills/
│   └── decision-engine-usage/   # Reactive guidance for when Claude detects engine-relevant context
├── schemas/
│   └── goal_schema_v1.md        # Schema spec for goal files
├── workflows/
│   └── house_analyzer/          # First concrete workflow
├── goals/                       # Your goal corpus (gitignored in production)
└── runs/                        # Workflow run records
```

## Skill vs. Agent

The plugin ships with both a **skill** and an **agent**. They overlap intentionally but serve different invocation patterns:

- **`skills/decision-engine-usage/`**: Reactive. Activates when Claude's main session detects decision-engine-relevant context (user mentions goals, asks to evaluate a decision, etc.). Good for ad-hoc invocations from a general session.
- **`agents/decision-engineer.md`**: Proactive identity. Invoke via `@decision-engineer` at session start when you want the methodology baked in from the first message. The agent runs the standard opening sequence (load goal landscape, offer paths forward, establish granularity) automatically.

Use the agent when you're sitting down to do focused decision work. Use the skill when you're in a general session that drifts into goal evaluation.

## Setup

```bash
# Build the MCP server
cd mcp-server
npm install
npm run build

# Install as a Claude Code plugin (from project root)
claude --plugin-dir ./decision-engine-plugin
```

## Quick start

Once installed, you have two ways to invoke the system:

**Via the agent (deliberate, session-start):**
```
> @decision-engineer
```
The agent loads your goal landscape, offers paths forward, and establishes session granularity. This is the default entry point for focused decision work.

**Via the skill (reactive, ad-hoc):**
```
> Evaluate 123 Main St against my retirement goal
```
The skill activates when Claude detects decision-engine-relevant context in a general session. The house_analyzer workflow runs and the result is persisted as a run record.

## Current phase

Phase 0: Filesystem storage (markdown + YAML frontmatter). See [ARCHITECTURE.md](./ARCHITECTURE.md) for when and how to evolve.

## Development status

- ✅ Goal schema spec
- ✅ Plugin manifest
- ✅ MCP server scaffolding
- ✅ Filesystem storage adapter
- ✅ Goal CRUD tools (list, get, find_relevant, detect_conflicts)
- ✅ Workflow tools (list, get)
- ✅ Run tools (start, record_stage_output, finalize, list, get, compare)
- ✅ House analyzer workflow definition
- ✅ Decision engineer agent (session-start persona)
- ✅ Decision engine usage skill (reactive trigger)
- 🚧 SQLite index layer (Phase 1 trigger — pending observed need)
- 🚧 Embedding-based goal relevance (replaces keyword overlap when query volume justifies)
- 🚧 Outcome score backfill workflow (post-hoc effectiveness assessment)
- 🚧 Second goal instance (e.g., software_studio_year_1) to exercise parent/child relations
