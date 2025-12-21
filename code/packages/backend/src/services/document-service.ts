/**
 * Document Service
 * Handles business logic for document operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Document,
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentType,
} from '@zadoox/shared';
import { isValidDocumentType } from '@zadoox/shared';
import { generateId } from '@zadoox/shared';

export class DocumentService {
  constructor(private supabase: SupabaseClient) {}

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

    return this.mapDbDocumentToDocument(data);
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
    input: UpdateDocumentInput
  ): Promise<Document> {
    // Get existing document to check access (via RLS) and get current version
    const existing = await this.getDocumentById(documentId);

    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.content !== undefined) {
      updateData.content = input.content;
      updateData.version = existing.version + 1; // Increment version on content change
    }
    if (input.metadata !== undefined) {
      // Merge with existing metadata
      updateData.metadata = {
        ...existing.metadata,
        ...input.metadata,
      };
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
  private mapDbDocumentToDocument(dbDocument: any): Document {
    return {
      id: dbDocument.id,
      projectId: dbDocument.project_id,
      title: dbDocument.title,
      content: dbDocument.content,
      metadata: dbDocument.metadata,
      version: dbDocument.version,
      createdAt: new Date(dbDocument.created_at),
      updatedAt: new Date(dbDocument.updated_at),
      authorId: dbDocument.author_id,
    };
  }
}

