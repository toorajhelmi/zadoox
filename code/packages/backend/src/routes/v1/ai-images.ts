import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type { ApiResponse } from '@zadoox/shared';
import { schemas, security } from '../../config/schemas.js';
import { getAIService } from '../../services/ai/ai-service-singleton.js';

export async function registerAiImageRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/ai/images/generate
   * Generate an image (base64) from a prompt.
   */
  fastify.post(
    '/ai/images/generate',
    {
      schema: {
        description: 'Generate an image (base64) from a prompt',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['prompt'],
          properties: {
            prompt: { type: 'string' },
            size: { type: 'string', enum: ['256x256', '512x512', '1024x1024'] },
            model: { type: 'string', enum: ['openai', 'auto'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  b64: { type: 'string' },
                  mimeType: { type: 'string' },
                },
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
        const { prompt, size, model } = request.body as {
          prompt: string;
          size?: '256x256' | '512x512' | '1024x1024';
          model?: 'openai' | 'auto';
        };

        if (!prompt || prompt.trim().length === 0) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' } };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const result = await service.generateImage(prompt, { size }, model);

        const response: ApiResponse<{ b64: string; mimeType: string }> = {
          success: true,
          data: result,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
        const response: ApiResponse<null> = { success: false, error: { code: 'INTERNAL_ERROR', message: errorMessage } };
        return reply.status(500).send(response);
      }
    }
  );
}



