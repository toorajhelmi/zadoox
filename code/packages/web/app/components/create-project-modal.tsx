'use client';

import { useState, FormEvent } from 'react';
import type { CreateProjectInput, ProjectType } from '@zadoox/shared';
import { ProjectTypeIcon, SparkleIcon, LoaderIcon } from './icons';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: CreateProjectInput) => Promise<void>;
}

const projectTypes: { value: ProjectType; label: string; description: string }[] = [
  { value: 'academic', label: 'Academic', description: 'Research papers, theses, dissertations' },
  { value: 'industry', label: 'Industry', description: 'Whitepapers, reports, documentation' },
  { value: 'code-docs', label: 'Code Docs', description: 'API docs, technical documentation' },
  { value: 'other', label: 'Other', description: 'Other types of documentation' },
];

export function CreateProjectModal({ isOpen, onClose, onCreate }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ProjectType>('academic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
      });
      // Reset form
      setName('');
      setDescription('');
      setType('academic');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
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

          {/* Project Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#cccccc] mb-3">
              Project Type *
            </label>
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
              <SparkleIcon className="w-4 h-4 text-[#cccccc]" />
              <span className="text-[#cccccc]">
                AI Assistant will help you write and refine your documentation
              </span>
            </div>
          </div>

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
                  <SparkleIcon className="w-4 h-4" />
                  <span>Create with AI</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

