/**
 * EditorLayout LaTeX undo/redo tests
 * Goal: ensure undo stack is active in LaTeX mode.
 */
/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { EditorLayout } from '../editor-layout';
import { useDocumentState } from '@/hooks/use-document-state';
import { api } from '@/lib/api/client';

vi.mock('@/hooks/use-document-state');
vi.mock('@/hooks/use-ir-document', () => ({ useIrDocument: () => ({ ir: null }) }));
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

vi.mock('../editor-sidebar', () => ({ EditorSidebar: () => <div /> }));
vi.mock('../editor-status-bar', () => ({ EditorStatusBar: () => <div /> }));
vi.mock('../ir-preview', () => ({ IrPreview: () => <div /> }));
vi.mock('../think-mode-panel', () => ({ ThinkModePanel: () => <div /> }));
vi.mock('../inline-ai-chat', () => ({ InlineAIChat: () => <div /> }));
vi.mock('../inline-ai-hint', () => ({ InlineAIHint: () => <div /> }));
vi.mock('../ai-enhanced-editor', () => ({ AIEnhancedEditor: () => <div /> }));

vi.mock('@zadoox/shared', () => ({
  parseLatexToIr: vi.fn(() => ({})),
  irToXmd: vi.fn(() => 'XMD_FROM_LATEX'),
  parseXmdToIr: vi.fn(() => ({})),
  irToLatexDocument: vi.fn(() => ''),
}));

vi.mock('../codemirror-editor', () => ({
  CodeMirrorEditor: (props: { value: string; onChange: (v: string) => void; onEditorViewReady?: (v: any) => void }) => {
    const valueRef = (globalThis as any).__latexUndoValueRef || { current: props.value };
    valueRef.current = props.value;
    (globalThis as any).__latexUndoValueRef = valueRef;

    props.onEditorViewReady?.({
      state: {
        doc: {
          toString: () => valueRef.current,
          lineAt: (_pos: number) => ({ text: valueRef.current, from: 0, to: valueRef.current.length, length: valueRef.current.length, number: 1 }),
          line: (_n: number) => ({ text: valueRef.current, from: 0, to: valueRef.current.length, length: valueRef.current.length, number: 1 }),
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

vi.mock('@/lib/api/client', () => ({
  api: {
    versions: { getMetadata: vi.fn(), list: vi.fn(), reconstruct: vi.fn() },
    projects: { get: vi.fn() },
    documents: { update: vi.fn(), get: vi.fn() },
  },
}));

describe('EditorLayout (LaTeX) undo/redo', () => {
  const mockUseDocumentState = useDocumentState as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (api.versions.getMetadata as any).mockResolvedValue({ currentVersion: 1 });
    (api.versions.list as any).mockResolvedValue([{ versionNumber: 1 }]);
    (api.projects.get as any).mockResolvedValue({
      name: 'Proj',
      settings: { documentStyle: 'other', citationFormat: 'numbered' },
      type: 'other',
    });

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
    });
  });

  it('enables undo after a LaTeX edit and restores previous text', async () => {
    render(<EditorLayout projectId="p1" documentId="doc-1" />);

    await waitFor(() => {
      const input = screen.getByTestId('latex-editor') as HTMLInputElement;
      expect(input.value).toBe('Hello');
    });

    // Use formatting (immediate history entry) rather than debounced typing.
    fireEvent.click(screen.getByLabelText('Bold'));

    const undoBtn = await waitFor(() => {
      const b = screen.getByLabelText('Undo') as HTMLButtonElement;
      expect(b).not.toBeDisabled();
      return b;
    });

    fireEvent.click(undoBtn);

    await waitFor(() => {
      const input = screen.getByTestId('latex-editor') as HTMLInputElement;
      expect(input.value).toBe('Hello');
    });
  });
});


