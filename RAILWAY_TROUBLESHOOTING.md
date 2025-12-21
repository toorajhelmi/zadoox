# Railway Deployment Troubleshooting

## Error: "Error creating build plan with Railpack"

This error typically occurs when Railway can't detect or parse the build configuration.

### Solution 1: Configure Build Settings in Railway Dashboard

Instead of relying on `railway.toml`, configure build settings directly in Railway dashboard:

1. Go to Railway Dashboard → Your Project → Service Settings
2. Set **Root Directory**: `code/packages/backend`
3. Set **Build Command**: 
   ```bash
   cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @zadoox/shared build && pnpm --filter backend build
   ```
4. Set **Start Command**: `node dist/server.js`
5. Save and redeploy

### Solution 2: Ensure pnpm-lock.yaml is at Repository Root

Railway needs to detect pnpm. Make sure `code/pnpm-lock.yaml` exists at the repository root.

### Solution 3: Use Dockerfile (Alternative)

If Railway continues to have issues with buildpack detection, you can create a Dockerfile:

```dockerfile
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm@8.12.0

WORKDIR /app

# Copy workspace files
COPY code/pnpm-workspace.yaml code/package.json code/pnpm-lock.yaml ./
COPY code/packages ./packages

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @zadoox/shared build
RUN pnpm --filter backend build

WORKDIR /app/packages/backend

EXPOSE 3001

CMD ["node", "dist/server.js"]
```

Place this at `code/packages/backend/Dockerfile` and Railway will use it instead of buildpacks.

### Solution 4: Check Railway Service Configuration

1. Verify the service root directory is set to `code/packages/backend`
2. Check that Railway has access to the repository
3. Ensure the branch being deployed is `main` (or your configured branch)

### Common Issues

- **Monorepo structure**: Railway might have trouble with the monorepo structure. Setting explicit build commands in the dashboard usually resolves this.
- **pnpm detection**: Railway should auto-detect pnpm from `pnpm-lock.yaml`, but if it doesn't, use Solution 1.
- **Build command complexity**: The `cd ../..` might confuse Railway. Using dashboard settings gives more control.

