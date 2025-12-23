/**
 * Unit tests for MarkdownPreview component (Phase 7)
 * Focus: Core functionality only
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownPreview } from '../markdown-preview';
import * as shared from '@zadoox/shared';

// Mock the shared package
vi.mock('@zadoox/shared', () => ({
  renderMarkdownToHtml: vi.fn(),
  extractHeadings: vi.fn(),
}));

describe('MarkdownPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render "No content to preview" when content is empty', () => {
    vi.mocked(shared.extractHeadings).mockReturnValueOnce([]);
    vi.mocked(shared.renderMarkdownToHtml).mockReturnValueOnce('');

    render(<MarkdownPreview content="" />);

    expect(screen.getByText('No content to preview')).toBeInTheDocument();
  });

  it('should render HTML content when content exists', () => {
    const htmlContent = '<p>Test content</p>';
    vi.mocked(shared.extractHeadings).mockReturnValueOnce([]);
    vi.mocked(shared.renderMarkdownToHtml).mockReturnValueOnce(htmlContent);

    const { container } = render(<MarkdownPreview content="Test content" />);

    const markdownContent = container.querySelector('.markdown-content');
    expect(markdownContent).not.toBeNull();
    expect(markdownContent?.innerHTML).toBe(htmlContent);
  });
});
