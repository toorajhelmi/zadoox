/**
 * EditorLayout LaTeX undo/redo tests
 * Goal: ensure undo stack is active in LaTeX mode.
 */
/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('EditorLayout (LaTeX) undo/redo', () => {
  beforeEach(() => {
    // This test file uses deep module mocks; reset the module graph so mocks don't leak
    // across other test files (which can cause flaky undo button state).
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as any).__latexUndoValueRef;

    vi.doMock('@/hooks/use-document-state', () => ({ useDocumentState: vi.fn() }));
    vi.doMock('@/hooks/use-ir-document', () => ({ useIrDocument: () => ({ ir: null }) }));
    vi.doMock('@/hooks/use-change-tracking', () => ({
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

    vi.doMock('../editor-sidebar', () => ({ EditorSidebar: () => <div /> }));
    vi.doMock('../editor-status-bar', () => ({ EditorStatusBar: () => <div /> }));
    vi.doMock('../ir-preview', () => ({ IrPreview: () => <div /> }));
    vi.doMock('../think-mode-panel', () => ({ ThinkModePanel: () => <div /> }));
    vi.doMock('../inline-ai-chat', () => ({ InlineAIChat: () => <div /> }));
    vi.doMock('../inline-ai-hint', () => ({ InlineAIHint: () => <div /> }));
    vi.doMock('../ai-enhanced-editor', () => ({ AIEnhancedEditor: () => <div /> }));

    vi.doMock('@zadoox/shared', async () => {
      const actual = await vi.importActual<Record<string, unknown>>('@zadoox/shared');
      return {
        ...actual,
        parseLatexToIr: vi.fn(() => ({})),
        irToXmd: vi.fn(() => 'XMD_FROM_LATEX'),
        parseXmdToIr: vi.fn(() => ({})),
        irToLatexDocument: vi.fn(() => ''),
      };
    });

    vi.doMock('../codemirror-editor', () => ({
      CodeMirrorEditor: (props: { value: string; onChange: (v: string) => void; onEditorViewReady?: (v: unknown) => void }) => {
        const valueRef = (globalThis as any).__latexUndoValueRef || { current: props.value };
        valueRef.current = props.value;
        (globalThis as any).__latexUndoValueRef = valueRef;

        props.onEditorViewReady?.({
          state: {
            doc: {
              toString: () => valueRef.current,
              lineAt: (_pos: number) => ({
                text: valueRef.current,
                from: 0,
                to: valueRef.current.length,
                length: valueRef.current.length,
                number: 1,
              }),
              line: (_n: number) => ({
                text: valueRef.current,
                from: 0,
                to: valueRef.current.length,
                length: valueRef.current.length,
                number: 1,
              }),
              lines: 1,
            },
            selection: { main: { from: 0, to: Math.min(5, valueRef.current.length), head: Math.min(5, valueRef.current.length) } },
          },
          dispatch: vi.fn(),
        });

        return (
          <input
            data-testid="latex-editor"
            value={props.value}
            onChange={(e) => props.onChange((e.target as HTMLInputElement).value)}
          />
        );
      },
    }));

    vi.doMock('@/lib/api/client', () => ({
      api: {
        versions: { getMetadata: vi.fn(), list: vi.fn(), reconstruct: vi.fn() },
        projects: { get: vi.fn() },
        documents: { update: vi.fn(), get: vi.fn() },
      },
    }));
  });

  it.skip('enables undo after a LaTeX edit and restores previous text', async () => {
    const { useDocumentState } = await import('@/hooks/use-document-state');
    const mockUseDocumentState = useDocumentState as unknown as ReturnType<typeof vi.fn>;
    mockUseDocumentState.mockReturnValue({
      content: '',
      documentTitle: 'Doc',
      updateContent: vi.fn(),
      setContentWithoutSave: vi.fn(),
      isSaving: false,
      lastSaved: null,
      documentId: 'doc-1',
      saveDocument: vi.fn(),
      paragraphModes: {},
      handleModeToggle: vi.fn(),
      documentMetadata: { lastEditedFormat: 'latex', latex: 'Hello' },
      setDocumentMetadata: vi.fn(),
      saveMetadataPatch: vi.fn(),
      semanticGraph: null,
      saveSemanticGraphPatch: vi.fn(),
    });

    const { api } = await import('@/lib/api/client');
    (api.versions.getMetadata as any).mockResolvedValue({ currentVersion: 1 });
    (api.versions.list as any).mockResolvedValue([{ versionNumber: 1 }]);
    (api.projects.get as any).mockResolvedValue({
      name: 'Proj',
      settings: { documentStyle: 'other', citationFormat: 'numbered' },
      type: 'other',
    });

    const { EditorLayout } = await import('../editor-layout');
    render(<EditorLayout projectId="p1" documentId="doc-1" />);

    await waitFor(() => {
      const input = screen.getByTestId('latex-editor') as HTMLInputElement;
      expect(input.value).toBe('Hello');
    });

    // Use formatting (immediate history entry) rather than debounced typing.
    fireEvent.click(screen.getByLabelText('Bold'));

    const undoBtn = screen.getByLabelText('Undo') as HTMLButtonElement;
    await waitFor(() => expect(undoBtn).not.toBeDisabled(), { timeout: 3000 });

    fireEvent.click(undoBtn);

    await waitFor(() => {
      const input = screen.getByTestId('latex-editor') as HTMLInputElement;
      expect(input.value).toBe('Hello');
    });
  });
});


