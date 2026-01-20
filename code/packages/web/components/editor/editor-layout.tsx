'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { ChatPanel } from './chat-panel';
import { EditorSidebar } from './editor-sidebar';
import { EditorToolbar } from './editor-toolbar';
import { EditorStatusBar } from './editor-status-bar';
import { IrPreview } from './ir-preview';
import { FormattingToolbar } from './formatting-toolbar';
import { ThinkModePanel } from './think-mode-panel';
import { InlineAIChat } from './inline-ai-chat';
import { InlineAIHint } from './inline-ai-hint';
import { useDocumentState } from '@/hooks/use-document-state';
import { useIrDocument } from '@/hooks/use-ir-document';
import { useSgRefresh } from './sg/use-sg-refresh';
import { extractBlockGraphFromIr } from './sg/bg-extract';
import { api } from '@/lib/api/client';
import type { FormatType } from './floating-format-menu';
import type { ResearchSource, DocumentStyle, DocumentNode, EditingMode } from '@zadoox/shared';
import type { InlineEditBlock, InlineEditOperation } from '@zadoox/shared';
import type { QuickOption } from '@/lib/services/context-options';
import { irToLatexDocument, irToXmd } from '@zadoox/shared';
import { applyInlineOperations, buildInlineBlocksAroundCursor } from './editor-layout-inline-edit';
import { useEditorKeyboardShortcuts } from './editor-layout-shortcuts';
import { useEditorFormatHandler } from './editor-layout-formatting';
import { useEditorLayoutSizing } from './editor-layout-sizing';
import { useProjectDocumentStyle } from './editor-layout-project-settings';
import { useEditorCursorScreenPosition } from './editor-layout-cursor';
import { useEditorSaveWithCitationsCleanup } from './editor-layout-save';
import { useEditorVersionMetadata } from './editor-layout-versioning';
import { useEditorHistoryAndChangeTracking } from './editor-layout-history';
import { useEditorEditMode } from './editor-layout-edit-mode';
import { applyThinkModeGeneratedContentToXmd } from './editor-layout-think-apply';
import { rollbackToVersion, selectVersionForViewing } from './editor-layout-version-actions';
import { previewInsertAtCursor } from './editor-layout-inline-preview';
import { ensureLatexPreambleForLatexContent } from './latex-preamble';
import { ActiveEditorSurface } from './active-editor-surface';
import { useCanonicalIrState } from './editor-layout-canonical-ir';
import { getActiveEditorText, getCursorScopeText, getSurfaceCapabilities, getSurfaceSyntax, getTypingHistoryAdapter, pickUndoRedo } from './editor-surface';
// SG is stored separately on the Document (not in metadata).

interface EditorLayoutProps {
  projectId: string;
  documentId: string;
}

type ViewMode = 'edit' | 'preview' | 'split' | 'ir';

type SidebarTab = 'outline' | 'history';

export function EditorLayout({ projectId, documentId }: EditorLayoutProps) {
  const searchParams = useSearchParams();
  const fullAssist = useMemo(() => {
    const v = (searchParams.get('fullassist') ?? '').toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }, [searchParams]);
  const shouldFocusChat = useMemo(() => (searchParams.get('focus') ?? '').toLowerCase() === 'chat', [searchParams]);
  const [projectEditingMode, setProjectEditingMode] = useState<EditingMode>('ai-assist');
  const didAutoOpenRightChatRef = useRef(false);

  const {
    content,
    documentTitle,
    updateContent,
    setContentWithoutSave,
    isSaving,
    lastSaved,
    documentId: actualDocumentId,
    saveDocument: originalSaveDocument,
    paragraphModes,
    handleModeToggle: handleModeToggleFromHook,
    documentMetadata,
    setDocumentMetadata,
    saveMetadataPatch,
    semanticGraph,
    saveSemanticGraphPatch,
    refreshSemanticGraph,
  } = useDocumentState(documentId, projectId);
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('outline');
  // IMPORTANT: don't read localStorage in the initial render, otherwise SSR markup can mismatch
  // the first client render and cause hydration warnings.
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default 256px (w-64)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('editor-sidebar-width');
      if (saved) {
        const next = parseInt(saved, 10);
        if (Number.isFinite(next) && next > 0) {
          setSidebarWidth(next);
        }
      }
    } catch {
      // ignore
    }
  }, []);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  // Editor/preview splitter state (used in split mode)
  const [editorPaneWidth, setEditorPaneWidth] = useState<number>(0); // px; 0 => default (50%)
  const [isResizingEditorPane, setIsResizingEditorPane] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [latestVersion, setLatestVersion] = useState<number | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ line: number; column: number } | null>(null);
  const [cursorScreenPosition, setCursorScreenPosition] = useState<{ top: number; left: number } | null>(null);
  const [thinkPanelOpen, setThinkPanelOpen] = useState(false);
  const [rightAiChatOpen, setRightAiChatOpen] = useState(false);
  const rightAiInputRef = useRef<HTMLTextAreaElement | null>(null);

  const isFullAI = fullAssist || projectEditingMode === 'full-ai';

  useEffect(() => {
    // Auto-open once on load if this is a Full-AI project (or deep-link).
    if (didAutoOpenRightChatRef.current) return;
    if (!isFullAI) return;
    didAutoOpenRightChatRef.current = true;
    setRightAiChatOpen(true);
  }, [isFullAI]);

  useEffect(() => {
    if (!rightAiChatOpen) return;
    if (!isFullAI && !shouldFocusChat) return;
    requestAnimationFrame(() => rightAiInputRef.current?.focus());
  }, [rightAiChatOpen, isFullAI, shouldFocusChat]);

  // Chat send UX is encapsulated in `ChatPanel`.
  const [openParagraphId, setOpenParagraphId] = useState<string | null>(null);
  const [inlineAIChatOpen, setInlineAIChatOpen] = useState(false);
  const [inlineAIHintVisible, setInlineAIHintVisible] = useState(false);
  const inlineAIHintHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [documentStyle, setDocumentStyle] = useState<DocumentStyle>('other');
  const [projectName, setProjectName] = useState<string>('');
  const currentSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null);
  const [pendingChangeContent, setPendingChangeContent] = useState<{ original: string; new: string } | null>(null);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [busyOverlayMessage, setBusyOverlayMessage] = useState<string>('Generating content...');
  const [isSgBootstrapping, setIsSgBootstrapping] = useState(false);
  const [sgBootstrapError, setSgBootstrapError] = useState<string | null>(null);
  const [sgBootstrapAttempt, setSgBootstrapAttempt] = useState(0);
  const [sgBootstrapDoneBlocks, setSgBootstrapDoneBlocks] = useState(0);
  const [sgBootstrapTotalBlocks, setSgBootstrapTotalBlocks] = useState(0);
  const sgBootstrapJobIdRef = useRef<string | null>(null);
  const didBootstrapSgRef = useRef<string | null>(null);
  const previousContentForHistoryRef = useRef<string>(content);
  const previousLatexForHistoryRef = useRef<string>('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latexDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latexAutoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latexEditNonceRef = useRef<number>(0);
  const getCurrentIrRef = useRef<() => DocumentNode | null>(() => null);
  const editorViewRef = useRef<import('@codemirror/view').EditorView | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isUserInputRef = useRef<boolean>(false); // Track if content change is from user input
  const [docAIMetrics, setDocAIMetrics] = useState<{
    metrics: Record<string, number> | null;
    analyzedSections: number;
    isAnalyzing: boolean;
  } | null>(null);

  // Phase 11: keep IR updated as XMD changes (debounced), compute node-level delta + events.
  const irState = useIrDocument({
    docId: actualDocumentId || documentId,
    xmd: content,
    debounceMs: 250,
    enabled: Boolean(actualDocumentId || documentId),
  });

  const getCurrentIrForModeSwitch = useCallback(() => getCurrentIrRef.current(), []);

  const { editMode, setEditMode, latexDraft, setLatexDraft, handleEditModeChange } = useEditorEditMode({
    actualDocumentId,
    documentId,
    content,
    getCurrentIr: getCurrentIrForModeSwitch,
    documentMetadata,
    setDocumentMetadata,
    updateContent,
  });

  const handleEditModeChangeStable = useCallback(
    async (next: 'markdown' | 'latex') => {
      await handleEditModeChange(next);
    },
    [handleEditModeChange]
  );

  const docKey = actualDocumentId || documentId || null;
  const { canonicalIr, getCurrentIr } = useCanonicalIrState({
    docKey,
    editMode,
    content,
    latexDraft,
    mdIr: irState.ir,
    documentMetadata,
    setDocumentMetadata,
    latexEditNonce: latexEditNonceRef.current,
  });

  useEffect(() => {
    getCurrentIrRef.current = getCurrentIr;
  }, [getCurrentIr]);

  const sidebarIr = canonicalIr ?? irState.ir;

  const bgForSg = useMemo(() => {
    if (!sidebarIr) return null;
    try {
      return extractBlockGraphFromIr(sidebarIr);
    } catch {
      return null;
    }
  }, [sidebarIr]);

  const hasMeaningfulContentForSg = useMemo(() => {
    const blocks = bgForSg?.blocks ?? [];
    // "Blank doc": no meaningful text blocks yet.
    // Avoid blocking bootstrap in that case; SG will be created on-the-fly as the user writes.
    return blocks.some((b) => {
      if (!b.text || b.text.trim().length < 10) return false;
      return b.type === 'paragraph' || b.type === 'list' || b.type === 'heading' || b.type === 'code' || b.type === 'math';
    });
  }, [bgForSg]);

  const shouldBootstrapSg = Boolean((actualDocumentId || documentId) && sidebarIr && !semanticGraph && hasMeaningfulContentForSg);

  // If a real document loads with content but no SG, we must build SG immediately (blocking).
  useEffect(() => {
    const docKeyForBootstrap = actualDocumentId || documentId;
    if (!docKeyForBootstrap) return;
    if (!shouldBootstrapSg) return;
    if (!bgForSg) return;
    const blocks = bgForSg.blocks ?? [];
    if (blocks.length === 0) return;

    // Only bootstrap once per doc id per editor session (retry resets this).
    if (didBootstrapSgRef.current === docKeyForBootstrap) return;
    didBootstrapSgRef.current = docKeyForBootstrap;

    setSgBootstrapError(null);
    setIsSgBootstrapping(true);
    setSgBootstrapDoneBlocks(0);
    setSgBootstrapTotalBlocks(blocks.length);

    const run = async () => {
      try {
        // Backend-orchestrated SG bootstrap job (frontend only polls progress).
        const started = await api.sg.bootstrapStart({
          documentId: docKeyForBootstrap,
          blocks: blocks.map((b) => ({ id: b.id, type: b.type, text: b.text })),
        });
        sgBootstrapJobIdRef.current = started.jobId;

        // Poll until done/error.
        await new Promise<void>((resolve, reject) => {
          let cancelled = false;
          const tick = async () => {
            if (cancelled) return;
            const jobId = sgBootstrapJobIdRef.current;
            if (!jobId) return;
            try {
              const st = await api.sg.bootstrapStatus(jobId);
              setSgBootstrapDoneBlocks(st.doneBlocks ?? 0);
              setSgBootstrapTotalBlocks(st.totalBlocks ?? blocks.length);
              if (st.stage === 'done') {
                resolve();
                return;
              }
              if (st.stage === 'error') {
                reject(new Error(st.error || 'Processing failed'));
                return;
              }
              setTimeout(tick, 350);
            } catch (e) {
              reject(e instanceof Error ? e : new Error('Processing failed'));
            }
          };
          void tick();
          return () => {
            cancelled = true;
          };
        });

        // Backend persisted SG; refresh local SG from document.
        await refreshSemanticGraph();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Processing failed';
        setSgBootstrapError(msg);
        // Allow retry.
        didBootstrapSgRef.current = null;
        sgBootstrapJobIdRef.current = null;
      } finally {
        setIsSgBootstrapping(false);
      }
    };

    void run();
  }, [actualDocumentId, documentId, shouldBootstrapSg, bgForSg, documentStyle, refreshSemanticGraph, sgBootstrapAttempt]);

  // Incremental SG refresh (on edits). Disabled while bootstrapping to avoid double-build.
  useSgRefresh({
    documentId: actualDocumentId || documentId,
    ir: sidebarIr,
    delta: irState.delta,
    semanticGraph: semanticGraph ?? null,
    saveSemanticGraphPatch,
    documentStyle,
    enabled: Boolean(actualDocumentId || documentId) && !isSgBootstrapping,
  });

  // SG is required for AI decisions: disable background paragraph analysis until SG is available.
  const aiAnalysisEnabled = !isSgBootstrapping && !(hasMeaningfulContentForSg && !semanticGraph);

  const currentTextStyle = (() => {
    const view = editorViewRef.current;
    if (!view) return 'paragraph' as const;
    try {
      const sel = view.state.selection.main;
      const line = view.state.doc.lineAt(sel.head).text;
      const trimmed = line.trimStart();
      return getSurfaceSyntax(editMode).detectLineStyle(trimmed);
    } catch {
      return 'paragraph' as const;
    }
  })();

  const { handleSidebarResizeStart, handleEditorPaneResizeStart } = useEditorLayoutSizing({
    sidebarRef,
    editorContainerRef,
    isResizingSidebar,
    setIsResizingSidebar,
    setSidebarWidth,
    isResizingEditorPane,
    setIsResizingEditorPane,
    setEditorPaneWidth,
  });

  // Inline edit helpers extracted to `editor-layout-inline-edit.ts`


  const { saveDocument, cleanupInsertedSources } = useEditorSaveWithCitationsCleanup({
    actualDocumentId,
    originalSaveDocument,
  });

  useProjectDocumentStyle({ projectId, setProjectName, setDocumentStyle, setEditingMode: setProjectEditingMode });

  const { getCursorScreenPosition } = useEditorCursorScreenPosition({
    editorViewRef,
    editorContainerRef,
    cursorPosition,
    thinkPanelOpen,
    inlineAIChatOpen,
    sidebarOpen,
    sidebarWidth,
    setCursorScreenPosition,
  });

  // Inline AI hint should only appear on click in the editor text area (not always-on).
  useEffect(() => {
    const el = editorContainerRef.current;
    if (!el) return;

    const clearTimer = () => {
      if (inlineAIHintHideTimerRef.current) {
        clearTimeout(inlineAIHintHideTimerRef.current);
        inlineAIHintHideTimerRef.current = null;
      }
    };

    const hide = () => {
      clearTimer();
      setInlineAIHintVisible(false);
    };

    const showSoonThenAutoHide = () => {
      clearTimer();
      setInlineAIHintVisible(true);
      inlineAIHintHideTimerRef.current = setTimeout(() => {
        setInlineAIHintVisible(false);
        inlineAIHintHideTimerRef.current = null;
      }, 2200);
    };

    const onPointerDown = (e: Event) => {
      if (thinkPanelOpen || inlineAIChatOpen) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Only show when clicking in the editor text area (next to text), not inside embedded widgets/toolbars.
      const inEditorText = Boolean(target.closest('.cm-content') || target.closest('.cm-line'));
      if (!inEditorText) return;
      const inEmbedded =
        Boolean(
          target.closest('.cm-embedded-figure-grid') ||
            target.closest('.cm-embedded-figure-card') ||
            target.closest('.cm-embedded-table')
        );
      if (inEmbedded) return;

      showSoonThenAutoHide();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Any typing should dismiss the hint.
      if (e.key && e.key.length === 1) hide();
      if (e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') hide();
    };

    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('keydown', onKeyDown, true);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('keydown', onKeyDown, true);
      clearTimer();
    };
  }, [thinkPanelOpen, inlineAIChatOpen]);

  const { undoRedo, latexUndoRedo, changeTracking } = useEditorHistoryAndChangeTracking({
    content,
    latexDraft,
    actualDocumentId,
    documentId,
    documentMetadata,
    cursorPosition,
    setCursorPosition,
    editorViewRef,
    currentSelectionRef,
    isUserInputRef,
    previousContentForHistoryRef,
    previousLatexForHistoryRef,
    setLatexDraft,
    setDocumentMetadata,
    setContentWithoutSave,
    updateContent,
    setPendingChangeContent,
    cleanupInsertedSources,
    saveDocument,
  });

  const activeUndoRedo = pickUndoRedo({
    editMode,
    markdown: undoRedo,
    latex: latexUndoRedo,
  });

  // Handle opening panel for a paragraph
  const handleOpenPanel = useCallback((paragraphId: string) => {
    setThinkPanelOpen(true);
    setOpenParagraphId(paragraphId);
    // Ensure paragraph is in Think mode
    handleModeToggleFromHook(paragraphId, 'think');
  }, [handleModeToggleFromHook]);

  // Handle closing panel
  const handleClosePanel = useCallback(() => {
    setThinkPanelOpen(false);
    setOpenParagraphId(null);
  }, []);


  useEditorVersionMetadata({
    actualDocumentId,
    lastSavedMs: lastSaved ? lastSaved.getTime() : null,
    latestVersion,
    selectedVersion,
    setLatestVersion,
    setSelectedVersion,
  });

  const handleContentChange = useCallback(
    (value: string) => {
      const safeLatestVersion = latestVersion ?? null;
      // Only allow editing if viewing the latest version
      // selectedVersion === null means latest, or selectedVersion === latestVersion means latest
      if (selectedVersion !== null) {
        // If a specific version is selected, check if it's the latest (type-safe comparison)
        if (safeLatestVersion === null || Number(selectedVersion) !== Number(safeLatestVersion)) {
          return; // Don't allow editing older versions
        }
        // If selectedVersion === latestVersion, allow editing (fall through)
      }
      // If selectedVersion === null, allow editing (fall through)
      // Mark this as user input before updating content
      isUserInputRef.current = true;
      const handlers: Record<'markdown' | 'latex', () => void> = {
        markdown: () => {
          updateContent(value);
        },
        latex: () => {
          // LaTeX edit surface:
          // - Persist the user-edited LaTeX (metadata.latex) via auto-save
          // - Update canonical IR via the debounced LaTeX->IR effect (for preview/outline)
          // - Do NOT derive or mutate XMD while typing LaTeX (only regenerate on explicit mode switch)
          const ensured = ensureLatexPreambleForLatexContent(value);
          const nextLatex = ensured.latex;
          latexEditNonceRef.current++;
          setLatexDraft(nextLatex);
          setDocumentMetadata((prev) => ({ ...(prev as any), lastEditedFormat: 'latex', latex: nextLatex }));

          if (latexAutoSaveTimeoutRef.current) {
            clearTimeout(latexAutoSaveTimeoutRef.current);
          }
          // Mirror the XMD auto-save delay so both editing surfaces persist changes similarly.
          latexAutoSaveTimeoutRef.current = setTimeout(() => {
            saveDocument(content, 'auto-save').catch(() => {});
          }, 2000);
        },
      };
      handlers[editMode === 'latex' ? 'latex' : 'markdown']();

      // Add to undo history (debounced to avoid too many history entries)
      // Only add if not in change tracking mode (change tracking handles its own history)
      if (!changeTracking.isTracking) {
        const history = getTypingHistoryAdapter({
          editMode,
          markdown: { debounceTimeoutRef, previousValueRef: previousContentForHistoryRef },
          latex: { debounceTimeoutRef: latexDebounceTimeoutRef, previousValueRef: previousLatexForHistoryRef },
        });

        if (history.debounceTimeoutRef.current) {
          clearTimeout(history.debounceTimeoutRef.current);
        }
        history.debounceTimeoutRef.current = setTimeout(() => {
          if (history.previousValueRef.current !== value) {
            // Capture current cursor position from editor if available
            let currentCursorPos = cursorPosition;
            if (editorViewRef.current && !currentCursorPos) {
              try {
                const selection = editorViewRef.current.state.selection.main;
                const line = editorViewRef.current.state.doc.lineAt(selection.head);
                currentCursorPos = { line: line.number, column: selection.head - line.from + 1 };
              } catch {
                // ignore
              }
            }
            activeUndoRedo.addToHistory({
              content: value,
              cursorPosition: currentCursorPos,
              selection: currentSelectionRef.current,
              timestamp: Date.now(),
            });
            history.previousValueRef.current = value;
          }
        }, 300);
      }
    },
    [
      latestVersion,
      selectedVersion,
      updateContent,
      setLatexDraft,
      setDocumentMetadata,
      saveDocument,
      content,
      editMode,
      changeTracking.isTracking,
      cursorPosition,
      activeUndoRedo,
    ]
  );

  // Handle selection changes from editor
  const handleSelectionChange = useCallback((selection: { from: number; to: number; text: string } | null) => {
    currentSelectionRef.current = selection;
  }, []);

  // Handle cursor position changes from editor
  const handleCursorPositionChange = useCallback((position: { line: number; column: number } | null) => {
    setCursorPosition(position);
  }, []);

  useEditorKeyboardShortcuts({
    selectedVersion,
    latestVersion,
    changeTracking: { isTracking: changeTracking.isTracking, cancelTracking: changeTracking.cancelTracking },
    undoRedo: activeUndoRedo,
    setViewMode,
    handleEditModeChange: handleEditModeChangeStable,
    content,
    saveDocument,
    thinkPanelOpen,
    cursorPosition,
    handleOpenPanel,
    getCursorScreenPosition,
    setCursorScreenPosition,
    setInlineAIChatOpen,
  });

  const handleFormat = useEditorFormatHandler({
    content,
    updateContent,
    selectedVersion,
    latestVersion,
    cursorPosition,
    editMode,
    handleContentChange,
    changeTracking: { isTracking: changeTracking.isTracking },
    undoRedo,
    latexUndoRedo,
    editorViewRef,
    currentSelectionRef,
    isUserInputRef,
    debounceTimeoutRef,
    latexDebounceTimeoutRef,
    previousContentForHistoryRef,
    previousLatexForHistoryRef,
  });

  return (
    <div className="flex h-screen bg-vscode-bg text-vscode-text">
      {/* Sidebar */}
      <div ref={sidebarRef} className="flex items-stretch relative h-full">
        {/* Overlay for sidebar - prevents interaction when inline chat or think panel is open */}
        {sidebarOpen && (inlineAIChatOpen || thinkPanelOpen) && (
          <div className="absolute inset-0 bg-black/30 pointer-events-auto" style={{ zIndex: 45 }} />
        )}
        
        {/* Collapsed sidebar chevron button - just the chevron, no full height */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-12 bg-vscode-sidebar border-r border-vscode-border hover:bg-vscode-active transition-colors flex items-center justify-center z-10"
            aria-label="Expand sidebar"
          >
            <ChevronRightIcon className="w-5 h-5 text-vscode-text-secondary" />
          </button>
        )}
        {sidebarOpen && (
          <div style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }} className="relative h-full">
            <EditorSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          content={content}
          ir={sidebarIr}
          projectName={projectName}
          documentId={actualDocumentId}
          lastSaved={lastSaved}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
        onRollback={async (versionNumber: number) => {
          await rollbackToVersion({
            actualDocumentId,
            versionNumber,
            setSelectedVersion,
            updateContent,
          });
        }}
        onVersionSelect={async (versionNumber: number) => {
          await selectVersionForViewing({
            actualDocumentId,
            versionNumber,
            latestVersion,
            setLatestVersion,
            setSelectedVersion,
            updateContent,
            setContentWithoutSave,
          });
        }}
      />
          </div>
        )}
      {/* Resizable Splitter with Chevron */}
      {sidebarOpen && (
        <div className="flex-shrink-0 relative group h-full">
          {/* Chevron button attached to splitter */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            onMouseDown={(e) => {
              // Prevent resize from starting when clicking chevron
              e.stopPropagation();
            }}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-6 h-12 bg-vscode-sidebar border-r border-vscode-border hover:bg-vscode-active transition-colors flex items-center justify-center z-20 rounded-l pointer-events-auto"
            aria-label="Collapse sidebar"
          >
            <ChevronLeftIcon className="w-4 h-4 text-vscode-text-secondary" />
          </button>
          {/* Resizable splitter */}
          <div
            onMouseDown={handleSidebarResizeStart}
            className={`w-1 h-full cursor-col-resize hover:bg-vscode-blue transition-colors z-10 ${
              isResizingSidebar ? 'bg-vscode-blue' : ''
            }`}
            style={{ userSelect: 'none' }}
          />
        </div>
      )}
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Overlay for toolbars and editor - prevents interaction when inline chat or think panel is open */}
        {(inlineAIChatOpen || thinkPanelOpen) && (
          <div className="absolute inset-0 bg-black/30 pointer-events-auto" style={{ zIndex: 45 }} />
        )}
        
        {/* Toolbar */}
        <EditorToolbar
          projectId={projectId}
          documentTitle={documentTitle}
          isSaving={isSaving}
          lastSaved={lastSaved}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          editMode={editMode}
          onEditModeChange={handleEditModeChangeStable}
          canUndo={activeUndoRedo.canUndo}
          canRedo={activeUndoRedo.canRedo}
          onUndo={() => {
            if (changeTracking.isTracking) {
              changeTracking.cancelTracking();
            }
            activeUndoRedo.undo();
          }}
          onRedo={() => {
            if (changeTracking.isTracking) {
              changeTracking.cancelTracking();
            }
            activeUndoRedo.redo();
          }}
        />

        {/* Formatting Toolbar */}
        <FormattingToolbar
          onFormat={handleFormat}
          viewMode={viewMode}
          currentStyle={currentTextStyle}
          showFullAiChatButton={isFullAI && !rightAiChatOpen}
          onOpenFullAiChat={() => {
            setRightAiChatOpen(true);
            requestAnimationFrame(() => rightAiInputRef.current?.focus());
          }}
        />

        {/* Change Tracking Banner - shown at top when tracking is active */}
        {changeTracking.isTracking && (
          <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between z-50">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <span className="text-green-400">●</span>
              <span>You have {changeTracking.changes.length} pending change{changeTracking.changes.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  changeTracking.cancelTracking();
                }}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded border border-gray-600 transition-colors"
              >
                Undo
              </button>
              <button
                onClick={() => {
                  changeTracking.applyChanges();
                }}
                disabled={changeTracking.changes.length === 0}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors"
              >
                Keep
              </button>
            </div>
          </div>
        )}

        {/* Editor/Preview */}
        <div className="flex-1 overflow-hidden flex relative" ref={editorContainerRef}>
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div
              className={
                viewMode === 'split'
                  ? 'overflow-hidden relative'
                  : 'flex-1 overflow-hidden relative'
              }
              style={
                viewMode === 'split'
                  ? {
                      width: editorPaneWidth > 0 ? `${editorPaneWidth}px` : '50%',
                      minWidth: '360px',
                      maxWidth: '80%',
                    }
                  : undefined
              }
            >
              {/* Inline AI Hint - Shows toned-down prompt */}
              {!thinkPanelOpen && !inlineAIChatOpen && cursorScreenPosition && cursorPosition && (
                <InlineAIHint
                  position={cursorScreenPosition}
                  visible={inlineAIHintVisible}
                  onActivate={() => {
                    setInlineAIChatOpen(true);
                    setInlineAIHintVisible(false);
                  }}
                />
              )}

              {/* Inline AI Chat - Cmd+K interface */}
              {inlineAIChatOpen && cursorScreenPosition && cursorPosition && (
                <InlineAIChat
                  position={cursorScreenPosition}
                  documentId={actualDocumentId}
                  editMode={editMode}
                  content={getActiveEditorText({ editMode, content, latexDraft })}
                  cursorPosition={cursorPosition}
                  selection={currentSelectionRef.current}
                  scopeKind={currentSelectionRef.current?.text?.trim() ? 'selection' : 'cursor_paragraph'}
                  scopeText={getCursorScopeText({
                    editMode,
                    selectionText: currentSelectionRef.current?.text ?? null,
                    cursorPosition,
                    content,
                    latexDraft,
                  })}
                  documentStyle={documentStyle}
                  onClose={() => {
                    setInlineAIChatOpen(false);
                  }}
                  onPreviewInlineEdit={async ({ prompt, mode, scopeStrategy = 'selection-or-prev-paragraph' }) => {
                    const caps = getSurfaceCapabilities(editMode);
                    if (!caps.supportsInlineAiEdits) return { operations: [], previewText: '', newContent: latexDraft };
                    if (!cursorPosition) {
                      return { operations: [], previewText: '', newContent: content };
                    }

                    const selection = currentSelectionRef.current;
                    const cursorLine = cursorPosition.line - 1; // Convert to 0-based

                    // If we have a selection, prefer applying operations to that exact span.
                    if (selection && selection.text && selection.text.trim().length > 0) {
                      const blocks: InlineEditBlock[] = [
                        {
                          id: 'sel',
                          kind: 'paragraph',
                          text: selection.text,
                          start: selection.from,
                          end: selection.to,
                        },
                      ];

                      const result = await api.ai.inline.edit({
                        prompt,
                        mode: 'update',
                        blocks,
                        cursorBlockId: 'sel',
                      });

                      const operations = result.operations || [];
                      const previewText = operations.map((op) => op.content).join('\n\n').trim();
                      const newContent = applyInlineOperations(content, blocks, operations);
                      return { operations, previewText, newContent };
                    }

                    // No selection: use block-based targeting.
                    const { blocks, cursorBlockId } = buildInlineBlocksAroundCursor(content, cursorLine);
                    let targetBlockId = cursorBlockId;

                    if (scopeStrategy === 'selection-or-prev-paragraph') {
                      // Previous paragraph block if available.
                      const idx = blocks.findIndex((b) => b.id === cursorBlockId);
                      for (let i = idx - 1; i >= 0; i--) {
                        if (blocks[i]?.kind === 'paragraph') {
                          targetBlockId = blocks[i].id;
                          break;
                        }
                      }
                    }

                    if (scopeStrategy === 'selection-or-cursor-paragraph') {
                      // Cursor paragraph block if available; otherwise fall back to previous paragraph.
                      const cursorBlock = blocks.find((b) => b.id === cursorBlockId);
                      if (cursorBlock?.kind === 'paragraph') {
                        targetBlockId = cursorBlockId;
                      } else {
                        const idx = blocks.findIndex((b) => b.id === cursorBlockId);
                        for (let i = idx - 1; i >= 0; i--) {
                          if (blocks[i]?.kind === 'paragraph') {
                            targetBlockId = blocks[i].id;
                            break;
                          }
                        }
                      }
                    }

                    // scopeStrategy === 'cursor' keeps cursorBlockId as-is (insert figure/table/etc.)

                    // For update-style operations, constrain the model to ONLY the target block
                    // by sending just that block as the editable surface.
                    if (mode === 'update') {
                      const target = blocks.find((b) => b.id === targetBlockId) || blocks.find((b) => b.id === cursorBlockId);
                      if (!target) {
                        return { operations: [], previewText: '', newContent: content };
                      }
                      const single: InlineEditBlock[] = [
                        { id: 'target', kind: target.kind, text: target.text, start: target.start, end: target.end },
                      ];
                      const result = await api.ai.inline.edit({
                        prompt,
                        mode: 'update',
                        blocks: single,
                        cursorBlockId: 'target',
                      });
                      const operations = result.operations || [];
                      const previewText = operations.map((op) => op.content).join('\n\n').trim();
                      const newContent = applyInlineOperations(content, single, operations);
                      return { operations, previewText, newContent };
                    }

                    const result = await api.ai.inline.edit({
                      prompt,
                      mode,
                      blocks,
                      cursorBlockId: targetBlockId,
                    });

                    const operations = result.operations || [];
                    const previewText = operations.map((op) => op.content).join('\n\n').trim();
                    const newContent = applyInlineOperations(content, blocks, operations);
                    return { operations, previewText, newContent };
                  }}
                  onPreviewInsertAtCursor={async ({ content: insertContent, placement = 'after' }) => {
                    return previewInsertAtCursor({
                      cursorPosition,
                      editMode,
                      latexDraft,
                      content,
                      insertContent,
                      placement: placement === 'before' ? 'before' : 'after',
                    });
                  }}
                  onApplyInlinePreview={async (preview) => {
                    const caps = getSurfaceCapabilities(editMode);
                    if (!caps.supportsInlineAiEdits) {
                      handleContentChange(preview.newContent);
                      setInlineAIChatOpen(false);
                      return;
                    }

                    // Apply the already-previewed content without another AI call
                    setPendingChangeContent({ original: content, new: preview.newContent });
                    changeTracking.startTracking(preview.newContent, content);
                    setInlineAIChatOpen(false);
                  }}
                  onSend={async (message) => {
                    if (!cursorPosition) return;
                    
                    try {
                      setIsGeneratingContent(true);
                      
                      const lines = content.split('\n');
                      const cursorLine = cursorPosition.line - 1; // Convert to 0-based

                      const { blocks, cursorBlockId } = buildInlineBlocksAroundCursor(content, cursorLine);
                      const result = await api.ai.inline.edit({
                        prompt: message,
                        mode: 'insert',
                        blocks,
                        cursorBlockId,
                      });

                      const newContent = applyInlineOperations(content, blocks, result.operations || []);
                      
                      // Use change tracking like brainstorming does
                      setPendingChangeContent({ original: content, new: newContent });
                      changeTracking.startTracking(newContent, content);
                      setInlineAIChatOpen(false);
                      setIsGeneratingContent(false);
                    } catch (error) {
                      console.error('Failed to generate content:', error);
                      if (error instanceof Error) {
                        console.error('Error details:', error.message, error);
                      }
                      // TODO: Show error to user
                      setInlineAIChatOpen(false);
                      setIsGeneratingContent(false);
                    }
                  }}
                  onQuickOption={async (option: QuickOption) => {
                    if (!cursorPosition) return;
                    
                    try {
                      setIsGeneratingContent(true);
                      
                      const lines = content.split('\n');
                      const cursorLine = cursorPosition.line - 1; // Convert to 0-based

                      const { blocks, cursorBlockId } = buildInlineBlocksAroundCursor(content, cursorLine);
                      // Use the action from the quick option as the prompt
                      const result = await api.ai.inline.edit({
                        prompt: option.action,
                        mode: 'update',
                        blocks,
                        cursorBlockId,
                      });

                      const newContent = applyInlineOperations(content, blocks, result.operations || []);
                      
                      // Use change tracking like brainstorming does
                      setPendingChangeContent({ original: content, new: newContent });
                      changeTracking.startTracking(newContent, content);
                      setInlineAIChatOpen(false);
                      setIsGeneratingContent(false);
                    } catch (error) {
                      console.error('Failed to generate content:', error);
                      if (error instanceof Error) {
                        console.error('Error details:', error.message, error);
                      }
                      // TODO: Show error to user
                      setInlineAIChatOpen(false);
                      setIsGeneratingContent(false);
                    }
                  }}
                />
              )}

              <ActiveEditorSurface
                editMode={editMode}
                markdown={{
                  value: pendingChangeContent?.new ?? content,
                  onChange: handleContentChange,
                  onSelectionChange: handleSelectionChange,
                  onCursorPositionChange: handleCursorPositionChange,
                  onDocumentAIMetricsChange: (payload) => setDocAIMetrics(payload),
                  paragraphModes,
                  documentId: actualDocumentId,
                  aiAnalysisEnabled,
                  thinkPanelOpen,
                  openParagraphId,
                  onOpenPanel: handleOpenPanel,
                  onEditorViewReady: (view) => {
                    editorViewRef.current = view;
                  },
                  readOnly: (() => {
                    if (changeTracking.isTracking) return true;
                    if (thinkPanelOpen) return true;
                    if (inlineAIChatOpen) return true;
                    let safeLatestVersion: number | null = null;
                    if (latestVersion !== undefined && latestVersion !== null && !isNaN(Number(latestVersion))) {
                      safeLatestVersion = Number(latestVersion);
                    }
                    return (
                      selectedVersion !== null &&
                      safeLatestVersion !== null &&
                      Number(selectedVersion) !== Number(safeLatestVersion)
                    );
                  })(),
                  changes: changeTracking.mappedChanges,
                  onAcceptChange: changeTracking.acceptChange,
                  onRejectChange: changeTracking.rejectChange,
                  onSaveWithType: async (contentToSave, changeType) => {
                    await saveDocument(contentToSave, changeType);
                  },
                }}
                latex={{
                  value: latexDraft,
                  onChange: handleContentChange,
                  onCursorPositionChange: handleCursorPositionChange,
                  onEditorViewReady: (view) => {
                    editorViewRef.current = view;
                  },
                  readOnly: (() => {
                    if (changeTracking.isTracking) return true;
                    if (thinkPanelOpen) return true;
                    if (inlineAIChatOpen) return true;
                    let safeLatestVersion: number | null = null;
                    if (latestVersion !== undefined && latestVersion !== null && !isNaN(Number(latestVersion))) {
                      safeLatestVersion = Number(latestVersion);
                    }
                    return (
                      selectedVersion !== null &&
                      safeLatestVersion !== null &&
                      Number(selectedVersion) !== Number(safeLatestVersion)
                    );
                  })(),
                }}
              />
              
            </div>
          )}
          
          {/* Think Mode Panel - Shows on left when opened */}
          <ThinkModePanel 
            isOpen={thinkPanelOpen}
            onClose={handleClosePanel}
            paragraphId={openParagraphId}
            content={content}
            documentId={actualDocumentId}
            projectId={projectId}
            onGeneratingChange={setIsGeneratingContent}
            onContentGenerated={async (generatedContent, mode, _sources, scope = 'block') => {
              const newContent = applyThinkModeGeneratedContentToXmd({
                content,
                openParagraphId,
                generatedContent,
                mode,
                scope: scope === 'document' ? 'document' : 'block',
              });
              if (!newContent) return;

              setPendingChangeContent({ original: content, new: newContent });
              changeTracking.startTracking(newContent, content);
              setIsGeneratingContent(false);
            }}
          />
          
          {viewMode === 'split' && (
            <div
              onMouseDown={handleEditorPaneResizeStart}
              className={`w-1 h-full cursor-col-resize hover:bg-vscode-blue transition-colors z-10 ${
                isResizingEditorPane ? 'bg-vscode-blue' : 'bg-transparent'
              }`}
              style={{ userSelect: 'none' }}
              aria-label="Resize editor pane"
            />
          )}

          {(viewMode === 'preview' || viewMode === 'split' || viewMode === 'ir') && (
            <div
              className={
                viewMode === 'split'
                  ? 'flex-1 overflow-hidden'
                  : 'flex-1 overflow-hidden'
              }
            >
              <div className="h-full">
                <IrPreview docId={actualDocumentId || documentId} content={content} ir={sidebarIr} />
              </div>
            </div>
          )}

          {/* Blocking Progress Overlay - shown when generating content OR when bootstrapping SG */}
          {(isGeneratingContent || isSgBootstrapping || (shouldBootstrapSg && Boolean(sgBootstrapError))) && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] pointer-events-none">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-4 min-w-[260px] pointer-events-auto">
                {sgBootstrapError ? (
                  <>
                    <div className="text-sm text-red-300 text-center">Processing failed</div>
                    <div className="text-xs text-gray-400 text-center max-w-[420px] whitespace-pre-wrap">{sgBootstrapError}</div>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded bg-vscode-blue hover:bg-blue-600 text-white text-xs transition-colors"
                      onClick={() => {
                        didBootstrapSgRef.current = null;
                        setSgBootstrapError(null);
                        setSgBootstrapAttempt((n) => n + 1);
                      }}
                    >
                      Retry
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 border-4 border-gray-600 border-t-vscode-blue rounded-full animate-spin" />
                    <div className="text-sm text-gray-400">
                      {isGeneratingContent
                        ? busyOverlayMessage
                        : sgBootstrapTotalBlocks > 0
                          ? `Processing… (${Math.min(sgBootstrapDoneBlocks, sgBootstrapTotalBlocks)}/${sgBootstrapTotalBlocks} blocks)`
                          : 'Processing…'}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Right-side AI chat panel */}
          <ChatPanel
            isOpen={rightAiChatOpen}
            isFullAI={isFullAI}
            inputRef={rightAiInputRef}
            semanticGraph={semanticGraph ?? null}
            onOpen={() => {
              setRightAiChatOpen(true);
              requestAnimationFrame(() => rightAiInputRef.current?.focus());
            }}
            onClose={() => setRightAiChatOpen(false)}
          />
        </div>

        {/* Status Bar */}
        <EditorStatusBar
          isSaving={isSaving}
          lastSaved={lastSaved}
          content={content}
          docAI={docAIMetrics ?? undefined}
        />
      </div>
    </div>
  );
}

