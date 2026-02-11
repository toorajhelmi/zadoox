import type { FastifyInstance } from 'fastify';
import type { AIModel } from '../../services/ai/ai-service.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type { ApiResponse } from '@zadoox/shared';
import { schemas, security } from '../../config/schemas.js';
import { getAIService } from '../../services/ai/ai-service-singleton.js';
import { runConceptionChat } from '../../services/ai/conception/chat.js';
import { extractConceptionIg } from '../../services/ai/conception/extract-ig.js';
import { runConceptionTwoStageStep } from '../../services/ai/conception/two-stage-step.js';
import { materializeConceptionDraft } from '../../services/ai/conception/drafting/materialize.js';
import { simulateConceptionUserMessage } from '../../services/ai/conception/simulate-user.js';

/**
 * Conception (Full-AI) routes.
 *
 * NOTE: This module owns Conception AI interactions. The parent `ai.ts` should stay thin.
 */
export async function registerConceptionAiRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/ai/conception/chat
   */
  fastify.post(
    '/ai/conception/chat',
    {
      schema: {
        description: 'Conception chat - returns assistant text',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['message', 'action', 'dr'],
          properties: {
            message: { type: 'string' },
            action: { type: 'object' },
            dr: { type: 'object' },
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
                  assistantText: { type: 'string' },
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
        const body = request.body as { message: string; action: unknown; dr: unknown; model?: AIModel };
        const message = String(body.message ?? '').trim();
        if (!message) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Message is required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const { assistantText } = await runConceptionChat({
          service,
          message,
          action: body.action,
          dr: body.dr,
          model: body.model,
        });

        const response: ApiResponse<{ assistantText: string }> = {
          success: true,
          data: { assistantText },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to process conception chat';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * POST /api/v1/ai/conception/extract-ig
   */
  fastify.post(
    '/ai/conception/extract-ig',
    {
      schema: {
        description: 'Conception IG extraction - extract IdeaGraph nodes/edges from user message + DR',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['message', 'dr'],
          properties: {
            message: { type: 'string' },
            dr: { type: 'object' },
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
                  nodes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        label: { type: 'string' },
                        state: { type: 'string' },
                        confidence: { type: 'number' },
                        facets: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                  edges: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        srcLabel: { type: 'string' },
                        dstLabel: { type: 'string' },
                        confidence: { type: 'number' },
                      },
                    },
                  },
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
        const body = request.body as { message: string; dr: unknown; model?: AIModel };
        const message = String(body.message ?? '').trim();
        if (!message) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Message is required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const { nodes, edges } = await extractConceptionIg({ service, message, dr: body.dr, model: body.model });

        const response: ApiResponse<{ nodes: unknown[]; edges: unknown[] }> = {
          success: true,
          data: { nodes, edges },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to extract IG';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * POST /api/v1/ai/conception/two-stage/step
   */
  fastify.post(
    '/ai/conception/two-stage/step',
    {
      schema: {
        description: 'Conception two-stage step - returns assistant text + phase + KP/IG deltas',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['message', 'dr'],
          properties: {
            message: { type: 'string' },
            dr: { type: 'object' },
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
                  assistantText: { type: 'string' },
                  phase: { type: 'string', enum: ['ideation', 'formalization'] },
                  convergenceScore: { type: 'number' },
                  allowIgUpdates: { type: 'boolean' },
                  docPlanPatch: { type: 'object', additionalProperties: true },
                  dmPatch: { type: 'object', additionalProperties: true },
                  kps: {
                    type: 'object',
                    properties: {
                      add: { type: 'array', items: { type: 'object' } },
                      strengthen: { type: 'array', items: { type: 'object' } },
                      supersede: { type: 'array', items: { type: 'object' } },
                      edges: { type: 'array', items: { type: 'object' } },
                    },
                  },
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
        const body = request.body as { message: string; dr: unknown; model?: AIModel };
        const message = String(body.message ?? '').trim();
        if (!message) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Message is required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const step = await runConceptionTwoStageStep({ service, message, dr: body.dr, model: body.model });

        const response: ApiResponse<{
          assistantText: string;
          phase: 'ideation' | 'formalization';
          convergenceScore: number;
          allowIgUpdates: boolean;
          docPlanPatch?: unknown;
          dmPatch?: unknown;
          kps: unknown;
        }> = {
          success: true,
          data: step,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to process two-stage step';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * POST /api/v1/ai/conception/draft/materialize
   */
  fastify.post(
    '/ai/conception/draft/materialize',
    {
      schema: {
        description: 'Conception drafting - materialize first draft (XMD) from IdeaGraph + DocPlan',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['dr'],
          properties: {
            dr: { type: 'object' },
            includedNodeIds: { type: 'array', items: { type: 'string' } },
            importanceById: { type: 'object', additionalProperties: { type: 'string', enum: ['H', 'M', 'L'] } },
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
                  summary: { type: 'string' },
                  xmd: { type: 'string' },
                  outlinePlan: { type: 'object', additionalProperties: true },
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
        const body = request.body as { dr: unknown; includedNodeIds?: string[]; importanceById?: Record<string, unknown>; model?: AIModel };
        const service = getAIService();
        const out = await materializeConceptionDraft({ service, model: body.model, body });
        const response: ApiResponse<typeof out> = { success: true, data: out };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to materialize draft';
        const response: ApiResponse<null> = { success: false, error: { code: 'INTERNAL_ERROR', message: errorMessage } };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * POST /api/v1/ai/conception/two-stage/simulate-user
   */
  fastify.post(
    '/ai/conception/two-stage/simulate-user',
    {
      schema: {
        description: 'Conception two-stage simulate user - generate next user message',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['dr'],
          properties: {
            dr: { type: 'object' },
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
                  message: { type: 'string' },
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
        const body = request.body as { dr: unknown; model?: AIModel };
        const service = getAIService();
        const { message } = await simulateConceptionUserMessage({ service, dr: body.dr, model: body.model });

        const response: ApiResponse<{ message: string }> = {
          success: true,
          data: { message },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to simulate user message';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );
}



