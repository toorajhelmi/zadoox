/**
 * API Client for Zadoox
 */

import type {
  ApiResponse,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Document,
  CreateDocumentInput,
  UpdateDocumentInput,
  AIAnalysisRequest,
  AIAnalysisResponse,
  AIActionRequest,
  AIActionResponse,
  AISuggestRequest,
  AISuggestResponse,
  AIModelInfo,
  DocumentVersion,
  VersionMetadata,
  BrainstormChatRequest,
  BrainstormChatResponse,
  BrainstormGenerateRequest,
  BrainstormGenerateResponse,
  DraftTransformRequest,
  DraftTransformResponse,
  InlineGenerateRequest,
  InlineGenerateResponse,
  InlineEditRequest,
  InlineEditResponse,
  AIImageGenerateRequest,
  AIImageGenerateResponse,
  ResearchRequest,
  ResearchResponse,
  AssetUploadRequest,
  AssetUploadResponse,
} from '@zadoox/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getAuthToken(): Promise<string | null> {
  // Get token from Supabase session
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: headers as HeadersInit,
    });
  } catch (error: unknown) {
    // Network error (backend not running, CORS, etc.)
    throw new ApiError(
      `Failed to connect to API at ${API_BASE_URL}. Make sure the backend server is running.`,
      'NETWORK_ERROR',
      undefined,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }

  // Try to parse JSON response
  let data: ApiResponse<T>;
  try {
    data = await response.json();
  } catch (error) {
    // Response is not JSON (likely an error page or server error)
    throw new ApiError(
      `Invalid response from server (${response.status} ${response.statusText}). Make sure the backend is running and accessible.`,
      'INVALID_RESPONSE',
      response.status
    );
  }

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.message || 'API request failed',
      data.error?.code || 'UNKNOWN_ERROR',
      response.status,
      data.error?.details
    );
  }

  return data;
}

export const api = {
  projects: {
    list: async (): Promise<Project[]> => {
      const response = await fetchApi<Project[]>('/projects');
      return response.data || [];
    },

    get: async (id: string): Promise<Project> => {
      const response = await fetchApi<Project>(`/projects/${id}`);
      if (!response.data) {
        throw new ApiError('Project not found', 'NOT_FOUND', 404);
      }
      return response.data;
    },

    create: async (input: CreateProjectInput): Promise<Project> => {
      const response = await fetchApi<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (!response.data) {
        throw new ApiError('Failed to create project', 'CREATE_FAILED', 500);
      }
      return response.data;
    },

    update: async (id: string, input: UpdateProjectInput): Promise<Project> => {
      const response = await fetchApi<Project>(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      if (!response.data) {
        throw new ApiError('Failed to update project', 'UPDATE_FAILED', 500);
      }
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await fetchApi<void>(`/projects/${id}`, {
        method: 'DELETE',
      });
    },
  },

  documents: {
    listByProject: async (projectId: string): Promise<Document[]> => {
      const response = await fetchApi<Document[]>(`/projects/${projectId}/documents`);
      return response.data || [];
    },

    create: async (input: CreateDocumentInput): Promise<Document> => {
      const response = await fetchApi<Document>('/documents', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (!response.data) {
        throw new ApiError('Failed to create document', 'CREATE_FAILED', 500);
      }
      return response.data;
    },

    get: async (id: string): Promise<Document> => {
      const response = await fetchApi<Document>(`/documents/${id}`);
      if (!response.data) {
        throw new ApiError('Document not found', 'NOT_FOUND', 404);
      }
      return response.data;
    },

    update: async (id: string, input: UpdateDocumentInput): Promise<Document> => {
      const response = await fetchApi<Document>(`/documents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      if (!response.data) {
        throw new ApiError('Failed to update document', 'UPDATE_FAILED', 500);
      }
      return response.data;
    },
  },

  ai: {
    getModels: async (): Promise<AIModelInfo[]> => {
      const response = await fetchApi<AIModelInfo[]>('/ai/models');
      return response.data || [];
    },

    analyze: async (request: AIAnalysisRequest): Promise<AIAnalysisResponse> => {
      const response = await fetchApi<AIAnalysisResponse>('/ai/analyze', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      if (!response.data) {
        throw new ApiError('Failed to analyze text', 'ANALYSIS_FAILED', 500);
      }
      return response.data;
    },

    action: async (request: AIActionRequest): Promise<AIActionResponse> => {
      const response = await fetchApi<AIActionResponse>('/ai/action', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      if (!response.data) {
        throw new ApiError('Failed to perform AI action', 'ACTION_FAILED', 500);
      }
      return response.data;
    },

    suggest: async (request: AISuggestRequest): Promise<AISuggestResponse> => {
      const response = await fetchApi<AISuggestResponse>('/ai/suggest', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      if (!response.data) {
        throw new ApiError('Failed to get AI suggestion', 'SUGGESTION_FAILED', 500);
      }
      return response.data;
    },

    brainstorm: {
      chat: async (request: BrainstormChatRequest): Promise<BrainstormChatResponse> => {
        const response = await fetchApi<BrainstormChatResponse>('/ai/brainstorm/chat', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        if (!response.data) {
          throw new ApiError('Failed to process brainstorm chat', 'BRAINSTORM_CHAT_FAILED', 500);
        }
        return response.data;
      },

      generate: async (request: BrainstormGenerateRequest): Promise<BrainstormGenerateResponse> => {
        const response = await fetchApi<BrainstormGenerateResponse>('/ai/brainstorm/generate', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        if (!response.data) {
          throw new ApiError('Failed to generate content from idea', 'BRAINSTORM_GENERATE_FAILED', 500);
        }
        return response.data;
      },
    },

    draft: {
      transform: async (request: DraftTransformRequest): Promise<DraftTransformResponse> => {
        const response = await fetchApi<DraftTransformResponse>('/ai/draft/transform', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        if (!response.data) {
          throw new ApiError('Failed to transform draft', 'DRAFT_TRANSFORM_FAILED', 500);
        }
        return response.data;
      },
    },

    inline: {
      generate: async (request: InlineGenerateRequest): Promise<InlineGenerateResponse> => {
        try {
          const response = await fetchApi<InlineGenerateResponse>('/ai/inline/generate', {
            method: 'POST',
            body: JSON.stringify(request),
          });
          if (!response.data) {
            throw new ApiError('Failed to generate content from prompt', 'INLINE_GENERATE_FAILED', 500);
          }
          return response.data;
        } catch (error) {
          console.error('Inline generate API error:', error);
          throw error;
        }
      },
      edit: async (request: InlineEditRequest): Promise<InlineEditResponse> => {
        try {
          const response = await fetchApi<InlineEditResponse>('/ai/inline/edit', {
            method: 'POST',
            body: JSON.stringify(request),
          });
          if (!response.data) {
            throw new ApiError('Failed to generate edit plan', 'INLINE_EDIT_FAILED', 500);
          }
          return response.data;
        } catch (error) {
          console.error('Inline edit API error:', error);
          throw error;
        }
      },
    },

    images: {
      generate: async (request: AIImageGenerateRequest): Promise<AIImageGenerateResponse> => {
        const response = await fetchApi<AIImageGenerateResponse>('/ai/images/generate', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        if (!response.data) {
          throw new ApiError('Failed to generate image', 'IMAGE_GENERATE_FAILED', 500);
        }
        return response.data;
      },
    },

    research: {
      chat: async (request: ResearchRequest): Promise<ResearchResponse> => {
        const response = await fetchApi<ResearchResponse>('/ai/research/chat', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        if (!response.data) {
          throw new ApiError('Failed to process research chat', 'RESEARCH_CHAT_FAILED', 500);
        }
        return response.data;
      },
    },
  },

  assets: {
    upload: async (request: AssetUploadRequest): Promise<AssetUploadResponse> => {
      const response = await fetchApi<AssetUploadResponse>('/assets/upload', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      if (!response.data) {
        throw new ApiError('Failed to upload asset', 'ASSET_UPLOAD_FAILED', 500);
      }
      return response.data;
    },
  },

  versions: {
    list: async (documentId: string, limit = 50, offset = 0): Promise<DocumentVersion[]> => {
      const response = await fetchApi<DocumentVersion[]>(
        `/documents/${documentId}/versions?limit=${limit}&offset=${offset}`
      );
      return response.data || [];
    },

    get: async (documentId: string, versionNumber: number): Promise<DocumentVersion> => {
      const response = await fetchApi<DocumentVersion>(
        `/documents/${documentId}/versions/${versionNumber}`
      );
      if (!response.data) {
        throw new ApiError('Version not found', 'NOT_FOUND', 404);
      }
      return response.data;
    },

    getMetadata: async (documentId: string): Promise<VersionMetadata> => {
      const response = await fetchApi<VersionMetadata>(
        `/documents/${documentId}/versions/metadata`
      );
      if (!response.data) {
        throw new ApiError('Version metadata not found', 'NOT_FOUND', 404);
      }
      return response.data;
    },

    reconstruct: async (documentId: string, versionNumber: number): Promise<string> => {
      const response = await fetchApi<{ content: string; versionNumber: number }>(
        `/documents/${documentId}/versions/${versionNumber}/content`
      );
      if (!response.data) {
        throw new ApiError('Failed to reconstruct version', 'RECONSTRUCT_FAILED', 500);
      }
      return response.data.content;
    },
  },
};

export { ApiError };

