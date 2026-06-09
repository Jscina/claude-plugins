# claude-plugins

A personal [Claude Code](https://claude.com/claude-code) plugin marketplace by [@nicholas1513](https://github.com/nicholas1513).

## Plugins

| Plugin | Version | Description |
|---|---|---|
| [`rag`](./plugins/rag/) | `0.3.0` | Two-layer RAG memory system — System Knowledge (durable, versioned) and Issue Memory (active cards), with a firm commit boundary and a `backlog`/`active`/`done`/`archive` lifecycle. Skills: `/rag:init`, `/rag:migrate`, `/rag:card`, `/rag:trace`, `/rag:promote`, `/rag:context`, `/rag:memory`. Bundles the `@rag:batman` investigative agent. |
| [`decision-engine`](./plugins/decision-engine/) | `0.1.3` | Personal goal-indexed decision engine. Treats goals as first-class indexed objects, evaluates new inputs against them via reusable workflows (e.g. `house_analyzer`), and persists runs for longitudinal analysis. Ships a session-start agent (`@decision-engineer`), a reactive skill, and an MCP server for state management. |

## Install

Add this marketplace to Claude Code:

```bash
claude plugin marketplace add nicholas1513/claude-plugins
```

Then install a plugin from it:

```bash
claude plugin install rag@nicholas1513-claude-plugins
claude plugin install decision-engine@nicholas1513-claude-plugins
```

Or, in a Claude Code session:

```
/plugin marketplace add nicholas1513/claude-plugins
/plugin install rag@nicholas1513-claude-plugins
/plugin install decision-engine@nicholas1513-claude-plugins
```

If the marketplace was added before a plugin was published, refresh the local cache first:

```bash
claude plugin marketplace update nicholas1513-claude-plugins
```

## Updating

Third-party marketplaces don't auto-update, so upgrades are explicit. Because each plugin is pinned to a git tag, **refresh the marketplace cache first**, then update the plugin — otherwise `update` re-resolves against the stale cached ref and reports no change:

```bash
claude plugin marketplace update nicholas1513-claude-plugins   # pull the latest marketplace.json (new tag refs)
claude plugin update rag                                       # fetch the plugin at its new tag
```

Or do both from a session via the `/plugin` menu. After updating, run `/reload-plugins` (or restart) and confirm the version:

```bash
claude plugin list        # rag should show the new version
```

### Migrating a `rag-memory/` corpus after a `rag` upgrade

Updating the plugin does not touch your data. When a release changes the on-disk schema (e.g. v0.2.0's commit boundary and `backlog`/`done` lifecycle), an existing corpus must be brought up to date. With the new version installed, the `/rag:memory` orchestrator detects an out-of-date corpus and routes you to `/rag:migrate`; or run the bundled migrator directly:

```bash
rag-migrate --check     # exits 10 if a migration is needed
rag-migrate             # dry-run: prints the plan, changes nothing
rag-migrate --apply     # brings the corpus up to the current schema
git add -A && git commit -m "chore(rag): migrate corpus to the current schema"
```

`rag-migrate` is idempotent and never deletes cards or rewrites `system/` content. Corpora created with the current version need no migration.

## Usage — `rag`

After install, the `/rag:*` skills are available in any Claude Code session. Typical flow:

```
/rag:init        → stand up the rag-memory/ directory in the current project
/rag:card        → open a new investigation card
/rag:trace       → append a finding to the current card
/rag:promote     → move a confirmed, durable finding to system/ knowledge
/rag:context     → resume a card in a new session
/rag:memory      → orchestrator; routes to the right skill given current state
```

The plugin also bundles an investigative agent — invoke **`@rag:batman`** to drive the whole workflow end to end: it opens a card before acting, logs findings to the trace, promotes durable truths to `system/`, and runs the close ceremony. Evidence over guesswork.

See [`plugins/rag/`](./plugins/rag/) for skill/agent source and [`plugins/rag/features/plugin-support.md`](./plugins/rag/features/plugin-support.md) for the full reference on Claude Code's plugin host model that this plugin was built against.

## Usage — `decision-engine`

After install, the `@decision-engineer` agent is registered and the `decision-engine` MCP server exposes goal/workflow/run tools.

First-session note: the MCP server is built from TypeScript on first launch via a `SessionStart` hook (`hooks/ensure-build.sh`). The build is idempotent — it only runs when `mcp-server/dist/server.js` is missing, so subsequent sessions start instantly. Requires Node.js ≥ 20 on `PATH`.

Typical flow:

```
@decision-engineer        → session-start agent: surfaces active goals, recent runs
                            and pending decisions
```

Goals live in [`plugins/decision-engine/goals/`](./plugins/decision-engine/goals/) as markdown files indexed by the MCP server. Workflows (e.g. [`house_analyzer`](./plugins/decision-engine/workflows/house_analyzer/)) define how new inputs are evaluated against a goal. Runs are persisted under `runs/` for longitudinal analysis.

See [`plugins/decision-engine/ARCHITECTURE.md`](./plugins/decision-engine/ARCHITECTURE.md) for the full design.

## Versioning

Plugins in this marketplace follow semver. Releases are git-tagged using Claude Code's required format:

```
{plugin-name}--v{version}
```

For example: `rag--v0.1.2`, `decision-engine--v0.1.1`. The double-dash separator is part of the spec — it lets each plugin in this monorepo carry an independent version line.

The marketplace pins each plugin to its tag using a `git-subdir` source, which sparse-clones only that plugin's subdirectory over HTTPS:

```json
{
  "name": "rag",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/nicholas1513/claude-plugins.git",
    "path": "plugins/rag",
    "ref": "rag--v0.2.0"
  }
}
```

## Development

Local install during development (no marketplace needed) — point Claude Code at any plugin's directory:

```bash
git clone https://github.com/nicholas1513/claude-plugins.git
claude --plugin-dir claude-plugins/plugins/rag
claude --plugin-dir claude-plugins/plugins/decision-engine
```

Or add the local checkout as a marketplace so installs resolve through the same flow as the published version:

```bash
claude plugin marketplace add ./claude-plugins
```

## License

[MIT](./LICENSE) © 2026 Nicholas DeTore
