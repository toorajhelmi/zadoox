#!/bin/bash
# Start both backend and frontend servers

set -e

echo "🚀 Starting Zadoox development servers..."
echo ""

cd "$(dirname "$0")/.."

# If `.env.local` opts into docker backend, run backend via docker compose.
# This is useful for system-level deps (e.g., tectonic for LaTeX->PDF) while keeping web dev local.
ENV_FILE="./packages/web/.env.local"
USE_DOCKER_BACKEND="false"
if [ -f "$ENV_FILE" ]; then
  if grep -qE '^ZADOOX_BACKEND_RUNTIME=docker$' "$ENV_FILE"; then
    USE_DOCKER_BACKEND="true"
  fi
fi

if [ "$USE_DOCKER_BACKEND" = "true" ]; then
  echo "🐳 Backend runtime: docker (from packages/web/.env.local: ZADOOX_BACKEND_RUNTIME=docker)"
  echo "   Starting backend via docker compose..."
  docker compose -f ./docker-compose.yml up -d backend
  echo "   Starting web dev server..."
  pnpm --filter './packages/web' dev
else
  # Default: start backend and frontend in parallel
  pnpm --parallel --filter './packages/backend' --filter './packages/web' dev
fi

