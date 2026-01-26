'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout, LoaderIcon } from '@/components/dashboard';
import { api } from '@/lib/api/client';
import type { EditingMode, Project } from '@zadoox/shared';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const EDITING_MODE_OPTIONS: Array<{ mode: EditingMode; label: string; hint: string; className: string }> = [
  {
    mode: 'ai-assist',
    label: 'AI‑ASSIST',
    hint: 'Start from a blank doc; use AI as needed',
    className: 'border-[#007acc]/40 bg-[#007acc]/10 text-[#bfe3ff] hover:bg-[#007acc]/20',
  },
  {
    mode: 'full-ai',
    label: 'FULL‑AI',
    hint: 'Guided chat-first drafting flow',
    className: 'border-[#a855f7]/40 bg-[#a855f7]/10 text-[#e9d5ff] hover:bg-[#a855f7]/20',
  },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingModeMenuOpen, setEditingModeMenuOpen] = useState(false);
  const [editingModeSaving, setEditingModeSaving] = useState(false);
  const editingModeMenuRef = useRef<HTMLDivElement | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importSource, setImportSource] = useState<'arxiv' | 'google-docs'>('arxiv');
  const [arxivInput, setArxivInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.projects.get(projectId);
        setProject(data);
      } catch (err: unknown) {
        const status = typeof (err as any)?.status === 'number' ? (err as any).status : null;
        if (status === 401) {
          // Not logged in (or session expired) -> send user to login.
          router.push('/auth/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load project');
        console.error('Failed to load project:', err);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadProject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!editingModeMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const el = editingModeMenuRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setEditingModeMenuOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [editingModeMenuOpen]);

  const handleEdit = async () => {
    // Prefer existing documents; fallback to creating an untitled doc.
    const docs = await api.documents.listByProject(projectId);
    let docId: string | null = null;
    if (docs.length > 0) {
      docId = docs[0].id;
    } else {
      const created = await api.documents.create({
        projectId,
        title: 'Untitled Document',
        content: '',
        metadata: { type: 'standalone' },
      });
      docId = created.id;
    }
    if (docId) {
      router.push(`/dashboard/projects/${projectId}/documents/${docId}`);
    }
  };

  const handleChangeEditingMode = async (nextMode: EditingMode) => {
    if (!project) return;
    if (editingModeSaving) return;
    if ((project.settings?.editingMode || 'ai-assist') === nextMode) {
      setEditingModeMenuOpen(false);
      return;
    }

    try {
      setEditingModeSaving(true);
      await api.projects.update(projectId, {
        settings: {
          ...(project.settings || {}),
          editingMode: nextMode,
        },
      });
      const updated = await api.projects.get(projectId);
      setProject(updated);
      setEditingModeMenuOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update editing mode');
      console.error('Failed to update editing mode:', err);
    } finally {
      setEditingModeSaving(false);
    }
  };

  const onStartImport = async () => {
    if (!project) return;
    if (importing) return;
    setImportError(null);

    if (importSource === 'arxiv') {
      const v = arxivInput.trim();
      if (!v) {
        setImportError('Enter an arXiv URL or ID');
        return;
      }
      try {
        setImporting(true);
        const doc = await api.imports.arxiv({ projectId, arxiv: v });
        setImportOpen(false);
        router.push(`/dashboard/projects/${projectId}/documents/${doc.id}`);
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : 'Import failed');
      } finally {
        setImporting(false);
      }
    } else {
      setImportError('Google Docs import is coming soon');
    }
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

  const editingMode: EditingMode = project.settings?.editingMode === 'full-ai' ? 'full-ai' : 'ai-assist';
  const editingModeUi = (() => {
    const label = editingMode === 'full-ai' ? 'FULL‑AI' : 'AI‑ASSIST';
    const badgeClass =
      editingMode === 'full-ai'
        ? 'border-[#a855f7]/40 bg-[#a855f7]/10 text-[#e9d5ff] hover:bg-[#a855f7]/20'
        : 'border-[#007acc]/40 bg-[#007acc]/10 text-[#bfe3ff] hover:bg-[#007acc]/20';
    const title = editingMode === 'full-ai' ? 'Full-AI editing mode' : 'AI-Assist editing mode';
    return { label, badgeClass, title };
  })();

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-[#3e3e42] bg-[#252526]">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex items-start gap-3">
              <button
                type="button"
                onClick={() => router.push('/dashboard/projects')}
                className="mt-0.5 p-2 rounded hover:bg-[#3e3e42] text-[#cccccc] hover:text-white transition-colors"
                aria-label="Back"
                title="Back"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-white mb-1 truncate">{project.name}</h1>
                <p className="text-sm text-[#969696] truncate">{project.description || 'No description'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/dashboard/projects/${projectId}/settings`)}
                className="px-4 py-2 bg-[#3e3e42] hover:bg-[#464647] text-white rounded text-sm font-medium transition-colors"
              >
                Settings
              </button>
              <button
                onClick={() => {
                  setImportError(null);
                  setImportOpen(true);
                }}
                className="px-4 py-2 bg-[#3e3e42] hover:bg-[#464647] text-white rounded text-sm font-medium transition-colors"
              >
                Import
              </button>
              <button
                onClick={() => router.push(`/dashboard/projects/${projectId}/publish`)}
                className="px-4 py-2 bg-[#3e3e42] hover:bg-[#464647] text-white rounded text-sm font-medium transition-colors"
              >
                Publish
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-[#007acc] hover:bg-[#1a8cd8] text-white rounded text-sm font-medium transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="relative p-6 bg-[#252526] border border-[#3e3e42] rounded mb-6">
              <div ref={editingModeMenuRef} className="absolute top-4 right-4">
                <button
                  type="button"
                  className={
                    'text-[10px] font-mono uppercase px-2 py-1 rounded border transition-colors ' +
                    editingModeUi.badgeClass +
                    (editingModeSaving ? ' opacity-60 cursor-wait' : ' cursor-pointer')
                  }
                  title={editingModeUi.title + ' (click to switch)'}
                  aria-label="Edit mode (click to switch)"
                  onClick={() => setEditingModeMenuOpen((v) => !v)}
                  disabled={editingModeSaving}
                >
                  {editingModeUi.label}
                </button>

                {editingModeMenuOpen && (
                  <div className="mt-2 w-[280px] rounded border border-[#3e3e42] bg-[#1e1e1e] shadow-lg p-2">
                    <div className="px-2 py-1 text-[10px] font-mono uppercase text-[#969696]">
                      Switch editing mode
                    </div>
                    <div className="mt-1 space-y-1">
                      {EDITING_MODE_OPTIONS.map((opt) => {
                        const active = opt.mode === editingMode;
                        return (
                          <button
                            key={opt.mode}
                            type="button"
                            className={
                              'w-full text-left px-2 py-2 rounded border transition-colors ' +
                              (active ? opt.className : 'border-transparent hover:border-[#3e3e42] hover:bg-[#252526]')
                            }
                            onClick={() => void handleChangeEditingMode(opt.mode)}
                            disabled={editingModeSaving}
                            aria-current={active ? 'true' : undefined}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-mono uppercase text-white">{opt.label}</div>
                              {active && <div className="text-[10px] text-[#969696]">Current</div>}
                            </div>
                            <div className="mt-1 text-xs text-[#969696]">{opt.hint}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
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

      {importOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[640px] rounded border border-[#3e3e42] bg-[#1e1e1e] shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#3e3e42]">
              <div>
                <div className="text-sm font-semibold text-white">Import Document</div>
                <div className="text-xs text-[#969696] mt-0.5">Import from external sources (more coming soon)</div>
              </div>
              <button
                type="button"
                className="px-2 py-1 rounded hover:bg-[#2d2d30] text-[#cccccc] hover:text-white"
                onClick={() => setImportOpen(false)}
                aria-label="Close import"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs text-[#969696] mb-1">Source</label>
                <select
                  value={importSource}
                  onChange={(e) => setImportSource(e.target.value as any)}
                  className="w-full px-3 py-2 rounded bg-[#252526] border border-[#3e3e42] text-white text-sm"
                  disabled={importing}
                >
                  <option value="arxiv">arXiv (LaTeX source)</option>
                  <option value="google-docs">Google Docs (coming soon)</option>
                </select>
              </div>

              {importSource === 'arxiv' && (
                <div>
                  <label className="block text-xs text-[#969696] mb-1">arXiv URL or ID</label>
                  <input
                    value={arxivInput}
                    onChange={(e) => setArxivInput(e.target.value)}
                    placeholder="e.g. https://arxiv.org/abs/2301.01234 or 2301.01234v2"
                    className="w-full px-3 py-2 rounded bg-[#252526] border border-[#3e3e42] text-white text-sm"
                    disabled={importing}
                  />
                  <div className="text-[11px] text-[#969696] mt-2">
                    We’ll fetch the arXiv source and store it as the document’s LaTeX draft.
                  </div>
                </div>
              )}

              {importError && <div className="text-sm text-red-300">{importError}</div>}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#3e3e42]">
              <button
                type="button"
                className="px-4 py-2 bg-[#3e3e42] hover:bg-[#464647] text-white rounded text-sm font-medium transition-colors"
                onClick={() => setImportOpen(false)}
                disabled={importing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-[#007acc] hover:bg-[#1a8cd8] disabled:opacity-60 text-white rounded text-sm font-medium transition-colors"
                onClick={() => void onStartImport()}
                disabled={importing}
              >
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

