'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout, CreateProjectModal, ProjectCard, PlusIcon } from '@/components/dashboard';
import { api } from '@/lib/api/client';
import type { Project, CreateProjectInput } from '@zadoox/shared';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadProjects = async () => {
    try {
      const data = await api.projects.list();
      setProjects(data);
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
    const created = await api.projects.create(input);
    await loadProjects();
    return created;
  };

  const handleDuplicateProject = async (project: Project) => {
    await api.projects.duplicate(project.id);
    await loadProjects();
  };

  const handleDeleteProject = async (project: Project) => {
    await api.projects.delete(project.id);
    await loadProjects();
  };

  const handleRenameProject = async (project: Project, nextName: string) => {
    await api.projects.update(project.id, { name: nextName });
    await loadProjects();
  };

  const recentProjects = projects.slice(0, 6);
  const initialStartMode = (() => {
    const v = (searchParams.get('fullassist') ?? '').toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return 'full' as const;
    if (v === 'false' || v === '0' || v === 'no') return 'assist' as const;
    return 'assist' as const;
  })();

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-auto p-6 space-y-10">
          <div className="p-6 bg-[#252526] border border-[#3e3e42] rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-[#007acc]/20 border border-[#007acc]/30 rounded text-xs text-[#007acc]">
                <span className="w-2 h-2 bg-[#007acc] rounded-full animate-pulse" />
                <span className="font-mono">AI Ready</span>
              </div>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Create a new project</h2>
            <p className="text-sm text-[#cccccc] mb-4">
              Start a fresh document set with AI assistance, ready to write and publish.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#007acc] hover:bg-[#1a8cd8] text-white rounded text-sm font-medium transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Create Project</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Projects</h2>
              <span className="text-xs text-[#969696]">
                {loading ? 'Loading…' : `Showing ${Math.min(recentProjects.length, 6)} of ${projects.length}`}
              </span>
            </div>
            {loading ? (
              <div className="text-center py-8 text-[#969696]">Loading projects...</div>
            ) : recentProjects.length === 0 ? (
              <div className="text-center py-8 text-[#969696]">No projects yet</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDuplicate={handleDuplicateProject}
                    onDelete={handleDeleteProject}
                    onRename={handleRenameProject}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-[#252526] border border-[#3e3e42] rounded flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">All Projects</h2>
              <p className="text-xs text-[#969696]">View and manage every project.</p>
            </div>
            <Link
              href="/dashboard/projects"
              className="text-sm text-[#007acc] hover:text-[#1a8cd8] transition-colors flex items-center gap-1"
            >
              Go to All Projects →
            </Link>
          </div>
        </div>
      </div>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateProject}
        initialStartMode={initialStartMode}
      />
    </DashboardLayout>
  );
}

