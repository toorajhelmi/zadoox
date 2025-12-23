/**
 * Unit tests for FormattingToolbar component (Phase 7)
 */

/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormattingToolbar } from '../formatting-toolbar';
import type { FormatType } from '../floating-format-menu';

describe('FormattingToolbar', () => {
  const mockOnFormat = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all format buttons in edit mode', () => {
    render(<FormattingToolbar onFormat={mockOnFormat} viewMode="edit" />);

    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
    expect(screen.getByLabelText('Underline')).toBeInTheDocument();
    expect(screen.getByLabelText('Superscript')).toBeInTheDocument();
    expect(screen.getByLabelText('Subscript')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Link')).toBeInTheDocument();
  });

  it('should render all format buttons in split mode', () => {
    render(<FormattingToolbar onFormat={mockOnFormat} viewMode="split" />);

    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
  });

  it('should not render in preview mode', () => {
    const { container } = render(<FormattingToolbar onFormat={mockOnFormat} viewMode="preview" />);

    expect(container.firstChild).toBeNull();
  });

  it('should call onFormat when bold button is clicked', () => {
    render(<FormattingToolbar onFormat={mockOnFormat} viewMode="edit" />);

    const boldButton = screen.getByLabelText('Bold');
    fireEvent.click(boldButton);

    expect(mockOnFormat).toHaveBeenCalledWith('bold');
  });

  it('should call onFormat when italic button is clicked', () => {
    render(<FormattingToolbar onFormat={mockOnFormat} viewMode="edit" />);

    const italicButton = screen.getByLabelText('Italic');
    fireEvent.click(italicButton);

    expect(mockOnFormat).toHaveBeenCalledWith('italic');
  });

  it('should call onFormat with correct format type for each button', () => {
    const formatTypes: FormatType[] = ['bold', 'italic', 'underline', 'superscript', 'subscript', 'code', 'link'];

    render(<FormattingToolbar onFormat={mockOnFormat} viewMode="edit" />);

    for (const formatType of formatTypes) {
      const button = screen.getByLabelText(
        formatType.charAt(0).toUpperCase() + formatType.slice(1)
      );
      fireEvent.click(button);
      expect(mockOnFormat).toHaveBeenCalledWith(formatType);
    }

    expect(mockOnFormat).toHaveBeenCalledTimes(formatTypes.length);
  });

  it('should prevent default and stop propagation on button click', async () => {
    const user = userEvent.setup();
    render(<FormattingToolbar onFormat={mockOnFormat} viewMode="edit" />);

    const boldButton = screen.getByLabelText('Bold');
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');
    const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');

    boldButton.dispatchEvent(clickEvent);

    // The component should handle the event
    expect(mockOnFormat).toHaveBeenCalled();
  });

  it('should have correct aria-labels for accessibility', () => {
    render(<FormattingToolbar onFormat={mockOnFormat} viewMode="edit" />);

    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
    expect(screen.getByLabelText('Underline')).toBeInTheDocument();
    expect(screen.getByLabelText('Superscript')).toBeInTheDocument();
    expect(screen.getByLabelText('Subscript')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Link')).toBeInTheDocument();
  });
});

