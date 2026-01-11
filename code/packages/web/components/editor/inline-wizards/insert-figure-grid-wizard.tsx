import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { InlineWizardProps } from './types';

type CellData = {
  id: string;
  previewDataUrl?: string;
  b64?: string;
  mimeType?: string;
  origin?: 'ai' | 'upload';
  whatText: string;
  captionText: string;
  captionWasEdited?: boolean;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function escapeXmdAttr(s: string): string {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
}

function toLatexAssetsPath(ref: string): string {
  const s = String(ref ?? '').trim();
  const prefix = 'zadoox-asset://';
  if (s.startsWith(prefix)) return `assets/${s.slice(prefix.length)}`;
  return s;
}

function escapeLatexTextLite(text: string): string {
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
}

function latexFigureCellForGrid(params: { src: string; captionText: string; cols: number }): string {
  const captionText = escapeLatexTextLite((params.captionText ?? '').trim());
  const gutter = 0.02;
  const usable = Math.max(0.5, 1 - gutter * (params.cols - 1));
  const w = usable / params.cols;
  const width = `${w.toFixed(3)}\\textwidth`;
  const srcPath = toLatexAssetsPath(params.src);
  const lines: string[] = [];
  lines.push('\\begin{tabular}{@{}c@{}}');
  lines.push(`\\includegraphics[width=${width}]{\\detokenize{${srcPath}}}`);
  if (captionText) lines.push(`\\\\ {\\scriptsize ${captionText}}`);
  lines.push('\\end{tabular}');
  return lines.join('\n');
}

export function InsertFigureGridWizard({ ctx, onCancel, onCloseAll, onPreviewInsert, onApply }: InlineWizardProps) {
  const [mode, setMode] = useState<'generate' | 'upload'>('generate');
  const scopeText = ctx.scope.text.trim();
  const canUseScope = scopeText.length > 0;
  const [gridCols, setGridCols] = useState<number>(2);
  const [gridRows, setGridRows] = useState<number>(1);
  const [gridCaption, setGridCaption] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateCaption, setGenerateCaption] = useState<boolean>(false);

  const whatInputRef = useRef<HTMLInputElement>(null);

  const makeCells = (count: number): CellData[] =>
    Array.from({ length: count }).map((_, i) => ({
      id: `fig:grid-${Date.now()}-${i}`,
      whatText: '',
      captionText: '',
    }));

  const [cells, setCells] = useState<CellData[]>(() => makeCells(2)); // default 1 row x 2 cols

  // Ensure the cells array matches rows*cols, preserving existing content.
  useEffect(() => {
    const cols = clamp(gridCols, 1, 24);
    if (cols !== gridCols) setGridCols(cols);
    const needed = gridRows * cols;
    setCells((prev) => {
      const next = prev.slice(0, needed);
      while (next.length < needed) next.push(...makeCells(1));
      return next;
    });
    setSelectedIndex((idx) => clamp(idx, 0, Math.max(0, needed - 1)));
  }, [gridRows, gridCols]);

  const safeCols = clamp(gridCols, 1, 24);

  const selectedCell = cells[selectedIndex];
  const selectedRow = Math.floor(selectedIndex / safeCols) + 1;
  const selectedCol = (selectedIndex % safeCols) + 1;

  // Prefill whatText from scope for the selected cell if empty.
  const lastScopeTextRef = useRef(scopeText);
  useEffect(() => {
    const scopeChanged = lastScopeTextRef.current !== scopeText;
    lastScopeTextRef.current = scopeText;
    if (!canUseScope || !scopeChanged) return;
    setCells((prev) =>
      prev.map((c, i) => {
        if (i !== selectedIndex) return c;
        if (c.whatText.trim().length > 0) return c;
        return { ...c, whatText: scopeText };
      })
    );
  }, [scopeText, canUseScope, selectedIndex]);

  const generatedPrompt = useMemo(() => {
    const parts: string[] = [];
    parts.push('Create a clean, publication-ready figure image.');
    parts.push('Style: minimal, high contrast, no watermark.');
    parts.push('IMPORTANT: Do NOT include any text, labels, numbers, legends, or watermarks inside the image.');
    if (selectedCell?.whatText.trim()) parts.push(`Figure should show: ${selectedCell.whatText.trim()}`);
    if (selectedCell?.captionText.trim()) parts.push(`Caption: ${selectedCell.captionText.trim()}`);
    return parts.join('\n\n');
  }, [selectedCell?.whatText, selectedCell?.captionText]);

  const parseDataUrl = (dataUrl: string): { mimeType: string; b64: string } => {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
    if (!m) throw new Error('Invalid data URL');
    return { mimeType: m[1], b64: m[2] };
  };

  const applyCellMedia = (params: { dataUrl: string; origin: 'ai' | 'upload'; captionText?: string }) => {
    const { mimeType, b64 } = parseDataUrl(params.dataUrl);
    setCells((prev) => {
      const next = prev.map((c, i) => {
        if (i !== selectedIndex) return c;
        return {
          ...c,
          previewDataUrl: params.dataUrl,
          b64,
          mimeType,
          origin: params.origin,
          ...(typeof params.captionText === 'string'
            ? { captionText: params.captionText, captionWasEdited: false }
            : null),
        };
      });

      // Auto-advance to next empty cell (if any)
      const nextIdx = (() => {
        for (let i = selectedIndex + 1; i < next.length; i++) {
          const c = next[i]!;
          if (!c.b64) return i;
        }
        return null;
      })();
      if (nextIdx !== null) setSelectedIndex(nextIdx);
      return next;
    });
  };

  const doGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!selectedCell?.whatText.trim()) throw new Error('Describe what the figure should show');
      const res = await api.ai.images.generate({ prompt: generatedPrompt, model: 'auto' });
      const dataUrl = `data:${res.mimeType};base64,${res.b64}`;

      let captionText: string | undefined;
      const wantsCaption = generateCaption;
      const alreadyEditedCaption = Boolean(selectedCell?.captionWasEdited) && (selectedCell?.captionText ?? '').trim().length > 0;
      if (wantsCaption && !alreadyEditedCaption) {
        const captionPrompt =
          'Write a concise figure caption (max 12 words). If the figure description is already a short noun phrase (e.g. "Quantum Girl"), use it verbatim as the caption. Return ONLY the caption text (no quotes).';
        const contextText = [
          selectedCell?.whatText?.trim() ? `Figure description:\n${selectedCell.whatText.trim()}` : '',
          scopeText ? `Document context:\n${scopeText}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        const captionRes = await api.ai.inline.generate({
          prompt: captionPrompt,
          context: { blockContent: contextText || selectedCell?.whatText?.trim() || scopeText || 'Figure' },
          mode: 'replace',
          model: 'auto',
        });
        captionText = String(captionRes.content ?? '').trim();
      }

      applyCellMedia({ dataUrl, origin: 'ai', ...(captionText ? { captionText } : null) });
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
      applyCellMedia({ dataUrl, origin: 'upload' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const doClearCell = () => {
    setCells((prev) =>
      prev.map((c, i) =>
        i === selectedIndex
          ? { ...c, previewDataUrl: undefined, b64: undefined, mimeType: undefined, origin: undefined }
          : c
      )
    );
  };

  const doInsert = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!onPreviewInsert) throw new Error('Insert is not available');
      const filled = cells.filter((c) => c.b64 && c.mimeType);
      if (filled.length === 0) throw new Error('Add at least one image to the grid');

      // Upload assets first
      const uploadedRefs: Array<{ cellIndex: number; ref: string; cell: CellData }> = [];
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i]!;
        if (!c.b64 || !c.mimeType) continue;
        const asset = await api.assets.upload({
          documentId: ctx.documentId,
          b64: c.b64,
          mimeType: c.mimeType,
        });
        uploadedRefs.push({ cellIndex: i, ref: asset.ref, cell: c });
      }

      const snippet =
        ctx.editMode === 'latex'
          ? (() => {
              const lines: string[] = [];
              lines.push('\\begin{figure}');
              lines.push('\\centering');
              lines.push(`\\begin{tabular}{${'c'.repeat(safeCols)}}`);
              for (let r = 0; r < gridRows; r++) {
                const rowCells: string[] = [];
                for (let c = 0; c < safeCols; c++) {
                  const idx = r * safeCols + c;
                  const up = uploadedRefs.find((x) => x.cellIndex === idx);
                  if (!up) rowCells.push('~');
                  else rowCells.push(latexFigureCellForGrid({ src: up.ref, captionText: up.cell.captionText, cols: safeCols }));
                }
                lines.push(rowCells.join('\n&\n') + (r < gridRows - 1 ? '\n\\\\' : ''));
              }
              lines.push('\\end{tabular}');
              if (gridCaption.trim().length > 0) lines.push(`\\caption{${escapeLatexTextLite(gridCaption.trim())}}`);
              lines.push('\\end{figure}');
              // No leading blank lines; keep a trailing newline so subsequent content starts cleanly.
              // Also avoid injecting an extra blank line before the figure when inserting at the end of a line.
              return `${lines.join('\n')}\n`;
            })()
          : (() => {
              const parts: string[] = [];
              const cap = gridCaption.trim();
              const capAttr = cap.length > 0 ? ` caption="${escapeXmdAttr(cap)}"` : '';
              parts.push(`::: cols=${safeCols}${capAttr}`);

              // Map uploads for quick lookup
              const map = new Map<number, { ref: string; cell: CellData }>();
              for (const u of uploadedRefs) map.set(u.cellIndex, { ref: u.ref, cell: u.cell });

              let labelIdx = 1;
              for (let r = 0; r < gridRows; r++) {
                for (let c = 0; c < safeCols; c++) {
                  const idx = r * safeCols + c;
                  const up = map.get(idx);
                  if (up) {
                    const alt = String(up.cell.captionText ?? '').replace(/\n/g, ' ').trim();
                    const desc = up.cell.whatText.trim().length > 0 ? ` desc="${escapeXmdAttr(up.cell.whatText)}"` : '';
                    const gen = up.cell.origin === 'ai' ? ` gen="ai"` : '';
                    parts.push(`![${alt}](${up.ref}){#${up.cell.id} label="Figure {REF}.${labelIdx}"${desc}${gen}}`);
                    labelIdx++;
                  }
                  if (c < safeCols - 1) parts.push('|||');
                }
                if (r < gridRows - 1) parts.push('---');
              }
              parts.push(':::');
              return `\n\n${parts.join('\n')}\n\n`;
            })();

      const p = await onPreviewInsert({ content: snippet, placement: 'after' });
      await onApply(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-3 max-h-[70vh] overflow-auto">
      <div className="text-xs text-gray-400 mb-2">Insert figure grid</div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="block">
          <div className="text-[11px] text-gray-400 mb-1">Columns</div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setGridCols((c) => clamp(c - 1, 1, 24))}
              className="px-2 py-1 text-[11px] rounded border bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800"
              aria-label="Decrease columns"
            >
              −
            </button>
            <div className="text-[11px] text-gray-200 w-6 text-center">{gridCols}</div>
            <button
              type="button"
              onClick={() => setGridCols((c) => clamp(c + 1, 1, 24))}
              className="px-2 py-1 text-[11px] rounded border bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800"
              aria-label="Increase columns"
            >
              +
            </button>
          </div>
        </label>

        <label className="block">
          <div className="text-[11px] text-gray-400 mb-1">Rows</div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setGridRows((r) => clamp(r - 1, 1, 12))}
              className="px-2 py-1 text-[11px] rounded border bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800"
              aria-label="Decrease rows"
            >
              −
            </button>
            <div className="text-[11px] text-gray-200 w-6 text-center">{gridRows}</div>
            <button
              type="button"
              onClick={() => setGridRows((r) => clamp(r + 1, 1, 12))}
              className="px-2 py-1 text-[11px] rounded border bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800"
              aria-label="Increase rows"
            >
              +
            </button>
          </div>
        </label>
      </div>

      <label className="block mb-2">
        <div className="text-[11px] text-gray-400 mb-1">Grid caption (optional)</div>
        <input
          value={gridCaption}
          onChange={(e) => setGridCaption(e.target.value)}
          className="w-full bg-gray-950 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
          placeholder="Figure grid caption"
        />
      </label>

      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-[11px] text-gray-400">
            Selected cell: <span className="text-gray-200">Row {selectedRow}, Col {selectedCol}</span>
          </div>

          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${safeCols}, minmax(0, 1fr))` }}>
            {cells.map((c, idx) => {
              const filled = Boolean(c.previewDataUrl);
              const isSel = idx === selectedIndex;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`h-14 rounded border text-left p-1 transition-colors ${
                    isSel ? 'border-vscode-blue bg-gray-900/60' : 'border-gray-800 bg-gray-950/30 hover:bg-gray-900/40'
                  }`}
                  title={`Row ${Math.floor(idx / safeCols) + 1}, Col ${(idx % safeCols) + 1}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-10 h-10 rounded border ${filled ? 'border-gray-700' : 'border-gray-800'} bg-gray-950 overflow-hidden`}>
                      {filled && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.previewDataUrl} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-gray-300 truncate">
                        {filled ? 'Image set' : 'Empty'}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">{c.captionText || 'No caption'}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => doClearCell()}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 rounded border border-gray-800 transition-colors"
            >
              Clear cell
            </button>
            <div className="flex-1" />
          </div>
        </div>

        <div className="w-60 shrink-0">
          <div className="border border-gray-800 rounded p-2 bg-gray-950/40 space-y-2 max-h-[60vh] overflow-auto">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('generate');
                  setError(null);
                }}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  mode === 'generate' ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800'
                }`}
              >
                Generate
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('upload');
                  setError(null);
                }}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  mode === 'upload' ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800'
                }`}
              >
                Upload
              </button>
            </div>

            {mode === 'generate' && (
              <label className="block">
                <div className="text-[11px] text-gray-400 mb-1">What should this cell show?</div>
                <input
                  ref={whatInputRef}
                  value={selectedCell?.whatText ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCells((prev) => prev.map((c, i) => (i === selectedIndex ? { ...c, whatText: v } : c)));
                  }}
                  className="w-full bg-gray-950 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
                  placeholder={canUseScope ? 'Prefilled from scope (editable)' : 'e.g. Architecture diagram'}
                />
              </label>
            )}

            {mode === 'upload' && (
              <label className="block">
                <div className="text-[11px] text-gray-400 mb-1">Choose image</div>
                <label
                  className={`inline-flex items-center justify-center px-2 py-1 h-7 text-xs whitespace-nowrap rounded border transition-colors ${
                    isLoading ? 'bg-gray-900 text-gray-500 border-gray-800 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700 cursor-pointer'
                  }`}
                >
                  Choose file
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isLoading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void doUpload(f);
                    }}
                    className="sr-only"
                  />
                </label>
              </label>
            )}

            <label className="block">
              <div className="text-[11px] text-gray-400 mb-1">Cell caption (optional)</div>
              <input
                value={selectedCell?.captionText ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setCells((prev) =>
                    prev.map((c, i) =>
                      i === selectedIndex ? { ...c, captionText: v, captionWasEdited: true } : c
                    )
                  );
                }}
                className="w-full bg-gray-950 text-sm text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
                placeholder="Caption"
              />
            </label>

            {mode === 'generate' && (
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={generateCaption}
                  onChange={(e) => setGenerateCaption(e.target.checked)}
                />
                Generate caption
              </label>
            )}

            {mode === 'generate' && (
              <button
                type="button"
                onClick={doGenerate}
                disabled={isLoading || !(selectedCell?.whatText ?? '').trim()}
                className="w-full px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:opacity-50 text-gray-200 rounded border border-gray-700 transition-colors"
              >
                {isLoading ? 'Generating…' : 'Generate for this cell'}
              </button>
            )}

            {error && <div className="text-xs text-red-300">{error}</div>}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={doInsert}
                disabled={isLoading}
                className="px-2 py-1 text-xs bg-vscode-blue hover:bg-blue-600 disabled:bg-gray-900 disabled:opacity-50 text-white rounded transition-colors"
              >
                {isLoading ? 'Inserting…' : 'Insert grid'}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


