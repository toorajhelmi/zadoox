/**
 * SG (Semantic Graph) API Routes
 *
 * Keep SG code consolidated here (not embedded in generic AI routes).
 */

import { FastifyInstance } from 'fastify';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import { schemas, security } from '../../config/schemas.js';
import type { ApiResponse } from '@zadoox/shared';
import type { AIModel } from '../../services/ai/ai-service.js';
import { getSgAIService } from '../../services/ai/ai-service-singleton.js';
// NOTE: keep /sg/build compatible, but internal builder now provides nodes+edges helpers.
import { getSgBootstrapJob, startSgBootstrapJob } from '../../services/sg/sg-bootstrap-jobs.js';
import { buildSgConsistentGraphFromMiniGraphs, buildSgMiniGraphForBlocksOneShot } from '../../services/sg/sg-builder.js';
import { ensureNodeEmbeddings } from '../../services/sg/sg-embeddings-store.js';

export async function sgRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateUser);

  /**
   * POST /api/v1/sg/embeddings
   */
  fastify.post(
    '/sg/embeddings',
    {
      schema: {
        description: 'Compute embeddings for a batch of texts (SG)',
        tags: ['SG'],
        security,
        body: {
          type: 'object',
          required: ['texts'],
          properties: {
            texts: { type: 'array', items: { type: 'string' } },
            model: { type: 'string', enum: ['openai', 'auto'] },
          },
        },
        response: {
          200: schemas.ApiResponse,
          400: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { texts, model } = request.body as { texts: string[]; model?: AIModel };
        if (!Array.isArray(texts) || texts.length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'texts is required' },
          };
          return reply.status(400).send(response);
        }
        const service = getSgAIService();
        const vectors = await service.embedTexts(texts, model);
        const response: ApiResponse<{ vectors: number[][] }> = {
          success: true,
          data: { vectors },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to compute embeddings';
        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: errorMessage },
        };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * POST /api/v1/sg/build
   */
  fastify.post(
    '/sg/build',
    {
      schema: {
        description: 'Build SemanticGraph nodes+edges for a bounded block slice (SG)',
        tags: ['SG'],
        security,
        body: {
          type: 'object',
          required: ['documentId', 'blocks'],
          properties: {
            documentId: { type: 'string', format: 'uuid' },
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'type', 'text'],
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  text: { type: 'string' },
                },
              },
            },
            model: { type: 'string', enum: ['openai', 'auto'] },
          },
        },
        response: {
          200: schemas.ApiResponse,
          400: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { documentId, blocks, model } = request.body as {
          documentId: string;
          blocks: Array<{ id: string; type: string; text: string }>;
          model?: AIModel;
        };
        if (!documentId || typeof documentId !== 'string') {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'documentId is required' },
          };
          return reply.status(400).send(response);
        }
        if (!Array.isArray(blocks) || blocks.length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'blocks is required' },
          };
          return reply.status(400).send(response);
        }

        if (!request.supabase) throw new Error('Missing supabase client');
        // Use the SG-dedicated AI service so SG can use a stronger model without impacting other AI features.
        const sgService = getSgAIService();

        // One-shot mini-graph (nodes+edges) for this slice, then canonicalize (even if it's just one chunk)
        // so the output matches our bootstrap pipeline behavior.
        const mini = await buildSgMiniGraphForBlocksOneShot({
          service: sgService,
          chunkId: `${documentId}:adhoc`,
          blocks,
          model,
        });
        const built = await buildSgConsistentGraphFromMiniGraphs({
          service: sgService,
          miniNodes: mini.nodes,
          miniEdges: mini.edges,
          model,
        });
        await ensureNodeEmbeddings({ supabase: request.supabase, service: sgService, docId: documentId, nodes: built.sg.nodes, model });

        const response: ApiResponse<typeof built> = { success: true, data: built };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);

        // If AI isn't configured, return a clear error (so the client can surface it).
        const msg = error instanceof Error ? error.message : 'Failed to build semantic graph';
        const isMissingKey = typeof msg === 'string' && msg.includes('OPENAI_API_KEY');
        if (isMissingKey) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'AI_UNAVAILABLE',
              message: 'AI service is not configured on the backend (missing OPENAI_API_KEY).',
            },
          };
          return reply.status(503).send(response);
        }

        const response: ApiResponse<null> = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: msg },
        };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * POST /api/v1/sg/bootstrap/start
   *
   * Backend-orchestrated SG bootstrap job (nodes-first then edges), with progress polling.
   */
  fastify.post(
    '/sg/bootstrap/start',
    {
      schema: {
        description: 'Start SG bootstrap for a document (backend-orchestrated)',
        tags: ['SG'],
        security,
        body: {
          type: 'object',
          required: ['documentId', 'blocks'],
          properties: {
            documentId: { type: 'string', format: 'uuid' },
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'type', 'text'],
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  text: { type: 'string' },
                },
              },
            },
            model: { type: 'string', enum: ['openai', 'auto'] },
          },
        },
        response: {
          200: schemas.ApiResponse,
          400: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { documentId, blocks, model } = request.body as {
          documentId: string;
          blocks: Array<{ id: string; type: string; text: string }>;
          model?: AIModel;
        };
        if (!documentId || typeof documentId !== 'string') {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'documentId is required' } };
          return reply.status(400).send(response);
        }
        if (!Array.isArray(blocks) || blocks.length === 0) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'blocks is required' } };
          return reply.status(400).send(response);
        }
        if (!request.userId || !request.supabase) {
          const response: ApiResponse<null> = { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };
          return reply.status(401).send(response);
        }

        const service = getSgAIService();
        const started = startSgBootstrapJob({
          documentId,
          blocks,
          service,
          supabase: request.supabase,
          userId: request.userId,
          model,
        });
        const response: ApiResponse<{ jobId: string }> = { success: true, data: started };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const msg = error instanceof Error ? error.message : 'Failed to start SG bootstrap';
        const response: ApiResponse<null> = { success: false, error: { code: 'INTERNAL_ERROR', message: msg } };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * GET /api/v1/sg/bootstrap/status/:jobId
   */
  fastify.get(
    '/sg/bootstrap/status/:jobId',
    {
      schema: {
        description: 'Get SG bootstrap job status',
        tags: ['SG'],
        security,
        params: {
          type: 'object',
          required: ['jobId'],
          properties: {
            jobId: { type: 'string' },
          },
        },
        response: {
          200: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const params = request.params as { jobId?: string };
        const jobId = String(params?.jobId ?? '');
        const status = jobId ? getSgBootstrapJob(jobId) : null;
        if (!status) {
          const response: ApiResponse<null> = { success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } };
          return reply.status(404).send(response);
        }
        const response: ApiResponse<typeof status> = { success: true, data: status };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const msg = error instanceof Error ? error.message : 'Failed to get SG bootstrap status';
        const response: ApiResponse<null> = { success: false, error: { code: 'INTERNAL_ERROR', message: msg } };
        return reply.status(500).send(response);
      }
    }
  );

  return fastify;
}


