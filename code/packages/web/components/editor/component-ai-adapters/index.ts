import type { ChatMessage, ComponentContext, EmbeddedComponentKind, ComponentEditCapabilities, ComponentEditResult } from './types';
import { applyFigurePatchToLine, extractFirstFigureLine, parseFigureLine } from './figure';
import { applyGridPlanToXmd, buildGridEditSummary, extractFirstGridBlock } from './grid';
import { buildFigureEditSummary } from './figure';

export type { EmbeddedComponentKind, ChatMessage, ComponentContext, ComponentEditCapabilities, ComponentEditResult };

export function buildComponentContext(params: {
  kind: EmbeddedComponentKind;
  original: string;
  conversation: ChatMessage[];
}): ComponentContext {
  const { kind, original, conversation } = params;
  if (kind === 'figure') {
    const parsed = parseFigureLine(original);
    return {
      kind: 'figure',
      figure: parsed ? { caption: parsed.caption, src: parsed.src, attrs: parsed.attrsInner } : { raw: original },
      conversation,
    };
  }

  const lines = String(original).split('\n');
  const header = (lines.find((l) => l.trim().startsWith(':::')) || '').trim();
  const figures: Array<{ index: number; caption: string; src: string; attrs: string }> = [];
  const figRe = /!\[([^\]]*)\]\(([^)\s]+)\)\s*(\{[^}]*\})?/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = figRe.exec(original))) {
    const cap = (m[1] ?? '').trim();
    const src = (m[2] ?? '').trim();
    const rawAttrs = String(m[3] ?? '').trim();
    const inner = rawAttrs.startsWith('{') && rawAttrs.endsWith('}') ? rawAttrs.slice(1, -1) : '';
    figures.push({ index: idx++, caption: cap, src, attrs: inner });
  }
  return { kind: 'grid', grid: { header, figuresCount: figures.length, figures }, conversation };
}

export function applyComponentPlanToXmd(params: {
  kind: EmbeddedComponentKind;
  original: string;
}): string | null {
  // Deprecated: plan-based application is being phased out in favor of model-returned updated XMD.
  // Keep this exported for now until all callers are migrated.
  return null;
}

export function buildComponentEditSummary(params: {
  kind: EmbeddedComponentKind;
  original: string;
  replacement: string;
}): string | null {
  if (params.kind === 'figure') return buildFigureEditSummary(params.original, params.replacement);
  return buildGridEditSummary(params.original, params.replacement);
}

export function normalizeUpdatedXmd(kind: EmbeddedComponentKind, updatedXmd: string): string {
  const raw = String(updatedXmd ?? '').trim();
  if (!raw) return raw;
  if (kind === 'figure') return extractFirstFigureLine(raw) ?? raw;
  return extractFirstGridBlock(raw) ?? raw;
}

export function buildComponentCapabilities(kind: EmbeddedComponentKind): ComponentEditCapabilities {
  // MVP: hard-coded in adapter (later: derived from IR node type + schema).
  // Crucially: this is passed to the model, not embedded in the provider prompt.
  return {
    allowSrcChange: false,
    allowRemove: true,
    allowedFigureAttrs: ['width', 'align', 'placement', 'desc'],
    allowedContainerAttrs: kind === 'grid' ? ['cols', 'caption', 'align', 'placement', 'margin'] : [],
    output: kind === 'figure' ? { shape: 'singleFigureLine' } : { shape: 'fencedGridBlock' },
  };
}

export function buildClarifySuggestions(kind: EmbeddedComponentKind, caps: ComponentEditCapabilities): string[] {
  const out: string[] = [];
  const fig = new Set(caps.allowedFigureAttrs || []);
  const container = new Set((caps.allowedContainerAttrs || []).map((s) => String(s).trim()).filter(Boolean));

  if (kind === 'grid') {
    if (fig.has('width')) out.push('Make images larger', 'Make images smaller');
    if (fig.has('align') || container.has('align')) out.push('Align center', 'Align left', 'Align right');
    if (container.has('cols')) out.push('Set cols=2', 'Set cols=3');
    if (container.has('margin')) out.push('Set margin=small', 'Set margin=medium');
    if (caps.allowRemove) out.push('Remove an image');
    if (out.length === 0) out.push('Change width', 'Change alignment');
    return Array.from(new Set(out));
  }

  // figure
  if (fig.has('width')) out.push('Set width to 50%', 'Set width to 80%');
  if (fig.has('align')) out.push('Align center', 'Align left', 'Align right');
  if (fig.has('placement')) out.push('Set placement inline', 'Set placement block');
  if (fig.has('desc')) out.push('Update description');
  if (out.length === 0) out.push('Change width', 'Change alignment');
  return Array.from(new Set(out));
}


