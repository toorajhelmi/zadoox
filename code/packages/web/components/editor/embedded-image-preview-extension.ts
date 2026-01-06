import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, WidgetType, EditorView } from '@codemirror/view';
import { api } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';
import { createAiIconEl } from '@/components/icons';
import { finalizeComponentModelUpdate } from './component-ai-pipeline';
import {
  buildComponentContext,
  buildComponentCapabilities,
  buildClarifySuggestions,
  type ComponentEditResult,
} from './component-ai-adapters/index';
import type { EmbeddedComponentKind } from './component-ai-adapters/types';

function makeToolbarSeparator(): HTMLDivElement {
  const sep = document.createElement('div');
  sep.style.width = '1px';
  sep.style.height = '18px';
  sep.style.background = 'rgba(255,255,255,0.12)';
  sep.style.margin = '0 2px';
  return sep;
}

function makeInlineComponentChatArea(params: {
  kind: EmbeddedComponentKind;
  ariaLabel: string;
  placeholder: string;
  rows?: number;
  widthPx?: number;
  minWidthPx?: number;
  maxWidthPx?: number;
  heightPx?: number;
  onPinChange?: (pinned: boolean) => void;
  onClose?: () => void;
  getOriginal: () => { from: number; to: number; text: string };
  applyReplacement: (replacement: string) => void;
}): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '6px';
  wrap.style.width = '100%';
  wrap.style.maxWidth = '100%';

  // Inject a tiny progress animation once (for the inline AI progress bar).
  if (typeof document !== 'undefined' && !document.getElementById('zadoox-ai-progress-style')) {
    const st = document.createElement('style');
    st.id = 'zadoox-ai-progress-style';
    st.textContent =
      '@keyframes zadooxAiIndeterminate{0%{transform:translateX(-60%);}100%{transform:translateX(140%);}}';
    document.head.appendChild(st);
  }

  const topRow = document.createElement('div');
  topRow.style.display = 'flex';
  // Keep controls vertically aligned even as the textarea auto-grows.
  topRow.style.alignItems = 'center';
  topRow.style.gap = '6px';
  topRow.style.width = '100%';
  topRow.style.maxWidth = '100%';

  const aiIcon = createAiIconEl({ title: 'AI', sizePx: 28 });

  const prompt = document.createElement('textarea');
  prompt.placeholder = params.placeholder;
  prompt.setAttribute('aria-label', params.ariaLabel);
  prompt.rows = params.rows ?? 2;
  const widthPx = params.widthPx ?? 360;
  const minWidthPx = params.minWidthPx ?? 220;
  const maxWidthPx = params.maxWidthPx ?? 520;
  const heightPx = params.heightPx ?? 44;
  // Allow callers to request fixed sizing, but keep the control well-behaved inside narrow toolbars.
  prompt.style.width = `${widthPx}px`;
  prompt.style.maxWidth = `${maxWidthPx}px`;
  prompt.style.minWidth = `${minWidthPx}px`;
  // If the parent is narrower, let it shrink instead of overflowing.
  (prompt.style as unknown as { minWidth?: string }).minWidth = '0px';
  prompt.style.flex = '1';
  prompt.style.width = 'auto';
  prompt.style.maxWidth = '100%';
  prompt.style.height = `${heightPx}px`;
  // No manual resize; it will auto-grow with wrapped lines.
  prompt.style.resize = 'none';
  prompt.style.overflowY = 'hidden';
  prompt.style.background = '#0b0b0c';
  prompt.style.color = '#e5e7eb';
  prompt.style.border = '1px solid rgba(255,255,255,0.12)';
  prompt.style.borderRadius = '6px';
  prompt.style.padding = '6px 8px';
  prompt.style.fontSize = '12px';
  prompt.style.lineHeight = '1.2';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Send prompt');
  btn.title = 'Send (Ctrl/Cmd+Enter)';
  btn.className =
    'w-7 h-7 flex items-center justify-center rounded border border-vscode-border transition-colors ' +
    'bg-transparent text-vscode-text-secondary hover:text-vscode-text hover:bg-vscode-buttonHoverBg';
  btn.disabled = true;
  btn.style.opacity = '0.45';
  btn.style.cursor = 'not-allowed';
  btn.style.flexShrink = '0';
  btn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M2.5 8L14 2.5 10.5 14 8.4 9.6 2.5 8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
    '</svg>';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close prompt');
  closeBtn.title = 'Close';
  closeBtn.className =
    'w-7 h-7 flex items-center justify-center rounded border border-vscode-border transition-colors ' +
    'bg-transparent text-vscode-text-secondary hover:text-vscode-text hover:bg-vscode-buttonHoverBg';
  closeBtn.style.flexShrink = '0';
  closeBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M4 4l8 8M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>';

  const chatWrap = document.createElement('div');
  chatWrap.style.display = 'none';
  chatWrap.style.borderTop = '1px solid rgba(255,255,255,0.08)';
  chatWrap.style.paddingTop = '6px';

  const progressBar = document.createElement('div');
  progressBar.style.display = 'none';
  progressBar.style.height = '2px';
  progressBar.style.borderRadius = '999px';
  progressBar.style.background = 'rgba(59,130,246,0.18)';
  progressBar.style.overflow = 'hidden';
  const progressInner = document.createElement('div');
  progressInner.style.height = '100%';
  progressInner.style.width = '40%';
  progressInner.style.background = 'rgba(59,130,246,0.85)';
  progressInner.style.borderRadius = '999px';
  progressInner.style.animation = 'zadooxAiIndeterminate 1.0s linear infinite';
  progressBar.appendChild(progressInner);

  const messagesEl = document.createElement('div');
  messagesEl.style.maxHeight = '140px';
  messagesEl.style.overflow = 'auto';
  messagesEl.style.display = 'flex';
  messagesEl.style.flexDirection = 'column';
  messagesEl.style.gap = '6px';

  const suggestionsEl = document.createElement('div');
  suggestionsEl.style.display = 'none';
  suggestionsEl.style.flexWrap = 'wrap';
  suggestionsEl.style.gap = '6px';
  suggestionsEl.style.marginTop = '6px';

  const previewLabel = document.createElement('div');
  previewLabel.textContent = 'Preview';
  previewLabel.style.fontSize = '11px';
  previewLabel.style.color = '#9aa0a6';
  previewLabel.style.marginTop = '8px';
  previewLabel.style.display = 'none';

  const previewEl = document.createElement('pre');
  previewEl.style.display = 'none';
  previewEl.style.whiteSpace = 'pre-wrap';
  previewEl.style.fontSize = '11px';
  previewEl.style.lineHeight = '1.35';
  previewEl.style.background = 'rgba(0,0,0,0.25)';
  previewEl.style.border = '1px solid rgba(255,255,255,0.10)';
  previewEl.style.borderRadius = '8px';
  previewEl.style.padding = '8px';
  previewEl.style.maxHeight = '120px';
  previewEl.style.overflow = 'auto';
  previewEl.style.color = '#e5e7eb';

  const actionsRow = document.createElement('div');
  actionsRow.style.display = 'none';
  actionsRow.style.gap = '8px';
  actionsRow.style.marginTop = '8px';

  const btnApply = document.createElement('button');
  btnApply.type = 'button';
  btnApply.textContent = 'Apply';
  btnApply.className =
    'px-2 py-1 text-xs rounded border border-transparent bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  btnApply.disabled = true;

  const btnDiscard = document.createElement('button');
  btnDiscard.type = 'button';
  btnDiscard.textContent = 'Discard';
  btnDiscard.className =
    'px-2 py-1 text-xs rounded border border-vscode-border bg-vscode-buttonBg text-vscode-text hover:bg-vscode-buttonHoverBg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  btnDiscard.disabled = true;

  actionsRow.appendChild(btnApply);
  actionsRow.appendChild(btnDiscard);

  chatWrap.appendChild(messagesEl);
  chatWrap.appendChild(suggestionsEl);
  chatWrap.appendChild(previewLabel);
  chatWrap.appendChild(previewEl);
  chatWrap.appendChild(actionsRow);

  topRow.appendChild(aiIcon);
  topRow.appendChild(prompt);
  topRow.appendChild(btn);
  topRow.appendChild(closeBtn);

  wrap.appendChild(progressBar);
  wrap.appendChild(topRow);
  wrap.appendChild(chatWrap);

  let busy = false;
  let pendingReplacement: string | null = null;
  let lastSuggestions: string[] = [];
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  const setPinned = () => {
    const hasText = prompt.value.trim().length > 0;
    const focused = document.activeElement === prompt;
    const hasChat = messages.length > 0 || Boolean(pendingReplacement);
    params.onPinChange?.(hasText || focused || hasChat);
  };

  const renderMessages = () => {
    messagesEl.innerHTML = '';
    for (const m of messages) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = m.role === 'user' ? 'flex-end' : 'flex-start';
      const bubble = document.createElement('div');
      bubble.textContent = m.content;
      bubble.style.maxWidth = '90%';
      bubble.style.padding = '6px 8px';
      bubble.style.borderRadius = '10px';
      bubble.style.border = '1px solid rgba(255,255,255,0.10)';
      bubble.style.background = m.role === 'user' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.20)';
      bubble.style.color = '#e5e7eb';
      bubble.style.fontSize = '12px';
      bubble.style.whiteSpace = 'pre-wrap';
      row.appendChild(bubble);
      messagesEl.appendChild(row);
    }
    if (messages.length > 0) {
      chatWrap.style.display = 'block';
      // Scroll to bottom on new messages
      requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }
  };

  const renderSuggestions = (suggestions: string[]) => {
    lastSuggestions = suggestions;
    suggestionsEl.innerHTML = '';
    if (!suggestions || suggestions.length === 0) {
      suggestionsEl.style.display = 'none';
      return;
    }
    suggestionsEl.style.display = 'flex';
    for (const s of suggestions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s;
      b.className = 'px-2 py-1 text-xs rounded border border-vscode-border bg-vscode-buttonBg text-vscode-text hover:bg-vscode-buttonHoverBg transition-colors';
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;
        prompt.value = s;
        syncButtonState();
        setPinned();
        autoGrowPrompt();
        prompt.focus();
      });
      suggestionsEl.appendChild(b);
    }
  };

  const renderPreview = (replacement: string | null) => {
    pendingReplacement = replacement;
    if (!replacement) {
      previewLabel.style.display = 'none';
      previewEl.style.display = 'none';
      actionsRow.style.display = 'none';
      btnApply.disabled = true;
      btnDiscard.disabled = true;
      previewEl.textContent = '';
      return;
    }
    previewLabel.style.display = 'block';
    previewEl.style.display = 'block';
    actionsRow.style.display = 'flex';
    btnApply.disabled = false;
    btnDiscard.disabled = false;
    previewEl.textContent = replacement;
  };

  const syncButtonState = () => {
    const ok = !busy && prompt.value.trim().length > 0;
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.45';
    btn.style.cursor = ok ? 'pointer' : 'not-allowed';
  };

  const setBusy = (v: boolean) => {
    busy = v;
    syncButtonState();
    btnApply.disabled = v || !pendingReplacement;
    btnDiscard.disabled = v || !pendingReplacement;
    prompt.style.opacity = v ? '0.8' : '1';
    prompt.disabled = v;
    progressBar.style.display = v ? 'block' : 'none';
  };

  const autoGrowPrompt = () => {
    // Basic autosize: grow until a max, then allow scrolling.
    const maxH = 120;
    prompt.style.height = '0px';
    const next = Math.min(prompt.scrollHeight || heightPx, maxH);
    prompt.style.height = `${Math.max(heightPx, next)}px`;
    prompt.style.overflowY = (prompt.scrollHeight || 0) > maxH ? 'auto' : 'hidden';
  };

  const clearAll = () => {
    prompt.value = '';
    messages.length = 0;
    lastSuggestions = [];
    renderMessages();
    renderSuggestions([]);
    renderPreview(null);
    chatWrap.style.display = 'none';
    setBusy(false);
    syncButtonState();
    setPinned();
    autoGrowPrompt();
  };

  const appendMsg = (role: 'user' | 'assistant', content: string) => {
    messages.push({ role, content });
    renderMessages();
    setPinned();
  };

  const handleSend = async () => {
    const userPrompt = prompt.value.trim();
    if (!userPrompt || busy) return;
    renderSuggestions([]);
    renderPreview(null);
    appendMsg('user', userPrompt);
    prompt.value = '';
    syncButtonState();
    setPinned();

    setBusy(true);
    try {
      const { text: original } = params.getOriginal();

      const context = buildComponentContext({
        kind: params.kind,
        original,
        conversation: messages.slice(-8),
      });

      const capabilities = buildComponentCapabilities(params.kind);
      const res = (await api.ai.component.edit({
        kind: params.kind,
        prompt: userPrompt,
        source: original,
        capabilities,
        context,
        model: 'auto',
      })) as unknown as ComponentEditResult;

      if (!res || typeof res !== 'object' || (res as any).type !== 'clarify' && (res as any).type !== 'update') {
        console.warn('Component edit: invalid response payload', { res });
        appendMsg('assistant', 'I couldn’t get a valid response. Try again.');
        return;
      }

      if (res.type === 'clarify') {
        appendMsg('assistant', res.question || 'Can you clarify?');
        // Suggestions must come from capabilities (adapter/IR-defined), not free-form model output.
        renderSuggestions(buildClarifySuggestions(params.kind, capabilities));
        return;
      }

      const finalized = finalizeComponentModelUpdate({
        kind: params.kind,
        editMode: 'markdown',
        original,
        updatedXmdRaw: String(res.updatedXmd || ''),
      });
      if (!finalized.ok) {
        appendMsg('assistant', finalized.message);
        renderSuggestions(finalized.suggestions);
        return;
      }
      const replacement = finalized.replacement;

      renderPreview(replacement);
      appendMsg('assistant', finalized.summary || res.summary || 'Here’s a preview of the change I’m proposing.');
      appendMsg('assistant', res.confirmationQuestion || 'If it looks right, click Apply to confirm.');
    } catch (err) {
      appendMsg('assistant', 'Sorry — something went wrong generating that edit.');
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  // Keep key events inside the widget (avoid CodeMirror shortcuts).
  prompt.addEventListener('keydown', (e) => {
    e.stopPropagation();
    // Ctrl/Cmd+Enter sends, Enter inserts newline.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSend();
    }
  });
  prompt.addEventListener('input', () => {
    syncButtonState();
    setPinned();
    autoGrowPrompt();
  });
  prompt.addEventListener('focus', () => setPinned());
  prompt.addEventListener('blur', () => setPinned());

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void handleSend();
  });

  closeBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearAll();
    params.onClose?.();
  });

  btnApply.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  btnApply.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!pendingReplacement) return;
    params.applyReplacement(pendingReplacement);
    // Conclude chat: close/clear
    clearAll();
    params.onClose?.();
  });

  btnDiscard.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  btnDiscard.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    renderPreview(null);
    appendMsg('assistant', 'Okay — discarded. Tell me what you’d like instead.');
  });

  // Initial state
  syncButtonState();
  setPinned();
  return wrap;
}

type RenderToggleRange = { from: number; to: number };
const toggleRenderForRange = StateEffect.define<RenderToggleRange>();

function overlaps(a: RenderToggleRange, b: RenderToggleRange): boolean {
  return a.from < b.to && b.from < a.to;
}

const disabledRenderRangesField = StateField.define<RenderToggleRange[]>({
  create() {
    return [];
  },
  update(value, tr) {
    let next = value;

    if (tr.docChanged && next.length > 0) {
      // Map ranges across document edits.
      next = next
        .map((r) => {
          const from = tr.changes.mapPos(r.from, 1);
          const to = tr.changes.mapPos(r.to, -1);
          return { from: Math.min(from, to), to: Math.max(from, to) };
        })
        .filter((r) => r.to > r.from);
    }

    for (const e of tr.effects) {
      if (e.is(toggleRenderForRange)) {
        const raw = e.value;
        const range = { from: Math.min(raw.from, raw.to), to: Math.max(raw.from, raw.to) };
        const idx = next.findIndex((r) => r.from === range.from && r.to === range.to);
        if (idx >= 0) {
          next = [...next.slice(0, idx), ...next.slice(idx + 1)];
        } else {
          next = [...next, range];
        }
      }
    }

    return next;
  },
});

type GridBlock = {
  from: number;
  to: number;
  cols: number;
  caption: string | null;
  align: 'left' | 'center' | 'right' | null;
  placement: 'block' | 'inline' | null;
  margin: 'small' | 'medium' | 'large' | null;
};

type TableBlock = { from: number; to: number; header: string[]; rows: string[][] };

function parseAttrValue(attrs: string, key: string): string | null {
  const re = new RegExp(`${key}="([^"]*)"`);
  const m = re.exec(attrs);
  return m ? m[1] : null;
}

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
}

function stripAttrKeys(attrs: string, keys: string[]): string {
  let out = attrs;
  for (const k of keys) {
    out = out.replace(new RegExp(`\\s*${k}="[^"]*"`, 'g'), '');
  }
  return out.replace(/\s+/g, ' ').trim();
}

function upsertAttr(attrs: string, key: string, value: string | null): string {
  const cleaned = stripAttrKeys(attrs, [key]);
  if (!value || value.trim().length === 0) return cleaned;
  return `${cleaned} ${key}="${escapeAttrValue(value)}"`.trim();
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parsePercentWidth(width: string | null): number | null {
  if (!width) return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(width);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

function formatPercentWidth(pct: number): string {
  // Keep it simple and stable for diffs/widgets.
  return `${Math.round(pct)}%`;
}

class FigureCardWidget extends WidgetType {
  constructor(
    // Raw markdown URL (e.g. data:... or zadoox-asset://<key>)
    private readonly rawUrl: string,
    // Display URL for <img src> (e.g. /api/assets/<key>)
    private readonly displaySrc: string,
    private readonly alt: string
    ,
    private readonly desc: string | null,
    private readonly attrs: string | null,
    private readonly from: number,
    private readonly to: number,
    private readonly opts?: { hidePlacement?: boolean; hideAlign?: boolean; inGrid?: boolean }
  ) {
    super();
  }

  eq(other: FigureCardWidget): boolean {
    return (
      this.rawUrl === other.rawUrl &&
      this.displaySrc === other.displaySrc &&
      this.alt === other.alt &&
      this.desc === other.desc &&
      this.attrs === other.attrs &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  ignoreEvent(): boolean {
    // IMPORTANT: This widget contains interactive controls (buttons/inputs).
    // Let the DOM handle events; prevent CodeMirror from trying to map click targets
    // inside this replaced widget back to document positions (can crash in some cases).
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-embedded-figure-card';
    wrap.style.position = 'relative';
    wrap.style.pointerEvents = 'auto';
    wrap.style.margin = '8px 0';
    wrap.style.padding = '8px';
    wrap.style.border = '1px solid rgba(255,255,255,0.08)';
    wrap.style.borderRadius = '8px';
    wrap.style.background = 'rgba(0,0,0,0.12)';

    const baseAttrs = (this.attrs || '').trim();
    const align = baseAttrs ? parseAttrValue(baseAttrs, 'align') : null; // left|center|right
    const width = baseAttrs ? parseAttrValue(baseAttrs, 'width') : null; // e.g. 50% or 320px
    const placement = baseAttrs ? parseAttrValue(baseAttrs, 'placement') : null; // inline|block

    // Keep the editor stable: we don't do true text-wrapping inline layout inside CodeMirror.
    // But we *do*:
    // - respect the configured width so the figure matches preview sizing
    // - show a visual hint that this figure will be inline/wrapped in preview
    if (placement === 'inline') {
      if (width) {
        wrap.style.width = width;
        wrap.style.maxWidth = width;
      }
      wrap.style.outline = '1px dashed rgba(120, 170, 255, 0.55)';
      wrap.style.outlineOffset = '3px';

      // Align the whole card within the editor (best-effort).
      // We don't do true inline wrapping inside CodeMirror, but alignment should still match preview intent.
      // NOTE: margin-left:auto does not right-align reliably for inline widgets. Use float for right/left.
      wrap.style.display = 'inline-block';
      if (align === 'right') {
        wrap.style.float = 'right';
        wrap.style.margin = '8px 0 8px 12px';
      } else if (align === 'center') {
        // "Center + inline" is ambiguous; keep it visually centered within a full line.
        wrap.style.display = 'block';
        // Shrink to content so margin:auto can actually center it (block default width is 100%).
        if (!width) {
          (wrap.style as unknown as { width?: string }).width = 'fit-content';
          wrap.style.maxWidth = '100%';
        }
        wrap.style.float = 'none';
        wrap.style.marginLeft = 'auto';
        wrap.style.marginRight = 'auto';
      } else {
        // Default/left
        wrap.style.float = 'left';
        wrap.style.margin = '8px 12px 8px 0';
      }
    } else {
      // Block placement: the card should occupy the full editor width (prevents caret showing beside it).
      wrap.style.width = '100%';
      wrap.style.maxWidth = '100%';
      // Align the figure content (inner wrapper) within the full-width card.
      // This ensures align changes are visible even when width is not explicitly set.
      wrap.style.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
    }

    const img = document.createElement('img');
    img.src = this.displaySrc || '';
    img.alt = this.alt || '';
    img.style.display = 'block';
    // Default: allow the image to size naturally but never overflow the container.
    img.style.maxWidth = '100%';
    // Allow scaling; don't clamp to a small fixed height (S/M/L should actually scale).
    img.style.maxHeight = '60vh';
    // Sizing:
    // - inline: wrapper width drives image width (fill)
    // - block: wrapper is full width; width constrains the image (max-width) inside it
    if (placement === 'inline' && width) {
      img.style.width = '100%';
    } else {
      if (width) {
        img.style.maxWidth = width;
      }
      img.style.width = 'auto';
    }
    img.style.height = 'auto';
    img.style.borderRadius = '6px';
    img.style.border = '1px solid rgba(255,255,255,0.10)';
    if (align === 'center') img.style.margin = '0 auto';
    if (align === 'right') img.style.marginLeft = 'auto';
    if (align === 'left') img.style.marginRight = 'auto';
    wrap.appendChild(img);

    // If this is an asset reference, fetch it with Authorization and convert to a blob URL.
    // This avoids relying on cookie-based auth for <img src>.
    if (this.rawUrl.startsWith('zadoox-asset://')) {
      const key = this.rawUrl.slice('zadoox-asset://'.length);
      if (key) {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
        const supabase = createClient();
        // Prevent duplicate loads if CodeMirror reuses DOM nodes.
        (img as unknown as { __assetLoading?: boolean }).__assetLoading = true;
        void (async () => {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;
            const res = await fetch(`${API_BASE}/assets/${encodeURIComponent(key)}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            (img as unknown as { __assetBlobUrl?: string }).__assetBlobUrl = url;
            img.src = url;
          } catch {
            // ignore
          } finally {
            (img as unknown as { __assetLoading?: boolean }).__assetLoading = false;
          }
        })();
      }
    }

    if (placement === 'inline') {
      // Inline-wrap hint: subtle side fades indicating text will flow around the figure in preview.
      const leftHint = document.createElement('div');
      leftHint.style.position = 'absolute';
      leftHint.style.left = '-10px';
      leftHint.style.top = '0';
      leftHint.style.bottom = '0';
      leftHint.style.width = '10px';
      leftHint.style.borderRadius = '8px 0 0 8px';
      leftHint.style.background =
        'linear-gradient(to left, rgba(120,170,255,0.18), rgba(120,170,255,0.00))';

      const rightHint = document.createElement('div');
      rightHint.style.position = 'absolute';
      rightHint.style.right = '-10px';
      rightHint.style.top = '0';
      rightHint.style.bottom = '0';
      rightHint.style.width = '10px';
      rightHint.style.borderRadius = '0 8px 8px 0';
      rightHint.style.background =
        'linear-gradient(to right, rgba(120,170,255,0.18), rgba(120,170,255,0.00))';

      wrap.appendChild(leftHint);
      wrap.appendChild(rightHint);
    }

    // Inner wrapper so caption width follows the image width (even when no explicit width attr exists).
    // This prevents "caption centered across full page" when image is smaller than the editor width.
    const inner = document.createElement('div');
    if (placement === 'inline') {
      // Inline figures: keep caption width <= image width.
      // Use shrink-to-fit inner wrapper; only fill the wrapper when an explicit width is set.
      inner.style.display = 'inline-block';
      inner.style.maxWidth = '100%';
      if (width) inner.style.width = '100%';
    } else {
      inner.style.display = 'inline-block';
      inner.style.maxWidth = '100%';
      if (width) inner.style.width = width;
      // Alignment is handled by wrap.style.textAlign in block mode.
    }

    // Block + width: do NOT force width=100% on the image (it can conflict with maxHeight and squash aspect ratio).
    // Instead, let the image size naturally within the constrained inner wrapper.
    if (placement !== 'inline' && width) {
      img.style.width = 'auto';
      img.style.maxWidth = '100%';
    }

    const captionText = (this.alt || '').trim();
    const caption = captionText ? document.createElement('div') : null;
    if (caption) {
      caption.textContent = captionText;
      caption.style.marginTop = '6px';
      caption.style.fontSize = '12px';
      caption.style.color = '#9aa0a6';
      caption.style.fontStyle = 'italic';
      // Product rule: caption text centered relative to the image width (via inner wrapper)
      caption.style.textAlign = 'center';
      caption.style.display = 'block';
      caption.style.width = '100%';
      // Ensure long captions wrap within the figure width (never overflow wider than the image).
      caption.style.whiteSpace = 'normal';
      (caption.style as unknown as { overflowWrap?: string }).overflowWrap = 'anywhere';
      caption.style.wordBreak = 'break-word';
    }

    inner.appendChild(img);
    if (caption) {
      const clampCaption = () => {
        try {
          const w = img.getBoundingClientRect().width;
          if (!Number.isFinite(w) || w <= 0) return;
          caption.style.maxWidth = `${w}px`;
          caption.style.marginLeft = 'auto';
          caption.style.marginRight = 'auto';
        } catch {
          // ignore
        }
      };
      if (img.complete) {
        clampCaption();
      } else {
        img.addEventListener('load', clampCaption, { once: true });
      }
      inner.appendChild(caption);
    }
    wrap.appendChild(inner);

    // Hover toolbar (quick controls)
    const hoverBar = document.createElement('div');
    hoverBar.className = 'cm-embedded-figure-toolbar';
    hoverBar.style.position = 'absolute';
    hoverBar.style.top = '8px';
    hoverBar.style.right = '8px';
    hoverBar.style.display = 'flex';
    hoverBar.style.gap = '6px';
    hoverBar.style.padding = '6px';
    hoverBar.style.borderRadius = '8px';
    hoverBar.style.border = '1px solid rgba(255,255,255,0.10)';
    hoverBar.style.background = 'rgba(20,20,22,0.9)';
    hoverBar.style.backdropFilter = 'blur(6px)';
    hoverBar.style.zIndex = '20';
    hoverBar.style.alignItems = 'center';
    // Linear toolbar that wraps only if it becomes too wide.
    hoverBar.style.flexWrap = 'wrap';
    hoverBar.style.justifyContent = 'flex-end';
    hoverBar.style.fontSize = '11px';
    hoverBar.style.color = '#cfcfcf';
    hoverBar.style.flexDirection = 'row';
    // Use opacity instead of visibility for reliability inside nested widgets/grids.
    hoverBar.style.opacity = '0';
    hoverBar.style.pointerEvents = 'none';
    hoverBar.style.transition = 'opacity 120ms ease';

    // Inside grid cells, the parent container uses overflow:hidden, so the default fixed-width hover bar
    // can be clipped. Keep it within the card bounds.
    if (this.opts?.inGrid) {
      hoverBar.style.left = '6px';
      hoverBar.style.right = '6px';
      hoverBar.style.width = 'auto';
      hoverBar.style.maxWidth = 'calc(100% - 12px)';
    } else {
      hoverBar.style.maxWidth = '560px';
    }

    const makeIconBtn = (opts: { label: string; svg: string; selected?: boolean }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', opts.label);
      b.title = opts.label;
      const selected = Boolean(opts.selected);
      b.className =
        'w-7 h-7 flex items-center justify-center rounded border border-vscode-border transition-colors ' +
        (selected
          ? 'bg-vscode-active text-vscode-text'
          : 'bg-transparent text-vscode-text-secondary hover:text-vscode-text hover:bg-vscode-buttonHoverBg');
      const span = document.createElement('span');
      span.innerHTML = opts.svg;
      b.appendChild(span);
      return b;
    };

    // No row helper: we build one linear toolbar with separators.

    const applyAttrUpdate = (updates: { align?: string | null; width?: string | null; placement?: string | null; desc?: string | null; caption?: string | null; src?: string | null }) => {
      const currentCaption = (updates.caption ?? this.alt ?? '').trim();
      const currentDesc = updates.desc ?? this.desc ?? '';
      const currentSrc = updates.src ?? this.rawUrl;
      const cleaned = stripAttrKeys(baseAttrs, ['align', 'width', 'placement', 'desc']);
      let nextAttrs = cleaned;
      if (updates.align !== undefined) nextAttrs = upsertAttr(nextAttrs, 'align', updates.align);
      else if (align) nextAttrs = upsertAttr(nextAttrs, 'align', align);
      if (updates.width !== undefined) nextAttrs = upsertAttr(nextAttrs, 'width', updates.width);
      else if (width) nextAttrs = upsertAttr(nextAttrs, 'width', width);
      if (updates.placement !== undefined) nextAttrs = upsertAttr(nextAttrs, 'placement', updates.placement);
      else if (placement) nextAttrs = upsertAttr(nextAttrs, 'placement', placement);
      if (currentDesc && currentDesc.trim().length > 0) nextAttrs = upsertAttr(nextAttrs, 'desc', currentDesc);

      const attrBlock = nextAttrs.trim().length > 0 ? `{${nextAttrs.trim()}}` : '';
      const nextText = `![${currentCaption}](${currentSrc})${attrBlock}`;
      view.dispatch({ changes: { from: this.from, to: this.to, insert: nextText } });
    };

    const icon = {
      edit:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M11.5 2.5l2 2L6 12H4v-2L11.5 2.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<path d="M10.5 3.5l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      regen:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M13 3v4H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M13 7a5 5 0 1 0 1 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      trash:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M3 5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M6 5v8m4-8v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M6 3h4l1 2H5l1-2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
        '</svg>',
      alignLeft:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 3h12M2 7h8M2 11h10M2 15h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      alignCenter:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 3h12M4 7h8M3 11h10M5 15h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      alignRight:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 3h12M6 7h8M3 11h11M8 15h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      sizeS:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="5.5" y="5.5" width="5" height="5" stroke="currentColor" stroke-width="1.5" />' +
        '</svg>',
      sizeM:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="4" y="4" width="8" height="8" stroke="currentColor" stroke-width="1.5" />' +
        '</svg>',
      sizeL:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="2.5" y="2.5" width="11" height="11" stroke="currentColor" stroke-width="1.5" />' +
        '</svg>',
      inline:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="2.5" y="5" width="5" height="6" stroke="currentColor" stroke-width="1.5"/>' +
        '<rect x="8.5" y="5" width="5" height="6" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg>',
      block:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="2.5" width="10" height="4" stroke="currentColor" stroke-width="1.5"/>' +
        '<rect x="3" y="9.5" width="10" height="4" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg>',
      code:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M6 4L3 8l3 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M10 4l3 4-3 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>',
    };

    const currentPlacement = placement === 'inline' ? 'inline' : 'block';
    const currentAlign = (align ?? (currentPlacement === 'inline' ? 'left' : 'left')) as 'left' | 'center' | 'right';
    const currentPct = parsePercentWidth(width);

    // Editing controls in hover bar so they're always accessible (including inline placement).
    const btnEditIcon = makeIconBtn({ label: 'Edit', svg: icon.edit });
    const isAiGenerated = /\bgen\s*=\s*"ai"\b/i.test(baseAttrs) || /\borigin\s*=\s*"ai"\b/i.test(baseAttrs);
    const btnRegenIcon = isAiGenerated ? makeIconBtn({ label: 'Regenerate', svg: icon.regen }) : null;
    const btnTrashIcon = makeIconBtn({ label: 'Delete', svg: icon.trash });
    const btnShowXmdIcon = makeIconBtn({ label: 'Show XMD', svg: icon.code });
    btnShowXmdIcon.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: toggleRenderForRange.of({ from: this.from, to: this.to }) });
    });

    const btnLeft = makeIconBtn({ label: 'Align left', svg: icon.alignLeft, selected: currentAlign === 'left' });
    const btnCenter = makeIconBtn({ label: 'Align center', svg: icon.alignCenter, selected: currentAlign === 'center' });
    const btnRight = makeIconBtn({ label: 'Align right', svg: icon.alignRight, selected: currentAlign === 'right' });
    btnLeft.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      applyAttrUpdate({ align: 'left' });
    });
    btnCenter.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      applyAttrUpdate({ align: 'center' });
    });
    btnRight.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      applyAttrUpdate({ align: 'right' });
    });

    const btnS = makeIconBtn({ label: 'Size small (33%)', svg: icon.sizeS, selected: currentPct === 33 });
    const btnM = makeIconBtn({ label: 'Size medium (50%)', svg: icon.sizeM, selected: currentPct === 50 });
    const btnL = makeIconBtn({ label: 'Size large (100%)', svg: icon.sizeL, selected: currentPct === 100 });
    // Use pointerdown so the first interaction applies immediately (click can be eaten by focus/hover transitions).
    btnS.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); applyAttrUpdate({ width: '33%' }); });
    btnM.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); applyAttrUpdate({ width: '50%' }); });
    btnL.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); applyAttrUpdate({ width: '100%' }); });

    const iconMinus =
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M3.5 8h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
    const iconPlus =
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M8 3.5v9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M3.5 8h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';

    const btnSmaller = makeIconBtn({ label: 'Decrease size (-10%)', svg: iconMinus });
    const btnLarger = makeIconBtn({ label: 'Increase size (+10%)', svg: iconPlus });
    const stepPct = 10;
    const minPct = 10;
    const maxPct = 100;

    const stepWidth = (delta: number) => {
      const currentPct = parsePercentWidth(width) ?? 50;
      const nextPct = clamp(currentPct + delta, minPct, maxPct);
      applyAttrUpdate({ width: formatPercentWidth(nextPct) });
    };

    btnSmaller.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      stepWidth(-stepPct);
    });

    btnLarger.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      stepWidth(stepPct);
    });

    const btnInline = makeIconBtn({ label: 'Placement inline', svg: icon.inline, selected: currentPlacement === 'inline' });
    const btnBlock = makeIconBtn({ label: 'Placement block', svg: icon.block, selected: currentPlacement === 'block' });
    btnInline.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); applyAttrUpdate({ placement: 'inline' }); });
    btnBlock.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); applyAttrUpdate({ placement: 'block' }); });

    // Group: actions
    hoverBar.appendChild(btnEditIcon);
    hoverBar.appendChild(btnShowXmdIcon);
    if (btnRegenIcon) hoverBar.appendChild(btnRegenIcon);
    hoverBar.appendChild(btnTrashIcon);
    hoverBar.appendChild(makeToolbarSeparator());

    // Group: align (optional)
    if (!this.opts?.hideAlign) {
      hoverBar.appendChild(btnLeft);
      hoverBar.appendChild(btnCenter);
      hoverBar.appendChild(btnRight);
      hoverBar.appendChild(makeToolbarSeparator());
    }

    // Group: size
    hoverBar.appendChild(btnSmaller);
    hoverBar.appendChild(btnS);
    hoverBar.appendChild(btnM);
    hoverBar.appendChild(btnL);
    hoverBar.appendChild(btnLarger);

    // Group: placement (optional)
    if (!this.opts?.hidePlacement) {
      hoverBar.appendChild(makeToolbarSeparator());
      hoverBar.appendChild(btnInline);
      hoverBar.appendChild(btnBlock);
    }

    // Hover behavior is handled by CSS (see globals.css).
    // Add a JS fallback that toggles opacity; this is especially important for inline placement
    // where floats + CodeMirror inline widgets can behave inconsistently with CSS :hover alone.
    let pinned = false;
    const show = () => {
      hoverBar.style.opacity = '1';
      hoverBar.style.pointerEvents = 'auto';
    };
    const hide = () => {
      if (pinned) return;
      hoverBar.style.opacity = '0';
      hoverBar.style.pointerEvents = 'none';
    };
    wrap.addEventListener('pointerenter', show);
    wrap.addEventListener('pointerleave', hide);
    hoverBar.addEventListener('pointerenter', show);
    hoverBar.addEventListener('pointerleave', hide);

    // Group: prompt/chat (inline, multi-turn)
    hoverBar.appendChild(makeToolbarSeparator());
    hoverBar.appendChild(
      makeInlineComponentChatArea({
        kind: 'figure',
        ariaLabel: 'Figure edit prompt',
        placeholder: 'Describe what you want…',
        rows: 2,
        widthPx: this.opts?.inGrid ? 220 : 280,
        minWidthPx: 160,
        maxWidthPx: this.opts?.inGrid ? 260 : 420,
        heightPx: 44,
        onPinChange: (v) => {
          pinned = Boolean(v);
          if (pinned) show();
          else hide();
        },
        onClose: () => {
          pinned = false;
          hide();
        },
        getOriginal: () => ({ from: this.from, to: this.to, text: view.state.doc.sliceString(this.from, this.to) }),
        applyReplacement: (replacement) => {
          view.dispatch({ changes: { from: this.from, to: this.to, insert: replacement } });
        },
      })
    );
    wrap.appendChild(hoverBar);

    const buttonClass =
      'px-2 py-1 text-xs rounded border border-vscode-border bg-vscode-buttonBg text-vscode-text ' +
      'hover:bg-vscode-buttonHoverBg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.textContent = 'Edit';
    btnEdit.className = `cm-embedded-figure-btn ${buttonClass}`;

    const btnRegenerate = isAiGenerated ? document.createElement('button') : null;
    if (btnRegenerate) {
      btnRegenerate.type = 'button';
      btnRegenerate.textContent = 'Regenerate';
      btnRegenerate.className = `cm-embedded-figure-btn ${buttonClass}`;
    }

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.textContent = 'Delete';
    btnDelete.className = `cm-embedded-figure-btn ${buttonClass} text-red-200 hover:bg-red-900/30`;

    const editor = document.createElement('div');
    editor.style.display = 'none';
    editor.style.marginTop = '8px';
    editor.style.borderTop = '1px solid rgba(255,255,255,0.08)';
    editor.style.paddingTop = '8px';

    const captionLabel = document.createElement('div');
    captionLabel.textContent = 'Caption';
    captionLabel.style.fontSize = '11px';
    captionLabel.style.color = '#9aa0a6';
    captionLabel.style.marginBottom = '4px';
    editor.appendChild(captionLabel);

    const captionInput = document.createElement('input');
    captionInput.value = this.alt || '';
    captionInput.style.width = '100%';
    captionInput.style.background = '#0b0b0c';
    captionInput.style.color = '#e5e7eb';
    captionInput.style.border = '1px solid rgba(255,255,255,0.12)';
    captionInput.style.borderRadius = '6px';
    captionInput.style.padding = '6px 8px';
    editor.appendChild(captionInput);

    const descLabel = document.createElement('div');
    descLabel.textContent = 'Description (for regenerate)';
    descLabel.style.fontSize = '11px';
    descLabel.style.color = '#9aa0a6';
    descLabel.style.marginTop = '8px';
    descLabel.style.marginBottom = '4px';
    editor.appendChild(descLabel);

    const descInput = document.createElement('textarea');
    descInput.value = this.desc || '';
    descInput.rows = 3;
    descInput.style.width = '100%';
    descInput.style.background = '#0b0b0c';
    descInput.style.color = '#e5e7eb';
    descInput.style.border = '1px solid rgba(255,255,255,0.12)';
    descInput.style.borderRadius = '6px';
    descInput.style.padding = '6px 8px';
    editor.appendChild(descInput);

    const editorActions = document.createElement('div');
    editorActions.style.display = 'flex';
    editorActions.style.gap = '8px';
    editorActions.style.marginTop = '8px';

    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.textContent = 'Save';
    btnSave.className = `cm-embedded-figure-btn ${buttonClass} bg-vscode-blue hover:bg-blue-600 text-white border-transparent`;

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.textContent = 'Cancel';
    btnCancel.className = `cm-embedded-figure-btn ${buttonClass}`;

    editorActions.appendChild(btnSave);
    editorActions.appendChild(btnCancel);
    editor.appendChild(editorActions);
    wrap.appendChild(editor);

    const setBusy = (busy: boolean) => {
      btnEdit.disabled = busy;
      if (btnRegenerate) btnRegenerate.disabled = busy;
      btnDelete.disabled = busy;
      btnSave.disabled = busy;
      btnCancel.disabled = busy;
      img.style.opacity = busy ? '0.6' : '1';
    };

    const rebuildMarkdown = (nextSrc: string, nextCaption: string, nextDesc: string) => {
      const cleaned = stripAttrKeys(baseAttrs, ['desc']);
      const withDesc = nextDesc.trim().length > 0 ? upsertAttr(cleaned, 'desc', nextDesc) : cleaned;
      const attrBlock = withDesc.trim().length > 0 ? `{${withDesc.trim()}}` : '';
      return `![${nextCaption}](${nextSrc})${attrBlock}`;
    };

    btnEdit.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      editor.style.display = editor.style.display === 'none' ? 'block' : 'none';
      if (editor.style.display !== 'none') {
        captionInput.focus();
        captionInput.select();
      }
    });

    btnEditIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btnEdit.click();
    });

    btnCancel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      captionInput.value = this.alt || '';
      descInput.value = this.desc || '';
      editor.style.display = 'none';
    });

    btnSave.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nextCaption = captionInput.value.trim();
      const nextDesc = descInput.value;
      const nextText = rebuildMarkdown(this.rawUrl, nextCaption, nextDesc);
      view.dispatch({ changes: { from: this.from, to: this.to, insert: nextText } });
    });

    btnDelete.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const doc = view.state.doc;
      const line = doc.lineAt(this.from);
      // Remove the entire line containing the figure markdown to avoid leaving behind blank lines.
      const from = line.from;
      const to = Math.min(doc.length, line.to + (line.to < doc.length ? 1 : 0));
      view.dispatch({ changes: { from, to, insert: '' } });
    });

    btnTrashIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btnDelete.click();
    });

    btnRegenerate?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        setBusy(true);
        const baseParts: string[] = [];
        baseParts.push('Create a clean, publication-ready figure image.');
        baseParts.push('Style: minimal, high contrast, no watermark.');
        baseParts.push('IMPORTANT: Do NOT include any text, labels, numbers, legends, or watermarks inside the image.');
        const promptParts: string[] = [];
        const d = (descInput.value || this.desc || '').trim();
        if (d) promptParts.push(d);
        const c = (captionInput.value || this.alt || '').trim();
        if (c) promptParts.push(`Caption: ${c}`);
        const prompt = [...baseParts, ...promptParts].join('\n\n');
        const res = await api.ai.images.generate({ prompt, model: 'auto' });
        // If this figure is already stored as an asset ref, upload the new image as an asset too.
        // Otherwise, fall back to embedding data: (legacy docs).
        let nextSrc = `data:${res.mimeType};base64,${res.b64}`;
        if (this.rawUrl.startsWith('zadoox-asset://')) {
          const key = this.rawUrl.slice('zadoox-asset://'.length);
          const docId = key.split('__')[0] || '';
          if (docId) {
            const asset = await api.assets.upload({ documentId: docId, b64: res.b64, mimeType: res.mimeType });
            nextSrc = asset.ref;
          }
        }
        const nextCaption = (captionInput.value || this.alt || '').trim();
        const nextDesc = descInput.value || this.desc || '';
        const nextText = rebuildMarkdown(nextSrc, nextCaption, nextDesc);
        view.dispatch({ changes: { from: this.from, to: this.to, insert: nextText } });
      } finally {
        setBusy(false);
      }
    });

    if (btnRegenIcon && btnRegenerate) {
      btnRegenIcon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Reuse the existing handler for consistent behavior.
        btnRegenerate.click();
      });
    }

    return wrap;
  }
}

class FigureGridWidget extends WidgetType {
  constructor(
    private readonly cols: number,
    private readonly gridCaption: string | null,
    private readonly headerFrom: number,
    private readonly headerTo: number,
    private readonly blockFrom: number,
    private readonly blockTo: number,
    private readonly cells: Array<
      | {
          rawUrl: string;
          displaySrc: string;
          alt: string;
          desc: string | null;
          attrsInner: string | null;
          from: number;
          to: number;
        }
      | null
    >
  ) {
    super();
  }

  eq(other: FigureGridWidget): boolean {
    if (this.cols !== other.cols) return false;
    if (this.cells.length !== other.cells.length) return false;
    for (let i = 0; i < this.cells.length; i++) {
      const a = this.cells[i];
      const b = other.cells[i];
      if (!a && !b) continue;
      if (!a || !b) return false;
      if (
        a.rawUrl !== b.rawUrl ||
        a.displaySrc !== b.displaySrc ||
        a.alt !== b.alt ||
        a.desc !== b.desc ||
        a.attrsInner !== b.attrsInner ||
        a.from !== b.from ||
        a.to !== b.to
      )
        return false;
    }
    return true;
  }

  ignoreEvent(): boolean {
    // The grid widget is a replacement block with interactive controls.
    // Prevent CodeMirror from attempting DOM->pos mapping on clicks inside the widget.
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const outer = document.createElement('div');
    outer.className = 'cm-embedded-figure-grid';
    const spacing = (() => {
      const currentHeader = view.state.doc.sliceString(this.headerFrom, this.headerTo);
      const m = (/\bmargin\s*=\s*"(small|medium|large)"/i.exec(currentHeader)?.[1] || 'medium').toLowerCase();
      // Note: multiple nested paddings/margins contribute to perceived "spacing":
      // - outer margin + padding
      // - grid gap
      // - cell padding
      // - figure card padding
      // - caption margin
      if (m === 'small')
        return { preset: 'small' as const, outerMargin: 2, pad: 2, gap: 4, cellPad: 2, cardPad: 2, capMb: 4 };
      if (m === 'large')
        return { preset: 'large' as const, outerMargin: 12, pad: 12, gap: 14, cellPad: 10, cardPad: 10, capMb: 12 };
      return { preset: 'medium' as const, outerMargin: 6, pad: 8, gap: 10, cellPad: 6, cardPad: 6, capMb: 8 };
    })();

    outer.style.margin = `${spacing.outerMargin}px 0`;
    outer.style.padding = `${spacing.pad}px`;
    outer.style.border = '1px solid rgba(255,255,255,0.10)';
    outer.style.borderRadius = '10px';
    outer.style.background = 'rgba(0,0,0,0.10)';
    outer.style.position = 'relative';

    // Grid-level alignment should align the *grid block*.
    // Layout behavior depends on placement + margin preset:
    // - placement=inline: ALWAYS shrink-wrap (can't do true wrap in CodeMirror, but avoid full-width blocks)
    // - small: shrink-wrap (inline-block grid)
    // - medium: semi-fluid (grid fills width but keeps reasonable min cell width)
    // - large: fully fluid (grid fills full width with equal columns)
    try {
      const headerNow = view.state.doc.sliceString(this.headerFrom, this.headerTo);
      const a = (/\balign\s*=\s*"(left|center|right)"/i.exec(headerNow)?.[1] || 'left').toLowerCase();
      outer.style.textAlign = a === 'center' ? 'center' : a === 'right' ? 'right' : 'left';
      const p = (/\bplacement\s*=\s*"(block|inline)"/i.exec(headerNow)?.[1] || 'block').toLowerCase();
      if (p === 'inline') {
        // Attempt to mimic inline figure behavior: float so subsequent text can wrap.
        // NOTE: This only works if the decoration is inserted as non-block (see buildDecorations).
        outer.style.display = 'inline-block';
        (outer.style as unknown as { width?: string }).width = 'fit-content';
        outer.style.maxWidth = '100%';
        outer.style.verticalAlign = 'top';

        // Float left/right based on align. Center+inline isn't meaningful for wrapping.
        if (a === 'right') {
          (outer.style as unknown as { float?: string }).float = 'right';
          outer.style.margin = `${spacing.outerMargin}px 0 ${spacing.outerMargin}px 12px`;
        } else if (a === 'left') {
          (outer.style as unknown as { float?: string }).float = 'left';
          outer.style.margin = `${spacing.outerMargin}px 12px ${spacing.outerMargin}px 0`;
        } else {
          (outer.style as unknown as { float?: string }).float = 'none';
        }
      }
    } catch {
      // ignore
    }

    const parseGridHeader = (s: string): { cols: number; caption: string | null; align: 'left' | 'center' | 'right' | null; placement: 'block' | 'inline' | null; margin: 'small' | 'medium' | 'large' | null } => {
      const txt = String(s ?? '').trim();
      const colsMatch = /\bcols\s*=\s*(\d+)\b/i.exec(txt);
      const cols = colsMatch ? Number(colsMatch[1]) : 0;
      const capMatch = /\bcaption\s*=\s*"([^"]*)"/i.exec(txt);
      const caption = capMatch ? String(capMatch[1] ?? '').trim() : null;
      const alignMatch = /\balign\s*=\s*"(left|center|right)"/i.exec(txt);
      const align = (alignMatch ? (String(alignMatch[1]) as any) : null) as 'left' | 'center' | 'right' | null;
      const placeMatch = /\bplacement\s*=\s*"(block|inline)"/i.exec(txt);
      const placement = (placeMatch ? (String(placeMatch[1]) as any) : null) as 'block' | 'inline' | null;
      const marginMatch = /\bmargin\s*=\s*"(small|medium|large)"/i.exec(txt);
      const margin = (marginMatch ? (String(marginMatch[1]) as any) : null) as 'small' | 'medium' | 'large' | null;
      return { cols, caption, align, placement, margin };
    };

    const buildGridHeader = (attrs: { cols: number; caption: string | null; align: 'left' | 'center' | 'right' | null; placement: 'block' | 'inline' | null; margin: 'small' | 'medium' | 'large' | null }): string => {
      const parts: string[] = [];
      const cols = Number.isFinite(attrs.cols) && attrs.cols > 0 ? attrs.cols : Math.max(1, this.cols);
      parts.push(`cols=${cols}`);
      const cap = String(attrs.caption ?? '').trim();
      if (cap.length > 0) parts.push(`caption="${cap.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim()}"`);
      if (attrs.align) parts.push(`align="${attrs.align}"`);
      if (attrs.placement) parts.push(`placement="${attrs.placement}"`);
      if (attrs.margin) parts.push(`margin="${attrs.margin}"`);
      return `::: ${parts.join(' ')}`.trimEnd();
    };

    const updateGridHeader = (
      updates: Partial<{ caption: string | null; align: 'left' | 'center' | 'right' | null; placement: 'block' | 'inline' | null; margin: 'small' | 'medium' | 'large' | null }>
    ) => {
      try {
        const currentHeader = view.state.doc.sliceString(this.headerFrom, this.headerTo);
        const parsed = parseGridHeader(currentHeader);
        const next = buildGridHeader({
          cols: parsed.cols || this.cols,
          caption: updates.caption !== undefined ? updates.caption : parsed.caption,
          align: updates.align !== undefined ? updates.align : parsed.align,
          placement: updates.placement !== undefined ? updates.placement : parsed.placement,
          margin: updates.margin !== undefined ? updates.margin : parsed.margin,
        });
        view.dispatch({ changes: { from: this.headerFrom, to: this.headerTo, insert: next } });
      } catch {
        // ignore
      }
    };

    // Grid-level hover toolbar: alignment + placement + edit caption.
    const hoverBar = document.createElement('div');
    hoverBar.className = 'cm-embedded-grid-toolbar';
    hoverBar.style.position = 'absolute';
    hoverBar.style.top = '8px';
    hoverBar.style.right = '8px';
    hoverBar.style.display = 'flex';
    hoverBar.style.gap = '6px';
    hoverBar.style.padding = '6px';
    hoverBar.style.borderRadius = '8px';
    hoverBar.style.border = '1px solid rgba(255,255,255,0.10)';
    hoverBar.style.background = 'rgba(20,20,22,0.9)';
    hoverBar.style.backdropFilter = 'blur(6px)';
    hoverBar.style.zIndex = '3';
    // Linear toolbar that wraps only if it becomes too wide.
    hoverBar.style.flexDirection = 'row';
    hoverBar.style.alignItems = 'center';
    hoverBar.style.flexWrap = 'wrap';
    hoverBar.style.justifyContent = 'flex-end';
    hoverBar.style.whiteSpace = 'normal';
    hoverBar.style.visibility = 'hidden';

    const makeIconBtn = (opts: { label: string; svg: string; selected?: boolean }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', opts.label);
      b.title = opts.label;
      const selected = Boolean(opts.selected);
      b.className =
        'w-7 h-7 flex items-center justify-center rounded border border-vscode-border transition-colors ' +
        (selected
          ? 'bg-vscode-active text-vscode-text'
          : 'bg-transparent text-vscode-text-secondary hover:text-vscode-text hover:bg-vscode-buttonHoverBg');
      const span = document.createElement('span');
      span.innerHTML = opts.svg;
      b.appendChild(span);
      return b;
    };

    const makeSep = makeToolbarSeparator;

    const icon = {
      edit:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M11.5 2.5l2 2L6 12H4v-2L11.5 2.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<path d="M10.5 3.5l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      alignLeft:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 3h12M2 7h8M2 11h10M2 15h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      alignCenter:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 3h12M4 7h8M3 11h10M5 15h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      alignRight:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 3h12M6 7h8M3 11h11M8 15h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      inline:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="2.5" y="5" width="5" height="6" stroke="currentColor" stroke-width="1.5"/>' +
        '<rect x="8.5" y="5" width="5" height="6" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg>',
      block:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="2.5" width="10" height="4" stroke="currentColor" stroke-width="1.5"/>' +
        '<rect x="3" y="9.5" width="10" height="4" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg>',
      code:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M6 4L3 8l3 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M10 4l3 4-3 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>',
      marginS:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="2.5" y="2.5" width="11" height="11" stroke="currentColor" stroke-width="1.5"/>' +
        '<rect x="5" y="5" width="6" height="6" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg>',
      marginM:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="2.5" y="2.5" width="11" height="11" stroke="currentColor" stroke-width="1.5"/>' +
        '<rect x="4.25" y="4.25" width="7.5" height="7.5" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg>',
      marginL:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="2.5" y="2.5" width="11" height="11" stroke="currentColor" stroke-width="1.5"/>' +
        '<rect x="3.25" y="3.25" width="9.5" height="9.5" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg>',
    };

    const currentHeader = view.state.doc.sliceString(this.headerFrom, this.headerTo);
    const parsed = parseGridHeader(currentHeader);
    const currentAlign = parsed.align ?? 'left';
    const currentPlacement = parsed.placement ?? 'block';
    const currentMargin = parsed.margin ?? 'medium';

    const btnEdit = makeIconBtn({ label: 'Edit grid caption', svg: icon.edit });
    const btnShowXmd = makeIconBtn({ label: 'Show XMD', svg: icon.code });
    btnShowXmd.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: toggleRenderForRange.of({ from: this.blockFrom, to: this.blockTo }) });
    });
    btnEdit.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const cur = parseGridHeader(view.state.doc.sliceString(this.headerFrom, this.headerTo));
      const next = window.prompt('Grid caption', cur.caption ?? '');
      if (next === null) return;
      updateGridHeader({ caption: String(next).trim() || null });
    });

    const btnLeft = makeIconBtn({ label: 'Grid align left', svg: icon.alignLeft, selected: currentAlign === 'left' });
    const btnCenter = makeIconBtn({ label: 'Grid align center', svg: icon.alignCenter, selected: currentAlign === 'center' });
    const btnRight = makeIconBtn({ label: 'Grid align right', svg: icon.alignRight, selected: currentAlign === 'right' });
    btnLeft.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); updateGridHeader({ align: 'left' }); });
    btnCenter.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); updateGridHeader({ align: 'center' }); });
    btnRight.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); updateGridHeader({ align: 'right' }); });

    const btnInline = makeIconBtn({ label: 'Grid placement inline', svg: icon.inline, selected: currentPlacement === 'inline' });
    const btnBlock = makeIconBtn({ label: 'Grid placement block', svg: icon.block, selected: currentPlacement === 'block' });
    btnInline.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); updateGridHeader({ placement: 'inline' }); });
    btnBlock.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); updateGridHeader({ placement: 'block' }); });

    const btnMarginS = makeIconBtn({ label: 'Grid margin small', svg: icon.marginS, selected: currentMargin === 'small' });
    const btnMarginM = makeIconBtn({ label: 'Grid margin medium', svg: icon.marginM, selected: currentMargin === 'medium' });
    const btnMarginL = makeIconBtn({ label: 'Grid margin large', svg: icon.marginL, selected: currentMargin === 'large' });
    btnMarginS.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); updateGridHeader({ margin: 'small' }); });
    btnMarginM.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); updateGridHeader({ margin: 'medium' }); });
    btnMarginL.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); updateGridHeader({ margin: 'large' }); });

    // Group: basic
    hoverBar.appendChild(btnEdit);
    hoverBar.appendChild(btnShowXmd);
    hoverBar.appendChild(makeSep());

    // Group: align
    hoverBar.appendChild(btnLeft);
    hoverBar.appendChild(btnCenter);
    hoverBar.appendChild(btnRight);
    hoverBar.appendChild(makeSep());

    // Group: placement
    hoverBar.appendChild(btnInline);
    hoverBar.appendChild(btnBlock);
    hoverBar.appendChild(makeSep());

    // Group: margin preset
    hoverBar.appendChild(btnMarginS);
    hoverBar.appendChild(btnMarginM);
    hoverBar.appendChild(btnMarginL);

    let pinned = false;
    const show = () => {
      hoverBar.style.visibility = 'visible';
      hoverBar.style.pointerEvents = 'auto';
    };
    const hide = () => {
      if (pinned) return;
      hoverBar.style.visibility = 'hidden';
      hoverBar.style.pointerEvents = 'none';
    };
    hide();
    outer.addEventListener('pointerenter', show);
    outer.addEventListener('pointerleave', hide);
    hoverBar.addEventListener('pointerenter', show);
    hoverBar.addEventListener('pointerleave', hide);

    // Group: prompt/chat (inline, multi-turn) – will naturally wrap to next line if toolbar gets too wide.
    hoverBar.appendChild(makeSep());
    hoverBar.appendChild(
      makeInlineComponentChatArea({
        kind: 'grid',
        ariaLabel: 'Grid edit prompt',
        placeholder: 'Describe what you want…',
        rows: 2,
        widthPx: 320,
        minWidthPx: 220,
        maxWidthPx: 560,
        heightPx: 44,
        onPinChange: (v) => {
          pinned = Boolean(v);
          if (pinned) show();
          else hide();
        },
        onClose: () => {
          pinned = false;
          hide();
        },
        getOriginal: () => ({ from: this.blockFrom, to: this.blockTo, text: view.state.doc.sliceString(this.blockFrom, this.blockTo) }),
        applyReplacement: (replacement) => {
          view.dispatch({ changes: { from: this.blockFrom, to: this.blockTo, insert: replacement } });
        },
      })
    );
    outer.appendChild(hoverBar);

    const cap = String(this.gridCaption ?? '').trim();
    if (cap.length > 0) {
      const capEl = document.createElement('div');
      capEl.textContent = cap;
      capEl.style.marginBottom = `${spacing.capMb}px`;
      capEl.style.fontSize = '12px';
      capEl.style.color = '#9aa0a6';
      capEl.style.fontStyle = 'italic';
      capEl.style.textAlign = 'center';
      outer.appendChild(capEl);
    }

    // Inline placement hint (editor limitation: no true text wrapping around widgets in CodeMirror).
    try {
      const h = view.state.doc.sliceString(this.headerFrom, this.headerTo);
      const p = (/\bplacement\s*=\s*"(block|inline)"/i.exec(h)?.[1] || 'block').toLowerCase();
      if (p === 'inline') {
        outer.style.outline = '1px dashed rgba(120, 170, 255, 0.55)';
        outer.style.outlineOffset = '3px';
      }
    } catch {
      // ignore
    }

    const gridWrap = document.createElement('div');
    const placementNow = (() => {
      try {
        const h = view.state.doc.sliceString(this.headerFrom, this.headerTo);
        return (/\bplacement\s*=\s*"(block|inline)"/i.exec(h)?.[1] || 'block').toLowerCase();
      } catch {
        return 'block';
      }
    })();
    const forceShrinkWrap = placementNow === 'inline';

    if (forceShrinkWrap || spacing.preset === 'small') {
      gridWrap.style.display = 'inline-block';
      gridWrap.style.maxWidth = '100%';
    } else {
      // medium/large: fluid container
      gridWrap.style.display = 'block';
      gridWrap.style.width = '100%';
      gridWrap.style.maxWidth = '100%';
    }

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    if (forceShrinkWrap || spacing.preset === 'small') {
      // Shrink-wrap: just enough width for content.
      grid.style.gridTemplateColumns = `repeat(${Math.max(1, this.cols)}, auto)`;
    } else if (spacing.preset === 'large') {
      // Full width: equal columns.
      grid.style.width = '100%';
      grid.style.gridTemplateColumns = `repeat(${Math.max(1, this.cols)}, minmax(0, 1fr))`;
    } else {
      // Medium: fill width but keep a minimum cell width so it doesn't feel too stretched.
      grid.style.width = '100%';
      grid.style.gridTemplateColumns = `repeat(${Math.max(1, this.cols)}, minmax(220px, 1fr))`;
    }
    grid.style.gap = `${spacing.gap}px`;

    for (let i = 0; i < this.cells.length; i++) {
      const cell = document.createElement('div');
      cell.style.border = '1px solid rgba(255,255,255,0.08)';
      cell.style.borderRadius = '8px';
      cell.style.padding = `${spacing.cellPad}px`;
      cell.style.background = 'rgba(0,0,0,0.12)';
      // Allow nested figure toolbars (which are absolutely positioned) to extend beyond the cell box.
      // Otherwise the toolbar can be clipped and appear "not showing".
      cell.style.overflow = 'visible';
      // Let per-item alignment position the figure card within the cell.
      cell.style.display = 'flex';
      cell.style.alignItems = 'flex-start';

      const c = this.cells[i];
      if (c) {
        const cellAlignRaw = (c.attrsInner ? parseAttrValue(c.attrsInner, 'align') : null) ?? 'left';
        const cellAlign = cellAlignRaw === 'right' ? 'right' : cellAlignRaw === 'center' ? 'center' : 'left';
        cell.style.justifyContent = cellAlign === 'right' ? 'flex-end' : cellAlign === 'center' ? 'center' : 'flex-start';

        const card = new FigureCardWidget(
          c.rawUrl,
          c.displaySrc,
          c.alt,
          c.desc,
          c.attrsInner,
          c.from,
          c.to,
          // In grid mode: keep per-cell actions (edit/regen/delete/size),
          // but hide non-applicable layout controls. Placement + alignment are grid-level.
          { hidePlacement: true, hideAlign: false, inGrid: true }
        ).toDOM(view);
        // Grid mode: avoid floats/margins causing weird layout.
        card.style.margin = '0';
        (card.style as unknown as { float?: string }).float = 'none';
        // Critical: don't force the card to fill the entire cell.
        // Otherwise it looks like "huge margins" because the background/border span the whole cell.
        if (spacing.preset === 'large') {
          // In large mode we intentionally let cards fill the column so the grid reads as "full-width".
          card.style.width = '100%';
        } else {
          (card.style as unknown as { width?: string }).width = 'fit-content';
        }
        card.style.maxWidth = '100%';
        // Tighten/expand inner padding based on grid margin preset (otherwise the default card padding dominates spacing).
        card.style.padding = `${spacing.cardPad}px`;
        cell.appendChild(card);
      } else {
        cell.style.justifyContent = 'center';
        const ph = document.createElement('div');
        ph.textContent = 'Empty cell';
        ph.style.fontSize = '12px';
        ph.style.color = '#9aa0a6';
        ph.style.padding = '18px 8px';
        ph.style.textAlign = 'center';
        ph.style.border = '1px dashed rgba(255,255,255,0.12)';
        ph.style.borderRadius = '6px';
        cell.appendChild(ph);
      }

      grid.appendChild(cell);
    }

    gridWrap.appendChild(grid);
    outer.appendChild(gridWrap);
    return outer;
  }
}

/**
 * Renders previews for embedded base64 images in markdown like:
 * ![Alt](data:image/png;base64,AAAA...)
 *
 * - Visually collapses the long base64 payload to an ellipsis so the editor doesn't show a giant string.
 * - Adds a block image preview widget under the line.
 */
export function embeddedImagePreviewExtension() {
  const buildDecorations = (state: EditorView['state']): DecorationSet => {
    const doc = state.doc;
    const text = doc.toString();
    const disabledRanges = state.field(disabledRenderRangesField);
    const isRenderingDisabledAt = (from: number, to: number) => disabledRanges.some((r) => overlaps(r, { from, to }));

    class TableWidget extends WidgetType {
      constructor(
        private readonly blockFrom: number,
        private readonly blockTo: number,
        private readonly header: string[],
        private readonly rows: string[][]
      ) {
        super();
      }
      eq(other: TableWidget): boolean {
        return this.blockFrom === other.blockFrom && this.blockTo === other.blockTo;
      }
      ignoreEvent(): boolean {
        return true;
      }
      toDOM(view: EditorView): HTMLElement {
        const outer = document.createElement('div');
        outer.className = 'cm-embedded-table';
        outer.style.position = 'relative';
        outer.style.margin = '8px 0';
        outer.style.padding = '10px';
        outer.style.border = '1px solid rgba(255,255,255,0.10)';
        outer.style.borderRadius = '10px';
        outer.style.background = 'rgba(0,0,0,0.10)';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Show XMD';
        btn.className =
          'text-xs px-2 py-1 rounded border border-vscode-border bg-vscode-buttonBg text-vscode-text ' +
          'hover:bg-vscode-buttonHoverBg transition-colors';
        btn.style.position = 'absolute';
        btn.style.top = '8px';
        btn.style.right = '8px';
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          view.dispatch({ effects: toggleRenderForRange.of({ from: this.blockFrom, to: this.blockTo }) });
        });
        outer.appendChild(btn);

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginTop = '26px';
        const mkCell = (tag: 'th' | 'td', txt: string) => {
          const el = document.createElement(tag);
          el.textContent = txt;
          el.style.border = '1px solid rgba(255,255,255,0.10)';
          el.style.padding = '6px 8px';
          el.style.fontSize = '12px';
          el.style.color = '#e5e7eb';
          if (tag === 'th') {
            el.style.background = 'rgba(255,255,255,0.06)';
            el.style.fontWeight = '600';
          }
          return el;
        };

        const thead = document.createElement('thead');
        const trh = document.createElement('tr');
        for (const h of this.header) trh.appendChild(mkCell('th', h));
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const r of this.rows) {
          const tr = document.createElement('tr');
          for (const c of r) tr.appendChild(mkCell('td', c));
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        outer.appendChild(table);
        return outer;
      }
    }

    class RenderPillWidget extends WidgetType {
      constructor(
        private readonly label: string,
        private readonly from: number,
        private readonly to: number
      ) {
        super();
      }
      eq(other: RenderPillWidget): boolean {
        return this.label === other.label && this.from === other.from && this.to === other.to;
      }
      ignoreEvent(): boolean {
        return true;
      }
      toDOM(view: EditorView): HTMLElement {
        const wrap = document.createElement('div');
        wrap.style.margin = '6px 0';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = this.label;
        btn.className =
          'text-xs px-2 py-1 rounded border border-vscode-border bg-vscode-buttonBg text-vscode-text ' +
          'hover:bg-vscode-buttonHoverBg transition-colors';
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          view.dispatch({ effects: toggleRenderForRange.of({ from: this.from, to: this.to }) });
        });
        wrap.appendChild(btn);
        return wrap;
      }
    }

    const parsePipeRow = (line: string): string[] | null => {
      const t = String(line ?? '').trim();
      if (!t.includes('|')) return null;
      const s = t.replace(/^\||\|$/g, '');
      const parts = s.split('|').map((x) => x.trim());
      return parts.length >= 2 ? parts : null;
    };
    const isSeparatorRow = (line: string): boolean => {
      const t = String(line ?? '').trim();
      if (!t.includes('|')) return false;
      const s = t.replace(/^\||\|$/g, '').trim();
      if (!s) return false;
      return s.split('|').every((cell) => /^:?-{3,}:?\s*$/.test(cell.trim()));
    };

    const parseTableBlocks = (): TableBlock[] => {
      const blocks: TableBlock[] = [];
      const lines = text.split('\n');
      let pos = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const startPos = pos;
        const endPos = pos + line.length + (i === lines.length - 1 ? 0 : 1);

        const header = parsePipeRow(line);
        const sepLine = lines[i + 1] ?? '';
        if (header && isSeparatorRow(sepLine)) {
          // Find the absolute positions for the full block
          let j = i + 2;
          const rows: string[][] = [];
          while (j < lines.length) {
            const r = parsePipeRow(lines[j] ?? '');
            if (!r) break;
            rows.push(r);
            j++;
          }
          // Compute endPos of last row line
          let end = endPos;
          // Move end to cover through line j-1
          let p2 = endPos; // after header line
          // add separator line length + newline
          p2 += (lines[i + 1] ?? '').length + 1;
          for (let k = i + 2; k < j; k++) {
            p2 += (lines[k] ?? '').length + (k === lines.length - 1 ? 0 : 1);
          }
          end = startPos + (line.length + 1) + (lines[i + 1] ?? '').length + 1;
          for (let k = i + 2; k < j; k++) end += (lines[k] ?? '').length + (k === lines.length - 1 ? 0 : 1);

          blocks.push({ from: startPos, to: Math.min(end, doc.length), header, rows });
          i = j - 1;
          pos = Math.min(end, doc.length);
          continue;
        }

        pos = endPos;
      }
      return blocks;
    };

    if (!text.includes('data:image/') && !text.includes('zadoox-asset://')) {
      return Decoration.none;
    }

    const resolveSrc = (url: string): string => {
      const trimmed = (url || '').trim();
      if (trimmed.startsWith('zadoox-asset://')) {
        // We'll load this via fetch+Authorization and set a blob URL on the client.
        return '';
      }
      return trimmed;
    };

    const parseGridBlocks = (raw: string): GridBlock[] => {
      // We only treat `:::` fences that have a `cols=N` attribute as grids.
      const blocks: GridBlock[] = [];
      const startRe = /^:::\s*(.*?)$/gm;
      let m: RegExpExecArray | null;
      while ((m = startRe.exec(raw))) {
        const header = (m[1] || '').trim();
        const colsMatch = /\bcols\s*=\s*(\d+)\b/.exec(header);
        const cols = colsMatch ? Number(colsMatch[1]) : 0;
        if (!Number.isFinite(cols) || cols <= 0) continue;
        const captionMatch = /\bcaption\s*=\s*"([^"]*)"/.exec(header);
        const caption = captionMatch ? String(captionMatch[1] ?? '').trim() : null;
        const alignMatch = /\balign\s*=\s*"(left|center|right)"/i.exec(header);
        const align = (alignMatch ? (String(alignMatch[1]) as any) : null) as 'left' | 'center' | 'right' | null;
        const placementMatch = /\bplacement\s*=\s*"(block|inline)"/i.exec(header);
        const placement = (placementMatch ? (String(placementMatch[1]) as any) : null) as 'block' | 'inline' | null;
        const marginMatch = /\bmargin\s*=\s*"(small|medium|large)"/i.exec(header);
        const margin = (marginMatch ? (String(marginMatch[1]) as any) : null) as 'small' | 'medium' | 'large' | null;
        const start = m.index;
        // Find closing ::: on its own line after the start.
        // Also accept an inline closing fence at end of a content line: "... :::"
        const closeRe = /^(?:\s*:::\s*$|.*?:::\s*$)/gm;
        closeRe.lastIndex = startRe.lastIndex;
        let close = closeRe.exec(raw);
        // If the first "close" is actually another opening fence line, skip it.
        while (close) {
          const line = String(close[0] ?? '');
          const t = line.trim();
          const isOpening = t.startsWith(':::') && t !== ':::';
          if (!isOpening) break;
          close = closeRe.exec(raw);
        }
        if (!close) continue;
        const end = close.index + close[0].length;
        blocks.push({ from: start, to: end, cols, caption, align, placement, margin });
        // Continue scanning after this block.
        startRe.lastIndex = end;
      }
      return blocks;
    };

    const gridBlocks = parseGridBlocks(text);
    const isInGrid = (pos: number) => gridBlocks.some((g) => pos >= g.from && pos < g.to);

    // Capture optional attribute block after the image.
    // Supports:
    // - data:image/...;base64,...
    // - zadoox-asset://<key> (stored in Supabase Storage, fetched via backend)
    const re =
      /!\[([^\]]*)\]\(((?:data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)|(?:zadoox-asset:\/\/[^)\s]+))\)\s*(\{(?:\{REF\}|\{CH\}|[^}])*\})?/g;

    const decos: Array<import('@codemirror/state').Range<Decoration>> = [];
    // Render pipe-tables as a single widget (with per-element toggle).
    // We do this before figures so figures inside a table won't be replaced unexpectedly.
    const tableBlocks = parseTableBlocks();
    for (const tb of tableBlocks) {
      if (isRenderingDisabledAt(tb.from, tb.to)) {
        decos.push(
          Decoration.widget({
            widget: new RenderPillWidget('Render table', tb.from, tb.to),
            block: true,
            side: -1,
          }).range(tb.from)
        );
        continue;
      }
      decos.push(
        Decoration.replace({
          widget: new TableWidget(tb.from, tb.to, tb.header, tb.rows),
          block: true,
        }).range(tb.from, tb.to)
      );
    }

    let inGridMatchCount = 0;
    let outGridMatchCount = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const alt = (m[1] || '').trim();
      const rawUrl = (m[2] || '').trim();
      const src = resolveSrc(rawUrl);
      const attrs = (m[3] || '').trim();
      const desc = attrs ? parseAttrValue(attrs, 'desc') : null;
      const placement = attrs ? parseAttrValue(attrs, 'placement') : null;

      const matchStart = m.index;
      const matchText = m[0] || '';

      const matchEnd = matchStart + matchText.length;

      if (isInGrid(matchStart)) {
        inGridMatchCount++;
        continue;
      } else {
        outGridMatchCount++;
      }

      // Skip rendering if this figure is within a disabled range or a rendered table block.
      if (tableBlocks.some((t) => matchStart >= t.from && matchStart < t.to)) {
        continue;
      }
      if (isRenderingDisabledAt(matchStart, matchEnd)) {
        // Leave raw XMD visible.
        // Add a small "Render" pill above the element for easy toggling back.
        decos.push(
          Decoration.widget({
            widget: new RenderPillWidget('Render figure', matchStart, matchEnd),
            block: true,
            side: -1,
          }).range(matchStart)
        );
        continue;
      }

      // Hide the entire markdown image token (B), and render a figure card instead.
      if (matchEnd > matchStart && matchEnd <= doc.length) {
        const attrsInner = attrs ? attrs.slice(1, -1) : null;
        decos.push(
          Decoration.replace({
            widget: new FigureCardWidget(
              rawUrl,
              src,
              alt,
              desc,
              attrsInner,
              matchStart,
              matchEnd
            ),
            block: placement !== 'inline',
          }).range(matchStart, matchEnd)
        );
      }
    }

    // Render grid blocks as a single widget so MD edit mode shows an actual grid (not a list of cards).
    // Each cell will render a nested FigureCardWidget for the first image found in that cell segment.
    const gridStartRe = /^:::\s*(.*?)$/gm;
    const gridSummaries: Array<{ cols: number; caption: string | null; segs: number; imgs: number; alts: string[] }> = [];
    for (const g of gridBlocks) {
      if (isRenderingDisabledAt(g.from, g.to)) {
        // Leave raw XMD visible.
        decos.push(
          Decoration.widget({
            widget: new RenderPillWidget('Render grid', g.from, g.to),
            block: true,
            side: -1,
          }).range(g.from)
        );
        continue;
      }
      // Best-effort: parse cell segments between header and closing fence using the row/cell markers.
      const rawBlock = text.slice(g.from, g.to);
      const headerMatch = gridStartRe.exec(rawBlock);
      gridStartRe.lastIndex = 0;
      if (!headerMatch) continue;
      const headerLineLen = headerMatch[0].length;
      const headerFrom = g.from;
      const headerTo = g.from + headerLineLen;
      const innerStart = headerTo;
      const innerEnd = g.to;
      const inner = text.slice(innerStart, innerEnd);

      // Split into segments (cells) using delimiter lines.
      const segs: Array<{ from: number; to: number }> = [];
      let segFrom = innerStart;
      // Be permissive: allow indentation/whitespace before delimiters (grids can appear inside lists/quotes).
      const delimRe = /^\s*(?:\|\|\||---)\s*$/gm;
      let dm: RegExpExecArray | null;
      while ((dm = delimRe.exec(inner))) {
        const absFrom = innerStart + dm.index;
        segs.push({ from: segFrom, to: absFrom });
        // Advance segment start to after the delimiter line + newline (if present)
        const after = absFrom + dm[0].length;
        const next = text[after] === '\n' ? after + 1 : after;
        segFrom = next;
      }
      segs.push({ from: segFrom, to: innerEnd });

      // Count all figures inside the grid block as a fallback mapping source.
      const figMatchesInBlock: Array<{
        rawUrl: string;
        displaySrc: string;
        alt: string;
        desc: string | null;
        attrsInner: string | null;
        from: number;
        to: number;
      }> = [];
      {
        const blockRe = new RegExp(re.source, 'g');
        let bm: RegExpExecArray | null;
        while ((bm = blockRe.exec(inner))) {
          const alt = (bm[1] || '').trim();
          const rawUrl = (bm[2] || '').trim();
          const displaySrc = resolveSrc(rawUrl);
          const attrs = (bm[3] || '').trim();
          const desc = attrs ? parseAttrValue(attrs, 'desc') : null;
          const attrsInner = attrs ? attrs.slice(1, -1) : null;
          const start = innerStart + bm.index;
          const end = start + (bm[0] || '').length;
          figMatchesInBlock.push({ rawUrl, displaySrc, alt, desc, attrsInner, from: start, to: end });
        }
      }

      // If segmentation collapses (e.g. due to delimiter formatting quirks), fall back to sequential mapping:
      // N images mapped left-to-right, top-to-bottom using cols from the header.
      const useFallbackSequential = segs.length > 0 && figMatchesInBlock.length > segs.length;

      const cells: Array<FigureGridWidget['cells'][number]> = [];
      const figRe = new RegExp(re.source, 'g');
      const alts: string[] = [];
      let imgs = 0;

      if (useFallbackSequential) {
        for (const fm of figMatchesInBlock) {
          cells.push(fm);
          imgs++;
          if (fm.alt) alts.push(fm.alt);
        }
        // Pad to full rows
        const cols = Math.max(1, g.cols);
        while (cells.length % cols !== 0) cells.push(null);
      } else {
        for (const s of segs) {
          const segText = text.slice(s.from, s.to);
          figRe.lastIndex = 0;
          const fm = figRe.exec(segText);
          if (!fm) {
            cells.push(null);
            continue;
          }
          const alt = (fm[1] || '').trim();
          const rawUrl = (fm[2] || '').trim();
          const displaySrc = resolveSrc(rawUrl);
          const attrs = (fm[3] || '').trim();
          const desc = attrs ? parseAttrValue(attrs, 'desc') : null;
          const attrsInner = attrs ? attrs.slice(1, -1) : null;
          const start = s.from + fm.index;
          const end = start + (fm[0] || '').length;
          cells.push({ rawUrl, displaySrc, alt, desc, attrsInner, from: start, to: end });
          imgs++;
          if (alt) alts.push(alt);
        }
      }

      gridSummaries.push({ cols: g.cols, caption: g.caption, segs: segs.length, imgs, alts });

      if (g.to > g.from && g.to <= doc.length) {
        const inlineWrap = g.placement === 'inline' && ((g.align ?? 'left') === 'left' || (g.align ?? 'left') === 'right');
        decos.push(
          Decoration.replace({
            widget: new FigureGridWidget(g.cols, g.caption, headerFrom, headerTo, g.from, g.to, cells),
            // If placement=inline and align is left/right, render as non-block so text can wrap (like inline figures).
            block: !inlineWrap,
          }).range(g.from, g.to)
        );
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'grid-insert',hypothesisId:'H8',location:'embedded-image-preview-extension.ts:buildDecorations',message:'Grid vs figure decoration summary',data:{gridCount:gridBlocks.length,inGridMatchCount,outGridMatchCount,totalDecorations:decos.length,gridCols:gridBlocks.map(g=>g.cols)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'grid-align',hypothesisId:'H18',location:'embedded-image-preview-extension.ts:buildDecorations',message:'Grid cell mapping summary',data:{gridSummaries},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log

    return Decoration.set(decos, true);
  };

  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state);
    },
    update(value, tr) {
      const toggled = tr.effects.some((e) => e.is(toggleRenderForRange));
      if (!tr.docChanged && !toggled) return value;
      return buildDecorations(tr.state);
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  return [disabledRenderRangesField, field];
}


