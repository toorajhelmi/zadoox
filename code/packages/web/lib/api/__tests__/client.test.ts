/**
 * Unit tests for API Client (Phase 5)
 */

/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { api, ApiError } from '../client';
import type { Project, CreateProjectInput, UpdateProjectInput } from '@zadoox/shared';

// Mock fetch globally
global.fetch = vi.fn();

// Mock Supabase client
const mockGetSession = vi.fn().mockResolvedValue({
  data: {
    session: {
      access_token: 'test-token',
    },
  },
});
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'test-user' } },
  error: null,
});

vi.mock('@/lib/supabase/client', () => {
  return {
    createClient: vi.fn(() => ({
      auth: {
        getUser: mockGetUser,
        getSession: mockGetSession,
      },
    })),
  };
});

describe('API Client - Projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    (global.fetch as any).mockClear();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user' } },
      error: null,
    });
    // Reset getSession mock to default
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'test-token',
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('api.projects.list', () => {
    it('should fetch and return list of projects', async () => {
      const mockProjects: Project[] = [
        {
          id: '1',
          name: 'Test Project',
          type: 'academic',
          ownerId: 'user-1',
          settings: {
            defaultFormat: 'latex',
            chapterNumbering: true,
            autoSync: true,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockProjects,
        }),
      });

      const result = await api.projects.list();

      expect(result).toEqual(mockProjects);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/projects',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should return empty array when no projects exist', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      });

      const result = await api.projects.list();

      expect(result).toEqual([]);
    });

    it('should throw ApiError on network failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const error = await api.projects.list().catch(e => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toContain('Failed to connect to API');
    });

    it('should throw ApiError on API error response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Server error',
          },
        }),
      });

      const error = await api.projects.list().catch(e => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toContain('Server error');
    });
  });

  describe('api.projects.get', () => {
    it('should fetch and return a single project', async () => {
      const mockProject: Project = {
        id: '1',
        name: 'Test Project',
        type: 'academic',
        ownerId: 'user-1',
        settings: {
          defaultFormat: 'latex',
          chapterNumbering: true,
          autoSync: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockProject,
        }),
      });

      const result = await api.projects.get('1');

      expect(result).toEqual(mockProject);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/projects/1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw ApiError when project not found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: null,
        }),
      });

      const error = await api.projects.get('999').catch(e => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toContain('Project not found');
    });
  });

  describe('api.projects.create', () => {
    it('should create a new project', async () => {
      const input: CreateProjectInput = {
        name: 'New Project',
        type: 'academic',
        description: 'Test description',
      };

      const mockProject: Project = {
        id: '2',
        name: 'New Project',
        type: 'academic',
        description: 'Test description',
        ownerId: 'user-1',
        settings: {
          defaultFormat: 'latex',
          chapterNumbering: true,
          autoSync: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockProject,
        }),
      });

      const result = await api.projects.create(input);

      expect(result).toEqual(mockProject);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw ApiError when creation fails', async () => {
      const input: CreateProjectInput = {
        name: 'New Project',
        type: 'academic',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: null,
        }),
      });

      const error = await api.projects.create(input).catch(e => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toContain('Failed to create project');
    });
  });

  describe('api.projects.duplicate', () => {
    it('should duplicate a project', async () => {
      const mockProject: Project = {
        id: '2',
        name: 'Copy of Project',
        type: 'academic',
        ownerId: 'user-1',
        settings: {
          defaultFormat: 'latex',
          chapterNumbering: true,
          autoSync: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockProject,
        }),
      });

      const result = await api.projects.duplicate('1');

      expect(result).toEqual(mockProject);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/projects/1/duplicate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('api.projects.update', () => {
    it('should update an existing project', async () => {
      const input: UpdateProjectInput = {
        name: 'Updated Project',
        description: 'Updated description',
      };

      const mockProject: Project = {
        id: '1',
        name: 'Updated Project',
        type: 'academic',
        description: 'Updated description',
        ownerId: 'user-1',
        settings: {
          defaultFormat: 'latex',
          chapterNumbering: true,
          autoSync: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockProject,
        }),
      });

      const result = await api.projects.update('1', input);

      expect(result).toEqual(mockProject);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/projects/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(input),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw ApiError when update fails', async () => {
      const input: UpdateProjectInput = {
        name: 'Updated Project',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: null,
        }),
      });

      const error = await api.projects.update('1', input).catch(e => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toContain('Failed to update project');
    });
  });

  describe('api.projects.delete', () => {
    it('should delete a project', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
        }),
      });

      await api.projects.delete('1');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/projects/1',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw ApiError when deletion fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
        }),
      });

      const error = await api.projects.delete('999').catch(e => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toContain('Project not found');
    });
  });

  describe('ApiError', () => {
    it('should create ApiError with correct properties', () => {
      const error = new ApiError('Test error', 'TEST_ERROR', 400, { detail: 'test' });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.status).toBe(400);
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.name).toBe('ApiError');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid JSON response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(api.projects.list()).rejects.toThrow(ApiError);
    });

    it('should handle non-JSON error response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      const error = await api.projects.list().catch(e => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toContain('Invalid response from server');
    });

    it('should handle missing authentication token gracefully', async () => {
      // Mock Supabase to return no session
      mockGetSession.mockResolvedValueOnce({
        data: {
          session: null,
        },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      });

      await api.projects.list();

      expect(global.fetch).toHaveBeenCalled();
      // Should still make the request even without token
    });
  });
});

