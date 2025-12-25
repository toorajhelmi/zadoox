/**
 * Version Service Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VersionService } from '../version-service.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockClient = {
    from: vi.fn(),
  } as unknown as SupabaseClient;

  return mockClient;
};

describe('VersionService', () => {
  let versionService: VersionService;
  let mockSupabase: SupabaseClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQueryBuilder: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    versionService = new VersionService(mockSupabase);
    
    // Reset query builder mock
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    };
    
    vi.mocked(mockSupabase.from).mockReturnValue(mockQueryBuilder);
  });

  describe('createVersion', () => {
    it('should create a snapshot version when it is the first version', async () => {
      const documentId = 'doc-1';
      const content = 'Initial content';
      const authorId = 'user-1';

      // Mock metadata (first version)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          document_id: documentId,
          current_version: 0,
          last_snapshot_version: null,
          total_versions: 0,
          last_modified_at: new Date().toISOString(),
          last_modified_by: null,
        },
        error: null,
      });

      // Mock insert
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-1',
          document_id: documentId,
          version_number: 1,
          content_snapshot: content,
          content_delta: null,
          is_snapshot: true,
          snapshot_base_version: null,
          author_id: authorId,
          change_type: 'milestone',
          change_description: null,
          created_at: new Date().toISOString(),
          metadata: { wordCount: 2, characterCount: content.length },
        },
        error: null,
      });

      const version = await versionService.createVersion(
        documentId,
        content,
        authorId,
        'milestone',
        'Initial version'
      );

      expect(version).toBeTruthy();
      expect(version?.isSnapshot).toBe(true);
      expect(version?.contentSnapshot).toBe(content);
      expect(version?.versionNumber).toBe(1);
    });

    it('should create a delta version when content changed (auto-save)', async () => {
      const documentId = 'doc-1';
      const oldContent = 'Old content';
      const newContent = 'Old content updated';
      const authorId = 'user-1';

      // Mock metadata
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          document_id: documentId,
          current_version: 1,
          last_snapshot_version: 1,
          total_versions: 1,
          last_modified_at: new Date().toISOString(),
          last_modified_by: authorId,
        },
        error: null,
      });

      // Mock getVersion calls - need 3 calls total:
      // 1. reconstructVersion(documentId, 1) to check if content changed
      // 2. getVersion(documentId, 1) to get base version for delta calculation  
      // 3. reconstructVersion(documentId, 1) recursive call to get base content
      const version1Mock = {
        data: {
          id: 'version-1',
          document_id: documentId,
          version_number: 1,
          content_snapshot: oldContent,
          content_delta: null,
          is_snapshot: true,
          snapshot_base_version: null,
          author_id: authorId,
          change_type: 'milestone',
          created_at: new Date().toISOString(),
          metadata: {},
        },
        error: null,
      };
      
      mockQueryBuilder.single.mockResolvedValueOnce(version1Mock); // Call 1
      mockQueryBuilder.single.mockResolvedValueOnce(version1Mock); // Call 2
      mockQueryBuilder.single.mockResolvedValueOnce(version1Mock); // Call 3

      // Mock insert (new delta version)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-2',
          document_id: documentId,
          version_number: 2,
          content_snapshot: null,
          content_delta: JSON.stringify({
            operations: [{ type: 'insert', position: 12, text: ' updated' }],
            baseVersion: 1,
          }),
          is_snapshot: false,
          snapshot_base_version: 1,
          author_id: authorId,
          change_type: 'auto-save',
          change_description: null,
          created_at: new Date().toISOString(),
          metadata: { wordCount: 3, characterCount: newContent.length },
        },
        error: null,
      });

      const version = await versionService.createVersion(
        documentId,
        newContent,
        authorId,
        'auto-save'
      );

      expect(version).toBeTruthy();
      expect(version?.isSnapshot).toBe(false);
      expect(version?.contentDelta).toBeTruthy();
      expect(version?.snapshotBaseVersion).toBe(1);
      expect(version?.versionNumber).toBe(2);
    });

    it('should return null for auto-save when content has not changed', async () => {
      const documentId = 'doc-1';
      const content = 'Same content';
      const authorId = 'user-1';

      // Mock metadata
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          document_id: documentId,
          current_version: 1,
          last_snapshot_version: 1,
          total_versions: 1,
          last_modified_at: new Date().toISOString(),
          last_modified_by: authorId,
        },
        error: null,
      });

      // Mock getVersion (current version) - called by reconstructVersion
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-1',
          document_id: documentId,
          version_number: 1,
          content_snapshot: content,
          content_delta: null,
          is_snapshot: true,
          snapshot_base_version: null,
          author_id: authorId,
          change_type: 'milestone',
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const version = await versionService.createVersion(
        documentId,
        content,
        authorId,
        'auto-save'
      );

      expect(version).toBeNull();
    });

    it('should always create version for ai-action even if content appears same', async () => {
      const documentId = 'doc-1';
      const content = 'Content';
      const authorId = 'user-1';

      // Mock metadata
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          document_id: documentId,
          current_version: 1,
          last_snapshot_version: 1,
          total_versions: 1,
          last_modified_at: new Date().toISOString(),
          last_modified_by: authorId,
        },
        error: null,
      });

      // Mock getVersion calls in order:
      // 1. getVersion(documentId, 1) to get base version for delta calculation
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-1',
          document_id: documentId,
          version_number: 1,
          content_snapshot: content,
          content_delta: null,
          is_snapshot: true,
          snapshot_base_version: null,
          author_id: authorId,
          change_type: 'milestone',
          created_at: new Date().toISOString(),
          metadata: {},
        },
        error: null,
      });

      // 2. reconstructVersion(documentId, 1) to get base content (recursive)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-1',
          document_id: documentId,
          version_number: 1,
          content_snapshot: content,
          content_delta: null,
          is_snapshot: true,
          snapshot_base_version: null,
          author_id: authorId,
          change_type: 'milestone',
          created_at: new Date().toISOString(),
          metadata: {},
        },
        error: null,
      });

      // Mock insert
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-2',
          document_id: documentId,
          version_number: 2,
          content_snapshot: null,
          content_delta: JSON.stringify({ operations: [], baseVersion: 1 }),
          is_snapshot: false,
          snapshot_base_version: 1,
          author_id: authorId,
          change_type: 'ai-action',
          change_description: 'AI improved text',
          created_at: new Date().toISOString(),
          metadata: {},
        },
        error: null,
      });

      const version = await versionService.createVersion(
        documentId,
        content,
        authorId,
        'ai-action',
        'AI improved text'
      );

      expect(version).toBeTruthy();
      expect(version?.changeType).toBe('ai-action');
    });

    it('should create snapshot every 10 versions', async () => {
      const documentId = 'doc-1';
      const oldContent = 'Version 9 content';
      const newContent = 'Version 10 content';
      const authorId = 'user-1';

      // Mock metadata (version 9, next will be 10)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          document_id: documentId,
          current_version: 9,
          last_snapshot_version: 1,
          total_versions: 9,
          last_modified_at: new Date().toISOString(),
          last_modified_by: authorId,
        },
        error: null,
      });

      // Mock getVersion (for reconstructVersion to check current content) - version 9
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-9',
          document_id: documentId,
          version_number: 9,
          content_snapshot: null,
          content_delta: JSON.stringify({ operations: [], baseVersion: 1 }),
          is_snapshot: false,
          snapshot_base_version: 1,
          author_id: authorId,
          change_type: 'auto-save',
          created_at: new Date().toISOString(),
          metadata: {},
        },
        error: null,
      });

      // Mock listVersions (for reconstructVersion to get all versions from base to 9)
      mockQueryBuilder.range.mockResolvedValueOnce({
        data: [
          {
            id: 'version-9',
            document_id: documentId,
            version_number: 9,
            content_snapshot: null,
            content_delta: JSON.stringify({ operations: [], baseVersion: 1 }),
            is_snapshot: false,
            snapshot_base_version: 1,
          },
          {
            id: 'version-1',
            document_id: documentId,
            version_number: 1,
            content_snapshot: oldContent,
            is_snapshot: true,
          },
        ],
        error: null,
      });

      // Mock getVersion for base snapshot (recursive call in reconstructVersion) - version 1
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-1',
          document_id: documentId,
          version_number: 1,
          content_snapshot: oldContent,
          content_delta: null,
          is_snapshot: true,
          snapshot_base_version: null,
          author_id: authorId,
          change_type: 'milestone',
          created_at: new Date().toISOString(),
          metadata: {},
        },
        error: null,
      });

      // Note: Since we're creating a snapshot (version 10), the else branch (delta creation) is not taken
      // So we don't need to mock getVersion for base version lookup or reconstructVersion for delta calculation

      // Mock insert (snapshot at version 10)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-10',
          document_id: documentId,
          version_number: 10,
          content_snapshot: newContent,
          content_delta: null,
          is_snapshot: true,
          snapshot_base_version: null,
          author_id: authorId,
          change_type: 'auto-save',
          created_at: new Date().toISOString(),
          metadata: {},
        },
        error: null,
      });

      const version = await versionService.createVersion(
        documentId,
        newContent,
        authorId,
        'auto-save'
      );

      expect(version).toBeTruthy();
      expect(version?.isSnapshot).toBe(true);
      expect(version?.versionNumber).toBe(10);
    });
  });

  describe('getVersion', () => {
    it('should return version when found', async () => {
      const documentId = 'doc-1';
      const versionNumber = 1;

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-1',
          document_id: documentId,
          version_number: versionNumber,
          content_snapshot: 'Content',
          content_delta: null,
          is_snapshot: true,
          snapshot_base_version: null,
          author_id: 'user-1',
          change_type: 'milestone',
          change_description: null,
          created_at: new Date().toISOString(),
          metadata: {},
        },
        error: null,
      });

      const version = await versionService.getVersion(documentId, versionNumber);

      expect(version).toBeTruthy();
      expect(version?.versionNumber).toBe(versionNumber);
      expect(version?.documentId).toBe(documentId);
    });

    it('should return null when version not found', async () => {
      const documentId = 'doc-1';
      const versionNumber = 999;

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const version = await versionService.getVersion(documentId, versionNumber);

      expect(version).toBeNull();
    });
  });

  describe('listVersions', () => {
    it('should return list of versions', async () => {
      const documentId = 'doc-1';

      mockQueryBuilder.range.mockResolvedValueOnce({
        data: [
          {
            id: 'version-2',
            document_id: documentId,
            version_number: 2,
            content_snapshot: null,
            content_delta: JSON.stringify({ operations: [], baseVersion: 1 }),
            is_snapshot: false,
            snapshot_base_version: 1,
            author_id: 'user-1',
            change_type: 'auto-save',
            created_at: new Date().toISOString(),
            metadata: {},
          },
          {
            id: 'version-1',
            document_id: documentId,
            version_number: 1,
            content_snapshot: 'Content',
            content_delta: null,
            is_snapshot: true,
            snapshot_base_version: null,
            author_id: 'user-1',
            change_type: 'milestone',
            created_at: new Date().toISOString(),
            metadata: {},
          },
        ],
        error: null,
      });

      const versions = await versionService.listVersions(documentId, 50, 0);

      expect(versions).toHaveLength(2);
      expect(versions[0].versionNumber).toBe(2); // Should be sorted descending
      expect(versions[1].versionNumber).toBe(1);
    });
  });

  describe('reconstructVersion', () => {
    it('should return snapshot content directly', async () => {
      const documentId = 'doc-1';
      const versionNumber = 1;
      const content = 'Snapshot content';

      // Mock getVersion
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-1',
          document_id: documentId,
          version_number: versionNumber,
          content_snapshot: content,
          content_delta: null,
          is_snapshot: true,
          snapshot_base_version: null,
          author_id: 'user-1',
          change_type: 'milestone',
          created_at: new Date().toISOString(),
          metadata: {},
        },
        error: null,
      });

      const reconstructed = await versionService.reconstructVersion(documentId, versionNumber);

      expect(reconstructed).toBe(content);
    });

    it('should reconstruct content from snapshot and deltas', async () => {
      const documentId = 'doc-1';
      const snapshotContent = 'Base content';
      const finalContent = 'Base content updated';

      // Mock getVersion (target version - delta)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-2',
          document_id: documentId,
          version_number: 2,
          content_snapshot: null,
          content_delta: JSON.stringify({
            operations: [{ type: 'insert', position: 12, text: ' updated' }],
            baseVersion: 1,
          }),
          is_snapshot: false,
          snapshot_base_version: 1,
          author_id: 'user-1',
          change_type: 'auto-save',
          created_at: new Date().toISOString(),
          metadata: {},
        },
        error: null,
      });

      // Mock listVersions (to get all versions between base and target)
      mockQueryBuilder.range.mockResolvedValueOnce({
        data: [
          {
            id: 'version-2',
            document_id: documentId,
            version_number: 2,
            content_snapshot: null,
            content_delta: JSON.stringify({
              operations: [{ type: 'insert', position: 12, text: ' updated' }],
              baseVersion: 1,
            }),
            is_snapshot: false,
            snapshot_base_version: 1,
          },
          {
            id: 'version-1',
            document_id: documentId,
            version_number: 1,
            content_snapshot: snapshotContent,
            is_snapshot: true,
          },
        ],
        error: null,
      });

      // Mock getVersion for base snapshot (recursive call)
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'version-1',
          document_id: documentId,
          version_number: 1,
          content_snapshot: snapshotContent,
          is_snapshot: true,
          snapshot_base_version: null,
          author_id: 'user-1',
          change_type: 'milestone',
          created_at: new Date().toISOString(),
          metadata: {},
        },
        error: null,
      });

      const reconstructed = await versionService.reconstructVersion(documentId, 2);

      expect(reconstructed).toBe(finalContent);
    });
  });

  describe('getVersionMetadata', () => {
    it('should return version metadata', async () => {
      const documentId = 'doc-1';

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          document_id: documentId,
          current_version: 5,
          last_snapshot_version: 1,
          total_versions: 5,
          last_modified_at: new Date().toISOString(),
          last_modified_by: 'user-1',
        },
        error: null,
      });

      const metadata = await versionService.getVersionMetadata(documentId);

      expect(metadata).toBeTruthy();
      expect(metadata?.currentVersion).toBe(5);
      expect(metadata?.totalVersions).toBe(5);
      expect(metadata?.lastSnapshotVersion).toBe(1);
    });

    it('should return null when metadata not found', async () => {
      const documentId = 'doc-1';

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const metadata = await versionService.getVersionMetadata(documentId);

      expect(metadata).toBeNull();
    });
  });
});
