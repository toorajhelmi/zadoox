'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreateProjectInput } from '@zadoox/shared';
import { api } from '@/lib/api/client';

export default function NewProjectFullAIPage() {
  const router = useRouter();
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const qName = (sp.get('name') ?? '').trim();
    const qDesc = (sp.get('description') ?? '').trim();
    if (qName) setName(qName);
    if (qDesc) setDescription(qDesc);
  }, []);

  const createAndStart = async () => {
    setError(null);
    setLoading(true);
    try {
      const input: CreateProjectInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        // Full-AI flow: project type will be refined during onboarding/chat.
        // Backend currently enforces a strict allowed set; default to a valid type.
        type: 'academic',
        settings: { editingMode: 'full-ai' },
      };
      const project = await api.projects.create(input);

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

      // Land in the editor with Full-AI chat opened/focused.
      router.push(`/dashboard/projects/${project.id}/documents/${docId}?fullassist=true&focus=chat`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-[#cccccc]">
      <div className="border-b border-[#3e3e42] bg-[#252526] px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-[#a855f7] font-mono mb-1">FULL‑AI</div>
          <h1 className="text-lg font-semibold text-white">Create Project (Guided)</h1>
          <p className="text-xs text-[#969696]">We’ll start with a guided chat to produce your first document.</p>
        </div>
        <button
          type="button"
          className="text-sm text-[#cccccc] hover:text-white transition-colors"
          onClick={() => router.push('/dashboard')}
          disabled={loading}
        >
          Back
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="p-6 bg-[#252526] border border-[#3e3e42] rounded-lg">
            {error ? (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded text-red-400 text-sm">{error}</div>
            ) : null}

            <div className="mb-4">
              <label className="block text-sm font-medium text-[#cccccc] mb-2">Project Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="My Project"
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white placeholder-[#858585] focus:outline-none focus:border-[#a855f7] transition-colors"
                disabled={loading}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[#cccccc] mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of your project..."
                rows={3}
                className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white placeholder-[#858585] focus:outline-none focus:border-[#a855f7] transition-colors resize-none"
                disabled={loading}
              />
            </div>

            <div className="p-4 bg-[#a855f7]/10 border border-[#a855f7]/30 rounded mb-6">
              <div className="text-sm text-[#e9d5ff] font-semibold mb-1">Next: Guided onboarding</div>
              <div className="text-xs text-[#d8b4fe]">
                After creating the project, you’ll enter a chat-oriented interface that guides you to produce the first
                version of your document. (UI coming next.)
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm text-[#cccccc] hover:text-white transition-colors"
                onClick={() => router.push('/dashboard')}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || !name.trim()}
                onClick={createAndStart}
                className="px-4 py-2 text-sm bg-[#a855f7] hover:bg-[#9333ea] text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating…' : 'Create & Start Full‑AI'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


