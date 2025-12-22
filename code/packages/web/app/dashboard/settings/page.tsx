'use client';

import { DashboardLayout } from '@/app/components/dashboard-layout';

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-[#3e3e42] bg-[#252526]">
          <h1 className="text-xl font-semibold text-white mb-1">Settings</h1>
          <p className="text-sm text-[#969696]">Configure your workspace and preferences</p>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⚙️</div>
              <h2 className="text-2xl font-semibold text-white mb-4">Settings</h2>
              <p className="text-[#969696] mb-8">
                Settings will be available in a future phase
              </p>
              <div className="p-6 bg-[#252526] border border-[#3e3e42] rounded text-left">
                <h3 className="font-semibold text-white mb-3">Coming Soon:</h3>
                <ul className="space-y-2 text-sm text-[#cccccc]">
                  <li>• User preferences</li>
                  <li>• AI model settings</li>
                  <li>• Export preferences</li>
                  <li>• Theme customization</li>
                  <li>• Notification settings</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

