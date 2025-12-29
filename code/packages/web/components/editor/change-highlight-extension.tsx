'use client';

import { StateField, StateEffect } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { ChangeIndicator } from './change-indicator';
import { createRoot, Root } from 'react-dom/client';
import type { ChangeBlock } from '@zadoox/shared';

interface ChangeHighlightProps {
  change: ChangeBlock;
  onAccept: (changeId: string) => void;
  onReject: (changeId: string) => void;
}

/**
 * Widget for change indicator badge
 */
class ChangeIndicatorWidget extends WidgetType {
  private root: Root | null = null;

  constructor(private props: ChangeHighlightProps) {
    super();
  }

  toDOM() {
    const container = document.createElement('span');
    container.className = 'change-indicator-widget';
    this.root = createRoot(container);
    this.root.render(
      <ChangeIndicator
        change={this.props.change}
        onAccept={this.props.onAccept}
        onReject={this.props.onReject}
        position={{ from: 0, to: 0 }} // Position is handled by decoration
      />
    );
    return container;
  }

  destroy() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  ignoreEvent() {
    return false; // Handle clicks on buttons
  }
}

// State effect to update changes
export const setChanges = StateEffect.define<ChangeBlock[]>();

/**
 * Create CodeMirror extension for change highlighting
 */
export function changeHighlightExtension(
  onAcceptChange: (changeId: string) => void,
  onRejectChange: (changeId: string) => void
) {
  return StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(decorations, tr) {
      const changes: ChangeBlock[] = [];

      // Collect changes from state effects
      for (const effect of tr.effects) {
        if (effect.is(setChanges)) {
          changes.push(...effect.value);
        }
      }

      // If we have new changes, create fresh decorations (replace all)
      if (changes.length > 0) {
        const markRanges: Array<{ from: number; to: number; value: ReturnType<typeof Decoration.mark> }> = [];
        const widgetRanges: Array<{ from: number; to: number; value: ReturnType<typeof Decoration.widget> }> = [];

        for (const change of changes) {
          if (change.accepted === undefined) {
            // Only show pending changes
            const from = change.startPosition;
            const to = change.endPosition || change.startPosition;

            // Highlight decoration based on change type
            let markDeco: ReturnType<typeof Decoration.mark>;
            switch (change.type) {
              case 'add':
                markDeco = Decoration.mark({
                  class: 'cm-change-add',
                  attributes: { title: `Added: ${change.newText?.substring(0, 50)}` },
                });
                break;
              case 'delete':
                markDeco = Decoration.mark({
                  class: 'cm-change-delete',
                  attributes: { title: `Deleted: ${change.originalText?.substring(0, 50)}` },
                });
                break;
              case 'modify':
                markDeco = Decoration.mark({
                  class: 'cm-change-modify',
                  attributes: {
                    title: `Modified: ${change.originalText?.substring(0, 30)} → ${change.newText?.substring(0, 30)}`,
                  },
                });
                break;
              default:
                markDeco = Decoration.mark({
                  class: 'cm-change-unknown',
                });
            }

            markRanges.push({ from, to, value: markDeco });

            // Add indicator widget at the start of the change
            const indicatorWidget = Decoration.widget({
              widget: new ChangeIndicatorWidget({
                change,
                onAccept: onAcceptChange,
                onReject: onRejectChange,
              }),
              side: 1, // After the position
            });
            widgetRanges.push({ from, to: from, value: indicatorWidget });
          }
        }

        // Create all ranges: marks first, then widgets (sorted by position)
        // Marks come before widgets at the same position (startSide ordering: marks=0, widgets with side:1=1)
        const allRanges: Array<{ from: number; to: number; startSide: number; range: any }> = [];
        
        // Add marks (startSide = 0)
        markRanges.forEach(r => {
          allRanges.push({ 
            from: r.from, 
            to: r.to, 
            startSide: 0, // Marks have startSide 0
            range: r.value.range(r.from, r.to) 
          });
        });
        
        // Add widgets (startSide = 1 for side:1)
        widgetRanges.forEach(r => {
          allRanges.push({ 
            from: r.from, 
            to: r.to, 
            startSide: 1, // Widgets with side:1 have startSide 1
            range: r.value.range(r.from, r.to) 
          });
        });
        
        // Sort: by from position first, then by startSide
        allRanges.sort((a, b) => {
          if (a.from !== b.from) {
            return a.from - b.from;
          }
          // At same from position: sort by startSide (marks=0 before widgets=1)
          if (a.startSide !== b.startSide) {
            return a.startSide - b.startSide;
          }
          return a.to - b.to;
        });
        
        // Create decoration set from sorted ranges
        // Use Decoration.set with sorted ranges, or use update method
        return Decoration.set(allRanges.map(d => d.range));
      }

      // No new changes - map existing decorations through document changes
      return decorations.map(tr.changes);
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}

