# Database Migrations

This directory contains SQL migration files for the Zadoox database schema.

## Migration Files

1. **001_initial_schema.sql** - Creates initial tables (user_profiles, projects, documents)
2. **002_rls_policies.sql** - Sets up Row Level Security policies
3. **003_create_profile_trigger.sql** - Creates trigger to auto-create user profiles

## Running Migrations

### Option 1: Supabase SQL Editor (Recommended for MVP)

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run each migration file in order (001, 002, 003)

### Option 2: Supabase CLI (Future)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Option 3: psql (Direct Connection)

```bash
# Using the connection string from Supabase
psql "postgresql://postgres.lfyljalqovgibqpqzajd:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

# Then run each migration file
\i 001_initial_schema.sql
\i 002_rls_policies.sql
\i 003_create_profile_trigger.sql
```

## Migration Order

Always run migrations in this order:
1. `001_initial_schema.sql` - Creates tables
2. `002_rls_policies.sql` - Adds RLS policies
3. `003_create_profile_trigger.sql` - Adds trigger function

## Verifying Migrations

After running migrations, verify in Supabase dashboard:
- Tables should appear in Table Editor
- RLS should be enabled (yellow shield icon)
- Policies should be visible in Authentication → Policies
- Triggers should be visible in Database → Functions


