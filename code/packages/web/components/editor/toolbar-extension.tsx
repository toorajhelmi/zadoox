'use client';

import { StateField, StateEffect, Transaction } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { createRoot, Root } from 'react-dom/client';
import { ParagraphToolbar } from './paragraph-toolbar';
import type { AIAnalysisResponse, AIActionType } from '@zadoox/shared';

interface ToolbarWidgetProps {
  paragraphId: string;
  analysis?: AIAnalysisResponse;
  previousAnalysis?: AIAnalysisResponse;
  lastEdited?: Date;
  onAction?: (action: AIActionType) => void;
  onViewDetails?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isProcessing?: boolean;
  processingAction?: AIActionType;
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
        previousAnalysis={this.props.previousAnalysis}
        lastEdited={this.props.lastEdited}
        onAction={this.props.onAction}
        onViewDetails={this.props.onViewDetails}
        visible={true}
        isProcessing={this.props.isProcessing}
        processingAction={this.props.processingAction}
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
    // Always update props when they change (especially isProcessing)
    if (this.root && this.container === dom) {
      // Use flushSync for immediate update
      this.root.render(
        <ParagraphToolbar
          paragraphId={this.props.paragraphId}
          analysis={this.props.analysis}
          previousAnalysis={this.props.previousAnalysis}
          lastEdited={this.props.lastEdited}
          onAction={this.props.onAction}
          onViewDetails={this.props.onViewDetails}
          visible={true}
          isProcessing={this.props.isProcessing}
          processingAction={this.props.processingAction}
        />
      );
      return true; // Indicate that we handled the update
    }
    return false;
  }
  
  eq(other: ToolbarWidget): boolean {
    // Consider widgets equal only if processing state matches
    // This forces update when processing state changes
    return (
      this.props.paragraphId === other.props.paragraphId &&
      this.props.isProcessing === other.props.isProcessing &&
      this.props.processingAction === other.props.processingAction
    );
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
    update(decorations: DecorationSet, tr: Transaction) {
      // Check for toolbar show/hide effects first
      let propsChanged = false;
      for (const effect of tr.effects) {
        if (effect.is(showToolbar)) {
          if (effect.value) {
            // Check if props actually changed (especially isProcessing)
            const processingChanged = 
              currentWidgetProps?.isProcessing !== effect.value.isProcessing ||
              currentWidgetProps?.processingAction !== effect.value.processingAction;
            
            // Show toolbar - update state
            currentParagraphId = effect.value.paragraphId;
            currentWidgetProps = effect.value;
            propsChanged = processingChanged;
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
          // Always recreate widget to ensure props are up to date (especially isProcessing)
          const analysisData = getAnalysis(currentParagraphId);
          const widgetDeco = Decoration.widget({
            widget: new ToolbarWidget({
              paragraphId: currentParagraphId,
              analysis: analysisData?.analysis,
              previousAnalysis: currentWidgetProps.previousAnalysis, // Always preserve previousAnalysis
              lastEdited: analysisData?.lastEdited,
              onAction: currentWidgetProps.onAction,
              onViewDetails: currentWidgetProps.onViewDetails,
              onMouseEnter: currentWidgetProps.onMouseEnter,
              onMouseLeave: currentWidgetProps.onMouseLeave,
              isProcessing: currentWidgetProps.isProcessing,
              processingAction: currentWidgetProps.processingAction,
            }),
            side: -1, // Before the position (above the paragraph)
          });
          
          // Always recreate decoration to force widget update
          if (propsChanged || tr.docChanged || decorations.size === 0) {
            return Decoration.none.update({
              add: [widgetDeco.range(pos)]
            });
          }
          // Otherwise, map existing decorations through changes
          return decorations.map(tr.changes);
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
    provide: (f: StateField<DecorationSet>) => EditorView.decorations.from(f),
  });
}

