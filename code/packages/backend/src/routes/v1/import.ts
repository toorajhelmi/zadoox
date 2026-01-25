/**
 * Import API Routes
 *
 * For now: arXiv -> create a Zadoox document with LaTeX populated.
 */

import { FastifyInstance } from 'fastify';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import type { ApiResponse, CreateDocumentInput, Document, UpdateDocumentInput } from '@zadoox/shared';
import { DocumentService } from '../../services/document-service.js';
import { schemas, security } from '../../config/schemas.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { supabaseAdmin } from '../../db/client.js';
import { createHash } from 'node:crypto';

const execFileAsync = promisify(execFile);

function importDebugEnabled(): boolean {
  return String(process.env.SG_DEBUG || '').toLowerCase() === 'true';
}

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

  // Handle \input{foo}, \include{foo}, \subfile{foo}, plus a common brace-less form: \input foo
  // (Heuristic; good enough for most arXiv sources.)
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

async function selectArxivEntryTexPathFromSourceTarball(params: { arxivId: string; tgz: Buffer }): Promise<string> {
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

  const scoreExpanded = (expanded: string): number => {
    const body = extractDocumentBody(expanded);
    const bodyLen = body ? meaningfulLen(body) : 0;
    const bonus =
      (expanded.includes('\\title{') ? 500 : 0) +
      (expanded.includes('\\author{') ? 250 : 0) +
      (expanded.includes('\\begin{abstract}') ? 250 : 0) +
      (expanded.includes('\\section{') ? 150 : 0) +
      (expanded.includes('\\bibliography') || expanded.includes('\\begin{thebibliography}') ? 150 : 0);
    return bodyLen + bonus;
  };

  const pickRootExpanded = (): { root: Cand; expanded: string; score: number; bodyLen: number } | null => {
    if (roots.length === 0) return null;
    let best: { root: Cand; expanded: string; score: number; bodyLen: number } | null = null;
    for (const r of roots) {
      const expanded = inlineInputs({
        tex: r.tex,
        baseDir: path.dirname(r.rel),
        byPath,
        visited: new Set<string>([r.rel]),
        depth: 0,
      });
      const body = extractDocumentBody(expanded);
      const bodyLen = body ? meaningfulLen(body) : 0;
      const score = scoreExpanded(expanded);
      if (!best || score > best.score) {
        best = { root: r, expanded, score, bodyLen };
      }
    }
    return best;
  };

  const pickBestFragment = (): Cand | null => {
    if (fragments.length === 0) return null;
    const sorted = [...fragments].sort((a, b) => {
      if (a.totalMeaningfulLen !== b.totalMeaningfulLen) return b.totalMeaningfulLen - a.totalMeaningfulLen;
      return b.size - a.size;
    });
    return sorted[0] ?? null;
  };

  const picked = pickRootExpanded();
  if (picked) {
    // If even the best expanded root has essentially no body, fail loudly.
    // We intentionally do NOT synthesize wrappers; importer must be faithful.
    if (picked.bodyLen < 200) {
      if (importDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log('[arxiv-import] Could not find meaningful TeX root. Candidate summary:');
        const summary = cands
          .map((c) => ({
            rel: c.rel,
            hasDocClass: c.hasDocClass,
            hasBegin: c.hasBegin,
            bodyMeaningfulLen: c.bodyMeaningfulLen,
            totalMeaningfulLen: c.totalMeaningfulLen,
            size: c.size,
          }))
          .sort((a, b) => (b.totalMeaningfulLen ?? 0) - (a.totalMeaningfulLen ?? 0))
          .slice(0, 20);
        // eslint-disable-next-line no-console
        console.log(summary);
      }
      throw new Error(
        'Failed to identify a meaningful main TeX file from the arXiv source (root TeX body is empty).'
      );
    }
    // Return the root entry path (do not inline; bundle is stored multi-file in Storage).
    return picked.root.rel;
  }

  if (importDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log('[arxiv-import] No TeX file with \\documentclass found. Candidate summary:');
    const summary = cands
      .map((c) => ({
        rel: c.rel,
        hasDocClass: c.hasDocClass,
        hasBegin: c.hasBegin,
        bodyMeaningfulLen: c.bodyMeaningfulLen,
        totalMeaningfulLen: c.totalMeaningfulLen,
        size: c.size,
      }))
      .sort((a, b) => (b.totalMeaningfulLen ?? 0) - (a.totalMeaningfulLen ?? 0))
      .slice(0, 20);
    // eslint-disable-next-line no-console
    console.log(summary);
  }
  throw new Error('arXiv source did not contain a compilable TeX root (missing \\documentclass).');
}

type LatexManifest = {
  bucket: string;
  basePrefix: string;
  entryPath: string;
  files: Array<{ path: string; sha256: string; size: number }>;
  source?: { kind: 'arxiv'; id: string; url: string };
};

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function contentTypeForPath(p: string): string {
  const ext = p.toLowerCase().split('.').pop() || '';
  if (ext === 'tex') return 'application/x-tex';
  if (ext === 'bib') return 'text/x-bibtex';
  if (ext === 'sty' || ext === 'cls') return 'text/plain';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
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

        // Identify the entry .tex path within the tarball.
        const entryPath = await selectArxivEntryTexPathFromSourceTarball({ arxivId, tgz: buf });

        // Create the document first to get a stable docId, then upload the entire bundle under the project folder.
        const documentService = new DocumentService(request.supabase);
        const created = await documentService.createDocument(
          {
            projectId,
            title: titleOverride || `arXiv ${arxivId}`,
            content: '',
            metadata: {
              type: 'standalone',
              lastEditedFormat: 'latex',
            } as any,
          } as CreateDocumentInput,
          request.userId
        );

        // Extract the tarball to a temp dir so we can upload all files.
        const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'zadoox-arxiv-upload-'));
        const tarPath = path.join(tmpRoot, `${arxivId.replace(/[^\w.-]/g, '_')}.tar.gz`);
        const outDir = path.join(tmpRoot, 'src');
        await fs.mkdir(outDir, { recursive: true });
        await fs.writeFile(tarPath, buf);
        await execFileAsync('tar', ['-xzf', tarPath, '-C', outDir]);

        const files = await listFilesRecursive(outDir);
        const bucket = process.env.SUPABASE_PROJECT_FILES_BUCKET || 'project-files';
        const basePrefix = `projects/${projectId}/documents/${created.id}/latex`;

        const admin = supabaseAdmin();
        // Ensure bucket exists.
        const { data: existingBucket, error: getErr } = await admin.storage.getBucket(bucket);
        if (!existingBucket || getErr) {
          const { error: createErr } = await admin.storage.createBucket(bucket, { public: false });
          if (createErr) {
            const msg = (createErr as { message?: string }).message || '';
            if (!/already exists/i.test(msg)) throw createErr;
          }
        }

        const manifestFiles: LatexManifest['files'] = [];
        for (const abs of files) {
          const rel = normalizeTexPath(path.relative(outDir, abs));
          const bytes = await fs.readFile(abs);
          const key = `${basePrefix}/${rel}`;
          const ct = contentTypeForPath(rel);
          const { error: upErr } = await admin.storage.from(bucket).upload(key, bytes, {
            contentType: ct,
            upsert: true,
          });
          if (upErr) throw new Error(`Failed to upload arXiv file "${rel}": ${upErr.message}`);
          manifestFiles.push({ path: rel, sha256: sha256(bytes), size: bytes.length });
        }

        // Validate that the chosen entry exists in the bundle we uploaded.
        if (!manifestFiles.some((f) => f.path === entryPath)) {
          throw new Error(`Selected entry TeX "${entryPath}" was not found in the extracted arXiv bundle`);
        }

        const manifest: LatexManifest = {
          bucket,
          basePrefix,
          entryPath,
          files: manifestFiles,
          source: { kind: 'arxiv', id: arxivId, url },
        };

        const updated = await documentService.updateDocument(
          created.id,
          { latex: manifest } as UpdateDocumentInput,
          request.userId,
          'ai-action',
          'Imported arXiv LaTeX bundle'
        );

        const response: ApiResponse<Document> = { success: true, data: updated };
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


