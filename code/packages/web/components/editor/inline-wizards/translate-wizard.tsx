'use client';

import { useEffect, useMemo, useState } from 'react';
import { franc } from 'franc-min';
import { MarkdownPreview } from '../markdown-preview';
import type { InlineWizardPreview, InlineWizardProps } from './types';

const COMMON_TARGETS = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Arabic', 'Chinese', 'Japanese', 'Korean'];

const ISO3_TO_NAME: Record<string, string> = {
  eng: 'English',
  spa: 'Spanish',
  fra: 'French',
  deu: 'German',
  ita: 'Italian',
  por: 'Portuguese',
  ara: 'Arabic',
  cmn: 'Chinese',
  jpn: 'Japanese',
  kor: 'Korean',
};

function detectLanguageName(text: string): string | null {
  const t = (text || '').trim();
  if (!t) return null;
  // franc needs a bit of text to be reliable; keep it conservative
  if (t.length < 40) return null;
  const iso3 = franc(t, { minLength: 40 });
  if (!iso3 || iso3 === 'und') return null;
  return ISO3_TO_NAME[iso3] || null;
}

export function TranslateWizard({ ctx, onCancel, onCloseAll, onPreview, onApply }: InlineWizardProps) {
  const detectedSource = detectLanguageName(ctx.scope.text) || 'auto';
  const savedTarget =
    typeof window !== 'undefined' ? (localStorage.getItem('inline-translate-target-language') || '').trim() : '';
  const defaultTarget = (() => {
    if (savedTarget && savedTarget !== detectedSource) return savedTarget;
    if (detectedSource !== 'auto') return COMMON_TARGETS.find((x) => x !== detectedSource) || 'Spanish';
    return savedTarget || 'Spanish';
  })();

  const [targetLanguage, setTargetLanguage] = useState(defaultTarget);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState<'auto' | string>('auto');
  const [preview, setPreview] = useState<InlineWizardPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && targetLanguage.trim()) {
      localStorage.setItem('inline-translate-target-language', targetLanguage.trim());
    }
  }, [targetLanguage]);

  const prompt = useMemo(() => {
    const from =
      sourceLanguage === 'auto'
        ? detectedSource === 'auto'
          ? 'auto-detected language'
          : detectedSource
        : sourceLanguage;
    return `Translate this content from ${from} to ${targetLanguage}. Preserve formatting (Markdown / Zadoox extended Markdown), citations ([@...]), cross-refs (@fig:, @sec:), and labels ({#...}). Keep technical terms accurate.`;
  }, [sourceLanguage, targetLanguage, detectedSource]);

  const doPreview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const p = await onPreview({ prompt, mode: 'update', scopeStrategy: 'selection-or-cursor-paragraph' });
      setPreview(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-3">
      <div className="text-xs text-gray-400 mb-2">Translate</div>

      <div className="space-y-2">
        <div className="text-[11px] text-gray-500">
          Scope:{' '}
          {ctx.scope.kind === 'selection'
            ? 'selection'
            : ctx.scope.kind === 'cursor_paragraph'
              ? 'cursor paragraph'
              : ctx.scope.kind === 'previous_paragraph'
                ? 'previous paragraph'
                : 'cursor'}{' '}
          · Detected source: {detectedSource === 'auto' ? 'Auto' : detectedSource}
        </div>

        <label className="block">
          <div className="text-[11px] text-gray-400 mb-1">Target language</div>
          <input
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            list="translate-targets"
            className="w-full bg-gray-950 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
            placeholder="e.g. English"
          />
          <datalist id="translate-targets">
            {COMMON_TARGETS.filter((t) => (detectedSource === 'auto' ? true : t !== detectedSource)).map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          {showAdvanced ? 'Hide options' : 'Options'}
        </button>

        {showAdvanced && (
          <label className="block">
            <div className="text-[11px] text-gray-400 mb-1">Source language (optional)</div>
            <input
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value || 'auto')}
              className="w-full bg-gray-950 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
              placeholder="auto"
            />
            <div className="text-[10px] text-gray-500 mt-1">Leave as “auto” to infer.</div>
          </label>
        )}

        {error && <div className="text-xs text-red-300">{error}</div>}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={doPreview}
            disabled={isLoading || !targetLanguage.trim()}
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


