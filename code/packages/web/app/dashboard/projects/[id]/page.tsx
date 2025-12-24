'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout, LoaderIcon } from '@/components/dashboard';
import { api } from '@/lib/api/client';
import type { Project } from '@zadoox/shared';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.projects.get(projectId);
        setProject(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
        console.error('Failed to load project:', err);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  const handleEdit = () => {
    // TODO: Fetch documents and use the first one, or create a default document
    const defaultDocumentId = 'default';
    router.push(`/dashboard/projects/${projectId}/documents/${defaultDocumentId}`);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <LoaderIcon className="w-8 h-8 text-[#969696] animate-spin" />
            </div>
            <p className="text-[#969696]">Loading project...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-[#969696] mb-4">{error || 'Project not found'}</p>
            <button
              onClick={() => router.push('/dashboard/projects')}
              className="px-4 py-2 bg-[#007acc] hover:bg-[#1a8cd8] text-white rounded"
            >
              Back to Projects
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-[#3e3e42] bg-[#252526]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white mb-1">{project.name}</h1>
              <p className="text-sm text-[#969696]">
                {project.description || 'No description'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-[#007acc] hover:bg-[#1a8cd8] text-white rounded text-sm font-medium transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => router.push('/dashboard/projects')}
                className="px-4 py-2 text-sm text-[#cccccc] hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="p-6 bg-[#252526] border border-[#3e3e42] rounded mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">Project Details</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-[#969696]">Type</dt>
                  <dd className="text-white capitalize">{project.type}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[#969696]">Created</dt>
                  <dd className="text-white">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[#969696]">Last Updated</dt>
                  <dd className="text-white">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

