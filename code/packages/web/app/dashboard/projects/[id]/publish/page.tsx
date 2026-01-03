'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout, LoaderIcon } from '@/components/dashboard';
import { api } from '@/lib/api/client';
import type { Document, Project } from '@zadoox/shared';

type PublishTarget = 'pdf' | 'web';
type PublishSource = 'markdown' | 'latex';

function getActiveDocStorageKey(projectId: string) {
  return `zadoox:activeDoc:${projectId}`;
}

function safeGetLocalStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorageItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function sortDocumentsForPicker(docs: Document[]) {
  return [...docs].sort((a, b) => {
    const aTime = new Date(a.updatedAt).getTime();
    const bTime = new Date(b.updatedAt).getTime();
    return bTime - aTime;
  });
}

export default function ProjectPublishPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [target, setTarget] = useState<PublishTarget>('pdf');
  const [source, setSource] = useState<PublishSource>('markdown');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewForTarget, setPreviewForTarget] = useState<PublishTarget | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setStatusMessage(null);

        const [proj, docs] = await Promise.all([
          api.projects.get(projectId),
          api.documents.listByProject(projectId),
        ]);

        setProject(proj);
        const sorted = sortDocumentsForPicker(docs);
        setDocuments(sorted);

        const saved = safeGetLocalStorageItem(getActiveDocStorageKey(projectId));
        const defaultId = saved && sorted.some((d) => d.id === saved) ? saved : sorted[0]?.id || '';
        setSelectedDocumentId(defaultId);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load publishing data');
        console.error('Failed to load publish page:', err);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) load();
  }, [projectId]);

  const selectedDocument = useMemo(
    () => documents.find((d) => d.id === selectedDocumentId) || null,
    [documents, selectedDocumentId]
  );

  const hasLatex = !!selectedDocument?.metadata?.latex;
  const recommendedSource: PublishSource = useMemo(() => {
    if (!selectedDocument || !project) return 'markdown';
    const last = selectedDocument.metadata?.lastEditedFormat;
    if (last === 'latex') return hasLatex ? 'latex' : 'markdown';
    if (last === 'markdown') return 'markdown';
    const def = project.settings?.defaultFormat;
    if (def === 'latex') return hasLatex ? 'latex' : 'markdown';
    return 'markdown';
  }, [hasLatex, project, selectedDocument]);

  useEffect(() => {
    // Keep source in a sane state when switching documents.
    setSource((prev) => {
      if (prev === 'latex' && !hasLatex) return 'markdown';
      return recommendedSource;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocumentId]);

  const onSelectDocument = (id: string) => {
    setSelectedDocumentId(id);
    if (id) safeSetLocalStorageItem(getActiveDocStorageKey(projectId), id);
    setStatusMessage(null);
    setPreviewHtml(null);
    setPreviewTitle(null);
    setPreviewForTarget(null);
  };

  const onPublish = () => {
    if (!selectedDocument) {
      setStatusMessage('Select a document to publish.');
      return;
    }

    if (target === 'pdf') {
      router.push(
        `/dashboard/projects/${projectId}/publish/preview?documentId=${encodeURIComponent(
          selectedDocument.id
        )}&source=${encodeURIComponent(source)}`
      );
      return;
    }

    setPublishing(true);
    setStatusMessage('Generating HTML...');
    setPreviewHtml(null);
    setPreviewTitle(null);
    setPreviewForTarget(null);
    api.publish
      .web(projectId, { documentId: selectedDocument.id, source })
      .then(({ html, title }) => {
        const htmlStr = String((html as unknown) ?? '');
        const titleStr = String((title as unknown) ?? '');

        setStatusMessage(
          'Generated HTML preview below.'
        );
        setPreviewHtml(htmlStr);
        setPreviewTitle(titleStr);
        setPreviewForTarget(target);
      })
      .catch((err: unknown) => {
        setStatusMessage(err instanceof Error ? err.message : 'Failed to publish');
      })
      .finally(() => {
        setPublishing(false);
      });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <LoaderIcon className="w-8 h-8 text-[#969696] animate-spin" />
            </div>
            <p className="text-[#969696]">Loading publish settings...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-[#969696] mb-4">{error || 'Project not found'}</p>
            <button
              onClick={() => router.push(`/dashboard/projects/${projectId}`)}
              className="px-4 py-2 bg-[#007acc] hover:bg-[#1a8cd8] text-white rounded"
            >
              Back to Project
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-[#3e3e42] bg-[#252526]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white mb-1">Publish</h1>
              <p className="text-sm text-[#969696]">
                {project.name} · Publish as PDF or Web
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/dashboard/projects/${projectId}`)}
                className="px-4 py-2 bg-[#3e3e42] hover:bg-[#464647] text-white rounded text-sm font-medium transition-colors"
              >
                Back to Project
              </button>
              <button
                onClick={() => router.push(`/dashboard/projects/${projectId}/settings`)}
                className="px-4 py-2 bg-[#3e3e42] hover:bg-[#464647] text-white rounded text-sm font-medium transition-colors"
              >
                Settings
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-6 bg-[#252526] border border-[#3e3e42] rounded">
              <h2 className="text-lg font-semibold text-white mb-4">Publishing</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#969696] mb-2">Document</label>
                  {documents.length === 0 ? (
                    <div className="text-sm text-[#969696]">
                      No documents found for this project.
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 min-w-0">
                      <select
                        value={selectedDocumentId}
                        onChange={(e) => onSelectDocument(e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 bg-[#1e1e1e] border border-[#3e3e42] rounded text-white text-sm"
                      >
                        {documents.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.title}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          selectedDocumentId &&
                          router.push(
                            `/dashboard/projects/${projectId}/documents/${selectedDocumentId}`
                          )
                        }
                        className="shrink-0 px-3 py-2 bg-[#3e3e42] hover:bg-[#464647] text-white rounded text-sm font-medium transition-colors"
                        disabled={!selectedDocumentId}
                      >
                        Open
                      </button>
                    </div>
                  )}
                  {selectedDocument && (
                    <p className="mt-2 text-xs text-[#969696]">
                      Last updated {new Date(selectedDocument.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#969696] mb-2">Target</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTarget('pdf')}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors border ${
                        target === 'pdf'
                          ? 'bg-[#2d2d30] border-[#6b7280] text-white'
                          : 'bg-[#1e1e1e] border-[#3e3e42] text-[#cccccc] hover:text-white hover:bg-[#2a2a2d]'
                      }`}
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => setTarget('web')}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors border ${
                        target === 'web'
                          ? 'bg-[#2d2d30] border-[#6b7280] text-white'
                          : 'bg-[#1e1e1e] border-[#3e3e42] text-[#cccccc] hover:text-white hover:bg-[#2a2a2d]'
                      }`}
                    >
                      Web
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-[#969696]">
                    PDF: download/export · Web: host a public preview
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#969696] mb-2">Source</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-[#cccccc]">
                      <input
                        type="radio"
                        name="source"
                        value="markdown"
                        checked={source === 'markdown'}
                        onChange={() => setSource('markdown')}
                      />
                      Markdown (XMD)
                    </label>
                    <label
                      className={`flex items-center gap-2 text-sm ${
                        hasLatex ? 'text-[#cccccc]' : 'text-[#666]'
                      }`}
                      title={hasLatex ? '' : 'No LaTeX cached on this document yet'}
                    >
                      <input
                        type="radio"
                        name="source"
                        value="latex"
                        checked={source === 'latex'}
                        onChange={() => setSource('latex')}
                        disabled={!hasLatex}
                      />
                      LaTeX
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-[#969696]">
                    LaTeX is full-fidelity for PDF; Markdown/XMD matches web preview styling.
                  </p>
                </div>

                <div className="flex items-end justify-end">
                  <button
                    onClick={onPublish}
                    className="px-4 py-2 bg-[#007acc] hover:bg-[#1a8cd8] text-white rounded text-sm font-medium transition-colors"
                    disabled={!selectedDocumentId || publishing}
                  >
                    {publishing ? (
                      <span className="inline-flex items-center gap-2">
                        <LoaderIcon className="w-4 h-4 animate-spin" />
                        Publishing…
                      </span>
                    ) : (
                      'Publish'
                    )}
                  </button>
                </div>
              </div>

              {statusMessage && (
                <div className="mt-4 px-3 py-2 bg-[#1e1e1e] border border-[#3e3e42] rounded text-sm text-[#cccccc]">
                  {statusMessage}
                </div>
              )}

            </div>

            {previewHtml && (
              <div className="p-6 bg-[#252526] border border-[#3e3e42] rounded">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Preview</h2>
                    <p className="text-sm text-[#969696]">
                      {previewTitle || 'Published Page'} ·{' '}
                      rendered HTML
                    </p>
                  </div>
                </div>
                <div className="border border-[#3e3e42] rounded overflow-hidden bg-white">
                  <iframe
                    title="Publish preview"
                    srcDoc={previewHtml}
                    className="w-full"
                    style={{ height: 700 }}
                    sandbox="allow-same-origin allow-modals"
                    ref={previewIframeRef}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


