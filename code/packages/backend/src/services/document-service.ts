/**
 * Document Service
 * Handles business logic for document operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Document,
  CreateDocumentInput,
  UpdateDocumentInput,
  VersionChangeType,
} from '@zadoox/shared';
import { isValidDocumentType } from '@zadoox/shared';
import { generateId } from '@zadoox/shared';
import { VersionService } from './version-service.js';

export class DocumentService {
  private versionService: VersionService;

  constructor(private supabase: SupabaseClient) {
    this.versionService = new VersionService(supabase);
  }

  /**
   * Create a new document
   */
  async createDocument(
    input: CreateDocumentInput,
    authorId: string
  ): Promise<Document> {
    // Verify project exists and user has access (via RLS)
    const { data: project, error: projectError } = await this.supabase
      .from('projects')
      .select('id')
      .eq('id', input.projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${input.projectId}`);
    }

    // Validate document type
    const docType = input.metadata?.type || 'standalone';
    if (!isValidDocumentType(docType)) {
      throw new Error(`Invalid document type: ${docType}`);
    }

    const documentData = {
      id: generateId(),
      project_id: input.projectId,
      title: input.title,
      content: input.content || '',
      metadata: {
        type: docType,
        chapterNumber: input.metadata?.chapterNumber || null,
        order: input.metadata?.order || 0,
      },
      semantic_graph: input.semanticGraph ?? null,
      version: 1,
      author_id: authorId,
    };

    const { data, error } = await this.supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create document: ${error.message}`);
    }

    const document = this.mapDbDocumentToDocument(data);

    // STRICT RULE: Always create initial version snapshot (even if content is empty)
    // This ensures data integrity and proper version history from the start
    // The database trigger will automatically create version metadata when version is inserted
        await this.versionService.createVersion(
          document.id,
      input.content || '',
          authorId,
          'milestone',
      'Initial document version',
      true // forceSnapshot = true for initial version
        );

    return document;
  }

  /**
   * Get a document by ID
   */
  async getDocumentById(documentId: string): Promise<Document> {
    const { data, error } = await this.supabase
      .from('documents')
      .select()
      .eq('id', documentId)
      .single();

    if (error || !data) {
      throw new Error(`Document not found: ${documentId}`);
    }

    return this.mapDbDocumentToDocument(data);
  }

  /**
   * Update a document
   */
  async updateDocument(
    documentId: string,
    input: UpdateDocumentInput,
    authorId?: string,
    changeType: VersionChangeType = 'auto-save',
    changeDescription?: string
  ): Promise<Document> {
    // Get existing document to check access (via RLS) and get current version
    const existing = await this.getDocumentById(documentId);

    const updateData: Partial<Record<string, unknown>> = {};
    if (input.title !== undefined) updateData.title = input.title;
    
    let newVersion = existing.version;
    const forceVersion = changeType === 'rollback';
    const contentChanged = input.content !== undefined && input.content !== existing.content;

    if (input.content !== undefined && (contentChanged || forceVersion)) {
      // Content changed - create version and increment version number
      // Version service will check if content actually changed for manual-save/auto-save
      if (authorId) {
        const version = await this.versionService.createVersion(
          documentId,
          input.content,
          authorId,
          changeType,
          changeDescription
        );
        // Only increment version if a new version was actually created
        // (manual-save and auto-save return null if content hasn't changed)
        if (version) {
          newVersion = existing.version + 1;
          updateData.version = newVersion;
        }
      } else {
        // No authorId - just increment version number (backward compatibility)
        newVersion = existing.version + 1;
        updateData.version = newVersion;
      }
      updateData.content = input.content;
    }
    
    if (input.metadata !== undefined) {
      // Merge with existing metadata
      updateData.metadata = {
        ...existing.metadata,
        ...input.metadata,
      };
    }

    if (input.semanticGraph !== undefined) {
      updateData.semantic_graph = input.semanticGraph;
    }

    const { data, error } = await this.supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update document: ${error.message}`);
    }

    return this.mapDbDocumentToDocument(data);
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    // Verify document exists (and user has access via RLS)
    await this.getDocumentById(documentId);

    const { error } = await this.supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * List documents by project
   */
  async listDocumentsByProject(projectId: string): Promise<Document[]> {
    const { data, error } = await this.supabase
      .from('documents')
      .select()
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list documents: ${error.message}`);
    }

    return (data || []).map((d) => this.mapDbDocumentToDocument(d));
  }

  /**
   * Map database document to Document type
   */
  private mapDbDocumentToDocument(dbDocument: Record<string, unknown>): Document {
    return {
      id: dbDocument.id as string,
      projectId: dbDocument.project_id as string,
      title: dbDocument.title as string,
      content: dbDocument.content as string,
      metadata: dbDocument.metadata as Document['metadata'],
      semanticGraph: (dbDocument.semantic_graph as Document['semanticGraph']) ?? null,
      version: dbDocument.version as number,
      createdAt: new Date(dbDocument.created_at as string),
      updatedAt: new Date(dbDocument.updated_at as string),
      authorId: dbDocument.author_id as string,
    };
  }
}

