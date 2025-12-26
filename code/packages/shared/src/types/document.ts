/**
 * Document types
 * Core document types for MVP
 */

export type DocumentType = 'chapter' | 'section' | 'standalone';

export interface Document {
  id: string;
  projectId: string;
  title: string;
  content: string; // Extended Markdown format
  metadata: DocumentMetadata;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
}

export type ParagraphMode = 'write' | 'think';

export interface DocumentMetadata {
  chapterNumber?: number;
  type: DocumentType;
  order?: number;
  paragraphModes?: Record<string, ParagraphMode>; // paragraphId -> mode mapping
}

export interface CreateDocumentInput {
  projectId: string;
  title: string;
  content?: string;
  metadata?: Partial<DocumentMetadata>;
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  metadata?: Partial<DocumentMetadata>;
  changeType?: 'manual-save' | 'auto-save' | 'ai-action' | 'milestone' | 'rollback';
  changeDescription?: string;
}

// For MVP, we'll keep it simple and not include codeLinks or metaContentLinks





