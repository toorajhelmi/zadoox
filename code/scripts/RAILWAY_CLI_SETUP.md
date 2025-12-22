# Railway CLI Setup Guide

## Installation

✅ Railway CLI is installed: `railway 4.16.1`

## Authentication

1. **Login to Railway CLI:**
   ```bash
   railway login
   ```
   This will open your browser to authenticate with Railway.

2. **Verify login:**
   ```bash
   railway whoami
   ```

## Linking to Your Project

Since your Railway project is already connected to GitHub, you can link it:

1. **Navigate to backend directory:**
   ```bash
   cd code/packages/backend
   ```

2. **Link to your Railway project:**
   ```bash
   railway link
   ```
   - Select your project from the list
   - Select your service (backend)

3. **Verify link:**
   ```bash
   railway status
   ```

## Configuration

Railway should automatically detect the `railway.toml` file in `code/packages/backend/` which contains:

```toml
[build]
builder = "nixpacks"
buildCommand = "cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @zadoox/shared build && pnpm --filter backend build"

[deploy]
startCommand = "node dist/server.js"
healthcheckPath = "/health"
```

However, Railway's GitHub integration may not automatically use these settings for monorepos. You may still need to configure via the dashboard.

## Using Railway CLI

After linking, you can:

- **View logs:**
  ```bash
  railway logs
  ```

- **View status:**
  ```bash
  railway status
  ```

- **Set environment variables:**
  ```bash
  railway variables set DATABASE_URL="postgresql://..."
  railway variables set SUPABASE_URL="https://..."
  railway variables set SUPABASE_SERVICE_ROLE_KEY="eyJ..."
  railway variables set SUPABASE_ANON_KEY="eyJ..."
  railway variables set SUPABASE_JWT_SECRET="your-jwt-secret"
  railway variables set NODE_ENV="production"
  ```

- **List variables:**
  ```bash
  railway variables
  ```

- **Redeploy:**
  ```bash
  railway redeploy
  ```

- **Open dashboard:**
  ```bash
  railway open
  ```

## Important Notes

1. **Build Settings**: Even with `railway.toml`, you may need to manually configure in the dashboard:
   - Root Directory: `code/packages/backend`
   - Build Command: (as specified in railway.toml)
   - Start Command: (as specified in railway.toml)

2. **GitHub Integration**: Railway's GitHub integration handles deployments automatically, but build settings configuration may still require dashboard access.

3. **Monorepo**: Railway's automatic detection works best for single-package repos. Monorepos often require explicit configuration.

## Troubleshooting

If Railway CLI doesn't detect your configuration:

1. Check that you're in the correct directory (`code/packages/backend`)
2. Verify `railway.toml` exists in that directory
3. Use the dashboard to manually configure build settings
4. See `code/implementation/RAILWAY_SETUP.md` for detailed setup instructions



