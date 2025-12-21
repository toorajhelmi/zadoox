import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-vscode-bg">
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl font-bold text-vscode-text mb-4 font-mono">Zadoox</h1>
        <p className="text-xl text-vscode-text-secondary mb-8">AI-powered documentation platform</p>
        <div className="space-x-4">
          <Link
            href="/auth/login"
            className="inline-block px-6 py-3 bg-vscode-blue text-white font-medium rounded hover:bg-vscode-blue-hover transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="inline-block px-6 py-3 bg-vscode-input text-vscode-text font-medium rounded border border-vscode-border hover:bg-vscode-hover transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}
