'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { CodeMirrorEditor } from './codemirror-editor';
import { AIIndicators } from './ai-indicators';
import { toolbarExtension, showToolbar } from './toolbar-extension';
import { useAIAnalysis } from '@/hooks/use-ai-analysis';
import { api } from '@/lib/api/client';
import type { AIActionType } from '@zadoox/shared';
import { EditorView } from '@codemirror/view';

interface AIEnhancedEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void;
  model?: 'openai' | 'auto';
  sidebarOpen?: boolean;
}

/**
 * AI-Enhanced Editor
 * Wraps CodeMirrorEditor with AI indicators and analysis
 */
export function AIEnhancedEditor({
  value,
  onChange,
  onSelectionChange,
  model = 'auto',
  sidebarOpen: _sidebarOpen = true,
}: AIEnhancedEditorProps) {
  const [hoveredParagraph, setHoveredParagraph] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { paragraphs, getAnalysis, isAnalyzing } = useAIAnalysis(value, model);
  const editorViewRef = useRef<EditorView | null>(null);
  
  // Get paragraph start position in document (for positioning toolbar above)
  // Since useAIAnalysis doesn't track line numbers, we need to find the paragraph in the document
  const getParagraphStart = useCallback((paragraphId: string): number | null => {
    const paragraph = paragraphs.find(p => p.id === paragraphId);
    if (!paragraph) {
      return null;
    }
    
    // Extract startLine from paragraph ID (format: para-{startLine})
    const startLineMatch = paragraphId.match(/^para-(\d+)$/);
    if (!startLineMatch) {
      return null;
    }
    
    const startLine = parseInt(startLineMatch[1], 10);
    const lines = value.split('\n');
    
    if (startLine < 0 || startLine >= lines.length) {
      return null;
    }
    
    // Calculate position at start of paragraph (beginning of first line)
    let pos = 0;
    for (let i = 0; i < startLine && i < lines.length; i++) {
      pos += lines[i].length;
      pos += 1; // Newline character
    }
    
    // Ensure position doesn't exceed document length
    const maxPos = value.length;
    if (pos > maxPos) {
      pos = maxPos;
    }
    
    return pos;
  }, [paragraphs, value]);
  
  // Handle AI action (defined first to avoid circular dependency)
  const handleAIAction = useCallback(
    async (action: AIActionType, paragraphId: string) => {
      const paragraph = paragraphs.find((p) => p.id === paragraphId);
      if (!paragraph || !paragraph.text) return;

      setIsProcessingAction(true);
      try {
        const response = await api.ai.action({
          text: paragraph.text,
          action,
          model,
        });

        // Replace paragraph text with improved version
        const lines = value.split('\n');
        const paragraphStart = lines.findIndex((line) => {
          // Find the line that contains this paragraph
          // This is a simplified approach - in production, you'd track exact positions
          return line.includes(paragraph.text.substring(0, 20));
        });

        if (paragraphStart !== -1) {
          // Replace the paragraph
          const before = lines.slice(0, paragraphStart).join('\n');
          const after = lines.slice(paragraphStart + 1).join('\n');
          const newContent = before + '\n' + response.result + '\n' + after;
          onChange(newContent);
        }
      } catch (error) {
        console.error('Failed to perform AI action:', error);
      } finally {
        setIsProcessingAction(false);
      }
    },
    [paragraphs, value, onChange, model]
  );

  // Create toolbar extension - create once and persist
  // Use refs for callbacks to avoid recreating extension
  const getParagraphStartRef = useRef(getParagraphStart);
  const getAnalysisRef = useRef((id: string) => {
    const analysis = getAnalysis(id);
    return {
      analysis: analysis?.analysis,
      lastEdited: analysis?.lastEdited,
    };
  });
  
  // Update refs when callbacks change
  useEffect(() => {
    getParagraphStartRef.current = getParagraphStart;
  }, [getParagraphStart]);
  
  useEffect(() => {
    getAnalysisRef.current = (id: string) => {
      const analysis = getAnalysis(id);
      return {
        analysis: analysis?.analysis,
        lastEdited: analysis?.lastEdited,
      };
    };
  }, [getAnalysis]);
  
  // Create extension once - it will use the refs which always point to latest callbacks
  const toolbarExt = useMemo(() => {
    return toolbarExtension(
      (id: string) => getParagraphStartRef.current(id),
      (id: string) => getAnalysisRef.current(id)
    );
  }, []); // Empty deps - extension created once

  // Track if mouse is over toolbar widget
  const isMouseOverToolbarRef = useRef(false);
  
  // Handle paragraph hover - update which paragraph is hovered
  const handleParagraphHover = useCallback((paragraphId: string | null) => {
    // Clear any pending hide
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (paragraphId && editorViewRef.current) {
      // Mouse entered indicator - show toolbar inline
      setHoveredParagraph(paragraphId);
      isMouseOverToolbarRef.current = false; // Reset toolbar hover state
      
      const analysis = getAnalysis(paragraphId);
      
      // Dispatch effect to show toolbar widget
      if (editorViewRef.current) {
        editorViewRef.current.dispatch({
          effects: showToolbar.of({
            paragraphId,
            analysis: analysis?.analysis,
            lastEdited: analysis?.lastEdited,
            onAction: (action: AIActionType) => handleAIAction(action, paragraphId),
            onMouseEnter: () => {
              isMouseOverToolbarRef.current = true;
              // Clear any pending hide
              if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = null;
              }
            },
            onMouseLeave: () => {
              isMouseOverToolbarRef.current = false;
              // Hide after delay if not hovering over indicator
              hideTimeoutRef.current = setTimeout(() => {
                if (!isMouseOverToolbarRef.current) {
                  setHoveredParagraph(null);
                  if (editorViewRef.current) {
                    editorViewRef.current.dispatch({
                      effects: showToolbar.of(null),
                    });
                  }
                }
                hideTimeoutRef.current = null;
              }, 300);
            },
          }),
        });
      }
    } else {
      // Mouse left indicator - hide after delay if not over toolbar
      hideTimeoutRef.current = setTimeout(() => {
        if (!isMouseOverToolbarRef.current) {
          setHoveredParagraph(null);
          if (editorViewRef.current) {
            editorViewRef.current.dispatch({
              effects: showToolbar.of(null),
            });
          }
        }
        hideTimeoutRef.current = null;
      }, 300);
    }
  }, [getAnalysis, handleAIAction]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Handle indicator click
  const handleIndicatorClick = useCallback((paragraphId: string, state: string) => {
    // Could open a detailed view or perform action
    console.log('Indicator clicked:', paragraphId, state);
  }, []);

  // Get current paragraph analysis (for future use)
  // const currentAnalysis = hoveredParagraph ? getAnalysis(hoveredParagraph) : undefined;


  return (
    <div ref={editorContainerRef} className="relative h-full w-full">
      {/* CodeMirror Editor */}
      <div className="h-full w-full relative">
        <CodeMirrorEditor
          value={value}
          onChange={onChange}
          onSelectionChange={onSelectionChange}
          extensions={[toolbarExt]}
          onEditorViewReady={(view) => {
            editorViewRef.current = view;
          }}
        />
        
        {/* AI Indicators Column (overlay on left) */}
        <div className="absolute left-0 top-0 h-full w-6 z-20 pointer-events-none">
          <AIIndicators
            content={value}
            onParagraphHover={handleParagraphHover}
            onIndicatorClick={handleIndicatorClick}
            model={model}
          />
        </div>
      </div>

      {/* Toolbar is now rendered inline via CodeMirror widgets */}

      {/* Loading indicator */}
      {isAnalyzing && (
        <div className="absolute top-2 right-2 bg-vscode-editorBg border border-vscode-border rounded px-2 py-1 text-xs text-vscode-text-secondary">
          Analyzing...
        </div>
      )}
    </div>
  );
}

