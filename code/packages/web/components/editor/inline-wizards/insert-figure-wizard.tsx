'use client';

import { useMemo, useState } from 'react';
import { MarkdownPreview } from '../markdown-preview';
import type { InlineWizardPreview, InlineWizardProps } from './types';

export function InsertFigureWizard({ onCancel, onCloseAll, onPreview, onApply }: InlineWizardProps) {
  const [what, setWhat] = useState('');
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState<InlineWizardPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prompt = useMemo(() => {
    const parts = [
      'Insert a figure here using Zadoox extended Markdown.',
      'Use a placeholder image under assets/ (do NOT invent a real URL).',
      'Include a label like {#fig:... label="Figure {REF}.1"} and a good caption.',
    ];
    if (what.trim()) parts.push(`The figure should depict: ${what.trim()}`);
    if (caption.trim()) parts.push(`Caption idea: ${caption.trim()}`);
    return parts.join('\n');
  }, [what, caption]);

  const doPreview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const p = await onPreview({ prompt, mode: 'insert', scopeStrategy: 'cursor' });
      setPreview(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-3">
      <div className="text-xs text-gray-400 mb-2">Insert figure</div>

      <div className="space-y-2">
        <label className="block">
          <div className="text-[11px] text-gray-400 mb-1">What should the figure show?</div>
          <input
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            className="w-full bg-gray-950 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
            placeholder="e.g. System architecture diagram of X"
          />
        </label>

        <label className="block">
          <div className="text-[11px] text-gray-400 mb-1">Caption (optional)</div>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full bg-gray-950 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
            placeholder="e.g. Overview of the system components"
          />
        </label>

        <div className="text-[10px] text-gray-500">
          TODO: add “Upload image” and “Generate image” paths (separate wizard steps).
        </div>

        {error && <div className="text-xs text-red-300">{error}</div>}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={doPreview}
            disabled={isLoading}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:opacity-50 text-gray-200 rounded border border-gray-700 transition-colors"
          >
            {isLoading ? 'Previewing…' : preview ? 'Update preview' : 'Preview'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-1 text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 rounded border border-gray-800 transition-colors"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onCloseAll}
            className="px-2 py-1 text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 rounded border border-gray-800 transition-colors"
          >
            Cancel
          </button>

          <div className="flex-1" />

          {preview && (
            <button
              type="button"
              onClick={async () => {
                setIsLoading(true);
                try {
                  await onApply(preview);
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-vscode-blue hover:bg-blue-600 disabled:bg-gray-900 disabled:opacity-50 text-white rounded transition-colors"
            >
              {isLoading ? 'Applying…' : 'Apply'}
            </button>
          )}
        </div>

        {preview && (
          <div className="mt-3 border border-gray-800 rounded overflow-hidden">
            <div className="px-2 py-1 text-[10px] text-gray-400 border-b border-gray-800 bg-gray-950/60">
              Preview
            </div>
            <div className="max-h-56 overflow-auto">
              <MarkdownPreview content={preview.previewText || '(No preview content)'} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


