/**
 * Tests for ThinkModePanel component
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThinkModePanel } from '../think-mode-panel';

describe('ThinkModePanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    paragraphId: 'para-0',
    content: 'Test content',
    documentId: 'test-doc-id',
    onContentGenerated: vi.fn(),
  };

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <ThinkModePanel {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    render(<ThinkModePanel {...defaultProps} />);
    
    expect(screen.getByText("Let's think about")).toBeInTheDocument();
    expect(screen.getByText('Brainstorm')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ThinkModePanel {...defaultProps} onClose={onClose} />);
    
    const closeButton = screen.getByTitle('Close Think Mode Panel');
    closeButton.click();
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should display tab navigation', () => {
    render(<ThinkModePanel {...defaultProps} />);
    
    const brainstormTab = screen.getByText('Brainstorm');
    const researchTab = screen.getByText('Research');
    const draftTab = screen.getByText('Draft');
    
    expect(brainstormTab).toBeInTheDocument();
    expect(researchTab).toBeInTheDocument();
    expect(draftTab).toBeInTheDocument();
  });

  it('should display brainstorm content', () => {
    render(<ThinkModePanel {...defaultProps} />);
    
    expect(screen.getByText(/Start brainstorming by asking questions or sharing ideas about this block/)).toBeInTheDocument();
  });
});

