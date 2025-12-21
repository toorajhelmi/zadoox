# Database Migrations (Legacy)

⚠️ **These migration files are kept for reference only.**

**Active migrations are now in:** `code/supabase/migrations/`

Migrations are now automated via GitHub Actions. See `.github/workflows/deploy-migrations.yml`

## Legacy Migration Files (For Reference)

1. **001_initial_schema.sql** - Creates initial tables (user_profiles, projects, documents)
2. **002_rls_policies.sql** - Sets up Row Level Security policies
3. **003_create_profile_trigger.sql** - Creates trigger to auto-create user profiles

These have been converted to Supabase CLI format with timestamps:
- `20241220000001_initial_schema.sql`
- `20241220000002_rls_policies.sql`
- `20241220000003_create_profile_trigger.sql`

## Automated Migrations

Migrations are automatically deployed via GitHub Actions when:
- Changes are pushed to `main` branch
- Migration files in `code/supabase/migrations/` are modified

See `.github/workflows/deploy-migrations.yml` for the deployment workflow.


