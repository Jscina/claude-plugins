---
name: init
description: Scaffold the full rag-memory/ directory structure for a two-layer RAG memory system (System Knowledge + Issue Memory). Use this skill whenever the user wants to initialize, set up, scaffold, or create the RAG memory directory from scratch. Triggers include "initialize rag memory", "set up rag directory", "scaffold rag", "create my rag memory structure", or any request to bootstrap the RAG system for the first time. Also use when the user says they want to start using the RAG memory system or asks how to set it up.
---

# RAG Init

Scaffold the complete `rag-memory/` directory structure on the local filesystem, matching the two-layer RAG memory system spec (System Knowledge for long-term versioned knowledge, Issue Memory for active work).

## Workflow

1. **Ask for root path.** Ask the user where `rag-memory/` should be created. Default to the current working directory if they don't specify.

2. **Create the full directory tree.** Build all folders:
   ```
   rag-memory/
   ├── system/
   │   ├── architecture/
   │   ├── schemas/
   │   ├── services/
   │   └── known-behaviors/
   └── issues/
       ├── active/
       ├── closed/
       └── archive/
   ```

3. **Seed all instruction files from templates.** Read each template from this skill's `templates/` directory and write them to the correct locations:
   - `rag-memory/README.md` ← from `templates/root-readme.md`
   - `rag-memory/BENCHMARKS.md` ← from `templates/benchmarks.md`
   - `rag-memory/system/README.md` ← from `templates/system-readme.md`
   - `rag-memory/issues/README.md` ← from `templates/issues-readme.md`

4. **Confirm to the user.** Print the created directory tree and remind them of next steps:
   - Version the `system/` layer in Git
   - Create their first card with `/rag:card`
   - Refer to `BENCHMARKS.md` for promotion rules

## Key details

- All directories must be created even if empty (use `.gitkeep` files in empty leaf directories so Git tracks them)
- Never overwrite an existing `rag-memory/` directory — check first and warn the user
- Template files are in this skill's `templates/` folder — read them at runtime, don't hard-code content
