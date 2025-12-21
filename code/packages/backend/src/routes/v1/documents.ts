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

export async function documentRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateUser);

  /**
   * GET /api/v1/projects/:projectId/documents
   * List all documents for a project
   */
  fastify.get(
    '/projects/:projectId/documents',
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
      } catch (error: any) {
        fastify.log.error(error);
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error.message || 'Failed to list documents',
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
      } catch (error: any) {
        fastify.log.error(error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: error.message || 'Failed to get document',
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
  fastify.post('/documents', async (request: AuthenticatedRequest, reply) => {
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
    } catch (error: any) {
      fastify.log.error(error);
      let statusCode = 500;
      if (error.message.includes('not found')) statusCode = 404;
      else if (error.message.includes('Invalid')) statusCode = 400;

      const response: ApiResponse<null> = {
        success: false,
        error: {
          code:
            statusCode === 404
              ? 'NOT_FOUND'
              : statusCode === 400
              ? 'VALIDATION_ERROR'
              : 'INTERNAL_ERROR',
          message: error.message || 'Failed to create document',
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
        const document = await documentService.updateDocument(id, body);

        const response: ApiResponse<Document> = {
          success: true,
          data: document,
        };
        return reply.send(response);
      } catch (error: any) {
        fastify.log.error(error);
        let statusCode = 500;
        if (error.message.includes('not found')) statusCode = 404;
        else if (error.message.includes('Invalid')) statusCode = 400;

        const response: ApiResponse<null> = {
          success: false,
          error: {
            code:
              statusCode === 404
                ? 'NOT_FOUND'
                : statusCode === 400
                ? 'VALIDATION_ERROR'
                : 'INTERNAL_ERROR',
            message: error.message || 'Failed to update document',
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
      } catch (error: any) {
        fastify.log.error(error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: error.message || 'Failed to delete document',
          },
        };
        return reply.status(statusCode).send(response);
      }
    }
  );
}

