# claude-plugins

A personal [Claude Code](https://claude.com/claude-code) plugin marketplace by [@nicholas1513](https://github.com/nicholas1513).

## Plugins

| Plugin | Version | Description |
|---|---|---|
| [`rag`](./plugins/rag/) | `0.1.0` | Two-layer RAG memory system — System Knowledge (durable, versioned) and Issue Memory (active cards). Skills: `/rag:init`, `/rag:card`, `/rag:trace`, `/rag:promote`, `/rag:context`, `/rag:memory`. |

## Install

Add this marketplace to Claude Code:

```bash
claude plugin marketplace add nicholas1513/claude-plugins
```

Then install a plugin from it:

```bash
claude plugin install rag@nicholas1513-claude-plugins
```

Or, in a Claude Code session:

```
/plugin marketplace add nicholas1513/claude-plugins
/plugin install rag@nicholas1513-claude-plugins
```

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

See [`plugins/rag/`](./plugins/rag/) for skill source and [`plugins/rag/features/plugin-support.md`](./plugins/rag/features/plugin-support.md) for the full reference on Claude Code's plugin host model that this plugin was built against.

## Versioning

Plugins in this marketplace follow semver. Releases are git-tagged using Claude Code's required format:

```
{plugin-name}--v{version}
```

For example: `rag--v0.1.0`, `rag--v1.0.0`. The double-dash separator is part of the spec — it lets each plugin in this monorepo carry an independent version line.

To pin a specific version in `marketplace.json`:

```json
{ "name": "rag", "source": { "source": "github", "repo": "nicholas1513/claude-plugins", "ref": "rag--v0.1.0" } }
```

## Development

Local install during development (no marketplace needed):

```bash
git clone https://github.com/nicholas1513/claude-plugins.git
claude --plugin-dir claude-plugins/plugins/rag
```

Or add the local checkout as a marketplace:

```bash
claude plugin marketplace add ./claude-plugins
```

## License

[MIT](./LICENSE) © 2026 Nicholas DeTore
# claude-plugins
