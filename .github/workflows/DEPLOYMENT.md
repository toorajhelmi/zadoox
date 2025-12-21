# Deployment Guide

This document outlines the deployment setup for Zadoox services.

## Overview

- **Backend API**: Deploys to Railway (using GitHub Actions workflow)
- **Web App**: Deploys to Vercel (using Vercel's GitHub integration - no workflow needed)
- **Database**: Supabase (managed service, no deployment needed)

---

## Backend Deployment (Railway)

**Status**: Workflow ready, will be activated in Phase 3

**Workflow**: `.github/workflows/deploy-backend.yml`

### Setup Steps (When Backend is Ready - Phase 3):

1. **Create Railway Project**:
   - Go to https://railway.app
   - Create new project
   - Connect to GitHub repository
   - Select the `code/packages/backend` directory as the root

2. **Add GitHub Secret**:
   - Go to GitHub repo → Settings → Secrets and variables → Actions
   - Add secret: `RAILWAY_TOKEN`
   - Get token from Railway: Project Settings → Tokens → Generate New Token

3. **Configure Railway Environment Variables**:
   - In Railway dashboard, add these environment variables:
     - `DATABASE_URL` - Supabase connection string
     - `SUPABASE_URL` - Supabase project URL
     - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
     - `OPENAI_API_KEY` - OpenAI API key (if using AI features)
     - `NODE_ENV` - `production`
     - `PORT` - Railway sets this automatically

4. **Configure Railway Build Settings**:
   - Build Command: `cd ../.. && pnpm install --frozen-lockfile && pnpm build --filter backend`
   - Start Command: `node dist/packages/backend/src/server.js` (adjust based on your build output)
   - Root Directory: `code/packages/backend`

5. **Test Deployment**:
   - Push to `main` branch (after backend code is ready)
   - Workflow will trigger automatically on backend changes
   - Monitor deployment in Railway dashboard

### Deployment Triggers:
- Automatic: Push to `main` branch when backend code changes
- Manual: Use "Run workflow" button in GitHub Actions

### Alternative: Railway GitHub Integration
Instead of using GitHub Actions, you can use Railway's GitHub integration:
- Railway will automatically deploy on push to main
- No GitHub Actions workflow needed
- Simpler setup, less control

---

## Web App Deployment (Vercel)

**Status**: Setup needed in Phase 7

**No GitHub Actions workflow needed** - Vercel uses its own GitHub integration.

### Setup Steps (When Web App is Ready - Phase 7):

1. **Connect Vercel to GitHub**:
   - Go to https://vercel.com
   - Import your GitHub repository
   - Select repository: `zadoox`

2. **Configure Build Settings**:
   - Framework Preset: `Next.js`
   - Root Directory: `code/packages/web`
   - Build Command: `cd ../.. && pnpm install --frozen-lockfile && pnpm build --filter web`
   - Output Directory: `.next` (Next.js default)
   - Install Command: `pnpm install --frozen-lockfile`

3. **Add Environment Variables**:
   - In Vercel project settings → Environment Variables:
     - `NEXT_PUBLIC_API_URL` - Backend API URL (e.g., `https://your-backend.railway.app`)
     - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
     - `NODE_ENV` - `production`

4. **Deploy**:
   - Vercel automatically deploys on:
     - Push to `main` branch → Production deployment
     - Pull requests → Preview deployments
     - Any branch → Preview deployment (optional)

---

## Database Setup (Supabase)

**Status**: Setup needed in Phase 2

### Setup Steps:

1. **Create Supabase Project**:
   - Go to https://supabase.com
   - Create new project
   - Note down:
     - Project URL
     - Anon key (for client-side)
     - Service role key (for backend - keep secret!)

2. **Run Migrations**:
   - Use Supabase SQL Editor or migration tool
   - Create tables: users, projects, documents
   - Set up Row Level Security (RLS) policies
   - Create indexes

3. **Configure Storage** (if needed):
   - Create storage buckets for document assets
   - Set up bucket policies

---

## Deployment Flow

### Development:
1. Create feature branch
2. Make changes
3. Push to feature branch
4. CI runs (build, test, type-check)
5. Create PR
6. CI runs again on PR
7. After review, merge to `main`

### Production:
1. Merge PR to `main`
2. CI runs automatically
3. If CI passes:
   - **Backend**: GitHub Actions workflow deploys to Railway
   - **Web**: Vercel automatically deploys (via GitHub integration)
4. Monitor deployments in respective dashboards

---

## Environment Variables Summary

### Backend (Railway):
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
NODE_ENV=production
PORT=3000 (auto-set by Railway)
```

### Web App (Vercel):
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NODE_ENV=production
```

### Database (Supabase):
- Managed in Supabase dashboard
- Connection strings generated automatically

---

## Monitoring Deployments

### Railway:
- Dashboard: https://railway.app/dashboard
- View logs, metrics, deployments
- Rollback if needed

### Vercel:
- Dashboard: https://vercel.com/dashboard
- View deployments, logs, analytics
- Rollback to previous deployment
- Preview deployments for PRs

### Supabase:
- Dashboard: https://supabase.com/dashboard
- Database logs, query performance
- Storage usage
- Auth logs

---

## Troubleshooting

### Backend Deployment Fails:
1. Check Railway logs
2. Verify environment variables are set
3. Check build output in GitHub Actions logs
4. Ensure `RAILWAY_TOKEN` secret is correct

### Web App Deployment Fails:
1. Check Vercel build logs
2. Verify environment variables
3. Check build command and output directory
4. Ensure root directory is correct (`code/packages/web`)

### Database Connection Issues:
1. Verify connection string is correct
2. Check Supabase project is active
3. Verify network access (IP allowlist if enabled)
4. Check RLS policies aren't blocking access

---

## Next Steps

- [ ] Phase 2: Set up Supabase project and database schema
- [ ] Phase 3: Set up Railway project and configure backend deployment
- [ ] Phase 7: Set up Vercel project and configure web app deployment


