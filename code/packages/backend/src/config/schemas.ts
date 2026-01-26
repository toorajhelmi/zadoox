/**
 * OpenAPI schema definitions
 */

export const schemas = {
  // Project schemas
  Project: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: 'string', nullable: true },
      type: { type: 'string', enum: ['academic', 'industry', 'code-docs', 'other'] },
      settings: {
        type: 'object',
        properties: {
          defaultFormat: { type: 'string', enum: ['latex', 'markdown'] },
          chapterNumbering: { type: 'boolean' },
          autoSync: { type: 'boolean' },
          editingMode: { type: 'string', enum: ['ai-assist', 'full-ai'] },
        },
        required: ['defaultFormat', 'chapterNumbering', 'autoSync'],
      },
      ownerId: { type: 'string', format: 'uuid' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'name', 'type', 'settings', 'ownerId', 'createdAt', 'updatedAt'],
  },

  CreateProjectInput: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      type: { type: 'string', enum: ['academic', 'industry', 'code-docs', 'other'] },
      settings: {
        type: 'object',
        properties: {
          defaultFormat: { type: 'string', enum: ['latex', 'markdown'] },
          chapterNumbering: { type: 'boolean' },
          autoSync: { type: 'boolean' },
          editingMode: { type: 'string', enum: ['ai-assist', 'full-ai'] },
        },
      },
    },
    required: ['name', 'type'],
  },

  UpdateProjectInput: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000 },
      type: { type: 'string', enum: ['academic', 'industry', 'code-docs', 'other'] },
      settings: {
        type: 'object',
        properties: {
          defaultFormat: { type: 'string', enum: ['latex', 'markdown'] },
          chapterNumbering: { type: 'boolean' },
          autoSync: { type: 'boolean' },
          editingMode: { type: 'string', enum: ['ai-assist', 'full-ai'] },
        },
      },
    },
  },

  // Document schemas
  Document: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      projectId: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      content: { type: 'string' },
      // Phase 17: LaTeX manifest/ref stored separately (not in metadata).
      latex: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
      },
      metadata: {
        type: 'object',
        // IMPORTANT: document metadata is extensible (paragraphModes, researchSessions, lastEditedFormat, etc).
        // If we don't allow additional properties here, Fastify's response serializer will drop them.
        additionalProperties: true,
        properties: {
          chapterNumber: { type: 'number', nullable: true },
          type: { type: 'string', enum: ['chapter', 'section', 'standalone'] },
          order: { type: 'number', nullable: true },
          lastEditedFormat: { type: 'string', enum: ['latex', 'markdown'], nullable: true },
          irHashAtLastSync: { type: 'string', nullable: true },
        },
        required: ['type'],
      },
      // Phase 15: store SG separately from metadata to avoid mixing large payloads.
      semanticGraph: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
      },
      version: { type: 'number' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      authorId: { type: 'string', format: 'uuid' },
    },
    required: [
      'id',
      'projectId',
      'title',
      'content',
      'metadata',
      'version',
      'createdAt',
      'updatedAt',
      'authorId',
    ],
  },

  CreateDocumentInput: {
    type: 'object',
    properties: {
      projectId: { type: 'string', format: 'uuid' },
      title: { type: 'string', minLength: 1, maxLength: 255 },
      content: { type: 'string' },
      latex: { type: 'object', nullable: true, additionalProperties: true },
      semanticGraph: { type: 'object', nullable: true, additionalProperties: true },
      metadata: {
        type: 'object',
        additionalProperties: true,
        properties: {
          chapterNumber: { type: 'number' },
          type: { type: 'string', enum: ['chapter', 'section', 'standalone'] },
          order: { type: 'number' },
          lastEditedFormat: { type: 'string', enum: ['latex', 'markdown'] },
          irHashAtLastSync: { type: 'string' },
        },
      },
    },
    required: ['projectId', 'title'],
  },

  UpdateDocumentInput: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 255 },
      content: { type: 'string' },
      latex: { type: 'object', nullable: true, additionalProperties: true },
      metadata: {
        type: 'object',
        additionalProperties: true,
        properties: {
          chapterNumber: { type: 'number' },
          type: { type: 'string', enum: ['chapter', 'section', 'standalone'] },
          order: { type: 'number' },
          lastEditedFormat: { type: 'string', enum: ['latex', 'markdown'] },
          irHashAtLastSync: { type: 'string' },
        },
      },
      semanticGraph: { type: 'object', nullable: true, additionalProperties: true },
    },
  },

  // API Response schemas
  ApiResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      // IMPORTANT: many endpoints return different data payload shapes.
      // If we don't allow additionalProperties here, Fastify's response serializer
      // (fast-json-stringify) may drop nested fields and return `{}`.
      data: { type: 'object', nullable: true, additionalProperties: true },
      error: {
        type: 'object',
        nullable: true,
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: {},
        },
      },
    },
    required: ['success'],
  },

  ApiError: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      message: { type: 'string' },
      details: {},
    },
    required: ['code', 'message'],
  },
};

export const security = [{ bearerAuth: [] }];

