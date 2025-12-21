# Backend Setup Guide

This guide will help you set up the backend package for development.

## Prerequisites

- Node.js 20+
- pnpm installed
- Supabase project created

## Environment Variables

Create a `.env` file in `packages/backend/` with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here

# Database Connection (Optional - for direct PostgreSQL connections)
DATABASE_URL=postgresql://postgres.lfyljalqovgibqpqzajd:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true

# Server Configuration
NODE_ENV=development
PORT=3001

# OpenAI API (for AI features - Phase 5)
# OPENAI_API_KEY=sk-your-api-key-here
```

### Where to Find Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

### Where to Find Database Connection String

1. Go to **Settings** → **Database**
2. Find the **Connection string** section
3. Copy the **Pooler connection string** → `DATABASE_URL`
4. Replace `[YOUR-PASSWORD]` with your database password

## Database Setup

### 1. Run Migrations

Run the SQL migration files in order using the Supabase SQL Editor:

1. Go to Supabase Dashboard → **SQL Editor**
2. Run each migration file in order:
   - `src/db/migrations/001_initial_schema.sql`
   - `src/db/migrations/002_rls_policies.sql`
   - `src/db/migrations/003_create_profile_trigger.sql`

See `src/db/migrations/README.md` for more details.

### 2. Verify Tables

After running migrations, verify in Supabase Dashboard:
- Go to **Table Editor**
- You should see: `user_profiles`, `projects`, `documents`
- Each table should have a yellow shield icon (RLS enabled)

### 3. Test Database Connection

```bash
pnpm db:test
```

This will verify:
- Connection to Supabase works
- All tables exist and are accessible
- RLS is enabled

## Development

### Install Dependencies

```bash
cd code
pnpm install
```

### Run Development Server

```bash
pnpm --filter backend dev
```

The server will start on `http://localhost:3001`

### Build

```bash
pnpm --filter backend build
```

### Type Check

```bash
pnpm --filter backend type-check
```

## Project Structure

```
packages/backend/
├── src/
│   ├── db/
│   │   ├── client.ts          # Supabase client setup
│   │   ├── migrations/        # SQL migration files
│   │   └── README.md          # Database setup guide
│   ├── scripts/
│   │   └── test-db-connection.ts  # Database connection test
│   └── server.ts              # Fastify server entry point
├── .env                       # Environment variables (not committed)
└── package.json
```

## Next Steps

Once setup is complete, you can:
1. ✅ Verify database connection works
2. ✅ Test migrations were applied correctly
3. ➡️ Move to Phase 3: Backend API - Core Services


