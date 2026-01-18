import React, { useEffect, useMemo, useState } from 'react';
import type { InlineWizardProps } from './types';

type Align = 'L' | 'C' | 'R';
type Rule = 'none' | 'single' | 'double';
type BorderStyle = 'solid' | 'dotted' | 'dashed';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function escapeXmdAttr(s: string): string {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
}

function escapeLatexTextLite(s: string): string {
  // Minimal escaping for captions/labels; good enough for our wizard-generated placeholders.
  return String(s ?? '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([%$#&_{}])/g, '\\$1')
    .replace(/\^/g, '\\^{}')
    .replace(/~/g, '\\textasciitilde{}')
    .trim();
}

function hexToLatexColorDef(hexRaw: string): { name: string; defineLine: string; applyName: string } | null {
  const t = String(hexRaw ?? '').trim();
  const m = /^#?([0-9a-fA-F]{6})$/.exec(t);
  if (!m) return null;
  const hex = (m[1] || '').toUpperCase();
  const name = 'zxTableRuleColor';
  return {
    name,
    defineLine: `\\definecolor{${name}}{HTML}{${hex}}`,
    applyName: name,
  };
}

function ruleChar(r: Rule): '.' | '-' | '=' {
  return r === 'double' ? '=' : r === 'single' ? '-' : '.';
}

function boundaryToken(r: Rule): string {
  return r === 'double' ? '||' : r === 'single' ? '|' : '';
}

function buildColSpec(params: { aligns: Align[]; vRules: Rule[] }): string {
  const cols = params.aligns.length;
  const v = params.vRules.length === cols + 1 ? params.vRules : Array.from({ length: cols + 1 }).map(() => 'none' as const);
  let s = '';
  s += boundaryToken(v[0] ?? 'none');
  for (let i = 0; i < cols; i++) {
    s += params.aligns[i] ?? 'L';
    s += boundaryToken(v[i + 1] ?? 'none');
  }
  return s.trim().length > 0 ? s : Array.from({ length: cols }).map(() => 'L').join('');
}

function defaultHeader(cols: number): string[] {
  const names = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  return Array.from({ length: cols }).map((_, i) => names[i] ?? `C${i + 1}`);
}

export function InsertTableWizard({ ctx, onCancel, onCloseAll, onPreviewInsert, onApply }: InlineWizardProps) {
  const [cols, setCols] = useState<number>(3);
  const [rows, setRows] = useState<number>(2);
  const [caption, setCaption] = useState<string>('');
  const [label, setLabel] = useState<string>(''); // e.g. tbl:results

  const [borderStyle, setBorderStyle] = useState<BorderStyle>('solid');
  const [borderColor, setBorderColor] = useState<string>('#6b7280');
  // In our IR/LaTeX pipeline, "borderWidthPx" is treated as pt in LaTeX output.
  // Allow 0 to disable borders completely.
  const [borderWidth, setBorderWidth] = useState<number>(1);

  const [aligns, setAligns] = useState<Align[]>(['L', 'C', 'R']);
  const [vRules, setVRules] = useState<Rule[]>(['single', 'none', 'none', 'single']); // boundaries: left, between cols..., right
  const [hTop, setHTop] = useState<Rule>('none');
  const [hAfterHeader, setHAfterHeader] = useState<Rule>('none');
  const [hBetweenRows, setHBetweenRows] = useState<Rule[]>(['none']); // length rows-1
  const [hBottom, setHBottom] = useState<Rule>('none');

  const safeCols = clamp(cols, 2, 24);
  const safeRows = clamp(rows, 1, 40);

  useEffect(() => {
    if (safeCols !== cols) setCols(safeCols);
    if (safeRows !== rows) setRows(safeRows);
  }, [safeCols, safeRows, cols, rows]);

  // Keep per-col arrays sized.
  useEffect(() => {
    setAligns((prev) => {
      const next = prev.slice(0, safeCols);
      while (next.length < safeCols) next.push('L');
      return next;
    });
    setVRules((prev) => {
      const next = prev.slice(0, safeCols + 1) as Rule[];
      while (next.length < safeCols + 1) next.push('none');
      // Keep a sensible default if everything is empty.
      const allNone = next.find((x) => x !== 'none') === undefined;
      if (allNone) {
        next[0] = 'single';
        next[next.length - 1] = 'single';
      }
      return next;
    });
  }, [safeCols]);

  useEffect(() => {
    setHBetweenRows((prev) => {
      const needed = Math.max(0, safeRows - 1);
      const next = prev.slice(0, needed);
      while (next.length < needed) next.push('none');
      return next;
    });
  }, [safeRows]);

  const snippet = useMemo(() => {
    const header = defaultHeader(safeCols);
    const sep = header.map(() => '---');
    const dataRows = Array.from({ length: safeRows }).map(() => Array.from({ length: safeCols }).map(() => ''));

    const attrs: string[] = [];
    if (caption.trim()) attrs.push(`caption="${escapeXmdAttr(caption)}"`);
    if (label.trim()) attrs.push(`label="${escapeXmdAttr(label)}"`);
    if (borderStyle) attrs.push(`borderStyle="${escapeXmdAttr(borderStyle)}"`);
    if (borderColor.trim()) attrs.push(`borderColor="${escapeXmdAttr(borderColor)}"`);
    if (Number.isFinite(borderWidth) && borderWidth >= 0) attrs.push(`borderWidth="${Math.round(borderWidth)}"`);

    const colSpec = buildColSpec({ aligns, vRules });

    const lines: string[] = [];
    if (ctx.editMode === 'latex') {
      const borderNone = Number.isFinite(borderWidth) && Math.round(borderWidth) === 0;
      const bwPt = Number.isFinite(borderWidth) ? Math.max(0, Math.round(borderWidth)) : 1;
      const colorDef = borderNone ? null : hexToLatexColorDef(borderColor);
      // Dotted/dashed require extra packages; our exporter degrades to solid, so do the same here.
      void borderStyle;

      const v = vRules.length === safeCols + 1 ? vRules : Array.from({ length: safeCols + 1 }).map(() => 'none' as const);
      const colToken = (a: Align) =>
        a === 'C'
          ? '>{\\centering\\arraybackslash}X'
          : a === 'R'
            ? '>{\\raggedleft\\arraybackslash}X'
            : '>{\\raggedright\\arraybackslash}X';
      const vTok = (r: Rule) => (r === 'double' ? '||' : r === 'single' ? '|' : '');
      const colSpecLatex = (() => {
        if (borderNone) return aligns.slice(0, safeCols).map((a) => colToken(a ?? 'L')).join('');
        let s = '';
        s += vTok(v[0] ?? 'none');
        for (let i = 0; i < safeCols; i++) {
          s += colToken(aligns[i] ?? 'L');
          s += vTok(v[i + 1] ?? 'none');
        }
        return s;
      })();

      const totalRows = 1 + dataRows.length;
      const hRules: Rule[] = [];
      hRules.push(hTop);
      hRules.push(hAfterHeader);
      for (let i = 0; i < dataRows.length - 1; i++) hRules.push(hBetweenRows[i] ?? 'none');
      hRules.push(hBottom);
      while (hRules.length < totalRows + 1) hRules.push('none');
      if (hRules.length > totalRows + 1) hRules.length = totalRows + 1;

      const emitHLines = (r: Rule) => {
        if (borderNone) return;
        if (r === 'single') lines.push('\\hline');
        else if (r === 'double') lines.push('\\hline', '\\hline');
      };

      const cap = caption.trim();
      const lab = label.trim();

      lines.push('\\begin{table}[h]');
      lines.push('\\centering');
      // Scope rule styling to this table only.
      lines.push('{');
      if (colorDef) lines.push(colorDef.defineLine);
      if (!borderNone) lines.push(`\\setlength{\\arrayrulewidth}{${bwPt}pt}`);
      lines.push(`\\begin{tabularx}{\\linewidth}{${colSpecLatex}}`);
      if (colorDef) lines.push(`\\arrayrulecolor{${colorDef.applyName}}`);

      // boundary 0
      emitHLines(hRules[0] ?? 'none');
      // header row
      lines.push(`${header.map((h) => `\\textbf{${escapeLatexTextLite(h)}}`).join(' & ')} \\\\`);
      // boundary 1
      emitHLines(hRules[1] ?? 'none');
      // body rows + boundaries after each row
      for (let r = 0; r < dataRows.length; r++) {
        const row = dataRows[r] ?? [];
        const cells = Array.from({ length: safeCols }).map((_, i) => escapeLatexTextLite(String(row[i] ?? '').trim()));
        lines.push(`${cells.join(' & ')} \\\\`);
        emitHLines(hRules[2 + r] ?? 'none');
      }

      lines.push('\\end{tabularx}');
      lines.push('}');
      if (cap.length > 0) lines.push(`\\caption{${escapeLatexTextLite(cap)}}`);
      if (lab.length > 0) lines.push(`\\label{${escapeLatexTextLite(lab)}}`);
      lines.push('\\end{table}');
      return `${lines.join('\n')}\n`;
    }

    // Markdown/XMD table v1
    lines.push(`:::${attrs.length ? ` ${attrs.join(' ')}` : ''}`);
    lines.push(colSpec);
    if (hTop !== 'none') lines.push(ruleChar(hTop));

    lines.push(`| ${header.join(' | ')} |`);
    lines.push(`| ${sep.join(' | ')} |`);

    if (hAfterHeader !== 'none') lines.push(ruleChar(hAfterHeader));

    for (let r = 0; r < dataRows.length; r++) {
      lines.push(`| ${dataRows[r]!.join(' | ')} |`);
      if (r < dataRows.length - 1) {
        const hr = hBetweenRows[r] ?? 'none';
        if (hr !== 'none') lines.push(ruleChar(hr));
      }
    }

    if (hBottom !== 'none') lines.push(ruleChar(hBottom));
    lines.push(':::');
    return lines.join('\n');
  }, [
    ctx.editMode,
    safeCols,
    safeRows,
    caption,
    label,
    borderStyle,
    borderColor,
    borderWidth,
    aligns,
    vRules,
    hTop,
    hAfterHeader,
    hBetweenRows,
    hBottom,
  ]);

  const canInsert = Boolean(onPreviewInsert);

  const doInsert = async () => {
    if (!onPreviewInsert) return;
    const preview = await onPreviewInsert({ content: snippet });
    await onApply(preview);
    onCloseAll();
  };

  const RuleSelect = (props: { value: Rule; onChange: (v: Rule) => void; label: string }) => (
    <label className="flex items-center gap-2 text-xs text-vscode-text-secondary">
      <span className="w-[110px]">{props.label}</span>
      <select
        className="bg-vscode-editorWidgetBg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as Rule)}
      >
        <option value="none">none (.)</option>
        <option value="single">single (-)</option>
        <option value="double">double (=)</option>
      </select>
    </label>
  );

  return (
    <div className="p-3 text-vscode-text">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Insert table</div>
        <button
          type="button"
          className="text-xs text-vscode-text-secondary hover:text-vscode-text"
          onClick={onCancel}
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-vscode-text-secondary">
          <span>Columns</span>
          <input
            className="bg-vscode-editorWidgetBg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text"
            type="number"
            min={2}
            max={24}
            value={cols}
            onChange={(e) => setCols(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-vscode-text-secondary">
          <span>Rows</span>
          <input
            className="bg-vscode-editorWidgetBg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text"
            type="number"
            min={1}
            max={40}
            value={rows}
            onChange={(e) => setRows(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-vscode-text-secondary">
          <span>Caption</span>
          <input
            className="bg-vscode-editorWidgetBg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text"
            placeholder="Optional caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-vscode-text-secondary">
          <span>Label</span>
          <input
            className="bg-vscode-editorWidgetBg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text"
            placeholder='e.g. tbl:results'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-3">
        <div className="text-xs text-vscode-text-secondary mb-1">Column alignment</div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: safeCols }).map((_, i) => (
            <label key={i} className="flex items-center gap-1 text-xs text-vscode-text-secondary">
              <span className="w-6">C{i + 1}</span>
              <select
                className="bg-vscode-editorWidgetBg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text"
                value={aligns[i] ?? 'L'}
                onChange={(e) =>
                  setAligns((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value as Align;
                    return next;
                  })
                }
              >
                <option value="L">L</option>
                <option value="C">C</option>
                <option value="R">R</option>
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-xs text-vscode-text-secondary mb-1">Vertical borders (boundaries)</div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: safeCols + 1 }).map((_, i) => (
            <label key={i} className="flex items-center gap-1 text-xs text-vscode-text-secondary">
              <span className="w-12">{i === 0 ? 'left' : i === safeCols ? 'right' : `c${i}|c${i + 1}`}</span>
              <select
                className="bg-vscode-editorWidgetBg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text"
                value={vRules[i] ?? 'none'}
                onChange={(e) =>
                  setVRules((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value as Rule;
                    return next;
                  })
                }
              >
                <option value="none">none</option>
                <option value="single">|</option>
                <option value="double">||</option>
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-xs text-vscode-text-secondary mb-1">Horizontal rules (between rows)</div>
        <div className="flex flex-col gap-2">
          <RuleSelect label="Top" value={hTop} onChange={setHTop} />
          <RuleSelect label="After header" value={hAfterHeader} onChange={setHAfterHeader} />
          {Array.from({ length: Math.max(0, safeRows - 1) }).map((_, i) => (
            <RuleSelect
              key={i}
              label={`Between row ${i + 1} and ${i + 2}`}
              value={hBetweenRows[i] ?? 'none'}
              onChange={(v) =>
                setHBetweenRows((prev) => {
                  const next = [...prev];
                  next[i] = v;
                  return next;
                })
              }
            />
          ))}
          <RuleSelect label="Bottom" value={hBottom} onChange={setHBottom} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs text-vscode-text-secondary">
          <span>Border style</span>
          <select
            className="bg-vscode-editorWidgetBg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text"
            value={borderStyle}
            onChange={(e) => setBorderStyle(e.target.value as BorderStyle)}
          >
            <option value="solid">solid</option>
            <option value="dotted">dotted</option>
            <option value="dashed">dashed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-vscode-text-secondary">
          <span>Border color</span>
          <input
            className="bg-vscode-editorWidgetBg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text"
            value={borderColor}
            onChange={(e) => setBorderColor(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-vscode-text-secondary">
          <span>Border width (px)</span>
          <input
            className="bg-vscode-editorWidgetBg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text"
            type="number"
            min={0}
            max={8}
            value={borderWidth}
            onChange={(e) => setBorderWidth(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="mt-3">
        <div className="text-xs text-vscode-text-secondary mb-1">Preview snippet</div>
        <pre className="bg-vscode-editorWidgetBg border border-vscode-border rounded p-2 text-[11px] overflow-auto max-h-44">
          {snippet}
        </pre>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          className="px-3 py-1 text-xs rounded border border-vscode-border bg-transparent hover:bg-vscode-buttonHoverBg"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canInsert}
          className="px-3 py-1 text-xs rounded border border-vscode-border bg-vscode-buttonBg hover:bg-vscode-buttonHoverBg disabled:opacity-50"
          onClick={doInsert}
        >
          Insert table
        </button>
      </div>
    </div>
  );
}


