/**
 * Authentication middleware for Fastify
 * Validates Supabase JWT tokens from Authorization header
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { getSupabaseAdmin, createUserClient } from '../db/client.js';

export interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
  supabase?: ReturnType<typeof createUserClient>;
}

/**
 * Extract token from Authorization header
 */
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches userId to request
 */
export async function authenticateUser(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const token = extractToken(request.headers.authorization);

    if (!token) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid Authorization header',
        },
      });
    }

    // Verify token with Supabase
    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error && !user) {
      // Distinguish "token invalid" from "auth service unreachable" (local dev, DNS issues, offline).
      const raw = String((error as { message?: unknown } | null)?.message ?? error ?? '').toLowerCase();
      const isConnectivity =
        raw.includes('fetch') ||
        raw.includes('network') ||
        raw.includes('enotfound') ||
        raw.includes('eai_again') ||
        raw.includes('timed out') ||
        raw.includes('timeout') ||
        raw.includes('name not resolved') ||
        raw.includes('internet disconnected');
      if (isConnectivity) {
        return reply.status(503).send({
          success: false,
          error: {
            code: 'AUTH_UNAVAILABLE',
            message: 'Authentication service is unreachable. Check your internet connection and Supabase configuration.',
            details: { reason: String((error as { message?: unknown } | null)?.message ?? error ?? '') },
          },
        });
      }
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        },
      });
    }
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        },
      });
    }

    // Attach user info to request
    request.userId = user.id;
    request.supabase = createUserClient(token);
  } catch (error) {
    request.log.error(error, 'Authentication error');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed',
      },
    });
  }
}

