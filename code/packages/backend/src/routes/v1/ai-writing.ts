import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type {
  AIActionRequest,
  AIActionResponse,
  AIAnalysisRequest,
  AIAnalysisResponse,
  AISuggestRequest,
  AISuggestResponse,
  ApiResponse,
} from '@zadoox/shared';
import { schemas, security } from '../../config/schemas.js';
import { getAIService } from '../../services/ai/ai-service-singleton.js';

export async function registerAiWritingRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/ai/analyze
   * Analyze text for quality, sentiment, wordiness, clarity
   */
  fastify.post(
    '/ai/analyze',
    {
      schema: {
        description: 'Analyze text for quality, sentiment, wordiness, and clarity',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string' },
            context: { type: 'string' },
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
                  quality: { type: 'number' },
                  sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
                  wordiness: { type: 'number' },
                  clarity: { type: 'number' },
                  suggestions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: ['error', 'warning', 'suggestion'] },
                        text: { type: 'string' },
                        message: { type: 'string' },
                        replacement: { type: 'string' },
                      },
                    },
                  },
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
        const { text, context, model } = request.body as AIAnalysisRequest;

        if (!text || text.trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Text is required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const analysis = await service.analyzeText(text, context, model);
        const modelInfo = service.getModelInfo(model || 'openai');

        const response: ApiResponse<AIAnalysisResponse> = {
          success: true,
          data: { ...analysis, model: modelInfo?.id || 'unknown' },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to analyze text';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * POST /api/v1/ai/action
   * Perform AI action (improve, expand, clarify, condense, formalize, casualize)
   */
  fastify.post(
    '/ai/action',
    {
      schema: {
        description: 'Perform AI action on text (improve, expand, clarify, condense, formalize, casualize)',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['text', 'action'],
          properties: {
            text: { type: 'string' },
            action: { type: 'string', enum: ['improve', 'expand', 'clarify', 'condense', 'formalize', 'casualize'] },
            context: { type: 'string' },
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
                  result: { type: 'string' },
                  explanation: { type: 'string' },
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
        const { text, action, context, model } = request.body as AIActionRequest;

        if (!text || text.trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Text is required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        let result: string;

        switch (action) {
          case 'improve':
            result = await service.improveText(text, context, model);
            break;
          case 'expand':
            result = await service.expandText(text, context, model);
            break;
          case 'clarify':
            result = await service.clarifyText(text, context, model);
            break;
          case 'condense':
            result = await service.condenseText(text, context, model);
            break;
          case 'formalize':
            result = await service.adjustTone(text, 'formal', context, model);
            break;
          case 'casualize':
            result = await service.adjustTone(text, 'casual', context, model);
            break;
          default:
            throw new Error(`Unknown action: ${action}`);
        }

        const modelInfo = service.getModelInfo(model || 'openai');
        const response: ApiResponse<AIActionResponse> = {
          success: true,
          data: { result, model: modelInfo?.id || 'unknown' },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to perform AI action';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * POST /api/v1/ai/suggest
   * Get AI completion/suggestion
   */
  fastify.post(
    '/ai/suggest',
    {
      schema: {
        description: 'Get AI text completion/suggestion',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string' },
            context: { type: 'string' },
            type: { type: 'string', enum: ['completion', 'expand', 'improve'] },
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
                  suggestion: { type: 'string' },
                  alternatives: { type: 'array', items: { type: 'string' } },
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
        const { text, context, type, model } = request.body as AISuggestRequest;

        if (!text || text.trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Text is required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        let suggestion: string;

        if (type === 'completion') {
          suggestion = await service.suggestCompletion(text, context, model);
        } else if (type === 'expand') {
          suggestion = await service.expandText(text, context, model);
        } else {
          suggestion = await service.improveText(text, context, model);
        }

        const modelInfo = service.getModelInfo(model || 'openai');
        const response: ApiResponse<AISuggestResponse> = {
          success: true,
          data: { suggestion, model: modelInfo?.id || 'unknown' },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get AI suggestion';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );
}



