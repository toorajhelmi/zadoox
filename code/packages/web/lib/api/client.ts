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
  ComponentEditRequest,
  ComponentEditResponse,
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
    // Best-effort refresh: if this fails (offline), still try to use any cached session.
    try {
      // Mirrors middleware behavior; may hit the network.
      await supabase.auth.getUser();
    } catch {
      // ignore
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
    ...(((options.headers as Record<string, string>) || {}) as Record<string, string>),
  };

  // Only set JSON content-type when we actually send a body.
  // Some servers (Fastify) reject empty bodies when content-type is application/json.
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (hasBody && !isFormData) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

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

async function fetchBinary(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ blob: Blob; contentType: string; filename?: string }> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: headers as HeadersInit,
    });
  } catch (error: unknown) {
    throw new ApiError(
      `Failed to connect to API at ${API_BASE_URL}. Make sure the backend server is running.`,
      'NETWORK_ERROR',
      undefined,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }

  if (!response.ok) {
    // Error responses might be JSON or plain text. Read once, then attempt JSON parse.
    const raw = await response.text().catch(() => '');
    try {
      const parsed = raw ? (JSON.parse(raw) as ApiResponse<unknown>) : null;
      if (parsed && typeof parsed === 'object') {
      throw new ApiError(
          parsed.error?.message || `Request failed (${response.status} ${response.statusText})`,
          parsed.error?.code || 'UNKNOWN_ERROR',
        response.status,
          parsed.error?.details
      );
      }
      throw new Error('Not JSON');
    } catch {
      // Fall back to showing a small portion of the raw body to aid debugging.
      const bodyPreview = raw && raw.trim().length > 0 ? raw.trim().slice(0, 800) : null;
      throw new ApiError(
        bodyPreview ? `Request failed (${response.status} ${response.statusText}).\n\n${bodyPreview}` : `Request failed (${response.status} ${response.statusText})`,
        'BINARY_REQUEST_FAILED',
        response.status
      );
    }
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const disposition = response.headers.get('content-disposition') || '';
  const filenameMatch = /filename="([^"]+)"/i.exec(disposition);
  const filename = filenameMatch?.[1];

  const blob = await response.blob();
  return { blob, contentType, filename };
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

    duplicate: async (id: string): Promise<Project> => {
      const response = await fetchApi<Project>(`/projects/${id}/duplicate`, {
        method: 'POST',
      });
      if (!response.data) {
        throw new ApiError('Failed to duplicate project', 'DUPLICATE_FAILED', 500);
      }
      return response.data;
    },
  },

  publish: {
    web: async (
      projectId: string,
      request: { documentId: string; source: 'markdown' | 'latex'; purpose?: 'web' | 'pdf' }
    ): Promise<{ html: string; title: string }> => {
      const response = await fetchApi<{ html: string; title: string }>(
        `/projects/${projectId}/publish/web`,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );
      if (!response.data) {
        throw new ApiError('Failed to generate publish HTML', 'PUBLISH_WEB_FAILED', 500);
      }
      return response.data;
    },

    pdf: async (
      projectId: string,
      request: { documentId: string; source: 'latex' }
    ): Promise<{ blob: Blob; filename?: string }> => {
      const { blob, contentType, filename } = await fetchBinary(
        `/projects/${projectId}/publish/pdf`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        }
      );
      if (!contentType.includes('pdf')) {
        throw new ApiError('Unexpected content type for PDF response', 'INVALID_PDF_RESPONSE', 500, {
          contentType,
        });
      }
      return { blob, filename };
    },

    latexPackage: async (
      projectId: string,
      request: { documentId: string; source: 'latex' }
    ): Promise<{ blob: Blob; filename?: string }> => {
      const { blob, contentType, filename } = await fetchBinary(
        `/projects/${projectId}/publish/latex-package`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        }
      );
      if (!contentType.includes('zip')) {
        throw new ApiError('Unexpected content type for LaTeX package response', 'INVALID_LATEX_PACKAGE', 500, {
          contentType,
        });
      }
      return { blob, filename };
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

    delete: async (id: string): Promise<void> => {
      await fetchApi<void>(`/documents/${id}`, { method: 'DELETE' });
    },

    duplicate: async (id: string): Promise<Document> => {
      const response = await fetchApi<Document>(`/documents/${id}/duplicate`, { method: 'POST' });
      if (!response.data) {
        throw new ApiError('Failed to duplicate document', 'DUPLICATE_FAILED', 500);
      }
      return response.data;
    },

    latexEntryGet: async (id: string): Promise<{ text: string; latex: any }> => {
      const response = await fetchApi<{ text: string; latex: any }>(`/documents/${id}/latex/entry`);
      if (!response.data) throw new ApiError('Failed to load LaTeX entry', 'LATEX_ENTRY_GET_FAILED', 500);
      return response.data;
    },

    latexEntryPut: async (id: string, params: { text: string; entryPath?: string }): Promise<{ latex: any }> => {
      const response = await fetchApi<{ latex: any }>(`/documents/${id}/latex/entry`, {
        method: 'PUT',
        body: JSON.stringify(params),
      });
      if (!response.data) throw new ApiError('Failed to save LaTeX entry', 'LATEX_ENTRY_PUT_FAILED', 500);
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

    // NOTE: SG endpoints are under api.sg.* (kept consolidated outside generic AI surface).

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

    component: {
      edit: async (request: ComponentEditRequest): Promise<ComponentEditResponse> => {
        const response = await fetchApi<ComponentEditResponse>('/ai/component/edit', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        if (!response.data) {
          throw new ApiError('Failed to generate component edit', 'COMPONENT_EDIT_FAILED', 500);
        }
        return response.data;
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

  sg: {
    embeddings: async (texts: string[]): Promise<number[][]> => {
      const response = await fetchApi<{ vectors: number[][] }>('/sg/embeddings', {
        method: 'POST',
        body: JSON.stringify({ texts }),
      });
      return response.data?.vectors || [];
    },
    build: async (params: {
      documentId: string;
      blocks: Array<{ id: string; type: string; text: string }>;
    }): Promise<{ sg: any } | { sg: null }> => {
      const response = await fetchApi<{ sg: any } | { sg: null }>('/sg/build', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      if (!response.data) {
        throw new ApiError('Failed to build semantic graph', 'SG_BUILD_FAILED', 500);
      }
      return response.data;
    },

    bootstrapStart: async (params: {
      documentId: string;
      blocks: Array<{ id: string; type: string; text: string }>;
    }): Promise<{ jobId: string }> => {
      const response = await fetchApi<{ jobId: string }>('/sg/bootstrap/start', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      if (!response.data) {
        throw new ApiError('Failed to start SG bootstrap', 'SG_BOOTSTRAP_START_FAILED', 500);
      }
      return response.data;
    },

    bootstrapStatus: async (
      jobId: string
    ): Promise<{
      jobId: string;
      documentId: string;
      stage: string;
      doneBlocks: number;
      totalBlocks: number;
      nodeCount?: number;
      edgeCount?: number;
      error?: string;
      startedAt: string;
      updatedAt: string;
    }> => {
      const response = await fetchApi<{
        jobId: string;
        documentId: string;
        stage: string;
        doneBlocks: number;
        totalBlocks: number;
        nodeCount?: number;
        edgeCount?: number;
        error?: string;
        startedAt: string;
        updatedAt: string;
      }>(`/sg/bootstrap/status/${encodeURIComponent(jobId)}`);
      if (!response.data) {
        throw new ApiError('Failed to load SG bootstrap status', 'SG_BOOTSTRAP_STATUS_FAILED', 500);
      }
      return response.data;
    },
  },

  imports: {
    arxiv: async (params: { projectId: string; arxiv: string; title?: string }): Promise<Document> => {
      const response = await fetchApi<Document>('/import/arxiv', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      if (!response.data) {
        throw new ApiError('Failed to import arXiv paper', 'IMPORT_ARXIV_FAILED', 500);
      }
      return response.data;
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

