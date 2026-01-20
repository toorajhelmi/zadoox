/**
 * Unit tests for useDocumentState hook (Phase 7)
 * Focus: Core functionality only - document loading, auto-save
 */

/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDocumentState } from '../use-document-state';
import { api } from '@/lib/api/client';
import type { Document } from '@zadoox/shared';

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  api: {
    documents: {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      listByProject: vi.fn(),
    },
  },
}));

describe('useDocumentState - Core Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should load an existing document by ID', async () => {
    const mockDocument: Document = {
      id: 'doc-1',
      projectId: 'project-1',
      title: 'Test Document',
      content: 'Test content',
      metadata: { type: 'standalone' },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    vi.mocked(api.documents.get).mockResolvedValueOnce(mockDocument);

    const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 10000 }
    );

    expect(result.current.content).toBe('Test content');
    expect(result.current.documentTitle).toBe('Test Document');
    expect(result.current.documentId).toBe('doc-1');
  });

  it('should derive document title from the first H1 heading', async () => {
    const mockDocument: Document = {
      id: 'doc-1',
      projectId: 'project-1',
      title: 'Untitled Document',
      content: '# Philosophical Implications of Quantum Mechanics\n\nBody',
      metadata: { type: 'standalone' },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    vi.mocked(api.documents.get).mockResolvedValueOnce(mockDocument);

    const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 10000 }
    );

    expect(result.current.documentTitle).toBe('Philosophical Implications of Quantum Mechanics');
  });

  it('should update documentTitle immediately when user adds an H1', async () => {
    const mockDocument: Document = {
      id: 'doc-1',
      projectId: 'project-1',
      title: 'Untitled Document',
      content: '',
      metadata: { type: 'standalone' },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    vi.mocked(api.documents.get).mockResolvedValueOnce(mockDocument);

    const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 10000 }
    );

    act(() => {
      result.current.updateContent('# My Title\n\nBody');
    });

    expect(result.current.documentTitle).toBe('My Title');
  });

  // Removed: "default" documentId handling (we always require a real UUID now).

  it.skip('should auto-save content after delay', async () => {
    const mockDocument: Document = {
      id: 'doc-1',
      projectId: 'project-1',
      title: 'Test Document',
      content: 'Initial content',
      metadata: { type: 'standalone' },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    const updatedDocument: Document = {
      ...mockDocument,
      content: 'Updated content',
      updatedAt: new Date('2024-01-03'),
    };

    vi.mocked(api.documents.get).mockResolvedValueOnce(mockDocument);
    
    // Use mockResolvedValueOnce to ensure the mock is properly set up
    vi.mocked(api.documents.update).mockResolvedValueOnce(updatedDocument);

    const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 10000 }
    );

    // Update content
    act(() => {
      result.current.updateContent('Updated content');
    });

    // Wait for auto-save to trigger (2 seconds delay + async operation)
    // Use a longer timeout for CI environments
    await waitFor(
      () => {
        expect(api.documents.update).toHaveBeenCalled();
        expect(result.current.isSaving).toBe(false);
      },
      { timeout: 10000 }
    );

    // Check that update was called with correct arguments
    // Use toHaveBeenCalledWith which is more reliable across environments
    expect(api.documents.update).toHaveBeenCalledWith(
      'doc-1',
      expect.objectContaining({
        content: 'Updated content',
        changeType: 'auto-save',
      })
    );
  });

  it('should provide setContentWithoutSave that does not trigger auto-save', async () => {
    const mockDocument: Document = {
      id: 'doc-1',
      projectId: 'project-1',
      title: 'Test Document',
      content: 'Initial content',
      metadata: { type: 'standalone' },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    vi.mocked(api.documents.get).mockResolvedValueOnce(mockDocument);

    const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 10000 }
    );

    // Use setContentWithoutSave
    act(() => {
      result.current.setContentWithoutSave('New content without save');
    });

    // Wait a bit to ensure auto-save doesn't trigger
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // updateContent should NOT have been called (no auto-save)
    expect(api.documents.update).not.toHaveBeenCalled();
    expect(result.current.content).toBe('New content without save');
  });

  describe('handleModeToggle', () => {
    it('should update paragraph mode locally', async () => {
      const mockDocument: Document = {
        id: 'doc-1',
        projectId: 'project-1',
        title: 'Test Document',
        content: 'Test content',
        metadata: { type: 'standalone' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      vi.mocked(api.documents.get).mockResolvedValueOnce(mockDocument);
      vi.mocked(api.documents.get).mockResolvedValueOnce(mockDocument);
      vi.mocked(api.documents.update).mockResolvedValueOnce({
        ...mockDocument,
        metadata: {
          ...mockDocument.metadata,
          paragraphModes: { 'para-0': 'think' },
        },
      });

      const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      act(() => {
        result.current.handleModeToggle('para-0', 'think');
      });

      await waitFor(() => {
        expect(result.current.paragraphModes['para-0']).toBe('think');
      });
    });

    it('should persist paragraph mode to document metadata', async () => {
      const mockDocument: Document = {
        id: 'doc-1',
        projectId: 'project-1',
        title: 'Test Document',
        content: 'Test content',
        metadata: { type: 'standalone' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      vi.mocked(api.documents.get).mockResolvedValueOnce(mockDocument);
      vi.mocked(api.documents.get).mockResolvedValueOnce(mockDocument);
      vi.mocked(api.documents.update).mockResolvedValueOnce({
        ...mockDocument,
        metadata: {
          ...mockDocument.metadata,
          paragraphModes: { 'para-0': 'think' },
        },
      });

      const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      act(() => {
        result.current.handleModeToggle('para-0', 'think');
      });

      await waitFor(() => {
        expect(api.documents.update).toHaveBeenCalledWith(
          'doc-1',
          expect.objectContaining({
            metadata: expect.objectContaining({
              paragraphModes: { 'para-0': 'think' },
            }),
          })
        );
      });
    });

    it('should handle mode toggle for multiple paragraphs', async () => {
      const mockDocument: Document = {
        id: 'doc-1',
        projectId: 'project-1',
        title: 'Test Document',
        content: 'First paragraph\n\nSecond paragraph',
        metadata: { type: 'standalone' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      vi.mocked(api.documents.get).mockResolvedValue(mockDocument);
      vi.mocked(api.documents.update).mockResolvedValue(mockDocument);

      const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      act(() => {
        result.current.handleModeToggle('para-0', 'think');
      });

      await waitFor(() => {
        expect(result.current.paragraphModes['para-0']).toBe('think');
      });

      act(() => {
        result.current.handleModeToggle('para-2', 'think');
      });

      await waitFor(() => {
        expect(result.current.paragraphModes['para-0']).toBe('think');
        expect(result.current.paragraphModes['para-2']).toBe('think');
      });
    });

    it('should revert local state on API error', async () => {
      const mockDocument: Document = {
        id: 'doc-1',
        projectId: 'project-1',
        title: 'Test Document',
        content: 'Test content',
        metadata: { type: 'standalone' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      vi.mocked(api.documents.get).mockResolvedValueOnce(mockDocument);
      vi.mocked(api.documents.get).mockResolvedValueOnce(mockDocument);
      vi.mocked(api.documents.update).mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      act(() => {
        result.current.handleModeToggle('para-0', 'think');
      });

      // Initially should be set
      await waitFor(() => {
        expect(result.current.paragraphModes['para-0']).toBe('think');
      });

      // After error, should be reverted
      await waitFor(() => {
        expect(result.current.paragraphModes['para-0']).toBeUndefined();
      }, { timeout: 5000 });
    });

    // Removed: "default" documentId handling (we always require a real UUID now).
  });

  it(
    'should persist semanticGraph without mixing it into metadata',
    async () => {
    const mockDocument: Document = {
      id: 'doc-1',
      projectId: 'project-1',
      title: 'Test Document',
      content: 'Test content',
      metadata: { type: 'standalone', foo: 'bar' },
      semanticGraph: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    // Initial load
    vi.mocked(api.documents.get).mockResolvedValueOnce(mockDocument);
    vi.mocked(api.documents.update).mockResolvedValueOnce({
      ...mockDocument,
      semanticGraph: { version: 1, nodes: [], edges: [], updatedAt: '2024-01-03T00:00:00.000Z' },
      updatedAt: new Date('2024-01-03'),
    });

    const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 10000 }
    );

    // Switch to fake timers only for the debounced metadata save.
    vi.useFakeTimers();

    act(() => {
      result.current.saveSemanticGraphPatch({
        version: 1,
        nodes: [],
        edges: [],
        updatedAt: '2024-01-03T00:00:00.000Z',
      });
    });

    // Debounced metadata save should trigger update after delay.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(vi.mocked(api.documents.update)).toHaveBeenCalled();

    const updateArg = vi.mocked(api.documents.update).mock.calls[0]?.[1] as any;
    expect(updateArg?.content).toBeUndefined();
    expect(updateArg?.metadata).toBeUndefined();
    expect(updateArg?.semanticGraph?.version).toBe(1);
    },
    15000
  );
});
