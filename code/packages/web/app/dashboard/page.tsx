import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-vscode-bg">
      <div className="h-screen flex">
        {/* Sidebar */}
        <aside className="w-64 bg-vscode-sidebar border-r border-vscode-border">
          <div className="p-4">
            <h1 className="text-xl font-bold text-vscode-text font-mono">Zadoox</h1>
          </div>
          <nav className="px-2 space-y-1">
            <a
              href="/dashboard"
              className="block px-3 py-2 text-vscode-text bg-vscode-active rounded"
            >
              Dashboard
            </a>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-vscode-editor">
          <div className="p-6">
            <h1 className="text-3xl font-bold text-vscode-text font-mono mb-2">Dashboard</h1>
            <p className="text-vscode-text-secondary">Welcome back, {user.email}!</p>
          </div>
        </main>
      </div>
    </div>
  );
}

