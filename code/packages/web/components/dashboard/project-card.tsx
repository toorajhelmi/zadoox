'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Project } from '@zadoox/shared';
import { ChevronRightIcon, DuplicateIcon, LoaderIcon, PencilIcon, ProjectTypeIcon, TrashIcon } from './icons';

interface ProjectCardProps {
  project: Project;
  onDuplicate?: (project: Project) => Promise<void> | void;
  onDelete?: (project: Project) => Promise<void> | void;
  onRename?: (project: Project, nextName: string) => Promise<void> | void;
}

const projectTypeLabels: Record<string, string> = {
  academic: 'Academic',
  industry: 'Industry',
  'code-docs': 'Code Docs',
  other: 'Other',
};

export function ProjectCard({ project, onDuplicate, onDelete, onRename }: ProjectCardProps) {
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const [busy, setBusy] = useState<null | 'duplicate' | 'delete' | 'rename'>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);

  const canDuplicate = !!onDuplicate;
  const canDelete = !!onDelete;
  const canRename = !!onRename;

  const handleDuplicate = async () => {
    if (!onDuplicate || busy) return;
    setBusy('duplicate');
    try {
      await onDuplicate(project);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || busy) return;
    const ok = window.confirm(`Delete project "${project.name}"?\n\nThis cannot be undone.`);
    if (!ok) return;
    setBusy('delete');
    try {
      await onDelete(project);
    } finally {
      setBusy(null);
    }
  };

  const startRename = () => {
    if (!onRename || busy) return;
    setNameDraft(project.name);
    setIsRenaming(true);
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setNameDraft(project.name);
  };

  const commitRename = async () => {
    if (!onRename || busy) return;
    const next = nameDraft.trim();
    if (!next || next === project.name) {
      cancelRename();
      return;
    }
    setBusy('rename');
    try {
      await onRename(project, next);
      setIsRenaming(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative bg-[#252526] border border-[#3e3e42] rounded hover:border-[#007acc] hover:bg-[#2a2d2e] transition-all group">
      <Link href={`/dashboard/projects/${project.id}`} className="block p-4 flex flex-col min-h-[140px]">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <ProjectTypeIcon type={project.type} />
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      void commitRename();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      cancelRename();
                    }
                  }}
                  onBlur={() => {
                    void commitRename();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  autoFocus
                  className="bg-transparent border-b border-[#007acc]/60 focus:border-[#007acc] outline-none text-white font-semibold text-sm px-0.5 min-w-[180px]"
                />
                {busy === 'rename' && <LoaderIcon className="w-4 h-4 text-[#969696] animate-spin" />}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <h3 className="font-semibold text-white group-hover:text-[#007acc] transition-colors">
                  {project.name}
                </h3>
                {canRename && (
                  <button
                    type="button"
                    title="Rename"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      startRename();
                    }}
                    className="ml-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[#3e3e42]/60 text-[#969696] hover:text-white transition-colors"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] px-2 py-1 bg-[#3e3e42] text-[#969696] rounded uppercase">
              {projectTypeLabels[project.type] || project.type}
            </span>

            {(canDuplicate || canDelete) && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {busy ? (
                  <div className="p-1 text-[#969696]">
                    <LoaderIcon className="w-4 h-4 animate-spin" />
                  </div>
                ) : (
                  <>
                    {canDuplicate && (
                      <button
                        type="button"
                        title="Duplicate"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleDuplicate();
                        }}
                        className="p-1 rounded bg-[#3e3e42]/60 hover:bg-[#3e3e42] text-[#cccccc] hover:text-white transition-colors"
                      >
                        <DuplicateIcon className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        title="Delete"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleDelete();
                        }}
                        className="p-1 rounded bg-[#3e3e42]/60 hover:bg-[#3e3e42] text-[#cccccc] hover:text-red-300 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1">
          {project.description && (
            <p className="text-sm text-[#969696] line-clamp-2">{project.description}</p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-[#858585]">
          <div className="flex items-center gap-3">
            <span>Updated {formatDate(project.updatedAt)}</span>
          </div>
          <div className="flex items-center gap-1 text-[#007acc] opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRightIcon className="w-3 h-3" />
          </div>
        </div>
      </Link>
    </div>
  );
}

