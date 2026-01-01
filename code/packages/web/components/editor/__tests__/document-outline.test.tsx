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
  extractOutlineItems: vi.fn(),
}));

describe('DocumentOutline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render "No outline available" when there are no headings', () => {
    vi.mocked(shared.extractOutlineItems).mockReturnValueOnce([]);

    render(<DocumentOutline content="# Test" />);

    expect(screen.getByText('No outline available')).toBeInTheDocument();
  });

  it('should render headings when content has headings', () => {
    const mockItems = [
      { kind: 'heading', level: 1, text: 'Introduction', id: 'introduction' },
      { kind: 'heading', level: 2, text: 'Getting Started', id: 'getting-started' },
    ];

    vi.mocked(shared.extractOutlineItems).mockReturnValueOnce(mockItems as any);

    render(<DocumentOutline content="# Introduction\n## Getting Started" />);

    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
  });

  it('should render figures in the outline', () => {
    const mockItems = [
      { kind: 'heading', level: 1, text: 'Intro', id: 'intro' },
      { kind: 'figure', id: 'figure-fig-generated-1', text: 'Figure — A caption', figureNumber: 1, caption: 'A caption' },
      { kind: 'figure', id: 'figure-fig-generated-2', text: 'Figure 2', figureNumber: 2, caption: null },
    ];

    vi.mocked(shared.extractOutlineItems).mockReturnValueOnce(mockItems as any);

    render(<DocumentOutline content="# Intro\n![A caption](x){#fig:generated-1}\n![](x){#fig:generated-2}" />);

    expect(screen.getByText('Figure — A caption')).toBeInTheDocument();
    expect(screen.getByText('Figure 2')).toBeInTheDocument();
  });
});
