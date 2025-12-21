# CI/CD Setup Guide

## Overview

This document outlines the CI/CD setup for Zadoox using GitHub Actions.

## CI (Continuous Integration)

**When to set up**: Early (Phase 1.6) - right after testing infrastructure

**Purpose**: Verify code quality on every push/PR

### GitHub Actions Workflow

**Location**: `.github/workflows/ci.yml`

**Checks**:
1. ✅ Build all packages
2. ✅ Type checking (TypeScript)
3. ✅ Linting (ESLint)
4. ✅ Unit tests
5. ✅ Test coverage (optional)

**Triggers**:
- On push to any branch
- On pull requests
- Can run on schedule (nightly builds)

## CD (Continuous Deployment)

### Backend Deployment (Railway)

**When to set up**: Phase 3+ (when backend API is ready)

**Options**:
1. **Railway GitHub Integration** (Recommended - simpler)
   - Connect Railway to GitHub repo
   - Automatic deployments on push to main
   - Preview deployments for PRs (optional)

2. **GitHub Actions Deployment** (More control)
   - Manual deployment workflow
   - More control over deployment process
   - Can add custom steps

**Environment Variables**:
- Set in Railway dashboard
- Database URL, API keys, etc.

### Web App Deployment (Vercel)

**When to set up**: Phase 7+ (when web app is ready)

**Setup**:
1. Connect Vercel to GitHub repo
2. Configure build settings:
   - Framework: Next.js
   - Build command: `cd code && pnpm build --filter web`
   - Output directory: `code/packages/web/.next`
3. Environment variables:
   - Set in Vercel dashboard
   - API URL, Supabase keys, etc.

**Features**:
- ✅ Automatic deployments on push to main
- ✅ Preview deployments for PRs
- ✅ Branch previews
- ✅ Rollback capabilities

## Workflow Examples

### CI Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: 'code/pnpm-lock.yaml'
      
      - name: Install dependencies
        working-directory: ./code
        run: pnpm install --frozen-lockfile
      
      - name: Type check
        working-directory: ./code
        run: pnpm type-check
      
      - name: Lint
        working-directory: ./code
        run: pnpm lint
      
      - name: Build
        working-directory: ./code
        run: pnpm build
      
      - name: Test
        working-directory: ./code
        run: pnpm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./code/packages/*/coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella
```

### Backend Deployment (Optional - if using GitHub Actions)

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'code/packages/backend/**'
      - '.github/workflows/deploy-backend.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@v0.2.5
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend
          detach: true
```

## Branch Protection

**Recommended settings for `main` branch**:
- ✅ Require pull request reviews
- ✅ Require status checks to pass (CI workflow)
- ✅ Require branches to be up to date
- ✅ Include administrators

## Environment Variables

### Backend (Railway)
- `DATABASE_URL` - Supabase connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key
- `NODE_ENV` - production/development
- `PORT` - Server port (Railway sets this)

### Web App (Vercel)
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `NODE_ENV` - production/development

## Secrets Management

**GitHub Secrets** (for CI/CD workflows):
- `RAILWAY_TOKEN` - Railway deployment token (if using GitHub Actions)
- `VERCEL_TOKEN` - Vercel token (if using GitHub Actions)
- `CODECOV_TOKEN` - Codecov token (optional, for coverage)

**Where to set**:
- GitHub: Settings → Secrets and variables → Actions
- Railway: Project Settings → Variables
- Vercel: Project Settings → Environment Variables

## Deployment Strategy

### Development
- Push to `develop` branch → runs CI (no deployment)
- Manual deployment when needed

### Production
- Merge PR to `main` → runs CI → auto-deploys if CI passes
- Vercel: Automatic deployment
- Railway: Automatic deployment (via GitHub integration or Actions)

### Preview/Staging
- PR created → runs CI → creates preview deployment
- Vercel: Automatic preview deployments
- Railway: Optional preview environments

## Timeline Recommendation

1. **Phase 1.6 (Now)**: Set up CI workflow
   - Build checks
   - Type checking
   - Linting
   - Tests (when Phase 1.5 is done)

2. **Phase 3+ (Backend ready)**: Set up backend deployment
   - Connect Railway to GitHub
   - Configure environment variables
   - Test deployment

3. **Phase 7+ (Web app ready)**: Set up web app deployment
   - Connect Vercel to GitHub
   - Configure build settings
   - Set environment variables
   - Test deployment

## Benefits of Early CI Setup

✅ Catch build errors early
✅ Ensure code quality from the start
✅ Prevent broken code from being merged
✅ Build confidence in codebase
✅ Easy to add deployment later

## Next Steps

1. Create `.github/workflows/` directory
2. Set up CI workflow
3. Test it on a PR
4. Set up branch protection
5. Add deployment workflows when ready


