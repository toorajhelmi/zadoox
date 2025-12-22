'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/app/components/dashboard-layout';
import { ProjectCard } from '@/app/components/project-card';
import { CreateProjectModal } from '@/app/components/create-project-modal';
import { ProjectsIcon, PlusIcon, SparkleIcon, LoaderIcon } from '@/app/components/icons';
import { api } from '@/lib/api/client';
import type { Project, CreateProjectInput } from '@zadoox/shared';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.projects.list();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
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
        <div className="px-6 py-4 border-b border-[#3e3e42] bg-[#252526] flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white mb-1">Projects</h1>
            <p className="text-sm text-[#969696]">Manage your documentation projects</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-[#007acc] hover:bg-[#1a8cd8] text-white rounded text-sm font-medium transition-colors flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <LoaderIcon className="w-8 h-8 text-[#969696] animate-spin" />
                </div>
                <p className="text-[#969696]">Loading projects...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-700 rounded text-red-400">
              <p className="font-semibold mb-1">Error</p>
              <p className="text-sm mb-2">{error}</p>
              {error.includes('Failed to connect') && (
                <div className="text-xs text-red-300 mb-2 space-y-1">
                  <p>• Make sure the backend server is running on port 3001</p>
                  <p>• Check that NEXT_PUBLIC_API_URL is set correctly</p>
                  <p>• Verify CORS is enabled on the backend</p>
                </div>
              )}
              <button
                onClick={loadProjects}
                className="mt-2 text-sm underline hover:text-red-300"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && projects.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="mb-4">
                <ProjectsIcon className="w-16 h-16 text-[#969696]" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No projects yet</h2>
              <p className="text-[#969696] mb-6 max-w-md">
                Create your first project to start writing with AI-powered documentation tools
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3 bg-[#007acc] hover:bg-[#1a8cd8] text-white rounded font-medium transition-colors flex items-center gap-2"
              >
                <SparkleIcon className="w-4 h-4" />
                <span>Create Your First Project</span>
              </button>
            </div>
          )}

          {!loading && !error && projects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
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

