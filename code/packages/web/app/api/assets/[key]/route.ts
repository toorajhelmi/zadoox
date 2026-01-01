import { createClient } from '@/lib/supabase/server';

const BACKEND_API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export async function GET(
  _req: Request,
  { params }: { params: { key: string } }
): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token || null;
  if (!accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const key = params.key;
  const upstream = await fetch(`${BACKEND_API_BASE}/assets/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return new Response(text || 'Failed to fetch asset', { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': upstream.headers.get('cache-control') || 'private, max-age=3600',
    },
  });
}


