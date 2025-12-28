/**
 * Tests for ParagraphInfoBanner component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ParagraphInfoBanner } from '../paragraph-info-banner';
import type { AIAnalysisResponse } from '@zadoox/shared';

describe('ParagraphInfoBanner', () => {
  const mockAnalysis: AIAnalysisResponse = {
    quality: 85,
    sentiment: 'positive',
    wordiness: 45,
    clarity: 90,
    suggestions: [],
  };

  const defaultProps = {
    paragraphId: 'para-0',
    position: { top: 100, left: 200 },
    visible: true,
  };

  it('should not render when visible is false', () => {
    const { container } = render(<ParagraphInfoBanner {...defaultProps} visible={false} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should render analyzing state when no analysis', () => {
    render(<ParagraphInfoBanner {...defaultProps} />);
    
    expect(screen.getByText(/Analyzing paragraph.../)).toBeInTheDocument();
  });

  it('should render analysis data when provided', () => {
    render(<ParagraphInfoBanner {...defaultProps} analysis={mockAnalysis} />);
    
    expect(screen.getByText(/Quality: 85/)).toBeInTheDocument();
    // Check for sentiment, wordiness, and clarity in the metrics section
    expect(screen.getByText(/positive/)).toBeInTheDocument();
    expect(screen.getByText(/45/)).toBeInTheDocument();
    expect(screen.getByText(/90/)).toBeInTheDocument();
  });

  it('should display correct status icon for high quality', () => {
    const highQualityAnalysis: AIAnalysisResponse = {
      ...mockAnalysis,
      quality: 90,
    };
    
    render(<ParagraphInfoBanner {...defaultProps} analysis={highQualityAnalysis} />);
    
    expect(screen.getByText(/Quality: 90%/)).toBeInTheDocument();
    // Green status (quality >= 80)
  });

  it('should display correct status icon for medium quality', () => {
    const mediumQualityAnalysis: AIAnalysisResponse = {
      ...mockAnalysis,
      quality: 70,
    };
    
    render(<ParagraphInfoBanner {...defaultProps} analysis={mediumQualityAnalysis} />);
    
    expect(screen.getByText(/Quality: 70%/)).toBeInTheDocument();
    // Yellow status (60 <= quality < 80)
  });

  it('should display correct status icon for low quality', () => {
    const lowQualityAnalysis: AIAnalysisResponse = {
      ...mockAnalysis,
      quality: 50,
    };
    
    render(<ParagraphInfoBanner {...defaultProps} analysis={lowQualityAnalysis} />);
    
    expect(screen.getByText(/Quality: 50%/)).toBeInTheDocument();
    // Red status (quality < 60)
  });

  it('should call onAction when action button is clicked', () => {
    const onAction = vi.fn();
    
    render(<ParagraphInfoBanner {...defaultProps} analysis={mockAnalysis} onAction={onAction} />);
    
    const improveButton = screen.getByRole('button', { name: /Improve/i });
    fireEvent.click(improveButton);
    
    expect(onAction).toHaveBeenCalledWith('improve');
  });

  it('should call onAction for all action types', () => {
    const onAction = vi.fn();
    
    render(<ParagraphInfoBanner {...defaultProps} analysis={mockAnalysis} onAction={onAction} />);
    
    const expandButton = screen.getByRole('button', { name: /Expand/i });
    fireEvent.click(expandButton);
    expect(onAction).toHaveBeenCalledWith('expand');
    
    const clarifyButton = screen.getByRole('button', { name: /Clarify/i });
    fireEvent.click(clarifyButton);
    expect(onAction).toHaveBeenCalledWith('clarify');
    
    const condenseButton = screen.getByRole('button', { name: /Condense/i });
    fireEvent.click(condenseButton);
    expect(onAction).toHaveBeenCalledWith('condense');
  });

  it('should call onViewDetails when Details button is clicked', () => {
    const onViewDetails = vi.fn();
    
    render(
      <ParagraphInfoBanner
        {...defaultProps}
        analysis={mockAnalysis}
        onViewDetails={onViewDetails}
      />
    );
    
    const detailsButton = screen.getByRole('button', { name: /Details/i });
    fireEvent.click(detailsButton);
    
    expect(onViewDetails).toHaveBeenCalled();
  });

  it('should not show Details button when onViewDetails is not provided', () => {
    render(<ParagraphInfoBanner {...defaultProps} analysis={mockAnalysis} />);
    
    expect(screen.queryByRole('button', { name: /Details/i })).not.toBeInTheDocument();
  });

  it('should display last edited time when analysis is provided', () => {
    const lastEdited = new Date(Date.now() - 60000); // 1 minute ago
    
    render(
      <ParagraphInfoBanner
        {...defaultProps}
        analysis={mockAnalysis}
        lastEdited={lastEdited}
      />
    );
    
    // Should show time ago (formatDistanceToNow will format it)
    expect(screen.getByText(/Quality: 85%/)).toBeInTheDocument();
  });

  it('should not display time when no analysis', () => {
    const lastEdited = new Date();
    
    render(<ParagraphInfoBanner {...defaultProps} lastEdited={lastEdited} />);
    
    // Should not show time when no analysis
    expect(screen.getByText(/Analyzing paragraph.../)).toBeInTheDocument();
  });
});
