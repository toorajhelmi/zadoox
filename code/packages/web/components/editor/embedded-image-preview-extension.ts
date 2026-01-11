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

type ToolbarMenuItem = { label: string; svg?: string; selected?: boolean; onSelect: () => void };

const toolbarKeepVisibleUntilByKey = new Map<string, number>();

function bumpToolbarKeepVisible(key: string, ms = 1200): void {
  toolbarKeepVisibleUntilByKey.set(key, Date.now() + ms);
}

function shouldToolbarStartVisible(key: string): boolean {
  return Date.now() < (toolbarKeepVisibleUntilByKey.get(key) ?? 0);
}

function createToolbarShell(params: {
  outer: HTMLElement;
  keepOpenKey: string;
  className: string;
  top: string;
  right?: string;
  left?: string;
  zIndex: string;
  showMode?: 'visibility' | 'opacity';
  hideDelayMs?: number;
  /**
   * Extra CSS styles to apply to the toolbar container.
   * Use either camelCase (e.g. maxWidth) or kebab-case (e.g. max-width).
   */
  style?: Record<string, string>;
}): {
  bar: HTMLDivElement;
  makeIconBtn: (opts: { label: string; svg: string; selected?: boolean }) => HTMLButtonElement;
  makeSep: () => HTMLDivElement;
  makeDropdownGroup: (p: { label: string; currentBtn: HTMLButtonElement; items: ToolbarMenuItem[]; customBody?: (c: HTMLDivElement) => void }) => HTMLDivElement;
  setPinned: (pinned: boolean) => void;
  show: () => void;
  hideSoon: () => void;
} {
  const showMode = params.showMode ?? 'visibility';
  const hideDelayMs = params.hideDelayMs ?? 220;

  const hoverBar = document.createElement('div');
  hoverBar.className = params.className;
  hoverBar.style.position = 'absolute';
  hoverBar.style.top = params.top;
  if (params.right) hoverBar.style.right = params.right;
  if (params.left) hoverBar.style.left = params.left;
  hoverBar.style.display = 'flex';
  hoverBar.style.gap = '6px';
  hoverBar.style.padding = '6px';
  hoverBar.style.borderRadius = '8px';
  hoverBar.style.border = '1px solid rgba(255,255,255,0.10)';
  hoverBar.style.background = 'rgba(20,20,22,0.9)';
  hoverBar.style.backdropFilter = 'blur(6px)';
  hoverBar.style.zIndex = params.zIndex;
  hoverBar.style.alignItems = 'center';
  hoverBar.style.flexWrap = 'wrap';
  hoverBar.style.justifyContent = 'flex-end';
  hoverBar.style.flexDirection = 'row';
  hoverBar.style.whiteSpace = 'normal';
  hoverBar.style.fontSize = '11px';
  hoverBar.style.color = '#cfcfcf';
  for (const [k, v] of Object.entries(params.style ?? {})) {
    if (typeof v !== 'string' || v.trim().length === 0) continue;
    const cssName = k.includes('-') ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    hoverBar.style.setProperty(cssName, v);
  }

  // Keep open across widget recreation (doc edits).
  const bumpKeepVisible = (ms = 1200) => bumpToolbarKeepVisible(params.keepOpenKey, ms);
  hoverBar.addEventListener('pointerdown', () => bumpKeepVisible(), true);
  hoverBar.addEventListener('pointermove', () => bumpKeepVisible(), true);

  // Dropdown menu plumbing.
  let anyMenuOpen = false;
  const closeMenuFns: Array<() => void> = [];
  const closeAllMenus = () => {
    for (const fn of closeMenuFns) fn();
    anyMenuOpen = false;
  };

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

  const makeDropdownGroup = (p: {
    label: string;
    currentBtn: HTMLButtonElement;
    items: ToolbarMenuItem[];
    customBody?: (c: HTMLDivElement) => void;
  }) => {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';

    const menu = document.createElement('div');
    menu.style.position = 'absolute';
    menu.style.top = '36px';
    menu.style.right = '0';
    menu.style.zIndex = '10';
    menu.style.display = 'none';
    menu.style.flexDirection = 'column';
    menu.style.gap = '4px';
    menu.style.padding = '6px';
    menu.style.borderRadius = '10px';
    menu.style.border = '1px solid rgba(255,255,255,0.10)';
    menu.style.background = 'rgba(20,20,22,0.96)';
    menu.style.backdropFilter = 'blur(6px)';
    menu.style.minWidth = '180px';

    const title = document.createElement('div');
    title.textContent = p.label;
    title.style.fontSize = '11px';
    title.style.color = '#9aa0a6';
    title.style.marginBottom = '2px';
    menu.appendChild(title);

    const mkRow = (it: ToolbarMenuItem) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className =
        'flex items-center gap-2 w-full rounded border border-vscode-border px-2 py-1 text-xs transition-colors ' +
        (it.selected
          ? 'bg-vscode-active text-vscode-text'
          : 'bg-transparent text-vscode-text-secondary hover:text-vscode-text hover:bg-vscode-buttonHoverBg');
      if (it.svg) {
        const s = document.createElement('span');
        s.innerHTML = it.svg;
        row.appendChild(s);
      }
      const t = document.createElement('span');
      t.textContent = it.label;
      row.appendChild(t);
      row.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        bumpKeepVisible();
        it.onSelect();
        menu.style.display = 'none';
        anyMenuOpen = false;
      });
      return row;
    };

    if (p.customBody) {
      const body = document.createElement('div');
      p.customBody(body);
      menu.appendChild(body);
    } else {
      for (const it of p.items) menu.appendChild(mkRow(it));
    }

    const close = () => {
      menu.style.display = 'none';
    };
    closeMenuFns.push(close);

    p.currentBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      bumpKeepVisible();
      const isOpen = menu.style.display === 'flex';
      closeAllMenus();
      if (!isOpen) {
        menu.style.display = 'flex';
        anyMenuOpen = true;
      }
    });

    menu.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      bumpKeepVisible();
    });
    params.outer.addEventListener('pointerdown', (e) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (wrap.contains(t)) return;
      closeAllMenus();
    });

    wrap.appendChild(p.currentBtn);
    wrap.appendChild(menu);
    return wrap;
  };

  // Hover/pin behavior.
  let pinned = false;
  let hideTimer: number | null = null;

  const show = () => {
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (showMode === 'opacity') {
      hoverBar.style.opacity = '1';
      hoverBar.style.pointerEvents = 'auto';
    } else {
      hoverBar.style.visibility = 'visible';
      hoverBar.style.pointerEvents = 'auto';
    }
  };

  const hideSoon = () => {
    if (pinned) return;
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (pinned) return;
      if (anyMenuOpen) return;
      if (showMode === 'opacity') {
        hoverBar.style.opacity = '0';
        hoverBar.style.pointerEvents = 'none';
      } else {
        hoverBar.style.visibility = 'hidden';
        hoverBar.style.pointerEvents = 'none';
      }
      hideTimer = null;
    }, hideDelayMs);
  };

  const startVisible = shouldToolbarStartVisible(params.keepOpenKey);
  if (showMode === 'opacity') {
    hoverBar.style.transition = 'opacity 120ms ease';
    hoverBar.style.opacity = startVisible ? '1' : '0';
    hoverBar.style.pointerEvents = startVisible ? 'auto' : 'none';
  } else {
    hoverBar.style.visibility = startVisible ? 'visible' : 'hidden';
    hoverBar.style.pointerEvents = startVisible ? 'auto' : 'none';
  }

  params.outer.addEventListener('pointerenter', show);
  params.outer.addEventListener('pointermove', show);
  params.outer.addEventListener('pointerleave', hideSoon);
  hoverBar.addEventListener('pointerenter', show);
  hoverBar.addEventListener('pointerleave', hideSoon);

  return {
    bar: hoverBar,
    makeIconBtn,
    makeSep: makeToolbarSeparator,
    makeDropdownGroup,
    setPinned: (p) => {
      pinned = Boolean(p);
      if (pinned) show();
      else hideSoon();
    },
    show,
    hideSoon,
  };
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
    type TableRule = 'none' | 'single' | 'double';
    type TableAlign = 'left' | 'center' | 'right';
    type TableBorderStyle = 'solid' | 'dotted' | 'dashed';
    type XmdTableBlock = {
      from: number;
      to: number;
      header: string[];
      rows: string[][];
      caption: string | null;
      label: string | null;
      colAlign: TableAlign[];
      vRules: TableRule[]; // cols+1
      hRules: TableRule[]; // totalRows+1
      style: { borderStyle: TableBorderStyle; borderColor: string; borderWidthPx: number } | null;
    };

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
    const borderStyleRaw = baseAttrs ? parseAttrValue(baseAttrs, 'borderStyle') : null; // solid|dotted|dashed
    const borderColorRaw = baseAttrs ? parseAttrValue(baseAttrs, 'borderColor') : null; // any CSS color (prefer hex)
    const borderWidthRaw = baseAttrs ? parseAttrValue(baseAttrs, 'borderWidth') : null; // integer px
    const borderStyle =
      (borderStyleRaw || '').trim().toLowerCase() === 'dotted'
        ? 'dotted'
        : (borderStyleRaw || '').trim().toLowerCase() === 'dashed'
          ? 'dashed'
          : 'solid';
    const borderColor = (borderColorRaw || '').trim();
    const borderWidthNum = (() => {
      const n = Number(String(borderWidthRaw || '').trim());
      return Number.isFinite(n) ? Math.round(n) : NaN;
    })();

    // Apply border props to the figure card container (so it matches user expectations and preview).
    // If the user sets any border-related attribute, override the default card border.
    {
      const hasBorderAttr = Boolean(
        (borderStyleRaw && borderStyleRaw.trim().length > 0) ||
          (borderColorRaw && borderColorRaw.trim().length > 0) ||
          (borderWidthRaw && String(borderWidthRaw).trim().length > 0)
      );
      if (hasBorderAttr) {
        if (Number.isFinite(borderWidthNum) && borderWidthNum === 0) {
          wrap.style.border = 'none';
        } else {
          const w = Number.isFinite(borderWidthNum) && borderWidthNum > 0 ? borderWidthNum : 1;
          const c = borderColor || 'rgba(255,255,255,0.10)';
          wrap.style.border = `${w}px ${borderStyle} ${c}`;
        }
      }
    }

    // Keep the editor stable: we don't do true text-wrapping inline layout inside CodeMirror.
    // But we *do*:
    // - respect the configured width so the figure matches preview sizing
    // - show a visual hint that this figure will be inline/wrapped in preview
    if (placement === 'inline') {
      if (width) {
        wrap.style.width = width;
        wrap.style.maxWidth = width;
      }
      // Do not add extra "inline placement hint" outlines.
      // Figures should only show borders the user explicitly sets (borderStyle/borderColor/borderWidth).

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
    // Image border: only show a subtle default border when the user has not set a figure border.
    const userBorderSet = Boolean(
      (borderStyleRaw && borderStyleRaw.trim().length > 0) ||
        (borderColorRaw && borderColorRaw.trim().length > 0) ||
        (borderWidthRaw && String(borderWidthRaw).trim().length > 0)
    );
    if (userBorderSet) {
      img.style.border = 'none';
    } else {
    img.style.border = '1px solid rgba(255,255,255,0.10)';
    }
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

    // Note: we intentionally avoid extra inline-wrap hint visuals (side fades).

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
    const figToolbar = createToolbarShell({
      outer: wrap,
      keepOpenKey: `figure:${this.from}:${this.to}`,
      className: 'cm-embedded-figure-toolbar',
      top: '8px',
      right: '8px',
      zIndex: '20',
      showMode: 'opacity',
      hideDelayMs: 120,
      style: {
        // Inside grid cells, the parent container can clip. Keep it within the card bounds.
        ...(this.opts?.inGrid
          ? { left: '6px', right: '6px', width: 'auto', maxWidth: 'calc(100% - 12px)' }
          : { maxWidth: '560px' }),
      },
    });
    const hoverBar = figToolbar.bar;
    const makeIconBtn = figToolbar.makeIconBtn;
    const makeDropdownGroup = figToolbar.makeDropdownGroup;

    // No row helper: we build one linear toolbar with separators.

    const applyAttrUpdate = (updates: {
      align?: string | null;
      width?: string | null;
      placement?: string | null;
      desc?: string | null;
      caption?: string | null;
      src?: string | null;
      borderStyle?: string | null;
      borderColor?: string | null;
      borderWidth?: number | null;
    }) => {
      const currentCaption = (updates.caption ?? this.alt ?? '').trim();
      const currentDesc = updates.desc ?? this.desc ?? '';
      const currentSrc = updates.src ?? this.rawUrl;
      const cleaned = stripAttrKeys(baseAttrs, ['align', 'width', 'placement', 'desc', 'borderStyle', 'borderColor', 'borderWidth']);
      let nextAttrs = cleaned;
      if (updates.align !== undefined) nextAttrs = upsertAttr(nextAttrs, 'align', updates.align);
      else if (align) nextAttrs = upsertAttr(nextAttrs, 'align', align);
      if (updates.width !== undefined) nextAttrs = upsertAttr(nextAttrs, 'width', updates.width);
      else if (width) nextAttrs = upsertAttr(nextAttrs, 'width', width);
      if (updates.placement !== undefined) nextAttrs = upsertAttr(nextAttrs, 'placement', updates.placement);
      else if (placement) nextAttrs = upsertAttr(nextAttrs, 'placement', placement);
      if (updates.borderStyle !== undefined) nextAttrs = upsertAttr(nextAttrs, 'borderStyle', updates.borderStyle);
      else if (borderStyleRaw) nextAttrs = upsertAttr(nextAttrs, 'borderStyle', borderStyleRaw);
      if (updates.borderColor !== undefined) nextAttrs = upsertAttr(nextAttrs, 'borderColor', updates.borderColor);
      else if (borderColorRaw) nextAttrs = upsertAttr(nextAttrs, 'borderColor', borderColorRaw);
      if (updates.borderWidth !== undefined)
        nextAttrs = upsertAttr(nextAttrs, 'borderWidth', updates.borderWidth === null ? null : String(Math.max(0, Math.round(updates.borderWidth))));
      else if (borderWidthRaw) nextAttrs = upsertAttr(nextAttrs, 'borderWidth', borderWidthRaw);
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
      borderSolid:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg>',
      borderDotted:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.5" stroke-dasharray="1.5 2"/>' +
        '</svg>',
      borderDashed:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2"/>' +
        '</svg>',
      borderNone:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.5"/>' +
        '<path d="M4 12L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      borderColor:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M3 13l1.2-4.2L11.7 1.3c.5-.5 1.3-.5 1.8 0l1.2 1.2c.5.5.5 1.3 0 1.8L7.2 11.8 3 13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<path d="M10.9 2.1l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      borderWidth:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M8 1v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M6.3 3.8L8 5.5l1.7-1.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<rect x="2.5" y="7" width="11" height="2" fill="currentColor"/>' +
        '<path d="M8 15v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M6.3 12.2L8 10.5l1.7 1.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
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

    // Compact group buttons (show current selection; click to open menu)
    const alignGroupBtn = makeIconBtn({
      label: 'Align',
      svg: currentAlign === 'center' ? icon.alignCenter : currentAlign === 'right' ? icon.alignRight : icon.alignLeft,
      selected: true,
    });
    const sizeGroupBtn = makeIconBtn({
      label: 'Size',
      svg: currentPct === 33 ? icon.sizeS : currentPct === 100 ? icon.sizeL : icon.sizeM,
      selected: true,
    });

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

    const placementGroupBtn = makeIconBtn({
      label: 'Placement',
      svg: currentPlacement === 'inline' ? icon.inline : icon.block,
      selected: true,
    });

    const curBw = Number.isFinite(borderWidthNum) && borderWidthNum >= 0 ? borderWidthNum : 1;
    const curBs = borderStyle;
    const borderStyleGroupBtn = makeIconBtn({
      label: 'Border style',
      svg: curBw === 0 ? icon.borderNone : curBs === 'dotted' ? icon.borderDotted : curBs === 'dashed' ? icon.borderDashed : icon.borderSolid,
      selected: true,
    });
    const borderWidthGroupBtn = makeIconBtn({ label: `Border width (${curBw}px)`, svg: icon.borderWidth, selected: true });
    const borderColorGroupBtn = makeIconBtn({ label: 'Border color', svg: icon.borderColor, selected: true });

    // Group: actions
    hoverBar.appendChild(btnEditIcon);
    if (btnRegenIcon) hoverBar.appendChild(btnRegenIcon);
    hoverBar.appendChild(btnTrashIcon);
    hoverBar.appendChild(makeToolbarSeparator());

    // Group: align (optional) – compact dropdown
    if (!this.opts?.hideAlign) {
      hoverBar.appendChild(
        makeDropdownGroup({
          label: 'Align',
          currentBtn: alignGroupBtn,
          items: [
            { label: 'Left', svg: icon.alignLeft, selected: currentAlign === 'left', onSelect: () => applyAttrUpdate({ align: 'left' }) },
            { label: 'Center', svg: icon.alignCenter, selected: currentAlign === 'center', onSelect: () => applyAttrUpdate({ align: 'center' }) },
            { label: 'Right', svg: icon.alignRight, selected: currentAlign === 'right', onSelect: () => applyAttrUpdate({ align: 'right' }) },
          ],
        })
      );
      hoverBar.appendChild(makeToolbarSeparator());
    }

    // Group: size – compact dropdown (includes +/-)
    hoverBar.appendChild(
      makeDropdownGroup({
        label: 'Size',
        currentBtn: sizeGroupBtn,
        items: [
          { label: 'Smaller (-10%)', svg: iconMinus, selected: false, onSelect: () => stepWidth(-stepPct) },
          { label: '33%', svg: icon.sizeS, selected: currentPct === 33, onSelect: () => applyAttrUpdate({ width: '33%' }) },
          { label: '50%', svg: icon.sizeM, selected: currentPct === 50, onSelect: () => applyAttrUpdate({ width: '50%' }) },
          { label: '100%', svg: icon.sizeL, selected: currentPct === 100, onSelect: () => applyAttrUpdate({ width: '100%' }) },
          { label: 'Larger (+10%)', svg: iconPlus, selected: false, onSelect: () => stepWidth(stepPct) },
        ],
      })
    );

    // Group: placement (optional) – compact dropdown
    if (!this.opts?.hidePlacement) {
      hoverBar.appendChild(makeToolbarSeparator());
      hoverBar.appendChild(
        makeDropdownGroup({
          label: 'Placement',
          currentBtn: placementGroupBtn,
          items: [
            { label: 'Inline', svg: icon.inline, selected: currentPlacement === 'inline', onSelect: () => applyAttrUpdate({ placement: 'inline' }) },
            { label: 'Block', svg: icon.block, selected: currentPlacement === 'block', onSelect: () => applyAttrUpdate({ placement: 'block' }) },
          ],
        })
      );
    }

    // Group: border (style/width/color)
    hoverBar.appendChild(makeToolbarSeparator());
    hoverBar.appendChild(
      makeDropdownGroup({
        label: 'Border style',
        currentBtn: borderStyleGroupBtn,
        items: [
          { label: 'None', svg: icon.borderNone, selected: curBw === 0, onSelect: () => applyAttrUpdate({ borderWidth: 0 }) },
          { label: 'Solid', svg: icon.borderSolid, selected: curBw > 0 && curBs === 'solid', onSelect: () => applyAttrUpdate({ borderStyle: 'solid', borderWidth: Math.max(1, curBw || 1) }) },
          { label: 'Dotted', svg: icon.borderDotted, selected: curBw > 0 && curBs === 'dotted', onSelect: () => applyAttrUpdate({ borderStyle: 'dotted', borderWidth: Math.max(1, curBw || 1) }) },
          { label: 'Dashed', svg: icon.borderDashed, selected: curBw > 0 && curBs === 'dashed', onSelect: () => applyAttrUpdate({ borderStyle: 'dashed', borderWidth: Math.max(1, curBw || 1) }) },
        ],
      })
    );
    hoverBar.appendChild(
      makeDropdownGroup({
        label: 'Border width',
        currentBtn: borderWidthGroupBtn,
        items: Array.from({ length: 9 }).map((_, i) => ({
          label: i === 0 ? '0 (none)' : `${i}px`,
          svg: icon.borderWidth,
          selected: curBw === i,
          onSelect: () => applyAttrUpdate({ borderWidth: i }),
        })),
      })
    );
    hoverBar.appendChild(
      makeDropdownGroup({
        label: 'Border color',
        currentBtn: borderColorGroupBtn,
        items: [],
        customBody: (container) => {
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '6px';

          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.gap = '8px';
          row.style.padding = '6px';
          row.style.borderRadius = '8px';
          row.style.border = '1px solid rgba(255,255,255,0.10)';
          row.style.background = 'rgba(0,0,0,0.12)';

          const isHex = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);

          const colorInput = document.createElement('input');
          colorInput.type = 'color';
          const currentHex = String(borderColor || '').trim();
          colorInput.value = isHex(currentHex) ? currentHex : '#6b7280';
          colorInput.style.width = '30px';
          colorInput.style.height = '22px';
          colorInput.style.border = 'none';
          colorInput.style.background = 'transparent';
          colorInput.style.padding = '0';

          const textInput = document.createElement('input');
          textInput.type = 'text';
          textInput.value = isHex(currentHex) ? currentHex.toLowerCase() : String(colorInput.value || '').trim().toLowerCase();
          textInput.placeholder = '#rrggbb';
          textInput.style.flex = '1';
          textInput.style.fontSize = '11px';
          textInput.style.background = 'transparent';
          textInput.style.border = 'none';
          textInput.style.outline = 'none';
          textInput.style.color = '#cfcfcf';

          const normalizeColor = (raw: string): string | null => {
            const s = String(raw || '').trim();
            if (!s) return null;
            const withHash = s.startsWith('#') ? s : `#${s}`;
            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash)) return withHash.toLowerCase();
            return s;
          };

          const apply = () => {
            const next = normalizeColor(textInput.value);
            applyAttrUpdate({ borderColor: next });
            if (next) colorInput.value = next;
          };

          colorInput.addEventListener('input', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const v = String(colorInput.value || '').trim();
            textInput.value = v;
            applyAttrUpdate({ borderColor: normalizeColor(v) });
          });
          textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              apply();
              textInput.blur();
            }
          });
          textInput.addEventListener('blur', () => apply());

          row.appendChild(colorInput);
          row.appendChild(textInput);
          container.appendChild(row);
        },
      })
    );

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
          figToolbar.setPinned(Boolean(v));
        },
        onClose: () => {
          figToolbar.setPinned(false);
        },
        getOriginal: () => ({ from: this.from, to: this.to, text: view.state.doc.sliceString(this.from, this.to) }),
        applyReplacement: (replacement) => {
          view.dispatch({ changes: { from: this.from, to: this.to, insert: replacement } });
        },
      })
    );
    wrap.appendChild(hoverBar);

    // Always-visible "Show XMD" toggle (top-left), unless we're inside a grid cell (grid has its own toggle).
    if (!this.opts?.inGrid) {
      const btnShowXmd = document.createElement('button');
      btnShowXmd.type = 'button';
      btnShowXmd.textContent = 'Show XMD';
      btnShowXmd.className =
        'text-xs px-2 py-1 rounded border border-vscode-border bg-vscode-buttonBg text-vscode-text ' +
        'hover:bg-vscode-buttonHoverBg transition-colors';
      btnShowXmd.style.position = 'absolute';
      btnShowXmd.style.top = '8px';
      btnShowXmd.style.left = '8px';
      btnShowXmd.style.zIndex = '25';
      btnShowXmd.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        view.dispatch({ effects: toggleRenderForRange.of({ from: this.from, to: this.to }) });
      });
      wrap.appendChild(btnShowXmd);
    }

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
    private readonly headerText: string,
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
    if (this.headerText !== other.headerText) return false;
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

    // Keep the toolbar open across re-renders triggered by selecting an option (which updates the header).
    // Without this, the widget is recreated and the toolbar "autocloses" even if the mouse is still over it.
    // (Module-level so it survives widget recreation.)
    const spacing = (() => {
      const currentHeader = this.headerText;
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
    // Grid border styling (optional): allow table-like attrs on the grid header.
    // When border attrs are provided, we render borders in a "table-like" collapsed way (like preview),
    // avoiding doubled inner strokes from adjacent div borders.
    const gridBorderInfo = (() => {
      try {
        const h = this.headerText;
        const styleMatch = /\bborderStyle\s*=\s*"(solid|dotted|dashed)"/i.exec(h);
        const colorMatch = /\bborderColor\s*=\s*"([^"]*)"/i.exec(h);
        const widthMatch = /\bborderWidth\s*=\s*"(\d+)"/i.exec(h);
        const styleRaw = (styleMatch?.[1] || '').toLowerCase();
        const borderStyle = styleRaw === 'dotted' ? 'dotted' : styleRaw === 'dashed' ? 'dashed' : 'solid';
        const color = (colorMatch?.[1] || '').trim();
        const widthRaw = (widthMatch?.[1] || '').trim();
        const width = widthRaw ? Number(widthRaw) : NaN;
        const explicitlySet = Boolean(styleMatch || colorMatch || widthMatch);
        if (Number.isFinite(width) && width === 0) return { enabled: false, css: 'none', w: 0, style: borderStyle, color: color || '' };
        const w = Number.isFinite(width) && width > 0 ? Math.round(width) : 1;
        const c = color || 'rgba(255,255,255,0.10)';
        const css = `${w}px ${borderStyle} ${c}`;
        // If user set any border-related attribute, treat as "border mode" even if width omitted.
        // This makes the editor match preview's table-like feel.
        return { enabled: explicitlySet, css, w, style: borderStyle, color: c };
      } catch {
        return { enabled: false, css: '1px solid rgba(255,255,255,0.10)', w: 1, style: 'solid' as const, color: 'rgba(255,255,255,0.10)' };
      }
    })();
    // In borderMode, don't add an extra rounded outer frame; let the cell borders form the table outline (like preview).
    const borderMode = gridBorderInfo.enabled && gridBorderInfo.css !== 'none';
    outer.style.padding = borderMode ? '0px' : `${spacing.pad}px`;
    outer.style.border = borderMode ? 'none' : gridBorderInfo.css;
    outer.style.borderRadius = borderMode ? '0px' : '10px';
    outer.style.background = borderMode ? 'transparent' : 'rgba(0,0,0,0.10)';
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

    const parseGridHeader = (s: string): {
      cols: number;
      caption: string | null;
      label: string | null;
      borderStyle: 'solid' | 'dotted' | 'dashed' | null;
      borderColor: string | null;
      borderWidth: number | null;
      align: 'left' | 'center' | 'right' | null;
      placement: 'block' | 'inline' | null;
      margin: 'small' | 'medium' | 'large' | null;
    } => {
      const txt = String(s ?? '').trim();
      const colsMatch = /\bcols\s*=\s*(\d+)\b/i.exec(txt);
      const cols = colsMatch ? Number(colsMatch[1]) : 0;
      const capMatch = /\bcaption\s*=\s*"([^"]*)"/i.exec(txt);
      const caption = capMatch ? String(capMatch[1] ?? '').trim() : null;
      const labelMatch = /\blabel\s*=\s*"([^"]*)"/i.exec(txt);
      const label = labelMatch ? String(labelMatch[1] ?? '').trim() : null;
      const borderStyleMatch = /\bborderStyle\s*=\s*"(solid|dotted|dashed)"/i.exec(txt);
      const borderStyle = (borderStyleMatch ? (String(borderStyleMatch[1]) as any) : null) as
        | 'solid'
        | 'dotted'
        | 'dashed'
        | null;
      const borderColorMatch = /\bborderColor\s*=\s*"([^"]*)"/i.exec(txt);
      const borderColor = borderColorMatch ? String(borderColorMatch[1] ?? '').trim() : null;
      const borderWidthMatch = /\bborderWidth\s*=\s*"(\d+)"/i.exec(txt);
      const borderWidth = borderWidthMatch ? Number(borderWidthMatch[1]) : null;
      const alignMatch = /\balign\s*=\s*"(left|center|right)"/i.exec(txt);
      const align = (alignMatch ? (String(alignMatch[1]) as any) : null) as 'left' | 'center' | 'right' | null;
      const placeMatch = /\bplacement\s*=\s*"(block|inline)"/i.exec(txt);
      const placement = (placeMatch ? (String(placeMatch[1]) as any) : null) as 'block' | 'inline' | null;
      const marginMatch = /\bmargin\s*=\s*"(small|medium|large)"/i.exec(txt);
      const margin = (marginMatch ? (String(marginMatch[1]) as any) : null) as 'small' | 'medium' | 'large' | null;
      return { cols, caption, label, borderStyle, borderColor, borderWidth: Number.isFinite(borderWidth) ? borderWidth : null, align, placement, margin };
    };

    const buildGridHeader = (attrs: {
      cols: number;
      caption: string | null;
      label: string | null;
      borderStyle: 'solid' | 'dotted' | 'dashed' | null;
      borderColor: string | null;
      borderWidth: number | null;
      align: 'left' | 'center' | 'right' | null;
      placement: 'block' | 'inline' | null;
      margin: 'small' | 'medium' | 'large' | null;
    }): string => {
      const parts: string[] = [];
      const cols = Number.isFinite(attrs.cols) && attrs.cols > 0 ? attrs.cols : Math.max(1, this.cols);
      parts.push(`cols=${cols}`);
      const cap = String(attrs.caption ?? '').trim();
      if (cap.length > 0) parts.push(`caption="${cap.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim()}"`);
      const label = String(attrs.label ?? '').trim();
      if (label.length > 0) parts.push(`label="${label.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim()}"`);
      if (attrs.borderStyle) parts.push(`borderStyle="${attrs.borderStyle}"`);
      const bc = String(attrs.borderColor ?? '').trim();
      if (bc.length > 0) parts.push(`borderColor="${bc.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim()}"`);
      // Allow borderWidth="0" to mean "no border" explicitly.
      if (Number.isFinite(attrs.borderWidth) && (attrs.borderWidth as number) >= 0) parts.push(`borderWidth="${Math.round(attrs.borderWidth as number)}"`);
      if (attrs.align) parts.push(`align="${attrs.align}"`);
      if (attrs.placement) parts.push(`placement="${attrs.placement}"`);
      if (attrs.margin) parts.push(`margin="${attrs.margin}"`);
      return `::: ${parts.join(' ')}`.trimEnd();
    };

    const updateGridHeader = (
      updates: Partial<{
        caption: string | null;
        label: string | null;
        borderStyle: 'solid' | 'dotted' | 'dashed' | null;
        borderColor: string | null;
        borderWidth: number | null;
        align: 'left' | 'center' | 'right' | null;
        placement: 'block' | 'inline' | null;
        margin: 'small' | 'medium' | 'large' | null;
      }>
    ) => {
      try {
        const currentHeader = view.state.doc.sliceString(this.headerFrom, this.headerTo);
        const parsed = parseGridHeader(currentHeader);
        const next = buildGridHeader({
          cols: parsed.cols || this.cols,
          caption: updates.caption !== undefined ? updates.caption : parsed.caption,
          label: updates.label !== undefined ? updates.label : parsed.label,
          borderStyle: updates.borderStyle !== undefined ? updates.borderStyle : parsed.borderStyle,
          borderColor: updates.borderColor !== undefined ? updates.borderColor : parsed.borderColor,
          borderWidth: updates.borderWidth !== undefined ? updates.borderWidth : parsed.borderWidth,
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
    const toolbar = createToolbarShell({
      outer,
      keepOpenKey: `grid:${this.blockFrom}:${this.blockTo}`,
      className: 'cm-embedded-grid-toolbar',
      // Keep the hover toolbar below the always-visible "Show XMD" button area.
      top: '44px',
      right: '8px',
      zIndex: '4',
      showMode: 'visibility',
      style: {
    // Linear toolbar that wraps only if it becomes too wide.
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
      },
    });
    const hoverBar = toolbar.bar;
    const makeIconBtn = toolbar.makeIconBtn;
    const makeSep = toolbar.makeSep;

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
      borderSolid:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg>',
      borderDotted:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.5" stroke-dasharray="1.5 2"/>' +
        '</svg>',
      borderDashed:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2"/>' +
        '</svg>',
      borderColor:
        // Pencil icon (border color)
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M3 13l1.2-4.2L11.7 1.3c.5-.5 1.3-.5 1.8 0l1.2 1.2c.5.5.5 1.3 0 1.8L7.2 11.8 3 13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<path d="M10.9 2.1l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M4.1 8.9l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M6.1 10.1l4.9-4.9" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.55"/>' +
        '</svg>',
      borderWidth:
        // Border thickness icon (arrows squeezing a bar)
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M8 1v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M6.3 3.8L8 5.5l1.7-1.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<rect x="2.5" y="7" width="11" height="2" fill="currentColor"/>' +
        '<path d="M8 15v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M6.3 12.2L8 10.5l1.7 1.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>',
      borderNone:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.5"/>' +
        '<path d="M4 12L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>',
      marginS:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
        '<mask id="m-s"><rect x="0" y="0" width="16" height="16" fill="white"/><rect x="4.5" y="4.5" width="7" height="7" fill="black"/></mask>' +
        '</defs>' +
        '<g mask="url(#m-s)">' +
        // diagonal hatch
        '<path d="M-2 4L4 -2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M-2 8L8 -2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M-2 12L12 -2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M-2 16L16 -2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M2 16L16 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M6 16L16 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M10 16L16 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M14 16L16 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</g>' +
        // inner "content" box
        '<rect x="4.5" y="4.5" width="7" height="7" stroke="currentColor" stroke-width="1.4"/>' +
        '</svg>',
      marginM:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
        '<mask id="m-m"><rect x="0" y="0" width="16" height="16" fill="white"/><rect x="5.5" y="5.5" width="5" height="5" fill="black"/></mask>' +
        '</defs>' +
        '<g mask="url(#m-m)">' +
        '<path d="M-2 4L4 -2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M-2 8L8 -2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M-2 12L12 -2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M-2 16L16 -2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M2 16L16 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M6 16L16 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M10 16L16 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M14 16L16 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</g>' +
        '<rect x="5.5" y="5.5" width="5" height="5" stroke="currentColor" stroke-width="1.8"/>' +
        '</svg>',
      marginL:
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
        '<mask id="m-l"><rect x="0" y="0" width="16" height="16" fill="white"/><rect x="6.5" y="6.5" width="3" height="3" fill="black"/></mask>' +
        '</defs>' +
        '<g mask="url(#m-l)">' +
        '<path d="M-2 4L4 -2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M-2 8L8 -2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M-2 12L12 -2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M-2 16L16 -2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M2 16L16 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M6 16L16 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M10 16L16 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M14 16L16 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</g>' +
        '<rect x="6.5" y="6.5" width="3" height="3" stroke="currentColor" stroke-width="2.2"/>' +
        '</svg>',
    };

    const currentHeader = view.state.doc.sliceString(this.headerFrom, this.headerTo);
    const parsed = parseGridHeader(currentHeader);
    const currentAlign = parsed.align ?? 'left';
    const currentPlacement = parsed.placement ?? 'block';
    const currentMargin = parsed.margin ?? 'medium';

    const btnEdit = makeIconBtn({ label: 'Edit grid caption', svg: icon.edit });
    // In Cursor/Next sandbox environments, window.prompt() is not supported.
    // Use an inline editor popover instead.
    let inlineEditorEl: HTMLDivElement | null = null;
    const openInlineEditor = (opts: { title: string; initial: string; placeholder: string; onApply: (value: string) => void }) => {
      try {
        if (inlineEditorEl) {
          inlineEditorEl.remove();
          inlineEditorEl = null;
        }
        const panel = document.createElement('div');
        inlineEditorEl = panel;
        panel.style.position = 'absolute';
        panel.style.left = '8px';
        panel.style.top = '44px';
        panel.style.zIndex = '5';
        panel.style.padding = '8px';
        panel.style.borderRadius = '10px';
        panel.style.border = '1px solid rgba(255,255,255,0.10)';
        panel.style.background = 'rgba(20,20,22,0.96)';
        panel.style.backdropFilter = 'blur(6px)';
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.gap = '6px';
        panel.style.minWidth = '260px';
        panel.style.maxWidth = '520px';

        const title = document.createElement('div');
        title.textContent = opts.title;
        title.style.fontSize = '11px';
        title.style.color = '#9aa0a6';
        panel.appendChild(title);

        const input = document.createElement('input');
        input.type = 'text';
        input.value = opts.initial ?? '';
        input.placeholder = opts.placeholder;
        input.className = 'bg-vscode-editorWidgetBg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text';
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Escape') {
            ev.preventDefault();
            panel.remove();
            inlineEditorEl = null;
            return;
          }
          if (ev.key === 'Enter') {
            ev.preventDefault();
            opts.onApply(String(input.value ?? '').trim());
            panel.remove();
            inlineEditorEl = null;
            return;
          }
        });
        panel.appendChild(input);

        const hint = document.createElement('div');
        hint.textContent = 'Enter to apply • Esc to cancel';
        hint.style.fontSize = '11px';
        hint.style.color = '#6b7280';
        panel.appendChild(hint);

        // Prevent CodeMirror interactions.
        panel.addEventListener('pointerdown', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
        });

        outer.appendChild(panel);
        // Focus next tick so DOM is attached.
        setTimeout(() => {
          try {
            input.focus();
            input.select();
          } catch {
            // ignore
          }
        }, 0);
      } catch {
        // ignore
      }
    };

    btnEdit.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cur = parseGridHeader(view.state.doc.sliceString(this.headerFrom, this.headerTo));
      openInlineEditor({
        title: 'Grid caption',
        initial: cur.caption ?? '',
        placeholder: 'Caption (optional)',
        onApply: (v) => updateGridHeader({ caption: v || null }),
      });
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

    // Border controls (style + color + width)
    const curBorderStyle = parsed.borderStyle ?? 'solid';
    const curBorderWidth =
      Number.isFinite(parsed.borderWidth) && (parsed.borderWidth as number) >= 0 ? (parsed.borderWidth as number) : 1;
    const btnBorderSolid = makeIconBtn({ label: 'Border: solid', svg: icon.borderSolid, selected: curBorderStyle === 'solid' });
    const btnBorderDotted = makeIconBtn({ label: 'Border: dotted', svg: icon.borderDotted, selected: curBorderStyle === 'dotted' });
    const btnBorderDashed = makeIconBtn({ label: 'Border: dashed', svg: icon.borderDashed, selected: curBorderStyle === 'dashed' });
    btnBorderSolid.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); updateGridHeader({ borderStyle: 'solid' }); });
    btnBorderDotted.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); updateGridHeader({ borderStyle: 'dotted' }); });
    btnBorderDashed.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); updateGridHeader({ borderStyle: 'dashed' }); });

    const btnBorderNone = makeIconBtn({ label: 'No border', svg: icon.borderNone, selected: curBorderWidth === 0 });
    btnBorderNone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateGridHeader({ borderWidth: 0 });
    });

    const iconMinus =
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M3.5 8h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
    const iconPlus =
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M8 3.5v9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M3.5 8h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
    const btnBorderWLess = makeIconBtn({ label: `Border width - (now ${curBorderWidth}px)`, svg: iconMinus });
    const btnBorderWMore = makeIconBtn({ label: `Border width + (now ${curBorderWidth}px)`, svg: iconPlus });
    const clampW = (n: number) => Math.max(0, Math.min(8, Math.round(n)));
    btnBorderWLess.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const cur = parseGridHeader(view.state.doc.sliceString(this.headerFrom, this.headerTo));
      const w = Number.isFinite(cur.borderWidth) && (cur.borderWidth as number) >= 0 ? (cur.borderWidth as number) : 1;
      updateGridHeader({ borderWidth: clampW(w - 1) });
    });
    btnBorderWMore.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const cur = parseGridHeader(view.state.doc.sliceString(this.headerFrom, this.headerTo));
      const w = Number.isFinite(cur.borderWidth) && (cur.borderWidth as number) >= 0 ? (cur.borderWidth as number) : 1;
      updateGridHeader({ borderWidth: clampW(w + 1) });
    });

    const makeDropdownGroup = toolbar.makeDropdownGroup;

    const alignGroupBtn = makeIconBtn({
      label: 'Align',
      svg: currentAlign === 'center' ? icon.alignCenter : currentAlign === 'right' ? icon.alignRight : icon.alignLeft,
      selected: true,
    });
    const placementGroupBtn = makeIconBtn({
      label: 'Placement',
      svg: currentPlacement === 'inline' ? icon.inline : icon.block,
      selected: true,
    });
    const marginGroupBtn = makeIconBtn({
      label: 'Margin',
      svg: currentMargin === 'small' ? icon.marginS : currentMargin === 'large' ? icon.marginL : icon.marginM,
      selected: true,
    });
    const borderStyleGroupBtn = makeIconBtn({
      label: 'Border style',
      svg: curBorderWidth === 0 ? icon.borderNone : curBorderStyle === 'dotted' ? icon.borderDotted : curBorderStyle === 'dashed' ? icon.borderDashed : icon.borderSolid,
      selected: true,
    });
    const borderWidthGroupBtn = makeIconBtn({ label: `Border width (${curBorderWidth}px)`, svg: icon.borderWidth, selected: true });
    const borderColorGroupBtn = makeIconBtn({ label: 'Border color', svg: icon.borderColor, selected: true });

    // Group: basic
    hoverBar.appendChild(btnEdit);
    hoverBar.appendChild(makeSep());
    hoverBar.appendChild(
      makeDropdownGroup({
        label: 'Align',
        currentBtn: alignGroupBtn,
        items: [
          { label: 'Left', svg: icon.alignLeft, selected: currentAlign === 'left', onSelect: () => updateGridHeader({ align: 'left' }) },
          { label: 'Center', svg: icon.alignCenter, selected: currentAlign === 'center', onSelect: () => updateGridHeader({ align: 'center' }) },
          { label: 'Right', svg: icon.alignRight, selected: currentAlign === 'right', onSelect: () => updateGridHeader({ align: 'right' }) },
        ],
      })
    );
    hoverBar.appendChild(
      makeDropdownGroup({
        label: 'Placement',
        currentBtn: placementGroupBtn,
        items: [
          { label: 'Inline', svg: icon.inline, selected: currentPlacement === 'inline', onSelect: () => updateGridHeader({ placement: 'inline' }) },
          { label: 'Block', svg: icon.block, selected: currentPlacement === 'block', onSelect: () => updateGridHeader({ placement: 'block' }) },
        ],
      })
    );
    hoverBar.appendChild(
      makeDropdownGroup({
        label: 'Margin',
        currentBtn: marginGroupBtn,
        items: [
          { label: 'Small', svg: icon.marginS, selected: currentMargin === 'small', onSelect: () => updateGridHeader({ margin: 'small' }) },
          { label: 'Medium', svg: icon.marginM, selected: currentMargin === 'medium', onSelect: () => updateGridHeader({ margin: 'medium' }) },
          { label: 'Large', svg: icon.marginL, selected: currentMargin === 'large', onSelect: () => updateGridHeader({ margin: 'large' }) },
        ],
      })
    );
    hoverBar.appendChild(makeSep());
    hoverBar.appendChild(
      makeDropdownGroup({
        label: 'Border style',
        currentBtn: borderStyleGroupBtn,
        items: [
          { label: 'None', svg: icon.borderNone, selected: curBorderWidth === 0, onSelect: () => updateGridHeader({ borderWidth: 0 }) },
          { label: 'Solid', svg: icon.borderSolid, selected: curBorderWidth > 0 && curBorderStyle === 'solid', onSelect: () => updateGridHeader({ borderStyle: 'solid', borderWidth: Math.max(1, curBorderWidth || 1) }) },
          { label: 'Dotted', svg: icon.borderDotted, selected: curBorderWidth > 0 && curBorderStyle === 'dotted', onSelect: () => updateGridHeader({ borderStyle: 'dotted', borderWidth: Math.max(1, curBorderWidth || 1) }) },
          { label: 'Dashed', svg: icon.borderDashed, selected: curBorderWidth > 0 && curBorderStyle === 'dashed', onSelect: () => updateGridHeader({ borderStyle: 'dashed', borderWidth: Math.max(1, curBorderWidth || 1) }) },
        ],
      })
    );
    hoverBar.appendChild(
      makeDropdownGroup({
        label: 'Border width',
        currentBtn: borderWidthGroupBtn,
        items: Array.from({ length: 9 }).map((_, i) => ({
          label: i === 0 ? '0 (none)' : `${i}px`,
          svg: icon.borderWidth,
          selected: curBorderWidth === i,
          onSelect: () => updateGridHeader({ borderWidth: i }),
        })),
      })
    );
    hoverBar.appendChild(
      makeDropdownGroup({
        label: 'Border color',
        currentBtn: borderColorGroupBtn,
        items: [],
        customBody: (container) => {
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '6px';
          const cur = parseGridHeader(view.state.doc.sliceString(this.headerFrom, this.headerTo));

          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.gap = '8px';
          row.style.padding = '6px';
          row.style.borderRadius = '8px';
          row.style.border = '1px solid rgba(255,255,255,0.10)';
          row.style.background = 'rgba(0,0,0,0.12)';

          const isHex = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);

          const colorInput = document.createElement('input');
          colorInput.type = 'color';
          const currentHex = (cur.borderColor || '').trim();
          colorInput.value = isHex(currentHex) ? currentHex : '#6b7280';
          colorInput.style.width = '30px';
          colorInput.style.height = '22px';
          colorInput.style.border = 'none';
          colorInput.style.background = 'transparent';
          colorInput.style.padding = '0';

          const textInput = document.createElement('input');
          textInput.type = 'text';
          // Default to HEX so users can just type/paste.
          // If the existing borderColor isn't a hex value, use the current palette color.
          textInput.value = isHex(currentHex) ? currentHex.toLowerCase() : String(colorInput.value || '').trim().toLowerCase();
          textInput.placeholder = '#rrggbb';
          textInput.style.flex = '1';
          textInput.style.fontSize = '11px';
          textInput.style.background = 'transparent';
          textInput.style.border = 'none';
          textInput.style.outline = 'none';
          textInput.style.color = '#cfcfcf';

          const normalizeColor = (raw: string): string | null => {
            const s = String(raw || '').trim();
            if (!s) return null;
            // Accept hex (with or without '#') and normalize it; otherwise keep any CSS color string (e.g. "gray", "rgb(...)").
            const withHash = s.startsWith('#') ? s : `#${s}`;
            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash)) return withHash.toLowerCase();
            return s;
          };
          const apply = () => {
            const next = normalizeColor(textInput.value);
            updateGridHeader({ borderColor: next });
            if (next) colorInput.value = next;
          };

          colorInput.addEventListener('input', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const v = String(colorInput.value || '').trim();
            textInput.value = v;
            updateGridHeader({ borderColor: normalizeColor(v) });
          });
          textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              apply();
              textInput.blur();
            }
          });
          textInput.addEventListener('blur', () => apply());

          row.appendChild(colorInput);
          row.appendChild(textInput);
          container.appendChild(row);
        },
      })
    );

    // Show/hide behavior comes from the shared toolbar shell.

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
          toolbar.setPinned(Boolean(v));
        },
        onClose: () => {
          toolbar.setPinned(false);
        },
        getOriginal: () => ({ from: this.blockFrom, to: this.blockTo, text: view.state.doc.sliceString(this.blockFrom, this.blockTo) }),
        applyReplacement: (replacement) => {
          view.dispatch({ changes: { from: this.blockFrom, to: this.blockTo, insert: replacement } });
        },
      })
    );
    outer.appendChild(hoverBar);

    // Always-visible "Show XMD" button (top-left). Keep it even though we also provide a toolbar toggle
    // so the user always has a stable, discoverable switch.
    const btnShowXmdFixed = document.createElement('button');
    btnShowXmdFixed.type = 'button';
    btnShowXmdFixed.textContent = 'Show XMD';
    btnShowXmdFixed.className =
      'text-xs px-2 py-1 rounded border border-vscode-border bg-vscode-buttonBg text-vscode-text ' +
      'hover:bg-vscode-buttonHoverBg transition-colors';
    btnShowXmdFixed.style.position = 'absolute';
    btnShowXmdFixed.style.top = '8px';
    btnShowXmdFixed.style.left = '8px';
    btnShowXmdFixed.style.zIndex = '6';
    btnShowXmdFixed.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: toggleRenderForRange.of({ from: this.blockFrom, to: this.blockTo }) });
    });
    outer.appendChild(btnShowXmdFixed);

    const cap = String(this.gridCaption ?? '').trim();
    if (cap.length > 0) {
      const capEl = document.createElement('div');
      capEl.textContent = cap;
      // Keep caption from sitting under the top-left button / toolbar strip.
      capEl.style.marginTop = '26px';
      capEl.style.marginBottom = `${spacing.capMb}px`;
      capEl.style.fontSize = '12px';
      capEl.style.color = '#9aa0a6';
      capEl.style.fontStyle = 'italic';
      capEl.style.textAlign = 'center';
      outer.appendChild(capEl);
    } else {
      // Even without caption, reserve a small top strip so content doesn't sit under the button.
      const spacer = document.createElement('div');
      spacer.style.height = '26px';
      outer.appendChild(spacer);
    }

    // Note: we intentionally avoid any extra "placement hint" outlines here.
    // The grid should only show borders the user explicitly sets (borderStyle/borderColor/borderWidth).

    const gridWrap = document.createElement('div');
    const placementNow = (() => {
      try {
        const h = this.headerText;
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
    // In borderMode, remove gaps so borders read like a collapsed table (preview).
    grid.style.gap = borderMode ? '0px' : `${spacing.gap}px`;

    for (let i = 0; i < this.cells.length; i++) {
      const cell = document.createElement('div');
      if (borderMode) {
        // Table-like borders without doubled inner strokes:
        // draw only top+left for all cells, plus right for last column and bottom for last row.
        const cols = Math.max(1, this.cols);
        const rows = Math.max(1, Math.ceil(this.cells.length / cols));
        const r = Math.floor(i / cols);
        const c = i % cols;
        const b = gridBorderInfo.css;
        cell.style.border = 'none';
        cell.style.borderLeft = b;
        cell.style.borderTop = b;
        if (c === cols - 1) cell.style.borderRight = b;
        if (r === rows - 1) cell.style.borderBottom = b;
        cell.style.borderRadius = '0px';
        // Match preview-ish padding
        cell.style.padding = '6px 10px';
        cell.style.background = 'transparent';
      } else {
        cell.style.border = gridBorderInfo.css.replace('0.10', '0.08'); // slightly lighter default if using rgba defaults
      cell.style.borderRadius = '8px';
      cell.style.padding = `${spacing.cellPad}px`;
      cell.style.background = 'rgba(0,0,0,0.12)';
      }
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

    // IMPORTANT:
    // This extension started as an "embedded image preview" extension, but it now also renders
    // grids and tables. Don't early-exit unless we truly have nothing to do.
    const maybeHasEmbeddables =
      text.includes('data:image/') ||
      text.includes('zadoox-asset://') ||
      text.includes(':::') ||
      text.includes('|L') ||
      text.includes('|C') ||
      text.includes('|R');
    if (!maybeHasEmbeddables) {
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

    const parseFenceBlocks = (raw: string): Array<{ from: number; to: number }> => {
      const blocks: Array<{ from: number; to: number }> = [];
      const startRe = /^:::\s*(.*?)$/gm;
      let m: RegExpExecArray | null;
      while ((m = startRe.exec(raw))) {
        const start = m.index;
        const closeRe = /^(?:\s*:::\s*$|.*?:::\s*$)/gm;
        closeRe.lastIndex = startRe.lastIndex;
        let close = closeRe.exec(raw);
        while (close) {
          const line = String(close[0] ?? '');
          const t = line.trim();
          const isOpening = t.startsWith(':::') && t !== ':::';
          if (!isOpening) break;
          close = closeRe.exec(raw);
        }
        if (!close) continue;
        const end = close.index + close[0].length;
        blocks.push({ from: start, to: Math.min(end, doc.length) });
        startRe.lastIndex = end;
      }
      return blocks;
    };

    // Any ::: ... ::: fenced directive should be treated as an atomic "surface":
    // either the entire block is rendered by its own widget (grid/table), or nothing inside is rendered.
    // This prevents partially-rendered/mixed states when the fence is malformed or toggled to show XMD.
    const fenceBlocks = parseFenceBlocks(text);
    const isInFence = (pos: number) => fenceBlocks.some((b) => pos >= b.from && pos < b.to);

    const parseTableRuleLine = (line: string): TableRule | null => {
      const t = String(line ?? '').trim();
      if (t === '.') return 'none';
      if (t === '-') return 'single';
      if (t === '=') return 'double';
      return null;
    };

    const parseTableColSpec = (line: string): { colAlign: TableAlign[]; vRules: TableRule[] } | null => {
      const raw = String(line ?? '').trim();
      if (!raw) return null;
      if (!/^[|LCRlcr]+$/.test(raw)) return null;
      const colAlign: TableAlign[] = [];
      const vRules: TableRule[] = [];
      let i = 0;
      const readBars = (): TableRule => {
        let count = 0;
        while (i < raw.length && raw[i] === '|') {
          count++;
          i++;
        }
        if (count >= 2) return 'double';
        if (count === 1) return 'single';
        return 'none';
      };
      vRules.push(readBars());
      while (i < raw.length) {
        const ch = raw[i]!;
        const letter = ch.toUpperCase();
        if (letter !== 'L' && letter !== 'C' && letter !== 'R') return null;
        colAlign.push(letter === 'L' ? 'left' : letter === 'C' ? 'center' : 'right');
        i++;
        vRules.push(readBars());
      }
      if (colAlign.length === 0) return null;
      while (vRules.length < colAlign.length + 1) vRules.push('none');
      if (vRules.length > colAlign.length + 1) vRules.length = colAlign.length + 1;
      return { colAlign, vRules };
    };

    const parseXmdTableBlocks = (raw: string): XmdTableBlock[] => {
      const blocks: XmdTableBlock[] = [];
      const startRe = /^:::\s*(.*?)$/gm;
      let m: RegExpExecArray | null;
      while ((m = startRe.exec(raw))) {
        const header = String(m[1] || '').trim();
        // Don't treat grids as tables (grids must have cols=...).
        if (/\bcols\s*=\s*\d+\b/.test(header) || /\bcolumns\s*=\s*\d+\b/.test(header)) continue;

        // Find the closing ::: after this header.
        const start = m.index;
        const closeRe = /^(?:\s*:::\s*$|.*?:::\s*$)/gm;
        closeRe.lastIndex = startRe.lastIndex;
        let close = closeRe.exec(raw);
        while (close) {
          const line = String(close[0] ?? '');
          const t = line.trim();
          const isOpening = t.startsWith(':::') && t !== ':::';
          if (!isOpening) break;
          close = closeRe.exec(raw);
        }
        if (!close) continue;
        const end = close.index + close[0].length;

        const inner = raw.slice(startRe.lastIndex, close.index);
        const innerLines = inner.split('\n').map((l) => String(l ?? ''));
        let idx = 0;
        while (idx < innerLines.length && innerLines[idx]!.trim().length === 0) idx++;
        const colSpecLine = idx < innerLines.length ? innerLines[idx]! : '';
        const colSpec = parseTableColSpec(colSpecLine);
        if (!colSpec) {
          // Not a table; likely another directive.
          startRe.lastIndex = end;
          continue;
        }
        idx++;

        const parseAttr = (key: string): string | null => {
          const re = new RegExp(`\\b${key}\\s*=\\s*\"([^\"]*)\"`, 'i');
          const mm = re.exec(header);
          return mm ? String(mm[1] ?? '') : null;
        };
        const caption = parseAttr('caption');
        const label = parseAttr('label');
        const borderStyleRaw = (parseAttr('borderStyle') || '').trim().toLowerCase();
        const borderStyle: TableBorderStyle =
          borderStyleRaw === 'dotted' ? 'dotted' : borderStyleRaw === 'dashed' ? 'dashed' : 'solid';
        const borderColor = (parseAttr('borderColor') || '').trim();
        const borderWidthRaw = (parseAttr('borderWidth') || '').trim();
        const borderWidthPx = borderWidthRaw ? Number(borderWidthRaw) : NaN;
        const style =
          borderColor || (Number.isFinite(borderWidthPx) && borderWidthPx > 0) || borderStyleRaw
            ? {
                borderStyle,
                borderColor: borderColor || 'rgba(255,255,255,0.16)',
                borderWidthPx: Number.isFinite(borderWidthPx) && borderWidthPx > 0 ? Math.round(borderWidthPx) : 1,
              }
            : null;

        let pendingRule: TableRule = 'none';
        let topRule: TableRule = 'none';
        const beforeRowRules: Record<number, TableRule> = {};
        let headerRow: string[] | null = null;
        const rows: string[][] = [];
        let sawSep = false;

        const applyPendingToNextRow = (rowIndex: number) => {
          if (rowIndex === 0) topRule = pendingRule;
          else beforeRowRules[rowIndex] = pendingRule;
          pendingRule = 'none';
        };

        for (; idx < innerLines.length; idx++) {
          const ln = innerLines[idx]!;
          if (ln.trim().length === 0) continue;
          const rule = parseTableRuleLine(ln);
          if (rule) {
            pendingRule = rule;
            continue;
          }
          const row = parsePipeRow(ln);
          if (!row) continue;
          if (headerRow && !sawSep && isSeparatorRow(ln)) {
            sawSep = true;
            continue;
          }
          if (!headerRow) {
            headerRow = row;
            applyPendingToNextRow(0);
            continue;
          }
          const rowIndex = 1 + rows.length;
          applyPendingToNextRow(rowIndex);
          rows.push(row);
        }
        const bottomRule = pendingRule;

        if (!headerRow) {
          startRe.lastIndex = end;
          continue;
        }

        const cols = headerRow.length;
        const totalRows = 1 + rows.length;
        const hRules: TableRule[] = Array.from({ length: totalRows + 1 }).map(() => 'none');
        hRules[0] = topRule;
        for (const [k, v] of Object.entries(beforeRowRules)) {
          const n = Number(k);
          if (Number.isFinite(n) && n >= 1 && n <= totalRows) hRules[n] = v;
        }
        hRules[totalRows] = bottomRule;

        blocks.push({
          from: start,
          to: Math.min(end, doc.length),
          caption: caption ? caption.trim() : null,
          label: label ? label.trim() : null,
          header: headerRow,
          rows,
          colAlign: colSpec.colAlign,
          vRules: colSpec.vRules,
          hRules,
          style,
        });

        startRe.lastIndex = end;
      }
      return blocks;
    };

    const xmdTableBlocks = parseXmdTableBlocks(text);
    const isInXmdTable = (pos: number) => xmdTableBlocks.some((t) => pos >= t.from && pos < t.to);

    // Capture optional attribute block after the image.
    // Supports:
    // - data:image/...;base64,...
    // - zadoox-asset://<key> (stored in Supabase Storage, fetched via backend)
    const re =
      /!\[([^\]]*)\]\(((?:data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)|(?:zadoox-asset:\/\/[^)\s]+))\)\s*(\{(?:\{REF\}|\{CH\}|[^}])*\})?/g;

    const decos: Array<import('@codemirror/state').Range<Decoration>> = [];
    // Render XMD table blocks as a single widget (with per-element toggle) so they are never "mixed"
    // (i.e. inner pipe-table rendered while fences remain as text).
    class XmdTableWidget extends WidgetType {
      constructor(private readonly block: XmdTableBlock) {
        super();
      }
      eq(other: XmdTableWidget): boolean {
        return (
          this.block.from === other.block.from &&
          this.block.to === other.block.to &&
          JSON.stringify(this.block.header) === JSON.stringify(other.block.header) &&
          JSON.stringify(this.block.rows) === JSON.stringify(other.block.rows) &&
          JSON.stringify(this.block.colAlign) === JSON.stringify(other.block.colAlign) &&
          JSON.stringify(this.block.vRules) === JSON.stringify(other.block.vRules) &&
          JSON.stringify(this.block.hRules) === JSON.stringify(other.block.hRules) &&
          JSON.stringify(this.block.style) === JSON.stringify(other.block.style) &&
          this.block.caption === other.block.caption
        );
      }
      ignoreEvent(): boolean {
        return true;
      }
      toDOM(view: EditorView): HTMLElement {
        const outer = document.createElement('div');
        outer.className = 'cm-embedded-xmd-table';
        outer.style.position = 'relative';
        outer.style.margin = '8px 0';
        outer.style.padding = '8px';
        outer.style.border = '1px solid rgba(255,255,255,0.08)';
        outer.style.borderRadius = '8px';
        outer.style.background = 'rgba(0,0,0,0.12)';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Show XMD';
        btn.className =
          'text-xs px-2 py-1 rounded border border-vscode-border bg-vscode-buttonBg text-vscode-text ' +
          'hover:bg-vscode-buttonHoverBg transition-colors';
        btn.style.position = 'absolute';
        btn.style.top = '8px';
        btn.style.left = '8px';
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          view.dispatch({ effects: toggleRenderForRange.of({ from: this.block.from, to: this.block.to }) });
        });
        outer.appendChild(btn);

        // Table hover toolbar (same shell as grid/figure, but table-specific options)
        const tableToolbar = createToolbarShell({
          outer,
          keepOpenKey: `table:${this.block.from}:${this.block.to}`,
          className: 'cm-embedded-table-toolbar',
          top: '8px',
          right: '8px',
          zIndex: '6',
          showMode: 'visibility',
          style: {
            maxWidth: '560px',
          },
        });

        const tIcon = {
          borderSolid:
            '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.5"/>' +
            '</svg>',
          borderDotted:
            '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.5" stroke-dasharray="1.5 2"/>' +
            '</svg>',
          borderDashed:
            '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2"/>' +
            '</svg>',
          borderNone:
            '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.5"/>' +
            '<path d="M4 12L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
            '</svg>',
          borderColor:
            '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M3 13l1.2-4.2L11.7 1.3c.5-.5 1.3-.5 1.8 0l1.2 1.2c.5.5.5 1.3 0 1.8L7.2 11.8 3 13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
            '<path d="M10.9 2.1l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
            '</svg>',
          borderWidth:
            '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M8 1v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
            '<path d="M6.3 3.8L8 5.5l1.7-1.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<rect x="2.5" y="7" width="11" height="2" fill="currentColor"/>' +
            '<path d="M8 15v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
            '<path d="M6.3 12.2L8 10.5l1.7 1.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>',
        };

        const getHeaderLine = () => {
          const line = view.state.doc.lineAt(this.block.from);
          return { from: line.from, to: line.to, text: view.state.doc.sliceString(line.from, line.to) };
        };

        const parseHeaderAttr = (headerText: string, key: string): string | null => {
          const re = new RegExp(`\\b${key}\\s*=\\s*\"([^\"]*)\"`, 'i');
          const m = re.exec(headerText);
          return m ? String(m[1] ?? '') : null;
        };

        const stripHeaderAttrKeys = (rest: string, keys: string[]): string => {
          let out = rest;
          for (const k of keys) out = out.replace(new RegExp(`\\s*${k}\\s*=\\s*\"[^\"]*\"`, 'gi'), '');
          return out.replace(/\s+/g, ' ').trim();
        };

        const buildNextHeaderLine = (updates: {
          borderStyle?: 'solid' | 'dotted' | 'dashed' | null;
          borderColor?: string | null;
          borderWidth?: number | null;
        }): string => {
          const cur = getHeaderLine().text;
          const restRaw = cur.replace(/^:::\s*/i, '');
          let rest = stripHeaderAttrKeys(restRaw, ['borderStyle', 'borderColor', 'borderWidth']);

          const bs = updates.borderStyle !== undefined ? updates.borderStyle : (parseHeaderAttr(cur, 'borderStyle') || '').trim().toLowerCase();
          const bc = updates.borderColor !== undefined ? updates.borderColor : (parseHeaderAttr(cur, 'borderColor') || '');
          const bwRaw =
            updates.borderWidth !== undefined ? String(updates.borderWidth ?? '') : String(parseHeaderAttr(cur, 'borderWidth') || '').trim();

          const normStyle = bs === 'dotted' ? 'dotted' : bs === 'dashed' ? 'dashed' : bs ? 'solid' : null;
          const normColor = String(bc ?? '').trim();
          const normWidth = bwRaw.length ? Number(bwRaw) : NaN;

          if (normStyle) rest = `${rest} borderStyle="${escapeAttrValue(normStyle)}"`.trim();
          if (normColor.length > 0) rest = `${rest} borderColor="${escapeAttrValue(normColor)}"`.trim();
          if (Number.isFinite(normWidth) && normWidth >= 0) rest = `${rest} borderWidth="${Math.round(normWidth)}"`.trim();

          return rest.length > 0 ? `::: ${rest}`.trimEnd() : ':::';
        };

        const updateHeader = (u: { borderStyle?: 'solid' | 'dotted' | 'dashed' | null; borderColor?: string | null; borderWidth?: number | null }) => {
          try {
            const hl = getHeaderLine();
            const next = buildNextHeaderLine(u);
            view.dispatch({ changes: { from: hl.from, to: hl.to, insert: next } });
          } catch {
            // ignore
          }
        };

        const curBorderStyle = (this.block.style?.borderStyle || 'solid') as 'solid' | 'dotted' | 'dashed';
        const curBorderWidth =
          this.block.style?.borderWidthPx !== undefined && Number.isFinite(this.block.style.borderWidthPx) ? this.block.style.borderWidthPx : 1;
        const curBorderColor = (this.block.style?.borderColor || '').trim();

        const borderStyleGroupBtn = tableToolbar.makeIconBtn({
          label: 'Border style',
          svg: curBorderWidth === 0 ? tIcon.borderNone : curBorderStyle === 'dotted' ? tIcon.borderDotted : curBorderStyle === 'dashed' ? tIcon.borderDashed : tIcon.borderSolid,
          selected: true,
        });
        const borderWidthGroupBtn = tableToolbar.makeIconBtn({ label: `Border width (${curBorderWidth}px)`, svg: tIcon.borderWidth, selected: true });
        const borderColorGroupBtn = tableToolbar.makeIconBtn({ label: 'Border color', svg: tIcon.borderColor, selected: true });

        tableToolbar.bar.appendChild(
          tableToolbar.makeDropdownGroup({
            label: 'Border style',
            currentBtn: borderStyleGroupBtn,
            items: [
              { label: 'None', svg: tIcon.borderNone, selected: curBorderWidth === 0, onSelect: () => updateHeader({ borderWidth: 0 }) },
              { label: 'Solid', svg: tIcon.borderSolid, selected: curBorderWidth > 0 && curBorderStyle === 'solid', onSelect: () => updateHeader({ borderStyle: 'solid', borderWidth: Math.max(1, curBorderWidth || 1) }) },
              { label: 'Dotted', svg: tIcon.borderDotted, selected: curBorderWidth > 0 && curBorderStyle === 'dotted', onSelect: () => updateHeader({ borderStyle: 'dotted', borderWidth: Math.max(1, curBorderWidth || 1) }) },
              { label: 'Dashed', svg: tIcon.borderDashed, selected: curBorderWidth > 0 && curBorderStyle === 'dashed', onSelect: () => updateHeader({ borderStyle: 'dashed', borderWidth: Math.max(1, curBorderWidth || 1) }) },
            ],
          })
        );
        tableToolbar.bar.appendChild(
          tableToolbar.makeDropdownGroup({
            label: 'Border width',
            currentBtn: borderWidthGroupBtn,
            items: Array.from({ length: 9 }).map((_, i) => ({
              label: i === 0 ? '0 (none)' : `${i}px`,
              svg: tIcon.borderWidth,
              selected: curBorderWidth === i,
              onSelect: () => updateHeader({ borderWidth: i }),
            })),
          })
        );
        tableToolbar.bar.appendChild(
          tableToolbar.makeDropdownGroup({
            label: 'Border color',
            currentBtn: borderColorGroupBtn,
            items: [],
            customBody: (container) => {
              container.style.display = 'flex';
              container.style.flexDirection = 'column';
              container.style.gap = '6px';

              const row = document.createElement('div');
              row.style.display = 'flex';
              row.style.alignItems = 'center';
              row.style.gap = '8px';
              row.style.padding = '6px';
              row.style.borderRadius = '8px';
              row.style.border = '1px solid rgba(255,255,255,0.10)';
              row.style.background = 'rgba(0,0,0,0.12)';

              const isHex = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);

              const colorInput = document.createElement('input');
              colorInput.type = 'color';
              colorInput.value = isHex(curBorderColor) ? curBorderColor : '#6b7280';
              colorInput.style.width = '30px';
              colorInput.style.height = '22px';
              colorInput.style.border = 'none';
              colorInput.style.background = 'transparent';
              colorInput.style.padding = '0';

              const textInput = document.createElement('input');
              textInput.type = 'text';
              textInput.value = isHex(curBorderColor) ? curBorderColor.toLowerCase() : String(colorInput.value || '').trim().toLowerCase();
              textInput.placeholder = '#rrggbb';
              textInput.style.flex = '1';
              textInput.style.fontSize = '11px';
              textInput.style.background = 'transparent';
              textInput.style.border = 'none';
              textInput.style.outline = 'none';
              textInput.style.color = '#cfcfcf';

              const normalizeColor = (raw: string): string | null => {
                const s = String(raw || '').trim();
                if (!s) return null;
                const withHash = s.startsWith('#') ? s : `#${s}`;
                if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash)) return withHash.toLowerCase();
                return s;
              };

              const apply = () => {
                const next = normalizeColor(textInput.value);
                updateHeader({ borderColor: next });
                if (next) colorInput.value = next;
              };

              colorInput.addEventListener('input', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const v = String(colorInput.value || '').trim();
                textInput.value = v;
                updateHeader({ borderColor: normalizeColor(v) });
              });
              textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  apply();
                  textInput.blur();
                }
              });
              textInput.addEventListener('blur', () => apply());

              row.appendChild(colorInput);
              row.appendChild(textInput);
              container.appendChild(row);
            },
          })
        );

        // AI chat (same inline chat used by grid/figure)
        tableToolbar.bar.appendChild(makeToolbarSeparator());
        tableToolbar.bar.appendChild(
          makeInlineComponentChatArea({
            kind: 'table',
            ariaLabel: 'Table edit prompt',
            placeholder: 'Describe what you want…',
            rows: 2,
            widthPx: 320,
            minWidthPx: 220,
            maxWidthPx: 560,
            heightPx: 44,
            onPinChange: (v) => {
              tableToolbar.setPinned(Boolean(v));
            },
            onClose: () => {
              tableToolbar.setPinned(false);
            },
            getOriginal: () => ({
              from: this.block.from,
              to: this.block.to,
              text: view.state.doc.sliceString(this.block.from, this.block.to),
            }),
            applyReplacement: (replacement) => {
              view.dispatch({ changes: { from: this.block.from, to: this.block.to, insert: replacement } });
            },
          })
        );

        outer.appendChild(tableToolbar.bar);

        const cols = Math.max(0, this.block.header.length);
        const borderColor = this.block.style?.borderColor || 'rgba(255,255,255,0.16)';
        const borderWidth = this.block.style?.borderWidthPx && this.block.style.borderWidthPx > 0 ? this.block.style.borderWidthPx : 1;
        const singleStyle = this.block.style?.borderStyle || 'solid';
        const cssBorder = (rule: TableRule) => {
          if (rule === 'none') return 'none';
          const style = rule === 'double' ? 'double' : singleStyle;
          const w = rule === 'double' ? Math.max(3, borderWidth) : borderWidth;
          return `${w}px ${style} ${borderColor}`;
        };
        const cssAlign = (a: TableAlign) => (a === 'center' ? 'center' : a === 'right' ? 'right' : 'left');

        if (this.block.caption) {
          const cap = document.createElement('div');
          cap.textContent = this.block.caption;
          cap.style.color = '#9aa0a6';
          cap.style.fontStyle = 'italic';
          cap.style.fontSize = '12px';
          cap.style.marginTop = '22px';
          cap.style.marginBottom = '6px';
          outer.appendChild(cap);
        } else {
          // Keep table content from overlapping the top-right button.
          const spacer = document.createElement('div');
          spacer.style.height = '22px';
          outer.appendChild(spacer);
        }

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';

        const mkCellStyle = (rowIndex: number, colIndex: number) => {
          const styles: string[] = [];
          styles.push(`text-align:${cssAlign(this.block.colAlign[colIndex] || 'left')}`);
          styles.push('padding:6px 10px');
          // vertical
          if (colIndex === 0) styles.push(`border-left:${cssBorder(this.block.vRules[0] || 'none')}`);
          if (colIndex > 0) styles.push(`border-left:${cssBorder(this.block.vRules[colIndex] || 'none')}`);
          if (colIndex === cols - 1) styles.push(`border-right:${cssBorder(this.block.vRules[cols] || 'none')}`);
          // horizontal
          const totalRows = 1 + this.block.rows.length;
          if (rowIndex === 0) styles.push(`border-top:${cssBorder(this.block.hRules[0] || 'none')}`);
          if (rowIndex > 0) styles.push(`border-top:${cssBorder(this.block.hRules[rowIndex] || 'none')}`);
          if (rowIndex === totalRows - 1) styles.push(`border-bottom:${cssBorder(this.block.hRules[totalRows] || 'none')}`);
          return styles.join(';');
        };

        const thead = document.createElement('thead');
        const trh = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
          const th = document.createElement('th');
          th.textContent = String(this.block.header[c] ?? '');
          th.style.cssText = mkCellStyle(0, c);
          th.style.fontWeight = '600';
          trh.appendChild(th);
        }
        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (let r = 0; r < this.block.rows.length; r++) {
          const row = this.block.rows[r] ?? [];
          const tr = document.createElement('tr');
          for (let c = 0; c < cols; c++) {
            const td = document.createElement('td');
            td.textContent = String(row[c] ?? '');
            td.style.cssText = mkCellStyle(1 + r, c);
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        outer.appendChild(table);
        return outer;
      }
    }

    for (const tb of xmdTableBlocks) {
      // Never render tables inside grids; grids control their own rendering surface.
      // This prevents "mixed XMD/HTML" when a grid is toggled to show XMD.
      if (isInGrid(tb.from)) continue;
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
          widget: new XmdTableWidget(tb),
          block: true,
        }).range(tb.from, tb.to)
      );
    }

    // Render plain pipe-tables as a single widget (with per-element toggle).
    // Never render a pipe-table inside any ::: ... ::: fenced block; the fence must be atomic.
    const tableBlocks = parseTableBlocks().filter((t) => !isInFence(t.from));
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
      // Never render figures inside any ::: ... ::: fenced directive block.
      // Grids/tables handle their own rendering; unknown/malformed fences must remain pure XMD.
      if (isInFence(matchStart)) {
        continue;
      }

      // Skip rendering if this figure is within a disabled range or any table block (pipe or XMD).
      if (tableBlocks.some((t) => matchStart >= t.from && matchStart < t.to)) {
        continue;
      }
      if (xmdTableBlocks.some((t) => matchStart >= t.from && matchStart < t.to)) {
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
            widget: new FigureGridWidget(g.cols, g.caption, headerFrom, headerTo, doc.sliceString(headerFrom, headerTo), g.from, g.to, cells),
            // If placement=inline and align is left/right, render as non-block so text can wrap (like inline figures).
            block: !inlineWrap,
          }).range(g.from, g.to)
        );
      }
    }


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


