'use client';

import { Bars3Icon, EyeIcon, PencilIcon, Squares2X2Icon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { Project } from '@zadoox/shared';

type ViewMode = 'edit' | 'preview' | 'split';

interface EditorToolbarProps {
  projectId: string;
  documentTitle?: string;
  isSaving: boolean;
  lastSaved: Date | null;
  onToggleSidebar: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function EditorToolbar({ 
  projectId,
  documentTitle,
  isSaving, 
  lastSaved, 
  onToggleSidebar,
  viewMode,
  onViewModeChange,
}: EditorToolbarProps) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        const data = await api.projects.get(projectId);
        setProject(data);
      } catch (error) {
        console.error('Failed to load project:', error);
      }
    }
    loadProject();
  }, [projectId]);

  return (
    <div className="h-12 bg-vscode-sidebar border-b border-vscode-border flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="text-vscode-text-secondary hover:text-vscode-text transition-colors"
          aria-label="Toggle sidebar"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
          <button
            onClick={() => router.push('/dashboard/projects')}
            className="text-vscode-text-secondary hover:text-vscode-text transition-colors"
          >
            Projects
          </button>
          <ChevronRightIcon className="w-4 h-4 text-vscode-text-secondary" />
          <button
            onClick={() => router.push(`/dashboard/projects/${projectId}`)}
            className="text-vscode-text-secondary hover:text-vscode-text transition-colors"
          >
            {project?.name || 'Project'}
          </button>
          {documentTitle && (
            <>
              <ChevronRightIcon className="w-4 h-4 text-vscode-text-secondary" />
              <span className="text-vscode-text">{documentTitle}</span>
            </>
          )}
        </nav>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 border-l border-vscode-border pl-4">
          <button
            onClick={() => onViewModeChange('edit')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              viewMode === 'edit'
                ? 'bg-vscode-active text-vscode-text'
                : 'text-vscode-text-secondary hover:text-vscode-text'
            }`}
            aria-label="Edit mode"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('split')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              viewMode === 'split'
                ? 'bg-vscode-active text-vscode-text'
                : 'text-vscode-text-secondary hover:text-vscode-text'
            }`}
            aria-label="Split view"
          >
            <Squares2X2Icon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('preview')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              viewMode === 'preview'
                ? 'bg-vscode-active text-vscode-text'
                : 'text-vscode-text-secondary hover:text-vscode-text'
            }`}
            aria-label="Preview mode"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Save status moved to status bar */}
    </div>
  );
}

