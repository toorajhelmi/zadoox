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
  const [hasEditedCaption, setHasEditedCaption] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ b64: string; mimeType: string } | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const figureIdRef = useRef(`fig:generated-${Date.now()}`);
  const effectiveFigureId = figureIdRef.current;

  const [placement, setPlacement] = useState<'block' | 'inline'>('block');
  const [align, setAlign] = useState<'center' | 'left' | 'right'>('center');
  const [widthPreset, setWidthPreset] = useState<'auto' | 'small' | 'medium' | 'large' | 'custom'>('auto');
  const [customWidthPct, setCustomWidthPct] = useState<string>(''); // number without % (e.g. "50" or "33.3")

  const effectiveWidth = useMemo(() => {
    if (widthPreset === 'small') return '33%';
    if (widthPreset === 'medium') return '50%';
    if (widthPreset === 'large') return '75%';
    if (widthPreset === 'custom') {
      const raw = String(customWidthPct ?? '').trim().replace(/%+$/g, '');
      if (!raw) return '';
      if (!/^\d+(\.\d+)?$/.test(raw)) return '';
      return `${raw}%`;
    }
    return '';
  }, [widthPreset, customWidthPct]);

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

  const escapeXmdAttr = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
  const xmdFigureLineFor = (params: { src: string; captionText: string }) => {
    const alt = String(params.captionText ?? '').replace(/\n/g, ' ').trim();
    const label = `label="Figure {REF}.1"`;
    const desc = what.trim().length > 0 ? ` desc="${escapeXmdAttr(what)}"` : '';
    const alignAttr = align !== 'center' ? ` align="${align}"` : '';
    const placementAttr = placement === 'inline' ? ` placement="inline"` : '';
    const widthAttr = effectiveWidth ? ` width="${escapeXmdAttr(effectiveWidth)}"` : '';
    return `\n\n![${alt}](${params.src}){#${effectiveFigureId} ${label}${desc}${alignAttr}${widthAttr}${placementAttr}}\n\n`;
  };

  const toLatexAssetsPath = (ref: string) => {
    const s = String(ref ?? '').trim();
    const prefix = 'zadoox-asset://';
    if (s.startsWith(prefix)) return `assets/${s.slice(prefix.length)}`;
    return s;
  };

  const escapeLatexTextLite = (text: string) => {
    const s = String(text ?? '');
    return s
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/#/g, '\\#')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/_/g, '\\_')
      .replace(/\^/g, '\\^{}');
  };

  const pctToTextwidth = (raw: string): string | null => {
    const w = String(raw ?? '').trim();
    if (!w.endsWith('%')) return null;
    const n = Number(w.slice(0, -1));
    if (!Number.isFinite(n) || n <= 0) return null;
    const frac = Math.max(0.05, Math.min(0.95, n / 100));
    return `${frac.toFixed(3)}\\textwidth`;
  };

  const latexFigureBlockFor = (params: { src: string; captionText: string }) => {
    const captionText = escapeLatexTextLite((params.captionText ?? '').trim());
    const label = effectiveFigureId;
    const desc = what.replace(/\n/g, ' ').trim();
    const widthRaw = (effectiveWidth ?? '').trim();
    const widthTextwidth = pctToTextwidth(widthRaw);
    const widthOpt = widthRaw ? `[width=${widthTextwidth ?? widthRaw}]` : '';
    const alignCmd = align === 'left' ? '\\raggedright' : align === 'right' ? '\\raggedleft' : '\\centering';
    const placementIsInline = placement === 'inline' && align !== 'center';
    const srcPath = toLatexAssetsPath(params.src);

    const zComments: string[] = [];
    // These comments allow LaTeX -> IR to round-trip attrs (and thus XMD) reliably.
    zComments.push(`% zadoox-desc: ${desc || ''}`);
    if (align !== 'center') zComments.push(`% zadoox-align: ${align}`);
    if (placement === 'inline') zComments.push(`% zadoox-placement: inline`);
    if (widthRaw) zComments.push(`% zadoox-width: ${widthRaw}`);

    if (placementIsInline) {
      // Best-effort wrap width: default to 0.45\textwidth if not set.
      const wrapWidth = widthTextwidth ?? (widthRaw || '0.450\\textwidth');
      const side = align === 'right' ? 'r' : 'l';
      // No leading/trailing blank lines; keep a trailing newline so subsequent content starts cleanly.
      return `\\begin{wrapfigure}{${side}}{${wrapWidth}}\n${alignCmd}\n${zComments.join('\n')}\n\\includegraphics[width=\\linewidth]{\\detokenize{${srcPath}}}\n${captionText ? `\\caption{${captionText}}\n` : ''}\\label{${label}}\n\\end{wrapfigure}\n`;
    }

    // No leading/trailing blank lines; keep a trailing newline so subsequent content starts cleanly.
    return `\\begin{figure}\n${alignCmd}\n${zComments.join('\n')}\n\\includegraphics${widthOpt}{\\detokenize{${srcPath}}}\n${captionText ? `\\caption{${captionText}}\n` : ''}\\label{${label}}\n\\end{figure}\n`;
  };

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
      // If the user manually typed a caption, don't wipe/overwrite it.
      if (includeCaption && !hasEditedCaption) setCaption('');

      const res = await api.ai.images.generate({
        prompt: generatedPrompt,
        model: 'auto',
      });
      const dataUrl = `data:${res.mimeType};base64,${res.b64}`;
      setImageDataUrl(dataUrl);
      setPendingImage({ b64: res.b64, mimeType: res.mimeType });

      if (includeCaption && !hasEditedCaption) {
        const captionPrompt =
          'Write a concise figure caption (max 12 words). If the figure description is already a short noun phrase (e.g. "Quantum Girl"), use it verbatim as the caption. Return ONLY the caption text (no quotes).';
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

      const captionForInsert = includeCaption ? caption.trim() : '';

      const snippet =
        ctx.editFormat === 'latex'
          ? latexFigureBlockFor({ src: asset.ref, captionText: captionForInsert })
          : xmdFigureLineFor({ src: asset.ref, captionText: captionForInsert });

      const p = await onPreviewInsert({ content: snippet, placement: 'after' });
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

      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0">
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
                  setUploadFileName('');
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

            {mode === 'generate' && (
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
            )}

            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={includeCaption}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIncludeCaption(checked);
                  if (!checked) {
                    setCaption('');
                    setHasEditedCaption(false);
                  } else {
                    // User can type immediately; only AI-generate if they haven't typed.
                    setHasEditedCaption(false);
                  }
                }}
              />
              Caption
            </label>

            {includeCaption && (
              <label className="block">
                <div className="text-[11px] text-gray-400 mb-1">Caption</div>
                <input
                  value={caption}
                  onChange={(e) => {
                    setHasEditedCaption(true);
                    setCaption(e.target.value);
                  }}
                  className="w-full bg-gray-950 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
                  placeholder="Caption"
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
                <div className="flex items-center gap-2 min-w-0">
                  <label
                    className={`inline-flex items-center justify-center px-2 py-1 h-7 text-xs whitespace-nowrap shrink-0 rounded border transition-colors ${
                      isLoading
                        ? 'bg-gray-900 text-gray-500 border-gray-800 cursor-not-allowed'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700 cursor-pointer'
                    }`}
                  >
                    Choose file
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isLoading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        setUploadFileName(f?.name || '');
                        if (f) void doUpload(f);
                      }}
                      className="sr-only"
                    />
                  </label>
                  <div className="text-xs text-gray-400 truncate min-w-0 flex-1">
                    {uploadFileName || 'No file selected'}
                  </div>
                </div>
              </label>
            )}

            <details className="border border-gray-800 rounded bg-gray-950/30 max-w-full overflow-hidden">
              <summary className="cursor-pointer select-none px-2 py-1 text-xs text-gray-300 hover:bg-gray-900/40 rounded">
                Advanced
              </summary>
              <div className="p-2 space-y-2">
                <div className="grid grid-cols-1 gap-2 min-w-0">
                  <label className="block">
                    <div className="text-[11px] text-gray-400 mb-1">Placement</div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {(
                        [
                          { key: 'block', label: 'Block' },
                          { key: 'inline', label: 'Inline' },
                        ] as const
                      ).map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setPlacement(o.key)}
                          className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                            placement === o.key
                              ? 'bg-gray-800 text-gray-200 border-gray-700'
                              : 'bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </label>

                  <label className="block">
                    <div className="text-[11px] text-gray-400 mb-1">Align</div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {(
                        [
                          { key: 'left', label: 'Left' },
                          { key: 'center', label: 'Center' },
                          { key: 'right', label: 'Right' },
                        ] as const
                      ).map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setAlign(o.key)}
                          className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                            align === o.key
                              ? 'bg-gray-800 text-gray-200 border-gray-700'
                              : 'bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </label>

                  <label className="block">
                    <div className="text-[11px] text-gray-400 mb-1">Width</div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        {(
                          [
                            { key: 'auto', label: 'Auto' },
                            { key: 'small', label: 'Small' },
                            { key: 'medium', label: 'Medium' },
                            { key: 'large', label: 'Large' },
                            { key: 'custom', label: 'Custom' },
                          ] as const
                        ).map((o) => (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() => setWidthPreset(o.key)}
                            className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                              widthPreset === o.key
                                ? 'bg-gray-800 text-gray-200 border-gray-700'
                                : 'bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800'
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>

                      {widthPreset === 'custom' && (
                        <div className="flex items-center gap-2">
                          <input
                            value={customWidthPct}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/%/g, '').trim();
                              if (raw === '' || /^\d+(\.\d+)?$/.test(raw)) setCustomWidthPct(raw);
                            }}
                            className="w-full min-w-0 bg-gray-950 text-xs text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
                            placeholder="e.g. 50"
                            inputMode="decimal"
                          />
                          <div className="text-xs text-gray-400">%</div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </details>

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

        {imageDataUrl && (
          <div className="w-48 shrink-0">
            <div className="border border-gray-800 rounded p-2 bg-gray-950/40">
              <div className="text-[10px] text-gray-400 mb-1">Preview</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUrl}
                alt=""
                className="w-full h-auto rounded border border-gray-800 object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


