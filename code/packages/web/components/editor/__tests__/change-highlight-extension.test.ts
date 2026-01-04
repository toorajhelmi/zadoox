/**
 * changeHighlightExtension tests
 */
/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { changeHighlightExtension, setChanges } from '../change-highlight-extension';

describe('changeHighlightExtension', () => {
  it('creates decorations for pending changes and clears when setChanges([])', () => {
    const [pendingField, decoField] = changeHighlightExtension(vi.fn(), vi.fn());

    const state = EditorState.create({
      doc: 'Hello\nWorld\n',
      extensions: [pendingField, decoField],
    });

    expect(state.field(pendingField).length).toBe(0);
    expect(state.field(decoField).size).toBe(0);

    const withChanges = state.update({
      effects: setChanges.of([
        {
          id: 'c1',
          startPosition: 0,
          endPosition: 5,
          accepted: undefined,
        } as any,
      ]),
    }).state;

    expect(withChanges.field(pendingField).length).toBe(1);
    expect(withChanges.field(decoField).size).toBeGreaterThan(0);

    const cleared = withChanges.update({ effects: setChanges.of([]) }).state;
    expect(cleared.field(pendingField).length).toBe(0);
    expect(cleared.field(decoField).size).toBe(0);
  });
});


