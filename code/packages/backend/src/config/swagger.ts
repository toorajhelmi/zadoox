/**
 * OpenAPI/Swagger configuration
 */

export const swaggerConfig = {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'Zadoox API',
      description: 'Zadoox Backend API Documentation',
      version: '1.0.0',
      contact: {
        name: 'Zadoox API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http' as const,
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Bearer token authentication. Format: "Bearer {token}"',
        },
      },
    },
    tags: [
      { name: 'Projects', description: 'Project management endpoints' },
      { name: 'Documents', description: 'Document management endpoints' },
      { name: 'Health', description: 'Health check endpoint' },
    ],
  },
};

export const swaggerUiConfig = {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list' as const,
    deepLinking: true,
  },
  uiHooks: {
    onRequest: function (request: any, reply: any, next: any) {
      next();
    },
    preHandler: function (request: any, reply: any, next: any) {
      next();
    },
  },
  staticCSP: true,
  transformStaticCSP: (header: string) => header,
  transformSpecification: (swaggerObject: any, request: any, reply: any) => {
    return swaggerObject;
  },
  transformSpecificationClone: true,
};

