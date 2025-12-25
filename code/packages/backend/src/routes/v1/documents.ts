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

export async function documentRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateUser);

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
}

