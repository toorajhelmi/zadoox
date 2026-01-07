export type ComponentAIKind = 'figure' | 'grid' | 'table';

export type ComponentAIEditDetail = {
  kind: ComponentAIKind;
  range: { from: number; to: number };
  text: string;
  anchorRect?: { top: number; left: number; width: number; height: number };
  grid?: { headerFrom: number; headerTo: number };
  initialMessage?: string;
};

export type ComponentAIClarifyPlan = {
  type: 'clarify';
  question: string;
  suggestions?: string[];
};

export type ComponentAIFigurePatchPlan = {
  type: 'patch';
  figure: {
    set?: {
      caption?: string;
      attrs?: Partial<Record<'width' | 'align' | 'placement' | 'desc', string>>;
    };
  };
};

export type ComponentAIGridPatchPlan = {
  type: 'patch';
  grid: {
    header?: {
      set?: Partial<{
        cols: number;
        caption: string | null;
        align: 'left' | 'center' | 'right';
        placement: 'block' | 'inline';
        margin: 'small' | 'medium' | 'large';
      }>;
    };
    figures?: {
      scope?: { kind: 'all' } | { kind: 'cellIndices'; indices: number[] };
      set?: {
        attrs?: Partial<Record<'width' | 'align' | 'placement' | 'desc', string>>;
      };
    };
  };
};

export type ComponentAIPlan = ComponentAIClarifyPlan | ComponentAIFigurePatchPlan | ComponentAIGridPatchPlan;

export function detectOutOfScopeForComponent(input: { kind: ComponentAIKind; prompt: string }): { outOfScope: boolean; message?: string } {
  const p = String(input.prompt ?? '').trim().toLowerCase();
  if (!p) return { outOfScope: true, message: 'Tell me what you want to change.' };

  const docTextSignals = ['conclusion', 'paragraph', 'section', 'chapter', 'intro', 'introduction', 'rewrite this section', 'add a section'];
  const componentSignals = ['caption', 'figure', 'image', 'grid', 'table', 'equation', 'align', 'width', 'placement', 'columns', 'cols', 'margin'];

  const mentionsDocText = docTextSignals.some((s) => p.includes(s));
  const mentionsComponent = componentSignals.some((s) => p.includes(s));

  if (mentionsDocText && !mentionsComponent) {
    return {
      outOfScope: true,
      message:
        'That sounds like a document-level edit (text/sections), not an edit to this component. Try selecting the paragraph and using inline chat (⌘K / Ctrl+K).',
    };
  }

  if (input.kind === 'figure') {
    if (p.includes('add column') || p.includes('add row') || p.includes('cols=') || p.includes('columns')) {
      return { outOfScope: true, message: 'That sounds like a grid/layout change. Try the grid toolbar prompt instead.' };
    }
  }

  return { outOfScope: false };
}

export function detectClarificationNeeded(input: { kind: ComponentAIKind; prompt: string }): { question: string; suggestions: string[] } | null {
  const p = String(input.prompt ?? '').trim().toLowerCase();
  if (!p) return { question: 'What would you like to change?', suggestions: [] };

  // Generic requests: ask one lightweight follow-up.
  const isGeneric =
    /^(make|improve|fix|update|change|adjust)(\s|$)/.test(p) ||
    p === 'better' ||
    p === 'fix this' ||
    p === 'improve this' ||
    p === 'make it better';

  const hasSpecificKeyword = ['caption', 'desc', 'description', 'width', 'align', 'placement', 'inline', 'block', 'cols', 'columns', 'margin'].some((k) =>
    p.includes(k)
  );

  if (isGeneric && !hasSpecificKeyword) {
    if (input.kind === 'figure') {
      return {
        question: 'Sure — what should change on this figure?',
        suggestions: ['Improve caption', 'Add/adjust description (desc=)', 'Change width', 'Change alignment', 'Change placement'],
      };
    }
    if (input.kind === 'table') {
      return {
        question: 'Sure — what should change on this table?',
        suggestions: ['Change caption', 'Change label', 'Change border style', 'Change border color', 'Change border width'],
      };
    }
    return {
      question: 'Sure — what should change on this grid?',
      suggestions: ['Change caption', 'Change columns (cols=)', 'Change alignment', 'Change placement', 'Change spacing (margin=)'],
    };
  }

  return null;
}

function escapeXmdAttrValue(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .trim();
}

export function upsertXmdAttrInner(attrsInner: string, key: string, value: string): string {
  const base = String(attrsInner ?? '').trim();
  const v = escapeXmdAttrValue(value);
  const re = new RegExp(`\\b${key}\\s*=\\s*"[^"]*"`, 'i');
  if (re.test(base)) {
    return base.replace(re, `${key}="${v}"`).trim();
  }
  const sep = base.length > 0 && !base.endsWith(' ') ? ' ' : '';
  return `${base}${sep}${key}="${v}"`.trim();
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(10, Math.min(100, Math.round(n)));
}

export function tryDeterministicComponentEdit(input: { kind: ComponentAIKind; prompt: string; original: string }): { replacement: string; reason: string } | null {
  const p = String(input.prompt ?? '').trim().toLowerCase();
  const original = String(input.original ?? '');
  if (!p) return null;

  if (input.kind === 'figure') {
    // Only allow safe, structural tweaks (no src changes) deterministically.
    const m = /!\[([^\]]*)\]\(([^)\s]+)\)\s*(\{[^}]*\})?/.exec(original);
    if (!m) return null;
    const caption = m[1] ?? '';
    const src = m[2] ?? '';
    const attrsRaw = (m[3] ?? '').trim();
    const attrsInner = attrsRaw.startsWith('{') && attrsRaw.endsWith('}') ? attrsRaw.slice(1, -1) : '';
    let nextAttrsInner = attrsInner;

    const wantsBigger = /\b(bigger|larger|increase size|increase)\b/.test(p);
    const wantsSmaller = /\b(smaller|decrease size|decrease)\b/.test(p);
    const wantsInline = /\binline\b/.test(p);
    const wantsBlock = /\bblock\b/.test(p);
    const wantsLeft = /\bleft\b/.test(p);
    const wantsRight = /\bright\b/.test(p);
    const wantsCenter = /\bcenter(ed)?\b/.test(p);

    let changed = false;
    if (wantsBigger) {
      const cur = /\bwidth\s*=\s*"(\d{1,3})%"\b/i.exec(attrsInner)?.[1];
      const curPct = cur ? Number(cur) : NaN;
      const nextPct = clampPercent(Number.isFinite(curPct) ? curPct + 10 : 80);
      nextAttrsInner = upsertXmdAttrInner(nextAttrsInner, 'width', `${nextPct}%`);
      changed = true;
    }
    if (wantsSmaller) {
      const cur = /\bwidth\s*=\s*"(\d{1,3})%"\b/i.exec(attrsInner)?.[1];
      const curPct = cur ? Number(cur) : NaN;
      const nextPct = clampPercent(Number.isFinite(curPct) ? curPct - 10 : 40);
      nextAttrsInner = upsertXmdAttrInner(nextAttrsInner, 'width', `${nextPct}%`);
      changed = true;
    }
    if (wantsInline) {
      nextAttrsInner = upsertXmdAttrInner(nextAttrsInner, 'placement', 'inline');
      changed = true;
    }
    if (wantsBlock) {
      nextAttrsInner = upsertXmdAttrInner(nextAttrsInner, 'placement', 'block');
      changed = true;
    }
    if (wantsLeft) {
      nextAttrsInner = upsertXmdAttrInner(nextAttrsInner, 'align', 'left');
      changed = true;
    }
    if (wantsCenter) {
      nextAttrsInner = upsertXmdAttrInner(nextAttrsInner, 'align', 'center');
      changed = true;
    }
    if (wantsRight) {
      nextAttrsInner = upsertXmdAttrInner(nextAttrsInner, 'align', 'right');
      changed = true;
    }

    if (!changed) return null;

    const trimmed = nextAttrsInner.trim();
    const attrBlock = trimmed.length > 0 ? `{${trimmed}}` : '';
    const replacement = `![${caption}](${src})${attrBlock}`;
    return { replacement, reason: 'Applied a safe component attribute update.' };
  }

  if (input.kind === 'grid') {
    // Deterministically update header attrs only.
    const lines = original.split('\n');
    const headerIdx = lines.findIndex((l) => l.trim().startsWith(':::'));
    if (headerIdx < 0) return null;
    const header = lines[headerIdx] ?? '';
    const attrs = header.replace(/^:::\s*/, '').trim();

    const setAttr = (key: string, value: string) => {
      const re = new RegExp(`\\b${key}\\s*=\\s*(?:"[^"]*"|\\d+)`, 'i');
      if (re.test(attrs)) {
        return attrs.replace(re, `${key}=${value}`);
      }
      return `${attrs} ${key}=${value}`.trim();
    };

    let nextAttrs = attrs;
    let changed = false;

    const colsMatch = /\b(?:cols|columns)\s*(?:=|:)?\s*(\d{1,2})\b/.exec(p);
    if (colsMatch) {
      nextAttrs = setAttr('cols', String(Number(colsMatch[1])));
      changed = true;
    }
    if (/\bleft\b/.test(p)) {
      nextAttrs = setAttr('align', '"left"');
      changed = true;
    }
    if (/\bcenter(ed)?\b/.test(p)) {
      nextAttrs = setAttr('align', '"center"');
      changed = true;
    }
    if (/\bright\b/.test(p)) {
      nextAttrs = setAttr('align', '"right"');
      changed = true;
    }
    if (/\binline\b/.test(p)) {
      nextAttrs = setAttr('placement', '"inline"');
      changed = true;
    }
    if (/\bblock\b/.test(p)) {
      nextAttrs = setAttr('placement', '"block"');
      changed = true;
    }
    const marginMatch = /\bmargin\s*(?:=|:)?\s*(small|medium|large)\b/.exec(p);
    if (marginMatch) {
      nextAttrs = setAttr('margin', `"${marginMatch[1]}"`);
      changed = true;
    }

    if (!changed) return null;
    lines[headerIdx] = `::: ${nextAttrs}`.trimEnd();
    return { replacement: lines.join('\n'), reason: 'Applied a safe grid header update.' };
  }

  return null;
}

export function buildComponentEditPrompt(input: { kind: ComponentAIKind; editMode: 'markdown' | 'latex'; original: string; userPrompt: string }): string {
  const user = String(input.userPrompt ?? '').trim();
  if (input.editMode === 'latex') {
    return [
      'You are editing a LaTeX component in-place.',
      'Return ONLY the updated LaTeX for this component (no commentary).',
      'Do not change anything outside the component.',
      '',
      `User request: ${user}`,
    ].join('\n');
  }

  if (input.kind === 'figure') {
    return [
      'You are editing a single XMD/Markdown figure line.',
      'Return ONLY the updated figure line (single line, no newlines, no commentary).',
      'Keep the image src unchanged; only adjust caption and/or {attrs}.',
      'Preserve any existing attribute tokens/IDs (e.g. "#fig:...") unless the user explicitly asks to change/remove them.',
      'Valid shape: ![caption](src){key="value" ...}',
      '',
      `User request: ${user}`,
    ].join('\n');
  }

  return [
    'You are editing an XMD grid block.',
    'Return ONLY the updated grid block (no commentary).',
    'Keep the ::: opening/closing fences intact.',
    'Prefer editing only the grid header attrs (cols, caption, align, placement, margin) unless asked otherwise.',
    '',
    `User request: ${user}`,
  ].join('\n');
}

function escapeHeaderCaption(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .trim();
}

export function updateGridHeaderLine(headerLine: string, updates: Partial<{ cols: number; caption: string | null; align: string; placement: string; margin: string }>): string {
  const raw = String(headerLine ?? '');
  const m = /^\s*:::\s*(.*)$/.exec(raw);
  const attrs = (m ? m[1] : raw.replace(/^:::\s*/, '')).trim();
  let next = attrs;

  const setToken = (key: string, value: string) => {
    const re = new RegExp(`\\b${key}\\s*=\\s*(?:"[^"]*"|\\d+)`, 'i');
    if (re.test(next)) next = next.replace(re, `${key}=${value}`);
    else next = `${next} ${key}=${value}`.trim();
  };

  if (updates.cols !== undefined && Number.isFinite(Number(updates.cols))) setToken('cols', String(Math.max(1, Math.round(Number(updates.cols)))));
  if (updates.caption !== undefined) {
    const cap = updates.caption === null ? '' : escapeHeaderCaption(String(updates.caption));
    if (cap.length > 0) setToken('caption', `"${cap}"`);
    else {
      // Remove caption token if present
      next = next.replace(/\bcaption\s*=\s*"[^"]*"\s*/i, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  if (updates.align) setToken('align', `"${updates.align}"`);
  if (updates.placement) setToken('placement', `"${updates.placement}"`);
  if (updates.margin) setToken('margin', `"${updates.margin}"`);

  return `::: ${next}`.trimEnd();
}

export function buildComponentEditPlanPrompt(input: {
  kind: ComponentAIKind;
  userPrompt: string;
  context: unknown;
}): string {
  const user = String(input.userPrompt ?? '').trim();
  const ctx = JSON.stringify(input.context ?? {}, null, 2);

  const schema = [
    'Return ONLY valid JSON (no markdown, no commentary).',
    'Choose exactly one of:',
    '- {"type":"clarify","question":"...","suggestions":["..."]}',
    '- {"type":"patch", ...}',
    '',
    'For figure patches:',
    '{"type":"patch","figure":{"set":{"caption":"...","attrs":{"width":"80%","align":"center","placement":"inline","desc":"..."}}}}',
    '',
    'For grid patches:',
    '{"type":"patch","grid":{"header":{"set":{"cols":3,"caption":"...","align":"center","placement":"block","margin":"small"}},"figures":{"scope":{"kind":"all"},"set":{"attrs":{"width":"80%"}}}}}',
    '',
    'Rules:',
    '- Only propose changes that apply to THIS component and elements inside it.',
    '- If the user intent is unclear, respond with type="clarify" and ask the minimum question needed.',
    '- Do NOT rewrite content outside this component; do NOT change image src values.',
  ].join('\n');

  return [
    'You are an assistant that produces a structured edit plan for an editor component.',
    `Component kind: ${input.kind}`,
    '',
    'Component context (JSON):',
    ctx,
    '',
    `User request: ${user}`,
    '',
    schema,
  ].join('\n');
}

export function validateComponentReplacement(input: { kind: ComponentAIKind; editMode: 'markdown' | 'latex'; original: string; replacement: string }): { ok: boolean; message?: string } {
  const replacement = String(input.replacement ?? '');
  const original = String(input.original ?? '');

  if (input.editMode === 'latex') {
    if (!replacement.trim()) return { ok: false, message: 'AI returned empty LaTeX.' };
    return { ok: true };
  }

  if (input.kind === 'figure') {
    if (replacement.includes('\n')) return { ok: false, message: 'Figure edits must stay on a single line.' };
    const srcRe = /!\[[^\]]*\]\(([^)\s]+)\)/;
    const o = srcRe.exec(original);
    const n = srcRe.exec(replacement);
    if (!n) return { ok: false, message: 'That output is not a valid figure line.' };
    if (o && n && o[1] !== n[1]) return { ok: false, message: 'For safety, changing the image src isn’t supported here yet.' };
    // Preserve figure IDs if present (common XMD pattern).
    const origHasId = /\{[^}]*#fig:[^}\s]+[^}]*\}/i.test(original);
    const nextHasId = /\{[^}]*#fig:[^}\s]+[^}]*\}/i.test(replacement);
    if (origHasId && !nextHasId) {
      return { ok: false, message: 'That edit removed the figure ID (e.g. "#fig:..."), which isn’t allowed here.' };
    }
    return { ok: true };
  }

  const hasOpen = /^\s*:::\s+/m.test(replacement);
  const hasClose = /^(?:\s*:::\s*)$/m.test(replacement) || /:::\s*$/.test(replacement.trimEnd());
  if (!hasOpen || !hasClose) {
    return { ok: false, message: 'That output doesn’t look like a valid fenced XMD block.' };
  }
  // Don’t allow completely empty blocks.
  if (replacement.trim().length < 6) return { ok: false, message: 'AI returned an empty component.' };

  if (input.kind === 'table') {
    // Table blocks must NOT be grids (no cols=) and should have a valid colSpec line.
    const hasCols = /^\s*:::\s+.*\bcols\s*=\s*\d+/im.test(replacement);
    if (hasCols) return { ok: false, message: 'That output looks like a grid (cols=...), not a table.' };
    // Find first non-empty line after the opening header line.
    const lines = replacement.split('\n');
    const headerIdx = lines.findIndex((l) => l.trim().startsWith(':::'));
    const body = headerIdx >= 0 ? lines.slice(headerIdx + 1) : lines;
    const firstNonEmpty = body.find((l) => String(l ?? '').trim().length > 0) ?? '';
    const colSpec = String(firstNonEmpty ?? '').trim();
    if (!/^\|[|LCRlcr]+\|\s*$/.test(colSpec) || !/[LCRlcr]/.test(colSpec)) {
      return { ok: false, message: 'That output doesn’t look like a valid XMD table block (missing/invalid colSpec).' };
    }
    return { ok: true };
  }

  // grid
  const hasCols = /^\s*:::\s+.*\bcols\s*=\s*\d+/im.test(replacement);
  if (!hasCols) {
    return { ok: false, message: 'That output doesn’t look like a valid XMD grid block.' };
  }

  // Structural safety: preserve the same images (src) and preserve any existing figure IDs.
  const figRe = /!\[([^\]]*)\]\(([^)\s]+)\)\s*(\{[^}]*\})?/g;
  const extract = (txt: string) => {
    const out: Array<{ src: string; hasFigId: boolean }> = [];
    let m: RegExpExecArray | null;
    while ((m = figRe.exec(txt))) {
      const src = String(m[2] ?? '').trim();
      const attrsRaw = String(m[3] ?? '').trim();
      const hasFigId = /\{[^}]*#fig:[^}\s]+[^}]*\}/i.test(attrsRaw);
      out.push({ src, hasFigId });
    }
    return out;
  };

  const o = extract(original);
  const n = extract(replacement);
  if (o.length === 0) return { ok: false, message: 'This grid has no images to edit.' };
  if (n.length > o.length) {
    return { ok: false, message: 'For safety, adding new images to a grid isn’t supported here yet.' };
  }
  // Allow removals, but disallow reordering or changing src:
  // the new list must be a subsequence of the original list.
  let oi = 0;
  for (let ni = 0; ni < n.length; ni++) {
    const targetSrc = n[ni]!.src;
    let matched: { src: string; hasFigId: boolean } | null = null;
    while (oi < o.length) {
      const cur = o[oi]!;
      oi++;
      if (cur.src === targetSrc) {
        matched = cur;
        break;
      }
    }
    if (!matched) {
      return {
        ok: false,
        message: 'For safety, changing image src or reordering/adding images isn’t supported here yet.',
      };
    }
    if (matched.hasFigId && !n[ni]!.hasFigId) {
      return { ok: false, message: 'That edit removed a figure ID (e.g. "#fig:..."), which isn’t allowed here.' };
    }
  }

  return { ok: true };
}


