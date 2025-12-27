/**
 * Tests for ParagraphModeToggles component
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParagraphModeToggles } from '../paragraph-mode-toggles';

// Mock EditorView - simplified for testing
const createMockEditorView = () => {
  const scrollDOM = document.createElement('div');
  return {
    scrollDOM,
    lineBlockAt: vi.fn(() => ({
      top: 0,
      height: 24,
      bottom: 24,
    })),
    state: {
      doc: {
        length: 20,
        toString: () => 'Test content\n\nAnother paragraph',
      },
    },
  } as any;
};

describe('ParagraphModeToggles', () => {
  let mockEditorView: ReturnType<typeof createMockEditorView>;
  let onOpenPanel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEditorView = createMockEditorView();
    onOpenPanel = vi.fn();
  });

  it('should render T buttons for paragraphs', async () => {
    const content = 'First paragraph\n\nSecond paragraph';
    render(
      <ParagraphModeToggles
        content={content}
        editorView={mockEditorView}
        openParagraphId={null}
        onOpenPanel={onOpenPanel}
      />
    );

    // Wait for paragraphs to be parsed and buttons to render
    await waitFor(() => {
      const buttons = screen.queryAllByText('T');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('should highlight T button when paragraph panel is open', async () => {
    const content = 'First paragraph\n\nSecond paragraph';
    const { container } = render(
      <ParagraphModeToggles
        content={content}
        editorView={mockEditorView}
        openParagraphId="para-0"
        onOpenPanel={onOpenPanel}
      />
    );

    // Wait for buttons to render
    await waitFor(() => {
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    // Find button with purple background (when open)
    const buttons = container.querySelectorAll('button');
    const openButton = Array.from(buttons).find(btn => 
      btn.classList.contains('bg-purple-600')
    );
    
    expect(openButton).toBeDefined();
  });

  it('should call onOpenPanel when T button is clicked', async () => {
    const content = 'First paragraph\n\nSecond paragraph';
    render(
      <ParagraphModeToggles
        content={content}
        editorView={mockEditorView}
        openParagraphId={null}
        onOpenPanel={onOpenPanel}
      />
    );

    await waitFor(() => {
      const buttons = screen.queryAllByText('T');
      expect(buttons.length).toBeGreaterThan(0);
    });

    const buttons = screen.getAllByText('T');
    if (buttons.length > 0) {
      buttons[0].click();
      expect(onOpenPanel).toHaveBeenCalled();
    }
  });

  it('should show tooltip "Think" on T buttons', async () => {
    const content = 'First paragraph';
    render(
      <ParagraphModeToggles
        content={content}
        editorView={mockEditorView}
        openParagraphId={null}
        onOpenPanel={onOpenPanel}
      />
    );

    await waitFor(() => {
      const buttons = screen.queryAllByTitle('Think');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('should handle null editorView gracefully', () => {
    const content = 'First paragraph';
    const { container } = render(
      <ParagraphModeToggles
        content={content}
        editorView={null}
        openParagraphId={null}
        onOpenPanel={onOpenPanel}
      />
    );

    // Should not crash, may render empty or with fallback
    expect(container).toBeInTheDocument();
  });
});

