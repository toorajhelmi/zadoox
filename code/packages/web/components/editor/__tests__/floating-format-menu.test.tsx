/**
 * Unit tests for FloatingFormatMenu component (Phase 7)
 * Focus: Core functionality only
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingFormatMenu } from '../floating-format-menu';

describe('FloatingFormatMenu', () => {
  const mockOnFormat = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render format options', () => {
    render(
      <FloatingFormatMenu
        position={{ x: 100, y: 200 }}
        onFormat={mockOnFormat}
      />
    );

    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
  });

  it('should call onFormat when a format button is clicked', () => {
    render(
      <FloatingFormatMenu
        position={{ x: 100, y: 200 }}
        onFormat={mockOnFormat}
      />
    );

    const boldButton = screen.getByLabelText('Bold');
    fireEvent.click(boldButton);

    expect(mockOnFormat).toHaveBeenCalledWith('bold');
  });
});
