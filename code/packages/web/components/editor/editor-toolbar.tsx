'use client';

import { PencilIcon, Squares2X2Icon, EyeIcon, ChevronRightIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { Project } from '@zadoox/shared';

type ViewMode = 'edit' | 'preview' | 'split' | 'ir';
type EditFormat = 'markdown' | 'latex';

interface EditorToolbarProps {
  projectId: string;
  documentTitle?: string;
  isSaving: boolean;
  lastSaved: Date | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  editFormat: EditFormat;
  onEditFormatChange: (format: EditFormat) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function EditorToolbar({ 
  projectId,
  documentTitle,
  isSaving: _isSaving, 
  lastSaved: _lastSaved, 
  viewMode,
  onViewModeChange,
  editFormat,
  onEditFormatChange,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: EditorToolbarProps) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [projectMissing, setProjectMissing] = useState(false);

  useEffect(() => {
    async function loadProject() {
      try {
        setProjectMissing(false);
        const data = await api.projects.get(projectId);
        setProject(data);
      } catch (error) {
        const maybeApiError = error as { name?: string; code?: string; status?: number; message?: string };
        // Project missing is a valid runtime state (e.g. deleted project / stale link) — don't spam console.
        if (
          maybeApiError?.name === 'ApiError' &&
          (maybeApiError.code === 'NOT_FOUND' || maybeApiError.status === 404)
        ) {
          setProject(null);
          setProjectMissing(true);
          return;
        }
        console.error('Failed to load project:', error);
      }
    }
    loadProject();
  }, [projectId]);

  return (
    <div className="h-12 bg-vscode-sidebar border-b border-vscode-border flex items-center justify-between px-4">
      <div className="flex items-center gap-4 min-w-0">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
          <button
            onClick={() => router.push('/dashboard/projects')}
            className="text-vscode-text-secondary hover:text-vscode-text transition-colors"
          >
            Projects
          </button>
          <ChevronRightIcon className="w-4 h-4 text-vscode-text-secondary" />
          <button
            onClick={() => {
              if (projectMissing) return;
              router.push(`/dashboard/projects/${projectId}`);
            }}
            disabled={projectMissing}
            className={`text-vscode-text-secondary transition-colors ${
              projectMissing
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:text-vscode-text'
            }`}
          >
            <span className="block min-w-0 truncate max-w-[14rem]">
              {project?.name || (projectMissing ? 'Project (missing)' : 'Project')}
            </span>
          </button>
          {documentTitle && (
            <>
              <ChevronRightIcon className="w-4 h-4 text-vscode-text-secondary" />
              <span className="text-vscode-text min-w-0 truncate max-w-[18rem]" title={documentTitle}>
                {documentTitle}
              </span>
            </>
          )}
        </nav>

        {/* Undo/Redo Buttons */}
        {onUndo && onRedo && (
          <div className="flex items-center gap-1 border-l border-vscode-border pl-4">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                canUndo
                  ? 'text-vscode-text-secondary hover:text-vscode-text'
                  : 'text-vscode-text-secondary/50 cursor-not-allowed'
              }`}
              aria-label="Undo"
              title="Undo (Cmd/Ctrl+Z)"
            >
              <ArrowUturnLeftIcon className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                canRedo
                  ? 'text-vscode-text-secondary hover:text-vscode-text'
                  : 'text-vscode-text-secondary/50 cursor-not-allowed'
              }`}
              aria-label="Redo"
              title="Redo (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y)"
            >
              <ArrowUturnRightIcon className="w-4 h-4" />
            </button>
          </div>
        )}

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
            title="Edit mode (Cmd/Ctrl+Alt+E)"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('preview')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              viewMode === 'preview'
                ? 'bg-vscode-active text-vscode-text'
                : 'text-vscode-text-secondary hover:text-vscode-text'
            }`}
            aria-label="Preview mode"
            title="Preview mode (Cmd/Ctrl+Alt+P)"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('split')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              viewMode === 'split'
                ? 'bg-vscode-active text-vscode-text'
                : 'text-vscode-text-secondary hover:text-vscode-text'
            }`}
            aria-label="Split view"
            title="Split view (Cmd/Ctrl+Alt+S)"
          >
            <Squares2X2Icon className="w-4 h-4" />
          </button>
        </div>

        {/* Edit Format Toggle (Phase 12) */}
        <div className="flex items-center gap-1 border-l border-vscode-border pl-4">
          <button
            onClick={() => onEditFormatChange('markdown')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              editFormat === 'markdown'
                ? 'bg-vscode-active text-vscode-text'
                : 'text-vscode-text-secondary hover:text-vscode-text'
            }`}
            aria-label="Markdown edit mode"
            title="Edit Markdown (XMD) (Cmd/Ctrl+Alt+Shift+M)"
          >
            MD
          </button>
          <button
            onClick={() => onEditFormatChange('latex')}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              editFormat === 'latex'
                ? 'bg-vscode-active text-vscode-text'
                : 'text-vscode-text-secondary hover:text-vscode-text'
            }`}
            aria-label="LaTeX edit mode"
            title="Edit LaTeX (subset) (Cmd/Ctrl+Alt+Shift+L)"
          >
            LaTeX
          </button>
        </div>
      </div>

      {/* Save status moved to status bar */}
    </div>
  );
}

