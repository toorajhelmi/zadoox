'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/app/components/dashboard-layout';
import { CreateProjectModal } from '@/app/components/create-project-modal';
import { ProjectTypeIcon, PlusIcon, ChevronRightIcon } from '@/app/components/icons';
import { api } from '@/lib/api/client';
import type { Project, CreateProjectInput } from '@zadoox/shared';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (input: CreateProjectInput) => {
    await api.projects.create(input);
    await loadProjects(); // Reload projects after creation
  };

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
          {/* Welcome Section with AI Vibe */}
          <div className="mb-8 p-6 bg-gradient-to-br from-[#1e1e1e] via-[#252526] to-[#1e1e1e] border border-[#3e3e42] rounded-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#007acc]/5 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-[#007acc]/20 border border-[#007acc]/30 rounded text-xs text-[#007acc]">
                  <span className="w-2 h-2 bg-[#007acc] rounded-full animate-pulse" />
                  <span className="font-mono">AI Ready</span>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Welcome to Zadoox</h2>
              <p className="text-sm text-[#cccccc] mb-4 max-w-2xl">
                Create, write, and refine your documentation with AI-powered assistance built into every editor.
                Start a new project or continue working on an existing one.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#007acc] hover:bg-[#1a8cd8] text-white rounded text-sm font-medium transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Create Project</span>
              </button>
            </div>
          </div>

          {/* Recent Projects */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Recent Projects</h2>
              <Link
                href="/dashboard/projects"
                className="text-sm text-[#007acc] hover:text-[#1a8cd8] transition-colors flex items-center gap-1"
              >
                View all <ChevronRightIcon className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <div className="text-center py-8 text-[#969696]">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#969696] mb-4">No projects yet</p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="text-[#007acc] hover:text-[#1a8cd8] transition-colors flex items-center gap-1"
                >
                  Create your first project <ChevronRightIcon className="w-3 h-3" />
                </button>
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
                      <ProjectTypeIcon type={project.type} />
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

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </DashboardLayout>
  );
}
