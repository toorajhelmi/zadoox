/**
 * Document Version Service
 * Handles delta-based document versioning
 */

import { SupabaseClient } from '@supabase/supabase-js';
import DiffMatchPatch from 'diff-match-patch';
import type {
  DocumentVersion,
  VersionDelta,
  DeltaOperation,
  VersionMetadata,
  VersionChangeType,
} from '@zadoox/shared';

const SNAPSHOT_INTERVAL = 10; // Create snapshot every 10 versions

export class VersionService {
  private dmp: DiffMatchPatch;

  constructor(private supabase: SupabaseClient) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    this.dmp = new (DiffMatchPatch as any)();
  }

  /**
   * Create a new version for a document
   * Only creates a version if content has actually changed (for manual-save and auto-save)
   */
  async createVersion(
    documentId: string,
    newContent: string,
    authorId: string,
    changeType: VersionChangeType = 'auto-save',
    changeDescription?: string,
    forceSnapshot = false
  ): Promise<DocumentVersion | null> {
    // Get current version metadata
    let metadata = await this.getVersionMetadata(documentId);
    
    // If metadata doesn't exist (e.g., first version for new document), initialize it
    // This is part of the normal flow for initial versions, not a workaround
    if (!metadata) {
      // Verify document exists
      const { data: docData, error: docError } = await this.supabase
        .from('documents')
        .select('id, version, author_id, updated_at')
        .eq('id', documentId)
        .single();
      
      if (docError || !docData) {
      throw new Error(`Document ${documentId} not found`);
      }
      
      // Initialize version metadata for first version
      const { error: metaError } = await this.supabase
        .from('document_version_metadata')
        .insert({
          document_id: documentId,
          current_version: 0, // Will be updated to 1 when version is created
          last_snapshot_version: null,
          total_versions: 0,
          last_modified_at: docData.updated_at || new Date().toISOString(),
          last_modified_by: docData.author_id || authorId,
        });
      
      if (metaError) {
        throw new Error(`Failed to initialize version metadata: ${metaError.message}`);
      }
      
      // Fetch the newly created metadata
      metadata = await this.getVersionMetadata(documentId);
      if (!metadata) {
        throw new Error(`Failed to retrieve initialized version metadata for document ${documentId}`);
      }
    }

    // For manual-save and auto-save, check if content actually changed
    if (changeType === 'manual-save' || changeType === 'auto-save') {
      let currentContent: string;
      try {
        // Try to reconstruct current version
        currentContent = await this.reconstructVersion(documentId, metadata.currentVersion);
      } catch (error) {
        // If reconstruction fails (e.g., no versions exist yet), get content from document table
        const { data: docData, error: docError } = await this.supabase
          .from('documents')
          .select('content')
          .eq('id', documentId)
          .single();
        
        if (docError || !docData) {
          throw new Error(`Failed to get document content: ${docError?.message || 'Document not found'}`);
        }
        
        currentContent = docData.content || '';
      }
      
      if (currentContent === newContent) {
        // No change - don't create a version
        return null;
      }
    }

    const newVersionNumber = metadata.currentVersion + 1;
    const shouldCreateSnapshot =
      forceSnapshot ||
      newVersionNumber % SNAPSHOT_INTERVAL === 0 ||
      metadata.lastSnapshotVersion === null;

    let contentSnapshot: string | null = null;
    let contentDelta: VersionDelta | null = null;
    let snapshotBaseVersion: number | null = null;

    if (shouldCreateSnapshot) {
      // Create full snapshot
      contentSnapshot = newContent;
    } else {
      // Create delta from last snapshot or previous version
      const baseVersion = await this.getVersion(documentId, metadata.lastSnapshotVersion || metadata.currentVersion);
      if (!baseVersion) {
        throw new Error(`Base version not found for document ${documentId}`);
      }

      const baseContent = await this.reconstructVersion(documentId, baseVersion.versionNumber);
      const delta = this.calculateDelta(baseContent, newContent);
      delta.baseVersion = baseVersion.versionNumber; // Set the base version
      contentDelta = delta;
      snapshotBaseVersion = baseVersion.versionNumber;
    }

    // Insert new version
    const { data, error } = await this.supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: newVersionNumber,
        content_snapshot: contentSnapshot,
        content_delta: contentDelta ? JSON.stringify(contentDelta) : null,
        is_snapshot: shouldCreateSnapshot,
        snapshot_base_version: snapshotBaseVersion,
        author_id: authorId,
        change_type: changeType,
        change_description: changeDescription || null,
        metadata: {
          wordCount: this.countWords(newContent),
          characterCount: newContent.length,
        },
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create version: ${error.message}`);
    }

    return this.mapDbVersionToVersion(data);
  }

  /**
   * Get a specific version
   */
  async getVersion(documentId: string, versionNumber: number): Promise<DocumentVersion | null> {
    const { data, error } = await this.supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .eq('version_number', versionNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get version: ${error.message}`);
    }

    return this.mapDbVersionToVersion(data);
  }

  /**
   * List versions for a document
   */
  async listVersions(documentId: string, limit = 50, offset = 0): Promise<DocumentVersion[]> {
    const { data, error } = await this.supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to list versions: ${error.message}`);
    }

    return data.map((v) => this.mapDbVersionToVersion(v));
  }

  /**
   * Get version metadata
   */
  async getVersionMetadata(documentId: string): Promise<VersionMetadata | null> {
    const { data, error } = await this.supabase
      .from('document_version_metadata')
      .select('*')
      .eq('document_id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get version metadata: ${error.message}`);
    }

    return {
      documentId: data.document_id,
      currentVersion: data.current_version,
      lastSnapshotVersion: data.last_snapshot_version,
      totalVersions: data.total_versions,
      lastModifiedAt: new Date(data.last_modified_at),
      lastModifiedBy: data.last_modified_by,
    };
  }

  /**
   * Reconstruct content for a specific version
   */
  async reconstructVersion(documentId: string, versionNumber: number): Promise<string> {
    const version = await this.getVersion(documentId, versionNumber);
    if (!version) {
      throw new Error(`Version ${versionNumber} not found for document ${documentId}`);
    }

    // If it's a snapshot, return it directly
    if (version.isSnapshot && version.contentSnapshot) {
      return version.contentSnapshot;
    }

    // Otherwise, reconstruct from base snapshot + deltas
    if (!version.snapshotBaseVersion || !version.contentDelta) {
      throw new Error(`Invalid version data for version ${versionNumber}`);
    }

    // Get base snapshot
    const baseContent = await this.reconstructVersion(documentId, version.snapshotBaseVersion);

    // Apply all deltas from base to target version
    const versions = await this.listVersions(documentId, 1000, 0);
    const relevantVersions = versions
      .filter(
        (v) =>
          v.versionNumber > version.snapshotBaseVersion! &&
          v.versionNumber <= versionNumber &&
          !v.isSnapshot
      )
      .sort((a, b) => a.versionNumber - b.versionNumber);

    let content = baseContent;
    for (const v of relevantVersions) {
      if (v.contentDelta) {
        content = this.applyDelta(content, v.contentDelta);
      }
    }

    return content;
  }

  /**
   * Calculate delta between two content strings
   */
  private calculateDelta(oldContent: string, newContent: string): VersionDelta {
    // Use diff-match-patch to calculate diffs
    const diffs = this.dmp.diff_main(oldContent, newContent);
    this.dmp.diff_cleanupSemantic(diffs);

    // Convert diffs to operations
    // diff-match-patch returns: -1 = delete, 0 = equal, 1 = insert
    const operations: DeltaOperation[] = [];
    let oldPosition = 0;
    let newPosition = 0;

    for (const [operation, text] of diffs) {
      if (operation === 0) {
        // Equal - no change, advance both positions
        oldPosition += text.length;
        newPosition += text.length;
      } else if (operation === -1) {
        // Delete from old content
        operations.push({
          type: 'delete',
          position: oldPosition,
          length: text.length,
        });
        oldPosition += text.length;
        // newPosition stays the same
      } else if (operation === 1) {
        // Insert into new content
        // Position should be in OLD content where to insert, not new content
        operations.push({
          type: 'insert',
          position: oldPosition,
          text,
        });
        newPosition += text.length;
        // oldPosition stays the same (insert doesn't advance old position)
      }
    }

    return {
      operations,
      baseVersion: 0, // Will be set by caller
    };
  }

  /**
   * Apply delta operations to content
   * Operations must be applied in order, adjusting positions as we go
   */
  private applyDelta(content: string, delta: VersionDelta): string {
    let result = content;
    // Sort operations by position (ascending) to apply in order
    const sortedOps = [...delta.operations].sort((a, b) => a.position - b.position);
    let offset = 0; // Track position offset from inserts/deletes

    for (const op of sortedOps) {
      const adjustedPosition = op.position + offset;

      if (op.type === 'insert' && op.text) {
        result = result.slice(0, adjustedPosition) + op.text + result.slice(adjustedPosition);
        offset += op.text.length; // Inserts shift subsequent positions forward
      } else if (op.type === 'delete' && op.length) {
        result = result.slice(0, adjustedPosition) + result.slice(adjustedPosition + op.length);
        offset -= op.length; // Deletes shift subsequent positions backward
      } else if (op.type === 'replace' && op.text && op.length) {
        result =
          result.slice(0, adjustedPosition) + op.text + result.slice(adjustedPosition + op.length);
        offset += op.text.length - op.length; // Net change in length
      }
    }

    return result;
  }

  /**
   * Count words in content
   */
  private countWords(content: string): number {
    return content.trim().split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Map database version to DocumentVersion type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapDbVersionToVersion(data: any): DocumentVersion {
    return {
      id: data.id,
      documentId: data.document_id,
      versionNumber: data.version_number,
      contentSnapshot: data.content_snapshot,
      contentDelta: data.content_delta ? JSON.parse(data.content_delta) : undefined,
      isSnapshot: data.is_snapshot,
      snapshotBaseVersion: data.snapshot_base_version,
      authorId: data.author_id,
      createdAt: new Date(data.created_at),
      changeDescription: data.change_description,
      changeType: data.change_type,
      metadata: data.metadata,
    };
  }
}

