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
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (get project ref from Supabase dashboard)
supabase link --project-ref your-project-ref --password your-db-password

# Push migrations
supabase db push
```

## Creating New Migrations

1. Create a new migration file with timestamp:
   ```bash
   supabase migration new migration_name
   ```

2. This creates a file like: `supabase/migrations/20241220120000_migration_name.sql`

3. Write your SQL in the file

4. Test locally:
   ```bash
   supabase db push
   ```

5. Commit and push - migrations will run automatically via GitHub Actions

## Migration Naming Convention

Format: `YYYYMMDDHHMMSS_description.sql`

Example: `20241220120000_add_user_settings.sql`

## GitHub Secrets Required

For automated deployments, set these secrets in GitHub:

- `SUPABASE_ACCESS_TOKEN` - Get from Supabase Dashboard → Account → Access Tokens
- `SUPABASE_DB_PASSWORD` - Your database password
- `SUPABASE_PROJECT_ID` - Your project reference ID (e.g., `lfyljalqovgibqpqzajd`)

## Verifying Migrations

After migrations run, verify in Supabase dashboard:
- Tables should appear in Table Editor
- RLS should be enabled (yellow shield icon)
- Policies should be visible in Authentication → Policies
- Triggers should be visible in Database → Functions

