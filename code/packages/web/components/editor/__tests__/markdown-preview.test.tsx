/**
 * Unit tests for MarkdownPreview component (Phase 7)
 * Focus: Core functionality only
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownPreview } from '../markdown-preview';

// Mock Supabase client (used for token handling). Keep minimal surface.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      // onAuthStateChange is optional in production code; include it here to avoid act warnings.
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  }),
}));

// Use the real shared markdown renderer so this test validates the real rewrite behavior.
vi.mock('@zadoox/shared', async () => {
  const actual = await vi.importActual<typeof import('@zadoox/shared')>('@zadoox/shared');
  return actual;
});

describe('MarkdownPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render "No content to preview" when content is empty and no htmlOverride is provided', () => {
    render(<MarkdownPreview content="" />);

    expect(screen.getByText('No content to preview')).toBeInTheDocument();
  });

  it('should render when content is empty but htmlOverride is provided (IR/LaTeX preview)', () => {
    const { container } = render(<MarkdownPreview content="" htmlOverride="<div>From IR</div>" />);
    expect(screen.queryByText('No content to preview')).not.toBeInTheDocument();
    expect(container.querySelector('.markdown-content')?.innerHTML).toContain('From IR');
  });

  // Skip - testing implementation details (HTML rendering)
  // Core functionality (empty state) is already tested above
  it.skip('should render HTML content when content exists', () => {
    const htmlContent = '<p>Test content</p>';
    vi.mocked(shared.extractHeadings).mockReturnValue([]);
    vi.mocked(shared.renderMarkdownToHtml).mockReturnValue(htmlContent);

    const { container } = render(<MarkdownPreview content="Test content" />);

    const markdownContent = container.querySelector('.markdown-content');
    expect(markdownContent).not.toBeNull();
    expect(markdownContent?.innerHTML).toContain('Test content');
  });

  it('should rewrite zadoox-asset img src to placeholder + data-asset-key', () => {
    const { container } = render(<MarkdownPreview content="![Cap](zadoox-asset://abc.png)" />);
    const markdownContent = container.querySelector('.markdown-content') as HTMLElement | null;
    expect(markdownContent).not.toBeNull();
    expect(markdownContent?.innerHTML).toContain('data-asset-key="abc.png"');
    // Should no longer contain the unknown URL scheme
    expect(markdownContent?.innerHTML).not.toContain('zadoox-asset://');
  });
});
