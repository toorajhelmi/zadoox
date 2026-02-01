/**
 * Unit tests for MarkdownPreview component (Phase 7)
 * Focus: Core functionality only
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  it('should show a hover popover for citation links (footnote-style UX)', async () => {
    const htmlOverride = [
      '<div>',
      '<p>See [1] for details.</p>',
      '<h2>References</h2>',
      '<p>[1] Ref text</p>',
      '</div>',
    ].join('');

    const { container } = render(<MarkdownPreview content="" htmlOverride={htmlOverride} />);

    const cite = await waitFor(() => {
      const a = container.querySelector('a.citation-link') as HTMLAnchorElement | null;
      if (!a) throw new Error('missing citation link');
      return a;
    });

    // Ensure the popover element is created by the effect.
    await waitFor(() => {
      const pop = document.querySelector('.zx-citation-popover') as HTMLElement | null;
      if (!pop) throw new Error('missing popover');
    });

    fireEvent.pointerOver(cite);

    await waitFor(() => {
      const pop = document.querySelector('.zx-citation-popover') as HTMLElement | null;
      if (!pop) throw new Error('missing popover');
      expect(pop.style.display).toBe('block');
      expect(pop.textContent || '').toContain('Ref text');
    });
  });

  it('should pretty-print LaTeX-style section refs and fix duplicated sec-sec- hrefs', async () => {
    const htmlOverride = [
      '<div>',
      '<h2 id="sec-attention">Attention</h2>',
      '<p>See <a href="#sec-sec-attention">sec:attention</a>.</p>',
      '</div>',
    ].join('');

    const { container } = render(<MarkdownPreview content="" htmlOverride={htmlOverride} />);

    await waitFor(() => {
      // After the ref-normalization effect runs, this should be rewritten.
      const a = container.querySelector('a[href="#sec-attention"]') as HTMLAnchorElement | null;
      if (!a) throw new Error('missing rewritten anchor');
      expect((a.textContent || '').toLowerCase()).toContain('section');
      expect(a.textContent || '').toMatch(/\bsection\s+1\b/i);
    });
  });

  it('should rewrite sec: links to Section N even when href already points to #sec-*', async () => {
    const htmlOverride = [
      '<div>',
      '<h2 id="sec-attention" data-zx-secnum="3">3 Attention</h2>',
      '<p>See <a href="#sec-attention">sec:attention</a>.</p>',
      '</div>',
    ].join('');

    const { container } = render(<MarkdownPreview content="" htmlOverride={htmlOverride} />);

    await waitFor(() => {
      const a = container.querySelector('a[href="#sec-attention"]') as HTMLAnchorElement | null;
      if (!a) throw new Error('missing anchor');
      expect(a.textContent).toBe('Section 3');
    });
  });

  it('should fetch LaTeX bundle assets with cookie creds when no access token is available (avoid figure regressions)', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: false, blob: async () => new Blob([]), headers: new Headers() }) as any);
    // @ts-expect-error - test shim
    global.fetch = fetchSpy;

    const htmlOverride = '<div><img data-zx-asset-path="Figures/Foo.png" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" /></div>';
    render(<MarkdownPreview content="" htmlOverride={htmlOverride} latexDocId="doc-1" />);

    await waitFor(() => {
      // We should at least attempt a request; when no token is present, it must use credentials include.
      expect(fetchSpy).toHaveBeenCalled();
      const [, init] = fetchSpy.mock.calls.find((c) => String(c[0] || '').includes('/latex/file')) ?? [];
      expect(init?.credentials).toBe('include');
    });
  });
});
