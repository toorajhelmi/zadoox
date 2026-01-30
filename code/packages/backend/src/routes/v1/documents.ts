/**
 * Documents API Routes
 */

import { FastifyInstance } from 'fastify';
import { DocumentService } from '../../services/document-service.js';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import {
  CreateDocumentInput,
  UpdateDocumentInput,
  ApiResponse,
  Document,
} from '@zadoox/shared';
import { parseLatexToIr } from '@zadoox/shared';
import type { DocumentNode, ParagraphNode, SectionNode } from '@zadoox/shared';
import {
  createDocumentSchema,
  updateDocumentSchema,
  documentIdSchema,
  projectIdParamSchema,
} from '../../validation/schemas.js';
import { schemas, security } from '../../config/schemas.js';
import { supabaseAdmin } from '../../db/client.js';
import { z } from 'zod';
import path from 'node:path';

type LatexManifest = {
  bucket: string;
  basePrefix: string; // e.g. projects/<projectId>/documents/<docId>/latex
  entryPath: string; // e.g. ms.tex
  files?: Array<{ path: string; sha256?: string; size?: number }>;
};

function normalizeTexPath(p: string): string {
  return path.normalize(p).replace(/^[.][\\/]/, '');
}

function resolveInputPath(baseDir: string, raw: string): string {
  let p = String(raw ?? '').trim();
  p = p.replace(/^\{/, '').replace(/\}$/, '');
  if (!p) return p;
  if (!path.extname(p)) p = `${p}.tex`;
  return normalizeTexPath(path.join(baseDir, p));
}

function inlineInputs(params: {
  tex: string;
  baseDir: string;
  byPath: Map<string, string>;
  visited: Set<string>;
  depth: number;
}): string {
  const { tex, baseDir, byPath, visited, depth } = params;
  if (depth > 25) return tex;
  const re = /\\(input|include|subfile)\s*(?:\{([^}]+)\}|([^\s%]+))/g;
  return tex.replace(re, (full, _cmd, argBraced, argBare) => {
    const arg = String(argBraced ?? argBare ?? '').trim();
    if (!arg) return full;
    const resolved = resolveInputPath(baseDir, arg);
    const next = byPath.get(resolved);
    if (!next) return full;
    if (visited.has(resolved)) return `\n% [zadoox] skipped recursive include: ${resolved}\n`;
    visited.add(resolved);
    const nextDir = path.dirname(resolved);
    const expanded = inlineInputs({ tex: next, baseDir: nextDir, byPath, visited, depth: depth + 1 });
    return `\n% [zadoox] begin include: ${resolved}\n${expanded}\n% [zadoox] end include: ${resolved}\n`;
  });
}

function extractCiteKeys(latex: string): string[] {
  const out = new Set<string>();
  const re = /\\cite[a-zA-Z*]*\s*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latex))) {
    const raw = String(m[1] ?? '');
    for (const part of raw.split(',')) {
      const k = part.trim();
      if (k) out.add(k);
    }
  }
  return Array.from(out);
}

type BibEntry = { key: string; type: string; fields: Record<string, string> };

function parseBibtexEntries(bib: string): BibEntry[] {
  const text = String(bib ?? '');
  const entries: BibEntry[] = [];
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf('@', i);
    if (at < 0) break;
    i = at + 1;
    const typeMatch = /^[a-zA-Z]+/.exec(text.slice(i));
    if (!typeMatch) continue;
    const entryType = typeMatch[0];
    i += entryType.length;
    // Skip whitespace until '{' or '('
    while (i < text.length && /\s/.test(text[i]!)) i++;
    const open = text[i];
    if (open !== '{' && open !== '(') continue;
    const close = open === '{' ? '}' : ')';
    i++;
    // Read key up to first comma
    const comma = text.indexOf(',', i);
    if (comma < 0) continue;
    const key = text.slice(i, comma).trim();
    i = comma + 1;

    // Read body until matching close, tracking nested braces.
    let depth = 1;
    let j = i;
    for (; j < text.length; j++) {
      const ch = text[j]!;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = j > i ? text.slice(i, j) : '';
    i = j + 1;

    const fields: Record<string, string> = {};
    // Very small BibTeX field parser (good enough for title/author/year).
    // Matches: name = {value} OR name = "value" OR name = bareValue
    const fieldRe = /([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*(\{[\s\S]*?\}|"[\s\S]*?"|[^,\n]+)\s*,?/g;
    let fm: RegExpExecArray | null;
    while ((fm = fieldRe.exec(body))) {
      const name = String(fm[1] ?? '').toLowerCase();
      let val = String(fm[2] ?? '').trim();
      if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('"') && val.endsWith('"'))) {
        val = val.slice(1, -1).trim();
      }
      if (name) fields[name] = val;
    }
    if (key) entries.push({ key, type: entryType, fields });
  }
  return entries;
}

function clampText(s: string, max: number): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function buildReferencesSection(params: {
  docId: string;
  citedKeys: string[];
  entries: Map<string, BibEntry>;
}): SectionNode | null {
  const { docId, citedKeys, entries } = params;
  const keys = citedKeys.length > 0 ? citedKeys.filter((k) => entries.has(k)) : Array.from(entries.keys()).slice(0, 50);
  if (keys.length === 0) return null;

  const children: ParagraphNode[] = keys.map((k, idx) => {
    const e = entries.get(k)!;
    const title = e.fields.title ? clampText(e.fields.title, 200) : '';
    const author = e.fields.author ? clampText(e.fields.author, 160) : '';
    const year = e.fields.year ? clampText(e.fields.year, 16) : '';
    const bits = [title, author, year].filter(Boolean).join(' — ');
    const text = bits ? `[${k}] ${bits}` : `[${k}]`;
    return { id: `ref-${docId}-${idx}`, type: 'paragraph', text };
  });

  const section: SectionNode = {
    id: `refs-${docId}`,
    type: 'section',
    level: 1,
    title: 'References',
    children,
  };
  return section;
}

const latexEntryPutSchema = z.object({
  text: z.string().min(0),
  entryPath: z.string().min(1).optional(),
});

export async function documentRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateUser);

  const latexBucket = process.env.SUPABASE_PROJECT_FILES_BUCKET || 'project-files';
  let latexBucketEnsured = false;
  const ensureLatexBucket = async () => {
    if (latexBucketEnsured) return;
    const admin = supabaseAdmin();
    const { data: existing, error: getErr } = await admin.storage.getBucket(latexBucket);
    if (!existing || getErr) {
      const { error: createErr } = await admin.storage.createBucket(latexBucket, { public: false });
      if (createErr) {
        const msg = (createErr as { message?: string }).message || '';
        if (!/already exists/i.test(msg)) throw createErr;
      }
    }
    latexBucketEnsured = true;
  };

  /**
   * GET /api/v1/projects/:projectId/documents
   * List all documents for a project
   */
  fastify.get(
    '/projects/:projectId/documents',
    {
      schema: {
        description: 'List all documents for a project',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string', format: 'uuid' },
          },
          required: ['projectId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: schemas.Document,
              },
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
        // Validate route parameters
        const paramValidation = projectIdParamSchema.safeParse(request.params);
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

        const { projectId } = paramValidation.data;
        const documentService = new DocumentService(request.supabase!);
        const documents = await documentService.listDocumentsByProject(
          projectId
        );

        const response: ApiResponse<Document[]> = {
          success: true,
          data: documents,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to list documents';
        const response: ApiResponse<null> = {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: errorMessage,
          },
        };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * GET /api/v1/documents/:id
   * Get a single document by ID
   */
  fastify.get(
    '/documents/:id',
    {
      schema: {
        description: 'Get a single document by ID',
        tags: ['Documents'],
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
              data: schemas.Document,
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
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid document ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { id } = paramValidation.data;
        const documentService = new DocumentService(request.supabase!);
        const document = await documentService.getDocumentById(id);

        const response: ApiResponse<Document> = {
          success: true,
          data: document,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get document';
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
   * POST /api/v1/documents
   * Create a new document
   */
  fastify.post(
    '/documents',
    {
      schema: {
        description: 'Create a new document',
        tags: ['Documents'],
        security,
        body: schemas.CreateDocumentInput,
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: schemas.Document,
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
      // Validate request body
      const validationResult = createDocumentSchema.safeParse(request.body);
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

      const body = validationResult.data as CreateDocumentInput;
      const documentService = new DocumentService(request.supabase!);
      const document = await documentService.createDocument(
        body,
        request.userId!
      );

      const response: ApiResponse<Document> = {
        success: true,
        data: document,
      };
      return reply.status(201).send(response);
    } catch (error: unknown) {
      fastify.log.error(error);
      let statusCode = 500;
      const errorMessage = error instanceof Error ? error.message : String(error);
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
          message: error instanceof Error ? error.message : 'Failed to create document',
        },
      };
      return reply.status(statusCode).send(response);
    }
  });

  /**
   * PUT /api/v1/documents/:id
   * Update a document
   */
  fastify.put(
    '/documents/:id',
    {
      schema: {
        description: 'Update a document',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: schemas.UpdateDocumentInput,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: schemas.Document,
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
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid document ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        // Validate request body
        const bodyValidation = updateDocumentSchema.safeParse(request.body);
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
        const body = bodyValidation.data as UpdateDocumentInput;
        const documentService = new DocumentService(request.supabase!);
        const document = await documentService.updateDocument(
          id,
          body,
          request.userId!,
          body.changeType || 'auto-save',
          body.changeDescription
        );

        const response: ApiResponse<Document> = {
          success: true,
          data: document,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update document';
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
   * DELETE /api/v1/documents/:id
   * Delete a document
   */
  fastify.delete(
    '/documents/:id',
    {
      schema: {
        description: 'Delete a document',
        tags: ['Documents'],
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
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid document ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { id } = paramValidation.data;
        const documentService = new DocumentService(request.supabase!);
        await documentService.deleteDocument(id);

        const response: ApiResponse<null> = {
          success: true,
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete document';
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
   * POST /api/v1/documents/:id/duplicate
   * Duplicate a document (safe duplicate: content + metadata only; SG/LaTeX reset)
   */
  fastify.post(
    '/documents/:id/duplicate',
    {
      schema: {
        description: 'Duplicate a document (content + metadata only; SG/LaTeX reset)',
        tags: ['Documents'],
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
              data: schemas.Document,
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
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid document ID',
              details: paramValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { id } = paramValidation.data;
        const documentService = new DocumentService(request.supabase!);
        const source = await documentService.getDocumentById(id);

        const nextTitleBase = String(source.title ?? '').trim() || 'Untitled Document';
        const nextTitle = `${nextTitleBase} (copy)`;

        // Safe duplicate:
        // - Copy XMD content + metadata (type/order/etc)
        // - Reset lastEditedFormat to markdown (so we don't land in latex mode without a manifest)
        // - Do NOT carry over SG or LaTeX manifest (avoid shared storage/clobbering)
        const created = await documentService.createDocument(
          {
            projectId: source.projectId,
            title: nextTitle,
            content: source.content ?? '',
            metadata: {
              ...(source.metadata ?? {}),
              lastEditedFormat: 'markdown',
            },
            semanticGraph: null,
            latex: null,
          } as CreateDocumentInput,
          request.userId!
        );

        const response: ApiResponse<Document> = { success: true, data: created };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate document';
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
   * GET /api/v1/documents/:id/latex/entry
   *
   * Loads the LaTeX entry file from Storage using `documents.latex` manifest.
   */
  fastify.get(
    '/documents/:id/latex/entry',
    {
      schema: {
        description: 'Get LaTeX entry text for a document (Storage-backed via documents.latex manifest)',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        response: { 200: schemas.ApiResponse, 400: schemas.ApiResponse, 404: schemas.ApiResponse, 500: schemas.ApiResponse },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid document ID' } };
          return reply.status(400).send(response);
        }
        const { id } = paramValidation.data;
        const documentService = new DocumentService(request.supabase!);
        const doc = await documentService.getDocumentById(id);
        const manifest = (doc.latex as unknown as LatexManifest | null) ?? null;
        if (!manifest || typeof manifest !== 'object') {
          const response: ApiResponse<null> = { success: false, error: { code: 'NOT_FOUND', message: 'No LaTeX manifest for document' } };
          return reply.status(404).send(response);
        }
        const basePrefix = String(manifest.basePrefix || '');
        const entryPath = String(manifest.entryPath || '');
        if (!basePrefix || !entryPath) {
          const response: ApiResponse<null> = { success: false, error: { code: 'INVALID_STATE', message: 'Invalid LaTeX manifest (missing basePrefix/entryPath)' } };
          return reply.status(500).send(response);
        }
        const key = `${basePrefix.replace(/\/+$/g, '')}/${entryPath.replace(/^\/+/, '')}`;

        const admin = supabaseAdmin();
        await ensureLatexBucket();
        const { data, error } = await admin.storage.from(latexBucket).download(key);
        if (error || !data) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'LaTeX entry file not found in storage',
              details: {
                bucket: latexBucket,
                key,
                basePrefix,
                entryPath,
                reason: error?.message ? String(error.message) : 'Download returned empty data',
              },
            },
          };
          return reply.status(404).send(response);
        }
        const text = await data.text();
        const response: ApiResponse<{ text: string; latex: LatexManifest }> = { success: true, data: { text, latex: manifest } };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const msg = error instanceof Error ? error.message : 'Failed to load LaTeX entry';
        const response: ApiResponse<null> = { success: false, error: { code: 'INTERNAL_ERROR', message: msg } };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * PUT /api/v1/documents/:id/latex/entry
   *
   * Saves the LaTeX entry file to Storage and updates `documents.latex` manifest.
   */
  fastify.put(
    '/documents/:id/latex/entry',
    {
      schema: {
        description: 'Save LaTeX entry text for a document (Storage-backed via documents.latex manifest)',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        body: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, entryPath: { type: 'string' } } },
        response: { 200: schemas.ApiResponse, 400: schemas.ApiResponse, 404: schemas.ApiResponse, 500: schemas.ApiResponse },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid document ID' } };
          return reply.status(400).send(response);
        }
        const bodyValidation = latexEntryPutSchema.safeParse(request.body);
        if (!bodyValidation.success) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } };
          return reply.status(400).send(response);
        }
        const { id } = paramValidation.data;
        const { text, entryPath: entryPathMaybe } = bodyValidation.data;

        const documentService = new DocumentService(request.supabase!);
        const doc = await documentService.getDocumentById(id);
        const projectId = doc.projectId;

        const existing = (doc.latex as unknown as LatexManifest | null) ?? null;
        const basePrefix = existing?.basePrefix || `projects/${projectId}/documents/${id}/latex`;
        const entryPath = entryPathMaybe || existing?.entryPath || 'main.tex';
        const manifest: LatexManifest = {
          bucket: latexBucket,
          basePrefix,
          entryPath,
          files: existing?.files,
        };

        const key = `${basePrefix.replace(/\/+$/g, '')}/${entryPath.replace(/^\/+/, '')}`;
        const bytes = Buffer.from(String(text ?? ''), 'utf8');

        const admin = supabaseAdmin();
        await ensureLatexBucket();
        const { error } = await admin.storage.from(latexBucket).upload(key, bytes, {
          contentType: 'application/x-tex',
          upsert: true,
        });
        if (error) throw new Error(`Failed to upload LaTeX entry: ${error.message}`);

        // Important: this endpoint only uploads the entry file and returns the manifest.
        // Persisting `documents.latex` happens through the normal document update pipeline
        // so we keep a single save timer (content + metadata + SG + latex manifest).
        const response: ApiResponse<{ latex: LatexManifest }> = { success: true, data: { latex: manifest } };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const msg = error instanceof Error ? error.message : 'Failed to save LaTeX entry';
        const response: ApiResponse<null> = { success: false, error: { code: 'INTERNAL_ERROR', message: msg } };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * GET /api/v1/documents/:id/latex/ir
   *
   * Builds IR from LaTeX by expanding \input/\include using the Storage bundle listed in `documents.latex.files`.
   * This is used for outline/preview on imported multi-file LaTeX docs.
   */
  fastify.get(
    '/documents/:id/latex/ir',
    {
      schema: {
        description: 'Build IR from the LaTeX bundle for a document (expands includes via documents.latex manifest)',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        response: { 200: schemas.ApiResponse, 400: schemas.ApiResponse, 404: schemas.ApiResponse, 500: schemas.ApiResponse },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid document ID' } };
          return reply.status(400).send(response);
        }
        const { id } = paramValidation.data;
        const documentService = new DocumentService(request.supabase!);
        const doc = await documentService.getDocumentById(id);
        const manifest = (doc.latex as unknown as LatexManifest | null) ?? null;
        if (!manifest || typeof manifest !== 'object') {
          const response: ApiResponse<null> = { success: false, error: { code: 'NOT_FOUND', message: 'No LaTeX manifest for document' } };
          return reply.status(404).send(response);
        }
        const basePrefix = String(manifest.basePrefix || '');
        const entryPath = String(manifest.entryPath || '');
        if (!basePrefix || !entryPath) {
          const response: ApiResponse<null> = { success: false, error: { code: 'INVALID_STATE', message: 'Invalid LaTeX manifest (missing basePrefix/entryPath)' } };
          return reply.status(500).send(response);
        }

        const admin = supabaseAdmin();
        await ensureLatexBucket();

        // Download all .tex files listed in the manifest into a map so we can inline includes.
        const byPath = new Map<string, string>();
        const files: Array<{ path: string; sha256?: string; size?: number }> = Array.isArray(manifest.files) ? manifest.files : [];
        const bibEntriesByKey = new Map<string, BibEntry>();
        for (const f of files) {
          const rel = String(f?.path || '');
          if (!rel) continue;
          const key = `${basePrefix.replace(/\/+$/g, '')}/${rel.replace(/^\/+/, '')}`;
          if (rel.toLowerCase().endsWith('.tex')) {
            const { data, error } = await admin.storage.from(latexBucket).download(key);
            if (error || !data) continue;
            const text = await data.text();
            if (!text) continue;
            byPath.set(normalizeTexPath(rel), text);
            continue;
          }
          if (rel.toLowerCase().endsWith('.bib')) {
            const { data, error } = await admin.storage.from(latexBucket).download(key);
            if (error || !data) continue;
            const bib = await data.text();
            if (!bib) continue;
            for (const entry of parseBibtexEntries(bib)) {
              if (!bibEntriesByKey.has(entry.key)) bibEntriesByKey.set(entry.key, entry);
            }
          }
        }

        const entryKey = `${basePrefix.replace(/\/+$/g, '')}/${entryPath.replace(/^\/+/, '')}`;
        const { data: entryData, error: entryErr } = await admin.storage.from(latexBucket).download(entryKey);
        if (entryErr || !entryData) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'LaTeX entry file not found in storage',
              details: {
                bucket: latexBucket,
                key: entryKey,
                basePrefix,
                entryPath,
                reason: entryErr?.message ? String(entryErr.message) : 'Download returned empty data',
              },
            },
          };
          return reply.status(404).send(response);
        }
        const entryText = await entryData.text();

        // Inline includes starting from entryPath.
        const expanded = inlineInputs({
          tex: entryText,
          baseDir: path.dirname(normalizeTexPath(entryPath)),
          byPath,
          visited: new Set<string>([normalizeTexPath(entryPath)]),
          depth: 0,
        });

        const ir = parseLatexToIr({ docId: id, latex: expanded }) as DocumentNode;

        // Append bibliography context so AI/XMD conversion can see references.
        // We include cited keys when possible; otherwise include a small slice of entries.
        const citedKeys = extractCiteKeys(expanded);
        const refs = buildReferencesSection({ docId: id, citedKeys, entries: bibEntriesByKey });
        if (refs && ir && ir.type === 'document') {
          ir.children = [...ir.children, refs];
        }

        const response: ApiResponse<{ ir: unknown }> = { success: true, data: { ir } };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const msg = error instanceof Error ? error.message : 'Failed to build LaTeX IR';
        const response: ApiResponse<null> = { success: false, error: { code: 'INTERNAL_ERROR', message: msg } };
        return reply.status(500).send(response);
      }
    }
  );

  /**
   * GET /api/v1/documents/:id/latex/file?path=...
   *
   * Downloads a file from the LaTeX bundle listed in `documents.latex.files`.
   * Intended for in-app preview of imported LaTeX assets (figures, etc).
   */
  fastify.get(
    '/documents/:id/latex/file',
    {
      schema: {
        description: 'Download a LaTeX bundle file for a document (must exist in documents.latex manifest)',
        tags: ['Documents'],
        security,
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
        response: { 200: { type: 'string', format: 'binary' }, 400: schemas.ApiResponse, 404: schemas.ApiResponse, 500: schemas.ApiResponse },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const paramValidation = documentIdSchema.safeParse(request.params);
        if (!paramValidation.success) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid document ID' } };
          return reply.status(400).send(response);
        }
        const { id } = paramValidation.data;
        const rawPath = String((request.query as { path?: string } | undefined)?.path ?? '').trim();
        if (!rawPath) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing path' } };
          return reply.status(400).send(response);
        }
        // Basic path hygiene; we also validate membership in manifest.files.
        const rel = rawPath.replace(/^\/+/, '').replace(/^(\.\/)+/, '');
        if (rel.includes('..')) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid path' } };
          return reply.status(400).send(response);
        }

        const documentService = new DocumentService(request.supabase!);
        const doc = await documentService.getDocumentById(id);
        const manifest = (doc.latex as unknown as LatexManifest | null) ?? null;
        if (!manifest || typeof manifest !== 'object') {
          const response: ApiResponse<null> = { success: false, error: { code: 'NOT_FOUND', message: 'No LaTeX manifest for document' } };
          return reply.status(404).send(response);
        }
        const basePrefix = String(manifest.basePrefix || '');
        if (!basePrefix) {
          const response: ApiResponse<null> = { success: false, error: { code: 'INVALID_STATE', message: 'Invalid LaTeX manifest (missing basePrefix)' } };
          return reply.status(500).send(response);
        }
        const files: Array<{ path: string }> = Array.isArray(manifest.files) ? (manifest.files as Array<{ path: string }>) : [];
        const allowedList = files.map((f) => String(f?.path || '').replace(/^\/+/, '')).filter(Boolean);
        const allowedLowerToActual = new Map<string, string>();
        for (const p of allowedList) {
          const lower = p.toLowerCase();
          if (!allowedLowerToActual.has(lower)) allowedLowerToActual.set(lower, p);
        }

        const resolveAllowedPath = (requested: string): string | null => {
          const req = requested.replace(/^\/+/, '');
          const reqLower = req.toLowerCase();
          if (allowedLowerToActual.has(reqLower)) return allowedLowerToActual.get(reqLower)!;

          // If LaTeX omitted extension (common with \includegraphics{Figures/foo}),
          // try to find a matching file with a known extension.
          const hasExt = path.extname(req).trim().length > 0;
          if (!hasExt) {
            const preferredExts = ['.pdf', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.eps'];
            const candidates = allowedList.filter((p) => p.toLowerCase().startsWith(`${reqLower}.`));
            if (candidates.length === 0) return null;
            for (const ext of preferredExts) {
              const hit = candidates.find((p) => p.toLowerCase() === `${reqLower}${ext}`);
              if (hit) return hit;
            }
            // Fall back to first candidate deterministically (sorted).
            return candidates.sort((a, b) => a.localeCompare(b))[0]!;
          }
          return null;
        };

        const resolvedRel = resolveAllowedPath(rel);
        if (!resolvedRel) {
          const response: ApiResponse<null> = {
            success: false,
            error: { code: 'NOT_FOUND', message: 'File not found in LaTeX manifest', details: { path: rel } },
          };
          return reply.status(404).send(response);
        }

        const admin = supabaseAdmin();
        await ensureLatexBucket();
        const key = `${basePrefix.replace(/\/+$/g, '')}/${resolvedRel}`;
        const { data, error } = await admin.storage.from(latexBucket).download(key);
        if (error || !data) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'LaTeX bundle file not found in storage',
              details: { bucket: latexBucket, key, path: resolvedRel, requestedPath: rel, reason: error?.message ?? 'Download returned empty data' },
            },
          };
          return reply.status(404).send(response);
        }

        const ext = path.extname(resolvedRel).toLowerCase();
        const contentType =
          ext === '.png'
            ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg'
              ? 'image/jpeg'
              : ext === '.gif'
                ? 'image/gif'
                : ext === '.webp'
                  ? 'image/webp'
                  : ext === '.svg'
                    ? 'image/svg+xml'
                    : ext === '.pdf'
                      ? 'application/pdf'
                      : 'application/octet-stream';
        reply.header('Content-Type', contentType);
        reply.header('Cache-Control', 'private, max-age=300');
        // Supabase returns a Blob in Node; Fastify needs Buffer/string/stream.
        const buf = Buffer.from(await data.arrayBuffer());
        return reply.send(buf);
      } catch (error: unknown) {
        fastify.log.error(error);
        const msg = error instanceof Error ? error.message : 'Failed to download LaTeX file';
        const response: ApiResponse<null> = { success: false, error: { code: 'INTERNAL_ERROR', message: msg } };
        return reply.status(500).send(response);
      }
    }
  );
}

