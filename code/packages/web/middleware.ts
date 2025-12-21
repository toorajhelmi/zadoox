/**
 * Next.js middleware for protecting routes and handling authentication
 */

import { updateSession } from './lib/supabase/middleware.js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Update Supabase session
  const response = await updateSession(request);

  // Protected routes - require authentication
  const protectedPaths = ['/dashboard', '/projects', '/documents'];
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  if (isProtectedPath) {
    // Check if user is authenticated
    // We'll get the session from cookies in the route handlers/components
    // For now, just pass through - we'll handle auth checks in the pages
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

