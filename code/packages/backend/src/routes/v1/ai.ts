/**
 * AI API Routes
 */

import { FastifyInstance } from 'fastify';
import type { AIModel } from '../../services/ai/ai-service.js';
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
  ComponentEditResponse,
} from '@zadoox/shared';
import { schemas, security } from '../../config/schemas.js';
import { z } from 'zod';
import { getAIService } from '../../services/ai/ai-service-singleton.js';

// NOTE: We intentionally do NOT add server-side fallbacks/repairs for KPs.
// This endpoint should be driven purely by the LLM output per user request.

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
   * POST /api/v1/ai/conception/chat
   * Conception chat endpoint (Full‑AI ideation)
   *
   * NOTE: Z's response must always come from the LLM (no rule-based responder).
   * The client provides a compact dialogue representation (DR) + an action spec (DM decision).
   */
  fastify.post(
    '/ai/conception/chat',
    {
      schema: {
        description: 'Conception chat - ideation conversation for Full-AI mode',
        tags: ['AI'],
        security,
        body: {
          type: 'object',
          required: ['action', 'dr', 'message'],
          properties: {
            message: { type: 'string' }, // raw user message (latest)
            action: { type: 'object' }, // DM decision (opaque for now)
            dr: { type: 'object' }, // dialogue representation (opaque JSON)
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
        const body = request.body as {
          message: string;
          action: unknown;
          dr: unknown;
          model?: AIModel;
        };

        const message = String(body.message ?? '').trim();
        if (!message) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Message is required' },
          };
          return reply.status(400).send(response);
        }

        const service = getAIService();

        // The behavior policy below is included as overall guiding principles (not brittle heuristics).
        const system = `You are Z, the Zadoox ideation agent.

You are collaborating with a user to develop an idea for a document from a blank page.

BEHAVIOR GUIDELINES (apply holistically; do not follow rigid turn-based scripts):
- Listen-first early: encourage the user to talk; brief, non-salesy acknowledgements; ask a clarifying question only when it materially improves correctness or prevents drift.
- Expert collaborator vibe: actively listen, help clarify, gently keep the ideation on track.
- Earned directness later: as alignment builds, you may become more direct—sharpen framing, ask for differentiator/research questions, nudge toward approach/evaluation—without turning it into outline-writing.
- One good question at a time: avoid interrogating; keep prompts lightweight (often 0–1 questions).
- Do NOT echo or quote the user's text.
- Avoid step/checklist language ("Step 1", "Next, fill in...").
- Do not repeat questions once answered (use DR.dm asked/answered slots).
- You are NOT writing the document yet. You are helping ideate and clarify.

Output MUST be valid JSON: { "assistantText": string } (no extra keys).`;

        const user = `DIALOGUE REPRESENTATION (DR):
${JSON.stringify(body.dr ?? {}, null, 2)}

DM ACTION SPEC:
${JSON.stringify(body.action ?? {}, null, 2)}

LATEST USER MESSAGE:
${message}

Respond as Z with one concise message that follows the DM action spec and the rules. Return ONLY the JSON object.`;

        const raw = await service.chatJson({ system, user, temperature: 0.35 }, body.model);
        const parsed = raw as { assistantText?: unknown };
        const assistantText = typeof parsed?.assistantText === 'string' ? parsed.assistantText.trim() : '';
        if (!assistantText) throw new Error('AI returned empty assistantText');

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
   * POST /api/v1/ai/conception/extract-ig
   * Extract high-signal IdeaGraph updates from the latest user message.
   *
   * Goal: avoid “junk nodes” by extracting only core topics / questions / constraints that the user
   * clearly signaled as important.
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
        const system = `You are extracting a compact IdeaGraph update from a user's message during ideation.

Your job is to extract ONLY high-signal items that the user clearly expressed or clearly cares about.

Rules:
- Prefer short gists (2–6 words) for labels. No full sentences.
- Capture core topic(s), key question(s), constraints/assumptions, and explicit goals.
- Do NOT invent details that are not implied by the user's words.
- Do NOT return "junk" meta labels like: "idea", "discussion", "thoughts", "help", "question".

Hard requirement:
- If the latest user message contains any substantive topic (not just "hi/ok/thanks"), you MUST output at least ONE node for the main topic or main question.
  If you're unsure, output exactly 1 node with state="topic" and confidence=0.55 using the clearest gist from the message.

Examples:
- Message: "I want to write about how ideas become tangible assets"
  Nodes: [{label:"ideas → tangible assets", state:"topic", confidence:0.7, facets:[]}]
- Message: "How do we prevent retrieval from breaking consistency?"
  Nodes: [{label:"retrieval vs consistency", state:"question", confidence:0.7, facets:[]}]

Return JSON only with this exact shape:
{
  "nodes": [
    { "label": "...", "state": "topic|question|constraint|assumption|hypothesis|requirement|example", "confidence": 0.0-1.0, "facets": ["..."] }
  ],
  "edges": [
    { "srcLabel": "...", "dstLabel": "...", "confidence": 0.0-1.0 }
  ]
}`;

        const user = `DR (context, may help avoid repeats):
${JSON.stringify(body.dr ?? {}, null, 2)}

LATEST USER MESSAGE:
${message}

Extract IdeaGraph updates. Return ONLY the JSON.`;

        const ExtractIG = z.object({
          nodes: z
            .array(
              z.object({
                label: z.string().min(1),
                state: z.string().min(1),
                confidence: z.number().min(0).max(1),
                facets: z.array(z.string()).optional().default([]),
              })
            )
            .default([]),
          edges: z
            .array(
              z.object({
                srcLabel: z.string().min(1),
                dstLabel: z.string().min(1),
                confidence: z.number().min(0).max(1),
              })
            )
            .default([]),
        });

        const raw = await service.chatJson({ system, user, temperature: 0.2 }, body.model);
        const parsed = ExtractIG.parse(raw);
        const nodes = parsed.nodes;
        const edges = parsed.edges;

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
   * Two-stage ideation agent:
   * - stage controller (Discovery <-> Conclusion) with a convergence score
   * - scribe extracts Key Points (KPs) into the IdeaGraph with evidence pointers
   */
  fastify.post(
    '/ai/conception/two-stage/step',
    {
      schema: {
        description: 'Conception two-stage step - returns assistant text + stage + KP/IG deltas',
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
                  stage: { type: 'string', enum: ['discovery', 'conclusion'] },
                  convergenceScore: { type: 'number' },
                  kps: {
                    type: 'object',
                    properties: {
                      add: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            label: { type: 'string' },
                            kpType: { type: 'string' },
                            status: { type: 'string' },
                            confidence: { type: 'number' },
                            facets: { type: 'array', items: { type: 'string' } },
                            evidenceTurnIds: { type: 'array', items: { type: 'string' } },
                          },
                        },
                      },
                      strengthen: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            label: { type: 'string' },
                            confidenceDelta: { type: 'number' },
                            evidenceTurnIds: { type: 'array', items: { type: 'string' } },
                          },
                        },
                      },
                      supersede: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            oldLabel: { type: 'string' },
                            newLabel: { type: 'string' },
                            evidenceTurnIds: { type: 'array', items: { type: 'string' } },
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
                            rel: { type: 'string' },
                            status: { type: 'string' },
                            confidence: { type: 'number' },
                            evidenceTurnIds: { type: 'array', items: { type: 'string' } },
                          },
                        },
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

        // (1) Dialogue management (DM): stage controller + assistant response.
        // IMPORTANT: DM is separate from Key Point extraction.
        const dmSystem = `You are Z, the Zadoox ideation agent for article-like documents.

You must run TWO coupled processes per turn:
1) Stage controller: choose stage = Discovery or Conclusion, and update convergenceScore in [0,1].
   - Discovery: maximize idea throughput without interrogating; suggest angles; optional forks; 0-1 questions max.
   - Conclusion: shape toward a document; be more direct; ask only missing material questions; 0-2 questions max.
   - This is NOT time-based. Use conversational signals (decisive language, novelty rate drops, outline/summary requests, adoption of synthesis).
   - Allow reversals (if user explores new branches, shift toward Discovery).

Behavior rules:
- Do NOT expose mechanics ("should I save X?").
- Do NOT echo/quote the user.
- Avoid checklist tone.

Return ONLY valid JSON with this exact shape:
{
  "assistantText": string,
  "stage": "discovery"|"conclusion",
  "convergenceScore": number
}
`;

        const dmUser = `DR (recent transcript + current KPs, may include uiPinnedKps with explicit references):
${JSON.stringify(body.dr ?? {}, null, 2)}

LATEST USER MESSAGE:
${message}

Produce the JSON response.`;

        const DMResponse = z.object({
          assistantText: z.string().min(1),
          stage: z.enum(['discovery', 'conclusion']),
          convergenceScore: z.number().min(0).max(1),
        });

        const dmRaw = await service.chatJson({ system: dmSystem, user: dmUser, temperature: 0.35 }, body.model);
        const dm = DMResponse.parse(dmRaw);

        const assistantText = dm.assistantText.trim();
        const stage = dm.stage;
        const convergenceScore = dm.convergenceScore;

        // (2) Key Point extraction (stage-agnostic): extract KPs from the turns (including the new assistant turn).
        const drAny = (body.dr ?? {}) as any;
        const lastTurns = Array.isArray(drAny?.lastTurns) ? drAny.lastTurns : [];
        const kpTurns = [
          ...lastTurns,
          { id: 't-assistant-latest', role: 'assistant', content: assistantText },
        ];

        const kpSystem = `You are a Key Point extractor for an ideation chat.

Extract Key Points (KPs) from the dialogue turns. KPs do NOT depend on dialogue stage.

Rules:
- Labels should be meaningful short sentences/claims/questions when possible (aim 6–14 words). Avoid tiny fragments unless the input is tiny.
- Prefer capturing: core topic(s), goals, constraints, questions, approaches, and concrete proposed angles.
- If a turn contains multiple distinct concrete items (examples, named methods/tech, enumerations), split them into multiple KPs rather than one generic KP.
- Tag provenance with facets:
  - User-origin KPs MUST include "src:user"
  - Assistant-origin KPs MUST include "src:assistant"
- Mark user-origin KPs as "accepted" only when the user clearly asserts/adopts them; otherwise "proposed".
- Assistant-origin KPs should usually be "proposed" (unless the user explicitly adopts them later).
- Every KP and edge MUST include evidenceTurnIds. Use the most relevant turn id(s) from the provided turns.
- Output multiple KPs when the turns contain multiple clear signals (typically 2–6).
- RELATIONS: when a new KP clearly relates to existing KPs, add edges to connect them using rel in:
  supports | depends_on | contrasts_with | elaborates
  If the user responds *about* a prior KP, add an edge from the new KP to that prior KP (usually elaborates/supports).
- Edge confidence: if you emit an edge, set confidence in [0.55, 0.85] depending on how explicit the relation is.

Hard requirements:
- If you output 2+ KPs in add, you MUST emit at least 1 edge in edges linking two KPs (use the most obvious relation).
- Use srcLabel/dstLabel that match the exact label text of KPs (either from EXISTING KP LABELS or from your add list). Do not invent new labels only for edges.
- If the provided turns include an assistant turn with substantive content, you MUST include at least 1 "src:assistant" proposed KP derived from it.
- If the latest assistant turn is substantive and contains 2+ distinct concrete details (e.g., "AI", "big data analytics", "collaborative platforms", examples, specific mechanisms),
  you MUST output at least 2 assistant-origin KPs (src:assistant) capturing those distinct details (not one generic umbrella).
 - Content-driven granularity (IMPORTANT): Create ONE assistant-origin KP per distinct concrete item/mechanism/example mentioned in the latest assistant turn.
   - If the assistant mentions multiple tools/technologies (e.g., AI, data analytics, collaboration platforms), each should become its own KP (unless two are truly inseparable in the text).
   - If the assistant gives an explicit mechanism ("by providing insights into consumer behavior"), extract that mechanism as its own KP.
   - Do NOT collapse multiple distinct items into an umbrella label like "Research on X" when the paragraph contains multiple concrete claims.
 - Avoid generic prefixes in labels (unless the text is actually generic): do NOT start every assistant KP with "Research on" / "Exploring" / "Analyzing". Prefer the actual claim.
 - Evidence IDs: Any KP derived from the latest assistant turn MUST include "t-assistant-latest" in evidenceTurnIds.

Example (illustrative only — do not copy text verbatim):
Assistant says: "AI and data analytics can spark new ideas by identifying market trends. Open innovation platforms enable collaboration and idea sharing."
Expected assistant KPs reflect each distinct concrete item/mechanism, e.g.:
- "AI can inspire ideas by surfacing emerging market trends"
- "Data analytics reveals consumer behavior to guide ideation"
- "Open innovation platforms enable collaboration and idea sharing"
and at least one edge connecting them (often elaborates/supports).

Return ONLY JSON with this exact shape:
{
  "add": [{ "label": string, "kpType": string, "status": "accepted"|"proposed", "confidence": number, "facets": string[], "evidenceTurnIds": string[] }],
  "strengthen": [{ "label": string, "confidenceDelta": number, "evidenceTurnIds": string[] }],
  "supersede": [{ "oldLabel": string, "newLabel": string, "evidenceTurnIds": string[] }],
  "edges": [{ "srcLabel": string, "dstLabel": string, "rel": "supports"|"depends_on"|"contrasts_with"|"elaborates", "status": "accepted"|"proposed", "confidence": number, "evidenceTurnIds": string[] }]
}`;

        const existingLabels =
          Array.isArray((drAny as any)?.ideaGraph?.nodes) ? (drAny as any).ideaGraph.nodes.map((n: any) => String(n?.label ?? '').trim()).filter(Boolean) : [];

        const uiPinnedKps =
          Array.isArray((drAny as any)?.uiPinnedKps)
            ? (drAny as any).uiPinnedKps
                .map((x: any) => ({
                  id: String(x?.id ?? '').trim(),
                  label: String(x?.label ?? '').trim(),
                }))
                .filter((x: any) => x.id && x.label)
                .slice(0, 6)
            : [];

        const kpUser = `EXISTING KP LABELS (if any):
${JSON.stringify(existingLabels.slice(0, 60), null, 2)}

UI PINNED KPs (explicit references from the chat composer, if any):
${JSON.stringify(uiPinnedKps, null, 2)}

TURNS (most recent last):
${JSON.stringify(kpTurns, null, 2)}

NOTE: The DR may include uiPinnedKps (explicit user-selected references). If present, treat those as the intended targets of "this/that/the selected item",
and prefer emitting edges that connect new KPs to those pinned KPs when relevant.
When uiPinnedKps is present and the latest user turn is discussing that referenced KP, DO NOT create a brand-new unrelated root topic.
Instead, add 1–3 child KPs that elaborate the pinned KP and connect them with rel="elaborates" (or supports/depends_on if more precise).
Hard requirement for pinned KPs:
- If UI PINNED KPs is non-empty and you add any new KPs that are responses (e.g., research, examples, details), you MUST emit at least one rel="elaborates" edge
  from a pinned parent label to each such child (parent -> child). Use exact labels.
Directionality for edges:
- For rel="elaborates": srcLabel = parent (more general), dstLabel = child (more specific).
- For rel="supports": srcLabel supports dstLabel (evidence/argument -> claim).
- For rel="depends_on": srcLabel depends on dstLabel (thing -> prerequisite).

Extract KPs from these turns. Return ONLY the JSON.`;

        const KP = z.object({
          add: z.array(
            z.object({
              label: z.string().min(1),
              kpType: z.string().min(1),
              status: z.enum(['accepted', 'proposed']),
              confidence: z.number().min(0).max(1),
              facets: z.array(z.string()).default([]),
              evidenceTurnIds: z.array(z.string()).min(1),
            })
          ),
          strengthen: z.array(z.any()).default([]),
          supersede: z.array(z.any()).default([]),
          edges: z
            .array(
              z.object({
                srcLabel: z.string().min(1),
                dstLabel: z.string().min(1),
                rel: z.enum(['supports', 'depends_on', 'contrasts_with', 'elaborates']),
                status: z.enum(['accepted', 'proposed']),
                confidence: z.number().min(0).max(1),
                evidenceTurnIds: z.array(z.string()).min(1),
              })
            )
            .default([]),
        });

        const kpRaw = await service.chatJson({ system: kpSystem, user: kpUser, temperature: 0.25 }, body.model);
        const kps = KP.parse(kpRaw);

        const response: ApiResponse<{ assistantText: string; stage: 'discovery' | 'conclusion'; convergenceScore: number; kps: unknown }> = {
          success: true,
          data: { assistantText, stage, convergenceScore, kps },
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
   * POST /api/v1/ai/conception/two-stage/simulate-user
   * Generate a simulated USER message (for the Sim button).
   *
   * The simulator should:
   * - be consistent with the conversation so far
   * - usually answer the last assistant question if one was asked
   * - occasionally introduce a small new detail, but not derail the thread
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

        const system = `You are simulating the USER in an ideation chat with an assistant named Z.

Goal: produce ONE realistic next user message that continues the conversation naturally.

Rules:
- Do NOT mention that you are simulated.
- Keep it 1–3 sentences.
- If Z asked a direct question most recently, answer it.
- Otherwise, add one concrete detail or preference that advances the ideation.
- Do not derail into a new unrelated topic.
- No meta-commentary about prompts, LLMs, or the system.

Return ONLY JSON: { "message": string }`;

        const user = `DIALOGUE REPRESENTATION (DR):
${JSON.stringify(body.dr ?? {}, null, 2)}

Generate the next user message as JSON only.`;

        const raw = await service.chatJson({ system, user, temperature: 0.6 }, body.model);
        const parsed = raw as { message?: unknown };
        const message = typeof parsed?.message === 'string' ? parsed.message.trim() : '';
        if (!message) throw new Error('AI returned empty simulated user message');

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
        // Treat body as unknown at runtime; Fastify schema validates shape.
        // This avoids tight coupling to shared types during iterative API evolution.
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
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' },
          };
          return reply.status(400).send(response);
        }
        const sourceStr = typeof source === 'string' ? source : String(source ?? '');
        if (sourceStr.trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Source is required' },
          };
          return reply.status(400).send(response);
        }
        const kindStr = typeof kind === 'string' ? kind : String(kind ?? '');
        if (kindStr.trim().length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Kind is required' },
          };
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
        const fallbackResult: { type: 'clarify'; question: string; suggestions: string[] } = {
          type: 'clarify',
          question: 'I could not produce a safe component update. What exactly should change?',
          // Frontend derives suggestions from capabilities (adapter/IR-defined). Keep backend generic.
          suggestions: [],
        };
        const result = parsed.success ? parsed.data : fallbackResult;

        const modelInfo = service.getModelInfo(modelVal || 'openai');
        const data: ComponentEditResponse =
          result.type === 'clarify'
            ? {
                type: 'clarify',
                question: result.question,
                suggestions: result.suggestions,
                model: modelInfo?.id || 'unknown',
              }
            : {
                type: 'update',
                updatedXmd: result.updatedXmd,
                summary: result.summary,
                confirmationQuestion: result.confirmationQuestion,
                model: modelInfo?.id || 'unknown',
              };
        const response: ApiResponse<ComponentEditResponse> = {
          success: true,
          data,
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

