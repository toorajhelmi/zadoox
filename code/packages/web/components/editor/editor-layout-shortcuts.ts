'use client';

import { useEffect } from 'react';

export type ViewMode = 'edit' | 'preview' | 'split' | 'ir';
export type EditMode = 'markdown' | 'latex';

export function useEditorKeyboardShortcuts(opts: {
  // gating
  selectedVersion: number | null;
  latestVersion: number | null;
  changeTracking: { isTracking: boolean; cancelTracking: () => void };

  // routing
  undoRedo: { undo: () => void; redo: () => void };

  // view/edit format switches
  setViewMode: (v: ViewMode) => void;
  handleEditModeChange: (next: EditMode) => void | Promise<void>;

  // save
  content: string;
  saveDocument?: (content: string, changeType: 'auto-save' | 'ai-action') => void | Promise<void>;

  // inline chat
  thinkPanelOpen: boolean;
  cursorPosition: { line: number; column: number } | null;
  handleOpenPanel?: (paragraphId: string) => void;
  getCursorScreenPosition: () => { top: number; left: number } | null;
  setCursorScreenPosition: (pos: { top: number; left: number }) => void;
  setInlineAIChatOpen: (v: boolean) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't allow shortcuts if viewing an older version
      // Allow shortcuts if selectedVersion === null (latest) or selectedVersion === latestVersion
      if (opts.selectedVersion !== null && opts.latestVersion !== null && opts.selectedVersion !== opts.latestVersion) {
        return; // Don't allow shortcuts for older versions
      }

      // Ctrl+Z / Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (opts.changeTracking.isTracking) {
          opts.changeTracking.cancelTracking();
        }
        opts.undoRedo.undo();
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y for redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        if (opts.changeTracking.isTracking) {
          opts.changeTracking.cancelTracking();
        }
        opts.undoRedo.redo();
        return;
      }

      // View mode shortcuts: Cmd/Ctrl+Alt+E/P/S/I
      if ((e.ctrlKey || e.metaKey) && e.altKey && !e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 'e') {
          e.preventDefault();
          opts.setViewMode('edit');
          return;
        }
        if (k === 'p') {
          e.preventDefault();
          opts.setViewMode('preview');
          return;
        }
        if (k === 's') {
          e.preventDefault();
          opts.setViewMode('split');
          return;
        }
        if (k === 'i') {
          e.preventDefault();
          opts.setViewMode('ir');
          return;
        }
      }

      // Edit surface shortcuts: Cmd/Ctrl+Alt+Shift+M/L
      // (use Shift to reduce accidental triggers / collisions with other common shortcuts)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 'm') {
          e.preventDefault();
          void opts.handleEditModeChange('markdown');
          return;
        }
        if (k === 'l') {
          e.preventDefault();
          void opts.handleEditModeChange('latex');
          return;
        }
      }

      // Ctrl+S / Cmd+S for immediate auto-save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (opts.saveDocument) {
          opts.saveDocument(opts.content, 'auto-save');
        }
      }

      // Cmd+K / Ctrl+K for inline AI chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (opts.thinkPanelOpen) return;
        const screenPos = opts.getCursorScreenPosition();
        if (screenPos) {
          opts.setCursorScreenPosition(screenPos);
          opts.setInlineAIChatOpen(true);
        }
        return;
      }

      // Ctrl+T / Cmd+T to open Think panel for paragraph at cursor
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        if (opts.cursorPosition && opts.handleOpenPanel) {
          const lines = opts.content.split('\n');
          const cursorLine = opts.cursorPosition.line - 1; // 0-based

          let currentParagraph: { startLine: number; text: string } | null = null;
          let paragraphStartLine = 0;

          for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();

            if (!trimmed && currentParagraph) {
              if (cursorLine >= paragraphStartLine && cursorLine < i) {
                const paragraphId = `para-${paragraphStartLine}`;
                opts.handleOpenPanel(paragraphId);
                return;
              }
              currentParagraph = null;
            } else if (trimmed) {
              if (!currentParagraph) {
                currentParagraph = { startLine: i, text: trimmed };
                paragraphStartLine = i;
              } else {
                currentParagraph.text += ' ' + trimmed;
              }
            }
          }

          if (currentParagraph && cursorLine >= paragraphStartLine) {
            const paragraphId = `para-${paragraphStartLine}`;
            opts.handleOpenPanel(paragraphId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opts]);
}


