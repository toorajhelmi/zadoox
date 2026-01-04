/**
 * EditorLayout refactor guard tests
 * Goal: pin high-risk behaviors before refactoring (mode switching, shortcut routing, latex insert-at-cursor).
 *
 * Note: We intentionally avoid asserting full Markdown surface re-rendering here, since EditorLayout's MD content
 * comes from useDocumentState (hook-owned). Instead, we assert routing (correct controller invoked) and correct
 * generated values passed to updateContent / CodeMirrorEditor.
 */
/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

type UndoCtrl = {
  undo: ReturnType<typeof vi.fn>;
  redo: ReturnType<typeof vi.fn>;
  addToHistory: ReturnType<typeof vi.fn>;
  clearHistory: ReturnType<typeof vi.fn>;
  canUndo: boolean;
  canRedo: boolean;
};

// ---- Hooks -----------------------------------------------------------------
vi.mock('@/hooks/use-document-state', () => ({
  useDocumentState: () => {
    const init = (globalThis as any).__testDocState || {
      actualDocumentId: 'doc-1',
      title: 'Doc',
      content: '',
      metadata: {},
    };
    return {
      content: init.content,
      documentTitle: init.title,
      updateContent: (globalThis as any).__updateContentSpy || vi.fn(),
      setContentWithoutSave: (globalThis as any).__setContentWithoutSaveSpy || vi.fn(),
      isSaving: false,
      lastSaved: null,
      documentId: init.actualDocumentId,
      saveDocument: vi.fn(),
      paragraphModes: {},
      handleModeToggle: vi.fn(),
      documentMetadata: init.metadata,
      setDocumentMetadata: (globalThis as any).__setDocumentMetadataSpy || vi.fn(),
    };
  },
}));

vi.mock('@/hooks/use-ir-document', () => ({
  useIrDocument: () => ({ ir: null }),
}));

vi.mock('@/hooks/use-change-tracking', () => ({
  useChangeTracking: () => ({
    isTracking: false,
    changes: [],
    mappedChanges: [],
    startTracking: vi.fn(),
    cancelTracking: vi.fn(),
    applyChanges: vi.fn(),
    acceptChange: vi.fn(),
    rejectChange: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-undo-redo', () => ({
  useUndoRedo: vi.fn(() => {
    const g = globalThis as any;
    if (!g.__undoMockCallIndex) g.__undoMockCallIndex = 0;

    const make = (): UndoCtrl => {
      const ctrl: UndoCtrl = {
        undo: vi.fn(),
        redo: vi.fn(),
        addToHistory: vi.fn(() => {
          ctrl.canUndo = true;
        }),
        clearHistory: vi.fn(),
        canUndo: false,
        canRedo: false,
      };
      return ctrl;
    };

    if (!g.__mdUndoCtrl) g.__mdUndoCtrl = make();
    if (!g.__latexUndoCtrl) g.__latexUndoCtrl = make();

    const idx = g.__undoMockCallIndex++;
    return (idx % 2 === 0 ? g.__mdUndoCtrl : g.__latexUndoCtrl) as UndoCtrl;
  }),
}));

// ---- API + shared conversion stubs -----------------------------------------
vi.mock('@/lib/api/client', () => ({
  api: {
    versions: { getMetadata: vi.fn(), list: vi.fn(), reconstruct: vi.fn() },
    projects: { get: vi.fn(), update: vi.fn() },
    documents: { update: vi.fn(), get: vi.fn() },
    ai: { inline: { edit: vi.fn() } },
  },
}));

vi.mock('@zadoox/shared', () => ({
  parseXmdToIr: vi.fn(() => ({})),
  parseLatexToIr: vi.fn(() => ({})),
  irToLatexDocument: vi.fn(() => 'LATEX_DOC'),
  irToXmd: vi.fn(() => 'XMD_FROM_LATEX'),
}));

import { api } from '@/lib/api/client';
import { EditorLayout } from '../editor-layout';

// ---- Child component shims --------------------------------------------------
vi.mock('../editor-sidebar', () => ({ EditorSidebar: () => <div data-testid="sidebar" /> }));
vi.mock('../editor-status-bar', () => ({ EditorStatusBar: () => <div data-testid="status" /> }));
vi.mock('../ir-preview', () => ({ IrPreview: () => <div data-testid="ir" /> }));
vi.mock('../think-mode-panel', () => ({ ThinkModePanel: () => <div data-testid="think" /> }));

// Inline chat mock: deterministic insert behavior
vi.mock('../inline-ai-chat', () => ({
  InlineAIChat: (props: any) => (
    <div data-testid="inline-chat">
      <button
        type="button"
        onClick={async () => {
          const preview = await props.onPreviewInsertAtCursor({ content: 'X', placement: 'after' });
          await props.onApplyInlinePreview(preview);
        }}
      >
        do-insert
      </button>
      <button type="button" onClick={props.onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock('../editor-toolbar', () => ({
  EditorToolbar: (props: any) => (
    <div>
      <button aria-label="Undo" disabled={!props.canUndo} onClick={props.onUndo}>
        Undo
      </button>
      <button aria-label="Redo" disabled={!props.canRedo} onClick={props.onRedo}>
        Redo
      </button>
    </div>
  ),
}));

// Minimal editors: supply editorViewRef with coordsAtPos so Cmd/Ctrl+K can open inline chat.
vi.mock('../ai-enhanced-editor', () => ({
  AIEnhancedEditor: (props: any) => {
    React.useEffect(() => {
      props.onEditorViewReady?.({
        state: {
          selection: { main: { from: 0, to: 5, head: 5 } },
          doc: {
            lines: 1,
            length: String(props.value || '').length,
            lineAt: (_pos: number) => ({ from: 0, to: 0, number: 1, text: String(props.value || ''), length: String(props.value || '').length }),
            line: (_n: number) => ({ from: 0, to: 0, number: 1, text: String(props.value || ''), length: String(props.value || '').length }),
          },
        },
        coordsAtPos: (_pos: number) => ({ top: 10, left: 10 }),
        dispatch: vi.fn(),
      });
      props.onCursorPositionChange?.({ line: 1, column: 1 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div data-testid="md-editor" />;
  },
}));

vi.mock('../codemirror-editor', () => ({
  CodeMirrorEditor: (props: any) => {
    React.useEffect(() => {
      props.onEditorViewReady?.({
        state: {
          selection: { main: { from: 0, to: 5, head: 5 } },
          doc: {
            lines: String(props.value || '').split('\n').length,
            length: String(props.value || '').length,
            lineAt: (_pos: number) => ({ from: 0, to: 0, number: 1, text: String(props.value || ''), length: String(props.value || '').length }),
            line: (_n: number) => ({ from: 0, to: 0, number: 1, text: String(props.value || ''), length: String(props.value || '').length }),
          },
        },
        coordsAtPos: (_pos: number) => ({ top: 10, left: 10 }),
        dispatch: vi.fn(),
      });
      props.onCursorPositionChange?.({ line: 1, column: 1 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <textarea data-testid="latex-editor" value={props.value} readOnly={props.readOnly} onChange={() => {}} />;
  },
}));

describe('EditorLayout refactor guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__undoMockCallIndex = 0;
    (globalThis as any).__mdUndoCtrl = undefined;
    (globalThis as any).__latexUndoCtrl = undefined;
    (globalThis as any).__testDocState = {
      actualDocumentId: 'doc-1',
      title: 'Doc',
      content: 'Hello world',
      metadata: { lastEditedFormat: 'markdown' },
    };
    (globalThis as any).__updateContentSpy = vi.fn();
    (globalThis as any).__setContentWithoutSaveSpy = vi.fn();
    (globalThis as any).__setDocumentMetadataSpy = vi.fn();
    (globalThis as any).requestAnimationFrame = (cb: any) => {
      cb(0);
      return 0;
    };

    (api.versions.getMetadata as any).mockResolvedValue({ currentVersion: 1 });
    (api.versions.list as any).mockResolvedValue([{ versionNumber: 1 }]);
    (api.projects.get as any).mockResolvedValue({
      name: 'Proj',
      type: 'other',
      settings: { documentStyle: 'other', citationFormat: 'numbered' },
    });
    (api.documents.update as any).mockResolvedValue({});
  });

  it('Cmd/Ctrl+Alt+Shift+L switches to LaTeX and persists metadata', async () => {
    render(<EditorLayout projectId="p1" documentId="doc-1" />);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', altKey: true, shiftKey: true, ctrlKey: true }));
    });

    const latex = await screen.findByTestId('latex-editor');
    expect((latex as HTMLTextAreaElement).value).toBe('LATEX_DOC');

    await waitFor(() => expect(api.documents.update).toHaveBeenCalled());
    const args = (api.documents.update as any).mock.calls[0];
    expect(args[1]?.metadata?.lastEditedFormat).toBe('latex');
    expect(args[1]?.metadata?.latex).toBe('LATEX_DOC');
  });

  it('routes Ctrl+Z to the correct undo controller in Markdown vs LaTeX', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(<EditorLayout projectId="p1" documentId="doc-1" />);

    const getLatestKeydownHandler = () => {
      const calls = addSpy.mock.calls.filter((c) => c[0] === 'keydown');
      return (calls[calls.length - 1]?.[1] as ((e: KeyboardEvent) => void) | undefined) || null;
    };

    let keydownHandler = await waitFor(() => {
      const call = addSpy.mock.calls.find((c) => c[0] === 'keydown');
      expect(call).toBeTruthy();
      return call![1] as (e: KeyboardEvent) => void;
    });
    const md = (globalThis as any).__mdUndoCtrl as UndoCtrl;
    const latex = (globalThis as any).__latexUndoCtrl as UndoCtrl;

    await act(async () => {
      keydownHandler(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });
    expect(md.undo).toHaveBeenCalledTimes(1);
    expect(latex.undo).toHaveBeenCalledTimes(0);

    // Switch to latex via shortcut and undo should route to latex controller.
    await act(async () => {
      keydownHandler(new KeyboardEvent('keydown', { key: 'l', altKey: true, shiftKey: true, ctrlKey: true }));
    });
    // After switching formats, the effect is re-registered; use the latest handler.
    keydownHandler = await waitFor(() => {
      const h = getLatestKeydownHandler();
      expect(h).toBeTruthy();
      return h as (e: KeyboardEvent) => void;
    });

    await act(async () => {
      keydownHandler(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });
    expect(latex.undo).toHaveBeenCalledTimes(1);
  });

  it('in LaTeX mode, Cmd/Ctrl+K opens inline chat and insert-at-cursor applies LaTeX insertion logic', async () => {
    (globalThis as any).__testDocState = {
      actualDocumentId: 'doc-1',
      title: 'Doc',
      content: 'XMD',
      metadata: { lastEditedFormat: 'latex', latex: 'A\nB' },
    };

    render(<EditorLayout projectId="p1" documentId="doc-1" />);
    await waitFor(() => expect((screen.getByTestId('latex-editor') as HTMLTextAreaElement).value).toBe('A\nB'));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });
    expect(await screen.findByTestId('inline-chat')).toBeInTheDocument();

    fireEvent.click(screen.getByText('do-insert'));
    await waitFor(() => {
      expect((screen.getByTestId('latex-editor') as HTMLTextAreaElement).value).toBe('A\nXB');
    });
  });
});


