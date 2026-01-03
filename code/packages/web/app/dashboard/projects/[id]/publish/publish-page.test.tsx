import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import PublishPage from './page';

const hoisted = vi.hoisted(() => {
  return {
    pushSpy: vi.fn(),
    mockApi: {
      projects: { get: vi.fn() },
      documents: { listByProject: vi.fn() },
      publish: { web: vi.fn() },
    },
  };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'proj-1' }),
  useRouter: () => ({
    push: hoisted.pushSpy,
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api/client', () => ({
  api: hoisted.mockApi,
}));

describe('Publish page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.pushSpy.mockClear();

    hoisted.mockApi.projects.get.mockResolvedValue({
      id: 'proj-1',
      name: 'Test Project',
      type: 'academic',
      ownerId: 'user-1',
      settings: {
        defaultFormat: 'markdown',
        chapterNumbering: false,
        autoSync: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    hoisted.mockApi.documents.listByProject.mockResolvedValue([
      {
        id: 'doc-1',
        projectId: 'proj-1',
        title: 'Doc One',
        content: 'Hello',
        metadata: { type: 'standalone', lastEditedFormat: 'markdown', latex: '\\\\section{Hi}' },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        authorId: 'user-1',
      },
    ]);
  });

  it('navigates to PDF preview page when target is PDF and Publish is clicked', async () => {
    render(<PublishPage />);

    // Wait for the doc picker to be ready
    await screen.findByText('Publishing');

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(hoisted.pushSpy).toHaveBeenCalledWith(
      '/dashboard/projects/proj-1/publish/preview?documentId=doc-1&source=markdown'
    );
  });

  it('calls api.publish.web and renders HTML preview when target is Web', async () => {
    hoisted.mockApi.publish.web.mockResolvedValueOnce({
      title: 'Doc One',
      html: '<!doctype html><html><body><div>Published</div></body></html>',
    });

    render(<PublishPage />);

    await screen.findByText('Publishing');

    fireEvent.click(screen.getByRole('button', { name: 'Web' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(hoisted.mockApi.publish.web).toHaveBeenCalledWith('proj-1', {
        documentId: 'doc-1',
        source: 'markdown',
      });
    });

    // Preview iframe should appear
    expect(await screen.findByTitle('Publish preview')).toBeInTheDocument();
  });

  it('uses LaTeX source when selected (even if publish is clicked immediately after toggle)', async () => {
    hoisted.mockApi.publish.web.mockResolvedValueOnce({
      title: 'Doc One',
      html: '<!doctype html><html><body><div>Latex</div></body></html>',
    });

    render(<PublishPage />);
    await screen.findByText('Publishing');

    // Select LaTeX, then publish web immediately.
    fireEvent.click(screen.getByDisplayValue('latex'));
    fireEvent.click(screen.getByRole('button', { name: 'Web' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(hoisted.mockApi.publish.web).toHaveBeenCalledWith('proj-1', {
        documentId: 'doc-1',
        source: 'latex',
      });
    });
  });
});


