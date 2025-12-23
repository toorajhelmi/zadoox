/**
 * Document Service Versioning Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentService } from '../document-service.js';
import { VersionService } from '../version-service.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
} as unknown as SupabaseClient;

// Mock VersionService
vi.mock('../version-service.js', () => ({
  VersionService: vi.fn().mockImplementation(() => ({
    createVersion: vi.fn(),
  })),
}));

describe('DocumentService - Versioning Integration', () => {
  let documentService: DocumentService;
  let mockVersionService: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    vi.clearAllMocks();
    documentService = new DocumentService(mockSupabase);
    mockVersionService = (documentService as any).versionService;
    
    // Reset query builder mock
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    };
    
    vi.mocked(mockSupabase.from).mockReturnValue(mockQueryBuilder);
  });

  describe('updateDocument with versioning', () => {
    it('should create version when content changes (manual-save)', async () => {
      const documentId = 'doc-1';
      const authorId = 'user-1';
      const oldContent = 'Old content';
      const newContent = 'New content';

      // Mock getDocumentById
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: documentId,
          project_id: 'project-1',
          title: 'Test Document',
          content: oldContent,
          metadata: { type: 'standalone', order: 0 },
          version: 1,
          author_id: authorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock version creation
      mockVersionService.createVersion.mockResolvedValue({
        id: 'version-2',
        documentId,
        versionNumber: 2,
        isSnapshot: false,
        changeType: 'manual-save',
      });

      // Mock document update
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: documentId,
          project_id: 'project-1',
          title: 'Test Document',
          content: newContent,
          metadata: { type: 'standalone', order: 0 },
          version: 2,
          author_id: authorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const document = await documentService.updateDocument(
        documentId,
        { content: newContent },
        authorId,
        'manual-save'
      );

      expect(mockVersionService.createVersion).toHaveBeenCalledWith(
        documentId,
        newContent,
        authorId,
        'manual-save',
        undefined
      );
      expect(document.version).toBe(2);
      expect(document.content).toBe(newContent);
    });

    it('should not increment version when content unchanged (auto-save)', async () => {
      const documentId = 'doc-1';
      const authorId = 'user-1';
      const content = 'Same content';

      // Mock getDocumentById
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: documentId,
          project_id: 'project-1',
          title: 'Test Document',
          content: content + ' ', // Slightly different to trigger version check
          metadata: { type: 'standalone', order: 0 },
          version: 1,
          author_id: authorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock version creation returns null (no change detected by version service)
      mockVersionService.createVersion.mockResolvedValue(null);

      // Mock document update
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: documentId,
          project_id: 'project-1',
          title: 'Test Document',
          content,
          metadata: { type: 'standalone', order: 0 },
          version: 1, // Version not incremented
          author_id: authorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const document = await documentService.updateDocument(
        documentId,
        { content },
        authorId,
        'auto-save'
      );

      expect(mockVersionService.createVersion).toHaveBeenCalled();
      expect(document.version).toBe(1); // Version not incremented
    });

    it('should always create version for ai-action', async () => {
      const documentId = 'doc-1';
      const authorId = 'user-1';
      const oldContent = 'Original';
      const newContent = 'Improved by AI';

      // Mock getDocumentById
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: documentId,
          project_id: 'project-1',
          title: 'Test Document',
          content: oldContent,
          metadata: { type: 'standalone', order: 0 },
          version: 1,
          author_id: authorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock version creation
      mockVersionService.createVersion.mockResolvedValue({
        id: 'version-2',
        documentId,
        versionNumber: 2,
        isSnapshot: false,
        changeType: 'ai-action',
      });

      // Mock document update
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: documentId,
          project_id: 'project-1',
          title: 'Test Document',
          content: newContent,
          metadata: { type: 'standalone', order: 0 },
          version: 2,
          author_id: authorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const document = await documentService.updateDocument(
        documentId,
        { content: newContent },
        authorId,
        'ai-action',
        'AI improved the text'
      );

      expect(mockVersionService.createVersion).toHaveBeenCalledWith(
        documentId,
        newContent,
        authorId,
        'ai-action',
        'AI improved the text'
      );
      expect(document.version).toBe(2);
    });

    it('should not create version when only title changes', async () => {
      const documentId = 'doc-1';
      const authorId = 'user-1';

      // Mock getDocumentById
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: documentId,
          project_id: 'project-1',
          title: 'Old Title',
          content: 'Content',
          metadata: { type: 'standalone', order: 0 },
          version: 1,
          author_id: authorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock document update
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: documentId,
          project_id: 'project-1',
          title: 'New Title',
          content: 'Content',
          metadata: { type: 'standalone', order: 0 },
          version: 1, // Version unchanged
          author_id: authorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const document = await documentService.updateDocument(
        documentId,
        { title: 'New Title' },
        authorId,
        'manual-save'
      );

      expect(mockVersionService.createVersion).not.toHaveBeenCalled();
      expect(document.version).toBe(1);
      expect(document.title).toBe('New Title');
    });
  });
});

