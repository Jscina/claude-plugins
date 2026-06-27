#!/usr/bin/env bash
# Compile this homewise plugin into self-contained claude.ai Skill ZIPs.
#
# claude.ai Skills are single, self-contained folders (no plugin-root shared assets and no PATH bin).
# This script generates an upload-ready ZIP per skill FROM this plugin (the single source): it bundles
# the shared rubric + templates + scripts into each skill folder and rewrites ${CLAUDE_PLUGIN_ROOT}/
# asset paths to be relative. Edit the plugin; re-run this; never hand-maintain a separate browser copy.
#
# Usage: ./build-claude-skills.sh [output_dir]   (default: ./dist)
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="${1:-$here/dist}"
mkdir -p "$out"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for skill in evaluate compare; do
  dir="$tmp/$skill"
  mkdir -p "$dir"
  # SKILL.md: rewrite plugin-root asset paths to relative (self-contained folder)
  sed 's#\${CLAUDE_PLUGIN_ROOT}/##g' "$here/skills/$skill/SKILL.md" > "$dir/SKILL.md"
  cp -a "$here/references" "$dir/references"
  cp -a "$here/templates"  "$dir/templates"
  cp -a "$here/scripts"    "$dir/scripts"
  find "$dir" -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null || true
  rm -f "$out/homewise-$skill-claude-skill.zip"
  python3 - "$out/homewise-$skill-claude-skill" "$tmp" "$skill" <<'PY'
import shutil, sys
base, root, folder = sys.argv[1], sys.argv[2], sys.argv[3]
shutil.make_archive(base, "zip", root, folder)
PY
  echo "built $out/homewise-$skill-claude-skill.zip"
done
