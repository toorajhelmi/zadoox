'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (!data?.user || !data?.session) {
        setError('Sign in failed. Please try again.');
        setLoading(false);
        return;
      }

      // Wait for cookies to sync before redirecting
      await new Promise(resolve => setTimeout(resolve, 1000));
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-vscode-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-vscode-text font-mono">
            Sign in to Zadoox
          </h2>
          <p className="mt-2 text-center text-sm text-vscode-text-secondary">
            Or{' '}
            <Link href="/auth/signup" className="font-medium text-vscode-blue hover:text-vscode-blue-hover">
              create a new account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded p-4 bg-red-900/30 border border-red-700">
              <div className="text-sm text-red-400">{error}</div>
            </div>
          )}
          <div className="rounded-md -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 bg-vscode-input border border-vscode-input-border placeholder-vscode-text-secondary text-vscode-text rounded-t-md focus:outline-none focus:ring-1 focus:ring-vscode-blue focus:border-vscode-blue focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 bg-vscode-input border border-vscode-input-border placeholder-vscode-text-secondary text-vscode-text rounded-b-md focus:outline-none focus:ring-1 focus:ring-vscode-blue focus:border-vscode-blue focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded text-white bg-vscode-blue hover:bg-vscode-blue-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-vscode-bg focus:ring-vscode-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
