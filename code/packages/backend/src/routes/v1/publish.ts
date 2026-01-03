/**
 * Publishing API Routes (Phase 12.1)
 *
 * Core targets:
 * - Web: generate HTML from a chosen source representation (MD/XMD or LaTeX subset)
 *
 * Note: "hosting" is a later step; this endpoint returns a full HTML document so the web app
 * can open it in a new tab immediately.
 */

import { FastifyInstance } from 'fastify';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth.js';
import { DocumentService } from '../../services/document-service.js';
import { PdfCompileService } from '../../services/pdf-compile-service.js';
import { ApiResponse } from '@zadoox/shared';
import { projectIdParamSchema, publishPdfSchema, publishWebSchema } from '../../validation/schemas.js';
import { schemas, security } from '../../config/schemas.js';
import { parseXmdToIr, parseLatexToIr, renderIrToHtml } from '@zadoox/shared';

type PublishWebBody = {
  documentId: string;
  source: 'markdown' | 'latex';
  purpose?: 'web' | 'pdf';
};

type PublishPdfBody = {
  documentId: string;
  source: 'latex';
};

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function replaceZadooxAssetImgSrc(html: string): string {
  // Never leave <img src="zadoox-asset://..."> in the output. Browsers won't load it.
  // We replace with a placeholder + data-asset-key so the app can resolve it with auth.
  return String(html ?? '').replace(
    /<img([^>]*?)\s+src="zadoox-asset:\/\/([^"]+)"([^>]*)>/gim,
    (_m, preAttrs, key, postAttrs) =>
      `<img${preAttrs} src="${TRANSPARENT_PIXEL}" data-asset-key="${String(key)}"${postAttrs}>`
  );
}

function buildHtmlDocument(params: { title: string; bodyHtml: string; purpose: 'web' | 'pdf' }): string {
  const title = escapeHtml(params.title);
  const bodyHtml = params.bodyHtml ?? '';

  if (params.purpose === 'pdf') {
    // Print/PDF theme: white page, black text (regardless of app/editor theme).
    // Goal: predictable output until we support richer color policy.
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light; }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #000000;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      .container { max-width: 900px; margin: 0 auto; padding: 36px 24px; }
      .markdown-content { color: #000000; line-height: 1.6; }
      .markdown-content .doc-title { font-size: 2.2em; font-weight: 800; margin: 0.2em 0 0.7em 0; color: #000000; }
      .markdown-content .doc-author,
      .markdown-content .doc-date { color: #111827; font-size: 0.95em; margin: 0.1em 0; text-align: center; }
      .markdown-content h1, .markdown-content h2, .markdown-content h3, .markdown-content h4 { color: #000000; }
      .markdown-content p { margin: 0.5em 0; }
      .markdown-content code { background: #f3f4f6; padding: 0.2em 0.4em; border-radius: 3px; color: #000000; }
      .markdown-content pre { background: #f3f4f6; padding: 1em; border-radius: 6px; overflow-x: auto; margin: 1em 0; color: #000000; }
      .markdown-content pre code { background: transparent; padding: 0; }
      .markdown-content strong { font-weight: bold; color: #000000; }
      .markdown-content .figure-caption { display: block; margin-top: 0.25em; color: #111827; }
      .markdown-content table { border-collapse: collapse; width: 100%; margin: 1em 0; }
      .markdown-content th, .markdown-content td { border: 1px solid #e5e7eb; padding: 0.6em 0.8em; vertical-align: top; }
      .markdown-content th { background: #f9fafb; color: #000000; text-align: left; }
      @media print {
        /* Force black text in the printed PDF until we introduce color policy. */
        body, .markdown-content, .markdown-content * { color: #000000 !important; }
        html, body { background: #ffffff !important; }
        .container { padding: 0; }
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="markdown-content">${bodyHtml}</div>
    </div>
  </body>
</html>`;
  }

  // IMPORTANT:
  // The publish preview should match the in-app preview styling as closely as possible.
  // We mirror the key rules from `web/components/editor/markdown-preview.tsx` here so
  // document-level blocks (title/author/date), figures, tables, and code look consistent.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        --font-vscode: 'Consolas', 'Monaco', 'Courier New', monospace;
        color-scheme: dark;
      }
      html, body {
        margin: 0;
        padding: 0;
        background-color: #1e1e1e;
        color: #cccccc;
        font-family: var(--font-vscode);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        font-feature-settings: 'liga' 1, 'calt' 1;
      }
      .container {
        max-width: 900px;
        margin: 0 auto;
        padding: 24px;
      }
      .markdown-content {
        color: #cccccc;
        font-family: var(--font-vscode);
        line-height: 1.6;
      }
      /* Mirrors markdown-preview.tsx global styles */
      .markdown-content .doc-title {
        font-size: 2.2em;
        font-weight: 800;
        margin: 0.2em 0 0.7em 0;
        color: #ffffff;
      }
      .markdown-content .doc-author,
      .markdown-content .doc-date {
        color: #9aa0a6;
        font-size: 0.95em;
        margin: 0.1em 0;
        text-align: center;
      }
      .markdown-content h1 {
        font-size: 2em;
        font-weight: bold;
        margin: 1em 0 0.5em 0;
        color: #ffffff;
      }
      .markdown-content h2 {
        font-size: 1.5em;
        font-weight: bold;
        margin: 0.8em 0 0.4em 0;
        color: #ffffff;
      }
      .markdown-content h3 {
        font-size: 1.25em;
        font-weight: bold;
        margin: 0.6em 0 0.3em 0;
        color: #ffffff;
      }
      .markdown-content h4 {
        font-size: 1.1em;
        font-weight: bold;
        margin: 0.55em 0 0.25em 0;
        color: #ffffff;
      }
      .markdown-content p {
        margin: 0.5em 0;
      }
      .markdown-content code {
        background-color: #3e3e42;
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: var(--font-vscode);
      }
      .markdown-content pre {
        background-color: #252526;
        padding: 1em;
        border-radius: 4px;
        overflow-x: auto;
        margin: 1em 0;
      }
      .markdown-content pre code {
        background-color: transparent;
        padding: 0;
      }
      .markdown-content strong {
        font-weight: bold;
        color: #ffffff;
      }
      .markdown-content em {
        font-style: italic;
      }
      .markdown-content .figure-caption {
        display: block;
        margin-top: 0.25em;
        color: #9aa0a6;
      }
      .markdown-content a {
        color: #4ec9b0;
        text-decoration: underline;
      }
      .markdown-content a:hover {
        color: #6ed4c0;
      }
      .markdown-content u {
        text-decoration: underline;
      }
      .markdown-content sup {
        vertical-align: super;
        font-size: 0.8em;
      }
      .markdown-content sub {
        vertical-align: sub;
        font-size: 0.8em;
      }
      .markdown-content table {
        border-collapse: collapse;
        width: 100%;
        margin: 1em 0;
      }
      .markdown-content th,
      .markdown-content td {
        border: 1px solid #3e3e42;
        padding: 0.6em 0.8em;
        vertical-align: top;
      }
      .markdown-content th {
        background-color: #2d2d30;
        color: #ffffff;
        text-align: left;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="markdown-content">${bodyHtml}</div>
    </div>
  </body>
</html>`;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function publishRoutes(fastify: FastifyInstance) {
  // Publishing routes require authentication for now (Phase 12.1).
  fastify.addHook('preHandler', authenticateUser);

  /**
   * POST /api/v1/projects/:projectId/publish/pdf
   * Compile LaTeX -> PDF and return bytes.
   *
   * This endpoint intentionally stays stable while the compiler can be swapped via env:
   * PDF_COMPILER=tectonic|texlive
   */
  fastify.post(
    '/projects/:projectId/publish/pdf',
    {
      schema: {
        description: 'Generate PDF from LaTeX (Phase 12.1)',
        tags: ['Publishing'],
        security,
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string', format: 'uuid' },
          },
          required: ['projectId'],
        },
        body: {
          type: 'object',
          properties: {
            documentId: { type: 'string', format: 'uuid' },
            source: { type: 'string', enum: ['latex'] },
          },
          required: ['documentId', 'source'],
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
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

        const bodyValidation = publishPdfSchema.safeParse(request.body);
        if (!bodyValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid publish request body',
              details: bodyValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { projectId } = paramValidation.data;
        const { documentId } = bodyValidation.data as PublishPdfBody;

        const documentService = new DocumentService(request.supabase!);
        const doc = await documentService.getDocumentById(documentId);

        if (doc.projectId !== projectId) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Document not found in this project',
            },
          };
          return reply.status(404).send(response);
        }

        const latex = String(doc.metadata?.latex ?? '').trim();
        if (latex.length === 0) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'MISSING_LATEX',
              message: 'No LaTeX is available for this document',
            },
          };
          return reply.status(400).send(response);
        }

        const pdfService = new PdfCompileService();
        const pdf = await pdfService.compileLatexToPdf({
          latex,
          jobName: 'main',
        });

        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="${(doc.title || 'document').replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf"`);
        return reply.send(pdf);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
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
   * POST /api/v1/projects/:projectId/publish/web
   * Generate a web-ready HTML document from a selected document + source.
   */
  fastify.post(
    '/projects/:projectId/publish/web',
    {
      schema: {
        description: 'Generate HTML for web publishing (Phase 12.1)',
        tags: ['Publishing'],
        security,
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string', format: 'uuid' },
          },
          required: ['projectId'],
        },
        body: {
          type: 'object',
          properties: {
            documentId: { type: 'string', format: 'uuid' },
            source: { type: 'string', enum: ['markdown', 'latex'] },
            purpose: { type: 'string', enum: ['web', 'pdf'] },
          },
          required: ['documentId', 'source'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  html: { type: 'string' },
                  title: { type: 'string' },
                },
                required: ['html', 'title'],
              },
            },
            required: ['success', 'data'],
          },
          400: schemas.ApiResponse,
          401: schemas.ApiResponse,
          404: schemas.ApiResponse,
          500: schemas.ApiResponse,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
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

        const bodyValidation = publishWebSchema.safeParse(request.body);
        if (!bodyValidation.success) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid publish request body',
              details: bodyValidation.error.errors,
            },
          };
          return reply.status(400).send(response);
        }

        const { projectId } = paramValidation.data;
        const { documentId, source, purpose } = bodyValidation.data as PublishWebBody;

        const documentService = new DocumentService(request.supabase!);
        const doc = await documentService.getDocumentById(documentId);

        if (doc.projectId !== projectId) {
          const response: ApiResponse<null> = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Document not found in this project',
            },
          };
          return reply.status(404).send(response);
        }

        let ir;
        if (source === 'latex') {
          const latex = doc.metadata?.latex ?? '';
          if (String(latex).trim().length === 0) {
            const response: ApiResponse<null> = {
              success: false,
              error: {
                code: 'MISSING_LATEX',
                message: 'No LaTeX is available for this document',
              },
            };
            return reply.status(400).send(response);
          }
          ir = parseLatexToIr({ docId: doc.id, latex });
        } else {
          ir = parseXmdToIr({ docId: doc.id, xmd: doc.content ?? '' });
        }

        const bodyHtml = renderIrToHtml(ir);
        const html = buildHtmlDocument({
          title: doc.title || 'Untitled',
          bodyHtml: replaceZadooxAssetImgSrc(bodyHtml),
          purpose: purpose === 'pdf' ? 'pdf' : 'web',
        });

        const response: ApiResponse<{ html: string; title: string }> = {
          success: true,
          data: {
            html,
            title: doc.title || 'Untitled',
          },
        };
        return reply.send(response);
      } catch (error: unknown) {
        fastify.log.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate publish HTML';
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
}


