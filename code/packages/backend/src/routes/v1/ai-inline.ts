import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type { ApiResponse } from '@zadoox/shared';
import { schemas, security } from '../../config/schemas.js';
import { getAIService } from '../../services/ai/ai-service-singleton.js';

export async function registerAiInlineRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/ai/inline/generate
   * Generate content from a prompt (for inline chat)
   */
  fastify.post(
    '/ai/inline/generate',
    {
      schema: {
        description: 'Generate content from a prompt/instruction (for inline AI chat)',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['prompt', 'context'],
          properties: {
            prompt: { type: 'string' },
            context: {
              type: 'object',
              required: ['blockContent'],
              properties: {
                blockContent: { type: 'string' },
                sectionHeading: { type: 'string' },
                sectionContent: { type: 'string' },
              },
            },
            mode: { type: 'string', enum: ['blend', 'replace', 'extend'], default: 'replace' },
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
                  model: { type: 'string' },
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
        const { prompt, context, mode = 'replace', model } = request.body as {
          prompt: string;
          context: { blockContent: string; sectionHeading?: string; sectionContent?: string };
          mode?: 'blend' | 'replace' | 'extend';
          model?: 'openai' | 'auto';
        };

        if (!prompt || prompt.trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const content = await service.generateFromPrompt(prompt, context, mode, model);
        const modelInfo = service.getModelInfo(model || 'openai');

        const response: ApiResponse<{ content: string; model: string }> = {
          success: true,
          data: { content, model: modelInfo?.id || 'unknown' },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate content';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * POST /api/v1/ai/inline/edit
   * Generate a structured edit plan (operations + content) for inline editing.
   */
  fastify.post(
    '/ai/inline/edit',
    {
      schema: {
        description: 'Generate a structured edit plan (operations + content) for inline AI editing',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['prompt', 'blocks'],
          properties: {
            prompt: { type: 'string' },
            mode: { type: 'string', enum: ['update', 'insert'] },
            cursorBlockId: { type: 'string' },
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'text', 'start', 'end'],
                properties: {
                  id: { type: 'string' },
                  text: { type: 'string' },
                  kind: { type: 'string', enum: ['heading', 'paragraph', 'list', 'code', 'blank', 'other'] },
                  start: { type: 'number' },
                  end: { type: 'number' },
                },
              },
            },
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
                  operations: { type: 'array' },
                  model: { type: 'string' },
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
        const { prompt, blocks, cursorBlockId, mode = 'update', model } = request.body as {
          prompt: string;
          mode?: 'update' | 'insert';
          cursorBlockId?: string;
          blocks: Array<{
            id: string;
            text: string;
            kind?: 'heading' | 'paragraph' | 'list' | 'code' | 'blank' | 'other';
            start: number;
            end: number;
          }>;
          model?: 'openai' | 'auto';
        };

        if (!prompt || prompt.trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' },
          };
          return reply.status(400).send(response);
        }

        if (!Array.isArray(blocks) || blocks.length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Blocks are required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const planJson = await service.generateInlineEditPlan(prompt, { mode, blocks, cursorBlockId }, model);

        let parsed: { operations?: unknown[] };
        try {
          parsed = JSON.parse(planJson) as { operations?: unknown[] };
        } catch {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'AI_RESPONSE_INVALID', message: 'AI returned invalid JSON edit plan' },
          };
          return reply.status(500).send(response);
        }

        const operations = Array.isArray(parsed?.operations) ? parsed.operations : [];
        const modelInfo = service.getModelInfo(model || 'openai');

        const response: ApiResponse<{ operations: unknown[]; model: string }> = {
          success: true,
          data: { operations, model: modelInfo?.id || 'unknown' },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate edit plan';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );
}



