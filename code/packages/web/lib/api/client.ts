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
  },
};

export { ApiError };

