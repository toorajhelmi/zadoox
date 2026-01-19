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

export type DocumentStyle = 'academic' | 'whitepaper' | 'technical-docs' | 'blog' | 'other';
export type CitationFormat = 'apa' | 'mla' | 'chicago' | 'ieee' | 'numbered' | 'footnote';
export type EditingMode = 'ai-assist' | 'full-ai';

export interface ProjectSettings {
  defaultFormat: 'latex' | 'markdown';
  chapterNumbering: boolean;
  autoSync: boolean;
  /**
   * How the project should default its editing experience (used for UX defaults,
   * e.g. opening the right-side chat panel).
   */
  editingMode?: EditingMode;
  documentStyle?: DocumentStyle; // Document style (academic, whitepaper, etc.)
  citationFormat?: CitationFormat; // Citation format (APA, MLA, etc.)
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





