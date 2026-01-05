import { updateGridHeaderLine } from '../component-ai-edit';
import { applyFigurePatchToLine, pickAllowedFigureAttrs } from './figure';

export function extractFirstGridBlock(text: string): string | null {
  // Models sometimes return prose + a fenced grid block. Grab the first :::...::: region.
  const s = String(text ?? '');
  const m = /(^|\n)(:::[^\n]*\n[\s\S]*?\n:::)(\n|$)/m.exec(s);
  if (!m) return null;
  return String(m[2] ?? '').trim();
}

export function buildGridEditSummary(original: string, replacement: string): string | null {
  // grid
  const figRe = /!\[([^\]]*)\]\(([^)\s]+)\)\s*(\{[^}]*\})?/g;
  const parseAll = (txt: string) => {
    const out: Array<{ caption: string; src: string; attrsInner: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = figRe.exec(txt))) {
      const caption = (m[1] ?? '').trim();
      const src = (m[2] ?? '').trim();
      const rawAttrs = String(m[3] ?? '').trim();
      const inner = rawAttrs.startsWith('{') && rawAttrs.endsWith('}') ? rawAttrs.slice(1, -1) : '';
      out.push({ caption, src, attrsInner: inner });
    }
    return out;
  };

  const extractWidthPct = (attrsInner: string): number | null => {
    const m = /\bwidth\s*=\s*"?(\d{1,3})%?"?\b/i.exec(String(attrsInner ?? ''));
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };
  const extractAlign = (attrsInner: string): 'left' | 'center' | 'right' | null => {
    const m = /\balign\s*=\s*"?\b(left|center|right)\b"?/i.exec(String(attrsInner ?? ''));
    if (!m) return null;
    const v = String(m[1] ?? '').toLowerCase();
    return v === 'left' || v === 'center' || v === 'right' ? v : null;
  };

  const a = parseAll(original);
  const b = parseAll(replacement);
  const count = b.length || a.length;
  if (count === 0) return null;

  const widthChanged: number[] = [];
  const alignChanged: number[] = [];
  const oldWs = new Set<number>();
  const newWs = new Set<number>();
  const newAs = new Set<string>();

  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const aw = extractWidthPct(a[i]!.attrsInner);
    const bw = extractWidthPct(b[i]!.attrsInner);
    if (aw !== null) oldWs.add(aw);
    if (bw !== null) newWs.add(bw);
    if (aw !== bw) widthChanged.push(i);

    const aa = extractAlign(a[i]!.attrsInner);
    const ba = extractAlign(b[i]!.attrsInner);
    if (ba) newAs.add(ba);
    if (aa !== ba) alignChanged.push(i);
  }

  const parts: string[] = [];
  const oldArr = Array.from(oldWs);
  const newArr = Array.from(newWs);
  if (widthChanged.length > 0 && newArr.length === 1) {
    const nw = newArr[0]!;
    if (oldArr.length === 1 && oldArr[0] !== nw) {
      parts.push(`increase the width of ${widthChanged.length} image${widthChanged.length === 1 ? '' : 's'} from ${oldArr[0]}% to ${nw}%`);
    } else {
      parts.push(`set the width of ${widthChanged.length} image${widthChanged.length === 1 ? '' : 's'} to ${nw}%`);
    }
  } else if (widthChanged.length > 0) {
    parts.push(`adjust the width of ${widthChanged.length} image${widthChanged.length === 1 ? '' : 's'}`);
  }

  const newAlignArr = Array.from(newAs);
  if (alignChanged.length > 0 && newAlignArr.length === 1) {
    const na = newAlignArr[0]!;
    parts.push(`set ${alignChanged.length} image${alignChanged.length === 1 ? '' : 's'} to ${na}-aligned`);
  } else if (alignChanged.length > 0) {
    parts.push(`adjust alignment for ${alignChanged.length} image${alignChanged.length === 1 ? '' : 's'}`);
  }

  if (parts.length > 0) return `I’ll ${parts.join(' and ')}.`;
  return null;
}

export function applyGridPlanToXmd(params: {
  original: string;
  headerSet?: any;
  figures?: any;
}): string {
  const { original, headerSet, figures } = params;
  const lines = String(original).split('\n');
  const headerIdx = lines.findIndex((l) => l.trim().startsWith(':::'));
  if (headerIdx >= 0 && headerSet) {
    lines[headerIdx] = updateGridHeaderLine(lines[headerIdx] || '', headerSet);
  }

  const scope = figures?.scope?.kind === 'cellIndices' ? new Set<number>(figures?.scope?.indices || []) : null;
  const attrsToSet = pickAllowedFigureAttrs((figures?.set?.attrs || {}) as Record<string, string>);
  if (figures && Object.keys(attrsToSet).length > 0) {
    const block = lines.join('\n');
    const figRe = /!\[([^\]]*)\]\(([^)\s]+)\)\s*(\{[^}]*\})?/g;
    const matches: Array<{ idx: number; start: number; end: number; text: string }> = [];
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = figRe.exec(block))) {
      const start = m.index;
      const text = m[0] || '';
      const end = start + text.length;
      matches.push({ idx: i++, start, end, text });
    }
    let next = block;
    for (let mi = matches.length - 1; mi >= 0; mi--) {
      const mm = matches[mi]!;
      if (scope && !scope.has(mm.idx)) continue;
      const updated = applyFigurePatchToLine({ line: mm.text, patch: { attrs: attrsToSet } });
      if (!updated) continue;
      next = next.slice(0, mm.start) + updated + next.slice(mm.end);
    }
    return next;
  }

  return lines.join('\n');
}


