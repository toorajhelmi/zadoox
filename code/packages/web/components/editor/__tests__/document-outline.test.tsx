/**
 * Unit tests for DocumentOutline component (Phase 7)
 * Focus: Core functionality only
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentOutline } from '../document-outline';
import * as shared from '@zadoox/shared';

// Mock the shared package
vi.mock('@zadoox/shared', () => ({
  extractHeadings: vi.fn(),
}));

describe('DocumentOutline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render "No outline available" when there are no headings', () => {
    vi.mocked(shared.extractHeadings).mockReturnValueOnce([]);

    render(<DocumentOutline content="# Test" />);

    expect(screen.getByText('No outline available')).toBeInTheDocument();
  });

  it('should render headings when content has headings', () => {
    const mockHeadings = [
      { level: 1, text: 'Introduction', id: 'introduction' },
      { level: 2, text: 'Getting Started', id: 'getting-started' },
    ];

    vi.mocked(shared.extractHeadings).mockReturnValueOnce(mockHeadings);

    render(<DocumentOutline content="# Introduction\n## Getting Started" />);

    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
  });
});
