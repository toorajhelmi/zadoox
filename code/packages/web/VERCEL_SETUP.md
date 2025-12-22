# Vercel Deployment Setup Guide

This guide walks you through setting up Vercel deployment for the Zadoox web app.

## Prerequisites

- Vercel account (sign up at https://vercel.com)
- GitHub repository access
- Supabase project configured (from Phase 2)

## Setup Steps

### 1. Connect Vercel to GitHub

1. Go to https://vercel.com and sign in
2. Click "Add New..." → "Project"
3. Import your GitHub repository: `toorajhelmi/zadoox`
4. Vercel will detect it's a Next.js project

### 2. Configure Project Settings

**Framework Preset**: Next.js (auto-detected)

**Root Directory**: 
- Click "Edit" next to Root Directory
- Set to: `code/packages/web`

**Build and Output Settings**:
- Build Command: `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @zadoox/web build`
- Output Directory: `.next` (default for Next.js)
- Install Command: `cd ../.. && pnpm install --frozen-lockfile`

**Note**: Since this is a monorepo, we need to:
- Navigate to the root directory (`../..`)
- Install all dependencies
- Build only the web package using pnpm filter

### 3. Add Environment Variables

In Vercel project settings → Environment Variables, add:

**Required**:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Optional** (for future phases):
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

**How to get Supabase values**:
1. Go to Supabase Dashboard → Settings → API
2. Copy "Project URL" → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy "anon public" key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Deploy

1. Click "Deploy"
2. Vercel will:
   - Install dependencies
   - Build the Next.js app
   - Deploy to production
3. You'll get a URL like: `https://zadoox.vercel.app`

### 5. Configure Automatic Deployments

Vercel automatically:
- **Production**: Deploys on push to `main` branch
- **Preview**: Creates preview deployments for pull requests
- **Branch**: Can deploy any branch (optional)

## Verification

After deployment:

1. Visit your Vercel URL
2. Check that the home page loads
3. Test navigation to `/auth/login` and `/auth/signup`
4. Verify pages render correctly

## Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Vercel will handle SSL certificates automatically

## Environment Variables by Environment

You can set different values for:
- **Production**: `main` branch
- **Preview**: Pull requests and other branches
- **Development**: Local development (use `.env.local`)

## Troubleshooting

### Build Fails

**Error**: "Cannot find module"
- **Solution**: Ensure root directory is set to `code/packages/web`
- **Solution**: Check that build command navigates to root first

**Error**: "pnpm: command not found"
- **Solution**: Vercel should auto-detect pnpm, but you can specify in package.json:
  ```json
  "packageManager": "pnpm@8.0.0"
  ```

### Environment Variables Not Working

- Ensure variables start with `NEXT_PUBLIC_` for client-side access
- Redeploy after adding new environment variables
- Check that variables are set for the correct environment (Production/Preview)

### Monorepo Issues

- Ensure build command runs from repository root
- Use pnpm filter to build only the web package
- Check that `pnpm-workspace.yaml` is in the root

## Next Steps

After Vercel is set up:
- ✅ Phase 4 deployment complete
- Continue with Phase 5: Dashboard development
- Fix authentication in Phase 14

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Monorepo Deployment](https://vercel.com/docs/monorepos)

