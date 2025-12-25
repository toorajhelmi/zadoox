/**
 * Document Version API Routes
 */

import { FastifyInstance } from 'fastify';
import { VersionService } from '../../services/version-service.js';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import {
  DocumentVersion,
  VersionMetadata,
  ApiResponse,
} from '@zadoox/shared';
import { schemas, security } from '../../config/schemas.js';

export async function versionRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateUser);

  /**
   * GET /api/v1/documents/:documentId/versions
   * List versions for a document
   */
  fastify.get(
    '/documents/:documentId/versions',
    {
      schema: {
        description: 'List versions for a document',
        tags: ['Versions'],
        security,
        params: {
          type: 'object',
          properties: {
            documentId: { type: 'string', format: 'uuid' },
          },
          required: ['documentId'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
            offset: { type: 'number', minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    documentId: { type: 'string' },
                    versionNumber: { type: 'number' },
                    isSnapshot: { type: 'boolean' },
                    authorId: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    changeType: { type: 'string' },
                    changeDescription: { type: 'string', nullable: true },
                  },
                },
              },
            },
            required: ['success'],
          },
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const params = request.params as { documentId: string };
        const query = request.query as { limit?: number; offset?: number };
        const { documentId } = params;
        const { limit = 50, offset = 0 } = query;

        const versionService = new VersionService(request.supabase!);

        const versions = await versionService.listVersions(documentId, limit, offset);

        const response: ApiResponse<DocumentVersion[]> = {
          success: true,
          data: versions,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to list versions';
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
   * GET /api/v1/documents/:documentId/versions/:versionNumber
   * Get a specific version
   */
  fastify.get(
    '/documents/:documentId/versions/:versionNumber',
    {
      schema: {
        description: 'Get a specific document version',
        tags: ['Versions'],
        security,
        params: {
          type: 'object',
          properties: {
            documentId: { type: 'string', format: 'uuid' },
            versionNumber: { type: 'number' },
          },
          required: ['documentId', 'versionNumber'],
        },
        response: {
          200: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const params = request.params as { documentId: string; versionNumber: number };
        const { documentId, versionNumber } = params;

        const versionService = new VersionService(request.supabase!);

        const version = await versionService.getVersion(documentId, versionNumber);

        if (!version) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Version ${versionNumber} not found for document ${documentId}`,
            },
          };
          return reply.status(404).send(response);
        }

        const response: ApiResponse<DocumentVersion> = {
          success: true,
          data: version,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get version';
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
   * GET /api/v1/documents/:documentId/versions/:versionNumber/content
   * Reconstruct content for a specific version
   */
  fastify.get(
    '/documents/:documentId/versions/:versionNumber/content',
    {
      schema: {
        description: 'Get reconstructed content for a specific version',
        tags: ['Versions'],
        security,
        params: {
          type: 'object',
          properties: {
            documentId: { type: 'string', format: 'uuid' },
            versionNumber: { type: 'number' },
          },
          required: ['documentId', 'versionNumber'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  versionNumber: { type: 'number' },
                },
              },
            },
            required: ['success'],
          },
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const params = request.params as { documentId: string; versionNumber: number };
        const { documentId, versionNumber } = params;

        const versionService = new VersionService(request.supabase!);

        const content = await versionService.reconstructVersion(documentId, versionNumber);

        const response: ApiResponse<{ content: string; versionNumber: number }> = {
          success: true,
          data: {
            content,
            versionNumber,
          },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to reconstruct version';
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
   * GET /api/v1/documents/:documentId/versions/metadata
   * Get version metadata for a document
   */
  fastify.get(
    '/documents/:documentId/versions/metadata',
    {
      schema: {
        description: 'Get version metadata for a document',
        tags: ['Versions'],
        security,
        params: {
          type: 'object',
          properties: {
            documentId: { type: 'string', format: 'uuid' },
          },
          required: ['documentId'],
        },
        response: {
          200: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const params = request.params as { documentId: string };
        const { documentId } = params;

        const versionService = new VersionService(request.supabase!);

        const metadata = await versionService.getVersionMetadata(documentId);

        if (!metadata) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Version metadata not found for document ${documentId}`,
            },
          };
          return reply.status(404).send(response);
        }

        const response: ApiResponse<VersionMetadata> = {
          success: true,
          data: metadata,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get version metadata';
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
}

