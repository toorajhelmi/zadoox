# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.12.0 --activate

WORKDIR /app

# Copy package files
COPY code/package.json code/pnpm-lock.yaml code/pnpm-workspace.yaml code/tsconfig.json ./
COPY code/packages/shared/package.json code/packages/shared/tsconfig.json ./packages/shared/
COPY code/packages/backend/package.json code/packages/backend/tsconfig.json ./packages/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY code/packages/shared ./packages/shared
COPY code/packages/backend ./packages/backend

# Build shared and backend
RUN pnpm --filter @zadoox/shared build
RUN pnpm --filter backend build

# Verify build output
RUN ls -la /app/packages/backend/dist/ || (echo "ERROR: Backend dist not found" && exit 1)

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.12.0 --activate

# Copy workspace files
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy shared package (for workspace resolution)
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy backend package.json
COPY --from=builder /app/packages/backend/package.json ./packages/backend/package.json

# Install production dependencies (this will resolve workspace:*)
RUN pnpm install --prod --frozen-lockfile --filter backend

# Copy built backend dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Create symlink for easier access (backend will run from /app)
RUN ln -sf /app/packages/backend/dist ./dist

# Verify files were copied correctly
RUN ls -la /app/dist/ || (echo "ERROR: dist directory not found in production image" && exit 1)
RUN test -f /app/dist/server.js || (echo "ERROR: server.js not found" && exit 1)

EXPOSE 3001

CMD ["node", "dist/server.js"]

