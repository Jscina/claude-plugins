#!/usr/bin/env bash
# Ensures the decision-engine MCP server is built.
# Runs at SessionStart. Idempotent: exits immediately if dist/server.js
# already exists, so the cost is paid only on the first session after install
# (or after a clean of dist/).

set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SERVER_DIR="${PLUGIN_ROOT}/mcp-server"
DIST_ENTRY="${SERVER_DIR}/dist/server.js"

if [[ -f "${DIST_ENTRY}" ]]; then
  exit 0
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "[decision-engine] node/npm not found on PATH; cannot build MCP server." >&2
  echo "[decision-engine] Install Node.js >= 20 and reload, or run 'npm install && npm run build' in ${SERVER_DIR}" >&2
  exit 0
fi

echo "[decision-engine] First-time build of MCP server (one-time, ~30s)..." >&2
cd "${SERVER_DIR}"

if [[ ! -d node_modules ]]; then
  npm install --no-audit --no-fund --loglevel=error >&2
fi

npm run --silent build >&2
echo "[decision-engine] Build complete: ${DIST_ENTRY}" >&2
