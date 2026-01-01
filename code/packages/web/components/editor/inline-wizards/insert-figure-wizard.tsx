'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api/client';
import type { InlineWizardPreview, InlineWizardProps } from './types';

function slugifyFigId(input: string): string {
  const s = (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return s || `generated-${Date.now()}`;
}

export function InsertFigureWizard({ ctx, onCancel, onCloseAll, onPreviewInsert, onApply }: InlineWizardProps) {
  const [mode, setMode] = useState<'generate' | 'upload'>('generate');
  const [what, setWhat] = useState('');
  const [caption, setCaption] = useState('');
  const [figureId, setFigureId] = useState(() => slugifyFigId(caption || what));
  const [size, setSize] = useState<'512x512' | '1024x1024'>('1024x1024');
  const [useScope, setUseScope] = useState(true);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<InlineWizardPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveFigureId = useMemo(() => {
    const base = figureId.trim() || slugifyFigId(caption || what);
    return base.startsWith('fig:') ? base : `fig:${base}`;
  }, [figureId, caption, what]);

  const generatedPrompt = useMemo(() => {
    const parts: string[] = [];
    parts.push('Create a clean, publication-ready figure image.');
    parts.push('Style: minimal, high contrast, no watermark.');
    if (what.trim()) parts.push(`Figure should show: ${what.trim()}`);
    if (useScope && ctx.scope.text.trim()) parts.push(`Context paragraph:\n${ctx.scope.text.trim()}`);
    if (caption.trim()) parts.push(`Caption: ${caption.trim()}`);
    return parts.join('\n\n');
  }, [what, caption, useScope, ctx.scope.text]);

  const insertMarkdown = useMemo(() => {
    const alt = (caption || 'Figure').replace(/\n/g, ' ').trim();
    const url = imageDataUrl || 'assets/figure.png';
    const label = `label="Figure {REF}.1"`;
    return `\n\n![${alt}](${url}){#${effectiveFigureId} ${label}}\n\n`;
  }, [caption, imageDataUrl, effectiveFigureId]);

  const doGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.ai.images.generate({
        prompt: generatedPrompt,
        size,
        model: 'auto',
      });
      setImageDataUrl(`data:${res.mimeType};base64,${res.b64}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const doUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      setImageDataUrl(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const doPreviewInsert = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!onPreviewInsert) {
        throw new Error('Insert preview is not available');
      }
      if (!imageDataUrl) {
        throw new Error(mode === 'generate' ? 'Generate an image first' : 'Upload an image first');
      }
      const p = await onPreviewInsert({ content: insertMarkdown, placement: 'after' });
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('generate');
              setPreview(null);
            }}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              mode === 'generate'
                ? 'bg-gray-800 text-gray-200 border-gray-700'
                : 'bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800'
            }`}
          >
            Generate
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('upload');
              setPreview(null);
            }}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              mode === 'upload'
                ? 'bg-gray-800 text-gray-200 border-gray-700'
                : 'bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800'
            }`}
          >
            Upload
          </button>
        </div>

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

        <label className="block">
          <div className="text-[11px] text-gray-400 mb-1">Figure ID</div>
          <input
            value={figureId}
            onChange={(e) => setFigureId(e.target.value)}
            className="w-full bg-gray-950 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
            placeholder="e.g. fig:architecture"
          />
          <div className="text-[10px] text-gray-500 mt-1">Will be inserted as {`{#${effectiveFigureId} label="Figure {REF}.1"}`}</div>
        </label>

        {mode === 'generate' && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={useScope}
                onChange={(e) => setUseScope(e.target.checked)}
              />
              Use paragraph context
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300">
              Size
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as '512x512' | '1024x1024')}
                className="bg-gray-950 text-xs text-gray-200 border border-gray-700 rounded px-2 py-1"
              >
                <option value="512x512">512×512</option>
                <option value="1024x1024">1024×1024</option>
              </select>
            </label>
            <button
              type="button"
              onClick={doGenerate}
              disabled={isLoading || (!what.trim() && !(useScope && ctx.scope.text.trim()))}
              className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:opacity-50 text-gray-200 rounded border border-gray-700 transition-colors"
            >
              {isLoading ? 'Generating…' : 'Generate image'}
            </button>
          </div>
        )}

        {mode === 'upload' && (
          <label className="block">
            <div className="text-[11px] text-gray-400 mb-1">Choose image</div>
            <input
              type="file"
              accept="image/*"
              disabled={isLoading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void doUpload(f);
              }}
              className="block w-full text-xs text-gray-300"
            />
          </label>
        )}

        {imageDataUrl && (
          <div className="border border-gray-800 rounded p-2 bg-gray-950/40">
            <div className="text-[10px] text-gray-400 mb-1">Image preview</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageDataUrl} alt={caption || 'Figure'} className="max-h-40 w-auto rounded border border-gray-800" />
          </div>
        )}

        {error && <div className="text-xs text-red-300">{error}</div>}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={doPreviewInsert}
            disabled={isLoading || !imageDataUrl}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:opacity-50 text-gray-200 rounded border border-gray-700 transition-colors"
          >
            {isLoading ? 'Previewing…' : preview ? 'Update preview' : 'Preview insert'}
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
              <div className="p-2 text-xs text-gray-300 whitespace-pre-wrap">{preview.previewText || '(No preview content)'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


