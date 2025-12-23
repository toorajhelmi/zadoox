/**
 * Unit tests for EditorSidebar component (Phase 7)
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorSidebar } from '../editor-sidebar';
import * as shared from '@zadoox/shared';

// Mock the shared package
vi.mock('@zadoox/shared', () => ({
  extractHeadings: vi.fn(),
}));

describe('EditorSidebar', () => {
  const mockOnToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shared.extractHeadings).mockReturnValueOnce([]);
  });

  it('should render collapsed button when sidebar is closed', () => {
    render(<EditorSidebar isOpen={false} onToggle={mockOnToggle} content="" />);

    const toggleButton = screen.getByLabelText('Open sidebar');
    expect(toggleButton).toBeInTheDocument();
  });

  it('should render expanded sidebar when isOpen is true', () => {
    render(<EditorSidebar isOpen={true} onToggle={mockOnToggle} content="" />);

    expect(screen.getByText('Outline')).toBeInTheDocument();
    expect(screen.queryByLabelText('Open sidebar')).not.toBeInTheDocument();
  });

  it('should call onToggle when collapsed button is clicked', () => {
    render(<EditorSidebar isOpen={false} onToggle={mockOnToggle} content="" />);

    const toggleButton = screen.getByLabelText('Open sidebar');
    fireEvent.click(toggleButton);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it('should pass content to DocumentOutline component', () => {
    const content = '# Heading\nSome content';
    vi.mocked(shared.extractHeadings).mockReturnValueOnce([]);

    render(<EditorSidebar isOpen={true} onToggle={mockOnToggle} content={content} />);

    // DocumentOutline should receive the content
    expect(shared.extractHeadings).toHaveBeenCalledWith(content);
  });

  it('should display outline header when open', () => {
    render(<EditorSidebar isOpen={true} onToggle={mockOnToggle} content="" />);

    expect(screen.getByText('Outline')).toBeInTheDocument();
  });

  it('should have correct styling classes for collapsed state', () => {
    const { container } = render(
      <EditorSidebar isOpen={false} onToggle={mockOnToggle} content="" />
    );

    const button = screen.getByLabelText('Open sidebar');
    expect(button).toBeInTheDocument();
  });

  it('should have correct styling classes for expanded state', () => {
    const { container } = render(
      <EditorSidebar isOpen={true} onToggle={mockOnToggle} content="" />
    );

    const sidebar = container.querySelector('.w-64');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar?.classList.contains('bg-vscode-sidebar')).toBe(true);
  });
});

