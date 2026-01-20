/**
 * SG (Semantic Graph) API Routes
 *
 * Keep SG code consolidated here (not embedded in generic AI routes).
 */

import { FastifyInstance } from 'fastify';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import { schemas, security } from '../../config/schemas.js';
import type { ApiResponse } from '@zadoox/shared';
import type { AIModel } from '../../services/ai/ai-service.js';
import { getAIService } from '../../services/ai/ai-service-singleton.js';
import { buildSemanticGraphForBlocks } from '../../sg/sg-builder.js';

export async function sgRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateUser);

  /**
   * POST /api/v1/sg/embeddings
   */
  fastify.post(
    '/sg/embeddings',
    {
      schema: {
        description: 'Compute embeddings for a batch of texts (SG)',
        tags: ['SG'],
        security,
        body: {
          type: 'object',
          required: ['texts'],
          properties: {
            texts: { type: 'array', items: { type: 'string' } },
            model: { type: 'string', enum: ['openai', 'auto'] },
          },
        },
        response: {
          200: schemas.ApiResponse,
          400: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { texts, model } = request.body as { texts: string[]; model?: AIModel };
        if (!Array.isArray(texts) || texts.length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'texts is required' },
          };
          return reply.status(400).send(response);
        }
        const service = getAIService();
        const vectors = await service.embedTexts(texts, model);
        const response: ApiResponse<{ vectors: number[][] }> = {
          success: true,
          data: { vectors },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to compute embeddings';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * POST /api/v1/sg/build
   */
  fastify.post(
    '/sg/build',
    {
      schema: {
        description: 'Build SemanticGraph nodes+edges for a bounded block slice (SG)',
        tags: ['SG'],
        security,
        body: {
          type: 'object',
          required: ['blocks'],
          properties: {
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'type', 'text'],
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  text: { type: 'string' },
                },
              },
            },
            model: { type: 'string', enum: ['openai', 'auto'] },
          },
        },
        response: {
          200: schemas.ApiResponse,
          400: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { blocks, model } = request.body as {
          blocks: Array<{ id: string; type: string; text: string }>;
          model?: AIModel;
        };
        if (!Array.isArray(blocks) || blocks.length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'blocks is required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const built = await buildSemanticGraphForBlocks({ service, blocks, model });

        const response: ApiResponse<typeof built> = { success: true, data: built };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);

        // If AI isn't configured, treat as a safe no-op signal (not a server crash).
        const msg = error instanceof Error ? error.message : 'Failed to build semantic graph';
        const isMissingKey = typeof msg === 'string' && msg.includes('OPENAI_API_KEY');
        if (isMissingKey) {
          const response: ApiResponse<{ sg: null }> = { success: true, data: { sg: null } };
          return reply.send(response);
        }

        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: msg },
        };
        return reply.status(500).send(response);
      }
    }
  );

  return fastify;
}


