'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { EditorSidebar } from './editor-sidebar';
import { EditorToolbar } from './editor-toolbar';
import { EditorStatusBar } from './editor-status-bar';
import { AIEnhancedEditor } from './ai-enhanced-editor';
import { MarkdownPreview } from './markdown-preview';
import { IrPreview } from './ir-preview';
import { FormattingToolbar } from './formatting-toolbar';
import { ThinkModePanel } from './think-mode-panel';
import { InlineAIChat } from './inline-ai-chat';
import { InlineAIHint } from './inline-ai-hint';
import { useDocumentState } from '@/hooks/use-document-state';
import { useIrDocument } from '@/hooks/use-ir-document';
import { api } from '@/lib/api/client';
import type { FormatType } from './floating-format-menu';
import { useChangeTracking } from '@/hooks/use-change-tracking';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import type { ResearchSource, DocumentStyle } from '@zadoox/shared';
import type { InlineEditBlock, InlineEditOperation } from '@zadoox/shared';
import { extractCitedSourceIds } from '@/lib/utils/citation';
import type { QuickOption } from '@/lib/services/context-options';

interface EditorLayoutProps {
  projectId: string;
  documentId: string;
}

type ViewMode = 'edit' | 'preview' | 'split' | 'ir';

type SidebarTab = 'outline' | 'history';

export function EditorLayout({ projectId, documentId }: EditorLayoutProps) {
  const { content, documentTitle, updateContent, setContentWithoutSave, isSaving, lastSaved, documentId: actualDocumentId, saveDocument: originalSaveDocument, paragraphModes, handleModeToggle: handleModeToggleFromHook } = useDocumentState(documentId, projectId);
  const previousContentRef = useRef<string>(content);
  
  // Update previousContentRef when content changes from outside (e.g., document load)
  useEffect(() => {
    previousContentRef.current = content;
  }, [content]);
  
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
  const currentSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null);
  const [pendingChangeContent, setPendingChangeContent] = useState<{ original: string; new: string } | null>(null);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [busyOverlayMessage, setBusyOverlayMessage] = useState<string>('Generating content...');
  const previousContentForHistoryRef = useRef<string>(content);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorViewRef = useRef<import('@codemirror/view').EditorView | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isUserInputRef = useRef<boolean>(false); // Track if content change is from user input

  // Phase 11: keep IR updated as XMD changes (debounced), compute node-level delta + events.
  const irState = useIrDocument({
    docId: actualDocumentId || documentId,
    xmd: content,
    debounceMs: 250,
    enabled: Boolean(actualDocumentId || documentId),
  });

  // Sidebar resize handlers
  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  // Editor/preview splitter resize handlers (split + compare modes)
  const handleEditorPaneResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingEditorPane(true);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('editor-pane-width');
      if (saved) {
        const next = parseInt(saved, 10);
        if (Number.isFinite(next) && next > 0) {
          setEditorPaneWidth(next);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const MIN_SIDEBAR_WIDTH = 150;
    const MAX_SIDEBAR_WIDTH = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 600;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (!sidebarRef.current) return;
      
      // Get the sidebar container's left position
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - sidebarRect.left;
      const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
      setSidebarWidth(clampedWidth);
      localStorage.setItem('editor-sidebar-width', clampedWidth.toString());
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    if (!isResizingEditorPane) return;

    const MIN_EDITOR_WIDTH = 360;
    const MIN_PREVIEW_WIDTH = 360;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (!editorContainerRef.current) return;

      const rect = editorContainerRef.current.getBoundingClientRect();
      const raw = e.clientX - rect.left;
      const maxEditor = Math.max(MIN_EDITOR_WIDTH, rect.width - MIN_PREVIEW_WIDTH);
      const clamped = Math.max(MIN_EDITOR_WIDTH, Math.min(maxEditor, raw));

      setEditorPaneWidth(clamped);
      try {
        localStorage.setItem('editor-pane-width', clamped.toString());
      } catch {
        // ignore
      }
    };

    const handleMouseUp = () => {
      setIsResizingEditorPane(false);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingEditorPane]);

  function buildInlineBlocksAroundCursor(fullText: string, cursorLine0: number) {
    const lines = fullText.split('\n');
    const startLine = Math.max(0, cursorLine0 - 40);
    const endLine = Math.min(lines.length - 1, cursorLine0 + 40);

    let prefixOffset = 0;
    for (let i = 0; i < startLine; i++) prefixOffset += (lines[i]?.length || 0) + 1;

    const windowLines = lines.slice(startLine, endLine + 1);
    const windowText = windowLines.join('\n');

    const blocks: InlineEditBlock[] = [];
    const isBlank = (s: string) => s.trim().length === 0;

    const windowOffsets: number[] = [];
    {
      let off = 0;
      for (const l of windowLines) {
        windowOffsets.push(off);
        off += l.length + 1;
      }
    }

    let i = 0;
    let blockIndex = 0;
    while (i < windowLines.length) {
      const line = windowLines[i] ?? '';
      const lineTrim = line.trim();

      const startInWindow = windowOffsets[i] ?? 0;

      // Code fence block
      if (lineTrim.startsWith('```')) {
        let j = i + 1;
        while (j < windowLines.length) {
          const t = (windowLines[j] ?? '').trim();
          if (t.startsWith('```')) {
            j++;
            break;
          }
          j++;
        }
        const endInWindow = j < windowLines.length ? (windowOffsets[j] ?? windowText.length) : windowText.length;
        const text = windowText.slice(startInWindow, endInWindow);
        blocks.push({
          id: `b${blockIndex++}`,
          kind: 'code',
          text,
          start: prefixOffset + startInWindow,
          end: prefixOffset + endInWindow,
        });
        i = j;
        continue;
      }

      // Heading as its own block (include following blank line if present)
      if (lineTrim.startsWith('#')) {
        let j = i + 1;
        while (j < windowLines.length && isBlank(windowLines[j] ?? '')) j++;
        const endInWindow = j < windowLines.length ? (windowOffsets[j] ?? windowText.length) : windowText.length;
        const text = windowText.slice(startInWindow, endInWindow);
        blocks.push({
          id: `b${blockIndex++}`,
          kind: 'heading',
          text,
          start: prefixOffset + startInWindow,
          end: prefixOffset + endInWindow,
        });
        i = j;
        continue;
      }

      // Blank block (collapse contiguous blanks)
      if (isBlank(line)) {
        let j = i + 1;
        while (j < windowLines.length && isBlank(windowLines[j] ?? '')) j++;
        const endInWindow = j < windowLines.length ? (windowOffsets[j] ?? windowText.length) : windowText.length;
        const text = windowText.slice(startInWindow, endInWindow);
        blocks.push({
          id: `b${blockIndex++}`,
          kind: 'blank',
          text,
          start: prefixOffset + startInWindow,
          end: prefixOffset + endInWindow,
        });
        i = j;
        continue;
      }

      // List block (basic)
      const isListLine = (s: string) => {
        const t = s.trim();
        return /^([-*+])\s+/.test(t) || /^\d+\.\s+/.test(t);
      };
      if (isListLine(line)) {
        let j = i + 1;
        while (j < windowLines.length) {
          const l2 = windowLines[j] ?? '';
          if (isBlank(l2)) {
            j++;
            break;
          }
          if (!isListLine(l2)) break;
          j++;
        }
        const endInWindow = j < windowLines.length ? (windowOffsets[j] ?? windowText.length) : windowText.length;
        const text = windowText.slice(startInWindow, endInWindow);
        blocks.push({
          id: `b${blockIndex++}`,
          kind: 'list',
          text,
          start: prefixOffset + startInWindow,
          end: prefixOffset + endInWindow,
        });
        i = j;
        continue;
      }

      // Paragraph/other: consume until blank line
      let j = i + 1;
      while (j < windowLines.length && !isBlank(windowLines[j] ?? '')) {
        const t = (windowLines[j] ?? '').trim();
        if (t.startsWith('#') || t.startsWith('```')) break;
        j++;
      }
      if (j < windowLines.length && isBlank(windowLines[j] ?? '')) j++;
      const endInWindow = j < windowLines.length ? (windowOffsets[j] ?? windowText.length) : windowText.length;
      const text = windowText.slice(startInWindow, endInWindow);
      blocks.push({
        id: `b${blockIndex++}`,
        kind: 'paragraph',
        text,
        start: prefixOffset + startInWindow,
        end: prefixOffset + endInWindow,
      });
      i = j;
    }

    // Identify cursor block by absolute character offset
    let cursorPos = 0;
    for (let li = 0; li < cursorLine0 && li < lines.length; li++) cursorPos += (lines[li]?.length || 0) + 1;
    const cursorBlock = blocks.find(b => cursorPos >= b.start && cursorPos < b.end) || blocks[0];
    return { blocks, cursorBlockId: cursorBlock?.id };
  }

  function applyInlineOperations(fullText: string, blocks: InlineEditBlock[], operations: InlineEditOperation[]) {
    const byId = new Map(blocks.map(b => [b.id, b]));
    let text = fullText;

    // Apply from end to start (stable offsets)
    const toSpan = (op: InlineEditOperation) => {
      if (op.type === 'replace_range') {
        const a = byId.get(op.startBlockId);
        const b = byId.get(op.endBlockId);
        if (!a || !b) return null;
        const start = Math.min(a.start, b.start);
        const end = Math.max(a.end, b.end);
        return { start, end, insert: op.content };
      }
      if (op.type === 'insert_before') {
        const a = byId.get(op.anchorBlockId);
        if (!a) return null;
        return { start: a.start, end: a.start, insert: op.content };
      }
      if (op.type === 'insert_after') {
        const a = byId.get(op.anchorBlockId);
        if (!a) return null;
        return { start: a.end, end: a.end, insert: op.content };
      }
      return null;
    };

    const spans = operations.map(toSpan).filter((x): x is { start: number; end: number; insert: string } => !!x);
    spans.sort((s1, s2) => s2.start - s1.start);

    for (const s of spans) {
      text = text.slice(0, s.start) + s.insert + text.slice(s.end);
    }
    return text;
  }


  // Helper to clean up insertedSources when citations are removed
  // This is a background cleanup operation - errors are logged but don't block the main flow
  const cleanupInsertedSources = useCallback(async (newContent: string, _oldContent: string) => {
    const currentDocument = await api.documents.get(actualDocumentId);
    const insertedSources: ResearchSource[] = currentDocument.metadata?.insertedSources || [];
    
    // Extract source IDs that are still cited in the new content
    const citedSourceIds = extractCitedSourceIds(newContent);
    
    // Filter out sources that are no longer cited
    const remainingInsertedSources = insertedSources.filter(source => citedSourceIds.has(source.id));
    
    // Only update if something changed
    if (remainingInsertedSources.length !== insertedSources.length) {
      await api.documents.update(actualDocumentId, {
        metadata: {
          ...currentDocument.metadata,
          insertedSources: remainingInsertedSources,
        },
      });
    }
  }, [actualDocumentId]);

  // Wrapper for saveDocument that also cleans up insertedSources
  const saveDocument = useCallback(async (contentToSave: string, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
    const oldContent = previousContentRef.current;
    // Clean up insertedSources before saving
    await cleanupInsertedSources(contentToSave, oldContent);
    previousContentRef.current = contentToSave;
    await originalSaveDocument(contentToSave, changeType);
  }, [originalSaveDocument, cleanupInsertedSources]);

  // Load project settings for document style
  useEffect(() => {
    let cancelled = false;
    async function loadProjectSettings() {
      try {
        const project = await api.projects.get(projectId);
        if (cancelled) return;
        
        // FIX: If documentStyle is missing, update it based on project type
        // This handles the case where the database has it but the API doesn't return it properly
        if (!project.settings.documentStyle) {
          const defaultDocumentStyle = project.type === 'academic' ? 'academic' : 'other';
          try {
            await api.projects.update(projectId, {
              settings: {
                ...project.settings,
                documentStyle: defaultDocumentStyle,
              },
            });
            // Reload project to get updated settings
            const updatedProject = await api.projects.get(projectId);
            if (cancelled) return;
            const loadedStyle = updatedProject.settings.documentStyle || defaultDocumentStyle;
            setDocumentStyle(loadedStyle);
            return;
          } catch (updateError) {
            console.error('Failed to update project documentStyle:', updateError);
            // Fall through to use default
          }
        }
        
        const loadedStyle = project.settings.documentStyle || 'other';
        setDocumentStyle(loadedStyle);
      } catch (error) {
        console.error('Failed to load project settings:', error);
      }
    }

    if (projectId) {
      loadProjectSettings();
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Helper to get cursor screen coordinates from CodeMirror
  const getCursorScreenPosition = useCallback((): { top: number; left: number } | null => {
    if (!editorViewRef.current || !editorContainerRef.current) return null;

    try {
      const view = editorViewRef.current;
      const selection = view.state.selection.main;
      const pos = selection.head;
      
      // Get coordinates at cursor position
      const coords = view.coordsAtPos(pos);
      if (!coords) return null;

      // Get editor container bounding rect
      const containerRect = editorContainerRef.current.getBoundingClientRect();
      
      // Calculate position relative to viewport
      return {
        top: coords.top,
        left: coords.left,
      };
    } catch (error) {
      console.error('Failed to get cursor screen position:', error);
      return null;
    }
  }, []);

  // Update cursor screen position when cursor moves or sidebar state changes
  // Use requestAnimationFrame to defer update and avoid nested CodeMirror updates
  useEffect(() => {
    if (cursorPosition && !thinkPanelOpen && !inlineAIChatOpen) {
      requestAnimationFrame(() => {
        try {
          const screenPos = getCursorScreenPosition();
          if (screenPos) {
            setCursorScreenPosition(screenPos);
          }
        } catch (error) {
          // Silently ignore errors during cursor position updates
          // This can happen if CodeMirror is updating
        }
      });
    }
  }, [cursorPosition, thinkPanelOpen, inlineAIChatOpen, sidebarOpen, sidebarWidth, getCursorScreenPosition]);

  // Undo/Redo hook (defined first to avoid circular dependencies)
  const undoRedo = useUndoRedo(content, {
    maxHistorySize: 50,
    onStateChange: (state) => {
      // When undo/redo is performed, update content and clear change tracking
      // Mark as undo/redo operation to prevent history clearing
      isUserInputRef.current = false; // This is an undo/redo, not user input
      previousContentForHistoryRef.current = state.content; // Update ref to prevent history clearing
      setContentWithoutSave(state.content);
      // Restore cursor position if available
      if (state.cursorPosition && editorViewRef.current) {
        setCursorPosition(state.cursorPosition);
        // Restore cursor position in editor
        try {
          const { line, column } = state.cursorPosition;
          const doc = editorViewRef.current.state.doc;
          const lineInfo = doc.line(Math.min(line, doc.lines));
          const pos = lineInfo.from + Math.min(column - 1, lineInfo.length);
          editorViewRef.current.dispatch({
            selection: { anchor: pos, head: pos },
            scrollIntoView: true,
          });
        } catch (error) {
          // Cursor restoration failed, but content was updated
        }
      }
    },
  });

  // Change tracking hook
  const changeTracking = useChangeTracking(content, {
    onApply: async (newContent: string) => {
      // Clean up insertedSources before updating content
      await cleanupInsertedSources(newContent, content);
      updateContent(newContent);
      await saveDocument(newContent, 'ai-action');
      setPendingChangeContent(null);
      // Add to undo history after applying changes
      // Capture current cursor position
      let currentCursorPos = cursorPosition;
      if (editorViewRef.current && !currentCursorPos) {
        try {
          const selection = editorViewRef.current.state.selection.main;
          const line = editorViewRef.current.state.doc.lineAt(selection.head);
          currentCursorPos = { line: line.number, column: selection.head - line.from + 1 };
        } catch {
          // Failed to get cursor position
        }
      }
      undoRedo.addToHistory({
        content: newContent,
        cursorPosition: currentCursorPos,
        selection: currentSelectionRef.current,
        timestamp: Date.now(),
      });
      previousContentForHistoryRef.current = newContent;
    },
    onCancel: () => {
      setPendingChangeContent(null);
    },
  });

  // Clear undo/redo history when document changes (e.g., loading a different document)
  // Only clear if the change is NOT from user input (i.e., from external source like document load)
  useEffect(() => {
    if (previousContentForHistoryRef.current !== content && !isUserInputRef.current) {
      // Content changed from outside (e.g., document load) - clear history
      undoRedo.clearHistory(content);
      previousContentForHistoryRef.current = content;
    }
    // Reset the flag after checking
    isUserInputRef.current = false;
  }, [content, undoRedo]);

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


  // Load version metadata to determine latest version
  useEffect(() => {
    if (!actualDocumentId || actualDocumentId === 'default') return;

    async function loadMetadata() {
      const metadata = await api.versions.getMetadata(actualDocumentId);
      let newLatestVersion: number | null = null;
      
      // Check if currentVersion exists and is valid
      if (metadata.currentVersion !== undefined && metadata.currentVersion !== null) {
        newLatestVersion = Number(metadata.currentVersion);
      } else {
        // Fallback: get latest from versions list
        const versions = await api.versions.list(actualDocumentId, 1, 0);
        if (versions.length > 0) {
          newLatestVersion = versions[0].versionNumber;
        }
      }
      
      if (newLatestVersion !== null) {
        // If the latest version changed and we were viewing the latest, update to new latest
        if (latestVersion !== null && newLatestVersion > latestVersion && selectedVersion === null) {
          // New version was created while viewing the latest - stay on latest
          setLatestVersion(newLatestVersion);
          setSelectedVersion(null); // Ensure we're still viewing the latest
        } else if (latestVersion !== null && newLatestVersion > latestVersion && selectedVersion !== null) {
          // New version was created while viewing an older version - keep viewing that older version (read-only)
          setLatestVersion(newLatestVersion);
          // Don't change selectedVersion - keep it read-only
        } else {
          setLatestVersion(newLatestVersion);
        }
      }
    }

    // Load metadata - errors will propagate in tests, handled gracefully in production
    loadMetadata().catch((error) => {
      // In test environment, let errors propagate so tests fail when mocks are incorrect
      if (process.env.NODE_ENV === 'test') {
        throw error;
      }
      // In production, log but don't break the component (background operation)
      console.error('Failed to load version metadata:', error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualDocumentId, latestVersion, selectedVersion, lastSaved?.getTime()]); // Reload when lastSaved changes (new version created)

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
      updateContent(value);

      // Add to undo history (debounced to avoid too many history entries)
      // Only add if not in change tracking mode (change tracking handles its own history)
      if (!changeTracking.isTracking) {
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
    },
    [updateContent, selectedVersion, latestVersion, cursorPosition, undoRedo, changeTracking.isTracking]
  );

  // Handle selection changes from editor
  const handleSelectionChange = useCallback((selection: { from: number; to: number; text: string } | null) => {
    currentSelectionRef.current = selection;
  }, []);

  // Handle cursor position changes from editor
  const handleCursorPositionChange = useCallback((position: { line: number; column: number } | null) => {
    setCursorPosition(position);
  }, []);

  // Handle keyboard shortcuts (Ctrl+S / Cmd+S for immediate auto-save, Ctrl+T / Cmd+T for mode toggle, Ctrl+Z/Ctrl+Shift+Z for undo/redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't allow shortcuts if viewing an older version
      // Allow shortcuts if selectedVersion === null (latest) or selectedVersion === latestVersion
      if (selectedVersion !== null && latestVersion !== null && selectedVersion !== latestVersion) {
        return; // Don't allow shortcuts for older versions
      }

      // Don't allow undo/redo if change tracking is active
      if (changeTracking.isTracking) {
        // Allow undo/redo shortcuts to work even during change tracking
        // They will cancel change tracking and perform undo/redo
      }
      
      // Ctrl+Z / Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        // Clear change tracking if active
        if (changeTracking.isTracking) {
          changeTracking.cancelTracking();
        }
        const state = undoRedo.undo();
        // State change is handled by onStateChange callback
        return;
      }
      
      // Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y for redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        // Clear change tracking if active
        if (changeTracking.isTracking) {
          changeTracking.cancelTracking();
        }
        const state = undoRedo.redo();
        // State change is handled by onStateChange callback
        return;
      }
      
      // Ctrl+S / Cmd+S for immediate auto-save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Trigger immediate auto-save by calling saveDocument directly
        if (saveDocument) {
          saveDocument(content, 'auto-save');
        }
      }
      
      // Cmd+K / Ctrl+K for inline AI chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // Don't open if Think panel is open
        if (thinkPanelOpen) return;
        // Get cursor screen position
        const screenPos = getCursorScreenPosition();
        if (screenPos) {
          setCursorScreenPosition(screenPos);
          setInlineAIChatOpen(true);
        }
        return;
      }

      // Ctrl+T / Cmd+T to open Think panel for paragraph at cursor
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        // Find paragraph at cursor position
        if (cursorPosition && handleOpenPanel) {
          const lines = content.split('\n');
          const cursorLine = cursorPosition.line - 1; // Convert to 0-based
          
          // Find which paragraph contains this line
          let currentParagraph: { startLine: number; text: string } | null = null;
          let paragraphStartLine = 0;
          
          for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            
            if (!trimmed && currentParagraph) {
              // Blank line ends current paragraph
              if (cursorLine >= paragraphStartLine && cursorLine < i) {
                // Cursor is in this paragraph
                const paragraphId = `para-${paragraphStartLine}`;
                handleOpenPanel(paragraphId);
                return;
              }
              currentParagraph = null;
            } else if (trimmed) {
              // Non-empty line - start or continue paragraph
              if (!currentParagraph) {
                currentParagraph = { startLine: i, text: trimmed };
                paragraphStartLine = i;
              } else {
                currentParagraph.text += ' ' + trimmed;
              }
            }
          }
          
          // Check if cursor is in the final paragraph
          if (currentParagraph && cursorLine >= paragraphStartLine) {
            const paragraphId = `para-${paragraphStartLine}`;
            handleOpenPanel(paragraphId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, saveDocument, selectedVersion, latestVersion, cursorPosition, handleOpenPanel, undoRedo, changeTracking, thinkPanelOpen, getCursorScreenPosition]);

  // Handle formatting from toolbar
  const handleFormat = useCallback((format: FormatType) => {
    // Don't allow formatting if viewing an older version
    // Allow formatting if selectedVersion === null (latest) or selectedVersion === latestVersion
    if (selectedVersion !== null && latestVersion !== null && selectedVersion !== latestVersion) {
      return; // Don't allow formatting older versions
    }

    // Formatting is a user edit: route through undo/redo + prevent external-change history reset
    const applyUserEdit = (newContent: string) => {
      // Mark as user input so the "external content change" effect does not clear history
      isUserInputRef.current = true;

      // Cancel any pending debounced history entry (typing) to avoid weird ordering
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }

      updateContent(newContent);

      // Add to undo history immediately (formatting is an intentional edit)
      if (!changeTracking.isTracking) {
        // Capture cursor position if available
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

        undoRedo.addToHistory({
          content: newContent,
          cursorPosition: currentCursorPos,
          selection: currentSelectionRef.current,
          timestamp: Date.now(),
        });
        previousContentForHistoryRef.current = newContent;
      }
    };
    
    // Always prefer CodeMirror's current doc + selection to avoid stale indices/content
    const view = editorViewRef.current;
    const baseContent = view ? view.state.doc.toString() : content;
    const cmSelection = view?.state.selection.main ?? null;
    
    // Resolve a selection range in document coordinates (prefer stored selection, fallback to CodeMirror selection)
    const from = cmSelection ? Math.min(cmSelection.from, cmSelection.to) : null;
    const to = cmSelection ? Math.max(cmSelection.from, cmSelection.to) : null;

    const hasRange = typeof from === 'number' && typeof to === 'number' && from >= 0 && to >= 0 && to > from;

    if (hasRange) {
      // Format selected text using exact positions from CodeMirror
      let formattedText = '';
      const selectedText = baseContent.slice(from!, to!);
      switch (format) {
        case 'bold':
          formattedText = `**${selectedText}**`;
          break;
        case 'italic':
          formattedText = `*${selectedText}*`;
          break;
        case 'underline':
          formattedText = `<u>${selectedText}</u>`;
          break;
        case 'superscript':
          formattedText = `<sup>${selectedText}</sup>`;
          break;
        case 'subscript':
          formattedText = `<sub>${selectedText}</sub>`;
          break;
        case 'code':
          formattedText = `\`${selectedText}\``;
          break;
        case 'link':
          // Use an absolute placeholder so clicking in preview doesn't navigate the SPA route
          formattedText = `[${selectedText}](https://example.com)`;
          break;
      }

      // Replace using exact positions from CodeMirror
      const newContent = 
        baseContent.slice(0, from!) + 
        formattedText + 
        baseContent.slice(to!);
      applyUserEdit(newContent);
    } else {
      // No selection - insert placeholder at cursor position (fallback to end)
      let placeholder = '';
      switch (format) {
        case 'bold':
          placeholder = '****';
          break;
        case 'italic':
          placeholder = '**';
          break;
        case 'underline':
          placeholder = '<u></u>';
          break;
        case 'superscript':
          placeholder = '<sup></sup>';
          break;
        case 'subscript':
          placeholder = '<sub></sub>';
          break;
        case 'code':
          placeholder = '``';
          break;
        case 'link':
          placeholder = '[]()';
          break;
      }
      const insertPos = cmSelection ? cmSelection.head : content.length;
      const safeInsertPos = Math.min(Math.max(0, insertPos), baseContent.length);
      const newContent = baseContent.slice(0, safeInsertPos) + placeholder + baseContent.slice(safeInsertPos);
      applyUserEdit(newContent);
    }
  }, [content, updateContent, selectedVersion, latestVersion, cursorPosition, undoRedo, changeTracking.isTracking]);

  return (
    <div className="flex h-screen bg-vscode-bg text-vscode-text">
      {/* Sidebar */}
      <div ref={sidebarRef} className="flex items-stretch relative">
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
          <div style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }} className="relative">
            <EditorSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          content={content}
          documentId={actualDocumentId}
          lastSaved={lastSaved}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
        onRollback={async (versionNumber: number) => {
          const content = await api.versions.reconstruct(actualDocumentId, versionNumber);
          setSelectedVersion(null); // Reset to latest after rollback
          updateContent(content);
        }}
        onVersionSelect={async (versionNumber: number) => {
          const content = await api.versions.reconstruct(actualDocumentId, versionNumber);
          
          // Always fetch latest version metadata to ensure we have the current latest
          let currentLatestVersion: number | null = latestVersion ?? null;
          const metadata = await api.versions.getMetadata(actualDocumentId);
          // Check if currentVersion exists and is valid
          if (metadata.currentVersion !== undefined && metadata.currentVersion !== null) {
            currentLatestVersion = Number(metadata.currentVersion);
          } else {
            // Metadata exists but currentVersion is missing - fall back to versions list
            const versions = await api.versions.list(actualDocumentId, 1, 0);
            if (versions.length > 0) {
              currentLatestVersion = versions[0].versionNumber; // First version is latest (sorted DESC)
            }
          }
          // Update latestVersion state
          setLatestVersion(currentLatestVersion);
          
          // If selecting the latest version, reset to null to enable editing
          // Use Number() to ensure type-safe comparison
          if (currentLatestVersion !== null && Number(versionNumber) === Number(currentLatestVersion)) {
            // This is the latest version - set to null to enable editing
            setSelectedVersion(null);
            // Use updateContent to allow editing
            updateContent(content);
          } else {
            // This is an older version - set selectedVersion and make read-only
            setSelectedVersion(versionNumber);
            // Use setContentWithoutSave to prevent auto-save
            setContentWithoutSave(content);
          }
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
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          canUndo={undoRedo.canUndo}
          canRedo={undoRedo.canRedo}
          onUndo={() => {
            if (changeTracking.isTracking) {
              changeTracking.cancelTracking();
            }
            undoRedo.undo();
          }}
          onRedo={() => {
            if (changeTracking.isTracking) {
              changeTracking.cancelTracking();
            }
            undoRedo.redo();
          }}
        />

        {/* Formatting Toolbar */}
        <FormattingToolbar
          onFormat={handleFormat}
          viewMode={viewMode}
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
                  content={content}
                  cursorPosition={cursorPosition}
                  selection={currentSelectionRef.current}
                  scopeKind={currentSelectionRef.current?.text?.trim() ? 'selection' : 'cursor_paragraph'}
                  scopeText={(() => {
                    const sel = currentSelectionRef.current;
                    if (sel && sel.text && sel.text.trim().length > 0) return sel.text;

                    if (!cursorPosition) return '';
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
                    if (!cursorPosition) {
                      return { operations: [], previewText: '', newContent: content };
                    }

                    const cursorLine = cursorPosition.line - 1; // Convert to 0-based
                    const { blocks, cursorBlockId } = buildInlineBlocksAroundCursor(content, cursorLine);
                    const anchorBlockId = cursorBlockId;
                    if (!anchorBlockId) {
                      return { operations: [], previewText: '', newContent: content };
                    }

                    const operations: InlineEditOperation[] = [
                      placement === 'before'
                        ? { type: 'insert_before', anchorBlockId, content: insertContent }
                        : { type: 'insert_after', anchorBlockId, content: insertContent },
                    ];

                    const newContent = applyInlineOperations(content, blocks, operations);
                    return { operations, previewText: insertContent, newContent };
                  }}
                  onApplyInlinePreview={async (preview) => {
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

              <AIEnhancedEditor
                value={pendingChangeContent?.new ?? content}
                onChange={handleContentChange}
                onSelectionChange={handleSelectionChange}
                onCursorPositionChange={handleCursorPositionChange}
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
                  const isReadOnly = selectedVersion !== null && 
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
              // Find the paragraph and replace/blend content
              const applyingToDocument = scope === 'document';
              if (!applyingToDocument && !openParagraphId) return;
              
              const lines = content.split('\n');
              const startLine = applyingToDocument ? 0 : parseInt(openParagraphId!.match(/^para-(\d+)$/)![1], 10);
              if (!applyingToDocument) {
                const match = openParagraphId!.match(/^para-(\d+)$/);
                if (!match) return;
                if (startLine < 0 || startLine >= lines.length) return;
              }
              
              // Check if section
              const isHeading = (line: string) => /^#{1,6}\s/.test(line.trim());
              const startLineIsHeading = startLine < lines.length && isHeading(lines[startLine].trim());
              
              let endLine = startLine;
              if (applyingToDocument) {
                endLine = lines.length;
              } else if (startLineIsHeading) {
                endLine = startLine + 1;
                while (endLine < lines.length) {
                  if (isHeading(lines[endLine].trim())) break;
                  endLine++;
                }
              } else {
                while (endLine < lines.length) {
                  const trimmed = lines[endLine].trim();
                  if (!trimmed || isHeading(trimmed)) break;
                  endLine++;
                }
              }
              
              const beforeLines = lines.slice(0, startLine);
              const afterLines = lines.slice(endLine); // endLine is exclusive (first line after block)
              
              let newContent: string;
              if (mode === 'replace' || mode === 'lead' || mode === 'conclude' || mode === 'extend' || mode === 'citation' || mode === 'summary') {
                // Replace: use generated content directly
                // Lead: prepend generated content (handled in frontend)
                // Conclude: append generated content (handled in frontend)
                // Extend: legacy append generated content (handled in frontend)
                // Citation/Summary: insert generated content with citations
                if (mode === 'lead' || mode === 'conclude' || mode === 'extend') {
                  const currentBlockContent = lines.slice(startLine, endLine).join('\n');

                  // Special case: sections start with a markdown heading. "Lead" should add content
                  // to the beginning of the section body (right after the heading), not above the heading.
                  if (mode === 'lead' && startLineIsHeading && !applyingToDocument) {
                    const headingLine = lines[startLine] ?? '';
                    const bodyContent = lines.slice(startLine + 1, endLine).join('\n');
                    const gen = generatedContent.trim();
                    const body = bodyContent.trim();
                    const combined =
                      gen && body
                        ? `${headingLine}\n\n${gen}\n\n${bodyContent}`
                        : gen
                          ? `${headingLine}\n\n${gen}`
                          : body
                            ? `${headingLine}\n\n${bodyContent}`
                            : headingLine;
                    newContent = [...beforeLines, combined, ...afterLines].join('\n');
                  } else {
                    // Regular Lead/Conclude/Extend behavior for non-heading blocks
                    const left = mode === 'lead' ? generatedContent : currentBlockContent;
                    const right = mode === 'lead' ? currentBlockContent : generatedContent;
                    const combined =
                      left.trimEnd() && right.trimStart()
                        ? `${left.trimEnd()}\n\n${right.trimStart()}`
                        : `${left}${right}`;
                    newContent = [...beforeLines, combined, ...afterLines].join('\n');
                  }
                } else {
                  // Replace, Citation, or Summary: replace with generated content
                  newContent = [...beforeLines, generatedContent, ...afterLines].join('\n');
                }
              } else {
                // Blend: the AI already returned the complete blended content (existing + new)
                // So we replace the entire block with the blended result
                newContent = [...beforeLines, generatedContent, ...afterLines].join('\n');
              }
              
              // Note: We don't clear researchSessions - they remain associated with the block
              // Only insertedSources will be cleaned up when citations are removed (handled in cleanupInsertedSources)
              
              // Start change tracking instead of directly applying
              setPendingChangeContent({ original: content, new: newContent });
              changeTracking.startTracking(newContent, content);
              // Hide progress indicator after change tracking is set up
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
              {viewMode === 'ir' ? (
                <div className="h-full">
                  <IrPreview docId={actualDocumentId || documentId} content={content} ir={irState.ir} />
                </div>
              ) : (
                <MarkdownPreview content={content} />
              )}
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
          cursorPosition={cursorPosition}
        />
      </div>
    </div>
  );
}

