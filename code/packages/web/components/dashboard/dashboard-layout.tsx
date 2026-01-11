'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SettingsIcon } from './icons';
import { createClient } from '@/lib/supabase/client';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setUserEmail(data.user?.email || null);
      } catch {
        if (!mounted) return;
        setUserEmail(null);
      }
    }
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void load());
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-[#cccccc]">
      {/* Top Bar */}
      <header className="h-10 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center px-4 flex-shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-sm font-semibold text-[#cccccc]">Zadoox</span>
          <span className="text-[11px] text-[#858585] hidden sm:inline">AI-powered documentation</span>
        </div>
        <div className="flex items-center gap-3">
          {userEmail && <span className="text-[11px] text-[#cccccc] truncate max-w-[200px]" title={userEmail}>{userEmail}</span>}
          <Link
            href="/dashboard/settings"
            className="p-2 rounded hover:bg-[#3e3e42] text-[#cccccc] hover:text-white transition-colors"
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}

