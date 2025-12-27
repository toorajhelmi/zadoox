'use client';

import { formatDistanceToNow } from 'date-fns';
import { useMemo } from 'react';

interface EditorStatusBarProps {
  isSaving: boolean;
  lastSaved: Date | null;
  content?: string;
  cursorPosition?: { line: number; column: number } | null;
}

/**
 * Editor Status Bar
 * VS Code-style status bar at the bottom of the editor
 */
export function EditorStatusBar({
  isSaving,
  lastSaved,
  content = '',
  cursorPosition,
}: EditorStatusBarProps) {
  // Helper function to check if a line is a markdown heading
  const isHeading = (line: string): boolean => {
    const trimmed = line.trim();
    return /^#{1,6}\s/.test(trimmed);
  };

  // Parse paragraphs from content (same logic as useAIAnalysis)
  // Sections (headings) and all content below until next heading are treated as one paragraph
  // Only counts actual paragraphs with content, ignoring blank lines
  // Paragraphs are numbered sequentially: 1, 2, 3... regardless of line numbers
  const parseParagraphs = useMemo(() => {
    const lines = content.split('\n');
    const paragraphs: Array<{ startLine: number; endLine: number; text: string; paragraphNumber: number }> = [];
    let currentParagraph: { startLine: number; endLine: number; text: string } | null = null;
    let paragraphNumber = 0; // Sequential paragraph number (will be 1-based when displayed)

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineIsHeading = isHeading(trimmed);
      
      if (lineIsHeading) {
        // If we encounter a heading, save current paragraph (if any) and start a new section
        if (currentParagraph) {
          paragraphNumber++;
          paragraphs.push({
            startLine: currentParagraph.startLine,
            endLine: currentParagraph.endLine,
            text: currentParagraph.text.trim(),
            paragraphNumber: paragraphNumber,
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
          paragraphNumber++;
          paragraphs.push({
            startLine: currentParagraph.startLine,
            endLine: currentParagraph.endLine,
            text: currentParagraph.text.trim(),
            paragraphNumber: paragraphNumber,
          });
          currentParagraph = null;
        }
        // If it's a section, blank lines are part of the section content
      }
    });

    // Add final paragraph if exists
    if (currentParagraph !== null) {
      paragraphNumber++;
      paragraphs.push({
        startLine: currentParagraph.startLine,
        endLine: currentParagraph.endLine,
        text: currentParagraph.text.trim(),
        paragraphNumber: paragraphNumber,
      });
    }

    return paragraphs;
  }, [content]);

  // Find which paragraph the cursor is in
  // Uses stored paragraphNumber (sequential: 1, 2, 3...) not line numbers
  const currentParagraph = useMemo(() => {
    if (!cursorPosition || parseParagraphs.length === 0) return null;
    
    const cursorLine = cursorPosition.line - 1; // Convert to 0-based (CodeMirror uses 1-based)
    
    // Find the paragraph that contains this line
    for (const para of parseParagraphs) {
      // Check if cursor is within this paragraph's line range
      if (cursorLine >= para.startLine && cursorLine <= para.endLine) {
        // Return the stored sequential paragraph number (1, 2, 3...)
        return { number: para.paragraphNumber, total: parseParagraphs.length };
      }
    }
    
    // If cursor is on a blank line between paragraphs, find the nearest paragraph
    // Find the last paragraph that ends before this line
    for (let i = parseParagraphs.length - 1; i >= 0; i--) {
      const para = parseParagraphs[i];
      if (cursorLine > para.endLine) {
        // Cursor is after this paragraph - show this paragraph's number
        // (we're in the blank space after it)
        return { number: para.paragraphNumber, total: parseParagraphs.length };
      }
    }
    
    // If cursor is before all paragraphs (on leading blank lines), show first paragraph
    if (parseParagraphs.length > 0) {
      return { number: parseParagraphs[0].paragraphNumber, total: parseParagraphs.length };
    }
    
    return null;
  }, [cursorPosition, parseParagraphs]);

  // Calculate document stats from content
  const stats = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).filter(w => w.length > 0) : [];
    const wordCount = words.length;
    const characterCount = content.length;
    const paragraphCount = parseParagraphs.length;

    return { paragraphCount, wordCount, characterCount };
  }, [content, parseParagraphs]);

  return (
    <div className="h-6 bg-vscode-statusBar-background border-t border-vscode-statusBar-border flex items-center justify-between px-2 text-xs text-vscode-statusBar-foreground">
      {/* Left side - Status and info */}
      <div className="flex items-center gap-4">
        {/* Save status */}
        {isSaving && (
          <span className="text-vscode-statusBar-foreground">
            Saving...
          </span>
        )}
        {!isSaving && lastSaved && (
          <span className="text-vscode-statusBar-foreground">
            Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
          </span>
        )}
        {!isSaving && !lastSaved && (
          <span className="text-vscode-statusBar-foreground">
            Not saved
          </span>
        )}
      </div>

      {/* Right side - Cursor position and Document stats */}
      <div className="flex items-center gap-4">
        {/* Current paragraph (like VS Code: Para 3, Col 349) */}
        {currentParagraph && (
          <span className="text-vscode-statusBar-foreground">
            Para {currentParagraph.number}, Col {cursorPosition?.column || 0}
          </span>
        )}
        <span className="text-vscode-statusBar-foreground">
          {stats.paragraphCount} {stats.paragraphCount === 1 ? 'paragraph' : 'paragraphs'}
        </span>
        <span className="text-vscode-statusBar-foreground">
          {stats.wordCount} {stats.wordCount === 1 ? 'word' : 'words'}
        </span>
      </div>
    </div>
  );
}

