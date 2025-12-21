/**
 * Projects API Routes
 */

import { FastifyInstance } from 'fastify';
import { ProjectService } from '../../services/project-service.js';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import {
  CreateProjectInput,
  UpdateProjectInput,
  ApiResponse,
  Project,
} from '@zadoox/shared';

export async function projectRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateUser);

  /**
   * GET /api/v1/projects
   * List all projects for the authenticated user
   */
  fastify.get('/projects', async (request: AuthenticatedRequest, reply) => {
    try {
      const projectService = new ProjectService(request.supabase!);
      const projects = await projectService.listUserProjects(request.userId!);

      const response: ApiResponse<Project[]> = {
        success: true,
        data: projects,
      };
      return reply.send(response);
    } catch (error: any) {
      fastify.log.error(error);
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to list projects',
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
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id } = request.params as { id: string };
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
      } catch (error: any) {
        fastify.log.error(error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: error.message || 'Failed to get project',
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
  fastify.post('/projects', async (request: AuthenticatedRequest, reply) => {
    try {
      const body = request.body as CreateProjectInput;
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
    } catch (error: any) {
      fastify.log.error(error);
      const statusCode = error.message.includes('Invalid') ? 400 : 500;
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
          message: error.message || 'Failed to create project',
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
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as UpdateProjectInput;
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
      } catch (error: any) {
        fastify.log.error(error);
        let statusCode = 500;
        if (error.message.includes('not found')) statusCode = 404;
        else if (error.message.includes('Invalid')) statusCode = 400;

        const response: ApiResponse<null> = {
          success: false,
          error: {
            code:
              statusCode === 404
                ? 'NOT_FOUND'
                : statusCode === 400
                ? 'VALIDATION_ERROR'
                : 'INTERNAL_ERROR',
            message: error.message || 'Failed to update project',
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
    async (request: AuthenticatedRequest, reply) => {
      try {
        const { id } = request.params as { id: string };
        const projectService = new ProjectService(request.supabase!);
        await projectService.deleteProject(id, request.userId!);

        const response: ApiResponse<null> = {
          success: true,
        };
        return reply.send(response);
      } catch (error: any) {
        fastify.log.error(error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: error.message || 'Failed to delete project',
          },
        };
        return reply.status(statusCode).send(response);
      }
    }
  );
}

