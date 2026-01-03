import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import PublishPreviewPage from './page';

const hoisted = vi.hoisted(() => {
  return {
    pushSpy: vi.fn(),
    searchParams: new URLSearchParams({
      documentId: 'doc-1',
      source: 'markdown',
    }),
    mockApi: {
      publish: { web: vi.fn(), pdf: vi.fn() },
      documents: { get: vi.fn() },
    },
  };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'proj-1' }),
  useRouter: () => ({
    push: hoisted.pushSpy,
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => hoisted.searchParams,
}));

vi.mock('@/lib/api/client', () => ({
  api: hoisted.mockApi,
}));

// Avoid triggering asset-resolution fetches in this test
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  })),
}));

describe('Publish preview page (PDF)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.pushSpy.mockClear();
    hoisted.searchParams = new URLSearchParams({
      documentId: 'doc-1',
      source: 'markdown',
    });
    hoisted.mockApi.documents.get.mockResolvedValue({
      id: 'doc-1',
      projectId: 'proj-1',
      title: 'Doc One',
      content: 'Hello',
      metadata: {},
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      authorId: 'user-1',
    });
  });

  it('calls api.publish.web with purpose=pdf and renders preview iframe', async () => {
    hoisted.mockApi.publish.web.mockResolvedValueOnce({
      title: 'Doc One',
      html: '<!doctype html><html><body><div>PDF Preview</div></body></html>',
    });

    render(<PublishPreviewPage />);

    expect(screen.getByText('Generating preview…')).toBeInTheDocument();

    await waitFor(() => {
      expect(hoisted.mockApi.publish.web).toHaveBeenCalledWith('proj-1', {
        documentId: 'doc-1',
        source: 'markdown',
        purpose: 'pdf',
      });
    });

    expect(await screen.findByTitle('PDF preview')).toBeInTheDocument();
  });

  it('Save icon triggers print() on iframe contentWindow (MD → PDF local)', async () => {
    hoisted.mockApi.publish.web.mockResolvedValueOnce({
      title: 'Doc One',
      html: '<!doctype html><html><body><div>PDF Preview</div></body></html>',
    });

    render(<PublishPreviewPage />);

    const iframe = await screen.findByTitle('PDF preview');
    const focus = vi.fn();
    const print = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { focus, print },
      configurable: true,
    });

    const saveBtn = await screen.findByRole('button', { name: 'Save as PDF' });
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    expect(focus).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
  });
});

describe('Publish preview page (PDF) - LaTeX source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.pushSpy.mockClear();
    hoisted.searchParams = new URLSearchParams({
      documentId: 'doc-1',
      source: 'latex',
    });
    hoisted.mockApi.documents.get.mockResolvedValue({
      id: 'doc-1',
      projectId: 'proj-1',
      title: 'Doc One',
      content: 'Hello',
      metadata: { latex: '\\\\section{Hi}' },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      authorId: 'user-1',
    });
  });

  it('calls api.publish.pdf when source=latex', async () => {
    hoisted.mockApi.publish.pdf.mockResolvedValueOnce({
      blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
      filename: 'Doc_One.pdf',
    });

    render(<PublishPreviewPage />);

    await waitFor(() => {
      expect(hoisted.mockApi.publish.pdf).toHaveBeenCalledWith('proj-1', {
        documentId: 'doc-1',
        source: 'latex',
      });
    });

    // Ensure we did NOT go through HTML preview pipeline for LaTeX.
    expect(hoisted.mockApi.publish.web).not.toHaveBeenCalled();
  });
});


