'use client';

import { StateField, StateEffect } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import type { ChangeBlock } from '@zadoox/shared';

// State effect to update changes
export const setChanges = StateEffect.define<ChangeBlock[]>();

/**
 * Create CodeMirror extension for change highlighting
 */
export function changeHighlightExtension(
  _onAcceptChange: (changeId: string) => void,
  _onRejectChange: (changeId: string) => void
) {
  // Store pending changes in a state field so they persist across transactions
  const pendingChangesField = StateField.define<ChangeBlock[]>({
    create: () => [],
    update: (value, tr) => {
      // Collect new changes from effects
      for (const effect of tr.effects) {
        if (effect.is(setChanges)) {
          return effect.value; // Replace with new changes
        }
      }
      return value; // Keep existing changes
    },
  });

  return [
    pendingChangesField,
    StateField.define<DecorationSet>({
      create() {
        return Decoration.none;
      },
      update(decorations, tr) {
        // Get changes from the state field (persists across transactions)
        const changes = tr.state.field(pendingChangesField);
        const docLength = tr.state.doc.length;

        // If no changes, clear all decorations
        if (changes.length === 0) {
          return Decoration.none;
        }

      // SIMPLIFIED: Highlight only the NEW parts (changes), not the entire document
      if (docLength > 0) {
        const markRanges: Array<{ from: number; to: number; value: ReturnType<typeof Decoration.mark> }> = [];
        const lineRanges: Array<{ from: number; value: ReturnType<typeof Decoration.line> }> = [];
        
        // Process each change - highlight only the new parts
        for (const change of changes) {
          if (change.accepted === undefined) {
            // Only show pending changes
            const from = change.startPosition;
            const to = change.endPosition || change.startPosition;

            // Skip invalid ranges
            if (from > to || from >= docLength || to > docLength) continue;

            // Get line numbers for right-side indicators
            const fromLine = tr.state.doc.lineAt(from).number;
            const toLine = tr.state.doc.lineAt(Math.min(to, docLength - 1)).number;

            // Always use "add" style (green) for new content
            const markDeco = Decoration.mark({
              class: 'cm-change-add',
              attributes: { title: 'New content' },
            });
            markRanges.push({ from, to, value: markDeco });

            // Add line decorations for right-side indicators
            for (let lineNum = fromLine; lineNum <= toLine; lineNum++) {
              try {
                const line = tr.state.doc.line(lineNum);
                const lineDeco = Decoration.line({
                  class: 'cm-change-add-line',
                });
                lineRanges.push({ from: line.from, value: lineDeco });
              } catch (error) {
                // Skip if line doesn't exist
              }
            }
          }
        }

        // Build decoration set incrementally
        let decorationSet = Decoration.none;
        
        // Add line decorations first
        for (const lineRange of lineRanges) {
          try {
            decorationSet = decorationSet.update({
              add: [lineRange.value.range(lineRange.from)],
            });
          } catch (error) {
            // Skip on error
          }
        }
        
        // Add mark decorations
        for (const markRange of markRanges) {
          try {
            decorationSet = decorationSet.update({
              add: [markRange.value.range(markRange.from, markRange.to)],
            });
          } catch (error) {
            // Skip on error
          }
        }
        
        return decorationSet;
      }

      // No document content - return none
      return Decoration.none;
    },
    provide: (f) => EditorView.decorations.from(f),
  }),
  ];
}

