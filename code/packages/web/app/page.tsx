import Link from 'next/link';

export default function Home() {

  return (
    <main className="min-h-screen flex items-center justify-center bg-vscode-bg">
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl font-bold text-vscode-text mb-4 font-mono">Zadoox</h1>
        <p className="text-xl text-vscode-text-secondary mb-12">AI-powered documentation platform</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-vscode-blue text-white font-medium rounded-md hover:bg-vscode-blue-hover transition-colors focus:outline-none focus:ring-2 focus:ring-vscode-blue focus:ring-offset-2 focus:ring-offset-vscode-bg"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/auth/login"
            className="px-6 py-3 bg-vscode-input text-vscode-text font-medium rounded-md border border-vscode-input-border hover:bg-vscode-hover transition-colors focus:outline-none focus:ring-2 focus:ring-vscode-blue focus:ring-offset-2 focus:ring-offset-vscode-bg"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="px-6 py-3 bg-vscode-input text-vscode-text font-medium rounded-md border border-vscode-input-border hover:bg-vscode-hover transition-colors focus:outline-none focus:ring-2 focus:ring-vscode-blue focus:ring-offset-2 focus:ring-offset-vscode-bg"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}
