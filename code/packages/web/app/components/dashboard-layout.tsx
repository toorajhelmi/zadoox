'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/dashboard/projects', label: 'Projects', icon: '📁' },
    { href: '/dashboard/ai-assistant', label: 'AI Assistant', icon: '🤖' },
    { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-[#cccccc] font-mono">
      {/* Top Bar - VS Code style */}
      <header className="h-8 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center px-3 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 hover:bg-[#3e3e42] rounded"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="text-xs">☰</span>
          </button>
          <span className="text-xs font-semibold text-[#cccccc]">Zadoox</span>
          <span className="text-[10px] text-[#858585]">AI-powered documentation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-[#007acc] text-white text-[10px] rounded">
            <span>🤖</span>
            <span>AI Active</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - VS Code style */}
        <aside
          className={`${
            sidebarCollapsed ? 'w-12' : 'w-64'
          } bg-[#252526] border-r border-[#3e3e42] flex flex-col transition-all duration-200 flex-shrink-0`}
        >
          {/* Navigation */}
          <nav className="flex-1 py-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 mx-2 rounded text-sm transition-colors ${
                    isActive
                      ? 'bg-[#2a2d2e] text-white border-l-2 border-[#007acc]'
                      : 'text-[#cccccc] hover:bg-[#2a2d2e] hover:text-white'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="border-t border-[#3e3e42] p-2">
            {!sidebarCollapsed && (
              <div className="text-[10px] text-[#858585] px-2 py-1">
                <div className="flex items-center gap-2 mb-1">
                  <span>⚡</span>
                  <span>AI Ready</span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
          {/* Content Area */}
          <div className="flex-1 overflow-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

