import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type { AIModelInfo, ApiResponse } from '@zadoox/shared';
import { schemas, security } from '../../config/schemas.js';
import { getAIService } from '../../services/ai/ai-service-singleton.js';

export async function registerAiCoreRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/ai/models
   * Get available AI models
   */
  fastify.get(
    '/ai/models',
    {
      schema: {
        description: 'Get available AI models',
        tags: ['AI'],
        security,
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
                    name: { type: 'string' },
                    provider: { type: 'string' },
                    maxTokens: { type: 'number' },
                    supportsStreaming: { type: 'boolean' },
                  },
                },
              },
            },
            required: ['success'],
          },
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        void request;
        const service = getAIService();
        const models = service.getAvailableModels();

        const response: ApiResponse<AIModelInfo[]> = {
          success: true,
          data: models,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get AI models';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );
}



