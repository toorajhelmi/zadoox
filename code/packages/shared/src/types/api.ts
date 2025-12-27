/**
 * API request and response types
 */

// Common API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Document API types
export interface GetDocumentsParams extends PaginationParams {
  projectId: string;
}

// Export API types
export type ExportFormat = 'latex' | 'pdf' | 'markdown';

export interface ExportRequest {
  documentId: string;
  format: ExportFormat;
  options?: ExportOptions;
}

export interface ExportOptions {
  includeMetadata?: boolean;
  templateId?: string;
}

export interface ExportResponse {
  downloadUrl: string;
  format: ExportFormat;
  filename: string;
}

// AI API types
export interface AISuggestRequest {
  text: string;
  context?: string;
  type: 'completion' | 'expand' | 'improve';
  model?: AIModel;
}

export interface AISuggestResponse {
  suggestion: string;
  alternatives?: string[];
  model?: string; // Model used for suggestion
}

// AI Model Info
export interface AIModelInfo {
  id: string;
  name: string;
  provider: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
}

// AI Model types
export type AIModel = 'openai' | 'auto';

// AI Analysis types
export interface AIAnalysisRequest {
  text: string;
  context?: string;
  model?: AIModel;
}

export interface AIAnalysisResponse {
  quality: number; // 0-100
  sentiment: 'positive' | 'neutral' | 'negative';
  wordiness: number; // 0-100 (higher = more wordy)
  clarity: number; // 0-100 (higher = clearer)
  suggestions?: AISuggestion[];
  model?: string; // Model used for analysis
}

export interface AISuggestion {
  type: 'error' | 'warning' | 'suggestion';
  text: string;
  position?: {
    from: number;
    to: number;
  };
  message: string;
  replacement?: string;
}

// AI Action types
export type AIActionType = 'improve' | 'expand' | 'clarify' | 'condense' | 'formalize' | 'casualize';

export interface AIActionRequest {
  text: string;
  action: AIActionType;
  context?: string;
  model?: AIModel;
}

export interface AIActionResponse {
  result: string;
  explanation?: string;
  model?: string; // Model used for action
}

// Citation Research types
export interface CitationResearchRequest {
  text: string;
  documentId?: string;
  projectId?: string;
  style?: 'academic' | 'industrial';
  searchOnline?: boolean;
  searchKnowledgeBase?: boolean;
}

export interface CitationSuggestion {
  id: string;
  title: string;
  author?: string;
  source: 'online' | 'knowledge_base' | 'uploaded';
  relevance: number; // 0-100
  summary: string;
  url?: string;
  documentId?: string;
  citationFormat?: string; // Formatted citation (APA, MLA, etc.)
}

export interface CitationResearchResponse {
  suggestions: CitationSuggestion[];
  query: string;
}

// Brainstorm API types
export interface BrainstormChatRequest {
  paragraphId: string;
  message: string;
  context: {
    blockContent: string;
    sectionHeading?: string;
    sectionContent?: string;
  };
  chatHistory?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  existingIdeaCards?: Array<{
    id: string;
    topic: string;
    description: string;
    sourceMessageId: string;
    createdAt: string;
  }>;
  model?: AIModel;
}

export interface BrainstormChatResponse {
  response: string;
  extractedIdeas?: Array<{
    topic: string;
    description: string;
  }>;
}

export interface BrainstormGenerateRequest {
  paragraphId: string;
  ideaCard: {
    topic: string;
    description: string;
  };
  context: {
    blockContent: string;
    sectionHeading?: string;
    sectionContent?: string;
  };
  mode: 'blend' | 'replace';
  model?: AIModel;
}

export interface BrainstormGenerateResponse {
  content: string;
}


