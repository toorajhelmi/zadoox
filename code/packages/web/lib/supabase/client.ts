/**
 * Supabase client for client-side usage
 * Use this in React components and client-side code
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isConfigured =
    !!supabaseUrl &&
    !!supabaseAnonKey &&
    !supabaseUrl.includes('your-project') &&
    !supabaseAnonKey.includes('your-anon') &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('placeholder');

  // NOTE:
  // Next.js may execute "use client" components during build/SSR to produce the initial HTML.
  // In CI we may not have env vars set, but we still want builds to succeed.
  // So: only hard-fail in the browser. On the server, return a placeholder client that throws
  // if you accidentally try to use it during SSR.
  if (!isConfigured) {
    if (typeof window === 'undefined') {
      const err = new Error(
        'Supabase is not configured. Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      );
      const throwingProxy = new Proxy(
        {},
        {
          get(_target, prop) {
            // Avoid being treated as a Promise/thenable
            if (prop === 'then') return undefined;
            return new Proxy(
              () => {
                throw err;
              },
              {
                get() {
                  return () => {
                    throw err;
                  };
                },
                apply() {
                  throw err;
                },
              }
            );
          },
        }
      );
      return throwingProxy as unknown as SupabaseClient;
    }

    throw new Error(
      'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

