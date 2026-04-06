#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
TARGET_PATH="${1:-}"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

rsync -a --delete --exclude .git "$ROOT_DIR"/ "$TMP_DIR"/

DOCKER_CMD=(
  docker run --rm
  -v "$TMP_DIR":/app
  -w /app
  -e NODE_ENV=test
  -e JWT_SECRET=ci-test-jwt-secret
  -e JWT_REFRESH_SECRET=ci-test-refresh-secret
  -e ALLOW_SOCKET_TESTS=true
  node:20
  bash -lc
)

if [[ -n "$TARGET_PATH" ]]; then
  "${DOCKER_CMD[@]}" "npm ci && npx prisma generate && npx eslint \"$TARGET_PATH\""
else
  "${DOCKER_CMD[@]}" "npm ci && npx prisma generate && npm run lint"
fi
