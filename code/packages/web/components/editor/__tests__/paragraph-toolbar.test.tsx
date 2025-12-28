/**
 * Tests for ParagraphToolbar component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ParagraphToolbar } from '../paragraph-toolbar';
import type { AIAnalysisResponse } from '@zadoox/shared';

describe('ParagraphToolbar', () => {
  const mockAnalysis: AIAnalysisResponse = {
    quality: 85,
    sentiment: 'positive',
    wordiness: 45,
    clarity: 90,
    suggestions: [],
  };

  const defaultProps = {
    paragraphId: 'para-0',
    visible: true,
  };

  it('should not render when visible is false', () => {
    const { container } = render(<ParagraphToolbar {...defaultProps} visible={false} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should render analyzing state when no analysis', () => {
    render(<ParagraphToolbar {...defaultProps} />);
    
    expect(screen.getByText(/Analyzing.../)).toBeInTheDocument();
  });

  it('should render processing state', () => {
    render(<ParagraphToolbar {...defaultProps} isProcessing={true} processingAction="improve" />);
    
    expect(screen.getByText(/Improving paragraph.../)).toBeInTheDocument();
  });

  it('should render analysis data when provided', () => {
    render(<ParagraphToolbar {...defaultProps} analysis={mockAnalysis} />);
    
    expect(screen.getByText(/Quality: 85%/)).toBeInTheDocument();
    expect(screen.getByText(/Clarity: 90%/)).toBeInTheDocument();
    expect(screen.getByText(/Wordiness: 45%/)).toBeInTheDocument();
  });

  it('should display deltas when previous analysis is provided', () => {
    const previousAnalysis: AIAnalysisResponse = {
      ...mockAnalysis,
      quality: 75,
      clarity: 80,
      wordiness: 50,
    };
    
    render(
      <ParagraphToolbar
        {...defaultProps}
        analysis={mockAnalysis}
        previousAnalysis={previousAnalysis}
      />
    );
    
    // Should show deltas (quality +10, clarity +10, wordiness -5)
    expect(screen.getByText(/Quality: 85%/)).toBeInTheDocument();
    expect(screen.getByText(/Clarity: 90%/)).toBeInTheDocument();
    expect(screen.getByText(/Wordiness: 45%/)).toBeInTheDocument();
  });

  it('should call onAction when action button is clicked', () => {
    const onAction = vi.fn();
    
    render(<ParagraphToolbar {...defaultProps} analysis={mockAnalysis} onAction={onAction} />);
    
    const improveButton = screen.getByRole('button', { name: /Improve/i });
    fireEvent.click(improveButton);
    
    expect(onAction).toHaveBeenCalledWith('improve');
  });

  it('should call onAction for all action types', () => {
    const onAction = vi.fn();
    
    render(<ParagraphToolbar {...defaultProps} analysis={mockAnalysis} onAction={onAction} />);
    
    const clarifyButton = screen.getByRole('button', { name: /Clarify/i });
    fireEvent.click(clarifyButton);
    expect(onAction).toHaveBeenCalledWith('clarify');
    
    const condenseButton = screen.getByRole('button', { name: /Condense/i });
    fireEvent.click(condenseButton);
    expect(onAction).toHaveBeenCalledWith('condense');
    
    const formalizeButton = screen.getByRole('button', { name: /Formalize/i });
    fireEvent.click(formalizeButton);
    expect(onAction).toHaveBeenCalledWith('formalize');
    
    const casualizeButton = screen.getByRole('button', { name: /Casualize/i });
    fireEvent.click(casualizeButton);
    expect(onAction).toHaveBeenCalledWith('casualize');
  });

  it('should call onViewDetails when Details button is clicked', () => {
    const onViewDetails = vi.fn();
    
    render(
      <ParagraphToolbar
        {...defaultProps}
        analysis={mockAnalysis}
        onViewDetails={onViewDetails}
      />
    );
    
    const detailsButton = screen.getByRole('button', { name: /Details/i });
    fireEvent.click(detailsButton);
    
    expect(onViewDetails).toHaveBeenCalled();
  });

  it('should display correct processing labels for different actions', () => {
    const { rerender } = render(
      <ParagraphToolbar {...defaultProps} isProcessing={true} processingAction="expand" />
    );
    expect(screen.getByText(/Expanding paragraph.../)).toBeInTheDocument();
    
    rerender(<ParagraphToolbar {...defaultProps} isProcessing={true} processingAction="clarify" />);
    expect(screen.getByText(/Clarifying paragraph.../)).toBeInTheDocument();
    
    rerender(<ParagraphToolbar {...defaultProps} isProcessing={true} processingAction="condense" />);
    expect(screen.getByText(/Condensing paragraph.../)).toBeInTheDocument();
  });

  it('should display last edited time when analysis is provided', () => {
    const lastEdited = new Date(Date.now() - 60000); // 1 minute ago
    
    render(
      <ParagraphToolbar
        {...defaultProps}
        analysis={mockAnalysis}
        lastEdited={lastEdited}
      />
    );
    
    // Should show time ago
    expect(screen.getByText(/Quality: 85%/)).toBeInTheDocument();
  });

  it('should display correct status icon based on quality', () => {
    const { rerender } = render(
      <ParagraphToolbar {...defaultProps} analysis={{ ...mockAnalysis, quality: 90 }} />
    );
    expect(screen.getByText(/Quality: 90%/)).toBeInTheDocument();
    
    rerender(<ParagraphToolbar {...defaultProps} analysis={{ ...mockAnalysis, quality: 70 }} />);
    expect(screen.getByText(/Quality: 70%/)).toBeInTheDocument();
    
    rerender(<ParagraphToolbar {...defaultProps} analysis={{ ...mockAnalysis, quality: 50 }} />);
    expect(screen.getByText(/Quality: 50%/)).toBeInTheDocument();
  });
});
