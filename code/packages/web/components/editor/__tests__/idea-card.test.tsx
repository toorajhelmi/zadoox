/**
 * Tests for IdeaCard component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IdeaCard } from '../idea-card';
import type { IdeaCard as IdeaCardType } from '@zadoox/shared';

describe('IdeaCard', () => {
  const mockIdea: IdeaCardType = {
    id: 'idea-1',
    topic: 'Test Idea Topic',
    description: 'This is a test idea description that explains what the idea is about.',
    createdAt: new Date().toISOString(),
  };

  const defaultProps = {
    idea: mockIdea,
    onDelete: vi.fn(),
    onUse: vi.fn(),
  };

  it('should render idea topic', () => {
    render(<IdeaCard {...defaultProps} />);
    
    expect(screen.getByText('Test Idea Topic')).toBeInTheDocument();
  });

  it('should not show description initially', () => {
    render(<IdeaCard {...defaultProps} />);
    
    expect(screen.queryByText('This is a test idea description')).not.toBeInTheDocument();
  });

  it('should expand and show description when clicked', () => {
    render(<IdeaCard {...defaultProps} />);
    
    const expandButton = screen.getByText('Test Idea Topic').closest('button');
    expect(expandButton).toBeInTheDocument();
    
    fireEvent.click(expandButton!);
    
    expect(screen.getByText('This is a test idea description that explains what the idea is about.')).toBeInTheDocument();
  });

  it('should collapse description when clicked again', () => {
    render(<IdeaCard {...defaultProps} />);
    
    const expandButton = screen.getByText('Test Idea Topic').closest('button');
    fireEvent.click(expandButton!);
    fireEvent.click(expandButton!);
    
    expect(screen.queryByText('This is a test idea description')).not.toBeInTheDocument();
  });

  it('should call onUse when Use button is clicked', () => {
    const onUse = vi.fn();
    render(<IdeaCard {...defaultProps} onUse={onUse} />);
    
    const useButton = screen.getByText('Use');
    fireEvent.click(useButton);
    
    expect(onUse).toHaveBeenCalledWith(mockIdea);
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it('should call onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<IdeaCard {...defaultProps} onDelete={onDelete} />);
    
    const deleteButton = screen.getByTitle('Delete this idea');
    fireEvent.click(deleteButton);
    
    expect(onDelete).toHaveBeenCalledWith('idea-1');
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('should show expand icon when collapsed', () => {
    render(<IdeaCard {...defaultProps} />);
    
    expect(screen.getByText('▶')).toBeInTheDocument();
  });

  it('should show collapse icon when expanded', () => {
    render(<IdeaCard {...defaultProps} />);
    
    const expandButton = screen.getByText('Test Idea Topic').closest('button');
    fireEvent.click(expandButton!);
    
    expect(screen.getByText('▼')).toBeInTheDocument();
  });
});

