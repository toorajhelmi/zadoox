/**
 * Unit tests for EditorSidebar component (Phase 7)
 * Focus: Core functionality only
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

    expect(screen.getByLabelText('Open sidebar')).toBeInTheDocument();
  });

  it('should render expanded sidebar when isOpen is true', () => {
    render(<EditorSidebar isOpen={true} onToggle={mockOnToggle} content="" />);

    expect(screen.getByText('Outline')).toBeInTheDocument();
  });

  it('should call onToggle when collapsed button is clicked', () => {
    render(<EditorSidebar isOpen={false} onToggle={mockOnToggle} content="" />);

    const toggleButton = screen.getByLabelText('Open sidebar');
    fireEvent.click(toggleButton);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });
});
