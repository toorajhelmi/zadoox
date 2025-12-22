/**
 * Project types
 */

export type ProjectType = 'academic' | 'industry' | 'code-docs' | 'other';

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: ProjectType;
  settings: ProjectSettings;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  defaultFormat: 'latex' | 'markdown';
  chapterNumbering: boolean;
  autoSync: boolean;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  type: ProjectType;
  settings?: Partial<ProjectSettings>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  type?: ProjectType;
  settings?: Partial<ProjectSettings>;
}





