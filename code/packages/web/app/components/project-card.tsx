'use client';

import Link from 'next/link';
import type { Project } from '@zadoox/shared';

interface ProjectCardProps {
  project: Project;
}

const projectTypeLabels: Record<string, string> = {
  academic: 'Academic',
  industry: 'Industry',
  'code-docs': 'Code Docs',
};

const projectTypeIcons: Record<string, string> = {
  academic: '📚',
  industry: '📄',
  'code-docs': '💻',
};

export function ProjectCard({ project }: ProjectCardProps) {
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="block p-4 bg-[#252526] border border-[#3e3e42] rounded hover:border-[#007acc] hover:bg-[#2a2d2e] transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{projectTypeIcons[project.type] || '📁'}</span>
          <h3 className="font-semibold text-white group-hover:text-[#007acc] transition-colors">
            {project.name}
          </h3>
        </div>
        <span className="text-[10px] px-2 py-1 bg-[#3e3e42] text-[#969696] rounded uppercase">
          {projectTypeLabels[project.type] || project.type}
        </span>
      </div>

      {project.description && (
        <p className="text-sm text-[#969696] mb-3 line-clamp-2">{project.description}</p>
      )}

      <div className="flex items-center justify-between text-[10px] text-[#858585]">
        <div className="flex items-center gap-3">
          <span>Updated {formatDate(project.updatedAt)}</span>
        </div>
        <div className="flex items-center gap-1 text-[#007acc] opacity-0 group-hover:opacity-100 transition-opacity">
          <span>Open</span>
          <span>→</span>
        </div>
      </div>
    </Link>
  );
}

