# Railway Configuration Script

## Attempted API Configuration

We attempted to configure Railway via their GraphQL API, but encountered authentication issues. The token provided may need to be:

1. A Railway **Account API Token** (not just a project token)
2. Generated from: Railway Dashboard → Account Settings → Tokens → Generate New Token
3. With proper scopes/permissions for managing projects and services

## Current Status

✅ **Configuration documented in:**
- `code/packages/backend/railway.toml` - Build settings
- `code/implementation/RAILWAY_SETUP.md` - Setup guide
- `code/implementation/RAILWAY_TROUBLESHOOTING.md` - Troubleshooting

⚠️ **Manual configuration required in Railway Dashboard:**

Since Railway's API requires account-level tokens and specific permissions, the configuration must be done manually:

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Select your project** → **Backend service** → **Settings** tab
3. **Configure the following:**

   ```
   Root Directory: code/packages/backend
   
   Build Command: 
   cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @zadoox/shared build && pnpm --filter backend build
   
   Start Command:
   node dist/server.js
   ```

4. **Save and redeploy**

## Why Manual Configuration?

Railway's GitHub integration handles:
- ✅ Automatic deployments on push to `main`
- ✅ Code pulling and building
- ❌ But **cannot** auto-configure monorepo-specific build settings

The build settings must be configured once in the dashboard to tell Railway:
- Where to find the backend service (`rootDirectory`)
- How to build it (accounting for the shared package dependency)
- How to start it (using the compiled output)

## Alternative: Railway CLI

If you install Railway CLI, you can configure via command line:
```bash
railway link  # Link to your project
railway variables set ROOT_DIRECTORY="code/packages/backend"
# etc.
```

But the dashboard UI is the simplest approach.




