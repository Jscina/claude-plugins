# Releasing a plugin from this marketplace

Maintainer-facing checklist for cutting a release of any plugin under `plugins/<name>/`. This file lives
at the repo root and is **never bundled** into a plugin payload.

Releases are tag-driven: the marketplace pins each plugin to a git tag, so **a release is not live until
the `marketplace.json` ref is bumped to the new tag**. That ref bump is the step that actually ships a
version — and the one easiest to forget.

## Checklist (per plugin)

1. **Land the work.** Merge the feature PR(s) to `main` with CI green.
2. **Bump the version.** `plugins/<name>/.claude-plugin/plugin.json` -> new `X.Y.Z` (SemVer).
3. **Update the changelog.** Move the work under a new `[X.Y.Z] - YYYY-MM-DD` heading in
   `plugins/<name>/CHANGELOG.md` (Keep a Changelog format). Keep it ASCII.
4. **Commit** the version + changelog on `main` (no `Co-Authored-By` trailer).
5. **Tag and push the tag.** `git tag <name>--vX.Y.Z` then `git push origin <name>--vX.Y.Z`.
6. **Bump the marketplace ref.** In `.claude-plugin/marketplace.json` (repo root), point `<name>` at
   `<name>--vX.Y.Z`; commit and push. **This is the step that ships the version.**
7. **Create the GitHub release.** `gh release create <name>--vX.Y.Z --title "..." --notes "..."`.
8. **Verify** the plugin installs/updates from the marketplace at the new version.

## Gotchas (learned the hard way)

- **The marketplace ref bump is what actually releases.** Tagging and `gh release` alone do not change
  what users install; only the `marketplace.json` ref does.
- **Pushing `.github/workflows/**` needs the `workflow` OAuth scope.** If `gh` is your git credential
  helper and its token lacks `workflow`, the push is rejected: *"refusing to allow an OAuth App to create
  or update workflow ... without `workflow` scope."* Two fixes:
  - `gh auth refresh -h github.com -s workflow`, or
  - push over an **SSH** remote (`git remote set-url origin git@github.com:<owner>/<repo>.git`) — SSH is
    not subject to the OAuth scope guard.
  - Diagnose with `gh auth status` (token scopes) and
    `git config --get-all credential.https://github.com.helper`.
- **Release notes and PR bodies: ASCII only.** Non-ASCII (em dashes, arrows, smart quotes) renders badly.
  And **backtick any `@handle`** (e.g. `` `@rag:batman` ``) so GitHub does not autolink it as a contributor.
- **No `Co-Authored-By` trailer** on commits.
- **Specs and tests never ship.** `.spec/` and the repo-root `tests/` live outside `plugins/<name>/`, so
  they are not part of any plugin payload.
