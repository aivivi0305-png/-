#!/bin/bash
# Installs dependencies for both projects in this repo so that lint, build, and
# the SNS validate script work immediately in Claude Code on the web sessions.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

echo "Installing SNS autopilot dependencies..."
npm install --no-audit --no-fund

echo "Installing Taste Engine dependencies..."
npm install --prefix taste-engine --no-audit --no-fund

echo "Setup complete."
