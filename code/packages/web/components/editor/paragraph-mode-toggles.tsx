'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { EditorView } from '@codemirror/view';

export interface ParagraphMetadata {
  id: string;
  startLine: number;
  endLine: number;
  text: string;
}

interface ParagraphModeTogglesProps {
  content: string;
  editorView?: EditorView | null;
  openParagraphId?: string | null; // Which paragraph's panel is currently open
  onOpenPanel: (paragraphId: string) => void; // Callback to open panel for a paragraph
}

/**
 * Paragraph Mode Toggles
 * Always visible vertical toggles on the right side of each paragraph
 */
export function ParagraphModeToggles({
  content,
  editorView,
  openParagraphId,
  onOpenPanel,
}: ParagraphModeTogglesProps) {
  const [paragraphs, setParagraphs] = useState<ParagraphMetadata[]>([]);
  const [linePositions, setLinePositions] = useState<Map<number, { top: number; height: number }>>(new Map());
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const togglesContainerRef = useRef<HTMLDivElement>(null);

  // Helper function to check if a line is a markdown heading
  const isHeading = (line: string): boolean => {
    const trimmed = line.trim();
    return /^#{1,6}\s/.test(trimmed);
  };

  // Parse paragraphs from content
  // Sections (headings) and all content below until next heading are treated as one paragraph
  useEffect(() => {
    const lines = content.split('\n');
    const parsed: ParagraphMetadata[] = [];
    let currentParagraph: { startLine: number; endLine: number; text: string } | null = null;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineIsHeading = isHeading(trimmed);
      
      if (lineIsHeading) {
        // If we encounter a heading, save current paragraph (if any) and start a new section
        if (currentParagraph) {
          parsed.push({
            id: `para-${currentParagraph.startLine}`,
            startLine: currentParagraph.startLine,
            endLine: currentParagraph.endLine,
            text: currentParagraph.text.trim(),
          });
        }
        // Start new section with this heading
        currentParagraph = { startLine: index, endLine: index, text: trimmed };
      } else if (trimmed) {
        // Non-heading content - add to current paragraph (or start one if none exists)
        if (!currentParagraph) {
          currentParagraph = { startLine: index, endLine: index, text: trimmed };
        } else {
          currentParagraph.text += ' ' + trimmed;
          currentParagraph.endLine = index;
        }
      } else if (!trimmed && currentParagraph) {
        // Blank line - only end paragraph if it's not a section (sections continue through blank lines)
        // Check if current paragraph starts with a heading by checking the first line
        const firstLine = lines[currentParagraph.startLine]?.trim() || '';
        const currentIsHeading = isHeading(firstLine);
        if (!currentIsHeading) {
          // Regular paragraph ends at blank line
          parsed.push({
            id: `para-${currentParagraph.startLine}`,
            startLine: currentParagraph.startLine,
            endLine: currentParagraph.endLine,
            text: currentParagraph.text.trim(),
          });
          currentParagraph = null;
        }
        // If it's a section, blank lines are part of the section content
      }
    });

    if (currentParagraph !== null) {
      parsed.push({
        id: `para-${currentParagraph.startLine}`,
        startLine: currentParagraph.startLine,
        endLine: currentParagraph.endLine,
        text: currentParagraph.text.trim(),
      });
    }

    setParagraphs(parsed);
  }, [content]);

  // Update line positions using CodeMirror's coordinate system
  const updateLinePositions = useCallback(() => {
    if (!editorView || paragraphs.length === 0) {
      return;
    }

    const positions = new Map<number, { top: number; height: number }>();
    
    paragraphs.forEach((para) => {
      try {
        const startLineNum = para.startLine + 1;
        const endLineNum = para.endLine + 1;
        
        if (startLineNum > editorView.state.doc.lines || endLineNum > editorView.state.doc.lines) {
          throw new Error('Line out of range');
        }
        
        const startLine = editorView.state.doc.line(startLineNum);
        const endLine = editorView.state.doc.line(endLineNum);
        
        const startLineBlock = editorView.lineBlockAt(startLine.from);
        const endLineEndPos = endLine.to;
        const endLineBlock = editorView.lineBlockAt(endLineEndPos);
        
        let top = startLineBlock.top;
        let height = endLineBlock.bottom - startLineBlock.top;

        // Check if there's a toolbar widget directly above this paragraph
        const lineDOM = editorView.domAtPos(startLine.from).node as HTMLElement;
        const toolbarWidget = lineDOM.previousElementSibling as HTMLElement;
        if (toolbarWidget && toolbarWidget.classList.contains('paragraph-toolbar-widget')) {
          const toolbarHeight = toolbarWidget.offsetHeight;
          const toolbarMarginTop = parseInt(window.getComputedStyle(toolbarWidget).marginTop || '0', 10);
          const toolbarMarginBottom = parseInt(window.getComputedStyle(toolbarWidget).marginBottom || '0', 10);
          
          top += toolbarHeight + toolbarMarginTop + toolbarMarginBottom;
          height -= (toolbarHeight + toolbarMarginTop + toolbarMarginBottom);
        }
        
        positions.set(para.startLine, { top, height });
      } catch (error) {
        const lineHeight = 24; 
        positions.set(para.startLine, {
          top: para.startLine * lineHeight,
          height: Math.max(4, (para.endLine - para.startLine + 1) * lineHeight),
        });
      }
    });

    setLinePositions(positions);
  }, [editorView, paragraphs]);

  useEffect(() => {
    if (!editorView || paragraphs.length === 0) {
      return;
    }

    // Use requestAnimationFrame to ensure CodeMirror has finished rendering
    requestAnimationFrame(() => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      updateTimerRef.current = setTimeout(() => {
        updateLinePositions();
      }, 200);
    });

    const scrollElement = editorView.scrollDOM;
    const handleScroll = () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      updateTimerRef.current = setTimeout(() => {
        updateLinePositions();
      }, 50);
    };
    
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    const handleResize = () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      updateTimerRef.current = setTimeout(() => {
        updateLinePositions();
      }, 100);
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

  return (
    <div ref={togglesContainerRef} className="paragraph-mode-toggles absolute right-0 top-0 h-full w-6 pointer-events-none z-20">
      {paragraphs.map((paragraph) => {
        const position = linePositions.get(paragraph.startLine);
        const lineHeight = 24;
        
        const paragraphTop = position?.top ?? paragraph.startLine * lineHeight;
        
        // Position toggle at the top of the paragraph
        const toggleHeight = 24; // Fixed height for the toggle button
        const topOffset = paragraphTop;

        return (
          <div
            key={paragraph.id}
            data-paragraph-id={paragraph.id}
            className="absolute right-0 pointer-events-auto"
            style={{
              top: `${topOffset}px`,
              height: `${toggleHeight}px`,
            }}
          >
            <button
              onClick={() => {
                onOpenPanel(paragraph.id);
              }}
              className={`w-6 h-full border-l border-vscode-border flex items-center justify-center hover:opacity-90 transition-all duration-200 font-bold text-sm ${
                openParagraphId === paragraph.id
                  ? 'bg-purple-600 text-white' // Purple when panel is open for this paragraph
                  : 'bg-vscode-sidebar/50 text-vscode-text-secondary hover:bg-vscode-buttonBg' // No background when panel is closed
              }`}
              title="Think"
            >
              T
            </button>
          </div>
        );
      })}
    </div>
  );
}

