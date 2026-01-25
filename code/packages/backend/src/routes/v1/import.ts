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

function stripTexComments(input: string): string {
  const lines = String(input ?? '').split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    // Remove unescaped % comments. This is a heuristic; good enough for scoring.
    let cut = line.length;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '%' && (i === 0 || line[i - 1] !== '\\')) {
        cut = i;
        break;
      }
    }
    out.push(line.slice(0, cut));
  }
  return out.join('\n');
}

function meaningfulLen(tex: string): number {
  const t = stripTexComments(tex)
    .replace(/\\(begin|end)\{(comment|verbatim|lstlisting)\}[\s\S]*?\\(end)\{\2\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length;
}

function extractDocumentBody(tex: string): string | null {
  const beginIdx = tex.indexOf('\\begin{document}');
  const endIdx = tex.indexOf('\\end{document}');
  if (beginIdx < 0 || endIdx <= beginIdx) return null;
  return tex.slice(beginIdx + '\\begin{document}'.length, endIdx);
}

function normalizeTexPath(p: string): string {
  // Normalize path separators and remove leading ./.
  return path.normalize(p).replace(/^[.][\\/]/, '');
}

function resolveInputPath(baseDir: string, raw: string): string {
  let p = raw.trim();
  // Remove surrounding braces if any (caller usually passes inside braces, but keep safe)
  p = p.replace(/^\{/, '').replace(/\}$/, '');
  if (!p) return p;
  // If no extension, assume .tex
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
  if (depth > 20) return tex;

  // Handle \input{foo} and \include{foo}. Keep it conservative.
  const re = /\\(input|include)\s*\{([^}]+)\}/g;
  return tex.replace(re, (full, _cmd, arg) => {
    const resolved = resolveInputPath(baseDir, String(arg ?? ''));
    const next = byPath.get(resolved);
    if (!next) return full;
    if (visited.has(resolved)) return `\n% [zadoox] skipped recursive include: ${resolved}\n`;
    visited.add(resolved);
    const nextDir = path.dirname(resolved);
    const expanded = inlineInputs({ tex: next, baseDir: nextDir, byPath, visited, depth: depth + 1 });
    return `\n% [zadoox] begin include: ${resolved}\n${expanded}\n% [zadoox] end include: ${resolved}\n`;
  });
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

  // Load all tex contents into a map so we can inline inputs/includes.
  const byPath = new Map<string, string>();
  for (const f of texFiles) {
    const rel = normalizeTexPath(path.relative(outDir, f));
    const content = await fs.readFile(f, 'utf8').catch(() => null);
    if (content) byPath.set(rel, content);
  }

  // Find best candidate:
  // 1) Prefer files with \documentclass; among them prefer those with a meaningful body.
  // 2) If no docclass root, fall back to the most meaningful fragment and wrap it.
  type Cand = {
    rel: string;
    tex: string;
    size: number;
    hasDocClass: boolean;
    hasBegin: boolean;
    bodyMeaningfulLen: number;
    totalMeaningfulLen: number;
  };
  const cands: Cand[] = [];
  for (const [rel, tex] of byPath.entries()) {
    const size = tex.length;
    const hasDocClass = tex.includes('\\documentclass');
    const hasBegin = tex.includes('\\begin{document}');
    const body = extractDocumentBody(tex);
    const bodyMeaningfulLen = body ? meaningfulLen(body) : -1;
    const totalMeaningfulLen = meaningfulLen(tex);
    cands.push({ rel, tex, size, hasDocClass, hasBegin, bodyMeaningfulLen, totalMeaningfulLen });
  }

  const roots = cands.filter((c) => c.hasDocClass);
  const fragments = cands.filter((c) => !c.hasDocClass);

  const pickRoot = (): Cand | null => {
    if (roots.length === 0) return null;
    const sorted = [...roots].sort((a, b) => {
      // Prefer docclass+begin doc.
      const ab = (a.hasBegin ? 1 : 0) - (b.hasBegin ? 1 : 0);
      if (ab !== 0) return -ab;
      // Prefer larger meaningful body.
      if (a.bodyMeaningfulLen !== b.bodyMeaningfulLen) return b.bodyMeaningfulLen - a.bodyMeaningfulLen;
      // Then overall meaningful.
      if (a.totalMeaningfulLen !== b.totalMeaningfulLen) return b.totalMeaningfulLen - a.totalMeaningfulLen;
      // Then file size.
      return b.size - a.size;
    });
    return sorted[0] ?? null;
  };

  const pickBestFragment = (): Cand | null => {
    if (fragments.length === 0) return null;
    const sorted = [...fragments].sort((a, b) => {
      if (a.totalMeaningfulLen !== b.totalMeaningfulLen) return b.totalMeaningfulLen - a.totalMeaningfulLen;
      return b.size - a.size;
    });
    return sorted[0] ?? null;
  };

  const root = pickRoot();
  if (root) {
    const expanded = inlineInputs({
      tex: root.tex,
      baseDir: path.dirname(root.rel),
      byPath,
      visited: new Set<string>([root.rel]),
      depth: 0,
    });

    // If the document body is still basically empty, fall back to wrapping the biggest fragment
    // (common when the chosen root is an arXiv stub and real content lives in fragments).
    const body = extractDocumentBody(expanded);
    const bodyLen = body ? meaningfulLen(body) : 0;
    if (bodyLen < 200) {
      const frag = pickBestFragment();
      if (frag && frag.totalMeaningfulLen > bodyLen) {
        const fragExpanded = inlineInputs({
          tex: frag.tex,
          baseDir: path.dirname(frag.rel),
          byPath,
          visited: new Set<string>([frag.rel]),
          depth: 0,
        });
        return `\\documentclass{article}\n\\begin{document}\n${fragExpanded}\n\\end{document}\n`;
      }
    }

    return expanded;
  }

  const frag = pickBestFragment();
  if (frag) {
    const fragExpanded = inlineInputs({
      tex: frag.tex,
      baseDir: path.dirname(frag.rel),
      byPath,
      visited: new Set<string>([frag.rel]),
      depth: 0,
    });
    return `\\documentclass{article}\n\\begin{document}\n${fragExpanded}\n\\end{document}\n`;
  }

  // Last resort: return any tex file.
  const any = cands[0]?.tex ?? '';
  if (!any.trim()) throw new Error('Failed to read any TeX file from arXiv source');
  return any;
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


