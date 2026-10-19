#!/bin/bash
# Installs the npm packages in Claude Code cloud sessions, so typecheck, tests and
# builds work from the first command. On the PC it does nothing.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
# npm install rather than npm ci: it reuses node_modules from the cached container
npm install --no-audit --no-fund
