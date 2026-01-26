'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { extractOutlineItemsFromIr, type DocumentNode } from '@zadoox/shared';
import {
  ChevronRightIcon,
  DocumentTextIcon,
  PhotoIcon,
  FolderIcon,
  Squares2X2Icon,
  TrashIcon,
  Square2StackIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';
import type { OutlineItem } from '@zadoox/shared';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api/client';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import type { Document as ZadooxDocument } from '@zadoox/shared';

interface DocumentOutlineProps {
  content: string;
  ir?: DocumentNode | null;
  projectName?: string;
  projectId?: string;
  currentDocumentId?: string;
}

type HeadingItem = Extract<OutlineItem, { kind: 'heading' }>;
type FigureItem = Extract<OutlineItem, { kind: 'figure' }>;
type GridItem = Extract<OutlineItem, { kind: 'grid' }>;
type OutlineNode =
  | { kind: 'heading_node'; item: HeadingItem; children: OutlineNode[] }
  | { kind: 'grid_node'; item: GridItem; children: OutlineNode[] }
  | { kind: 'figure_node'; item: FigureItem };

type AssetFile = { key: string; relPath: string };

type HoveredAsset = {
  key: string;
  relPath: string;
  anchorRect: DOMRect;
};

const projectDocsCache = new Map<string, ZadooxDocument[]>();

function toFileNameFromTitle(title: string): string {
  const t = String(title ?? '').trim() || 'Untitled Document';
  const safe = t
    .toLowerCase()
    .replace(/[^a-z0-9 _-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safe || 'untitled-document'}.md`;
}

function mergeDocsPreserveOrder(prev: ZadooxDocument[], next: ZadooxDocument[]): ZadooxDocument[] {
  // Preserve the existing order as much as possible (prevents "tree reorders" on navigation).
  // Update doc objects for existing ids; append truly new docs at the end; drop missing docs.
  const nextById = new Map(next.map((d) => [d.id, d]));
  const nextIds = new Set(next.map((d) => d.id));

  const out: ZadooxDocument[] = [];
  for (const d of prev) {
    if (!nextIds.has(d.id)) continue;
    out.push(nextById.get(d.id) ?? d);
  }
  for (const d of next) {
    if (prev.some((p) => p.id === d.id)) continue;
    out.push(d);
  }
  return out;
}

function collectAssetFilesFromIr(ir: DocumentNode): AssetFile[] {
  const out = new Map<string, AssetFile>();
  const walk = (n: import('@zadoox/shared').IrNode) => {
    if (n.type === 'figure') {
      const src = String((n as unknown as { src?: string }).src ?? '').trim();
      const prefix = 'zadoox-asset://';
      if (src.startsWith(prefix)) {
        const key = src.slice(prefix.length).trim();
        if (key && !out.has(key)) out.set(key, { key, relPath: `assets/${key}` });
      }
    }
    if (n.type === 'grid') {
      const rows = (n as unknown as { rows?: Array<Array<{ children?: import('@zadoox/shared').IrNode[] }>> }).rows ?? [];
      for (const row of rows) {
        for (const cell of row ?? []) {
          for (const child of cell?.children ?? []) walk(child);
        }
      }
    }
    // Fallback: if a paragraph contains markdown asset images, still count them as assets.
    // This protects the outline even if a cell wasn't parsed into a FigureNode for any reason.
    if (n.type === 'paragraph') {
      const t = String((n as any).text ?? '');
      const re = /!\[[^\]]*\]\(\s*(zadoox-asset:\/\/[^)\s]+)\s*\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) {
        const src = String(m[1] ?? '').trim();
        const prefix = 'zadoox-asset://';
        if (!src.startsWith(prefix)) continue;
        const key = src.slice(prefix.length).trim();
        if (key && !out.has(key)) out.set(key, { key, relPath: `assets/${key}` });
      }
    }
    if ((n.type === 'document' || n.type === 'section') && (n as any).children?.length) {
      for (const c of (n as any).children) walk(c);
    }
  };
  walk(ir);
  return Array.from(out.values());
}

function buildOutlineTree(items: OutlineItem[]): OutlineNode[] {
  const root: OutlineNode[] = [];
  const stack: Array<{ level: number; node: Extract<OutlineNode, { kind: 'heading_node' }> }> = [];
  const gridById = new Map<string, Extract<OutlineNode, { kind: 'grid_node' }>>();

  for (const item of items) {
    if (item.kind === 'heading') {
      const node: Extract<OutlineNode, { kind: 'heading_node' }> = {
        kind: 'heading_node',
        item,
        children: [],
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
        stack.pop();
      }

      const parent = stack.length > 0 ? stack[stack.length - 1].node : null;
      if (parent) parent.children.push(node);
      else root.push(node);

      stack.push({ level: item.level, node });
      continue;
    }

    if (item.kind === 'grid') {
      const gridNode: Extract<OutlineNode, { kind: 'grid_node' }> = { kind: 'grid_node', item, children: [] };
      gridById.set(item.id, gridNode);
      const parent = stack.length > 0 ? stack[stack.length - 1].node : null;
      if (parent) parent.children.push(gridNode);
      else root.push(gridNode);
      continue;
    }

    // Figure: attach under parent grid if present; else under current heading.
    const figNode: OutlineNode = { kind: 'figure_node', item };
    const parentGridId = (item as FigureItem).parentId;
    const gridParent = parentGridId ? gridById.get(parentGridId) : null;
    if (gridParent) {
      gridParent.children.push(figNode);
      continue;
    }
    const parentHeading = stack.length > 0 ? stack[stack.length - 1].node : null;
    if (parentHeading) parentHeading.children.push(figNode);
    else root.push(figNode);
  }

  return root;
}

function collectCollapsibleHeadingIds(nodes: OutlineNode[]): string[] {
  const ids: string[] = [];
  for (const n of nodes) {
    if (n.kind === 'heading_node') {
      if (n.children.length > 0) ids.push(n.item.id);
      ids.push(...collectCollapsibleHeadingIds(n.children));
    }
    if (n.kind === 'grid_node') {
      if (n.children.length > 0) ids.push(n.item.id);
      ids.push(...collectCollapsibleHeadingIds(n.children));
    }
  }
  return ids;
}

export function DocumentOutline({ content, ir, projectName, projectId, currentDocumentId }: DocumentOutlineProps) {
  // IMPORTANT: Outline must be driven from the canonical IR provided by the editor pipeline.
  // Do not parse content here; that would create a second IR and can diverge across edit modes.
  const derivedIr = ir ?? null;
  const router = useRouter();
  const params = useParams<{ id?: string; documentId?: string }>();

  const items = useMemo(() => {
    // Phase 11: outline is IR-driven.
    return derivedIr ? extractOutlineItemsFromIr(derivedIr) : [];
  }, [derivedIr]);

  // We render a file/folder tree UI in the outline pane. The "file" represents the current document.
  // The document title (if present) becomes the file label; outline contents are headings/figures under that file.
  const docTitleItem = useMemo(() => items.find((i) => i.kind === 'heading' && i.id === 'doc-title') as HeadingItem | undefined, [items]);
  const fileLabel = useMemo(() => (docTitleItem?.text?.trim() ? docTitleItem.text.trim() : 'Untitled Document'), [docTitleItem]);
  const fileName = useMemo(() => toFileNameFromTitle(fileLabel), [fileLabel]);
  const outlineItems = useMemo(() => items.filter((i) => !(i.kind === 'heading' && i.id === 'doc-title')), [items]);

  const tree = useMemo(() => buildOutlineTree(outlineItems), [outlineItems]);
  // Use the route-param document id (passed from EditorLayout) as the stable key.
  // Falling back to IR docId is allowed for unit tests / standalone usage.
  const docKey = currentDocumentId ?? derivedIr?.docId ?? 'unknown';
  const storageKey = useMemo(() => `zadoox:outline:collapsed:${docKey}`, [docKey]);
  const collapsibleIds = useMemo(() => collectCollapsibleHeadingIds(tree), [tree]);
  const assets = useMemo(() => (derivedIr ? collectAssetFilesFromIr(derivedIr) : []), [derivedIr]);

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [fileCollapsed, setFileCollapsed] = useState(false);
  const [assetsCollapsed, setAssetsCollapsed] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [hoveredAsset, setHoveredAsset] = useState<HoveredAsset | null>(null);
  const [assetUrlByKey, setAssetUrlByKey] = useState<Record<string, string>>({});
  const [assetLoadingByKey, setAssetLoadingByKey] = useState<Record<string, boolean>>({});

  const [projectDocs, setProjectDocs] = useState<ZadooxDocument[]>(() => {
    if (!projectId) return [];
    return projectDocsCache.get(projectId) ?? [];
  });
  const [docsLoading, setDocsLoading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [duplicatingDocId, setDuplicatingDocId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

  // Load project documents so the outline can show which doc holds which sections (multi-doc projects).
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const cached = projectDocsCache.get(projectId) ?? [];
    // Do NOT refetch on navigation. Keep the list visually stable.
    // We only fetch when there's no cache yet; create/delete/duplicate update the cache explicitly.
    if (cached.length === 0) setDocsLoading(true);
    (async () => {
      try {
        const docs = await api.documents.listByProject(projectId);
        if (cancelled) return;
        const prev = projectDocsCache.get(projectId) ?? [];
        const merged = prev.length > 0 ? mergeDocsPreserveOrder(prev, docs) : docs;
        projectDocsCache.set(projectId, merged);
        setProjectDocs((cur) => {
          // Avoid pointless state churn: if ids are identical and in the same order,
          // keep the existing array reference.
          if (cur.length === merged.length) {
            let same = true;
            for (let i = 0; i < cur.length; i++) {
              if (cur[i]?.id !== merged[i]?.id) {
                same = false;
                break;
              }
            }
            if (same) return cur;
          }
          return merged;
        });
      } catch {
        if (!cancelled) setProjectDocs([]);
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const deleteDoc = async (docId: string) => {
    if (!projectId) return;
    setDeletingDocId(docId);
    try {
      await api.documents.delete(docId);
      const activeId = currentDocumentId || derivedIr?.docId || null;
      // Refresh list (ensures we always navigate based on the latest state).
      const nextDocs = await api.documents.listByProject(projectId);
      projectDocsCache.set(projectId, nextDocs);
      setProjectDocs(nextDocs);
      if (activeId && docId === activeId) {
        // Navigate away from deleted doc.
        const remaining = nextDocs.filter((d) => d.id !== docId);
        const next = remaining[0]?.id || null;
        if (next) router.push(`/dashboard/projects/${projectId}/documents/${next}`);
        else router.push(`/dashboard/projects/${projectId}`);
      }
    } finally {
      setDeletingDocId(null);
    }
  };

  const openDeleteConfirm = (doc: { id: string; title?: string | null }) => {
    const title = String(doc.title ?? '').trim() || 'Untitled Document';
    setDeleteConfirm({ id: doc.id, title });
  };

  const renderDeleteConfirmModal = () => {
    if (!deleteConfirm) return null;
    return (
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm delete document"
        onMouseDown={(e) => {
          // Click outside to close.
          if (e.target === e.currentTarget) setDeleteConfirm(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setDeleteConfirm(null);
        }}
      >
        <div className="w-full max-w-[520px] rounded border border-[#3e3e42] bg-[#1e1e1e] shadow-xl">
          <div className="px-5 py-4 border-b border-[#3e3e42]">
            <div className="text-sm font-semibold text-white">Delete document</div>
            <div className="text-xs text-[#969696] mt-1">
              This will permanently delete <span className="text-[#cccccc] font-medium">“{deleteConfirm.title}”</span>.
            </div>
          </div>
          <div className="px-5 py-4 border-t border-[#3e3e42] flex items-center justify-end gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded bg-[#3e3e42] hover:bg-[#464647] text-white text-sm transition-colors"
              onClick={() => setDeleteConfirm(null)}
              disabled={deletingDocId === deleteConfirm.id}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded bg-[#b91c1c] hover:bg-[#dc2626] text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-wait"
              onClick={async () => {
                const id = deleteConfirm.id;
                setDeleteConfirm(null);
                await deleteDoc(id);
              }}
              disabled={deletingDocId === deleteConfirm.id}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  const duplicateDoc = async (docId: string) => {
    if (!projectId) return;
    setDuplicatingDocId(docId);
    try {
      const created = await api.documents.duplicate(docId);
      setProjectDocs((prev) => {
        const next = [...prev, created];
        projectDocsCache.set(projectId, next);
        return next;
      });
      router.push(`/dashboard/projects/${projectId}/documents/${created.id}`);
    } finally {
      setDuplicatingDocId(null);
    }
  };

  // Load persisted collapsed state (best-effort).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setCollapsedIds(new Set());
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      const arr = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
      setCollapsedIds(new Set(arr));
    } catch {
      setCollapsedIds(new Set());
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...collapsedIds]));
    } catch {
      // ignore
    }
  }, [collapsedIds, storageKey]);

  // Track auth token so we can fetch private assets for hover thumbnails.
  useEffect(() => {
    if (assets.length === 0) return;
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
  }, [assets.length]);

  // Cleanup blob URLs on unmount.
  useEffect(() => {
    return () => {
      for (const url of Object.values(assetUrlByKey)) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureAssetUrl = async (key: string) => {
    if (!key) return;
    if (assetUrlByKey[key]) return;
    if (assetLoadingByKey[key]) return;
    const token = accessToken;
    if (!token) return;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    try {
      setAssetLoadingByKey((prev) => ({ ...prev, [key]: true }));
      const res = await fetch(`${API_BASE}/assets/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAssetUrlByKey((prev) => ({ ...prev, [key]: url }));
    } catch {
      // ignore
    } finally {
      setAssetLoadingByKey((prev) => ({ ...prev, [key]: false }));
    }
  };

  const renderAssetPreview = () => {
    if (!hoveredAsset) return null;
    const { key, relPath, anchorRect } = hoveredAsset;
    const url = assetUrlByKey[key];
    const isLoading = !!assetLoadingByKey[key] && !url;

    // Position to the right of the row; clamp vertically a bit.
    const left = Math.min(window.innerWidth - 220, anchorRect.right + 8);
    const top = Math.max(8, Math.min(window.innerHeight - 180, anchorRect.top + anchorRect.height / 2 - 80));

    const node = (
      <div
        className="fixed z-[9999] bg-[#252526] border border-[#3e3e42] rounded p-2 shadow-lg"
        style={{ left, top, width: 200 }}
        role="tooltip"
      >
        <div className="text-xs text-[#cccccc] truncate mb-2" title={relPath}>
          {key}
        </div>
        <div className="bg-white rounded" style={{ width: '100%', height: 140 }}>
          {url ? (
            <Image
              src={url}
              alt={key}
              width={196}
              height={140}
              className="block w-full h-full"
              style={{ objectFit: 'contain' }}
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-[#666]">
              {isLoading ? 'Loading…' : 'No preview'}
            </div>
          )}
        </div>
      </div>
    );

    return createPortal(node, document.body);
  };

  const handleHeadingClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    // Scroll to heading in preview (if visible) or editor
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleCollapsed = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const collapseAll = () => {
    // Collapse everything: file node, assets folder, and all collapsible headings.
    setFileCollapsed(true);
    setAssetsCollapsed(true);
    setCollapsedIds(new Set(collapsibleIds));
  };
  const expandAll = () => {
    setFileCollapsed(false);
    setAssetsCollapsed(false);
    setCollapsedIds(new Set());
  };

  const isFullyCollapsed = fileCollapsed && assetsCollapsed && collapsedIds.size === collapsibleIds.length;

  const renderNodes = (nodes: OutlineNode[], parentHeadingLevel: number | null = null, basePadRem = 0) => {
    return nodes.map((node, index) => {
      if (node.kind === 'figure_node') {
        const pad = (parentHeadingLevel == null ? 0.5 : parentHeadingLevel * 0.75 + 0.5) + basePadRem;
        const item = node.item;
        return (
          <a
            key={`figure-${item.id}`}
            href={`#${item.id}`}
            onClick={(e) => handleHeadingClick(e, item.id)}
            className="flex items-center gap-2 py-1 px-2 text-sm hover:bg-vscode-active rounded transition-colors text-vscode-text-secondary hover:text-vscode-text"
            style={{ paddingLeft: `${pad}rem` }}
            title={item.caption || undefined}
          >
            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-60" aria-hidden="true">
              <PhotoIcon className="w-4 h-4" />
            </span>
            <span className="opacity-80 truncate">{item.text}</span>
          </a>
        );
      }

      if (node.kind === 'grid_node') {
        const pad = (parentHeadingLevel == null ? 0.5 : parentHeadingLevel * 0.75 + 0.5) + basePadRem;
        const item = node.item;
        const hasChildren = node.children.length > 0;
        const isCollapsed = collapsedIds.has(item.id);
        return (
          <div key={`grid-${item.id}`}>
            <div
              className="flex items-center gap-2 py-1 px-2 text-sm hover:bg-vscode-active rounded transition-colors text-vscode-text-secondary hover:text-vscode-text"
              style={{ paddingLeft: `${pad}rem` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={isCollapsed ? 'Expand grid' : 'Collapse grid'}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleCollapsed(item.id);
                  }}
                  className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-70 hover:opacity-100"
                >
                  <ChevronRightIcon className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                </button>
              ) : (
                <span className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              )}

              <a
                href={`#${item.id}`}
                onClick={(e) => handleHeadingClick(e, item.id)}
                className="flex items-center gap-2 min-w-0"
              >
                <Squares2X2Icon className="w-4 h-4 opacity-60 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{item.text}</span>
              </a>
            </div>
            {hasChildren && !isCollapsed && (
              <div className="space-y-1">{renderNodes(node.children, parentHeadingLevel, basePadRem + 0.75)}</div>
            )}
          </div>
        );
      }

      const item = node.item;
      const hasChildren = node.children.length > 0;
      const isCollapsed = collapsedIds.has(item.id);
      const pad = (item.level - 1) * 0.75 + 0.5 + basePadRem;

      return (
        <div key={`heading-${item.id}`}>
          <div
            className="flex items-center gap-2 py-1 px-2 text-sm hover:bg-vscode-active rounded transition-colors text-vscode-text-secondary hover:text-vscode-text"
            style={{ paddingLeft: `${pad}rem` }}
          >
            {hasChildren ? (
              <button
                type="button"
                aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleCollapsed(item.id);
                }}
                className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-70 hover:opacity-100"
              >
                <ChevronRightIcon className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
              </button>
            ) : (
              <span className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            )}

            <a
              href={`#${item.id}`}
              onClick={(e) => handleHeadingClick(e, item.id)}
              className="flex items-center gap-2 min-w-0"
            >
              <DocumentTextIcon className="w-4 h-4 opacity-60 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{item.text}</span>
            </a>
          </div>

          {hasChildren && !isCollapsed && (
            <div className="space-y-1">{renderNodes(node.children, item.level, basePadRem)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="p-4">
      {/* No project-root folder row: the outline starts directly with actual folders (e.g. documents/assets). */}
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            isFullyCollapsed ? expandAll() : collapseAll();
          }}
          className="p-1 rounded hover:bg-vscode-active transition-colors text-vscode-text-secondary hover:text-vscode-text"
          title={isFullyCollapsed ? 'Expand all' : 'Collapse all'}
          aria-label={isFullyCollapsed ? 'Expand all' : 'Collapse all'}
        >
          {isFullyCollapsed ? <ArrowsPointingOutIcon className="w-4 h-4" /> : <ArrowsPointingInIcon className="w-4 h-4" />}
        </button>
      </div>

      {/* Documents shown at root level. */}
      {projectId ? (
        <div className="space-y-1">
          {projectDocs.map((doc: any) => {
            const activeDocId =
              (typeof params?.documentId === 'string' ? params.documentId : null) ??
              currentDocumentId ??
              derivedIr?.docId ??
              null;
            const isCurrent = Boolean(activeDocId && doc.id === activeDocId);
            const label = String(doc?.title ?? '').trim() || (isCurrent ? fileLabel : 'Untitled Document');
            // Keep filename as tooltip-only (avoid noisy second line in the tree).
            const name = toFileNameFromTitle(label);

            if (!isCurrent) {
              return (
                <div key={doc.id} className="group flex items-center gap-2 px-2 py-1 rounded hover:bg-vscode-active transition-colors">
                  <button
                    type="button"
                    className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-70 hover:opacity-100"
                    aria-label="Open document"
                    title="Open"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!projectId) return;
                      router.push(`/dashboard/projects/${projectId}/documents/${doc.id}`);
                    }}
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                  <DocumentTextIcon className="w-4 h-4 opacity-60 flex-shrink-0" aria-hidden="true" />
                  <button
                    type="button"
                    className="min-w-0 text-left flex-1"
                    title={`${label}\n${name}`}
                    onClick={() => {
                      if (!projectId) return;
                      router.push(`/dashboard/projects/${projectId}/documents/${doc.id}`);
                    }}
                  >
                    <div className="text-sm text-vscode-text truncate">{label}</div>
                  </button>
                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-vscode-hover text-vscode-text-secondary hover:text-vscode-text"
                      title="Duplicate"
                      aria-label="Duplicate document"
                      disabled={duplicatingDocId === doc.id || deletingDocId === doc.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void duplicateDoc(doc.id);
                      }}
                    >
                      <Square2StackIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-vscode-hover text-vscode-text-secondary hover:text-vscode-text"
                      title="Delete"
                      aria-label="Delete document"
                      disabled={deletingDocId === doc.id || duplicatingDocId === doc.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openDeleteConfirm(doc);
                      }}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={doc.id}>
                <div
                  className={
                    'group flex items-center gap-2 px-2 py-1 rounded transition-colors ' +
                    (isCurrent ? 'bg-vscode-active' : 'hover:bg-vscode-active')
                  }
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  <button
                    type="button"
                    aria-label={fileCollapsed ? 'Expand file' : 'Collapse file'}
                    onClick={() => setFileCollapsed((v) => !v)}
                    className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-70 hover:opacity-100"
                  >
                    <ChevronRightIcon className={`w-4 h-4 transition-transform ${fileCollapsed ? '' : 'rotate-90'}`} />
                  </button>
                  <DocumentTextIcon className="w-4 h-4 opacity-60 flex-shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className={'text-sm truncate ' + (isCurrent ? 'text-white font-medium' : 'text-vscode-text')}>
                      {label}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-vscode-hover text-vscode-text-secondary hover:text-vscode-text"
                      title="Duplicate"
                      aria-label="Duplicate document"
                      disabled={duplicatingDocId === doc.id || deletingDocId === doc.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void duplicateDoc(doc.id);
                      }}
                    >
                      <Square2StackIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-vscode-hover text-vscode-text-secondary hover:text-vscode-text"
                      title="Delete"
                      aria-label="Delete document"
                      disabled={deletingDocId === doc.id || duplicatingDocId === doc.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openDeleteConfirm(doc);
                      }}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {!fileCollapsed && (
                  <div>
                    {tree.length > 0 ? (
                      <nav className="space-y-1">{renderNodes(tree, null, 0.75)}</nav>
                    ) : (
                      <div className="px-2 py-2 text-sm text-vscode-text-secondary">No outline available</div>
                    )}

                    {assets.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-vscode-active transition-colors">
                          <button
                            type="button"
                            aria-label={assetsCollapsed ? 'Expand assets' : 'Collapse assets'}
                            onClick={() => setAssetsCollapsed((v) => !v)}
                            className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-70 hover:opacity-100"
                          >
                            <ChevronRightIcon className={`w-4 h-4 transition-transform ${assetsCollapsed ? '' : 'rotate-90'}`} />
                          </button>
                          <FolderIcon className="w-4 h-4 opacity-70 flex-shrink-0" aria-hidden="true" />
                          <span className="text-sm text-vscode-text-secondary truncate">assets</span>
                        </div>

                        {!assetsCollapsed && (
                          <div className="mt-1 space-y-1">
                            {assets.map((a) => (
                              <div
                                key={a.key}
                                className="relative flex items-center gap-2 py-1 px-2 text-sm rounded hover:bg-vscode-active transition-colors text-vscode-text-secondary"
                                style={{ paddingLeft: '1.25rem' }}
                                onMouseEnter={() => {
                                  const el = document.querySelector(`[data-asset-row="${a.key}"]`);
                                  if (el && el instanceof HTMLElement) {
                                    setHoveredAsset({ key: a.key, relPath: a.relPath, anchorRect: el.getBoundingClientRect() });
                                  } else {
                                    setHoveredAsset({ key: a.key, relPath: a.relPath, anchorRect: new DOMRect(0, 0, 0, 0) });
                                  }
                                  void ensureAssetUrl(a.key);
                                }}
                                onMouseLeave={() => {
                                  setHoveredAsset((cur) => (cur?.key === a.key ? null : cur));
                                }}
                                data-asset-row={a.key}
                              >
                                <PhotoIcon className="w-4 h-4 opacity-60 flex-shrink-0" aria-hidden="true" />
                                <span className="truncate">{a.key}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-vscode-active transition-colors">
            <button
              type="button"
              aria-label={fileCollapsed ? 'Expand file' : 'Collapse file'}
              onClick={() => setFileCollapsed((v) => !v)}
              className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-70 hover:opacity-100"
            >
              <ChevronRightIcon className={`w-4 h-4 transition-transform ${fileCollapsed ? '' : 'rotate-90'}`} />
            </button>
            <DocumentTextIcon className="w-4 h-4 opacity-60 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0" title={`${fileLabel}\n${fileName}`}>
              <div className="text-sm text-vscode-text truncate">{fileLabel}</div>
            </div>
          </div>

          {!fileCollapsed && (
            <div>
              {tree.length > 0 ? (
                <nav className="space-y-1">{renderNodes(tree, null, 0.0)}</nav>
              ) : (
                <div className="px-2 py-2 text-sm text-vscode-text-secondary">No outline available</div>
              )}

              {assets.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-vscode-active transition-colors">
                    <button
                      type="button"
                      aria-label={assetsCollapsed ? 'Expand assets' : 'Collapse assets'}
                      onClick={() => setAssetsCollapsed((v) => !v)}
                      className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-70 hover:opacity-100"
                    >
                      <ChevronRightIcon className={`w-4 h-4 transition-transform ${assetsCollapsed ? '' : 'rotate-90'}`} />
                    </button>
                    <FolderIcon className="w-4 h-4 opacity-70 flex-shrink-0" aria-hidden="true" />
                    <span className="text-sm text-vscode-text-secondary truncate">assets</span>
                  </div>

                  {!assetsCollapsed && (
                    <div className="mt-1 space-y-1">
                      {assets.map((a) => (
                        <div
                          key={a.key}
                          className="relative flex items-center gap-2 py-1 px-2 text-sm rounded hover:bg-vscode-active transition-colors text-vscode-text-secondary"
                          style={{ paddingLeft: '1.25rem' }}
                          onMouseEnter={() => {
                            const el = document.querySelector(`[data-asset-row="${a.key}"]`);
                            if (el && el instanceof HTMLElement) {
                              setHoveredAsset({ key: a.key, relPath: a.relPath, anchorRect: el.getBoundingClientRect() });
                            } else {
                              setHoveredAsset({ key: a.key, relPath: a.relPath, anchorRect: new DOMRect(0, 0, 0, 0) });
                            }
                            void ensureAssetUrl(a.key);
                          }}
                          onMouseLeave={() => {
                            setHoveredAsset((cur) => (cur?.key === a.key ? null : cur));
                          }}
                          data-asset-row={a.key}
                        >
                          <PhotoIcon className="w-4 h-4 opacity-60 flex-shrink-0" aria-hidden="true" />
                          <span className="truncate">{a.key}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Render hover preview outside the sidebar scroll container so it isn't clipped */}
      {typeof document !== 'undefined' && typeof window !== 'undefined' ? renderAssetPreview() : null}
      {typeof document !== 'undefined' && typeof window !== 'undefined' ? renderDeleteConfirmModal() : null}
    </div>
  );
}

