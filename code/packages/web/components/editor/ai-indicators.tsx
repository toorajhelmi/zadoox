'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AIAnalysisResponse } from '@zadoox/shared';
import { EditorView, ViewUpdate } from '@codemirror/view';

export type IndicatorState = 'error' | 'warning' | 'suggestion' | 'good' | 'pending';

export interface ParagraphMetadata {
  id: string;
  startLine: number;
  endLine: number;
  text: string;
  analysis?: AIAnalysisResponse;
  lastAnalyzed?: Date;
}

interface AIIndicatorsProps {
  content: string;
  onParagraphHover?: (paragraphId: string | null) => void;
  onIndicatorClick?: (paragraphId: string, indicator: IndicatorState) => void;
  model?: 'openai' | 'auto';
  editorView?: EditorView | null;
  toolbarVisible?: boolean;
  toolbarParagraphId?: string | null;
}

/**
 * AI Indicators Component
 * Displays left margin indicators for paragraphs with AI analysis
 */
export function AIIndicators({
  content,
  onParagraphHover,
  onIndicatorClick,
  model: _model = 'auto',
  editorView,
  toolbarVisible = false,
  toolbarParagraphId = null,
}: AIIndicatorsProps) {
  const [paragraphs, setParagraphs] = useState<ParagraphMetadata[]>([]);
  const [hoveredParagraph, setHoveredParagraph] = useState<string | null>(null);
  const [linePositions, setLinePositions] = useState<Map<number, { top: number; height: number }>>(new Map());
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use toolbar state to determine which paragraph should be visible
  // If toolbar is visible, only show that paragraph's indicator
  const activeParagraphId = toolbarVisible ? toolbarParagraphId : hoveredParagraph;

  // Parse content into paragraphs
  useEffect(() => {
    const lines = content.split('\n');
    const parsed: ParagraphMetadata[] = [];
    let currentParagraph: { startLine: number; text: string } | null = null;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Empty line ends current paragraph
      if (!trimmed && currentParagraph) {
        parsed.push({
          id: `para-${currentParagraph.startLine}`,
          startLine: currentParagraph.startLine,
          endLine: index - 1,
          text: currentParagraph.text.trim(),
        });
        currentParagraph = null;
      } else if (trimmed) {
        // Start new paragraph or continue current
        if (!currentParagraph) {
          currentParagraph = { startLine: index, text: trimmed };
        } else {
          currentParagraph.text += ' ' + trimmed;
        }
      }
    });

    // Add final paragraph if exists
    if (currentParagraph) {
      const para: { startLine: number; text: string } = currentParagraph;
      parsed.push({
        id: `para-${para.startLine}`,
        startLine: para.startLine,
        endLine: lines.length - 1,
        text: para.text.trim(),
      });
    }

    setParagraphs(parsed);
  }, [content]);

  // Function to update line positions
  const updateLinePositions = useCallback(() => {
    if (!editorView || paragraphs.length === 0) {
      return;
    }

    const positions = new Map<number, { top: number; height: number }>();
    
    paragraphs.forEach((para) => {
      try {
        // Get line numbers (CodeMirror uses 1-based line numbers)
        const startLineNum = para.startLine + 1;
        const endLineNum = para.endLine + 1;
        
        // Check if lines exist in document
        if (startLineNum > editorView.state.doc.lines || endLineNum > editorView.state.doc.lines) {
          throw new Error('Line out of range');
        }
        
        // Get character positions for start and end lines
        const startLine = editorView.state.doc.line(startLineNum);
        const endLine = editorView.state.doc.line(endLineNum);
        
        // Get line blocks (visual positions)
        // lineBlockAt returns positions relative to the content DOM
        const startLineBlock = editorView.lineBlockAt(startLine.from);
        const endLineEndPos = endLine.to;
        const endLineBlock = editorView.lineBlockAt(endLineEndPos);
        
        // Check if there's a toolbar widget above this paragraph
        // Toolbar widgets are inserted before the paragraph (side: -1)
        // We need to find the actual text line position, excluding the toolbar
        let actualStartTop = startLineBlock.top;
        
        try {
          // Get the DOM element for the start line
          const domAtStart = editorView.domAtPos(startLine.from);
          if (domAtStart.node) {
            // Find the .cm-line element that contains the actual text
            const lineElement = domAtStart.node.nodeType === Node.TEXT_NODE
              ? domAtStart.node.parentElement?.closest('.cm-line')
              : (domAtStart.node as Element).closest('.cm-line');
            
            if (lineElement) {
              // Check if there's a toolbar widget before this line
              let currentElement: Element | null = lineElement.previousElementSibling;
              while (currentElement) {
                if (currentElement.classList.contains('paragraph-toolbar-widget')) {
                  // Found toolbar - get its height and adjust
                  const toolbarRect = currentElement.getBoundingClientRect();
                  const contentRect = editorView.contentDOM.getBoundingClientRect();
                  const toolbarHeight = toolbarRect.height;
                  // The toolbar is above the line, so the line's top includes the toolbar
                  // We need to add the toolbar height to skip it
                  actualStartTop = startLineBlock.top + toolbarHeight;
                  break;
                }
                currentElement = currentElement.previousElementSibling;
              }
            }
          }
        } catch (error) {
          // If DOM inspection fails, use the original position
          actualStartTop = startLineBlock.top;
        }
        
        // Calculate positions
        // lineBlockAt.top is relative to contentDOM
        // We'll adjust this in the render phase based on actual DOM positions
        const top = actualStartTop;
        // Height should span from start of first line to end of last line (text only, no toolbar)
        const height = endLineBlock.bottom - actualStartTop;
        
        // Store position for this paragraph's start line
        positions.set(para.startLine, { top, height });
      } catch (error) {
        // Fallback to line number calculation if CodeMirror API fails
        const lineHeight = 24; // Approximate line height in pixels
        positions.set(para.startLine, {
          top: para.startLine * lineHeight,
          height: Math.max(4, (para.endLine - para.startLine + 1) * lineHeight),
        });
      }
    });

    setLinePositions(positions);
  }, [editorView, paragraphs]);

  // Update line positions from CodeMirror when content or view changes
  useEffect(() => {
    if (!editorView || paragraphs.length === 0) {
      return;
    }

    // Wait for content to fully update before calculating positions
    // Use a longer delay to ensure CodeMirror has finished all updates
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }

    updateTimerRef.current = setTimeout(() => {
      // Use requestAnimationFrame to ensure rendering is complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updateLinePositions();
        });
      });
    }, 200); // Wait 200ms for content to settle

    // Also update on scroll
    const scrollElement = editorView.scrollDOM;
    const handleScroll = () => {
      updateLinePositions();
    };
    
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    // Update positions when window resizes (affects line wrapping)
    const handleResize = () => {
      requestAnimationFrame(() => {
        updateLinePositions();
      });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      scrollElement.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [editorView, paragraphs, content, updateLinePositions]);

  // Get indicator state for a paragraph
  const getIndicatorState = useCallback((paragraph: ParagraphMetadata): IndicatorState => {
    if (!paragraph.analysis) {
      return 'pending';
    }

    const { quality, suggestions } = paragraph.analysis;

    // Check for errors
    const hasError = suggestions?.some((s) => s.type === 'error');
    if (hasError || quality < 60) {
      return 'error';
    }

    // Check for warnings
    const hasWarning = suggestions?.some((s) => s.type === 'warning');
    if (hasWarning || quality < 80) {
      return 'warning';
    }

    // Check for suggestions
    const hasSuggestion = suggestions?.some((s) => s.type === 'suggestion');
    if (hasSuggestion) {
      return 'suggestion';
    }

    // Good quality
    if (quality >= 80) {
      return 'good';
    }

    return 'pending';
  }, []);

  // Get indicator color
  const getIndicatorColor = useCallback((state: IndicatorState): string => {
    switch (state) {
      case 'error':
        return '#f48771'; // Red
      case 'warning':
        return '#dcdcaa'; // Yellow
      case 'suggestion':
        return '#569cd6'; // Blue
      case 'good':
        return '#4ec9b0'; // Green
      case 'pending':
      default:
        return '#858585'; // Gray
    }
  }, []);

  const handleParagraphHover = useCallback(
    (paragraphId: string | null) => {
      setHoveredParagraph(paragraphId);
      if (onParagraphHover) {
        onParagraphHover(paragraphId);
      }
    },
    [onParagraphHover]
  );

  const handleIndicatorClick = useCallback(
    (paragraphId: string, state: IndicatorState) => {
      if (onIndicatorClick) {
        onIndicatorClick(paragraphId, state);
      }
    },
    [onIndicatorClick]
  );

  // Get the indicators container element to calculate relative positions
  const indicatorsContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={indicatorsContainerRef} className="ai-indicators-column relative h-full w-full pointer-events-none">
      {paragraphs.map((paragraph) => {
        const state = getIndicatorState(paragraph);
        const color = getIndicatorColor(state);
        const isActive = activeParagraphId === paragraph.id;

        // Get actual position from CodeMirror or fallback to line-based calculation
        const position = linePositions.get(paragraph.startLine);
        const lineHeight = 24; // Fallback line height in pixels
        
        // Calculate the correct top offset
        let topOffset = position?.top ?? paragraph.startLine * lineHeight;
        
        // Adjust position based on actual DOM layout
        // lineBlockAt returns positions relative to contentDOM, but we need positions relative to our container
        if (indicatorsContainerRef.current && editorView && position) {
          const containerRect = indicatorsContainerRef.current.getBoundingClientRect();
          const scrollRect = editorView.scrollDOM.getBoundingClientRect();
          const contentRect = editorView.contentDOM.getBoundingClientRect();
          
          // Calculate offsets:
          // 1. Content offset within scroll container
          const contentOffsetInScroll = contentRect.top - scrollRect.top;
          // 2. Scroll container offset relative to our indicators container
          const scrollOffsetInContainer = scrollRect.top - containerRect.top;
          // 3. Total offset: content position + content offset + scroll offset
          topOffset = position.top + contentOffsetInScroll + scrollOffsetInContainer;
        }
        
        const indicatorHeight = position?.height ?? Math.max(4, (paragraph.endLine - paragraph.startLine + 1) * lineHeight);

        // Hide other indicators when toolbar is visible or when one is hovered
        // Show all when nothing is active, only show active one when toolbar is visible or hovering
        const shouldShow = activeParagraphId === null || isActive;
        const opacity = isActive ? 1 : (shouldShow ? 0.6 : 0);

        return (
          <div
            key={paragraph.id}
            data-paragraph-id={paragraph.id}
            className="ai-indicator absolute left-0 w-1 transition-all duration-300 pointer-events-auto cursor-pointer hover:w-2 z-10"
            style={{
              top: `${topOffset}px`,
              height: `${indicatorHeight}px`,
              backgroundColor: color,
              opacity: opacity,
            }}
            onMouseEnter={() => {
              handleParagraphHover(paragraph.id);
            }}
            onMouseLeave={() => {
              // Call with null to trigger hide logic (with delay)
              handleParagraphHover(null);
            }}
            onClick={() => handleIndicatorClick(paragraph.id, state)}
          />
        );
      })}
    </div>
  );
}

