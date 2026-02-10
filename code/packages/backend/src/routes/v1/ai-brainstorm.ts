import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type { ApiResponse } from '@zadoox/shared';
import { schemas, security } from '../../config/schemas.js';
import { getAIService } from '../../services/ai/ai-service-singleton.js';

export async function registerAiBrainstormRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/ai/brainstorm/chat
   * Brainstorm chat endpoint
   */
  fastify.post(
    '/ai/brainstorm/chat',
    {
      schema: {
        description: 'Brainstorm chat - conversational brainstorming for document blocks',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['paragraphId', 'message', 'context'],
          properties: {
            paragraphId: { type: 'string' },
            message: { type: 'string' },
            context: {
              type: 'object',
              required: ['blockContent'],
              properties: {
                blockContent: { type: 'string' },
                sectionHeading: { type: 'string' },
                sectionContent: { type: 'string' },
              },
            },
            chatHistory: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  role: { type: 'string', enum: ['user', 'assistant'] },
                  content: { type: 'string' },
                  timestamp: { type: 'string' },
                },
              },
            },
            existingIdeaCards: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  topic: { type: 'string' },
                  description: { type: 'string' },
                  sourceMessageId: { type: 'string' },
                  createdAt: { type: 'string' },
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
                  response: { type: 'string' },
                  extractedIdeas: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        topic: { type: 'string' },
                        description: { type: 'string' },
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
        const { message, context, chatHistory = [], existingIdeaCards = [], model } = request.body as {
          paragraphId: string;
          message: string;
          context: {
            blockContent: string;
            sectionHeading?: string;
            sectionContent?: string;
          };
          chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
          existingIdeaCards?: Array<{ topic: string; description: string }>;
          model?: 'openai' | 'auto';
        };

        if (!message || message.trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Message is required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();

        // Convert chat history to format expected by service (validate and filter)
        const history = (chatHistory || [])
          .filter((msg) => msg && msg.role && msg.content)
          .map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: String(msg.content || '').trim(),
          }))
          .filter((msg) => msg.content.length > 0 && (msg.role === 'user' || msg.role === 'assistant'));

        // If the user asks for a summary/description/comparison and we already have idea cards,
        // interpret the request as "summarize/compare the ideas", not "summarize the block".
        const hasIdeas = Array.isArray(existingIdeaCards) && existingIdeaCards.length > 0;
        const isIdeaSummaryRequest =
          hasIdeas && /\b(summarize|summary|describe|description|compare|difference|different|why|which|pros|cons)\b/i.test(message);

        const ideaCardsText = hasIdeas
          ? existingIdeaCards
              .map((c, i) => `${i + 1}. ${String(c.topic || '').trim()}\n   ${String(c.description || '').trim()}`)
              .join('\n')
          : '';

        const effectiveMessage = isIdeaSummaryRequest
          ? `You already proposed multiple idea cards for the user's target content.
The user is asking you to summarize/compare the IDEA CARDS.

STRICT RULES:
- Do NOT summarize the document block itself.
- Focus ONLY on the idea cards and explain: how they differ, when/why to use each, and what each would produce.
- End with a short recommendation (e.g., "If you want X, pick #Y").

IDEA CARDS:
${ideaCardsText}

USER REQUEST:
${message.trim()}`
          : message;

        // Get AI response
        const aiResponse = await service.brainstormChat(effectiveMessage, history, context, model);

        // Extract ideas if there are existing ideas to compare against
        let extractedIdeas: Array<{ topic: string; description: string }> = [];
        if (existingIdeaCards.length > 0 || aiResponse.length > 100) {
          // Only extract if we have existing ideas to compare, or if response is substantial
          const existingIdeas = existingIdeaCards.map((card) => ({
            topic: card.topic,
            description: card.description,
          }));
          extractedIdeas = await service.extractIdeas(aiResponse, existingIdeas, model);
        }

        const response: ApiResponse<{
          response: string;
          extractedIdeas: Array<{ topic: string; description: string }>;
        }> = {
          success: true,
          data: { response: aiResponse, extractedIdeas },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to process brainstorm chat';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * POST /api/v1/ai/brainstorm/generate
   * Generate content from an idea card
   */
  fastify.post(
    '/ai/brainstorm/generate',
    {
      schema: {
        description: 'Generate content from a brainstorming idea card',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['paragraphId', 'ideaCard', 'context', 'mode'],
          properties: {
            paragraphId: { type: 'string' },
            ideaCard: {
              type: 'object',
              required: ['topic', 'description'],
              properties: {
                topic: { type: 'string' },
                description: { type: 'string' },
              },
            },
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
        const { ideaCard, context, mode, model } = request.body as {
          paragraphId: string;
          ideaCard: { topic: string; description: string };
          context: {
            blockContent: string;
            sectionHeading?: string;
            sectionContent?: string;
          };
          mode: 'blend' | 'replace';
          model?: 'openai' | 'auto';
        };

        if (!ideaCard.topic || !ideaCard.description) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Idea card topic and description are required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const content = await service.generateFromIdea(ideaCard, context, mode, model);

        const response: ApiResponse<{ content: string }> = {
          success: true,
          data: { content },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate content from idea';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );
}



