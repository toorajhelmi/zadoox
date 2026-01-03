#!/bin/bash
# Start both backend and frontend servers

set -e

echo "🚀 Starting Zadoox development servers..."
echo ""

cd "$(dirname "$0")/.."

# Backend runtime switching (read from packages/web/.env.local):
# - ZADOOX_BACKEND_RUNTIME=local  -> run backend via pnpm (default)
# - ZADOOX_BACKEND_RUNTIME=dev    -> do not run backend locally (web only; assumes NEXT_PUBLIC_API_URL points to remote)
# - ZADOOX_BACKEND_RUNTIME=docker -> run backend via docker compose (for system deps like tectonic)
ENV_FILE="./packages/web/.env.local"
BACKEND_RUNTIME="local"
if [ -f "$ENV_FILE" ]; then
  if grep -qE '^ZADOOX_BACKEND_RUNTIME=dev$' "$ENV_FILE"; then
    BACKEND_RUNTIME="dev"
  elif grep -qE '^ZADOOX_BACKEND_RUNTIME=docker$' "$ENV_FILE"; then
    BACKEND_RUNTIME="docker"
  elif grep -qE '^ZADOOX_BACKEND_RUNTIME=local$' "$ENV_FILE"; then
    BACKEND_RUNTIME="local"
  fi
fi

if [ "$BACKEND_RUNTIME" = "docker" ]; then
  echo "🐳 Backend runtime: docker (from packages/web/.env.local: ZADOOX_BACKEND_RUNTIME=docker)"
  echo "   Starting backend via docker compose..."
  docker compose -f ./docker-compose.yml up -d backend
  echo "   Starting web dev server..."
  pnpm --filter './packages/web' dev
elif [ "$BACKEND_RUNTIME" = "dev" ]; then
  echo "🌐 Backend runtime: dev (from packages/web/.env.local: ZADOOX_BACKEND_RUNTIME=dev)"
  echo "   Starting web dev server only (backend assumed remote via NEXT_PUBLIC_API_URL)..."
  pnpm --filter './packages/web' dev
else
  # local (default): start backend and frontend in parallel
  pnpm --parallel --filter './packages/backend' --filter './packages/web' dev
fi

