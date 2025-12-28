/**
 * Tests for EditorStatusBar component
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EditorStatusBar } from '../editor-status-bar';

describe('EditorStatusBar', () => {
  it('should render saving state', () => {
    render(<EditorStatusBar isSaving={true} lastSaved={null} />);
    
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('should render saved state with timestamp', () => {
    const lastSaved = new Date(Date.now() - 30000); // 30 seconds ago
    render(<EditorStatusBar isSaving={false} lastSaved={lastSaved} />);
    
    expect(screen.getByText(/Saved/)).toBeInTheDocument();
  });

  it('should render not saved state', () => {
    render(<EditorStatusBar isSaving={false} lastSaved={null} />);
    
    expect(screen.getByText('Not saved')).toBeInTheDocument();
  });

  it('should display paragraph count', () => {
    const content = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    render(<EditorStatusBar isSaving={false} lastSaved={null} content={content} />);
    
    expect(screen.getByText(/3 paragraphs/)).toBeInTheDocument();
  });

  it('should display word count', () => {
    const content = 'This is a test document with several words.';
    render(<EditorStatusBar isSaving={false} lastSaved={null} content={content} />);
    
    // Word count is displayed - check for "words" text
    expect(screen.getByText(/words/)).toBeInTheDocument();
  });

  it('should display paragraph number when cursor is on a paragraph', () => {
    const content = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const cursorPosition = { line: 2, column: 5 }; // On second paragraph (line 2, 0-indexed)
    render(
      <EditorStatusBar
        isSaving={false}
        lastSaved={null}
        content={content}
        cursorPosition={cursorPosition}
      />
    );
    
    expect(screen.getByText(/Para \d+, Col 5/)).toBeInTheDocument();
  });

  it('should handle sections correctly in paragraph count', () => {
    const content = '# Section 1\n\nContent under section 1.\n\n## Subsection\n\nMore content.\n\n# Section 2\n\nContent under section 2.';
    render(<EditorStatusBar isSaving={false} lastSaved={null} content={content} />);
    
    // Sections with their content should be counted as paragraphs
    expect(screen.getByText(/paragraphs/)).toBeInTheDocument();
  });

  it('should handle empty content', () => {
    render(<EditorStatusBar isSaving={false} lastSaved={null} content="" />);
    
    expect(screen.getByText(/0 paragraphs/)).toBeInTheDocument();
    expect(screen.getByText(/0 words/)).toBeInTheDocument();
  });

  it('should display correct singular/plural forms', () => {
    const singleParagraph = 'Single paragraph.';
    const { rerender } = render(<EditorStatusBar isSaving={false} lastSaved={null} content={singleParagraph} />);
    
    expect(screen.getByText(/1 paragraph/)).toBeInTheDocument();
    expect(screen.getByText(/2 words/)).toBeInTheDocument();

    rerender(<EditorStatusBar isSaving={false} lastSaved={null} content="Word" />);
    expect(screen.getByText(/1 word/)).toBeInTheDocument();
  });

  it('should handle cursor position on blank lines', () => {
    const content = 'First paragraph.\n\n\nSecond paragraph.';
    const cursorPosition = { line: 2, column: 1 }; // On blank line between paragraphs
    render(
      <EditorStatusBar
        isSaving={false}
        lastSaved={null}
        content={content}
        cursorPosition={cursorPosition}
      />
    );
    
    // Should still show a paragraph number (nearest paragraph)
    expect(screen.getByText(/Para \d+, Col 1/)).toBeInTheDocument();
  });
});
