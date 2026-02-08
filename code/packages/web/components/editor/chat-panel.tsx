'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MicIcon, ArrowRightIcon } from '@/components/icons';
import { SemanticGraphPanel } from './sg/semantic-graph-panel';
import type { ConceptionState, SemanticGraph } from '@zadoox/shared';
import { ConceptionChat } from './conception/conception-chat';
import { deleteTurnsFrom } from './conception/conception-chat-logic';
import { generateSimulatedUserMessage, sendConceptionMessage } from './conception/conception-chat-logic';

export function ChatPanel(props: {
  isOpen: boolean;
  isFullAI: boolean;
  onOpen: () => void;
  onClose: () => void;
  minimized?: boolean;
  onMinimize?: () => void;
  onExpand?: () => void;
  insertKpRef?: { nonce: string; id: string; label: string } | null;
  onInsertedKpRef?: () => void;
  inputRef?: React.MutableRefObject<HTMLElement | null>;
  semanticGraph?: SemanticGraph | null;
  conception?: ConceptionState | undefined;
  onSaveConception?: (next: ConceptionState, changeType?: 'auto-save' | 'ai-action') => void;
  onResetConception?: () => void;
}) {
  const {
    isOpen,
    isFullAI,
    onOpen,
    onClose,
    minimized = false,
    onMinimize,
    onExpand,
    insertKpRef,
    onInsertedKpRef,
    inputRef,
    semanticGraph,
    conception,
    onSaveConception,
    onResetConception,
  } = props;

  const composerRef = useRef<HTMLDivElement | null>(null);
  const [draftText, setDraftText] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'sg' | 'agenda' | 'suggestions'>('chat');
  const lastComposerRangeRef = useRef<Range | null>(null);

  function parseComposer(
    el: HTMLDivElement,
    opts?: { quoteKpLabels?: boolean }
  ): { text: string; uiPinnedKps: Array<{ id: string; label: string }> } {
    const uiPinnedKps: Array<{ id: string; label: string }> = [];
    const parts: string[] = [];
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent ?? '');
        continue;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as HTMLElement;
        if (elem.tagName === 'BR') {
          parts.push('\n');
          continue;
        }
        const id = elem.getAttribute('data-kp-id') ?? '';
        const label = elem.getAttribute('data-kp-label') ?? '';
        if (id && label) {
          uiPinnedKps.push({ id, label });
          parts.push(opts?.quoteKpLabels ? `"${label}"` : label);
          continue;
        }
        parts.push(elem.textContent ?? '');
      }
    }
    return { text: parts.join(''), uiPinnedKps };
  }

  function syncDraftFromDom() {
    const el = composerRef.current;
    if (!el) return;
    const parsed = parseComposer(el, { quoteKpLabels: false });
    setDraftText(parsed.text);
  }

  function captureComposerSelection() {
    const el = composerRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    const startNode = r.startContainer;
    // Only capture selection if it's inside the composer.
    if (!startNode || !el.contains(startNode)) return;
    try {
      lastComposerRangeRef.current = r.cloneRange();
    } catch {
      // ignore
    }
  }

  // Avoid stale captures: always send using the latest conception snapshot.
  const conceptionRef = useRef<ConceptionState | undefined>(conception);
  useEffect(() => {
    conceptionRef.current = conception;
  }, [conception]);

  // Insert KP reference inline at the current cursor position.
  useEffect(() => {
    if (!insertKpRef) return;
    const el = composerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      try {
        el.focus();
        const sel = window.getSelection();
        // Prefer last known caret position in the composer (selection is often lost when clicking outside).
        let range: Range | null = null;
        if (lastComposerRangeRef.current) {
          range = lastComposerRangeRef.current.cloneRange();
        } else if (sel && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0);
          if (el.contains(r.startContainer)) range = r.cloneRange();
        }
        if (!range) {
          range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false); // end
        }

        const chip = document.createElement('span');
        chip.setAttribute('data-kp-id', insertKpRef.id);
        chip.setAttribute('data-kp-label', insertKpRef.label);
        chip.setAttribute('contenteditable', 'false');
        chip.className =
          'inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#3e3e42] bg-[#111111] text-[11px] text-[#cccccc] align-baseline';

        const label = document.createElement('span');
        label.className = 'max-w-[200px] truncate';
        // Show plain label in composer; quotes are added only when serializing to chat history on send.
        label.textContent = insertKpRef.label;

        const x = document.createElement('button');
        x.type = 'button';
        x.textContent = '✕';
        x.className = 'ml-1 text-[#9aa0a6] hover:text-white';
        x.title = 'Remove';
        x.onclick = (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          chip.remove();
          syncDraftFromDom();
        };

        chip.appendChild(label);
        chip.appendChild(x);

        const space = document.createTextNode(' ');

        // Insert at caret: chip first, then trailing space, then move caret after space.
        range.deleteContents();
        range.insertNode(chip);
        range.setStartAfter(chip);
        range.collapse(true);
        range.insertNode(space);
        range.setStartAfter(space);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
        lastComposerRangeRef.current = range.cloneRange();

        syncDraftFromDom();
      } catch {
        // ignore
      }
      onInsertedKpRef?.();
    });
  }, [insertKpRef?.nonce]);

  const handleSend = useCallback(() => {
    const el = composerRef.current;
    const parsed = el
      ? parseComposer(el, { quoteKpLabels: true })
      : { text: '', uiPinnedKps: [] as Array<{ id: string; label: string }> };
    const msg = String(parsed.text ?? '').trim();
    if (!msg || sending) return;
    setSending(true);
    setDraftText('');
    if (composerRef.current) composerRef.current.innerHTML = '';

    // Full‑AI Conception: sending updates conception state + IG (and generates Z response).
    const latestConception = conceptionRef.current;
    if (isFullAI && latestConception && onSaveConception) {
      void (async () => {
        try {
          await sendConceptionMessage({ conception: latestConception, message: msg, onSaveConception, uiPinnedKps: parsed.uiPinnedKps });
        } finally {
          setSending(false);
        }
      })();
      return;
    }

    // AI‑Assist / fallback: stop "sending" immediately (old stub behavior).
    setTimeout(() => setSending(false), 150);
  }, [conception, isFullAI, onSaveConception, sending]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`absolute right-2 bottom-3 px-3 py-2 rounded border border-vscode-border text-xs transition-colors ${
          isFullAI
            ? 'bg-[#a855f7]/10 hover:bg-[#a855f7]/20 text-[#e9d5ff]'
            : 'bg-[#007acc]/10 hover:bg-[#007acc]/20 text-[#bfe3ff]'
        }`}
        title="Open AI chat"
      >
        {isFullAI ? 'Open Full‑AI' : 'Open AI chat'}
      </button>
    );
  }

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => onExpand?.()}
        className={`absolute right-0 top-14 w-[34px] h-[140px] rounded-l border border-r-0 border-vscode-border text-[10px] font-mono uppercase transition-colors z-30 ${
          isFullAI ? 'bg-[#a855f7]/10 hover:bg-[#a855f7]/20 text-[#e9d5ff]' : 'bg-[#007acc]/10 hover:bg-[#007acc]/20 text-[#bfe3ff]'
        } flex flex-col items-center justify-center gap-2`}
        title="Expand chat panel"
      >
        <span className="text-xs leading-none">‹</span>
        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          {isFullAI ? 'Full‑AI' : 'Chat'}
        </span>
      </button>
    );
  }

  return (
    <div className="w-[360px] min-w-[320px] max-w-[420px] h-full border-l border-vscode-border bg-vscode-sidebar flex flex-col">
      <div
        className={`px-3 py-2 border-b border-vscode-border flex items-center justify-between ${
          isFullAI ? 'bg-[#a855f7]/10' : 'bg-[#007acc]/10'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            className="w-[24px] h-[24px] rounded border border-[#3e3e42] bg-transparent hover:bg-[#1e1e1e] text-[#c5c5c5] hover:text-white text-xs flex items-center justify-center"
            onClick={() => onMinimize?.()}
            aria-label="Minimize chat panel"
            title="Minimize"
          >
            –
          </button>

          {/* Tabs (moved into top bar) */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              className={`px-2 py-1 rounded border text-[10px] font-mono uppercase transition-colors ${
                activeTab === 'chat'
                  ? isFullAI
                    ? 'border-[#a855f7]/40 bg-[#a855f7]/10 text-[#e9d5ff]'
                    : 'border-[#007acc]/40 bg-[#007acc]/10 text-[#bfe3ff]'
                  : 'border-transparent hover:border-[#3e3e42] hover:bg-[#1e1e1e] text-[#969696] hover:text-[#cccccc]'
              }`}
              title="Chat"
              aria-label="Chat"
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>

            {semanticGraph !== undefined && (
              <button
                type="button"
                className={`px-2 py-1 rounded border text-[10px] font-mono uppercase transition-colors ${
                  activeTab === 'sg'
                    ? 'border-[#3e3e42] bg-[#1e1e1e] text-[#cccccc]'
                    : 'border-transparent hover:border-[#3e3e42] hover:bg-[#1e1e1e] text-[#969696] hover:text-[#cccccc]'
                }`}
                title="Semantic Graph"
                aria-label="Semantic Graph"
                onClick={() => setActiveTab('sg')}
              >
                SG
              </button>
            )}

            <button
              type="button"
              disabled
              className="px-2 py-1 rounded border border-transparent text-[10px] font-mono uppercase text-[#555] cursor-not-allowed"
              title="Agenda (coming soon)"
              aria-label="Agenda (coming soon)"
            >
              Agenda
            </button>

            <button
              type="button"
              disabled
              className="px-2 py-1 rounded border border-transparent text-[10px] font-mono uppercase text-[#555] cursor-not-allowed"
              title="Suggestions (coming soon)"
              aria-label="Suggestions (coming soon)"
            >
              Suggestions
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          {/* Main scrollable content */}
          <div className="h-full overflow-auto p-3 text-sm text-vscode-text-secondary">
            {activeTab === 'chat' && (
              <>
                {isFullAI && conception ? (
                  <ConceptionChat
                    conception={conception}
                    onDeleteFromTurn={(turnId) => {
                      if (!onSaveConception) return;
                      const next = deleteTurnsFrom(conception, turnId);
                      onSaveConception(next, 'ai-action');
                    }}
                  />
                ) : (
                  <div>Open chat to ask for help, generate structure, or draft content.</div>
                )}
              </>
            )}

            {activeTab === 'sg' && semanticGraph !== undefined && (
              <SemanticGraphPanel
                sg={semanticGraph ?? null}
                isPinned={false}
                onTogglePinned={() => {}}
                onRequestClose={() => {}}
              />
            )}

            {activeTab !== 'chat' && activeTab !== 'sg' && (
              <div className="text-xs text-[#969696]">Coming soon.</div>
            )}
          </div>
        </div>
      </div>

      {/* Input Area - same command-bar style as Think panel chat */}
      {activeTab === 'chat' && (
        <div className="p-3 border-t border-vscode-border">
          <div className="rounded-lg bg-black border border-gray-800">
            <div className="px-4 pt-4 pb-3">
              <div className="relative">
                {!composerFocused && draftText.trim().length === 0 ? (
                  <div className="absolute left-0 top-0 text-xs text-gray-500 pointer-events-none">
                    {isFullAI ? 'Describe what you want to write…' : 'Ask anything…'}
                  </div>
                ) : null}
                <div
                  ref={(el) => {
                    composerRef.current = el;
                    if (inputRef) inputRef.current = el;
                  }}
                  contentEditable={!sending}
                  suppressContentEditableWarning
                  onFocus={() => setComposerFocused(true)}
                  onBlur={() => {
                    captureComposerSelection();
                    setComposerFocused(false);
                  }}
                  onInput={() => {
                    captureComposerSelection();
                    syncDraftFromDom();
                  }}
                  onKeyUp={() => captureComposerSelection()}
                  onMouseUp={() => captureComposerSelection()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                      return;
                    }
                    if (e.key === 'Enter' && e.shiftKey) {
                      e.preventDefault();
                      document.execCommand('insertLineBreak');
                    }
                  }}
                  className="w-full text-xs bg-transparent text-gray-200 focus:outline-none whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto"
                  style={{ minHeight: '20px' }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-4 pb-3 pt-2 border-t border-gray-900">
              <div className="flex items-center gap-2">
                {isFullAI && conception && onSaveConception && onResetConception ? (
                  <>
                    <button
                      type="button"
                      className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-[#a855f7]/30 text-[#e9d5ff] hover:bg-[#a855f7]/10 transition-colors disabled:opacity-50"
                      disabled={sending}
                      title="Simulate a user message"
                      onClick={() => {
                        const latestConception = conceptionRef.current ?? conception;
                        setSending(true);
                        void (async () => {
                          try {
                            const msg = await generateSimulatedUserMessage(latestConception);
                            await sendConceptionMessage({ conception: latestConception, message: msg, onSaveConception });
                          } finally {
                            setSending(false);
                          }
                        })();
                      }}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-[#3e3e42] text-[#cccccc] hover:bg-[#1e1e1e] transition-colors disabled:opacity-50"
                      disabled={sending}
                      title="Clear chat + idea graph"
                      onClick={() => {
                        onResetConception();
                      }}
                    >
                      Clear
                    </button>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {sending && (
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                )}
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending}
                  className={`p-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                    draftText.trim()
                      ? isFullAI
                        ? 'bg-[#a855f7] hover:bg-[#9333ea] text-white'
                        : 'bg-vscode-blue hover:bg-blue-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                  title={draftText.trim() ? 'Send message' : 'Start conversation'}
                >
                  {draftText.trim() ? <ArrowRightIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


