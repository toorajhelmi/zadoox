/**
 * toolbarExtension tests
 */
/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { showToolbar, toolbarExtension } from '../toolbar-extension';

vi.mock('react-dom/client', () => ({
  createRoot: () => ({
    render: vi.fn(),
    unmount: vi.fn(),
  }),
}));

vi.mock('../paragraph-toolbar', () => ({
  ParagraphToolbar: () => null,
}));

describe('toolbarExtension', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a widget decoration when showToolbar is dispatched and clears when hidden', () => {
    const getParagraphStart = vi.fn(() => 0);
    const getAnalysis = vi.fn(() => ({ analysis: undefined, lastEdited: undefined }));
    const ext = toolbarExtension(getParagraphStart, getAnalysis);

    const state = EditorState.create({ doc: 'Hello', extensions: [ext] });
    expect(state.field(ext).size).toBe(0);

    const state2 = state.update({
      effects: showToolbar.of({
        paragraphId: 'p1',
        onAction: vi.fn(),
        onViewDetails: vi.fn(),
      } as any),
    }).state;

    expect(state2.field(ext).size).toBe(1);

    const state3 = state2.update({ effects: showToolbar.of(null) }).state;
    expect(state3.field(ext).size).toBe(0);
  });
});


