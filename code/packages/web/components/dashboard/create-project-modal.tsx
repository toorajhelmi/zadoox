'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CreateProjectInput, Project, ProjectType } from '@zadoox/shared';
import { ProjectTypeIcon, SparkleIcon, WandIcon, LoaderIcon } from './icons';
import { api } from '@/lib/api/client';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: CreateProjectInput) => Promise<Project>;
  initialStartMode?: 'assist' | 'full';
}

const projectTypes: { value: ProjectType; label: string; description: string }[] = [
  { value: 'academic', label: 'Academic', description: 'Research papers, theses, dissertations' },
  { value: 'industry', label: 'Industry', description: 'Whitepapers, reports, documentation' },
  { value: 'code-docs', label: 'Code Docs', description: 'API docs, technical documentation' },
  { value: 'other', label: 'Other', description: 'Other types of documentation' },
];

export function CreateProjectModal({ isOpen, onClose, onCreate, initialStartMode }: CreateProjectModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ProjectType>('academic');
  const [startMode, setStartMode] = useState<'assist' | 'full'>('assist');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize start mode when modal opens (e.g. from landing-page query param).
  useEffect(() => {
    if (!isOpen) return;
    setStartMode((prev) => {
      if (prev === 'full' || prev === 'assist') return prev;
      return 'assist';
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!initialStartMode) return;
    setStartMode(initialStartMode);
  }, [isOpen, initialStartMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const project = await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
      });
      // Create/route to an initial document, then land in the editor.
      const docs = await api.documents.listByProject(project.id);
      const docId =
        docs.length > 0
          ? docs[0]!.id
          : (
              await api.documents.create({
                projectId: project.id,
                title: 'Untitled Document',
                content: '',
                metadata: { type: 'standalone' },
              })
            ).id;

      // Reset form
      setName('');
      setDescription('');
      setType('academic');
      onClose();
      router.push(`/dashboard/projects/${project.id}/documents/${docId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const createAndStartFullAI = async () => {
    setError(null);
    setLoading(true);
    try {
      const project = await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        // Full-AI flow: project type will be refined during onboarding/chat.
        // Backend currently enforces a strict allowed set; default to a valid type.
        type: 'academic',
      });

      const docs = await api.documents.listByProject(project.id);
      const docId =
        docs.length > 0
          ? docs[0]!.id
          : (
              await api.documents.create({
                projectId: project.id,
                title: 'Untitled Document',
                content: '',
                metadata: { type: 'standalone' },
              })
            ).id;

      // Reset form
      setName('');
      setDescription('');
      setType('academic');
      onClose();

      // Land in the editor with Full-AI chat opened/focused.
      router.push(`/dashboard/projects/${project.id}/documents/${docId}?fullassist=true&focus=chat`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] border border-[#3e3e42] rounded-lg w-full max-w-2xl mx-4 shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#3e3e42] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Create New Project</h2>
          <button
            onClick={onClose}
            className="text-[#969696] hover:text-white transition-colors"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Start mode */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#cccccc] mb-2">Start mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStartMode('assist')}
                disabled={loading}
                className={`flex-1 px-3 py-2 rounded border text-sm transition-colors ${
                  startMode === 'assist'
                    ? 'border-[#007acc] bg-[#007acc]/10 text-white'
                    : 'border-[#3e3e42] bg-[#2a2d2e] text-[#cccccc] hover:border-[#454545]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">AI‑Assist</span>
                  <span className="text-xs text-[#969696]">Blank doc + AI as needed</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStartMode('full')}
                disabled={loading}
                className={`flex-1 px-3 py-2 rounded border text-sm transition-colors ${
                  startMode === 'full'
                    ? 'border-[#a855f7] bg-[#a855f7]/10 text-white'
                    : 'border-[#3e3e42] bg-[#2a2d2e] text-[#cccccc] hover:border-[#454545]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Full‑AI</span>
                  <span className="text-xs text-[#969696]">Guided chat start</span>
                </div>
              </button>
            </div>
          </div>

          {/* Project Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#cccccc] mb-2">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="My Research Project"
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white placeholder-[#858585] focus:outline-none focus:border-[#007acc] transition-colors"
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#cccccc] mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your project..."
              rows={3}
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white placeholder-[#858585] focus:outline-none focus:border-[#007acc] transition-colors resize-none"
              disabled={loading}
            />
          </div>

          {startMode === 'assist' ? (
            <>
              {/* Project Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#cccccc] mb-3">Project Type *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {projectTypes.map((pt) => (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => setType(pt.value)}
                      className={`p-4 border-2 rounded text-left transition-all ${
                        type === pt.value
                          ? 'border-[#007acc] bg-[#007acc]/10'
                          : 'border-[#3e3e42] bg-[#2a2d2e] hover:border-[#454545]'
                      }`}
                      disabled={loading}
                    >
                      <div className="mb-2">
                        <ProjectTypeIcon type={pt.value} className="w-6 h-6" />
                      </div>
                      <div className="font-semibold text-white text-sm mb-1">{pt.label}</div>
                      <div className="text-[10px] text-[#969696]">{pt.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Assistant Note */}
              <div className="mb-6 p-3 bg-[#007acc]/10 border border-[#007acc]/30 rounded">
                <div className="flex items-center gap-2 text-sm">
                  <SparkleIcon className="w-4 h-4 text-[#007acc]" />
                  <span className="text-[#cccccc]">AI Assistant will help you write and refine your documentation</span>
                </div>
              </div>
            </>
          ) : (
            <div className="mb-6 p-4 bg-[#a855f7]/10 border border-[#a855f7]/30 rounded">
              <div className="flex items-center gap-2 text-sm text-[#e9d5ff] font-semibold mb-1">
                <WandIcon className="w-4 h-4 text-[#a855f7]" />
                <span>Full‑AI onboarding</span>
              </div>
              <div className="text-xs text-[#d8b4fe]">
                You’ll start in a guided chat to produce the first version of your document. Project type can be decided
                inside the chat.
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#cccccc] hover:text-white transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            {startMode === 'assist' ? (
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="px-4 py-2 text-sm bg-[#007acc] hover:bg-[#1a8cd8] text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <LoaderIcon className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <SparkleIcon className="w-4 h-4 text-white" />
                    <span>Create Project</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={createAndStartFullAI}
                disabled={loading || !name.trim()}
                className="px-4 py-2 text-sm bg-[#a855f7] hover:bg-[#9333ea] text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <WandIcon className="w-4 h-4 text-white" />
                <span>Create Project</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

