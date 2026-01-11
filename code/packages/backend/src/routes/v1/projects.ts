/**
 * Projects API Routes
 */

import { FastifyInstance } from 'fastify';
import { ProjectService } from '../../services/project-service.js';
import { DocumentService } from '../../services/document-service.js';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import {
  CreateProjectInput,
  UpdateProjectInput,
  ApiResponse,
  Project,
} from '@zadoox/shared';
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdSchema,
} from '../../validation/schemas.js';
import { schemas, security } from '../../config/schemas.js';

export async function projectRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateUser);

  /**
   * GET /api/v1/projects
   * List all projects for the authenticated user
   */
  fastify.get(
    '/projects',
    {
      schema: {
        description: 'List all projects for the authenticated user',
        tags: ['Projects'],
        security,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: schemas.Project,
              },
            },
            required: ['success'],
          },
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
    try {
      const projectService = new ProjectService(request.supabase!);
      const projects = await projectService.listUserProjects(request.userId!);

      const response: ApiResponse<Project[]> = {
        success: true,
        data: projects,
      } as ApiResponse<Project[]>;
      return reply.send(response);
    } catch (error: unknown) {
      fastify.log.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to list projects';
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: errorMessage,
        },
      };
      return reply.status(500).send(response);
    }
  });

  /**
   * GET /api/v1/projects/:id
   * Get a single project by ID
   */
  fastify.get(
    '/projects/:id',
    {
      schema: {
        description: 'Get a single project by ID',
        tags: ['Projects'],
        security,
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: schemas.Project,
            },
            required: ['success'],
          },
          400: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        // Validate route parameters
        const paramValidation = projectIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid project ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { id } = paramValidation.data;
        const projectService = new ProjectService(request.supabase!);
        const project = await projectService.getProjectById(
          id,
          request.userId!
        );

        const response: ApiResponse<Project> = {
          success: true,
          data: project,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get project';
        const statusCode = errorMessage.includes('not found') ? 404 : 500;
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: errorMessage,
          },
        };
        return reply.status(statusCode).send(response);
      }
    }
  );

  /**
   * POST /api/v1/projects
   * Create a new project
   */
  fastify.post(
    '/projects',
    {
      schema: {
        description: 'Create a new project',
        tags: ['Projects'],
        security,
        body: schemas.CreateProjectInput,
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: schemas.Project,
            },
            required: ['success'],
          },
          400: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
    try {
      // Validate request body
      const validationResult = createProjectSchema.safeParse(request.body);
      if (!validationResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: validationResult.error.errors,
          },
        };
        return reply.status(400).send(response);
      }

      const body = validationResult.data as CreateProjectInput;
      const projectService = new ProjectService(request.supabase!);
      const project = await projectService.createProject(
        body,
        request.userId!
      );

      const response: ApiResponse<Project> = {
        success: true,
        data: project,
      };
      return reply.status(201).send(response);
    } catch (error: unknown) {
      fastify.log.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create project';
      const statusCode = errorMessage.includes('Invalid') ? 400 : 500;
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
          message: errorMessage,
        },
      };
      return reply.status(statusCode).send(response);
    }
  });

  /**
   * PUT /api/v1/projects/:id
   * Update a project
   */
  fastify.put(
    '/projects/:id',
    {
      schema: {
        description: 'Update a project',
        tags: ['Projects'],
        security,
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: schemas.UpdateProjectInput,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: schemas.Project,
            },
            required: ['success'],
          },
          400: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        // Validate route parameters
        const paramValidation = projectIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid project ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        // Validate request body
        const bodyValidation = updateProjectSchema.safeParse(request.body);
        if (!bodyValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: bodyValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { id } = paramValidation.data;
        const body = bodyValidation.data as UpdateProjectInput;
        const projectService = new ProjectService(request.supabase!);
        const project = await projectService.updateProject(
          id,
          body,
          request.userId!
        );

        const response: ApiResponse<Project> = {
          success: true,
          data: project,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update project';
        let statusCode = 500;
        if (errorMessage.includes('not found')) statusCode = 404;
        else if (errorMessage.includes('Invalid')) statusCode = 400;

        const response: ApiResponse<null> = {
          success: false,
          error: {
            code:
              statusCode === 404
                ? 'NOT_FOUND'
                : statusCode === 400
                ? 'VALIDATION_ERROR'
                : 'INTERNAL_ERROR',
            message: errorMessage,
          },
        };
        return reply.status(statusCode).send(response);
      }
    }
  );

  /**
   * DELETE /api/v1/projects/:id
   * Delete a project
   */
  fastify.delete(
    '/projects/:id',
    {
      schema: {
        description: 'Delete a project',
        tags: ['Projects'],
        security,
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
            required: ['success'],
          },
          400: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        // Validate route parameters
        const paramValidation = projectIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid project ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { id } = paramValidation.data;
        const projectService = new ProjectService(request.supabase!);
        await projectService.deleteProject(id, request.userId!);

        const response: ApiResponse<null> = {
          success: true,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete project';
        const statusCode = errorMessage.includes('not found') ? 404 : 500;
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: errorMessage,
          },
        };
        return reply.status(statusCode).send(response);
      }
    }
  );

  /**
   * POST /api/v1/projects/:id/duplicate
   * Duplicate a project (and its documents)
   */
  fastify.post(
    '/projects/:id/duplicate',
    {
      schema: {
        description: 'Duplicate a project (and its documents)',
        tags: ['Projects'],
        security,
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: schemas.Project,
            },
            required: ['success'],
          },
          400: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const paramValidation = projectIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid project ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { id } = paramValidation.data;
        const projectService = new ProjectService(request.supabase!);
        const documentService = new DocumentService(request.supabase!);

        // Fetch source project (also verifies ownership via RLS)
        const sourceProject = await projectService.getProjectById(id, request.userId!);

        // Create duplicated project
        const newProjectInput: CreateProjectInput = {
          name: `Copy of ${sourceProject.name}`,
          description: sourceProject.description,
          type: sourceProject.type,
          settings: sourceProject.settings,
        };
        const newProject = await projectService.createProject(newProjectInput, request.userId!);

        // Duplicate documents (best-effort; if this fails, keep the new project)
        const docs = await documentService.listDocumentsByProject(id);
        for (const d of docs) {
          const created = await documentService.createDocument(
            {
              projectId: newProject.id,
              title: d.title,
              content: d.content,
              // createDocument only persists a subset; we re-apply full metadata below.
              metadata: {
                type: d.metadata?.type,
                chapterNumber: d.metadata?.chapterNumber,
                order: d.metadata?.order,
              },
            },
            request.userId!
          );

          // Preserve full metadata (latex cache, hashes, etc.) without creating a new version.
          await documentService.updateDocument(
            created.id,
            {
              metadata: d.metadata,
            },
            request.userId!,
            'auto-save',
            'Duplicate document metadata'
          );
        }

        const response: ApiResponse<Project> = {
          success: true,
          data: newProject,
        };
        return reply.status(201).send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate project';
        const statusCode = errorMessage.includes('not found') ? 404 : 500;
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: errorMessage,
          },
        };
        return reply.status(statusCode).send(response);
      }
    }
  );
}

