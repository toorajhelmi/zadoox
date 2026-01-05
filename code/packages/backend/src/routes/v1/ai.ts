/**
 * AI API Routes
 */

import { FastifyInstance } from 'fastify';
import { AIService } from '../../services/ai/ai-service.js';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import {
  AIAnalysisRequest,
  AIAnalysisResponse,
  AIActionRequest,
  AIActionResponse,
  AISuggestRequest,
  AISuggestResponse,
  AIModelInfo,
  ApiResponse,
  ComponentEditRequest,
  ComponentEditResponse,
} from '@zadoox/shared';
import { schemas, security } from '../../config/schemas.js';
import { z } from 'zod';

// Initialize AI service (singleton pattern)
let aiService: AIService | null = null;
let aiServiceError: Error | null = null;

function getAIService(): AIService {
  if (aiServiceError) {
    throw aiServiceError;
  }
  
  if (!aiService) {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        aiServiceError = new Error('OPENAI_API_KEY environment variable is not set');
        throw aiServiceError;
      }

      aiService = new AIService({
        defaultModel: (process.env.AI_DEFAULT_MODEL as 'openai' | 'auto') || 'openai',
        openaiApiKey,
        openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      });
    } catch (error) {
      aiServiceError = error instanceof Error ? error : new Error('Failed to initialize AI service');
      throw aiServiceError;
    }
  }
  return aiService;
}

export async function aiRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateUser);
  
  // Check if AI service can be initialized (but don't fail route registration)
  try {
    getAIService();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    fastify.log.warn(`AI service not available. AI endpoints will return errors: ${errorMsg}`);
  }

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
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Text is required',
            },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const analysis = await service.analyzeText(text, context, model);
        const modelInfo = service.getModelInfo(model || 'openai');

        const response: ApiResponse<AIAnalysisResponse> = {
          success: true,
          data: {
            ...analysis,
            model: modelInfo?.id || 'unknown',
          },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to analyze text';
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
            action: {
              type: 'string',
              enum: ['improve', 'expand', 'clarify', 'condense', 'formalize', 'casualize'],
            },
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
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Text is required',
            },
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
          data: {
            result,
            model: modelInfo?.id || 'unknown',
          },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to perform AI action';
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
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Text is required',
            },
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
          data: {
            suggestion,
            model: modelInfo?.id || 'unknown',
          },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get AI suggestion';
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
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Message is required',
            },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();

        // Convert chat history to format expected by service (validate and filter)
        const history = (chatHistory || [])
          .filter(msg => msg && msg.role && msg.content)
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: String(msg.content || '').trim(),
          }))
          .filter(msg => msg.content.length > 0 && (msg.role === 'user' || msg.role === 'assistant'));

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
          const existingIdeas = existingIdeaCards.map(card => ({
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
          data: {
            response: aiResponse,
            extractedIdeas,
          },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to process brainstorm chat';
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
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Idea card topic and description are required',
            },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const content = await service.generateFromIdea(ideaCard, context, mode, model);

        const response: ApiResponse<{ content: string }> = {
          success: true,
          data: {
            content,
          },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate content from idea';
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
    async (request, reply) => {
      try {
        const { draftText, context, mode, model } = request.body as {
          draftText: string;
          paragraphId: string;
          context: {
            blockContent: string;
            sectionHeading?: string;
            sectionContent?: string;
          };
          mode?: 'blend' | 'replace';
          model?: 'openai' | 'auto';
        };

        if (!draftText || draftText.trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Draft text is required',
            },
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
          context: {
            blockContent: string;
            sectionHeading?: string;
            sectionContent?: string;
          };
          mode?: 'blend' | 'replace' | 'extend';
          model?: 'openai' | 'auto';
        };

        if (!prompt || prompt.trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Prompt is required',
            },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const content = await service.generateFromPrompt(prompt, context, mode, model);
        const modelInfo = service.getModelInfo(model || 'openai');

        const response: ApiResponse<{ content: string; model: string }> = {
          success: true,
          data: {
            content,
            model: modelInfo?.id || 'unknown',
          },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate content';
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
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Prompt is required',
            },
          };
          return reply.status(400).send(response);
        }

        if (!Array.isArray(blocks) || blocks.length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Blocks are required',
            },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const planJson = await service.generateInlineEditPlan(
          prompt,
          { mode, blocks, cursorBlockId },
          model
        );

        let parsed: { operations?: unknown[] };
        try {
          parsed = JSON.parse(planJson) as { operations?: unknown[] };
        } catch {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'AI_RESPONSE_INVALID',
              message: 'AI returned invalid JSON edit plan',
            },
          };
          return reply.status(500).send(response);
        }

        const operations = Array.isArray(parsed?.operations) ? parsed.operations : [];
        const modelInfo = service.getModelInfo(model || 'openai');

        const response: ApiResponse<{ operations: unknown[]; model: string }> = {
          success: true,
          data: {
            operations,
            model: modelInfo?.id || 'unknown',
          },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate edit plan';
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
        // Treat body as untyped at runtime; Fastify schema validates shape.
        // This avoids tight coupling to shared types during iterative API evolution.
        const body = (request.body || {}) as any;
        const { kind, prompt, source, capabilities, context, model } = body;

        if (!prompt || String(prompt).trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' },
          };
          return reply.status(400).send(response);
        }
        if (!source || String(source).trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Source is required' },
          };
          return reply.status(400).send(response);
        }
        if (!kind || String(kind).trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Kind is required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();
        const mergedContext =
          context && typeof context === 'object'
            ? { ...(context as any), source, capabilities }
            : { source, capabilities };
        const rawJson = await service.generateComponentEditPlan(prompt, { kind, context: mergedContext }, model);

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

        // Validate & coerce the response shape so the frontend always receives a usable structure.
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
        const result = parsed.success
          ? parsed.data
          : ({
              type: 'clarify',
              question: 'I could not produce a safe component update. What exactly should change?',
              // Frontend derives suggestions from capabilities (adapter/IR-defined). Keep backend generic.
              suggestions: [],
            } as const);

        const modelInfo = service.getModelInfo(model || 'openai');
        const response: ApiResponse<ComponentEditResponse> = {
          success: true,
          data: {
            ...(result as any),
            model: modelInfo?.id || 'unknown',
          } as any,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate component edit';
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
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Prompt is required',
            },
          };
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

  return fastify;
}

