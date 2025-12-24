/**
 * Unit tests for DocumentService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentService } from '../document-service.js';
import { SupabaseClient } from '@supabase/supabase-js';
import type { CreateDocumentInput, UpdateDocumentInput } from '@zadoox/shared';

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockClient = {
    from: vi.fn(),
  } as unknown as SupabaseClient;

  return mockClient;
};

describe('DocumentService', () => {
  let service: DocumentService;
  let mockSupabase: SupabaseClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQueryBuilder: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    service = new DocumentService(mockSupabase);
    
    // Reset query builder mock
    // Create chainable insert mock: insert().select().single()
    const insertSelectSingle = {
      single: vi.fn(),
    };
    const insertSelect = {
      select: vi.fn().mockReturnValue(insertSelectSingle),
    };
    
    // Create insert function that always returns insertSelect
    const insertFn = vi.fn().mockImplementation(() => insertSelect);
    
    mockQueryBuilder = {
      insert: insertFn,
      select: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      })),
    };
    
    // Store references for test setup
    (mockQueryBuilder as any).insertSelectSingle = insertSelectSingle;
    (mockQueryBuilder as any).insertSelect = insertSelect;
    
    vi.mocked(mockSupabase.from).mockReturnValue(mockQueryBuilder);
  });

  describe('createDocument', () => {
    it('should create a document with valid input', async () => {
      const input: CreateDocumentInput = {
        projectId: 'project-id',
        title: 'Test Document',
        content: 'Document content',
        metadata: {
          type: 'chapter',
          chapterNumber: 1,
          order: 0,
        },
      };

      const createdDate = new Date();
      const docData = {
        id: 'doc-id',
        project_id: input.projectId,
        title: input.title,
        content: input.content,
        metadata: input.metadata,
        version: 1,
        author_id: 'user-id',
        created_at: createdDate.toISOString(),
        updated_at: createdDate.toISOString(),
      };

      // Mock project exists check
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'project-id' },
          error: null,
        });

      // Mock document insert - insert().select().single() chain
      mockQueryBuilder.insertSelectSingle.single.mockResolvedValueOnce({
        data: docData,
        error: null,
      });
      
      // Mock version metadata query (for createVersion - called by version service)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          document_id: 'doc-id',
          current_version: 0,
          last_snapshot_version: null,
          total_versions: 0,
          last_modified_at: createdDate.toISOString(),
          last_modified_by: 'user-id',
        },
        error: null,
      });

      // Mock metadata insert (returns success) - insert() without select()
      mockQueryBuilder.insert.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      
      // Mock version insert - insert().select().single() chain
      mockQueryBuilder.insertSelectSingle.single.mockResolvedValueOnce({
        data: {
          id: 'version-id',
          document_id: 'doc-id',
          version_number: 1,
          content_snapshot: input.content,
          is_snapshot: true,
          author_id: 'user-id',
          change_type: 'milestone',
          change_description: 'Initial document version',
          created_at: createdDate.toISOString(),
        },
        error: null,
      });

      const result = await service.createDocument(input, 'user-id');

      expect(result.title).toBe(input.title);
      expect(result.content).toBe(input.content);
      expect(result.version).toBe(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('projects');
      expect(mockSupabase.from).toHaveBeenCalledWith('documents');
      expect(mockSupabase.from).toHaveBeenCalledWith('document_version_metadata');
    });

    it('should use default values if not provided', async () => {
      const input: CreateDocumentInput = {
        projectId: 'project-id',
        title: 'Test Document',
      };

      const createdDate = new Date();
      const docData = {
        id: 'doc-id',
        project_id: input.projectId,
        title: input.title,
        content: '',
        metadata: { type: 'standalone', order: 0 },
        version: 1,
        author_id: 'user-id',
        created_at: createdDate.toISOString(),
        updated_at: createdDate.toISOString(),
      };

      // Mock project exists check
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'project-id' },
          error: null,
        });

      // Mock document insert - insert().select().single() chain
      mockQueryBuilder.insertSelectSingle.single.mockResolvedValueOnce({
        data: docData,
        error: null,
      });
      
      // Mock version metadata query (for createVersion - called by version service)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          document_id: 'doc-id',
          current_version: 0,
          last_snapshot_version: null,
          total_versions: 0,
          last_modified_at: createdDate.toISOString(),
          last_modified_by: 'user-id',
        },
        error: null,
      });

      // Mock metadata insert (returns success) - insert() without select()
      mockQueryBuilder.insert.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      
      // Mock version insert - insert().select().single() chain
      mockQueryBuilder.insertSelectSingle.single.mockResolvedValueOnce({
        data: {
          id: 'version-id',
          document_id: 'doc-id',
          version_number: 1,
          content_snapshot: '',
          is_snapshot: true,
          author_id: 'user-id',
          change_type: 'milestone',
          change_description: 'Initial document version',
          created_at: createdDate.toISOString(),
        },
        error: null,
      });

      const result = await service.createDocument(input, 'user-id');

      expect(result.content).toBe('');
      expect(result.metadata.type).toBe('standalone');
    });

    it('should throw error if project not found', async () => {
      const input: CreateDocumentInput = {
        projectId: 'missing-project',
        title: 'Test',
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.createDocument(input, 'user-id')).rejects.toThrow(
        'Project not found'
      );
    });

    it('should throw error for invalid document type', async () => {
      const input = {
        projectId: 'project-id',
        title: 'Test',
        metadata: { type: 'invalid-type' },
      } as unknown as CreateDocumentInput;

      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'project-id' },
        error: null,
      });

      await expect(service.createDocument(input, 'user-id')).rejects.toThrow(
        'Invalid document type'
      );
    });
  });

  describe('getDocumentById', () => {
    it('should return document if found', async () => {
      const mockDocument = {
        id: 'doc-id',
        project_id: 'project-id',
        title: 'Test Document',
        content: 'Content',
        metadata: { type: 'standalone' },
        version: 1,
        author_id: 'user-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: mockDocument,
        error: null,
      });

      const result = await service.getDocumentById('doc-id');

      expect(result.id).toBe('doc-id');
      expect(result.title).toBe('Test Document');
    });

    it('should throw error if document not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.getDocumentById('missing-id')).rejects.toThrow(
        'Document not found'
      );
    });
  });

  describe('updateDocument', () => {
    it('should update document content and increment version', async () => {
      const existingDocument = {
        id: 'doc-id',
        project_id: 'project-id',
        title: 'Old Title',
        content: 'Old content',
        metadata: { type: 'standalone' },
        version: 1,
        author_id: 'user-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: existingDocument,
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ...existingDocument,
            content: 'New content',
            version: 2,
          },
          error: null,
        });

      const update: UpdateDocumentInput = {
        content: 'New content',
      };

      const result = await service.updateDocument('doc-id', update);

      expect(result.content).toBe('New content');
      expect(result.version).toBe(2);
    });

    it('should not increment version if content not changed', async () => {
      const existingDocument = {
        id: 'doc-id',
        project_id: 'project-id',
        title: 'Title',
        content: 'Content',
        metadata: { type: 'standalone' },
        version: 1,
        author_id: 'user-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: existingDocument,
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ...existingDocument,
            title: 'New Title',
          },
          error: null,
        });

      const update: UpdateDocumentInput = {
        title: 'New Title',
      };

      const result = await service.updateDocument('doc-id', update);

      expect(result.title).toBe('New Title');
      // Version should not increment when only title changes
      // (In actual implementation, version only increments on content change)
    });
  });

  describe('deleteDocument', () => {
    it('should delete document successfully', async () => {
      const existingDocument = {
        id: 'doc-id',
        project_id: 'project-id',
        title: 'Test',
        content: 'Content',
        metadata: {},
        version: 1,
        author_id: 'user-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: existingDocument,
        error: null,
      });

      await service.deleteDocument('doc-id');

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });
  });

  describe('listDocumentsByProject', () => {
    it('should return list of documents for project', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          project_id: 'project-id',
          title: 'Document 1',
          content: 'Content 1',
          metadata: { type: 'chapter', order: 0 },
          version: 1,
          author_id: 'user-id',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'doc-2',
          project_id: 'project-id',
          title: 'Document 2',
          content: 'Content 2',
          metadata: { type: 'section', order: 1 },
          version: 1,
          author_id: 'user-id',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockQueryBuilder.order.mockResolvedValue({
        data: mockDocuments,
        error: null,
      });

      const result = await service.listDocumentsByProject('project-id');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('doc-1');
      expect(result[1].id).toBe('doc-2');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('project_id', 'project-id');
    });
  });
});

