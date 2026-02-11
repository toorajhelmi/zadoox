'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MicIcon, ArrowRightIcon } from '@/components/icons';
import { SemanticGraphPanel } from './sg/semantic-graph-panel';
import type { ConceptionChatTurn, ConceptionState, SemanticGraph } from '@zadoox/shared';
import { api } from '@/lib/api/client';
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
  // KPs selected in the IdeaGraph UI (not necessarily inserted as chips).
  contextPinnedKps?: Array<{ id: string; label: string }>;
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
    contextPinnedKps,
    onSaveConception,
    onResetConception,
  } = props;

  const composerRef = useRef<HTMLDivElement | null>(null);
  const [draftText, setDraftText] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'sg' | 'agenda' | 'suggestions'>('chat');
  const lastComposerRangeRef = useRef<Range | null>(null);
  const showDebug = process.env.NODE_ENV !== 'production';

  function newTurnId(prefix = 't') {
    try {
      return `${prefix}-${crypto.randomUUID()}`;
    } catch {
      return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    }
  }

  function stripFormalizationKickoffs(turns: ConceptionChatTurn[]): ConceptionChatTurn[] {
    // Remove previously injected debug kickoff turns so "Re‑formalize" is idempotent.
    // We only strip assistant turns that are clearly our formalization kickoff markers.
    return (turns ?? []).filter((t) => {
      if (t.role !== 'assistant') return true;
      if (t.meta?.source !== 'system') return true;
      const c = String(t.content ?? '');
      if (!c) return true;
      // Signature phrases for the injected kickoff.
      if (c.includes("switch to planning the document") && c.includes('What kind of document are we writing?')) return false;
      return true;
    });
  }

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

  const syncDraftFromDom = useCallback(() => {
    const el = composerRef.current;
    if (!el) return;
    const parsed = parseComposer(el, { quoteKpLabels: false });
    setDraftText(parsed.text);
  }, []);

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
  }, [insertKpRef?.nonce, insertKpRef, onInsertedKpRef, syncDraftFromDom]);

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
      const extra = Array.isArray(contextPinnedKps) ? contextPinnedKps : [];
      const mergedPinned = Array.from(
        new Map([...parsed.uiPinnedKps, ...extra].map((kp) => [kp.id, { id: kp.id, label: kp.label }])).values()
      );
      const contextGroup =
        mergedPinned.length >= 2
          ? {
              id: `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              anchorKps: mergedPinned,
            }
          : undefined;
      void (async () => {
        try {
          await sendConceptionMessage({
            conception: latestConception,
            message: msg,
            onSaveConception,
            uiPinnedKps: mergedPinned,
            contextGroup,
          });
        } finally {
          setSending(false);
        }
      })();
      return;
    }

    // AI‑Assist / fallback: stop "sending" immediately (old stub behavior).
    setTimeout(() => setSending(false), 150);
  }, [contextPinnedKps, isFullAI, onSaveConception, sending]);

  const sendQuickReply = useCallback((msg: string) => {
    const text = String(msg ?? '').trim();
    if (!text || sending) return;
    const latestConception = conceptionRef.current;
    if (!isFullAI || !latestConception || !onSaveConception) return;

    // Drafting flow: intercept system quick replies (do NOT send them to the LLM).
    try {
      const dm: any = (latestConception as any).dm ?? {};
      const drafting: any = dm.drafting ?? null;
      const stage = String(drafting?.stage ?? '');
      if (stage === 'review' && (text === 'Include all ideas' || text === 'Select in the graph')) {
        const next: any = { ...latestConception, dm: { ...dm }, updatedAt: new Date().toISOString() };
        next.dm.drafting = {
          ...(drafting ?? { includedNodeIds: [], importanceById: {} }),
          stage: text === 'Include all ideas' ? 'rank_nodes' : 'select_nodes',
          includedNodeIds: Array.isArray(drafting?.includedNodeIds) ? [...drafting.includedNodeIds] : [],
          importanceById: (drafting?.importanceById && typeof drafting.importanceById === 'object') ? { ...drafting.importanceById } : {},
        };

        // For "include all", keep includedNodeIds empty (backend interprets as "all") but guide the user.
        // For "select", user will pick explicit nodes (ancestors auto-included by backend during materialization).
        const sysTurn = {
          id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant' as const,
          createdAt: new Date().toISOString(),
          meta: { source: 'system' as const },
          content:
            text === 'Include all ideas'
              ? `Great — including all ideas.\n\nNext: rank what matters most (H/M/L), then click “Start drafting”.`
              : `Select the nodes you want to include in the graph.\n\nAncestors will be included automatically.\n\nWhen you’re done, click “Done selecting”.`,
        };
        next.turns = [...(latestConception.turns ?? []), sysTurn];
        onSaveConception(next, 'ai-action');
        return;
      }
    } catch {
      // ignore: fall back to normal quick reply send
    }

    setSending(true);
    void (async () => {
      try {
        await sendConceptionMessage({ conception: latestConception, message: text, onSaveConception });
      } finally {
        setSending(false);
      }
    })();
  }, [isFullAI, onSaveConception, sending]);

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
          {isFullAI ? 'Chat with Z' : 'Chat'}
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
                    onSelectOption={(opt) => sendQuickReply(opt)}
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
                    {conception.phase !== 'ideation' ? (
                      <button
                        type="button"
                        className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-[#3e3e42] text-[#cccccc] hover:bg-[#1e1e1e] transition-colors disabled:opacity-50"
                        disabled={sending}
                        title="Go back to the IdeaGraph view"
                        onClick={() => {
                          onSaveConception(
                            { ...conception, phase: 'ideation', updatedAt: new Date().toISOString() },
                            'ai-action'
                          );
                        }}
                      >
                        Back to IG
                      </button>
                    ) : null}
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
                    {showDebug ? (
                      <button
                        type="button"
                        className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-[#3e3e42] text-[#cccccc] hover:bg-[#1e1e1e] transition-colors disabled:opacity-50"
                        disabled={sending}
                        title="Debug: re-initiate formalization and clear turns since last formalization start"
                        onClick={() => {
                          if (!onSaveConception) return;
                          const dmAny = (conception as unknown as { dm?: unknown }).dm;
                          const dm = dmAny && typeof dmAny === 'object' ? (dmAny as Record<string, unknown>) : {};
                          const startId = String(dm.formalizationStartTurnId ?? '').trim();
                          const hasStart = !!startId && (conception.turns ?? []).some((t) => t.id === startId);
                          const truncated0 = hasStart ? deleteTurnsFrom(conception, startId) : conception;
                          const truncated: ConceptionState = {
                            ...truncated0,
                            turns: stripFormalizationKickoffs(truncated0.turns ?? []),
                          };

                          // Clear DP fields: restart with the minimal blank DP.
                          const clearedDocPlan = { docType: 'unknown' as const, sections: [] as any[] };

                          const resetBase: ConceptionState = {
                            ...truncated,
                            docPlan: clearedDocPlan as any,
                            dm: {
                              phase: 'formalization',
                              convergenceScore: Math.max(Number((dm as any).convergenceScore ?? 0), 0.9),
                              allowIgUpdates: false,
                              askedSlots: [],
                              answeredSlots: [],
                              lastAskedSlot: null,
                              formalizationStartTurnId: undefined,
                            },
                            updatedAt: new Date().toISOString(),
                          };
                          // Persist reset immediately, then fetch a kickoff question from backend (shortlisted from DR).
                          onSaveConception(resetBase, 'ai-action');
                          setSending(true);
                          void (async () => {
                            try {
                              // Minimal DR snapshot for the backend: enough for formalization shortlisting.
                              const lastTurns = (resetBase.turns ?? []).slice(-12).map((t) => ({
                                id: t.id,
                                role: t.role,
                                content: t.content,
                                createdAt: t.createdAt,
                              }));
                              const ig = resetBase.ideaGraph ?? { nodes: [], edges: [] };
                              const igCompact = {
                                nodes: (ig.nodes ?? []).slice(0, 25).map((n: any) => ({
                                  id: n.id,
                                  label: n.label,
                                  state: n.state,
                                  weight: n.weight,
                                  confidence: n.confidence,
                                  status: n.status,
                                  facets: n.facets,
                                })),
                                edges: (ig.edges ?? []).slice(0, 40).map((e: any) => ({
                                  src: e.src,
                                  dst: e.dst,
                                  weight: e.weight,
                                  confidence: e.confidence,
                                  status: e.status,
                                  facets: e.facets,
                                })),
                              };
                              const drKickoff = {
                                phase: 'formalization',
                                turnCount: (resetBase.turns ?? []).length,
                                dm: resetBase.dm ?? {},
                                docPlan: resetBase.docPlan ?? {},
                                ideaGraph: igCompact,
                                lastTurns,
                              };
                              const step = await api.ai.conception.twoStageStep({
                                message: "Let's plan the document.",
                                dr: drKickoff,
                                model: 'auto',
                              });
                              const kickoff: ConceptionChatTurn = {
                                id: newTurnId('t'),
                                role: 'assistant',
                                createdAt: new Date().toISOString(),
                                meta: { source: 'system' },
                                content: step.assistantText,
                              };
                              const next: ConceptionState = {
                                ...resetBase,
                                dm: {
                                  ...(resetBase.dm ?? {}),
                                  phase: step.phase,
                                  convergenceScore: step.convergenceScore,
                                  allowIgUpdates: step.allowIgUpdates,
                                  ...(((step as any).dmPatch && typeof (step as any).dmPatch === 'object') ? (step as any).dmPatch : {}),
                                  formalizationStartTurnId: kickoff.id,
                                } as any,
                                ...(step.docPlanPatch ? { docPlan: { ...(resetBase.docPlan ?? {}), ...(step.docPlanPatch as any) } } : {}),
                                turns: [...(resetBase.turns ?? []), kickoff],
                                updatedAt: new Date().toISOString(),
                              };
                              onSaveConception(next, 'ai-action');
                            } catch (err: unknown) {
                              const message = err instanceof Error ? err.message : String(err);
                              const fallback: ConceptionChatTurn = {
                                id: newTurnId('t'),
                                role: 'assistant',
                                createdAt: new Date().toISOString(),
                                meta: { source: 'system' },
                                content:
                                  `I couldn’t start Doc Plan planning because templates aren’t available yet.\n\n` +
                                  `${message}\n\n` +
                                  `Run:\n- pnpm --filter @zadoox/backend db:migrate`,
                              };
                              onSaveConception(
                                {
                                  ...resetBase,
                                  turns: [...(resetBase.turns ?? []), fallback],
                                  updatedAt: new Date().toISOString(),
                                },
                                'ai-action'
                              );
                            } finally {
                              setSending(false);
                            }
                          })();
                        }}
                      >
                        Re‑formalize
                      </button>
                    ) : null}
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


