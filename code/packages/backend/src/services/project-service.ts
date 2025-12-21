/**
 * Project Service
 * Handles business logic for project operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectType,
} from '@zadoox/shared';
import { isValidProjectType } from '@zadoox/shared';
import { generateId } from '@zadoox/shared';

export class ProjectService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a new project
   */
  async createProject(
    input: CreateProjectInput,
    ownerId: string
  ): Promise<Project> {
    // Validate project type
    if (!isValidProjectType(input.type)) {
      throw new Error(`Invalid project type: ${input.type}`);
    }

    const projectData = {
      id: generateId(),
      name: input.name,
      description: input.description || null,
      type: input.type,
      owner_id: ownerId,
      settings: {
        defaultFormat: input.settings?.defaultFormat || 'latex',
        chapterNumbering: input.settings?.chapterNumbering ?? true,
        autoSync: input.settings?.autoSync ?? true,
      },
    };

    const { data, error } = await this.supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }

    return this.mapDbProjectToProject(data);
  }

  /**
   * Get a project by ID
   */
  async getProjectById(projectId: string, userId: string): Promise<Project> {
    const { data, error } = await this.supabase
      .from('projects')
      .select()
      .eq('id', projectId)
      .eq('owner_id', userId)
      .single();

    if (error || !data) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return this.mapDbProjectToProject(data);
  }

  /**
   * Update a project
   */
  async updateProject(
    projectId: string,
    input: UpdateProjectInput,
    userId: string
  ): Promise<Project> {
    // Verify project exists and user owns it
    await this.getProjectById(projectId, userId);

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined)
      updateData.description = input.description || null;
    if (input.type !== undefined) {
      if (!isValidProjectType(input.type)) {
        throw new Error(`Invalid project type: ${input.type}`);
      }
      updateData.type = input.type;
    }
    if (input.settings !== undefined) {
      // Merge with existing settings
      const existing = await this.getProjectById(projectId, userId);
      updateData.settings = {
        ...existing.settings,
        ...input.settings,
      };
    }

    const { data, error } = await this.supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .eq('owner_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }

    return this.mapDbProjectToProject(data);
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    // Verify project exists and user owns it
    await this.getProjectById(projectId, userId);

    const { error } = await this.supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('owner_id', userId);

    if (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }

  /**
   * List all projects for a user
   */
  async listUserProjects(userId: string): Promise<Project[]> {
    const { data, error } = await this.supabase
      .from('projects')
      .select()
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list projects: ${error.message}`);
    }

    return (data || []).map((p) => this.mapDbProjectToProject(p));
  }

  /**
   * Map database project to Project type
   */
  private mapDbProjectToProject(dbProject: any): Project {
    return {
      id: dbProject.id,
      name: dbProject.name,
      description: dbProject.description || undefined,
      type: dbProject.type as ProjectType,
      settings: dbProject.settings,
      ownerId: dbProject.owner_id,
      createdAt: new Date(dbProject.created_at),
      updatedAt: new Date(dbProject.updated_at),
    };
  }
}

