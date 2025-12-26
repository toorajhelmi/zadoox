'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { CodeMirrorEditor } from './codemirror-editor';
import { AIIndicators } from './ai-indicators';
import { toolbarExtension, showToolbar } from './toolbar-extension';
import { useAIAnalysis } from '@/hooks/use-ai-analysis';
import { api } from '@/lib/api/client';
import type { AIActionType, AIAnalysisResponse } from '@zadoox/shared';
import { EditorView } from '@codemirror/view';

interface AIEnhancedEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void;
  onCursorPositionChange?: (position: { line: number; column: number } | null) => void;
  model?: 'openai' | 'auto';
  sidebarOpen?: boolean;
  onSaveWithType?: (content: string, changeType: 'auto-save' | 'ai-action') => Promise<void>;
  readOnly?: boolean;
}

/**
 * AI-Enhanced Editor
 * Wraps CodeMirrorEditor with AI indicators and analysis
 */
export function AIEnhancedEditor({
  value,
  onChange,
  onSelectionChange,
  onCursorPositionChange,
  model = 'auto',
  sidebarOpen: _sidebarOpen = true,
  onSaveWithType,
  readOnly = false,
}: AIEnhancedEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_hoveredParagraph, setHoveredParagraph] = useState<string | null>(null);
  const [processingParagraph, setProcessingParagraph] = useState<{ id: string; action: AIActionType } | null>(null);
  const [previousAnalysis, setPreviousAnalysis] = useState<Map<string, AIAnalysisResponse>>(new Map());
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clearDeltaTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const { paragraphs, getAnalysis, isAnalyzing, analyze: analyzeParagraph } = useAIAnalysis(value, model);
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
      if (!paragraph || !paragraph.text) {
        console.error('Paragraph not found or empty:', paragraphId);
        return;
      }

      // Store previous analysis to show deltas after action completes
      const currentAnalysis = getAnalysis(paragraphId);
      if (currentAnalysis?.analysis) {
        setPreviousAnalysis(prev => {
          const next = new Map(prev);
          next.set(paragraphId, currentAnalysis.analysis!);
          return next;
        });
      }

      // Ensure toolbar stays open by setting hovered paragraph BEFORE setting processing state
      // This prevents the toolbar from disappearing when button is clicked
      setHoveredParagraph(paragraphId);
      
      // Set processing state to show progress bar immediately (this triggers toolbar update via useEffect)
      // Don't dispatch directly here - let useEffect handle it to avoid update conflicts
      setProcessingParagraph({ id: paragraphId, action });
      
      try {
        // Add timeout to prevent hanging (30 seconds)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('AI action timed out after 30 seconds'));
          }, 30000);
        });

        const response = await Promise.race([
          api.ai.action({
            text: paragraph.text,
            action,
            model,
          }),
          timeoutPromise,
        ]);

        if (!response || !response.result) {
          throw new Error('Invalid response from AI service: missing result');
        }

        // Extract start line from paragraph ID (format: para-{startLine})
        const startLineMatch = paragraphId.match(/^para-(\d+)$/);
        if (!startLineMatch) {
          throw new Error(`Invalid paragraph ID format: ${paragraphId}`);
        }

        const startLine = parseInt(startLineMatch[1], 10);
        const lines = value.split('\n');

        if (startLine < 0 || startLine >= lines.length) {
          throw new Error(`Invalid start line: ${startLine} (document has ${lines.length} lines)`);
        }

        // Find the paragraph boundaries: from startLine to the next empty line (exclusive)
        let endLine = startLine;
        while (endLine < lines.length && lines[endLine].trim().length > 0) {
          endLine++;
        }

        // Split the improved text into lines
        const improvedLines = response.result.split('\n');

        // Replace the paragraph lines with the improved lines
        const beforeLines = lines.slice(0, startLine);
        const afterLines = lines.slice(endLine);
        
        // Reconstruct the document: before + improved + after
        const newContent = [...beforeLines, ...improvedLines, ...afterLines].join('\n');
        
        // Change content - this will trigger re-analysis
        onChange(newContent);
        
        // Immediately trigger analysis for the updated paragraph (don't wait for debounce)
        // We need to find the new paragraph ID after content change
        // The paragraph ID is based on start line, which should be the same
        // But we need to wait a bit for the content to be parsed
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for content to update
        
        // Find the updated paragraph text from the new content
        const newLines = newContent.split('\n');
        let newParagraphText = '';
        
        // Reconstruct paragraph text from new content
        let lineIdx = startLine;
        while (lineIdx < newLines.length && newLines[lineIdx].trim().length > 0) {
          if (newParagraphText) {
            newParagraphText += ' ' + newLines[lineIdx].trim();
          } else {
            newParagraphText = newLines[lineIdx].trim();
          }
          lineIdx++;
        }
        
        // Manually trigger analysis for the updated paragraph
        if (newParagraphText && newParagraphText.length >= 10) {
          await analyzeParagraph(paragraphId, newParagraphText);
        }
        
        // Wait a bit more for analysis to complete, then clear processing state
        // This ensures the toolbar shows updated metrics with deltas
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for analysis to complete
        
        // Clear processing state
        setProcessingParagraph(null);
        
        // Save with ai-action changeType if callback is provided
        if (onSaveWithType) {
          await onSaveWithType(newContent, 'ai-action');
        }

        // Keep previousAnalysis for 30 seconds so deltas show when toolbar reopens
        // This allows users to see the changes even if toolbar disappears and reappears
        const existingTimeout = clearDeltaTimeoutRef.current.get(paragraphId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        const timeout = setTimeout(() => {
          setPreviousAnalysis(prev => {
            const next = new Map(prev);
            next.delete(paragraphId);
            return next;
          });
          clearDeltaTimeoutRef.current.delete(paragraphId);
        }, 30000); // Clear deltas after 30 seconds
        clearDeltaTimeoutRef.current.set(paragraphId, timeout);
      } catch (error) {
        console.error('Failed to perform AI action:', error);
        // Show error to user (you could add a toast notification here)
        alert(`Failed to ${action} paragraph: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Clear processing state on error (useEffect will update toolbar)
        setProcessingParagraph(null);
      }
    },
    [paragraphs, value, onChange, model, onSaveWithType, getAnalysis, _hoveredParagraph, analyzeParagraph, previousAnalysis]
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
  
  // Helper function to safely dispatch toolbar updates
  const safeDispatchToolbar = useCallback((updateFn: () => void) => {
    // Use requestAnimationFrame to avoid update conflicts
    requestAnimationFrame(() => {
      try {
        updateFn();
      } catch (error) {
        console.error('Failed to dispatch toolbar update:', error);
      }
    });
  }, []);
  
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
      const currentProcessing = processingParagraph;
      const isProcessing = currentProcessing !== null && currentProcessing.id === paragraphId;
      
      // Dispatch effect to show toolbar widget using safe dispatch
      safeDispatchToolbar(() => {
        if (!editorViewRef.current) {
          return;
        }
        
        editorViewRef.current.dispatch({
          effects: showToolbar.of({
            paragraphId,
            analysis: analysis?.analysis,
            previousAnalysis: previousAnalysis.get(paragraphId),
            lastEdited: analysis?.lastEdited,
            onAction: (action: AIActionType) => handleAIAction(action, paragraphId),
            isProcessing,
            processingAction: isProcessing && currentProcessing !== null ? currentProcessing.action : undefined,
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
              // Don't hide if processing
              if (!processingParagraph) {
                // Hide after delay if not hovering over indicator
                hideTimeoutRef.current = setTimeout(() => {
                  if (!isMouseOverToolbarRef.current && !processingParagraph) {
                    setHoveredParagraph(null);
                    if (editorViewRef.current) {
                      safeDispatchToolbar(() => {
                        if (editorViewRef.current) {
                          editorViewRef.current.dispatch({
                            effects: showToolbar.of(null),
                          });
                        }
                      });
                    }
                  }
                  hideTimeoutRef.current = null;
                }, 300);
              }
            },
          }),
        });
      });
    } else {
      // Mouse left indicator - hide after delay if not over toolbar
      // But don't hide if processing
      if (!processingParagraph) {
        hideTimeoutRef.current = setTimeout(() => {
          if (!isMouseOverToolbarRef.current && !processingParagraph) {
            setHoveredParagraph(null);
            if (editorViewRef.current) {
              safeDispatchToolbar(() => {
                if (editorViewRef.current) {
                  editorViewRef.current.dispatch({
                    effects: showToolbar.of(null),
                  });
                }
              });
            }
          }
          hideTimeoutRef.current = null;
        }, 300);
      }
    }
  }, [getAnalysis, handleAIAction, processingParagraph, previousAnalysis, safeDispatchToolbar]);

  // Keep toolbar visible and update it when processing state changes
  // This ensures immediate update when processing starts and stays open throughout
  useEffect(() => {
    // Determine which paragraph to show toolbar for
    const activeParagraphId = processingParagraph?.id || _hoveredParagraph;
    
    if (!editorViewRef.current) {
      return;
    }
    
    safeDispatchToolbar(() => {
      if (!editorViewRef.current) {
        return;
      }
      
      if (activeParagraphId) {
        // Use ref-based getter to get preserved analysis during content changes
        const analysisData = getAnalysisRef.current(activeParagraphId);
        const isProcessing = processingParagraph?.id === activeParagraphId;
        
        // Always update toolbar to reflect current state (processing or normal)
        editorViewRef.current.dispatch({
          effects: showToolbar.of({
            paragraphId: activeParagraphId,
            analysis: analysisData.analysis,
            previousAnalysis: previousAnalysis.get(activeParagraphId),
            lastEdited: analysisData.lastEdited,
            onAction: (action: AIActionType) => handleAIAction(action, activeParagraphId),
            isProcessing,
            processingAction: isProcessing ? processingParagraph?.action : undefined,
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
              // Only hide after delay if not processing
              if (!processingParagraph) {
                hideTimeoutRef.current = setTimeout(() => {
                  if (!isMouseOverToolbarRef.current) {
                    setHoveredParagraph(null);
                    if (editorViewRef.current) {
                      safeDispatchToolbar(() => {
                        if (editorViewRef.current) {
                          editorViewRef.current.dispatch({
                            effects: showToolbar.of(null),
                          });
                        }
                      });
                    }
                  }
                  hideTimeoutRef.current = null;
                }, 300);
              }
            },
          }),
        });
      } else {
        // No active paragraph - hide toolbar
        editorViewRef.current.dispatch({
          effects: showToolbar.of(null),
        });
      }
    });
  }, [processingParagraph, _hoveredParagraph, handleAIAction, previousAnalysis, paragraphs, value, safeDispatchToolbar]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearDeltaTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      clearDeltaTimeoutRef.current.clear();
    };
  }, []);

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
          onCursorPositionChange={onCursorPositionChange}
          extensions={[toolbarExt]}
          onEditorViewReady={(view) => {
            editorViewRef.current = view;
          }}
          readOnly={readOnly}
        />
        
        {/* AI Indicators Column (overlay on left) */}
        <div className="absolute left-0 top-0 h-full w-6 z-20 pointer-events-none">
          <AIIndicators
            content={value}
            onParagraphHover={handleParagraphHover}
            onIndicatorClick={handleIndicatorClick}
            model={model}
            editorView={editorViewRef.current}
            toolbarVisible={_hoveredParagraph !== null}
            toolbarParagraphId={_hoveredParagraph}
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

