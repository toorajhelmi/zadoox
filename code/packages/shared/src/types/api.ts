/**
 * API request and response types
 */

// Common API response wrapper
export interface ApiResponse<T> {
  data: T;
  error?: ApiError;
}

export interface ApiError {
  message: string;
  code?: string;
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
}

export interface AISuggestResponse {
  suggestion: string;
  alternatives?: string[];
}

