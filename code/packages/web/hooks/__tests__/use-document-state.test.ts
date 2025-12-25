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
  });

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
});
