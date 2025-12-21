/**
 * Unit tests for ProjectService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectService } from '../project-service.js';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Project, CreateProjectInput, UpdateProjectInput } from '@zadoox/shared';

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockClient = {
    from: vi.fn(),
  } as unknown as SupabaseClient;

  return mockClient;
};

describe('ProjectService', () => {
  let service: ProjectService;
  let mockSupabase: SupabaseClient;
  let mockQueryBuilder: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    service = new ProjectService(mockSupabase);
    
    // Reset query builder mock
    mockQueryBuilder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    };
    
    vi.mocked(mockSupabase.from).mockReturnValue(mockQueryBuilder as any);
  });

  describe('createProject', () => {
    it('should create a project with valid input', async () => {
      const input: CreateProjectInput = {
        name: 'Test Project',
        description: 'Test description',
        type: 'academic',
        settings: {
          defaultFormat: 'latex',
          chapterNumbering: true,
          autoSync: false,
        },
      };

      const mockProject = {
        id: 'test-id',
        name: input.name,
        description: input.description,
        type: input.type,
        owner_id: 'user-id',
        settings: {
          defaultFormat: 'latex',
          chapterNumbering: true,
          autoSync: false,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: mockProject,
        error: null,
      });

      const result = await service.createProject(input, 'user-id');

      expect(result).toMatchObject({
        id: 'test-id',
        name: input.name,
        description: input.description,
        type: input.type,
        ownerId: 'user-id',
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('projects');
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(mockQueryBuilder.single).toHaveBeenCalled();
    });

    it('should use default settings if not provided', async () => {
      const input: CreateProjectInput = {
        name: 'Test Project',
        type: 'industry',
      };

      const mockProject = {
        id: 'test-id',
        name: input.name,
        description: null,
        type: input.type,
        owner_id: 'user-id',
        settings: {
          defaultFormat: 'latex',
          chapterNumbering: true,
          autoSync: true,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: mockProject,
        error: null,
      });

      const result = await service.createProject(input, 'user-id');

      expect(result.settings).toMatchObject({
        defaultFormat: 'latex',
        chapterNumbering: true,
        autoSync: true,
      });
    });

    it('should throw error for invalid project type', async () => {
      const input = {
        name: 'Test',
        type: 'invalid-type',
      } as CreateProjectInput;

      await expect(service.createProject(input, 'user-id')).rejects.toThrow(
        'Invalid project type'
      );
    });
  });

  describe('getProjectById', () => {
    it('should return project if found', async () => {
      const mockProject = {
        id: 'project-id',
        name: 'Test Project',
        description: 'Description',
        type: 'academic',
        owner_id: 'user-id',
        settings: { defaultFormat: 'latex', chapterNumbering: true, autoSync: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: mockProject,
        error: null,
      });

      const result = await service.getProjectById('project-id', 'user-id');

      expect(result.id).toBe('project-id');
      expect(result.name).toBe('Test Project');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'project-id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('owner_id', 'user-id');
    });

    it('should throw error if project not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.getProjectById('missing-id', 'user-id')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('updateProject', () => {
    it('should update project with valid input', async () => {
      const existingProject = {
        id: 'project-id',
        name: 'Old Name',
        description: 'Old Description',
        type: 'academic',
        owner_id: 'user-id',
        settings: { defaultFormat: 'latex', chapterNumbering: true, autoSync: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock getProjectById call
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: existingProject,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingProject, name: 'New Name' },
          error: null,
        });

      const update: UpdateProjectInput = {
        name: 'New Name',
      };

      const result = await service.updateProject('project-id', update, 'user-id');

      expect(result.name).toBe('New Name');
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });

    it('should merge settings when updating', async () => {
      const existingProject = {
        id: 'project-id',
        name: 'Test',
        type: 'academic',
        owner_id: 'user-id',
        settings: { defaultFormat: 'latex', chapterNumbering: true, autoSync: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: existingProject,
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ...existingProject,
            settings: { ...existingProject.settings, autoSync: false },
          },
          error: null,
        });

      const update: UpdateProjectInput = {
        settings: { autoSync: false },
      };

      const result = await service.updateProject('project-id', update, 'user-id');

      expect(result.settings.autoSync).toBe(false);
      expect(result.settings.defaultFormat).toBe('latex'); // Should preserve existing
    });
  });

  describe('deleteProject', () => {
    it('should delete project successfully', async () => {
      const existingProject = {
        id: 'project-id',
        name: 'Test',
        type: 'academic',
        owner_id: 'user-id',
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: existingProject,
        error: null,
      });

      mockQueryBuilder.delete.mockResolvedValue({
        data: null,
        error: null,
      });

      await service.deleteProject('project-id', 'user-id');

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'project-id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('owner_id', 'user-id');
    });
  });

  describe('listUserProjects', () => {
    it('should return list of projects', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Project 1',
          type: 'academic',
          owner_id: 'user-id',
          settings: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'project-2',
          name: 'Project 2',
          type: 'industry',
          owner_id: 'user-id',
          settings: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockQueryBuilder.order.mockResolvedValue({
        data: mockProjects,
        error: null,
      });

      const result = await service.listUserProjects('user-id');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('project-1');
      expect(result[1].id).toBe('project-2');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('owner_id', 'user-id');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });
  });
});

