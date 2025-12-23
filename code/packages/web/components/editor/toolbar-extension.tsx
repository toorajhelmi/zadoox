'use client';

import { StateField, StateEffect } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { createRoot, Root } from 'react-dom/client';
import { ParagraphToolbar } from './paragraph-toolbar';
import type { AIAnalysisResponse, AIActionType } from '@zadoox/shared';

interface ToolbarWidgetProps {
  paragraphId: string;
  analysis?: AIAnalysisResponse;
  lastEdited?: Date;
  onAction?: (action: AIActionType) => void;
  onViewDetails?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * CodeMirror Widget for inline paragraph toolbar
 */
class ToolbarWidget extends WidgetType {
  private root: Root | null = null;
  private container: HTMLDivElement | null = null;

  constructor(private props: ToolbarWidgetProps) {
    super();
  }

  toDOM() {
    const container = document.createElement('div');
    container.className = 'paragraph-toolbar-widget';
    container.style.cssText = 'margin: 8px 0; width: 100%;';
    
    // Add mouse event handlers to keep toolbar visible when hovered
    if (this.props.onMouseEnter) {
      container.addEventListener('mouseenter', this.props.onMouseEnter);
    }
    
    if (this.props.onMouseLeave) {
      container.addEventListener('mouseleave', this.props.onMouseLeave);
    }
    
    this.container = container;
    
    // Create React root and render toolbar
    this.root = createRoot(container);
    this.root.render(
      <ParagraphToolbar
        paragraphId={this.props.paragraphId}
        analysis={this.props.analysis}
        lastEdited={this.props.lastEdited}
        onAction={this.props.onAction}
        onViewDetails={this.props.onViewDetails}
        visible={true}
      />
    );
    
    return container;
  }

  destroy() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.container = null;
  }

  updateDOM(dom: HTMLElement): boolean {
    // Update props if needed
    if (this.root && this.container === dom) {
      this.root.render(
        <ParagraphToolbar
          paragraphId={this.props.paragraphId}
          analysis={this.props.analysis}
          lastEdited={this.props.lastEdited}
          onAction={this.props.onAction}
          onViewDetails={this.props.onViewDetails}
          visible={true}
        />
      );
    }
    return true;
  }

  ignoreEvent() {
    return false; // Handle events
  }
}

// State effect to show/hide toolbar
export const showToolbar = StateEffect.define<ToolbarWidgetProps | null>();

// State field to manage toolbar decorations
export function toolbarExtension(
  getParagraphStart: (paragraphId: string) => number | null,
  getAnalysis: (paragraphId: string) => { analysis?: AIAnalysisResponse; lastEdited?: Date } | undefined
) {
  // Store current toolbar state - shared across all instances
  let currentParagraphId: string | null = null;
  let currentWidgetProps: ToolbarWidgetProps | null = null;

  return StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(decorations, tr) {
      // Check for toolbar show/hide effects first
      for (const effect of tr.effects) {
        if (effect.is(showToolbar)) {
          if (effect.value) {
            // Show toolbar - update state
            currentParagraphId = effect.value.paragraphId;
            currentWidgetProps = effect.value;
          } else {
            // Hide toolbar - clear state
            currentParagraphId = null;
            currentWidgetProps = null;
            return Decoration.none;
          }
        }
      }
      
      // If we should show toolbar, ensure it's present
      if (currentParagraphId && currentWidgetProps) {
        const pos = getParagraphStart(currentParagraphId);
        
        if (pos !== null && pos <= tr.newDoc.length) {
          // Always recreate widget at the correct position (handles document changes)
          const analysisData = getAnalysis(currentParagraphId);
          const widgetDeco = Decoration.widget({
            widget: new ToolbarWidget({
              paragraphId: currentParagraphId,
              analysis: analysisData?.analysis,
              lastEdited: analysisData?.lastEdited,
              onAction: currentWidgetProps.onAction,
              onViewDetails: currentWidgetProps.onViewDetails,
              onMouseEnter: currentWidgetProps.onMouseEnter,
              onMouseLeave: currentWidgetProps.onMouseLeave,
            }),
            side: -1, // Before the position (above the paragraph)
          });
          
          // Create new decoration set with widget at current position
          // This ensures the widget stays visible even when document changes
          // Use Decoration.none.update() to add decorations
          return Decoration.none.update({
            add: [widgetDeco.range(pos)]
          });
        } else {
          // Position is invalid - clear decorations
          return Decoration.none;
        }
      }
      
      // If no widget should be shown, return empty decorations
      // But map existing decorations through changes if they exist (to handle document edits)
      if (decorations.size > 0) {
        return decorations.map(tr.changes);
      }
      return Decoration.none;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}

