import type { FastifyInstance } from 'fastify';
import type { AIModel } from '../../services/ai/ai-service.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type { ApiResponse, ComponentEditResponse } from '@zadoox/shared';
import { schemas, security } from '../../config/schemas.js';
import { z } from 'zod';
import { getAIService } from '../../services/ai/ai-service-singleton.js';

export async function registerAiComponentRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/ai/component/edit
   * Generate a component-scoped XMD update (or clarification) for embedded components.
   */
  fastify.post(
    '/ai/component/edit',
    {
      schema: {
        description: 'Generate a component-scoped XMD update (or clarification) for embedded components',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['kind', 'prompt', 'source'],
          properties: {
            kind: { type: 'string' },
            prompt: { type: 'string' },
            source: { type: 'string' },
            capabilities: {},
            context: {},
            model: { type: 'string', enum: ['openai', 'auto'] },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['success', 'data'],
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                required: ['type'],
                // Keep response permissive for forward compatibility.
                additionalProperties: true,
                properties: {
                  type: { type: 'string', enum: ['clarify', 'update'] },
                  question: { type: 'string' },
                  suggestions: { type: 'array', items: { type: 'string' } },
                  updatedXmd: { type: 'string' },
                  summary: { type: 'string' },
                  confirmationQuestion: { type: 'string' },
                  model: { type: 'string' },
                },
              },
              error: schemas.ApiError,
            },
          },
          400: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        // Treat body as unknown at runtime; Fastify schema validates shape.
        const rawBody: unknown = request.body;
        const body: Record<string, unknown> =
          rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? (rawBody as Record<string, unknown>) : {};
        const kind = body.kind;
        const prompt = body.prompt;
        const source = body.source;
        const capabilities = body.capabilities;
        const context = body.context;
        const model = body.model;

        const promptStr = typeof prompt === 'string' ? prompt : String(prompt ?? '');
        if (promptStr.trim().length === 0) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' } };
          return reply.status(400).send(response);
        }
        const sourceStr = typeof source === 'string' ? source : String(source ?? '');
        if (sourceStr.trim().length === 0) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Source is required' } };
          return reply.status(400).send(response);
        }
        const kindStr = typeof kind === 'string' ? kind : String(kind ?? '');
        if (kindStr.trim().length === 0) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Kind is required' } };
          return reply.status(400).send(response);
        }
        const modelStr = typeof model === 'string' ? model : undefined;
        const modelVal: AIModel | undefined = modelStr === 'openai' || modelStr === 'auto' ? modelStr : undefined;

        const service = getAIService();
        const ctxObj: Record<string, unknown> =
          context && typeof context === 'object' && !Array.isArray(context) ? (context as Record<string, unknown>) : {};
        const mergedContext =
          Object.keys(ctxObj).length > 0 ? { ...ctxObj, source: sourceStr, capabilities } : { source: sourceStr, capabilities };
        const rawJson = await service.generateComponentEditPlan(promptStr, { kind: kindStr, context: mergedContext }, modelVal);

        let payloadRaw: unknown;
        try {
          payloadRaw = JSON.parse(rawJson);
        } catch {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'AI_RESPONSE_INVALID', message: 'AI returned invalid JSON component edit response' },
          };
          return reply.status(500).send(response);
        }

        const responseSchema = z.union([
          z.object({
            type: z.literal('clarify'),
            question: z.string().min(1),
            suggestions: z.array(z.string()).optional(),
          }),
          z.object({
            type: z.literal('update'),
            updatedXmd: z.string().min(1),
            summary: z.string().min(1),
            confirmationQuestion: z.string().optional(),
          }),
        ]);

        const parsed = responseSchema.safeParse(payloadRaw);
        const fallbackResult: { type: 'clarify'; question: string; suggestions: string[] } = {
          type: 'clarify',
          question: 'I could not produce a safe component update. What exactly should change?',
          suggestions: [],
        };
        const result = parsed.success ? parsed.data : fallbackResult;

        const modelInfo = service.getModelInfo(modelVal || 'openai');
        const data: ComponentEditResponse =
          result.type === 'clarify'
            ? { type: 'clarify', question: result.question, suggestions: result.suggestions, model: modelInfo?.id || 'unknown' }
            : {
                type: 'update',
                updatedXmd: result.updatedXmd,
                summary: result.summary,
                confirmationQuestion: result.confirmationQuestion,
                model: modelInfo?.id || 'unknown',
              };

        const response: ApiResponse<ComponentEditResponse> = { success: true, data };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate component edit';
        const response: ApiResponse<null> = { success: false, error: { code: 'INTERNAL_ERROR', message: errorMessage } };
        return reply.status(500).send(response);
      }
    }
  );
}



