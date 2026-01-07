'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ComponentAIEditDetail, ComponentAIKind } from './component-ai-edit';
import { detectClarificationNeeded, detectOutOfScopeForComponent } from './component-ai-edit';

type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string };

export function ComponentAIChat(props: {
  position: { top: number; left: number };
  editMode: 'markdown' | 'latex';
  detail: ComponentAIEditDetail;
  onClose: () => void;
  onRequestPreview: (input: { prompt: string; detail: ComponentAIEditDetail }) => Promise<
    | { ok: true; replacement: string; newContent: string }
    | { ok: false; message: string }
  >;
  onApply: (input: { newContent: string }) => Promise<void>;
}) {
  const { position, editMode, detail, onClose, onRequestPreview, onApply } = props;
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    const base: ChatMsg[] = [
      {
        id: 'm0',
        role: 'assistant',
        content:
          detail.kind === 'figure'
            ? 'Editing this figure. Tell me what to change (caption, width, alignment, placement, etc.).'
            : detail.kind === 'table'
              ? 'Editing this table. Tell me what to change (caption, label, border style/color/width, etc.).'
              : 'Editing this grid. Tell me what to change (caption, cols, alignment, placement, margin, etc.).',
      },
    ];
    if (detail.initialMessage && detail.initialMessage.trim()) {
      base.push({ id: 'm1', role: 'user', content: detail.initialMessage.trim() });
    }
    return base;
  });
  const [inputValue, setInputValue] = useState<string>(() => detail.initialMessage?.trim() ?? '');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ replacement: string; newContent: string } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  const title = useMemo(() => {
    const k: Record<ComponentAIKind, string> = { figure: 'Figure', grid: 'Grid', table: 'Table' };
    return `Edit ${k[detail.kind]} with AI`;
  }, [detail.kind]);

  // Focus input when opened
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Close on escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Keep within viewport bounds (recompute on resize and when position changes)
  useEffect(() => {
    const padding = 16;
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const recalc = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const maxLeft = Math.max(padding, viewportWidth - rect.width - padding);
      const maxTop = Math.max(padding, viewportHeight - rect.height - padding);
      const newLeft = clamp(position.left, padding, maxLeft);
      const newTop = clamp(position.top, padding, maxTop);
      setAdjustedPosition((prev) => {
        if (Math.abs(prev.left - newLeft) < 1 && Math.abs(prev.top - newTop) < 1) return prev;
        return { left: newLeft, top: newTop };
      });
    };

    requestAnimationFrame(recalc);
    window.addEventListener('resize', recalc);
    const ro = new ResizeObserver(() => requestAnimationFrame(recalc));
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', recalc);
      ro.disconnect();
    };
  }, [position.left, position.top]);

  const append = useCallback((msg: Omit<ChatMsg, 'id'>) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, ...msg }]);
  }, []);

  const handleSend = useCallback(
    async (raw: string) => {
      const prompt = String(raw ?? '').trim();
      if (!prompt) return;
      setPreview(null);
      setSuggestions([]);
      append({ role: 'user', content: prompt });

      const scope = detectOutOfScopeForComponent({ kind: detail.kind, prompt });
      if (scope.outOfScope) {
        append({ role: 'assistant', content: scope.message || 'That request doesn’t seem to apply to this component.' });
        return;
      }

      const clarify = detectClarificationNeeded({ kind: detail.kind, prompt });
      if (clarify) {
        setSuggestions(clarify.suggestions);
        append({ role: 'assistant', content: clarify.question });
        return;
      }

      setBusy(true);
      try {
        const res = await onRequestPreview({ prompt, detail: { ...detail, initialMessage: undefined } });
        if (!res.ok) {
          append({ role: 'assistant', content: res.message });
          return;
        }
        setPreview({ replacement: res.replacement, newContent: res.newContent });
        append({ role: 'assistant', content: 'Preview ready — review and apply if it looks right.' });
      } finally {
        setBusy(false);
      }
    },
    [append, detail, onRequestPreview]
  );

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl"
      style={{
        top: `${adjustedPosition.top}px`,
        left: `${adjustedPosition.left}px`,
        width: '560px',
        maxWidth: 'min(92vw, 720px)',
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="text-sm text-gray-200">{title}</div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Close"
          title="Close"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 py-2 text-[11px] text-gray-400 border-b border-gray-800">
        Mode: <span className="text-gray-300">{editMode}</span> · Send: <span className="text-gray-300">Ctrl/Cmd+Enter</span>
      </div>

      <div className="max-h-[260px] overflow-auto px-3 py-2 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={
                'inline-block max-w-[90%] px-2.5 py-2 rounded border text-sm whitespace-pre-wrap ' +
                (m.role === 'user'
                  ? 'bg-gray-800 border-gray-700 text-gray-100'
                  : 'bg-gray-950 border-gray-800 text-gray-200')
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setInputValue(s);
                inputRef.current?.focus();
              }}
              className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 rounded border border-gray-700 transition-colors"
              title={s}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {preview && (
        <div className="px-3 pb-2">
          <div className="text-xs text-gray-400 mb-1">Proposed component update</div>
          <pre className="text-xs bg-black/40 border border-gray-800 rounded p-2 overflow-auto max-h-[140px] text-gray-200">
            {preview.replacement}
          </pre>
          <div className="flex gap-2 mt-2">
            <button
              disabled={busy}
              onClick={async () => {
                if (!preview) return;
                setBusy(true);
                try {
                  await onApply({ newContent: preview.newContent });
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors"
            >
              Apply
            </button>
            <button
              disabled={busy}
              onClick={() => setPreview(null)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 text-white text-sm rounded border border-gray-700 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="px-3 py-3 border-t border-gray-800">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          rows={2}
          placeholder={detail.kind === 'figure' ? 'e.g. “Align center and set width to 70%”' : 'e.g. “Set cols=3 and margin=small”'}
          className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded px-2 py-2 text-sm resize-y"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (!busy) {
                const next = inputValue;
                setInputValue('');
                void handleSend(next);
              }
            }
          }}
        />
        <div className="flex justify-end gap-2 mt-2">
          <button
            disabled={busy || !inputValue.trim()}
            onClick={() => {
              const next = inputValue;
              setInputValue('');
              void handleSend(next);
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-500 text-white text-sm rounded transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}


