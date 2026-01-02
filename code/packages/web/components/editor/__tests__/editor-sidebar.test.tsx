/**
 * Unit tests for EditorSidebar component (Phase 7)
 * Focus: Core functionality only
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorSidebar } from '../editor-sidebar';

describe('EditorSidebar', () => {
  const mockOnToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render sidebar content when sidebar is closed', () => {
    const { container } = render(<EditorSidebar isOpen={false} onToggle={mockOnToggle} content="" />);

    // When closed, EditorSidebar returns empty fragment (collapsed button is now in editor-layout)
    expect(container.firstChild).toBeNull();
  });

  it('should render expanded sidebar when isOpen is true', () => {
    render(<EditorSidebar isOpen={true} onToggle={mockOnToggle} content="" />);

    expect(screen.getByText('Outline')).toBeInTheDocument();
  });

  it('should render expanded sidebar content when isOpen is true', () => {
    render(<EditorSidebar isOpen={true} onToggle={mockOnToggle} content="# Test" />);

    // The collapse button is now in editor-layout, not in EditorSidebar
    // This test verifies the component renders correctly when open
    expect(screen.getByText('Outline')).toBeInTheDocument();
  });
});
