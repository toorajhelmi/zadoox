'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { InlineWizardProps } from './types';

export function InsertFigureWizard({ ctx, onCancel, onCloseAll, onPreviewInsert, onApply }: InlineWizardProps) {
  const [mode, setMode] = useState<'generate' | 'upload'>('generate');
  const scopeText = ctx.scope.text.trim();
  const canUseScope = scopeText.length > 0;
  const [what, setWhat] = useState(() => ctx.scope.text.trim());
  const [hasEditedWhat, setHasEditedWhat] = useState(false);
  const whatInputRef = useRef<HTMLInputElement>(null);
  const [includeCaption, setIncludeCaption] = useState(false);
  const [caption, setCaption] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ b64: string; mimeType: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const figureIdRef = useRef(`fig:generated-${Date.now()}`);
  const effectiveFigureId = figureIdRef.current;

  const lastScopeTextRef = useRef(scopeText);
  useEffect(() => {
    // Prefill from scope, but never fight the user's edits.
    if (hasEditedWhat) {
      lastScopeTextRef.current = scopeText;
      return;
    }

    const scopeChanged = lastScopeTextRef.current !== scopeText;
    lastScopeTextRef.current = scopeText;

    if (canUseScope && (scopeChanged || !what || what.trim().length === 0)) {
      setWhat(scopeText);
    }
  }, [scopeText, canUseScope, what, hasEditedWhat]);

  // (Scope label UI removed; the field is always editable and prefilled from scope.)

  const generatedPrompt = useMemo(() => {
    const parts: string[] = [];
    parts.push('Create a clean, publication-ready figure image.');
    parts.push('Style: minimal, high contrast, no watermark.');
    parts.push('IMPORTANT: Do NOT include any text, labels, numbers, legends, or watermarks inside the image.');
    if (what.trim()) parts.push(`Figure should show: ${what.trim()}`);
    // Caption is generated alongside image generation when enabled (not a separate step).
    if (includeCaption && caption.trim()) parts.push(`Caption: ${caption.trim()}`);
    return parts.join('\n\n');
  }, [what, includeCaption, caption]);

  const insertMarkdown = useMemo(() => {
    const altRaw = caption.trim() || 'Figure';
    const alt = altRaw.replace(/\n/g, ' ').trim();
    const url = imageDataUrl || 'assets/figure.png';
    const label = `label="Figure {REF}.1"`;
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
    const desc = what.trim().length > 0 ? ` desc="${esc(what)}"` : '';
    return `\n\n![${alt}](${url}){#${effectiveFigureId} ${label}${desc}}\n\n`;
  }, [caption, imageDataUrl, effectiveFigureId, what]);

  const parseDataUrl = (dataUrl: string): { mimeType: string; b64: string } => {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
    if (!m) {
      throw new Error('Invalid data URL');
    }
    return { mimeType: m[1], b64: m[2] };
  };

  const doGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Reset previous outputs for a clean run
      setImageDataUrl(null);
      setPendingImage(null);
      if (includeCaption) setCaption('');

      const res = await api.ai.images.generate({
        prompt: generatedPrompt,
        model: 'auto',
      });
      const dataUrl = `data:${res.mimeType};base64,${res.b64}`;
      setImageDataUrl(dataUrl);
      setPendingImage({ b64: res.b64, mimeType: res.mimeType });

      if (includeCaption) {
        const captionPrompt =
          'Write a concise figure caption (max 12 words). Return ONLY the caption text (no quotes).';
        const contextText = [
          what.trim() ? `Figure description:\n${what.trim()}` : '',
          scopeText ? `Document context:\n${scopeText}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        const captionRes = await api.ai.inline.generate({
          prompt: captionPrompt,
          context: { blockContent: contextText || what.trim() || scopeText || 'Figure' },
          mode: 'replace',
          model: 'auto',
        });
        setCaption(captionRes.content.trim());
      }
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
      setImageDataUrl(null);
      setPendingImage(null);
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      setImageDataUrl(dataUrl);

      const { mimeType, b64 } = parseDataUrl(dataUrl);
      setPendingImage({ b64, mimeType });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const doInsert = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!onPreviewInsert) {
        throw new Error('Insert is not available');
      }
      if (!imageDataUrl) {
        throw new Error(mode === 'generate' ? 'Generate an image first' : 'Upload an image first');
      }
      if (!pendingImage) {
        throw new Error('Image is not ready yet. Please try again.');
      }

      // Store ONLY after user confirms Insert (not during preview).
      const asset = await api.assets.upload({
        documentId: ctx.documentId,
        b64: pendingImage.b64,
        mimeType: pendingImage.mimeType,
      });

      const altRaw = caption.trim() || 'Figure';
      const alt = altRaw.replace(/\n/g, ' ').trim();
      const label = `label="Figure {REF}.1"`;
      const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
      const desc = what.trim().length > 0 ? ` desc="${esc(what)}"` : '';
      const md = `\n\n![${alt}](${asset.ref}){#${effectiveFigureId} ${label}${desc}}\n\n`;

      const p = await onPreviewInsert({ content: md, placement: 'after' });
      await onApply(p);
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
              setImageDataUrl(null);
              setPendingImage(null);
              setError(null);
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
              setImageDataUrl(null);
              setPendingImage(null);
              setError(null);
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
          <div className="relative">
            <input
              ref={whatInputRef}
              value={what}
              onChange={(e) => {
                setHasEditedWhat(true);
                setWhat(e.target.value);
              }}
              className="w-full bg-gray-950 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 pr-8 focus:outline-none focus:border-gray-600"
              placeholder={canUseScope ? 'Prefilled from selected scope (editable)' : 'e.g. System architecture diagram of X'}
            />
            {what.trim().length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setHasEditedWhat(true);
                  setWhat('');
                  requestAnimationFrame(() => whatInputRef.current?.focus());
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-sm"
                aria-label="Clear"
                title="Clear"
              >
                ×
              </button>
            )}
          </div>
        </label>

        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={includeCaption}
            onChange={(e) => {
              const checked = e.target.checked;
              setIncludeCaption(checked);
              if (!checked) setCaption('');
            }}
          />
          Caption
        </label>

        {includeCaption && caption.trim().length > 0 && (
          <label className="block">
            <div className="text-[11px] text-gray-400 mb-1">Caption</div>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-gray-950 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
              placeholder="(Generated caption)"
            />
          </label>
        )}

        {mode === 'generate' && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={doGenerate}
              disabled={isLoading || !what.trim()}
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
          {imageDataUrl && (
            <button
              type="button"
              onClick={doInsert}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-vscode-blue hover:bg-blue-600 disabled:bg-gray-900 disabled:opacity-50 text-white rounded transition-colors"
            >
              {isLoading ? 'Inserting…' : 'Insert'}
            </button>
          )}

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
        </div>
      </div>
    </div>
  );
}


