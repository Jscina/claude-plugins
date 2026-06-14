# Slot-In RAG Layer — Activation Plan

This plan describes how to add genuine retrieval-augmented generation on top of the existing `system/` and `issues/archive/` corpora without restructuring anything that's already in place. Today the plugin performs file assembly; this plan upgrades it to do similarity-based retrieval.

> **Note (v0.2.0 lifecycle):** this plan predates the done/archive split. Where it says
> `issues/closed/`, read the committed record — now `issues/archive/` (plus any legacy
> `issues/closed/`). The retrieval corpus is `system/` + `issues/archive/`.

## When to activate

Build this when **any** of the following is true:
- `system/` contains ≥ 50 finding sections (count `##` headings across all files)
- `issues/closed/` + `issues/archive/` together hold ≥ 30 cards
- The user reports friction finding prior cases by browsing filenames
- A new investigation symptom resembles a prior one and recall fails

Below those thresholds, top-K retrieval and "load all" return roughly the same content. Don't build it earlier — embedding 10 documents is theater.

## Goal

Add a semantic search backend so `/rag:context` and a new `/rag:search` skill can return the most relevant prior findings for a query, ranked by cosine similarity, instead of dumping or TOC-ing whole subfolders.

## Non-goals

- Replacing the file-based source of truth. Markdown files remain canonical; the index is derived state.
- Online (LLM-graded) reranking. Pure vector similarity is enough at this corpus size.
- Real-time indexing on every save. Reindex on demand or on git commit; staleness of a few minutes is fine.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Existing markdown corpus (canonical)                         │
│   rag-memory/system/**/*.md                                  │
│   rag-memory/issues/closed/**/*.md                           │
│   rag-memory/issues/archive/**/*.md                          │
└──────────────────────┬──────────────────────────────────────┘
                       │  reindex (manual or git hook)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Indexer (bin/rag-index)                                      │
│   - walk corpus                                              │
│   - chunk each file by `##` heading                          │
│   - extract metadata block (Source / Finding / Impact)       │
│   - embed each chunk                                         │
│   - upsert into vector store with file path + heading + hash │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Vector store (single-file, local)                            │
│   rag-memory/.rag-index/index.db                             │
└──────────────────────┬──────────────────────────────────────┘
                       │  query (top-K nearest)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Search MCP server (.mcp.json: rag-search)                    │
│   - tool: rag.search(query, k=5, scope=system|closed|all)    │
│   - returns: [{path, heading, snippet, score}]               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Skills that consume retrieval                                │
│   /rag:search        new — direct similarity query           │
│   /rag:context       upgraded — top-K instead of dump-all    │
└─────────────────────────────────────────────────────────────┘
```

## Tech choices (with cheapest defaults)

| Concern | Default pick | Why | Alternatives |
|---|---|---|---|
| Embedding model | `BAAI/bge-small-en-v1.5` via `sentence-transformers` (local, ~133 MB) | Free, no API key, runs on CPU, strong on technical text | Voyage `voyage-3-lite` (better quality, hosted, ~$0.02/1M tok); OpenAI `text-embedding-3-small` |
| Vector store | `sqlite-vec` extension on a single `.db` file | One file, no server, ships in the corpus directory | LanceDB (also single-file); Chroma persistent; Qdrant (overkill) |
| Indexer language | Python | sentence-transformers ergonomics, sqlite-vec bindings | Node + transformers.js if Python is unavailable |
| Search interface | MCP server defined in `.mcp.json` | Plugin-native, tool-callable from any skill | Bash CLI; HTTP service (overkill) |

## Chunking strategy

The corpus already chunks itself. Every promoted finding lives under a `##` heading with a fixed metadata block:

```markdown
## [Short title]
**Source**: CARD-XXXXX | YYYY-MM-DD
**Finding**: [Body]
**Impact**: [What this affects going forward]
```

That's an ideal retrieval unit: self-contained, named, traceable to source. Each file also opens with
a YAML **frontmatter** header (schema 3) carrying file-level metadata — `title`, `domain`,
`source_cards`, `created`/`updated`, `status`, `format_gen`, `tags` — that the indexer can parse
once and attach to every chunk from that file (enabling domain/tag/status filtering at query time).
The indexer should:

1. Parse each `.md` file; lift the YAML frontmatter header (if present) into file-level metadata
2. Split the body on `##` boundaries (treat content before the first `##` as file-level overview, embed it as its own chunk with heading "_overview_")
3. For each chunk, store: file path, heading, full chunk text, content hash, the file-level frontmatter fields, and the embedding
4. Skip chunks shorter than ~50 chars (template stubs, empty placeholders)

## File-level plan

New artifacts to add at activation time:

```
rag/
├── .mcp.json                       # populate with rag-search server config
├── bin/
│   ├── rag-index                   # CLI: walk corpus, embed, upsert
│   ├── rag-search                  # CLI: query the index (debugging)
│   └── rag-mcp                     # MCP server entrypoint
├── lib/                            # new — Python source for indexer + server
│   ├── indexer.py
│   ├── chunker.py
│   ├── store.py                    # sqlite-vec wrapper
│   └── server.py                   # MCP server
├── pyproject.toml                  # pin sentence-transformers, sqlite-vec, mcp
└── skills/
    ├── search/                     # new skill
    │   └── SKILL.md
    └── context/SKILL.md            # update to call rag.search instead of dump-all
```

The `rag-memory/.rag-index/` directory inside the user's data corpus holds the SQLite file — never inside the plugin itself, because the plugin is shared across machines but the index is per-user.

## `.mcp.json` shape (when activated)

```json
{
  "mcpServers": {
    "rag-search": {
      "command": "${CLAUDE_PLUGIN_ROOT}/bin/rag-mcp",
      "args": [],
      "env": {
        "RAG_CORPUS_ROOT": "${RAG_CORPUS_ROOT:-./rag-memory}"
      }
    }
  }
}
```

The MCP server exposes one tool initially:

```
rag.search(query: string, k: int = 5, scope: "system" | "closed" | "archive" | "all" = "all")
  → [{path, heading, snippet, score, source_card?, date?}]
```

## Skill changes

### New: `/rag:search`
Plain similarity query. Useful for: "have we seen anything like X before?" without the user having to know which folder to look in. Returns ranked snippets with file paths so the user can drill in.

### Updated: `/rag:context`
Replace the "load all of `system/`" / TOC dump behavior with: pull the active card's `context.md` symptom + last few `trace.md` entries, embed that as a query, and retrieve top-K from `system/` and `issues/closed/`. Cite each retrieved snippet with file path + score. The "Suggested First Prompt" gets meaningfully smarter because it now sees actually-relevant prior findings.

Fallback: if the index is empty or stale, fall back to current behavior. Don't fail loudly.

### Unchanged: `/rag:init`, `/rag:card`, `/rag:trace`, `/rag:promote`
All write-side operations. They don't need retrieval. `/rag:promote` should optionally trigger reindex of the affected `system/` file, but a manual `bin/rag-index` invocation works fine for v1.

## Indexing trigger

V1: manual. User runs `bin/rag-index` after a session where they promoted things, or as a daily cron. The MCP server reads from the index, doesn't write to it.

V2 (later, only if friction): a `PostToolUse` hook on Edit/Write inside the corpus directory that fires `bin/rag-index --incremental` for the changed file.

## Estimated effort

| Phase | Effort | Output |
|---|---|---|
| Indexer + store | 2 hr | `bin/rag-index` produces a populated SQLite file |
| MCP server | 1 hr | `rag.search` tool callable from a skill |
| `/rag:search` skill | 30 min | New skill that calls the tool, formats results |
| `/rag:context` upgrade | 1 hr | Replaces dump-all with top-K |
| Testing on real corpus | 1 hr | Tune k, snippet length, score threshold |
| **Total** | **~5.5 hr** | |

## Open questions to settle at activation time

1. **Embedding model latency vs. quality.** `bge-small` is ~30 ms/query on CPU; if the user wants sub-10ms, switch to a smaller model or precompute query embeddings.
2. **Cross-card vs. system-only retrieval default.** Should `/rag:context` retrieve from `issues/closed/` by default, or only `system/`? Probably both — closed cards often hold the richest context for "we saw this before."
3. **Reindex on `/rag:promote`?** Cleanest UX, but couples the skill to Python+sqlite-vec runtime. Easier to ship without and add later.
4. **Score threshold for "no good match."** If top-K is all below ~0.6 cosine similarity, say "nothing relevant found" instead of returning weak hits.
5. **Privacy / local-only.** Embeddings of `system/` may be sensitive (it describes proprietary system behavior). Default to a local model — never ship anything to a hosted embedding API without explicit opt-in.

## What this does NOT change

- Markdown files remain canonical and human-editable
- All current skills continue to work even if the index is missing
- Plugin still functions identically without `bin/` populated
- No changes to `/rag:init`, `/rag:card`, `/rag:trace`, `/rag:promote` interfaces

## Activation checklist

When the corpus crosses the threshold above:

- [ ] Add `pyproject.toml` and pin `sentence-transformers`, `sqlite-vec`, `mcp` SDK
- [ ] Build `bin/rag-index` and `lib/indexer.py` + `lib/chunker.py` + `lib/store.py`
- [ ] Build `bin/rag-mcp` and `lib/server.py`
- [ ] Populate `.mcp.json` with the `rag-search` server entry
- [ ] Write `skills/search/SKILL.md`
- [ ] Update `skills/context/SKILL.md` to use `rag.search`
- [ ] Update `skills/memory/SKILL.md` "Note on actual retrieval" section to say it's now active
- [ ] Run `bin/rag-index` once to seed
- [ ] Smoke test: query with the symptom of an active card, verify top hits make sense
- [ ] Document the indexing cadence the user should adopt
