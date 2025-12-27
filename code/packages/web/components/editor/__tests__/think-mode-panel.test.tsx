/**
 * Tests for ThinkModePanel component
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThinkModePanel } from '../think-mode-panel';

describe('ThinkModePanel', () => {
  it('should not render when isOpen is false', () => {
    const { container } = render(
      <ThinkModePanel isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    render(<ThinkModePanel isOpen={true} onClose={vi.fn()} />);
    
    expect(screen.getByText('Think Mode')).toBeInTheDocument();
    expect(screen.getByText('Brainstorm')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('Fragments')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ThinkModePanel isOpen={true} onClose={onClose} />);
    
    const closeButton = screen.getByTitle('Close Think Mode Panel');
    closeButton.click();
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should display tab navigation', () => {
    render(<ThinkModePanel isOpen={true} onClose={vi.fn()} />);
    
    const brainstormTab = screen.getByText('Brainstorm');
    const researchTab = screen.getByText('Research');
    const fragmentsTab = screen.getByText('Fragments');
    
    expect(brainstormTab).toBeInTheDocument();
    expect(researchTab).toBeInTheDocument();
    expect(fragmentsTab).toBeInTheDocument();
  });

  it('should display brainstorm content', () => {
    render(<ThinkModePanel isOpen={true} onClose={vi.fn()} />);
    
    expect(screen.getByText(/Use this space to brainstorm ideas/)).toBeInTheDocument();
    expect(screen.getByText('Brainstorming tools coming soon...')).toBeInTheDocument();
  });
});

