# Working on this repo

Guidance for anyone developing `claude-plugins` (this repo or a fork). Claude Code loads this file as
project memory when the working directory is inside the repo, so it primes agent sessions with how we
work here. It lives at the repo root and is **not part of any shipped plugin** — plugins ship only
from their `plugins/<name>/` subtree via `git-subdir`, so this file reaches contributors, never end
users.

## Engineering principles

### Lean on code when it predictably pays off
When a task is repetitive, deterministic, or would be **predictably cheaper** (tokens/latency) as a
script or small tool — **and** doing so does not compromise the quality or accuracy of the output —
prefer code over doing it by hand each time.

- The bar is *"predictably cheaper with no real compromise on quality/accuracy,"* not *"possible in
  code."*
- Split the work honestly: **model judgment** (reading noisy/ambiguous input, classification, writing,
  design decisions) stays with the model; **deterministic glue** (discovery, parsing, formatting,
  counting, file moves, token substitution) is the candidate for a helper.
- Reuse first: if a one-liner, an existing `bin/` script, or a known tool already does it, use that
  before writing anything new. This repo's helpers live in `plugins/<name>/bin/` (stdlib-only).

### But don't create maintenance sinks
Every script/tool/doc is a long-term liability. Introduce one only when the recurring savings clearly
outweigh the upkeep.

- Prefer **small, single-purpose, stdlib-only** helpers over frameworks or dependencies (the shipped
  plugin code stays standard-library-only; dev-only tooling like pytest is never bundled).
- Don't build bespoke tooling for a one-off — do it by hand and move on.
- Cover a helper you keep with a test in `tests/` (the suite characterizes `bin/` scripts) — that is
  what keeps it from rotting into a sink.
- **One source of truth per fact.** Don't maintain a second copy of something (a parallel plan, a
  duplicated doc) that has to be kept in sync — point at the canonical one instead.

### Before writing code, climb the ladder
Adapted from the community `ponytail` skill (kept as discipline, not a dependency). Before generating
code, gate it — stop at the first question that resolves the work:
1. Does this need to exist at all? (The cheapest code is the code you don't write.)
2. Is it already in the codebase or a dependency? Reuse it; don't rewrite it.
3. What is the least change that fully solves the problem?

Native plan mode / brainstorming-first is where this gate lives; this just names it. This is the
pre-work counterpart to "lean on code" above: that decides *when code is worth writing*, this decides
*whether this particular code should be written at all.*

### How to notice the opportunities
Watch traces and recurring work (the RAG "skill-discovery pass"):
- A repeated multi-step manual sequence → candidate script/skill.
- The same class of mistake recurring → candidate guardrail.
- A workflow that maps cleanly onto an existing effective tool → adopt it.

Capture the candidate (adopt-existing vs. build-custom) with the pattern it addresses before building.

## Repo conventions (pointers, not copies)
- **Releasing** is tag-driven — see `RELEASING.md` (bump `plugin.json` + notes, tag `<name>--vX.Y.Z`,
  then bump `marketplace.json`).
- **Tests** are dev-only and live at the repo root under `tests/` (`pytest.ini`); they never ship.
- The `rag` plugin's own memory conventions are documented in
  `plugins/rag/skills/memory/references/structure.md`.
