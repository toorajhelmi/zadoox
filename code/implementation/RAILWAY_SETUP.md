# Railway Deployment Setup Guide

This guide explains how to set up Railway deployment for the Zadoox backend API.

## Prerequisites

1. Railway account (sign up at https://railway.app)
2. GitHub repository connected to Railway
3. Backend code ready (Phase 3 ✅)

## Setup Steps

### 1. Create Railway Project

1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `zadoox` repository
5. Railway will detect the `code/packages/backend` directory automatically

### 2. Configure Build Settings

Railway will auto-detect settings from `railway.toml`, but verify:

- **Root Directory**: `code/packages/backend`
- **Build Command**: `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter backend build`
- **Start Command**: `pnpm --filter backend start`
- **Healthcheck**: `/health` (automatic from railway.toml)

### 3. Add Environment Variables

In Railway dashboard → Project → Variables, add:

```env
DATABASE_URL=postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret-here
NODE_ENV=production
```

**How to get values:**
- `DATABASE_URL`: Supabase Dashboard → Settings → Database → Connection string (Pooler)
- `SUPABASE_URL`: Supabase Dashboard → Settings → API → Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard → Settings → API → service_role key (secret!)
- `SUPABASE_ANON_KEY`: Supabase Dashboard → Settings → API → anon public key
- `SUPABASE_JWT_SECRET`: Supabase Dashboard → Settings → API → JWT Secret

### 4. Enable GitHub Actions Deployment (Optional)

If you want to use GitHub Actions instead of Railway's auto-deploy:

1. **Get Railway Token**:
   - Railway Dashboard → Project Settings → Tokens
   - Generate new token
   - Copy the token

2. **Add GitHub Secret**:
   - GitHub repo → Settings → Secrets and variables → Actions
   - New repository secret: `RAILWAY_TOKEN`
   - Paste the Railway token

3. **Enable Deployment Workflow**:
   - Edit `.github/workflows/deploy.yml`
   - Change `if: false` to `if: true` on line 87
   - Uncomment the Railway deployment step (lines 90-94)

### 5. Test Deployment

1. Push to `main` branch
2. Railway will automatically:
   - Build the backend
   - Run migrations (via GitHub Actions)
   - Start the server
   - Health check at `/health`

3. Verify deployment:
   - Check Railway logs
   - Visit `https://your-app.railway.app/health`
   - Should see: `{"status":"ok","service":"zadoox-backend"}`

### 6. Get Deployment URL

After deployment, Railway provides a URL:
- Format: `https://[service-name].railway.app`
- This is your backend API URL
- Use this in web app environment variables: `NEXT_PUBLIC_API_URL`

## Railway GitHub Integration (Recommended - Currently Used)

✅ **You're using Railway's GitHub integration** (recommended approach)

1. Railway will auto-deploy on every push to `main`
2. No GitHub Actions deployment step needed
3. Simpler setup, Railway handles builds and deployments automatically
4. GitHub Actions workflow still runs migrations before Railway deployment

**How it works:**
- Railway watches your GitHub repository
- On push to `main`, Railway automatically:
  - Pulls the latest code
  - Runs the build (as configured in Railway dashboard)
  - Deploys the service
- The GitHub Actions workflow (`deploy.yml`) runs database migrations first, then Railway deploys

**Note:** If you want to use GitHub Actions for deployment instead:
- You would need to add `RAILWAY_TOKEN` secret to GitHub
- Uncomment the Railway deployment step in `.github/workflows/deploy.yml`
- This would result in Railway deploying twice (once via integration, once via GitHub Actions)

## Troubleshooting

### Build fails
- Check Railway logs for errors
- Ensure `pnpm-lock.yaml` is committed
- Verify build command works locally

### Server doesn't start
- Check environment variables are set
- Verify `DATABASE_URL` is correct
- Check Railway logs for connection errors

### Health check fails
- Ensure `/health` endpoint is accessible
- Check server is binding to `0.0.0.0` (not `localhost`)
- Verify `PORT` environment variable is set (Railway sets this automatically)

## Next Steps

After Railway is set up:
1. ✅ Backend will auto-deploy on push to `main`
2. ✅ Get backend URL for web app configuration
3. ✅ Update web app `NEXT_PUBLIC_API_URL` environment variable
4. ✅ Test full stack integration

