#!/bin/bash
set -e

# Load environment variables from .env.production.local if it exists
if [ -f ".env.production.local" ]; then
  echo "Loading environment variables from .env.production.local..."
  set -a
  source .env.production.local
  set +a
  echo "Environment variables loaded"
fi

# Run the build
exec pnpm build

