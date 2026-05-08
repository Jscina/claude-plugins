# Claude Code Plugin Support — Reference

What the Claude Code plugin host provides, how to build a custom plugin/skill library, and how versioning works for both in-house and external contributors. Written so feature and distribution decisions can be made against documented guarantees rather than guesses.

---

## Plugin manifest (`plugin.json`)

Located at `.claude-plugin/plugin.json`. The schema at `https://json.schemastore.org/claude-code-plugin-manifest.json` is the authoritative reference (Claude Code ignores `$schema` at load time — it's editor-only).

| Field | Type | Notes |
|---|---|---|
| `name` | string | Kebab-case. Becomes the namespace prefix: `/rag:*` |
| `version` | string | Omit to track by git commit SHA. Set to require explicit bumps for updates. |
| `description` | string | Shown in plugin manager |
| `author` | `{name, email, url}` | Attribution |
| `homepage` | string | Documentation URL |
| `repository` | string | Source URL |
| `license` | string | e.g. `MIT`, `Apache-2.0` |
| `keywords` | array | Discovery tags |
| `skills` | string\|array | Override default `skills/` path(s) |
| `commands` | string\|array | Override default `commands/` flat-file path(s) |
| `agents` | string\|array | Agent definition file paths |
| `hooks` | string\|array\|object | Hook config paths or inline config |
| `mcpServers` | string\|array\|object | MCP config paths or inline (alternative to `.mcp.json`) |
| `outputStyles` | string\|array | Output style definitions |
| `themes` | string\|array | Color theme files |
| `lspServers` | string\|array\|object | Language server configs |
| `monitors` | string\|array | Background monitor definitions |
| `userConfig` | object | Values prompted at enable time; exposed as `${user_config.*}` everywhere |
| `dependencies` | array | Other plugins required, with optional semver constraints |
| `channels` | array | Message channel declarations |

Currently unused fields of interest for this plugin: **`hooks`**, **`userConfig`**, **`dependencies`**.

---

## Directory layout — what Claude Code auto-discovers

| Directory | Behavior |
|---|---|
| `skills/` | Each `<name>/SKILL.md` → `/rag:<name>` |
| `commands/` | Flat `.md` command files |
| `agents/` | Agent definitions |
| `hooks/` | Hook configurations |
| `monitors/` | Background monitor definitions |
| `bin/` | **Executables added to PATH when plugin loads** |
| `output-styles/` | Output style definitions |
| `themes/` | Color themes |
| `.mcp.json` | MCP server config — auto-loaded on plugin enable |
| `.lsp.json` | LSP server config — auto-loaded |
| `settings.json` | `agent` and `subagentStatusLine` fields only |

`features/`, `lib/`, `pyproject.toml` — all ignored by Claude Code. This plugin uses `features/` as its own planning convention; Claude Code passes through it silently.

---

## Skill registration

Skills are convention-based — no manifest entry needed:

- `skills/init/SKILL.md` → `/rag:init`
- `skills/card/SKILL.md` → `/rag:card`
- Namespace (`rag:`) comes from `name` in `plugin.json`

Optional frontmatter in any `SKILL.md`:

```
---
disable-model-invocation: true   # user-triggered only; recommended for write-side skills
---
```

To override the discovery path: `"skills": "./other/path/"` in `plugin.json`.

---

## MCP server integration

`.mcp.json` at the plugin root is auto-loaded when the plugin enables. Current state is an empty `mcpServers` map — no servers registered.

When the RAG search server is built (see `slot-in-rag.md`):

```json
{
  "mcpServers": {
    "rag-search": {
      "command": "${CLAUDE_PLUGIN_ROOT}/bin/rag-mcp",
      "args": [],
      "env": {
        "RAG_CORPUS_ROOT": "${RAG_CORPUS_ROOT:-./rag-memory}",
        "PLUGIN_DATA": "${CLAUDE_PLUGIN_DATA}"
      }
    }
  }
}
```

MCP config can alternatively be inlined in `plugin.json` under `"mcpServers"` — same behavior, one fewer file.

### Available environment variables

Substituted automatically in `.mcp.json`, hook configs, and all plugin-managed configs:

| Variable | Value |
|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | Absolute path to plugin install directory |
| `${CLAUDE_PLUGIN_DATA}` | Persistent per-user state dir (`~/.claude/plugins/data/{id}/`) — survives updates |
| `${user_config.<key>}` | Values from `userConfig` field, collected at enable time |
| Standard env vars | `${HOME}`, `${PATH}`, etc. passed through as-is |

The `bin/` directory is on PATH — `bin/rag-index` is callable as just `rag-index` in hooks and skills.

---

## Hooks

A first-class manifest field. Declare inline in `plugin.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "command": "rag-index --incremental \"${file}\""
      }
    ]
  }
}
```

Or point to a file: `"hooks": "./hooks/hooks.json"`.

**Relevant to this plugin**: The V2 incremental reindex described in `slot-in-rag.md` (trigger `bin/rag-index --incremental` on Edit/Write inside the corpus) should be wired here — not as a manual step and not in memory/preferences, since hooks are executed by the harness itself.

---

## Custom plugin/skill library (marketplace)

### Marketplace format

A marketplace is a repo (GitHub, GitLab, self-hosted git, or URL) containing `.claude-plugin/marketplace.json`:

```json
{
  "name": "company-tools",
  "owner": { "name": "DevTools Team", "email": "devtools@example.com" },
  "description": "Internal plugins for the company",
  "allowCrossMarketplaceDependenciesOn": ["acme-shared"],
  "plugins": [
    {
      "name": "rag",
      "source": "./plugins/rag",
      "description": "Two-layer RAG memory system"
    }
  ]
}
```

Required fields: `name`, `owner.name`, `plugins`. Optional: `description`, `allowCrossMarketplaceDependenciesOn` (needed for cross-marketplace dependencies — see versioning section).

### Plugin source types within a marketplace

```jsonc
// Relative path in the same repo
"source": "./plugins/rag"

// GitHub repo
"source": { "source": "github", "repo": "org/plugin-repo", "ref": "v2.0.0", "sha": "a1b2c3..." }

// Any git URL
"source": { "source": "url", "url": "https://gitlab.com/team/plugin.git", "ref": "main" }

// Subdirectory of a monorepo (sparse clone)
"source": { "source": "git-subdir", "url": "https://github.com/acme/monorepo.git", "path": "tools/rag-plugin", "ref": "v2.0.0" }

// npm package
"source": { "source": "npm", "package": "@acme/rag-plugin", "version": "^2.0.0", "registry": "https://npm.example.com" }
```

### Monorepo layout

```
company-plugins/                      ← the marketplace repo
├── .claude-plugin/
│   └── marketplace.json
├── plugins/
│   ├── rag/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── skills/
│   │   └── .mcp.json
│   ├── deploy-kit/
│   └── code-review/
```

With `"metadata": { "pluginRoot": "./plugins" }` in marketplace.json, plugin paths can omit the `plugins/` prefix.

### Adding the marketplace (user side)

```bash
claude plugin marketplace add owner/repo               # GitHub (recommended)
claude plugin marketplace add https://gitlab.com/...   # Other git host
claude plugin marketplace add https://host/marketplace.json  # Remote JSON (no relative-path plugins)
claude plugin marketplace add ./local-marketplace      # Local path (dev/test)
```

Scope flag: `--scope user` (default), `--scope project`, `--scope local`.

### Pre-seeding for teams (commit to settings.json)

Add to `.claude/settings.json` to share across the team via git:

```json
{
  "extraKnownMarketplaces": {
    "company-tools": {
      "source": {
        "source": "github",
        "repo": "your-org/claude-plugins"
      }
    }
  }
}
```

### Distributing without the official marketplace

1. Private GitHub/GitLab repo → marketplace.json → team adds via `claude plugin marketplace add`
2. Commit plugin entries into `.claude/settings.json` (`project` scope, shared via git)
3. Managed settings via admin console (enterprise) — pushed to all users
4. `CLAUDE_CODE_PLUGIN_SEED_DIR` env var for pre-populated container environments

### Auto-update token requirements

For auto-update to work on private repos, auth tokens must be in environment:

| Host | Token env var |
|---|---|
| GitHub | `GITHUB_TOKEN` or `GH_TOKEN` |
| GitLab | `GITLAB_TOKEN` or `GL_TOKEN` |
| Bitbucket | `BITBUCKET_TOKEN` |

---

## Versioning

### How version resolves

Claude Code resolves plugin version in this priority order:

1. `version` field in `plugin.json`
2. `version` field in the marketplace entry
3. Git commit SHA (for GitHub, URL, git-subdir, and relative-path sources)
4. `unknown` (npm sources or non-git directories)

**Key behavior**: If `version` is set and you push commits without bumping it, users see **no update**. The version string controls update delivery, not commits.

### Tagging releases

Version constraints only resolve against git tags in this exact format:

```
{plugin-name}--v{version}
```

Examples: `rag--v1.0.0`, `rag--v2.1.0`. The double-dash separator lets multiple plugins in a monorepo have independent version lines.

```bash
claude plugin tag --push      # Validates clean tree, creates tag, pushes
# Or manually:
git tag rag--v2.1.0 && git push origin rag--v2.1.0
```

Without matching tags, semver range constraints in dependent plugins will fail to resolve and those plugins will be disabled.

### Semver constraints in dependencies

```json
"dependencies": [
  "audit-logger",
  { "name": "shared-utils", "version": "~2.1.0" },
  { "name": "secrets-vault", "version": "^3.0.0" }
]
```

Supported range syntax (Node semver):

| Range | Meaning |
|---|---|
| `~2.1.0` | `>=2.1.0 <2.2.0` — patch only |
| `^2.0.0` | `>=2.0.0 <3.0.0` — minor + patch |
| `=2.1.0` | Exact version |
| `>=1.4` | 1.4 and above |
| `^2.0.0-0` | Include pre-releases in 2.x range |

Pre-releases (e.g., `2.0.0-beta.1`) are excluded unless the range explicitly opts in with the `-0` suffix.

### Constraint resolution across dependents

If plugin A requires `"db-lib": "^2.0"` and plugin B requires `"db-lib": ">=2.1"`, Claude Code intersects the ranges and installs at the highest tag satisfying both. If ranges conflict, install fails with `range-conflict`. If no tag satisfies all installed constraints, `/plugin update` is skipped and the conflict surfaces in `/doctor`.

### Cross-marketplace dependencies

In-house plugin depending on a skill from an external team's marketplace:

```json
// In marketplace.json of the depending marketplace:
{ "allowCrossMarketplaceDependenciesOn": ["external-team-marketplace"] }

// In plugin.json of the depending plugin:
{
  "dependencies": [
    { "name": "their-plugin", "marketplace": "external-team-marketplace", "version": "~1.0" }
  ]
}
```

Without the allowlist entry, the install fails with a `cross-marketplace` error.

### Isolating outsourced/external skills

Docs are silent on skill-level isolation. The practical pattern:

- Package externally-contributed skills as a **separate plugin** (`external-skills`) with its own release cycle and maintainer
- That plugin's skills are accessible as `/external-skills:<name>` — namespace isolation is enforced automatically
- Version and approve separately from in-house skills before accepting in marketplace.json
- Constrain the version range in `dependencies` to prevent silent updates

There is no skill-level versioning — only plugin-level. Treat any skill signature change (adding/removing required arguments, changing behavior) as a plugin-level breaking change (MAJOR bump).

### Recommended versioning strategy

For an in-house plugin library with external contributors:

| Scenario | Version bump |
|---|---|
| Bug fix in a skill, no behavior change | PATCH |
| New skill added, nothing removed | MINOR |
| Skill signature change or removal | MAJOR |
| Promoted to stable from internal dev | 0.x → 1.0.0 |

During active early development: omit `version` and use commit SHA. Tag and set `version` when the plugin is stable enough for other teams to depend on.

**There is no lockfile.** Dependencies are resolved dynamically from git tags. To pin to an exact commit, use `"sha"` in the marketplace source entry.

---

## Plugin loading

| Method | Scope | Use case |
|---|---|---|
| `claude --plugin-dir .claude/plugins/rag` | Session only | Development |
| `enabledPlugins` in `.claude/settings.json` | Project (git-tracked) | Team-shared |
| `enabledPlugins` in `~/.claude/settings.json` | User (all projects) | Personal install |
| `enabledPlugins` in `.claude/settings.local.json` | Local (gitignored) | Personal, project-scoped |

During development: `/reload-plugins` picks up changes without restart. `claude plugin validate` catches manifest errors before distribution.

---

## Skill-level versioning

There is no native skill-level versioning in Claude Code. The plugin version is the only shipping unit — individual skills have no version metadata of their own.

**Adopted convention for this plugin library:**

Add a version line to the top of each `SKILL.md` body (not frontmatter — Claude Code ignores unknown frontmatter):

```markdown
<!-- skill-version: 1.2.0 -->
```

This is documentation only — Claude Code does not read or enforce it. Its value is in code review and changelogs, not runtime behavior.

**When to bump what:**

| Change | Plugin version bump | Skill version bump |
|---|---|---|
| Bug fix, no behavior change | PATCH | PATCH |
| New optional argument | MINOR | MINOR |
| New skill added | MINOR | N/A (new file starts at 1.0.0) |
| Argument renamed, removed, or required | MAJOR | MAJOR |
| Skill removed | MAJOR | N/A |

The plugin MAJOR version is the actionable signal for dependents. The skill version is for internal tracking and review.

---

## Cross-plugin skill sharing

Plugins are fully self-contained units — there is no native mechanism for one plugin to expose skills that another plugin inherits or re-exports. This is a known gap: two open GitHub issues ([#9444](https://github.com/anthropics/claude-code/issues/9444), [#27113](https://github.com/anthropics/claude-code/issues/27113)) proposed declarative shared resource libraries; #27113 was closed as not planned.

**Available workarounds (in order of preference):**

1. **Library plugin with `dependencies`**: Package shared skills into a `shared-utils` plugin. Dependent plugins declare it in their `dependencies`. Users install it alongside the dependent. The shared skills live at `/shared-utils:<name>` — not transparently re-exported, but accessible.

2. **Duplication with a shared source**: Keep skills in a canonical location in the repo. Use a build step or symlinks to copy them into each plugin's `skills/` directory before distribution. Version the source, not the copies.

3. **Git submodules** on `skills/` directories (community workaround): Works for skills only, not for MCP servers or hooks. Fragile — not recommended for anything load-bearing.

4. **Monolithic plugin**: If two plugins share so many skills that isolation provides no value, merge them.

The proposed `type: "library"` + `exports` shape from issue #9444 has not shipped. Do not rely on it.

---

## Breaking change conventions

No official convention is documented. The following is what this plugin library follows:

**In `SKILL.md`**: When deprecating a skill, add a notice block before the instructions:

```markdown
> **Deprecated in 2.0.0** — Use `/rag:context --mode compact` instead. This skill will be removed in 3.0.0.
```

**In `plugin.json`**: Bump MAJOR on any breaking change (see table above). Never remove a skill without a MINOR deprecation window in a prior release.

**In `CHANGELOG.md`** at the plugin root (follow [Keep a Changelog](https://keepachangelog.com) format):

```markdown
## [2.0.0] - 2026-05-05
### Breaking
- `/rag:search` now requires `--scope` argument; bare invocation removed
### Deprecated
- `/rag:context` without `--mode`: pass `--mode full` or `--mode compact` explicitly; bare invocation removed in 3.0.0
### Added
- `/rag:search` with `--scope system|closed|all`
```

Machine-readable deprecation beyond semver bumps does not exist in the Claude Code plugin system. The CHANGELOG and `<!-- skill-version -->` comment are the only communication channels.

---

## Dependency locking (no native lockfile)

Claude Code has no lockfile. Dependencies are resolved from git tags at install time and can drift if tags are moved.

**SHA pinning for production** — the only reproducibility guarantee:

```json
{
  "plugins": [
    {
      "name": "shared-utils",
      "source": {
        "source": "github",
        "repo": "your-org/shared-utils",
        "ref": "v1.2.0",
        "sha": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
      }
    }
  ]
}
```

`ref` alone is not safe — a branch push or tag move silently changes what installs. `sha` guarantees the exact commit regardless of what happens to the ref.

**Lightweight lockfile convention** (when managing a marketplace with external dependencies): maintain a `pins.json` in the marketplace repo root:

```json
{
  "shared-utils": { "version": "1.2.0", "sha": "a1b2c3d4..." },
  "deploy-kit": { "version": "3.0.1", "sha": "f9e8d7c6..." }
}
```

Update manually when intentionally upgrading a dependency. Code review on `pins.json` diffs is the change-control gate. This is a documentation/process convention — Claude Code does not read `pins.json`.

---

## Third-party and outsourced skill access controls

Claude Code has no plugin sandbox. Plugins run with the same permissions as Claude Code itself, constrained only by the Claude Code permission system. The primary risk surfaces from a third-party plugin are:

- **Hooks**: execute arbitrary shell commands via `PreToolUse`/`PostToolUse`/etc.
- **MCP servers**: can reach the network, read/write files, access credentials — anything the MCP server process is allowed to do

**CVE-2025-59536** (CVSS 8.7, disclosed February 2026): malicious `.claude/settings.json` in an untrusted repo can configure hooks and MCP servers that execute on clone + open, enabling RCE and API token exfiltration. Never clone and open an untrusted repository without reviewing its `.claude/` directory first.

### Per-plugin permission controls

The permission system can restrict what a specific plugin's MCP server can do:

```json
{
  "permissions": {
    "deny": [
      "mcp__untrusted-plugin__*"
    ],
    "allow": [
      "mcp__rag-search__rag.search"
    ]
  }
}
```

Rule formats:
- `mcp__plugin-name` — all tools from that plugin's MCP server
- `mcp__plugin-name__*` — same, wildcard form
- `mcp__plugin-name__tool-name` — specific tool only

### Managed settings controls (enterprise/team)

For teams managing a plugin library with externally contributed plugins:

| Setting | Effect |
|---|---|
| `allowManagedHooksOnly: true` | Only hooks from force-enabled managed plugins run; all other plugin hooks are blocked |
| `allowManagedMcpServersOnly: true` | Only managed MCP servers are allowed; all others blocked |
| `blockedMarketplaces: ["external-team"]` | Blocks an entire marketplace source before it touches the filesystem |
| `strictKnownMarketplaces` | Controls which marketplace sources users can add at all |

### Vetting checklist for external plugin contributions

Before accepting an externally contributed plugin into the marketplace:

- [ ] Review all hook commands — no unconstrained `eval`, `curl`, `$ARGUMENTS` passthrough
- [ ] Review MCP server source — does the server bind network ports? access credentials? write outside `${CLAUDE_PLUGIN_DATA}`?
- [ ] Pin the source to a `sha` (not just a tag or branch)
- [ ] Check for reserved-name impersonation (blocked by Claude Code, but verify)
- [ ] Confirm `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` are the only filesystem paths the plugin writes to
- [ ] Read `.mcp.json` and `hooks/` in full — these are the exploit surface

Third-party marketplaces default to auto-update **disabled**. Keep it that way for externally contributed plugins; require manual version bumps reviewed through the normal process.

---

## Branching and tagging strategy

No official branching strategy is documented. Claude Code only specifies the tag format: `{plugin-name}--v{version}`.

**Recommended layout for a plugin library with external contributors:**

```
main          ← integration branch; all PRs merge here first
stable        ← production release branch; only tagged releases
beta          ← opt-in preview channel
```

**Release process:**

1. Feature branches off `main`; external contributors fork + PR to `main`
2. Merge to `main` after review
3. When ready for release: merge `main` → `stable`, bump version in `plugin.json`, tag:
   ```bash
   git tag rag--v2.1.0 && git push origin rag--v2.1.0
   ```
4. For preview releases: merge `main` → `beta`, tag with pre-release: `rag--v2.1.0-beta.1`

**Marketplace release channels** — point different user groups to different branches:

```json
{
  "plugins": [
    { "name": "rag", "source": { "source": "github", "repo": "org/plugins", "ref": "stable" } }
  ]
}
```

```json
{
  "plugins": [
    { "name": "rag", "source": { "source": "github", "repo": "org/plugins", "ref": "beta" } }
  ]
}
```

Distribute the stable marketplace to production users and the beta marketplace to early adopters. Pin `sha` in the stable marketplace entry; `ref` alone is acceptable for `beta` since it's explicitly opt-in.

**For external contributors**: fork → feature branch → PR to `main`. Never accept direct pushes to `stable` from outside maintainers. The merge to `stable` and the tag are maintainer-only steps.
