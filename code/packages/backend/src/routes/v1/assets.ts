/**
 * Asset routes
 *
 * Stores binary assets (images now; future: video/audio) in Supabase Storage and
 * returns stable asset references that can be embedded in markdown.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateUser, type AuthenticatedRequest } from '../../middleware/auth.js';
import { DocumentService } from '../../services/document-service.js';
import { supabaseAdmin } from '../../db/client.js';
import { generateId } from '@zadoox/shared';

const uploadAssetSchema = z.object({
  documentId: z.string().uuid(),
  b64: z.string().min(1),
  mimeType: z.string().min(1),
});

function extFromMime(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  // Fallback: keep it a safe binary extension
  return 'bin';
}

/**
 * We encode docId into the key so the backend can enforce access without a separate DB table.
 * key format: <docId>__<random>.<ext>
 */
function buildAssetKey(documentId: string, mimeType: string): string {
  const id = generateId();
  const ext = extFromMime(mimeType);
  return `${documentId}__${id}.${ext}`;
}

function parseDocIdFromKey(key: string): string | null {
  const idx = key.indexOf('__');
  if (idx <= 0) return null;
  const maybe = key.slice(0, idx);
  // UUIDs are fixed-length; simple sanity check
  if (!/^[0-9a-fA-F-]{36}$/.test(maybe)) return null;
  return maybe;
}

export async function assetRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticateUser);

  const bucket = process.env.SUPABASE_ASSETS_BUCKET || 'assets';
  let bucketEnsured = false;

  const ensureBucket = async () => {
    if (bucketEnsured) return;
    const admin = supabaseAdmin();

    // If the bucket doesn't exist, create it (private by default).
    // This makes local/dev setups Just Work without manual bucket creation.
    const { data: existing, error: getErr } = await admin.storage.getBucket(bucket);
    if (!existing || getErr) {
      const { error: createErr } = await admin.storage.createBucket(bucket, { public: false });
      if (createErr) {
        // If bucket already exists (race), ignore. Otherwise propagate.
        const msg = (createErr as { message?: string }).message || '';
        if (!/already exists/i.test(msg)) {
          throw createErr;
        }
      }
    }

    bucketEnsured = true;
  };

  fastify.post(
    '/assets/upload',
    {
      schema: {
        description: 'Upload an asset (base64) and receive a stable asset reference',
        tags: ['Assets'],
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const bodyValidation = uploadAssetSchema.safeParse(request.body);
      if (!bodyValidation.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: bodyValidation.error.errors,
          },
        });
      }

      const { documentId, b64, mimeType } = bodyValidation.data;

      // Enforce access via RLS on documents (user client)
      const documentService = new DocumentService(request.supabase!);
      await documentService.getDocumentById(documentId);

      // Decode
      let bytes: Buffer;
      try {
        bytes = Buffer.from(b64, 'base64');
      } catch {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid base64 payload' },
        });
      }

      const key = buildAssetKey(documentId, mimeType);

      const admin = supabaseAdmin();
      try {
        await ensureBucket();
      } catch (e) {
        request.log.error({ error: e }, 'Failed to ensure assets bucket exists');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'ASSET_BUCKET_INIT_FAILED',
            message: `Failed to initialize storage bucket "${bucket}"`,
            details: e instanceof Error ? e.message : String(e),
          },
        });
      }

      let { error } = await admin.storage.from(bucket).upload(key, bytes, {
        contentType: mimeType,
        upsert: false,
      });

      // If bucket is missing (common dev setup), try to create and retry once.
      if (error && /bucket not found/i.test(error.message || '')) {
        bucketEnsured = false;
        try {
          await ensureBucket();
          const retry = await admin.storage.from(bucket).upload(key, bytes, {
            contentType: mimeType,
            upsert: false,
          });
          error = retry.error;
        } catch (e) {
          request.log.error({ error: e }, 'Failed to create missing assets bucket');
        }
      }

      if (error) {
        request.log.error({ error }, 'Failed to upload asset');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'ASSET_UPLOAD_FAILED',
            message: 'Failed to upload asset',
            details: {
              bucket,
              message: error.message,
              status: (error as { status?: number }).status,
              statusCode: (error as { statusCode?: string }).statusCode,
            },
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          key,
          ref: `zadoox-asset://${key}`,
        },
      });
    }
  );

  fastify.get(
    '/assets/:key',
    {
      schema: {
        description: 'Fetch an asset by key (authenticated, access enforced by document ownership)',
        tags: ['Assets'],
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      const key = String((request.params as { key?: string }).key || '');
      if (!key) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Missing asset key' },
        });
      }

      const documentId = parseDocIdFromKey(key);
      if (!documentId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid asset key' },
        });
      }

      // Enforce access via RLS on documents (user client)
      const documentService = new DocumentService(request.supabase!);
      await documentService.getDocumentById(documentId);

      const admin = supabaseAdmin();
      try {
        await ensureBucket();
      } catch (e) {
        request.log.error({ error: e }, 'Failed to ensure assets bucket exists');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'ASSET_BUCKET_INIT_FAILED',
            message: `Failed to initialize storage bucket "${bucket}"`,
            details: e instanceof Error ? e.message : String(e),
          },
        });
      }
      const { data, error } = await admin.storage.from(bucket).download(key);
      if (error || !data) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Asset not found' },
        });
      }

      // data is a Blob in Node (undici). Convert to Buffer.
      const ab = await data.arrayBuffer();
      const buf = Buffer.from(ab);
      const contentType = data.type || 'application/octet-stream';

      reply.header('Content-Type', contentType);
      // Allow caching; auth still required for fetch, but browser can cache per session.
      reply.header('Cache-Control', 'private, max-age=3600');
      return reply.send(buf);
    }
  );
}


