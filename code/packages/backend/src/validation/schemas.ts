/**
 * Request validation schemas using Zod
 */

import { z } from 'zod';

/**
 * Project validation schemas
 */
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255, 'Project name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  type: z.enum(['academic', 'industry', 'code-docs', 'other'], {
    errorMap: () => ({ message: 'Invalid project type' }),
  }),
  settings: z
    .object({
      defaultFormat: z.enum(['latex', 'markdown']).optional(),
      chapterNumbering: z.boolean().optional(),
      autoSync: z.boolean().optional(),
    })
    .optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  type: z.enum(['academic', 'industry', 'code-docs', 'other']).optional(),
  settings: z
    .object({
      defaultFormat: z.enum(['latex', 'markdown']).optional(),
      chapterNumbering: z.boolean().optional(),
      autoSync: z.boolean().optional(),
    })
    .optional(),
});

export const projectIdSchema = z.object({
  id: z.string().uuid('Invalid project ID format'),
});

/**
 * Document validation schemas
 */
export const createDocumentSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
  title: z.string().min(1, 'Document title is required').max(255, 'Title too long'),
  content: z.string().optional(),
  metadata: z
    .object({
      type: z.enum(['chapter', 'section', 'standalone']).optional(),
      chapterNumber: z.number().int().positive().optional(),
      order: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  metadata: z
    .object({
      type: z.enum(['chapter', 'section', 'standalone']).optional(),
      chapterNumber: z.number().int().positive().optional(),
      order: z.number().int().nonnegative().optional(),
    })
    .optional(),
  changeType: z.enum(['manual-save', 'auto-save', 'ai-action', 'milestone', 'rollback']).optional(),
  changeDescription: z.string().optional(),
});

export const documentIdSchema = z.object({
  id: z.string().uuid('Invalid document ID format'),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

