/**
 * Vitest setup file for web package
 */

/// <reference types="vitest" />
import { vi } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom';

// Make React available globally for JSX
global.React = React;

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      // Our API client may call getUser() to refresh/validate session before reading access_token.
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'mock-user' } },
        error: null,
      }),
      onAuthStateChange: vi.fn((cb: (event: unknown, session: { access_token?: string } | null) => void) => {
        // Immediately report the current session once for convenience.
        void Promise.resolve().then(() => cb('INITIAL_SESSION', { access_token: 'mock-token' }));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-token',
          },
        },
      }),
    },
  })),
}));

