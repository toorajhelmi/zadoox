'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    // Client-side validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/login`,
        },
      });

      if (signUpError) {
        setError(signUpError.message || 'Failed to create account. Please try again.');
        setLoading(false);
        return;
      }

      if (data?.user) {
        setSuccess('Account created successfully! Redirecting...');
        setLoading(false);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else {
        setSuccess('Please check your email to confirm your account.');
        setLoading(false);
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        setError('Network error: Unable to connect to authentication service.');
      } else {
        setError(errorMessage);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-vscode-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-vscode-text font-mono">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-vscode-text-secondary">
            Or{' '}
            <Link href="/auth/login" className="font-medium text-vscode-blue hover:text-vscode-blue-hover">
              sign in to your existing account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md p-4 bg-red-900/30 border border-red-700">
              <div className="text-sm text-red-400 font-medium">{error}</div>
            </div>
          )}
          {success && (
            <div className="rounded-md p-4 bg-green-900/30 border border-green-700">
              <div className="text-sm text-green-400 font-medium">{success}</div>
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
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 bg-vscode-input border border-vscode-input-border placeholder-vscode-text-secondary text-vscode-text focus:outline-none focus:ring-1 focus:ring-vscode-blue focus:border-vscode-blue focus:z-10 sm:text-sm"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 bg-vscode-input border border-vscode-input-border placeholder-vscode-text-secondary text-vscode-text rounded-b-md focus:outline-none focus:ring-1 focus:ring-vscode-blue focus:border-vscode-blue focus:z-10 sm:text-sm"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-vscode-blue hover:bg-vscode-blue-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-vscode-bg focus:ring-vscode-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
