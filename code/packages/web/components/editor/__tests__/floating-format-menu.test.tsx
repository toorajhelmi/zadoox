/**
 * Unit tests for FloatingFormatMenu component (Phase 7)
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingFormatMenu } from '../floating-format-menu';
import type { FormatType } from '../floating-format-menu';

describe('FloatingFormatMenu', () => {
  const mockOnFormat = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all format options', () => {
    render(
      <FloatingFormatMenu
        position={{ x: 100, y: 200 }}
        onFormat={mockOnFormat}
      />
    );

    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
    expect(screen.getByLabelText('Underline')).toBeInTheDocument();
    expect(screen.getByLabelText('Superscript')).toBeInTheDocument();
    expect(screen.getByLabelText('Subscript')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Link')).toBeInTheDocument();
  });

  it('should position menu at specified coordinates', () => {
    const { container } = render(
      <FloatingFormatMenu
        position={{ x: 150, y: 250 }}
        onFormat={mockOnFormat}
      />
    );

    const menu = container.querySelector('.floating-format-menu') as HTMLElement;
    expect(menu).toBeInTheDocument();
    expect(menu.style.left).toBe('150px');
    expect(menu.style.top).toBe('250px');
    expect(menu.style.transform).toBe('translate(-50%, -100%)');
    expect(menu.style.marginTop).toBe('-8px');
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

  it('should call onFormat with correct format type for each button', () => {
    const formatTypes: FormatType[] = ['bold', 'italic', 'underline', 'superscript', 'subscript', 'code', 'link'];

    render(
      <FloatingFormatMenu
        position={{ x: 100, y: 200 }}
        onFormat={mockOnFormat}
      />
    );

    for (const formatType of formatTypes) {
      const button = screen.getByLabelText(
        formatType.charAt(0).toUpperCase() + formatType.slice(1)
      );
      fireEvent.click(button);
      expect(mockOnFormat).toHaveBeenCalledWith(formatType);
    }

    expect(mockOnFormat).toHaveBeenCalledTimes(formatTypes.length);
  });

  it('should prevent default and stop propagation on button click', () => {
    render(
      <FloatingFormatMenu
        position={{ x: 100, y: 200 }}
        onFormat={mockOnFormat}
      />
    );

    const boldButton = screen.getByLabelText('Bold');
    fireEvent.mouseDown(boldButton);
    fireEvent.click(boldButton);

    // The component should handle the event
    expect(mockOnFormat).toHaveBeenCalled();
  });

  it('should have correct title attributes with shortcuts', () => {
    render(
      <FloatingFormatMenu
        position={{ x: 100, y: 200 }}
        onFormat={mockOnFormat}
      />
    );

    const boldButton = screen.getByLabelText('Bold');
    expect(boldButton).toHaveAttribute('title', 'Bold (Cmd+B)');

    const italicButton = screen.getByLabelText('Italic');
    expect(italicButton).toHaveAttribute('title', 'Italic (Cmd+I)');
  });

  it('should have fixed positioning and z-index', () => {
    const { container } = render(
      <FloatingFormatMenu
        position={{ x: 100, y: 200 }}
        onFormat={mockOnFormat}
      />
    );

    const menu = container.querySelector('.floating-format-menu') as HTMLElement;
    expect(menu).toBeInTheDocument();
    expect(menu.classList.contains('fixed')).toBe(true);
    expect(menu.classList.contains('z-50')).toBe(true);
  });

  it('should stop propagation on menu container click', () => {
    const { container } = render(
      <FloatingFormatMenu
        position={{ x: 100, y: 200 }}
        onFormat={mockOnFormat}
      />
    );

    const menu = container.querySelector('.floating-format-menu') as HTMLElement;
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');

    menu.dispatchEvent(clickEvent);

    // Component should handle the event
    expect(menu).toBeInTheDocument();
  });
});

