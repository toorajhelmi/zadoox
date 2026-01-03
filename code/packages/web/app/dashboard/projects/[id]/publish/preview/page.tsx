'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout, LoaderIcon } from '@/components/dashboard';
import { api } from '@/lib/api/client';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';

type PublishSource = 'markdown' | 'latex';

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

export default function PublishPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const projectId = params.id as string;

  const documentId = search.get('documentId') || '';
  const source = (search.get('source') || 'markdown') as PublishSource;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string>('');
  const [title, setTitle] = useState<string>('Preview');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const canLoad = useMemo(() => !!projectId && !!documentId, [projectId, documentId]);

  useEffect(() => {
    if (!canLoad) {
      setLoading(false);
      setError('Missing documentId');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setHtml('');

    api.publish
      .web(projectId, { documentId, source, purpose: 'pdf' })
      .then((res) => {
        if (cancelled) return;
        setHtml(String(res.html ?? ''));
        setTitle(String(res.title ?? 'Preview'));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to generate preview');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canLoad, documentId, projectId, source]);

  // Track auth token so we can fetch private assets for zadoox-asset:// figures.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setAccessToken(session?.access_token ?? null);
    })();

    const maybeOnAuthStateChange = (supabase.auth as unknown as { onAuthStateChange?: unknown })
      .onAuthStateChange;
    const sub =
      typeof maybeOnAuthStateChange === 'function'
        ? (supabase.auth as unknown as {
            onAuthStateChange: (cb: (event: unknown, session: { access_token?: string } | null) => void) => {
              data: { subscription: { unsubscribe: () => void } };
            };
          }).onAuthStateChange((_event, session) => {
            if (cancelled) return;
            setAccessToken(session?.access_token ?? null);
          })
        : null;

    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  const resolveAssetImages = async () => {
    const token = accessToken;
    const iframe = iframeRef.current;
    if (!token || !iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const imgs = Array.from(doc.querySelectorAll('img')) as HTMLImageElement[];
    const assetImgs = imgs.filter((img) => {
      const key = img.getAttribute('data-asset-key');
      if (!key) return false;
      const src = img.getAttribute('src') || '';
      return src === TRANSPARENT_PIXEL || src.trim() === '';
    });
    if (assetImgs.length === 0) return;

    await Promise.all(
      assetImgs.map(async (img) => {
        const key = img.getAttribute('data-asset-key') || '';
        if (!key) return;
        try {
          const res = await fetch(`${API_BASE}/assets/${encodeURIComponent(key)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          img.src = url;
        } catch {
          // ignore
        }
      })
    );
  };

  // Re-resolve assets when the iframe loads or when token/html changes.
  useEffect(() => {
    void resolveAssetImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, html]);

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-[#3e3e42] bg-[#252526]">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-white mb-1 truncate">{title}</h1>
              <p className="text-sm text-[#969696]">PDF preview</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => router.push(`/dashboard/projects/${projectId}/publish`)}
                className="px-4 py-2 bg-[#3e3e42] hover:bg-[#464647] text-white rounded text-sm font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => {
                  const w = iframeRef.current?.contentWindow;
                  if (!w) return;
                  try {
                    w.focus();
                    w.print();
                  } catch {
                    // noop
                  }
                }}
                className="p-2 bg-[#3e3e42] hover:bg-[#464647] text-white rounded transition-colors"
                title="Save as PDF"
                aria-label="Save as PDF"
                disabled={loading || !html}
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto">
            {loading ? (
              <div className="h-[700px] flex items-center justify-center bg-[#252526] border border-[#3e3e42] rounded">
                <div className="text-center">
                  <div className="mb-4 flex justify-center">
                    <LoaderIcon className="w-8 h-8 text-[#969696] animate-spin" />
                  </div>
                  <p className="text-[#969696]">Generating preview…</p>
                </div>
              </div>
            ) : error ? (
              <div className="p-6 bg-[#252526] border border-[#3e3e42] rounded">
                <p className="text-[#cccccc]">{error}</p>
              </div>
            ) : (
              <div className="border border-[#3e3e42] rounded overflow-hidden bg-white">
                <iframe
                  ref={iframeRef}
                  title="PDF preview"
                  srcDoc={html}
                  className="w-full"
                  style={{ height: 800 }}
                  sandbox="allow-same-origin allow-modals"
                  onLoad={() => {
                    void resolveAssetImages();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


