import 'dotenv/config';
import Fastify from 'fastify';

const server = Fastify({
  logger: true,
});

// Health check endpoint
server.get('/health', async () => {
  return { status: 'ok', service: 'zadoox-backend' };
});

const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Backend server listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

