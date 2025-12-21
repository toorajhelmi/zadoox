import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { v1Routes } from './routes/v1/index.js';

const server = Fastify({
  logger: true,
});

const start = async () => {
  try {
    // Register CORS plugin
    await server.register(cors, {
      origin: true, // Allow all origins in development (restrict in production)
      credentials: true,
    });

    // Health check endpoint (no auth required)
    server.get('/health', async () => {
      return { status: 'ok', service: 'zadoox-backend' };
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

