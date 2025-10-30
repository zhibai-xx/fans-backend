#!/usr/bin/env bash
# Dependencies: node (npm), docker, prisma CLI
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

cd "$ROOT_DIR"

if [ -f "$ENV_FILE" ]; then
  echo "[dev] Loading environment variables from $ENV_FILE"
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
else
  echo "[dev] No .env file found, continuing without sourcing."
fi

echo "[dev] Checking database connectivity via Prisma migrate status..."
npx prisma migrate status --schema "$ROOT_DIR/prisma/schema.prisma"

echo "[dev] Applying pending migrations (deploy)..."
npx prisma migrate deploy --schema "$ROOT_DIR/prisma/schema.prisma"

echo "[dev] Starting NestJS development server..."
npm run start:dev
