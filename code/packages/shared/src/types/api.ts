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

export interface DraftTransformRequest {
  draftText: string;
  paragraphId: string;
  context: {
    blockContent: string;
    sectionHeading?: string;
    sectionContent?: string;
  };
  mode?: 'blend' | 'replace';
  model?: AIModel;
}

export interface DraftTransformResponse {
  content: string;
}

// Inline AI API types
export interface InlineGenerateRequest {
  prompt: string;
  context: {
    blockContent: string;
    sectionHeading?: string;
    sectionContent?: string;
  };
  mode?: 'blend' | 'replace' | 'extend';
  model?: AIModel;
}

export interface InlineGenerateResponse {
  content: string;
  model?: string;
}

export type InlineEditBlockKind =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'code'
  | 'blank'
  | 'other';

export interface InlineEditBlock {
  id: string;
  text: string;
  kind?: InlineEditBlockKind;
  start: number;
  end: number;
}

export type InlineEditOperation =
  | {
      type: 'replace_range';
      startBlockId: string;
      endBlockId: string;
      content: string;
    }
  | {
      type: 'insert_before';
      anchorBlockId: string;
      content: string;
    }
  | {
      type: 'insert_after';
      anchorBlockId: string;
      content: string;
    };

export interface InlineEditRequest {
  prompt: string;
  mode?: 'update' | 'insert';
  blocks: InlineEditBlock[];
  cursorBlockId?: string;
  model?: AIModel;
}

export interface InlineEditResponse {
  operations: InlineEditOperation[];
  model?: string;
}

// AI Image Generation types
export interface AIImageGenerateRequest {
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024';
  model?: AIModel;
}

export interface AIImageGenerateResponse {
  b64: string;
  mimeType: string;
}

// Research API types
export interface ResearchRequest {
  paragraphId: string;
  query: string;
  context: {
    blockContent: string;
    sectionHeading?: string;
    sectionContent?: string;
  };
  documentStyle?: 'academic' | 'whitepaper' | 'technical-docs' | 'blog' | 'other';
  sourceType?: 'academic' | 'web';
  chatHistory?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  existingSources?: Array<{
    id: string;
    title: string;
    url?: string;
  }>;
  model?: AIModel;
}

export interface ResearchResponse {
  response: string;
  sources: Array<{
    title: string;
    authors?: string[];
    venue?: string;
    year?: number;
    url?: string;
    summary: string;
    sourceType: 'academic' | 'web';
    relevanceScore?: number;
    citationContext?: string;
  }>;
}

