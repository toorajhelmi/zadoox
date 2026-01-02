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
  brainstormingSessions?: Record<string, BrainstormingSession>; // paragraphId -> session mapping
  researchSessions?: Record<string, ResearchSession>; // paragraphId -> session mapping
  insertedSources?: ResearchSource[]; // All sources that have been inserted into the document
  /**
   * Phase 12: cached alternate representation + last edited format.
   * Stored in metadata so it round-trips through the existing document update API.
   */
  latex?: string;
  lastEditedFormat?: 'markdown' | 'latex';
  irHashAtLastSync?: string;
}

/**
 * Brainstorming session for a paragraph/section
 */
export interface BrainstormingSession {
  paragraphId: string; // e.g., "para-0" or "para-5"
  messages: ChatMessage[]; // Full chat history
  ideaCards: IdeaCard[]; // Auto-extracted significant ideas
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Chat message in a brainstorming session
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO date string
  ideaCardIds?: string[]; // Links to idea cards extracted from this message
}

/**
 * Idea card extracted from brainstorming conversation
 */
export interface IdeaCard {
  id: string;
  topic: string; // Short title/topic (e.g., "Focus on user benefits")
  description: string; // Expanded description/explanation
  sourceMessageId: string; // Which message generated this idea
  createdAt: string; // ISO date string
}

/**
 * Research session for a paragraph/section
 */
export interface ResearchSession {
  paragraphId: string; // e.g., "para-0" or "para-5"
  messages: ChatMessage[]; // Full chat history
  sources: ResearchSource[]; // Discovered sources
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Research source discovered during research session
 */
export interface ResearchSource {
  id: string;
  title: string;
  authors?: string[];
  venue?: string; // Journal, conference, website, etc.
  year?: number;
  url?: string;
  summary?: string; // AI-generated summary
  citation?: string; // Formatted citation based on project settings
  sourceType: 'academic' | 'web'; // Type of source
  relevanceScore?: number; // AI-assigned relevance score
  citationContext?: string; // 3-7 words from the block content that appear immediately before where the citation should be inserted
  createdAt: string; // ISO date string
  sourceMessageId: string; // Which message discovered this source
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





