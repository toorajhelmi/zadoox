/**
 * Documents API Routes
 */

import { FastifyInstance } from 'fastify';
import { DocumentService } from '../../services/document-service.js';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import {
  CreateDocumentInput,
  UpdateDocumentInput,
  ApiResponse,
  Document,
} from '@zadoox/shared';
import {
  createDocumentSchema,
  updateDocumentSchema,
  documentIdSchema,
  projectIdParamSchema,
} from '../../validation/schemas.js';
import { schemas, security } from '../../config/schemas.js';
import { supabaseAdmin } from '../../db/client.js';
import { z } from 'zod';

type LatexManifest = {
  bucket: string;
  basePrefix: string; // e.g. projects/<projectId>/documents/<docId>/latex
  entryPath: string; // e.g. ms.tex
  files?: Array<{ path: string; sha256?: string; size?: number }>;
};

const latexEntryPutSchema = z.object({
  text: z.string().min(0),
  entryPath: z.string().min(1).optional(),
});

export async function documentRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateUser);

  const latexBucket = process.env.SUPABASE_PROJECT_FILES_BUCKET || 'project-files';
  let latexBucketEnsured = false;
  const ensureLatexBucket = async () => {
    if (latexBucketEnsured) return;
    const admin = supabaseAdmin();
    const { data: existing, error: getErr } = await admin.storage.getBucket(latexBucket);
    if (!existing || getErr) {
      const { error: createErr } = await admin.storage.createBucket(latexBucket, { public: false });
      if (createErr) {
        const msg = (createErr as { message?: string }).message || '';
        if (!/already exists/i.test(msg)) throw createErr;
      }
    }
    latexBucketEnsured = true;
  };

  /**
   * GET /api/v1/projects/:projectId/documents
   * List all documents for a project
   */
  fastify.get(
    '/projects/:projectId/documents',
    {
      schema: {
        description: 'List all documents for a project',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string', format: 'uuid' },
          },
          required: ['projectId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: schemas.Document,
              },
            },
            required: ['success'],
          },
          400: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        // Validate route parameters
        const paramValidation = projectIdParamSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid project ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { projectId } = paramValidation.data;
        const documentService = new DocumentService(request.supabase!);
        const documents = await documentService.listDocumentsByProject(
          projectId
        );

        const response: ApiResponse<Document[]> = {
          success: true,
          data: documents,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to list documents';
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: errorMessage,
          },
        };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * GET /api/v1/documents/:id
   * Get a single document by ID
   */
  fastify.get(
    '/documents/:id',
    {
      schema: {
        description: 'Get a single document by ID',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: schemas.Document,
            },
            required: ['success'],
          },
          400: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        // Validate route parameters
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid document ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { id } = paramValidation.data;
        const documentService = new DocumentService(request.supabase!);
        const document = await documentService.getDocumentById(id);

        const response: ApiResponse<Document> = {
          success: true,
          data: document,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get document';
        const statusCode = errorMessage.includes('not found') ? 404 : 500;
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: errorMessage,
          },
        };
        return reply.status(statusCode).send(response);
      }
    }
  );

  /**
   * POST /api/v1/documents
   * Create a new document
   */
  fastify.post(
    '/documents',
    {
      schema: {
        description: 'Create a new document',
        tags: ['Documents'],
        security,
        body: schemas.CreateDocumentInput,
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: schemas.Document,
            },
            required: ['success'],
          },
          400: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
    try {
      // Validate request body
      const validationResult = createDocumentSchema.safeParse(request.body);
      if (!validationResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: validationResult.error.errors,
          },
        };
        return reply.status(400).send(response);
      }

      const body = validationResult.data as CreateDocumentInput;
      const documentService = new DocumentService(request.supabase!);
      const document = await documentService.createDocument(
        body,
        request.userId!
      );

      const response: ApiResponse<Document> = {
        success: true,
        data: document,
      };
      return reply.status(201).send(response);
    } catch (error: unknown) {
      fastify.log.error(error);
      let statusCode = 500;
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not found')) statusCode = 404;
      else if (errorMessage.includes('Invalid')) statusCode = 400;

      const response: ApiResponse<null> = {
        success: false,
        error: {
          code:
            statusCode === 404
              ? 'NOT_FOUND'
              : statusCode === 400
              ? 'VALIDATION_ERROR'
              : 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create document',
        },
      };
      return reply.status(statusCode).send(response);
    }
  });

  /**
   * PUT /api/v1/documents/:id
   * Update a document
   */
  fastify.put(
    '/documents/:id',
    {
      schema: {
        description: 'Update a document',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: schemas.UpdateDocumentInput,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: schemas.Document,
            },
            required: ['success'],
          },
          400: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        // Validate route parameters
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid document ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        // Validate request body
        const bodyValidation = updateDocumentSchema.safeParse(request.body);
        if (!bodyValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: bodyValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { id } = paramValidation.data;
        const body = bodyValidation.data as UpdateDocumentInput;
        const documentService = new DocumentService(request.supabase!);
        const document = await documentService.updateDocument(
          id,
          body,
          request.userId!,
          body.changeType || 'auto-save',
          body.changeDescription
        );

        const response: ApiResponse<Document> = {
          success: true,
          data: document,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update document';
        let statusCode = 500;
        if (errorMessage.includes('not found')) statusCode = 404;
        else if (errorMessage.includes('Invalid')) statusCode = 400;

        const response: ApiResponse<null> = {
          success: false,
          error: {
            code:
              statusCode === 404
                ? 'NOT_FOUND'
                : statusCode === 400
                ? 'VALIDATION_ERROR'
                : 'INTERNAL_ERROR',
            message: errorMessage,
          },
        };
        return reply.status(statusCode).send(response);
      }
    }
  );

  /**
   * DELETE /api/v1/documents/:id
   * Delete a document
   */
  fastify.delete(
    '/documents/:id',
    {
      schema: {
        description: 'Delete a document',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
            required: ['success'],
          },
          400: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        // Validate route parameters
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid document ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { id } = paramValidation.data;
        const documentService = new DocumentService(request.supabase!);
        await documentService.deleteDocument(id);

        const response: ApiResponse<null> = {
          success: true,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete document';
        const statusCode = errorMessage.includes('not found') ? 404 : 500;
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: errorMessage,
          },
        };
        return reply.status(statusCode).send(response);
      }
    }
  );

  /**
   * POST /api/v1/documents/:id/duplicate
   * Duplicate a document (safe duplicate: content + metadata only; SG/LaTeX reset)
   */
  fastify.post(
    '/documents/:id/duplicate',
    {
      schema: {
        description: 'Duplicate a document (content + metadata only; SG/LaTeX reset)',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: schemas.Document,
            },
            required: ['success'],
          },
          400: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid document ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { id } = paramValidation.data;
        const documentService = new DocumentService(request.supabase!);
        const source = await documentService.getDocumentById(id);

        const nextTitleBase = String(source.title ?? '').trim() || 'Untitled Document';
        const nextTitle = `${nextTitleBase} (copy)`;

        // Safe duplicate:
        // - Copy XMD content + metadata (type/order/etc)
        // - Reset lastEditedFormat to markdown (so we don't land in latex mode without a manifest)
        // - Do NOT carry over SG or LaTeX manifest (avoid shared storage/clobbering)
        const created = await documentService.createDocument(
          {
            projectId: source.projectId,
            title: nextTitle,
            content: source.content ?? '',
            metadata: {
              ...(source.metadata as any),
              lastEditedFormat: 'markdown',
            },
            semanticGraph: null,
            latex: null,
          } as CreateDocumentInput,
          request.userId!
        );

        const response: ApiResponse<Document> = { success: true, data: created };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate document';
        let statusCode = 500;
        if (errorMessage.includes('not found')) statusCode = 404;
        else if (errorMessage.includes('Invalid')) statusCode = 400;
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code:
              statusCode === 404
                ? 'NOT_FOUND'
                : statusCode === 400
                  ? 'VALIDATION_ERROR'
                  : 'INTERNAL_ERROR',
            message: errorMessage,
          },
        };
        return reply.status(statusCode).send(response);
      }
    }
  );

  /**
   * GET /api/v1/documents/:id/latex/entry
   *
   * Loads the LaTeX entry file from Storage using `documents.latex` manifest.
   */
  fastify.get(
    '/documents/:id/latex/entry',
    {
      schema: {
        description: 'Get LaTeX entry text for a document (Storage-backed via documents.latex manifest)',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        response: { 200: schemas.ApiResponse, 400: schemas.ApiResponse, 404: schemas.ApiResponse, 500: schemas.ApiResponse },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid document ID' } };
          return reply.status(400).send(response);
        }
        const { id } = paramValidation.data;
        const documentService = new DocumentService(request.supabase!);
        const doc = await documentService.getDocumentById(id);
        const manifest = (doc as any).latex as LatexManifest | null;
        if (!manifest || typeof manifest !== 'object') {
          const response: ApiResponse<null> = { success: false, error: { code: 'NOT_FOUND', message: 'No LaTeX manifest for document' } };
          return reply.status(404).send(response);
        }
        const basePrefix = String((manifest as any).basePrefix || '');
        const entryPath = String((manifest as any).entryPath || '');
        if (!basePrefix || !entryPath) {
          const response: ApiResponse<null> = { success: false, error: { code: 'INVALID_STATE', message: 'Invalid LaTeX manifest (missing basePrefix/entryPath)' } };
          return reply.status(500).send(response);
        }
        const key = `${basePrefix.replace(/\/+$/g, '')}/${entryPath.replace(/^\/+/, '')}`;

        const admin = supabaseAdmin();
        await ensureLatexBucket();
        const { data, error } = await admin.storage.from(latexBucket).download(key);
        if (error || !data) {
          const response: ApiResponse<null> = { success: false, error: { code: 'NOT_FOUND', message: 'LaTeX entry file not found in storage' } };
          return reply.status(404).send(response);
        }
        const text = await data.text();
        const response: ApiResponse<{ text: string; latex: any }> = { success: true, data: { text, latex: manifest } };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const msg = error instanceof Error ? error.message : 'Failed to load LaTeX entry';
        const response: ApiResponse<null> = { success: false, error: { code: 'INTERNAL_ERROR', message: msg } };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * PUT /api/v1/documents/:id/latex/entry
   *
   * Saves the LaTeX entry file to Storage and updates `documents.latex` manifest.
   */
  fastify.put(
    '/documents/:id/latex/entry',
    {
      schema: {
        description: 'Save LaTeX entry text for a document (Storage-backed via documents.latex manifest)',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        body: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, entryPath: { type: 'string' } } },
        response: { 200: schemas.ApiResponse, 400: schemas.ApiResponse, 404: schemas.ApiResponse, 500: schemas.ApiResponse },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid document ID' } };
          return reply.status(400).send(response);
        }
        const bodyValidation = latexEntryPutSchema.safeParse(request.body);
        if (!bodyValidation.success) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } };
          return reply.status(400).send(response);
        }
        const { id } = paramValidation.data;
        const { text, entryPath: entryPathMaybe } = bodyValidation.data;

        const documentService = new DocumentService(request.supabase!);
        const doc = await documentService.getDocumentById(id);
        const projectId = doc.projectId;

        const existing = (doc as any).latex as LatexManifest | null;
        const basePrefix = existing?.basePrefix || `projects/${projectId}/documents/${id}/latex`;
        const entryPath = entryPathMaybe || existing?.entryPath || 'main.tex';
        const manifest: LatexManifest = {
          bucket: latexBucket,
          basePrefix,
          entryPath,
          files: existing?.files,
        };

        const key = `${basePrefix.replace(/\/+$/g, '')}/${entryPath.replace(/^\/+/, '')}`;
        const bytes = Buffer.from(String(text ?? ''), 'utf8');

        const admin = supabaseAdmin();
        await ensureLatexBucket();
        const { error } = await admin.storage.from(latexBucket).upload(key, bytes, {
          contentType: 'application/x-tex',
          upsert: true,
        });
        if (error) throw new Error(`Failed to upload LaTeX entry: ${error.message}`);

        // Important: this endpoint only uploads the entry file and returns the manifest.
        // Persisting `documents.latex` happens through the normal document update pipeline
        // so we keep a single save timer (content + metadata + SG + latex manifest).
        const response: ApiResponse<{ latex: any }> = { success: true, data: { latex: manifest } };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const msg = error instanceof Error ? error.message : 'Failed to save LaTeX entry';
        const response: ApiResponse<null> = { success: false, error: { code: 'INTERNAL_ERROR', message: msg } };
        return reply.status(500).send(response);
      }
    }
  );
}

