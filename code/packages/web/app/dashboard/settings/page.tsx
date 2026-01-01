'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout, SettingsIcon } from '@/components/dashboard';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setError(null);
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!mounted) return;
        setUser(data.user ? { id: data.user.id, email: data.user.email } : null);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
        setUser(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    void load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-[#3e3e42] bg-[#252526]">
          <h1 className="text-xl font-semibold text-white mb-1">Settings</h1>
          <p className="text-sm text-[#969696]">Account & workspace</p>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-center gap-3">
              <SettingsIcon className="w-6 h-6 text-[#969696]" />
              <h2 className="text-lg font-semibold text-white">Account</h2>
            </div>

            <div className="p-5 bg-[#252526] border border-[#3e3e42] rounded">
              {loading ? (
                <div className="text-sm text-[#969696]">Loading session…</div>
              ) : error ? (
                <div className="text-sm text-red-300">
                  Failed to load session: {error}
                </div>
              ) : user ? (
                <div className="space-y-3">
                  <div className="text-sm text-[#cccccc]">
                    Signed in as <span className="text-white font-medium">{user.email || 'Unknown email'}</span>
                  </div>
                  <div className="text-xs text-[#969696] font-mono break-all">
                    User ID: {user.id}
                  </div>

                  <form action="/auth/logout" method="post" className="pt-2">
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-sm rounded bg-[#3e3e42] hover:bg-[#4a4a4f] text-white transition-colors"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-[#969696]">Not signed in</div>
                  <Link
                    href="/auth/login"
                    className="inline-flex items-center px-3 py-1.5 text-sm rounded bg-[#007acc] hover:bg-[#1a8cd8] text-white transition-colors"
                  >
                    Go to Login
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

