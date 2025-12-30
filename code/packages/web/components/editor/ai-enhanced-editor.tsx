'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { CodeMirrorEditor } from './codemirror-editor';
import { AIIndicators } from './ai-indicators';
import { toolbarExtension, showToolbar } from './toolbar-extension';
import {
  paragraphBlockControlsExtension,
  paragraphBlockControlsTheme,
} from './paragraph-block-controls-extension';
import { useAIAnalysis } from '@/hooks/use-ai-analysis';
import { api } from '@/lib/api/client';
import type { AIActionType, AIAnalysisResponse, ParagraphMode, ChangeBlock } from '@zadoox/shared';
import { EditorView } from '@codemirror/view';
import { changeHighlightExtension, setChanges } from './change-highlight-extension';

interface AIEnhancedEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void;
  onCursorPositionChange?: (position: { line: number; column: number } | null) => void;
  model?: 'openai' | 'auto';
  sidebarOpen?: boolean;
  onSaveWithType?: (content: string, changeType: 'auto-save' | 'ai-action') => Promise<void>;
  readOnly?: boolean;
  paragraphModes?: Record<string, ParagraphMode>;
  documentId?: string;
  onCurrentParagraphChange?: (paragraphId: string | null) => void;
  thinkPanelOpen?: boolean;
  openParagraphId?: string | null;
  onOpenPanel?: (paragraphId: string) => void;
  onEditorViewReady?: (view: EditorView | null) => void;
  changes?: ChangeBlock[];
  onAcceptChange?: (changeId: string) => void;
  onRejectChange?: (changeId: string) => void;
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
  paragraphModes: _paragraphModes = {},
  documentId: _documentId,
  onCurrentParagraphChange,
  thinkPanelOpen = false,
  openParagraphId = null,
  onOpenPanel,
  onEditorViewReady,
  changes,
  onAcceptChange,
  onRejectChange,
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

  // Memoize change highlight extension
  const changeHighlightExt = useMemo(() => {
    if (!onAcceptChange || !onRejectChange) return null;
    return changeHighlightExtension(onAcceptChange, onRejectChange);
  }, [onAcceptChange, onRejectChange]);

  const paragraphBlockControlsExt = useMemo(() => {
    return [
      paragraphBlockControlsTheme(),
      paragraphBlockControlsExtension({
        openParagraphId,
        onOpenPanel: onOpenPanel || (() => {}),
        disabled: readOnly,
      }),
    ];
  }, [openParagraphId, onOpenPanel, readOnly]);

  // Dispatch changes to CodeMirror when they update
  useEffect(() => {
    if (!editorViewRef.current) {
      return;
    }
    // Always dispatch changes (even if empty) to clear decorations when changes are cleared
    const changesToDispatch = changes || [];
    editorViewRef.current.dispatch({
      effects: setChanges.of(changesToDispatch),
    });
  }, [changes]);
  
  // Helper function to check if a line is a markdown heading
  const isHeading = (line: string): boolean => {
    const trimmed = line.trim();
    return /^#{1,6}\s/.test(trimmed);
  };

  // Find paragraph at cursor position
  // Sections (headings) and all content below until next heading are treated as one paragraph
  const findParagraphAtCursor = useCallback((line: number): string | null => {
    const lines = value.split('\n');
    const cursorLine = line - 1; // Convert to 0-based
    
    let currentParagraph: { startLine: number; text: string } | null = null;
    let paragraphStartLine = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const lineIsHeading = isHeading(trimmed);
      
      if (lineIsHeading) {
        // If we encounter a heading, check if cursor was in previous paragraph
        if (currentParagraph && cursorLine >= paragraphStartLine && cursorLine < i) {
          return `para-${paragraphStartLine}`;
        }
        // Start new section with this heading
        currentParagraph = { startLine: i, text: trimmed };
        paragraphStartLine = i;
      } else if (trimmed) {
        // Non-heading content - add to current paragraph (or start one if none exists)
        if (!currentParagraph) {
          currentParagraph = { startLine: i, text: trimmed };
          paragraphStartLine = i;
        } else {
          currentParagraph.text += ' ' + trimmed;
        }
      } else if (!trimmed && currentParagraph) {
        // Blank line - only end paragraph if it's not a section
        // Check if current paragraph starts with a heading by checking the first line
        const firstLine = lines[paragraphStartLine]?.trim() || '';
        const currentIsHeading = isHeading(firstLine);
        if (!currentIsHeading) {
          // Regular paragraph ends at blank line
          if (cursorLine >= paragraphStartLine && cursorLine < i) {
            return `para-${paragraphStartLine}`;
          }
          currentParagraph = null;
        }
        // If it's a section, blank lines are part of the section content
      }
    }
    
    // Check if cursor is in the final paragraph
    if (currentParagraph && cursorLine >= paragraphStartLine) {
      return `para-${paragraphStartLine}`;
    }
    
    return null;
  }, [value]);
  
  // Track current paragraph when cursor moves
  const handleCursorPositionChangeInternal = useCallback((position: { line: number; column: number } | null) => {
    // Call the original callback if provided
    if (onCursorPositionChange) {
      onCursorPositionChange(position);
    }
    
    // Update current paragraph ID when cursor moves
    if (position && onCurrentParagraphChange) {
      const paraId = findParagraphAtCursor(position.line);
      onCurrentParagraphChange(paraId);
    } else if (onCurrentParagraphChange) {
      onCurrentParagraphChange(null);
    }
  }, [findParagraphAtCursor, onCursorPositionChange, onCurrentParagraphChange]);
  
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
        // Extract start line to check if this is a section
        const startLineMatch = paragraphId.match(/^para-(\d+)$/);
        const startLine = startLineMatch ? parseInt(startLineMatch[1], 10) : -1;
        const lines = value.split('\n');
        const isSection = startLine >= 0 && startLine < lines.length && isHeading(lines[startLine].trim());
        
        // For sections, extract only the content (excluding the heading) to send to AI
        let textToProcess = paragraph.text;
        let sectionHeading: string | null = null;
        
        if (isSection && startLine >= 0 && startLine < lines.length) {
          sectionHeading = lines[startLine];
          // Remove heading from text - paragraph.text is "heading content", so we need to extract just content
          // The paragraph.text starts with the heading, so we need to find where it ends
          const headingText = lines[startLine].trim();
          if (textToProcess.startsWith(headingText)) {
            // Remove heading and any following space
            textToProcess = textToProcess.substring(headingText.length).trim();
          } else {
            // Fallback: try to extract content after first space (if heading is "# intro", text might be "# intro content")
            const firstSpaceIndex = textToProcess.indexOf(' ', headingText.indexOf(' ') + 1);
            if (firstSpaceIndex > 0) {
              textToProcess = textToProcess.substring(firstSpaceIndex).trim();
            }
          }
        }

        // Add timeout to prevent hanging (30 seconds)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('AI action timed out after 30 seconds'));
          }, 30000);
        });

        const response = await Promise.race([
          api.ai.action({
            text: textToProcess,
            action,
            model,
          }),
          timeoutPromise,
        ]);

        if (!response || !response.result) {
          throw new Error('Invalid response from AI service: missing result');
        }

        // Use the startLine and lines we already extracted above
        if (startLine < 0 || startLine >= lines.length) {
          throw new Error(`Invalid start line: ${startLine} (document has ${lines.length} lines)`);
        }

        // Find the paragraph boundaries using the same logic as parsing
        // Sections (headings) and all content below until next heading are treated as one unit
        let endLine = startLine;
        
        // Check if start line is a heading
        const startLineIsHeading = startLine < lines.length && isHeading(lines[startLine].trim());
        
        if (startLineIsHeading) {
          // For headings, include all following lines until next heading (sections continue through blank lines)
          endLine = startLine + 1;
          while (endLine < lines.length) {
            const trimmed = lines[endLine].trim();
            if (isHeading(trimmed)) {
              // Next heading starts a new section - don't include it
              break;
            }
            endLine++;
          }
        } else {
          // For regular paragraphs, find until next empty line or heading
          while (endLine < lines.length) {
            const trimmed = lines[endLine].trim();
            if (!trimmed) {
              // Blank line ends paragraph
              break;
            }
            if (isHeading(trimmed)) {
              // Heading starts new section - don't include it
              break;
            }
            endLine++;
          }
        }

        // Split the improved text into lines
        let improvedLines = response.result.split('\n');

        // If this is a section (heading), prepend the original heading
        if (isSection && sectionHeading !== null) {
          improvedLines = [sectionHeading, ...improvedLines];
        }

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

  // Disable selection when Think panel is open
  const disableSelectionExt = useMemo(() => {
    if (!thinkPanelOpen) {
      return [];
    }
    return [
      EditorView.domEventHandlers({
        selectstart: (event) => {
          event.preventDefault();
          return true;
        },
        mousedown: (event) => {
          // Prevent mouse selection when panel is open
          if (event.button === 0) {
            event.preventDefault();
            return true;
          }
          return false;
        },
      }),
    ];
  }, [thinkPanelOpen]);

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
    // Don't allow hovering/selection when Think panel is open
    if (thinkPanelOpen) {
      return;
    }

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
  const handleIndicatorClick = useCallback((_paragraphId: string, _state: string) => {
    // Could open a detailed view or perform action
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
          onCursorPositionChange={handleCursorPositionChangeInternal}
          extensions={[
            toolbarExt,
            ...disableSelectionExt,
            ...(changeHighlightExt ? [changeHighlightExt] : []),
            ...paragraphBlockControlsExt,
          ]}
          onEditorViewReady={(view) => {
            editorViewRef.current = view;
            if (onEditorViewReady) {
              onEditorViewReady(view);
            }
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
        
        {/* Paragraph Block Controls are now rendered inline via CodeMirror widgets */}
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

