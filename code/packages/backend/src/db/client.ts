/**
 * Supabase Database Client
 * Creates and exports the Supabase client for backend use
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
  );
}

/**
 * Supabase client with service role key
 * Use this for backend operations that require admin privileges
 * ⚠️ Never expose the service role key to the client
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Create a Supabase client for a specific user
 * Use this when you need to enforce RLS policies for a specific user
 * 
 * Note: For user clients, use the anon key, not the service role key
 * The service role key bypasses RLS, which is not what we want for user operations
 */
export function createUserClient(accessToken: string) {
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseAnonKey) {
    throw new Error('Missing SUPABASE_ANON_KEY environment variable');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

