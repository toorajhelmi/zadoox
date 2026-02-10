import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type { ApiResponse } from '@zadoox/shared';
import { schemas, security } from '../../config/schemas.js';
import { getAIService } from '../../services/ai/ai-service-singleton.js';

export async function registerAiDraftRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/ai/draft/transform
   * Transform draft text into polished content
   */
  fastify.post(
    '/ai/draft/transform',
    {
      schema: {
        description: 'Transform draft text into polished content',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['draftText', 'paragraphId', 'context'],
          properties: {
            draftText: { type: 'string' },
            paragraphId: { type: 'string' },
            context: {
              type: 'object',
              required: ['blockContent'],
              properties: {
                blockContent: { type: 'string' },
                sectionHeading: { type: 'string' },
                sectionContent: { type: 'string' },
              },
            },
            mode: { type: 'string', enum: ['blend', 'replace'] },
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
                  content: { type: 'string' },
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
        const { draftText, context, mode, model } = request.body as {
          draftText: string;
          paragraphId: string;
          context: { blockContent: string; sectionHeading?: string; sectionContent?: string };
          mode?: 'blend' | 'replace';
          model?: 'openai' | 'auto';
        };

        if (!draftText || draftText.trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Draft text is required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const content = await service.transformDraft(draftText, context, mode || 'replace', model);

        const response: ApiResponse<{ content: string }> = {
          success: true,
          data: { content },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to transform draft';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );
}



