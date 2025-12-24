/**
 * Unit tests for FormattingToolbar component (Phase 7)
 * Focus: Core functionality only
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormattingToolbar } from '../formatting-toolbar';

describe('FormattingToolbar', () => {
  const mockOnFormat = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render format buttons in edit mode', () => {
    render(<FormattingToolbar onFormat={mockOnFormat} viewMode="edit" />);

    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
  });

  it('should not render in preview mode', () => {
    const { container } = render(<FormattingToolbar onFormat={mockOnFormat} viewMode="preview" />);

    expect(container.firstChild).toBeNull();
  });

  it('should call onFormat when button is clicked', () => {
    render(<FormattingToolbar onFormat={mockOnFormat} viewMode="edit" />);

    const boldButton = screen.getByLabelText('Bold');
    fireEvent.click(boldButton);

    expect(mockOnFormat).toHaveBeenCalledWith('bold');
  });
});
