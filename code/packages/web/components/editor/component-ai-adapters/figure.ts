import { upsertXmdAttrInner } from '../component-ai-edit';

export function parseFigureLine(line: string): { caption: string; src: string; attrsInner: string } | null {
  const m = /!\[([^\]]*)\]\(([^)\s]+)\)\s*(\{[^}]*\})?/.exec(String(line ?? ''));
  if (!m) return null;
  const caption = m[1] ?? '';
  const src = m[2] ?? '';
  const raw = String(m[3] ?? '').trim();
  const inner = raw.startsWith('{') && raw.endsWith('}') ? raw.slice(1, -1) : '';
  return { caption, src, attrsInner: inner };
}

export function extractFirstFigureLine(text: string): string | null {
  // Models sometimes return prose + the figure line. We accept the first syntactically valid figure line.
  const s = String(text ?? '').trim();
  if (!s) return null;
  const m = /!\[[^\]]*\]\([^)\s]+\)\s*(\{[^}]*\})?/.exec(s);
  if (!m) return null;
  const candidate = String(m[0] ?? '').trim();
  return parseFigureLine(candidate) ? candidate : null;
}

function extractWidthPct(attrsInner: string): number | null {
  // Support width="50%", width=50%, width="50", width=50
  const m = /\bwidth\s*=\s*"?(\d{1,3})%?"?\b/i.exec(String(attrsInner ?? ''));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function extractAlign(attrsInner: string): 'left' | 'center' | 'right' | null {
  // Support align="left" and align=left
  const m = /\balign\s*=\s*"?\b(left|center|right)\b"?/i.exec(String(attrsInner ?? ''));
  if (!m) return null;
  const v = String(m[1] ?? '').toLowerCase();
  return v === 'left' || v === 'center' || v === 'right' ? v : null;
}

export function pickAllowedFigureAttrs(attrs: Record<string, string> | null | undefined): Record<string, string> {
  const input = attrs || {};
  const allowed = new Set(['width', 'align', 'placement', 'desc']);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    const key = String(k || '').trim();
    if (!allowed.has(key)) continue;
    out[key] = String(v);
  }
  return out;
}

export function applyFigurePatchToLine(input: { line: string; patch: { caption?: string; attrs?: Record<string, string> } }): string | null {
  const parsed = parseFigureLine(input.line);
  if (!parsed) return null;
  const caption = input.patch.caption !== undefined ? String(input.patch.caption) : parsed.caption;
  let attrsInner = parsed.attrsInner;
  const attrs = pickAllowedFigureAttrs(input.patch.attrs || {});
  for (const [k, v] of Object.entries(attrs)) {
    if (!v) continue;
    attrsInner = upsertXmdAttrInner(attrsInner, k, String(v));
  }
  const trimmed = attrsInner.trim();
  const attrBlock = trimmed.length > 0 ? `{${trimmed}}` : '';
  return `![${caption}](${parsed.src})${attrBlock}`;
}

export function buildFigureEditSummary(original: string, replacement: string): string | null {
  const a = parseFigureLine(original);
  const b = parseFigureLine(replacement);
  if (!a || !b) return null;
  const aw = extractWidthPct(a.attrsInner);
  const bw = extractWidthPct(b.attrsInner);
  if (aw !== null && bw !== null && aw !== bw) return `I’ll change this image width from ${aw}% to ${bw}%.`;
  if (bw !== null && aw === null) return `I’ll set this image width to ${bw}%.`;
  const aa = extractAlign(a.attrsInner);
  const ba = extractAlign(b.attrsInner);
  if (aa !== null && ba !== null && aa !== ba) return `I’ll change this image alignment from ${aa} to ${ba}.`;
  if (aa === null && ba !== null) return `I’ll set this image alignment to ${ba}.`;
  if (a.caption !== b.caption && b.caption.trim().length > 0) return `I’ll update the caption to “${b.caption}”.`;
  return null;
}


