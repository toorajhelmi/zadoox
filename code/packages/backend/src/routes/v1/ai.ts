/**
 * AI API Routes
 *
 * Intentionally thin: this module only registers per-feature AI route modules.
 * Each feature module owns its own AI interactions (prompts, schemas, model selection).
 */

import type { FastifyInstance } from 'fastify';
import { authenticateUser } from '../../middleware/auth.js';
import { getAIService } from '../../services/ai/ai-service-singleton.js';
import { registerAiCoreRoutes } from './ai-core.js';
import { registerConceptionAiRoutes } from './ai-conception.js';
import { registerAiWritingRoutes } from './ai-writing.js';
import { registerAiBrainstormRoutes } from './ai-brainstorm.js';
import { registerAiDraftRoutes } from './ai-draft.js';
import { registerAiInlineRoutes } from './ai-inline.js';
import { registerAiComponentRoutes } from './ai-component.js';
import { registerAiImageRoutes } from './ai-images.js';

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

  await registerAiCoreRoutes(fastify);
  await registerConceptionAiRoutes(fastify);
  await registerAiWritingRoutes(fastify);
  await registerAiBrainstormRoutes(fastify);
  await registerAiDraftRoutes(fastify);
  await registerAiInlineRoutes(fastify);
  await registerAiComponentRoutes(fastify);
  await registerAiImageRoutes(fastify);

  return fastify;
}



