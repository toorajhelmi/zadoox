# Database Module

This module handles all database interactions using Supabase.

## Structure

- `client.ts` - Supabase client initialization and configuration
- `migrations/` - SQL migration files for database schema

## Setup

### 1. Environment Variables

Create a `.env` file in the backend package root with:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres.lfyljalqovgibqpqzajd:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Where to find these values:**
- `SUPABASE_URL`: Supabase Dashboard → Settings → API → Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard → Settings → API → service_role key (keep secret!)
- `DATABASE_URL`: Supabase Dashboard → Settings → Database → Connection string (use Pooler connection)

### 2. Run Migrations

See `migrations/README.md` for instructions on running database migrations.

### 3. Test Connection

```bash
pnpm db:test
```

This will:
- Test basic connection to Supabase
- Verify all tables exist
- Check table accessibility

## Usage

### Admin Client (Service Role)

Use `supabaseAdmin` for backend operations that need to bypass RLS or perform admin tasks:

```typescript
import { supabaseAdmin } from './db/client';

// This bypasses RLS - use carefully
const { data, error } = await supabaseAdmin
  .from('projects')
  .select('*');
```

### User Client (With RLS)

For operations that should respect RLS policies, create a user-specific client:

```typescript
import { createUserClient } from './db/client';

// Create client with user's access token
const userClient = createUserClient(userAccessToken);

// This respects RLS policies
const { data, error } = await userClient
  .from('projects')
  .select('*');
```

## Security Notes

⚠️ **Important:**
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- Always use RLS policies to enforce access control
- Use `supabaseAdmin` only when necessary (admin operations, migrations)
- Use `createUserClient()` for regular operations to enforce RLS

## Tables

- `user_profiles` - Extended user profile data (extends Supabase Auth)
- `projects` - User projects
- `documents` - Documents within projects

See migration files for full schema details.

