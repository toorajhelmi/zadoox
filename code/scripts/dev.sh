#!/bin/bash
# Start both backend and frontend servers

set -e

echo "🚀 Starting Zadoox development servers..."
echo ""

# Start backend and frontend in parallel
cd "$(dirname "$0")/.."
pnpm --parallel --filter './packages/backend' --filter './packages/web' dev

