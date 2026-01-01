/**
 * API v1 Routes
 */

import { FastifyInstance } from 'fastify';
import { projectRoutes } from './projects.js';
import { documentRoutes } from './documents.js';
import { aiRoutes } from './ai.js';
import { versionRoutes } from './versions.js';
import { assetRoutes } from './assets.js';

export async function v1Routes(fastify: FastifyInstance) {
  // Register all v1 route modules
  await fastify.register(projectRoutes, { prefix: '/api/v1' });
  await fastify.register(documentRoutes, { prefix: '/api/v1' });
  await fastify.register(aiRoutes, { prefix: '/api/v1' });
  await fastify.register(versionRoutes, { prefix: '/api/v1' });
  await fastify.register(assetRoutes, { prefix: '/api/v1' });
}

