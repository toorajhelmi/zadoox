/**
 * Import API Routes
 *
 * For now: arXiv -> create a Zadoox document with LaTeX populated.
 */

import { FastifyInstance } from 'fastify';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import type { ApiResponse, CreateDocumentInput, Document } from '@zadoox/shared';
import { DocumentService } from '../../services/document-service.js';
import { schemas, security } from '../../config/schemas.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function parseArxivId(input: string): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // Direct ID (new style): 2301.01234 or 2301.01234v2
  const mNew = raw.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  if (mNew) return `${mNew[1]}${mNew[2] ?? ''}`;

  // Old style: hep-th/9901001v1
  const mOld = raw.match(/([a-z\-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?/i);
  if (mOld) return `${mOld[1]}${mOld[2] ?? ''}`;

  return null;
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const ents = await fs.readdir(cur, { withFileTypes: true });
    for (const e of ents) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else out.push(p);
    }
  }
  return out;
}

async function extractArxivMainTexFromSourceTarball(params: { arxivId: string; tgz: Buffer }): Promise<string> {
  const { arxivId, tgz } = params;
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'zadoox-arxiv-'));
  const tarPath = path.join(tmpRoot, `${arxivId.replace(/[^\w.-]/g, '_')}.tar.gz`);
  const outDir = path.join(tmpRoot, 'src');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(tarPath, tgz);

  // Use system tar to extract (keeps deps light). This assumes a typical Linux/macOS runtime.
  await execFileAsync('tar', ['-xzf', tarPath, '-C', outDir]);

  const files = await listFilesRecursive(outDir);
  const texFiles = files.filter((f) => f.toLowerCase().endsWith('.tex'));
  if (texFiles.length === 0) {
    throw new Error('arXiv source did not contain any .tex files');
  }

  // Pick a likely main file.
  // Heuristic: prefer the TeX file with the largest *document body* (between begin/end document).
  // This avoids selecting tiny stubs (often present in arXiv sources) that have no real content.
  let best: { file: string; bodyLen: number; size: number; hasBegin: boolean; hasDocClass: boolean } | null = null;
  for (const f of texFiles) {
    const content = await fs.readFile(f, 'utf8').catch(() => null);
    if (!content) continue;
    const hasBegin = content.includes('\\begin{document}');
    const hasDocClass = content.includes('\\documentclass');
    const size = content.length;
    const beginIdx = content.indexOf('\\begin{document}');
    const endIdx = content.indexOf('\\end{document}');
    const bodyLen = beginIdx >= 0 && endIdx > beginIdx ? Math.max(0, endIdx - (beginIdx + '\\begin{document}'.length)) : -1;

    const isBetter =
      !best ||
      bodyLen > best.bodyLen ||
      (bodyLen === best.bodyLen && size > best.size) ||
      (bodyLen === best.bodyLen && size === best.size && hasBegin && !best.hasBegin) ||
      (bodyLen === best.bodyLen && size === best.size && hasBegin === best.hasBegin && hasDocClass && !best.hasDocClass);

    if (isBetter) {
      best = { file: f, bodyLen, size, hasBegin, hasDocClass };
    }
  }

  const mainPath = best?.file ?? texFiles[0]!;
  const main = await fs.readFile(mainPath, 'utf8');
  if (!main || main.trim().length === 0) {
    throw new Error('Failed to read main TeX file from arXiv source');
  }
  return main;
}

export async function importRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticateUser);

  /**
   * POST /api/v1/import/arxiv
   *
   * Body:
   * - projectId: uuid
   * - arxiv: arXiv URL or ID
   */
  fastify.post(
    '/import/arxiv',
    {
      schema: {
        description: 'Import an arXiv paper (LaTeX source) into a new Zadoox document',
        tags: ['Import'],
        security,
        body: {
          type: 'object',
          required: ['projectId', 'arxiv'],
          properties: {
            projectId: { type: 'string', format: 'uuid' },
            arxiv: { type: 'string', minLength: 1 },
            title: { type: 'string' },
          },
        },
        response: {
          200: schemas.ApiResponse,
          400: schemas.ApiResponse,
          401: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const body = request.body as { projectId?: string; arxiv?: string; title?: string };
        const projectId = String(body?.projectId ?? '');
        const arxiv = String(body?.arxiv ?? '');
        const titleOverride = typeof body?.title === 'string' ? body.title.trim() : '';

        if (!projectId) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'projectId is required' } };
          return reply.status(400).send(response);
        }
        const arxivId = parseArxivId(arxiv);
        if (!arxivId) {
          const response: ApiResponse<null> = { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid arXiv ID/URL' } };
          return reply.status(400).send(response);
        }
        if (!request.supabase || !request.userId) {
          const response: ApiResponse<null> = { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };
          return reply.status(401).send(response);
        }

        // Fetch arXiv source tarball.
        const url = `https://arxiv.org/e-print/${encodeURIComponent(arxivId)}`;
        const res = await fetch(url, {
          redirect: 'follow',
          headers: {
            'user-agent': 'Zadoox Importer (arXiv)',
            accept: '*/*',
          },
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch arXiv source (${res.status} ${res.statusText})`);
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0) throw new Error('Empty arXiv source response');

        const latex = await extractArxivMainTexFromSourceTarball({ arxivId, tgz: buf });

        const input: CreateDocumentInput = {
          projectId,
          title: titleOverride || `arXiv ${arxivId}`,
          content: '',
          metadata: {
            type: 'standalone',
            lastEditedFormat: 'latex',
            latex,
            // Keep a breadcrumb for later enhancements (assets, citations, etc.)
            importSource: { kind: 'arxiv', id: arxivId, url },
          } as any,
        };

        const documentService = new DocumentService(request.supabase);
        const created = await documentService.createDocument(input, request.userId);

        const response: ApiResponse<Document> = { success: true, data: created };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const msg = error instanceof Error ? error.message : 'Import failed';
        const response: ApiResponse<null> = { success: false, error: { code: 'INTERNAL_ERROR', message: msg } };
        return reply.status(500).send(response);
      }
    }
  );

  return fastify;
}


