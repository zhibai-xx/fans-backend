#!/usr/bin/env bash
# Dependencies: node (npm), prisma CLI
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RUN_INTEGRATION=${RUN_INTEGRATION:-1}

run_step() {
  local label="$1"
  shift
  echo "[checks] Running $label..."
  "$@"
}

run_step "lint" npm run lint
run_step "typecheck" npm run typecheck
run_step "unit tests" npm run test

if [[ "$RUN_INTEGRATION" == 1 ]]; then
  run_step "integration tests" npm run test:e2e
else
  echo "[checks] Skipping integration tests (RUN_INTEGRATION=$RUN_INTEGRATION)."
fi

run_step "openapi contract verify" npm run openapi:verify
