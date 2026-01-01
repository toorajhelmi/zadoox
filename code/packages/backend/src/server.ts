import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { v1Routes } from './routes/v1/index.js';
import { swaggerConfig, swaggerUiConfig } from './config/swagger.js';

const server = Fastify({
  logger: true,
  // Support image uploads (base64) without immediately hitting the default 1MB body limit.
  // For large media (video), we'll move to direct-to-storage uploads instead of base64 JSON.
  bodyLimit: 25 * 1024 * 1024, // 25MB
});

const start = async () => {
  try {
    // Register CORS plugin
    await server.register(cors, {
      origin: true, // Allow all origins in development (restrict in production)
      credentials: true,
    });

    // Register Swagger
    await server.register(swagger, swaggerConfig);
    await server.register(swaggerUi, swaggerUiConfig);

    // Health check endpoint (no auth required)
    server.get(
      '/health',
      {
        schema: {
          description: 'Health check endpoint',
          tags: ['Health'],
          response: {
            200: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                service: { type: 'string' },
              },
            },
          },
        },
      },
      async () => {
        return { status: 'ok', service: 'zadoox-backend' };
      }
    );

    // OpenAPI JSON endpoint (no auth required)
    server.get('/openapi.json', async () => {
      return server.swagger();
    });

    // Register API routes
    await server.register(v1Routes);

    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Backend server listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

