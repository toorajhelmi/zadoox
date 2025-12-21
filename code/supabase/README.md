# Supabase Migrations

This directory contains database migrations managed by Supabase CLI.

## Structure

```
supabase/
├── migrations/          # SQL migration files (timestamped)
├── config.toml         # Supabase CLI configuration
└── README.md           # This file
```

## Migration Files

Migrations are automatically applied when:
1. Code is pushed to `main` branch
2. GitHub Actions workflow runs (`.github/workflows/deploy-migrations.yml`)

### Current Migrations

1. `20241220000001_initial_schema.sql` - Creates initial tables (user_profiles, projects, documents)
2. `20241220000002_rls_policies.sql` - Sets up Row Level Security policies
3. `20241220000003_create_profile_trigger.sql` - Creates trigger to auto-create user profiles

## Local Development

To run migrations locally:

```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://postgres.lfyljalqovgibqpqzajd:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Or create .env file in packages/backend/ with:
# DATABASE_URL=postgresql://postgres.lfyljalqovgibqpqzajd:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true

# Run migrations
cd code
pnpm --filter backend db:migrate
```

## Creating New Migrations

1. Create a new migration file with timestamp in `supabase/migrations/`:
   - Format: `YYYYMMDDHHMMSS_description.sql`
   - Example: `20241220120000_add_user_settings.sql`

2. Write your SQL in the file

3. Test locally:
   ```bash
   export DATABASE_URL="your-connection-string"
   pnpm --filter backend db:migrate
   ```

4. Commit and push - migrations will run automatically via GitHub Actions

## Migration Naming Convention

Format: `YYYYMMDDHHMMSS_description.sql`

Example: `20241220120000_add_user_settings.sql`

## GitHub Secrets Required

For automated deployments, set this secret in GitHub:

- `DATABASE_URL` - Full PostgreSQL connection string
  - Format: `postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true`
  - Get from Supabase Dashboard → Settings → Database → Connection string (Pooler)
  - Replace `[PASSWORD]` with your actual database password

## Verifying Migrations

After migrations run, verify in Supabase dashboard:
- Tables should appear in Table Editor
- RLS should be enabled (yellow shield icon)
- Policies should be visible in Authentication → Policies
- Triggers should be visible in Database → Functions

