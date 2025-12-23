/**
 * Unit tests for useDocumentState hook (Phase 7)
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

describe('useDocumentState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Loading existing document', () => {
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

      expect(result.current.isLoading).toBe(true);

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      expect(result.current.content).toBe('Test content');
      expect(result.current.documentTitle).toBe('Test Document');
      expect(result.current.documentId).toBe('doc-1');
      expect(result.current.lastSaved).toBeInstanceOf(Date);
      expect(api.documents.get).toHaveBeenCalledWith('doc-1');
    });

    it('should handle document not found', async () => {
      vi.mocked(api.documents.get).mockRejectedValueOnce(new Error('Not found'));

      const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      expect(result.current.content).toBe('');
      expect(result.current.documentTitle).toBe('');
    });
  });

  describe('Default document creation', () => {
    it('should create "Untitled Document" when documentId is "default" and project has no documents', async () => {
      const mockDocument: Document = {
        id: 'doc-new',
        projectId: 'project-1',
        title: 'Untitled Document',
        content: '',
        metadata: { type: 'standalone' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      vi.mocked(api.documents.listByProject).mockResolvedValueOnce([]);
      vi.mocked(api.documents.create).mockResolvedValueOnce(mockDocument);

      const { result } = renderHook(() => useDocumentState('default', 'project-1'));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      expect(result.current.documentTitle).toBe('Untitled Document');
      expect(result.current.documentId).toBe('doc-new');
      expect(api.documents.listByProject).toHaveBeenCalledWith('project-1');
      expect(api.documents.create).toHaveBeenCalledWith({
        projectId: 'project-1',
        title: 'Untitled Document',
        content: '',
        metadata: { type: 'standalone' },
      });
    });

    it('should use first existing document when documentId is "default" and project has documents', async () => {
      const mockDocuments: Document[] = [
        {
          id: 'doc-1',
          projectId: 'project-1',
          title: 'Existing Document',
          content: 'Existing content',
          metadata: { type: 'standalone' },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      vi.mocked(api.documents.listByProject).mockResolvedValueOnce(mockDocuments);

      const { result } = renderHook(() => useDocumentState('default', 'project-1'));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      expect(result.current.documentTitle).toBe('Existing Document');
      expect(result.current.content).toBe('Existing content');
      expect(result.current.documentId).toBe('doc-1');
      expect(api.documents.create).not.toHaveBeenCalled();
    });
  });

  describe('Auto-save functionality', () => {
    it('should auto-save content after delay', async () => {
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

      expect(result.current.isSaving).toBe(false);
      expect(api.documents.update).not.toHaveBeenCalled();

      // Fast-forward time by 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(result.current.isSaving).toBe(false);
      });

      expect(api.documents.update).toHaveBeenCalledWith('doc-1', {
        content: 'Updated content',
      });
      expect(result.current.lastSaved).toBeInstanceOf(Date);
    });

    it('should debounce multiple updates', async () => {
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
      vi.mocked(api.documents.update).mockResolvedValueOnce(mockDocument);

      const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      // Make multiple rapid updates
      act(() => {
        result.current.updateContent('Update 1');
        vi.advanceTimersByTime(500);
        result.current.updateContent('Update 2');
        vi.advanceTimersByTime(500);
        result.current.updateContent('Update 3');
        vi.advanceTimersByTime(500);
        result.current.updateContent('Final content');
      });

      // Only 1 second has passed, should not save yet
      expect(api.documents.update).not.toHaveBeenCalled();

      // Fast-forward remaining time
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(api.documents.update).toHaveBeenCalledTimes(1);
      });

      // Should only save the final content
      expect(api.documents.update).toHaveBeenCalledWith('doc-1', {
        content: 'Final content',
      });
    });

    it('should not save if documentId is "default"', async () => {
      const mockDocument: Document = {
        id: 'doc-new',
        projectId: 'project-1',
        title: 'Untitled Document',
        content: '',
        metadata: { type: 'standalone' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      vi.mocked(api.documents.listByProject).mockResolvedValueOnce([]);
      vi.mocked(api.documents.create).mockResolvedValueOnce(mockDocument);

      const { result } = renderHook(() => useDocumentState('default', 'project-1'));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      // Wait for actual document ID to be set
      await waitFor(() => {
        expect(result.current.documentId).toBe('doc-new');
      });

      // Now update content - should save
      act(() => {
        result.current.updateContent('New content');
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(api.documents.update).toHaveBeenCalled();
      });
    });

    it('should handle save errors gracefully', async () => {
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
      vi.mocked(api.documents.update).mockRejectedValueOnce(new Error('Save failed'));

      const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 }
      );

      const initialLastSaved = result.current.lastSaved;

      act(() => {
        result.current.updateContent('Updated content');
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(result.current.isSaving).toBe(false);
      });

      // lastSaved should not be updated on error
      expect(result.current.lastSaved).toEqual(initialLastSaved);
    });
  });

  describe('State management', () => {
    it('should return correct initial state', () => {
      const { result } = renderHook(() => useDocumentState('doc-1', 'project-1'));

      expect(result.current.content).toBe('');
      expect(result.current.documentTitle).toBe('');
      expect(result.current.isSaving).toBe(false);
      expect(result.current.lastSaved).toBeNull();
      expect(result.current.isLoading).toBe(true);
    });

    it('should update content immediately', async () => {
      const mockDocument: Document = {
        id: 'doc-1',
        projectId: 'project-1',
        title: 'Test Document',
        content: 'Initial',
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
        result.current.updateContent('New content');
      });

      expect(result.current.content).toBe('New content');
    });
  });
});

