'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/app/components/dashboard-layout';
import { api } from '@/lib/api/client';
import type { Project } from '@zadoox/shared';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await api.projects.list();
        setProjects(data.slice(0, 6)); // Show only recent 6 projects
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#3e3e42] bg-[#252526]">
          <h1 className="text-xl font-semibold text-white mb-1">Dashboard</h1>
          <p className="text-sm text-[#969696]">Welcome to Zadoox AI-powered documentation</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* AI Assistant Section */}
          <div className="mb-8 p-6 bg-gradient-to-r from-[#007acc]/20 to-[#1a8cd8]/20 border border-[#007acc]/30 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🤖</div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white mb-2">AI Assistant Ready</h2>
                <p className="text-sm text-[#cccccc] mb-4">
                  Your AI writing assistant is ready to help you create, refine, and enhance your documentation.
                  Use AI suggestions to improve clarity, expand ideas, and maintain consistency.
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/dashboard/ai-assistant"
                    className="px-4 py-2 bg-[#007acc] hover:bg-[#1a8cd8] text-white rounded text-sm font-medium transition-colors"
                  >
                    Open AI Assistant
                  </Link>
                  <Link
                    href="/dashboard/projects"
                    className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#454545] text-white rounded text-sm font-medium transition-colors border border-[#454545]"
                  >
                    View All Projects
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/dashboard/projects"
                className="p-6 bg-[#252526] border border-[#3e3e42] rounded hover:border-[#007acc] transition-all group"
              >
                <div className="text-3xl mb-3">📁</div>
                <h3 className="font-semibold text-white mb-2 group-hover:text-[#007acc] transition-colors">
                  New Project
                </h3>
                <p className="text-sm text-[#969696]">Create a new documentation project</p>
              </Link>

              <Link
                href="/dashboard/ai-assistant"
                className="p-6 bg-[#252526] border border-[#3e3e42] rounded hover:border-[#007acc] transition-all group"
              >
                <div className="text-3xl mb-3">🤖</div>
                <h3 className="font-semibold text-white mb-2 group-hover:text-[#007acc] transition-colors">
                  AI Assistant
                </h3>
                <p className="text-sm text-[#969696]">Get AI-powered writing help</p>
              </Link>

              <Link
                href="/dashboard/settings"
                className="p-6 bg-[#252526] border border-[#3e3e42] rounded hover:border-[#007acc] transition-all group"
              >
                <div className="text-3xl mb-3">⚙️</div>
                <h3 className="font-semibold text-white mb-2 group-hover:text-[#007acc] transition-colors">
                  Settings
                </h3>
                <p className="text-sm text-[#969696]">Configure your workspace</p>
              </Link>
            </div>
          </div>

          {/* Recent Projects */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Recent Projects</h2>
              <Link
                href="/dashboard/projects"
                className="text-sm text-[#007acc] hover:text-[#1a8cd8] transition-colors"
              >
                View all →
              </Link>
            </div>

            {loading ? (
              <div className="text-center py-8 text-[#969696]">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#969696] mb-4">No projects yet</p>
                <Link
                  href="/dashboard/projects"
                  className="text-[#007acc] hover:text-[#1a8cd8] transition-colors"
                >
                  Create your first project →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/dashboard/projects/${project.id}`}
                    className="block p-4 bg-[#252526] border border-[#3e3e42] rounded hover:border-[#007acc] hover:bg-[#2a2d2e] transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">
                        {project.type === 'academic'
                          ? '📚'
                          : project.type === 'industry'
                          ? '📄'
                          : '💻'}
                      </span>
                      <h3 className="font-semibold text-white group-hover:text-[#007acc] transition-colors">
                        {project.name}
                      </h3>
                    </div>
                    {project.description && (
                      <p className="text-sm text-[#969696] line-clamp-2">{project.description}</p>
                    )}
                    <div className="mt-3 text-[10px] text-[#858585]">
                      Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
