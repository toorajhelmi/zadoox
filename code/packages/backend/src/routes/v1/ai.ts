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
} from '@zadoox/shared';
import { schemas, security } from '../../config/schemas.js';

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

        // Get AI response
        const aiResponse = await service.brainstormChat(message, history, context, model);

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
}

