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
      type: { type: 'string', enum: ['academic', 'industry', 'code-docs'] },
      settings: {
        type: 'object',
        properties: {
          defaultFormat: { type: 'string', enum: ['latex', 'markdown'] },
          chapterNumbering: { type: 'boolean' },
          autoSync: { type: 'boolean' },
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
      type: { type: 'string', enum: ['academic', 'industry', 'code-docs'] },
      settings: {
        type: 'object',
        properties: {
          defaultFormat: { type: 'string', enum: ['latex', 'markdown'] },
          chapterNumbering: { type: 'boolean' },
          autoSync: { type: 'boolean' },
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
      type: { type: 'string', enum: ['academic', 'industry', 'code-docs'] },
      settings: {
        type: 'object',
        properties: {
          defaultFormat: { type: 'string', enum: ['latex', 'markdown'] },
          chapterNumbering: { type: 'boolean' },
          autoSync: { type: 'boolean' },
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
      metadata: {
        type: 'object',
        properties: {
          chapterNumber: { type: 'number', nullable: true },
          type: { type: 'string', enum: ['chapter', 'section', 'standalone'] },
          order: { type: 'number', nullable: true },
        },
        required: ['type'],
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
      metadata: {
        type: 'object',
        properties: {
          chapterNumber: { type: 'number' },
          type: { type: 'string', enum: ['chapter', 'section', 'standalone'] },
          order: { type: 'number' },
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
      metadata: {
        type: 'object',
        properties: {
          chapterNumber: { type: 'number' },
          type: { type: 'string', enum: ['chapter', 'section', 'standalone'] },
          order: { type: 'number' },
        },
      },
    },
  },

  // API Response schemas
  ApiResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {},
      error: {
        type: 'object',
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

