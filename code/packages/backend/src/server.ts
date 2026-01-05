import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { v1Routes } from './routes/v1/index.js';
import { swaggerConfig, swaggerUiConfig } from './config/swagger.js';

// Load env from the backend package directory (not process.cwd()) so `.env` edits take effect
// as long as the backend is restarted, regardless of where you run `pnpm dev` from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env.local'), override: true });

const server = Fastify({
  logger: true,
  // Support image uploads (base64) without immediately hitting the default 1MB body limit.
  // For large media (video), we'll move to direct-to-storage uploads instead of base64 JSON.
  bodyLimit: 25 * 1024 * 1024, // 25MB
});

const start = async () => {
  try {
    // Wrap validation errors (and any default Fastify errors) into our ApiResponse shape.
    // This prevents response-schema serialization failures and gives the client a consistent error format.
    server.setErrorHandler((err, _req, reply) => {
      const anyErr = err as any;
      const statusCode = typeof anyErr?.statusCode === 'number' ? anyErr.statusCode : 500;
      const code =
        anyErr?.code === 'FST_ERR_VALIDATION'
          ? 'VALIDATION_ERROR'
          : typeof anyErr?.code === 'string'
            ? anyErr.code
            : 'INTERNAL_ERROR';
      const message = typeof anyErr?.message === 'string' && anyErr.message.trim().length > 0 ? anyErr.message : 'Request failed';
      const details = anyErr?.validation || anyErr?.validationContext ? { validation: anyErr.validation, validationContext: anyErr.validationContext } : undefined;
      reply.status(statusCode).send({ success: false, error: { code, message, details } });
    });

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

