/**
 * Unit tests for DocumentOutline component (Phase 7)
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
      { level: 3, text: 'Installation', id: 'installation' },
    ];

    vi.mocked(shared.extractHeadings).mockReturnValueOnce(mockHeadings);

    render(<DocumentOutline content="# Introduction\n## Getting Started\n### Installation" />);

    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Installation')).toBeInTheDocument();
  });

  it('should apply correct indentation based on heading level', () => {
    const mockHeadings = [
      { level: 1, text: 'H1', id: 'h1' },
      { level: 2, text: 'H2', id: 'h2' },
      { level: 3, text: 'H3', id: 'h3' },
    ];

    vi.mocked(shared.extractHeadings).mockReturnValueOnce(mockHeadings);

    const { container } = render(<DocumentOutline content="# H1\n## H2\n### H3" />);

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(3);

    // Check that padding increases with level
    const h1Link = links[0];
    const h2Link = links[1];
    const h3Link = links[2];

    expect(h1Link.style.paddingLeft).toBe('0.5rem'); // (1-1) * 0.75 + 0.5
    expect(h2Link.style.paddingLeft).toBe('1.25rem'); // (2-1) * 0.75 + 0.5
    expect(h3Link.style.paddingLeft).toBe('2rem'); // (3-1) * 0.75 + 0.5
  });

  it('should create correct anchor links for headings', () => {
    const mockHeadings = [
      { level: 1, text: 'Test Heading', id: 'test-heading' },
    ];

    vi.mocked(shared.extractHeadings).mockReturnValueOnce(mockHeadings);

    const { container } = render(<DocumentOutline content="# Test Heading" />);

    const link = container.querySelector('a[href="#test-heading"]');
    expect(link).toBeInTheDocument();
    expect(link?.textContent).toBe('Test Heading');
  });

  it('should call extractHeadings with content', () => {
    const content = '# Heading 1\n## Heading 2';
    vi.mocked(shared.extractHeadings).mockReturnValueOnce([]);

    render(<DocumentOutline content={content} />);

    expect(shared.extractHeadings).toHaveBeenCalledWith(content);
  });

  it('should handle heading click and scroll to element', () => {
    const mockHeadings = [
      { level: 1, text: 'Test', id: 'test' },
    ];

    vi.mocked(shared.extractHeadings).mockReturnValueOnce(mockHeadings);

    // Mock getElementById and scrollIntoView
    const mockScrollIntoView = vi.fn();
    const mockElement = {
      scrollIntoView: mockScrollIntoView,
    } as unknown as HTMLElement;

    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);

    const { container } = render(<DocumentOutline content="# Test" />);

    const link = container.querySelector('a');
    expect(link).toBeInTheDocument();

    link?.click();

    expect(document.getElementById).toHaveBeenCalledWith('test');
    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
  });

  it('should handle heading click when element not found', () => {
    const mockHeadings = [
      { level: 1, text: 'Test', id: 'test' },
    ];

    vi.mocked(shared.extractHeadings).mockReturnValueOnce(mockHeadings);

    vi.spyOn(document, 'getElementById').mockReturnValue(null);

    const { container } = render(<DocumentOutline content="# Test" />);

    const link = container.querySelector('a');
    expect(link).toBeInTheDocument();

    // Should not throw
    expect(() => link?.click()).not.toThrow();
  });
});

