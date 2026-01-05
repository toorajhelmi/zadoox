'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { EditorSidebar } from './editor-sidebar';
import { EditorToolbar } from './editor-toolbar';
import { EditorStatusBar } from './editor-status-bar';
import { AIEnhancedEditor } from './ai-enhanced-editor';
import { CodeMirrorEditor } from './codemirror-editor';
import { IrPreview } from './ir-preview';
import { FormattingToolbar } from './formatting-toolbar';
import { ThinkModePanel } from './think-mode-panel';
import { InlineAIChat } from './inline-ai-chat';
import { InlineAIHint } from './inline-ai-hint';
import { useDocumentState } from '@/hooks/use-document-state';
import { useIrDocument } from '@/hooks/use-ir-document';
import { api } from '@/lib/api/client';
import type { FormatType } from './floating-format-menu';
import type { ResearchSource, DocumentStyle } from '@zadoox/shared';
import type { InlineEditBlock, InlineEditOperation } from '@zadoox/shared';
import type { QuickOption } from '@/lib/services/context-options';
import { irToLatexDocument, irToXmd, parseLatexToIr, parseXmdToIr } from '@zadoox/shared';
import { computeDocIrHash } from './ir-hash';
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

interface EditorLayoutProps {
  projectId: string;
  documentId: string;
}

type ViewMode = 'edit' | 'preview' | 'split' | 'ir';

type SidebarTab = 'outline' | 'history';

export function EditorLayout({ projectId, documentId }: EditorLayoutProps) {
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
  const [openParagraphId, setOpenParagraphId] = useState<string | null>(null);
  const [inlineAIChatOpen, setInlineAIChatOpen] = useState(false);
  const [documentStyle, setDocumentStyle] = useState<DocumentStyle>('other');
  const [projectName, setProjectName] = useState<string>('');
  const currentSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null);
  const [pendingChangeContent, setPendingChangeContent] = useState<{ original: string; new: string } | null>(null);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [busyOverlayMessage, setBusyOverlayMessage] = useState<string>('Generating content...');
  const previousContentForHistoryRef = useRef<string>(content);
  const previousLatexForHistoryRef = useRef<string>('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latexDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  const { editMode, setEditMode, latexDraft, setLatexDraft, handleEditModeChange } = useEditorEditMode({
    actualDocumentId,
    documentId,
    content,
    ir: irState.ir,
    documentMetadata,
    setDocumentMetadata,
    updateContent,
  });

  // IMPORTANT: Outline/preview should be driven from the canonical IR (derived from XMD).
  // The LaTeX surface is just another edit mode; it must update IR (via LaTeX -> IR -> XMD),
  // but we should not run a separate LaTeX->IR parse for outline, otherwise the outline can drift.
  const sidebarIr = irState.ir;

  const currentTextStyle = (() => {
    const view = editorViewRef.current;
    if (!view) return 'paragraph' as const;
    try {
      const sel = view.state.selection.main;
      const line = view.state.doc.lineAt(sel.head).text;
      const trimmed = line.trimStart();
      if (editMode === 'latex') {
        if (/^\\title\{/.test(trimmed)) return 'title' as const;
        if (/^\\section\{/.test(trimmed)) return 'heading1' as const;
        if (/^\\subsection\{/.test(trimmed)) return 'heading2' as const;
        if (/^\\subsubsection\{/.test(trimmed)) return 'heading3' as const;
        return 'paragraph' as const;
      }

      const t = /^@\s+/.exec(trimmed);
      if (t) return 'title' as const;
      const m = /^(#{1,6})\s+/.exec(trimmed);
      if (!m) return 'paragraph' as const;
      const level = m[1].length;
      if (level === 1) return 'heading1' as const; // Section
      if (level === 2) return 'heading2' as const; // Subsection
      return 'heading3' as const; // Subsubsection+
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

  useProjectDocumentStyle({ projectId, setProjectName, setDocumentStyle });

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
          // LaTeX edit surface -> LaTeX -> IR (canonical) -> XMD (derived content)
          const ensured = ensureLatexPreambleForLatexContent(value);
          const nextLatex = ensured.latex;
          setLatexDraft(nextLatex);
          try {
            const nextIr = parseLatexToIr({ docId: actualDocumentId || documentId, latex: nextLatex });
            const nextXmd = irToXmd(nextIr);
            const nextIrHash = computeDocIrHash(nextIr);
            const nextMeta = {
              ...(documentMetadata as any),
              lastEditedFormat: 'latex',
              latex: nextLatex,
              // Keep mapping: this LaTeX draft corresponds to this IR hash.
              latexIrHash: nextIrHash,
            };
            setDocumentMetadata(nextMeta);
            // Avoid churn: only update XMD if it actually changes.
            if (nextXmd !== content) updateContent(nextXmd);
          } catch (err) {
            // Never block typing; keep draft visible even if conversion fails.
            console.error('Failed to parse LaTeX to IR:', err);
            const nextMeta = { ...(documentMetadata as any), lastEditedFormat: 'latex', latex: nextLatex };
            setDocumentMetadata(nextMeta);
          }
        },
      };
      handlers[editMode === 'latex' ? 'latex' : 'markdown']();

      // Add to undo history (debounced to avoid too many history entries)
      // Only add if not in change tracking mode (change tracking handles its own history)
      if (!changeTracking.isTracking && editMode === 'markdown') {
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(() => {
          if (previousContentForHistoryRef.current !== value) {
            // Capture current cursor position from editor if available
            let currentCursorPos = cursorPosition;
            if (editorViewRef.current && !currentCursorPos) {
              try {
                const selection = editorViewRef.current.state.selection.main;
                const line = editorViewRef.current.state.doc.lineAt(selection.head);
                currentCursorPos = { line: line.number, column: selection.head - line.from + 1 };
              } catch {
                // Failed to get cursor position, use stored value or null
              }
            }
            
            undoRedo.addToHistory({
              content: value,
              cursorPosition: currentCursorPos,
              selection: currentSelectionRef.current,
              timestamp: Date.now(),
            });
            previousContentForHistoryRef.current = value;
          }
        }, 300); // Debounce for 300ms
      }

      // Track undo/redo for LaTeX draft edits too (separate history from XMD).
      if (!changeTracking.isTracking && editMode === 'latex') {
        if (latexDebounceTimeoutRef.current) {
          clearTimeout(latexDebounceTimeoutRef.current);
        }
        latexDebounceTimeoutRef.current = setTimeout(() => {
          if (previousLatexForHistoryRef.current !== value) {
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
            latexUndoRedo.addToHistory({
              content: value,
              cursorPosition: currentCursorPos,
              selection: currentSelectionRef.current,
              timestamp: Date.now(),
            });
            previousLatexForHistoryRef.current = value;
          }
        }, 300);
      }
    },
    [
      content,
      updateContent,
      selectedVersion,
      latestVersion,
      cursorPosition,
      undoRedo,
      changeTracking.isTracking,
      editMode,
      actualDocumentId,
      documentId,
      documentMetadata,
      setDocumentMetadata,
      latexUndoRedo,
      setLatexDraft,
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
    editMode,
    undoRedo,
    latexUndoRedo,
    setViewMode,
    handleEditModeChange: handleEditModeChange,
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
          onEditModeChange={handleEditModeChange}
          canUndo={editMode === 'latex' ? latexUndoRedo.canUndo : undoRedo.canUndo}
          canRedo={editMode === 'latex' ? latexUndoRedo.canRedo : undoRedo.canRedo}
          onUndo={() => {
            if (changeTracking.isTracking) {
              changeTracking.cancelTracking();
            }
            if (editMode === 'latex') latexUndoRedo.undo();
            else undoRedo.undo();
          }}
          onRedo={() => {
            if (changeTracking.isTracking) {
              changeTracking.cancelTracking();
            }
            if (editMode === 'latex') latexUndoRedo.redo();
            else undoRedo.redo();
          }}
        />

        {/* Formatting Toolbar */}
        <FormattingToolbar
          onFormat={handleFormat}
          viewMode={viewMode}
          currentStyle={currentTextStyle}
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
                  visible={true}
                  onActivate={() => {
                    setInlineAIChatOpen(true);
                  }}
                />
              )}

              {/* Inline AI Chat - Cmd+K interface */}
              {inlineAIChatOpen && cursorScreenPosition && cursorPosition && (
                <InlineAIChat
                  position={cursorScreenPosition}
                  documentId={actualDocumentId}
                  editMode={editMode}
                  content={editMode === 'latex' ? latexDraft : content}
                  cursorPosition={cursorPosition}
                  selection={currentSelectionRef.current}
                  scopeKind={currentSelectionRef.current?.text?.trim() ? 'selection' : 'cursor_paragraph'}
                  scopeText={(() => {
                    const sel = currentSelectionRef.current;
                    if (sel && sel.text && sel.text.trim().length > 0) return sel.text;

                    if (!cursorPosition) return '';
                    if (editMode === 'latex') {
                      const lines = latexDraft.split('\n');
                      const idx = Math.max(0, Math.min(cursorPosition.line - 1, Math.max(0, lines.length - 1)));
                      return (lines[idx] ?? '').trim();
                    }

                    const cursorLine = cursorPosition.line - 1;
                    const { blocks, cursorBlockId } = buildInlineBlocksAroundCursor(content, cursorLine);
                    const cursorBlock = blocks.find((b) => b.id === cursorBlockId);
                    if (cursorBlock?.kind === 'paragraph') return cursorBlock.text;

                    // Fallback: nearest previous paragraph in window
                    const idx = blocks.findIndex((b) => b.id === cursorBlockId);
                    for (let i = idx - 1; i >= 0; i--) {
                      if (blocks[i]?.kind === 'paragraph') return blocks[i].text;
                    }
                    return cursorBlock?.text || '';
                  })()}
                  documentStyle={documentStyle}
                  onClose={() => {
                    setInlineAIChatOpen(false);
                  }}
                  onPreviewInlineEdit={async ({ prompt, mode, scopeStrategy = 'selection-or-prev-paragraph' }) => {
                    if (editMode === 'latex') {
                      // Inline edits are currently markdown/XMD-only. Keep LaTeX surface stable.
                      return { operations: [], previewText: '', newContent: latexDraft };
                    }
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
                    if (editMode === 'latex') {
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

              {editMode === 'markdown' ? (
                <AIEnhancedEditor
                  value={pendingChangeContent?.new ?? content}
                  onChange={handleContentChange}
                  onSelectionChange={handleSelectionChange}
                  onCursorPositionChange={handleCursorPositionChange}
                  onDocumentAIMetricsChange={(payload) => setDocAIMetrics(payload)}
                  model="auto"
                  paragraphModes={paragraphModes}
                  documentId={actualDocumentId}
                  thinkPanelOpen={thinkPanelOpen}
                  openParagraphId={openParagraphId}
                  onOpenPanel={handleOpenPanel}
                  onEditorViewReady={(view) => {
                    editorViewRef.current = view;
                  }}
                  readOnly={(() => {
                    // Disable editing when change tracking is active
                    if (changeTracking.isTracking) {
                      return true;
                    }
                    // Disable editing when Think panel is open
                    if (thinkPanelOpen) {
                      return true;
                    }
                    // Disable editing when inline AI chat is open
                    if (inlineAIChatOpen) {
                      return true;
                    }
                    // Handle undefined/null latestVersion and ensure it's a valid number
                    let safeLatestVersion: number | null = null;
                    if (latestVersion !== undefined && latestVersion !== null && !isNaN(Number(latestVersion))) {
                      safeLatestVersion = Number(latestVersion);
                    }
                    const isReadOnly =
                      selectedVersion !== null &&
                      safeLatestVersion !== null &&
                      Number(selectedVersion) !== Number(safeLatestVersion);
                    return isReadOnly;
                  })()}
                  changes={changeTracking.mappedChanges}
                  onAcceptChange={changeTracking.acceptChange}
                  onRejectChange={changeTracking.rejectChange}
                  onSaveWithType={async (contentToSave, changeType) => {
                    await saveDocument(contentToSave, changeType);
                  }}
                />
              ) : (
                <CodeMirrorEditor
                  value={latexDraft}
                  onChange={handleContentChange}
                  onCursorPositionChange={handleCursorPositionChange}
                  onEditorViewReady={(view) => {
                    editorViewRef.current = view;
                  }}
                  language="plain"
                  enableFormatMenu={false}
                  readOnly={(() => {
                    if (changeTracking.isTracking) return true;
                    if (thinkPanelOpen) return true;
                    if (inlineAIChatOpen) return true;
                    let safeLatestVersion: number | null = null;
                    if (latestVersion !== undefined && latestVersion !== null && !isNaN(Number(latestVersion))) {
                      safeLatestVersion = Number(latestVersion);
                    }
                    const isReadOnly =
                      selectedVersion !== null &&
                      safeLatestVersion !== null &&
                      Number(selectedVersion) !== Number(safeLatestVersion);
                    return isReadOnly;
                  })()}
                />
              )}
              
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

          {/* Progress Overlay - shown when generating content */}
          {isGeneratingContent && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] pointer-events-none">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-4 min-w-[200px] pointer-events-auto">
                <div className="w-8 h-8 border-4 border-gray-600 border-t-vscode-blue rounded-full animate-spin" />
                <div className="text-sm text-gray-400">{busyOverlayMessage}</div>
              </div>
            </div>
          )}
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

