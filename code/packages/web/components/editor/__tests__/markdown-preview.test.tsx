/**
 * Unit tests for MarkdownPreview component (Phase 7)
 */

/// <reference types="vitest" />
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

  it('should render "No content to preview" when content is only whitespace', () => {
    vi.mocked(shared.extractHeadings).mockReturnValueOnce([]);
    vi.mocked(shared.renderMarkdownToHtml).mockReturnValueOnce('');

    render(<MarkdownPreview content="   \n\t  " />);

    expect(screen.getByText('No content to preview')).toBeInTheDocument();
  });

  it('should render HTML content when content exists', () => {
    const htmlContent = '<p>Test content</p>';
    vi.mocked(shared.extractHeadings).mockReturnValueOnce([]);
    vi.mocked(shared.renderMarkdownToHtml).mockReturnValueOnce(htmlContent);

    const { container } = render(<MarkdownPreview content="Test content" />);

    const markdownContent = container.querySelector('.markdown-content');
    expect(markdownContent).toBeInTheDocument();
    expect(markdownContent?.innerHTML).toBe(htmlContent);
  });

  it('should add IDs to headings for navigation', () => {
    const mockHeadings = [
      { level: 1, text: 'Introduction', id: 'introduction' },
      { level: 2, text: 'Getting Started', id: 'getting-started' },
    ];

    const htmlBefore = '<h1>Introduction</h1><h2>Getting Started</h2>';
    const htmlAfter = '<h1 id="introduction">Introduction</h1><h2 id="getting-started">Getting Started</h2>';

    vi.mocked(shared.extractHeadings).mockReturnValueOnce(mockHeadings);
    vi.mocked(shared.renderMarkdownToHtml).mockReturnValueOnce(htmlBefore);

    const { container } = render(<MarkdownPreview content="# Introduction\n## Getting Started" />);

    const markdownContent = container.querySelector('.markdown-content');
    expect(markdownContent).toBeInTheDocument();
    expect(markdownContent?.innerHTML).toContain('id="introduction"');
    expect(markdownContent?.innerHTML).toContain('id="getting-started"');
  });

  it('should call renderMarkdownToHtml with content', () => {
    const content = '# Heading\nSome text';
    vi.mocked(shared.extractHeadings).mockReturnValueOnce([]);
    vi.mocked(shared.renderMarkdownToHtml).mockReturnValueOnce('<h1>Heading</h1><p>Some text</p>');

    render(<MarkdownPreview content={content} />);

    expect(shared.renderMarkdownToHtml).toHaveBeenCalledWith(content);
  });

  it('should call extractHeadings with content', () => {
    const content = '# Heading\nSome text';
    vi.mocked(shared.extractHeadings).mockReturnValueOnce([]);
    vi.mocked(shared.renderMarkdownToHtml).mockReturnValueOnce('<h1>Heading</h1><p>Some text</p>');

    render(<MarkdownPreview content={content} />);

    expect(shared.extractHeadings).toHaveBeenCalledWith(content);
  });

  it('should escape special regex characters in heading text', () => {
    const mockHeadings = [
      { level: 1, text: 'Test (with) [brackets]', id: 'test-with-brackets' },
    ];

    const htmlBefore = '<h1>Test (with) [brackets]</h1>';
    vi.mocked(shared.extractHeadings).mockReturnValueOnce(mockHeadings);
    vi.mocked(shared.renderMarkdownToHtml).mockReturnValueOnce(htmlBefore);

    const { container } = render(<MarkdownPreview content="# Test (with) [brackets]" />);

    const markdownContent = container.querySelector('.markdown-content');
    expect(markdownContent).toBeInTheDocument();
    // Should still add the ID despite special characters
    expect(markdownContent?.innerHTML).toContain('id="test-with-brackets"');
  });

  it('should apply correct styling classes', () => {
    vi.mocked(shared.extractHeadings).mockReturnValueOnce([]);
    vi.mocked(shared.renderMarkdownToHtml).mockReturnValueOnce('<p>Test</p>');

    const { container } = render(<MarkdownPreview content="Test" />);

    const markdownContent = container.querySelector('.markdown-content');
    expect(markdownContent).toBeInTheDocument();
    expect(markdownContent?.className).toContain('markdown-content');
  });
});

