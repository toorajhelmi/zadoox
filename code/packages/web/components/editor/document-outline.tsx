'use client';

import { useEffect, useMemo, useState } from 'react';
import { extractOutlineItemsFromIr, parseXmdToIr, type DocumentNode } from '@zadoox/shared';
import { ChevronRightIcon, DocumentTextIcon, PhotoIcon, FolderIcon } from '@heroicons/react/24/outline';
import type { OutlineItem } from '@zadoox/shared';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

interface DocumentOutlineProps {
  content: string;
  ir?: DocumentNode | null;
}

type HeadingItem = Extract<OutlineItem, { kind: 'heading' }>;
type FigureItem = Extract<OutlineItem, { kind: 'figure' }>;
type OutlineNode =
  | { kind: 'heading_node'; item: HeadingItem; children: OutlineNode[] }
  | { kind: 'figure_node'; item: FigureItem };

type AssetFile = { key: string; relPath: string };

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

    // Figure: attach under current heading if any, otherwise at root.
    const figNode: OutlineNode = { kind: 'figure_node', item };
    const parent = stack.length > 0 ? stack[stack.length - 1].node : null;
    if (parent) parent.children.push(figNode);
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
  }
  return ids;
}

export function DocumentOutline({ content, ir }: DocumentOutlineProps) {
  const derivedIr = useMemo(() => ir ?? parseXmdToIr({ docId: 'outline-doc', xmd: content }), [content, ir]);

  const items = useMemo(() => {
    // Phase 11: outline is IR-driven.
    return extractOutlineItemsFromIr(derivedIr);
  }, [derivedIr]);

  // We render a file/folder tree UI in the outline pane. The "file" represents the current document.
  // The document title (if present) becomes the file label; outline contents are headings/figures under that file.
  const docTitleItem = useMemo(() => items.find((i) => i.kind === 'heading' && i.id === 'doc-title') as HeadingItem | undefined, [items]);
  const fileLabel = useMemo(() => (docTitleItem?.text?.trim() ? docTitleItem.text.trim() : 'Untitled Document'), [docTitleItem]);
  const fileName = useMemo(() => toFileNameFromTitle(fileLabel), [fileLabel]);
  const outlineItems = useMemo(() => items.filter((i) => !(i.kind === 'heading' && i.id === 'doc-title')), [items]);

  const tree = useMemo(() => buildOutlineTree(outlineItems), [outlineItems]);
  const storageKey = useMemo(() => `zadoox:outline:collapsed:${derivedIr?.docId ?? 'unknown'}`, [derivedIr?.docId]);
  const collapsibleIds = useMemo(() => collectCollapsibleHeadingIds(tree), [tree]);
  const assets = useMemo(() => collectAssetFilesFromIr(derivedIr), [derivedIr]);

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [fileCollapsed, setFileCollapsed] = useState(false);
  const [assetsCollapsed, setAssetsCollapsed] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [hoveredAssetKey, setHoveredAssetKey] = useState<string | null>(null);
  const [assetUrlByKey, setAssetUrlByKey] = useState<Record<string, string>>({});

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
    const token = accessToken;
    if (!token) return;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    try {
      const res = await fetch(`${API_BASE}/assets/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAssetUrlByKey((prev) => ({ ...prev, [key]: url }));
    } catch {
      // ignore
    }
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

  const collapseAll = () => setCollapsedIds(new Set(collapsibleIds));
  const expandAll = () => setCollapsedIds(new Set());

  const renderNodes = (nodes: OutlineNode[], parentHeadingLevel: number | null = null) => {
    return nodes.map((node, index) => {
      if (node.kind === 'figure_node') {
        const pad = parentHeadingLevel == null ? 0.5 : parentHeadingLevel * 0.75 + 0.5;
        const item = node.item;
        return (
          <a
            key={`figure-${item.id}-${index}`}
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

      const item = node.item;
      const hasChildren = node.children.length > 0;
      const isCollapsed = collapsedIds.has(item.id);
      const pad = (item.level - 1) * 0.75 + 0.5;

      return (
        <div key={`heading-${item.id}-${index}`}>
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
            <div className="space-y-1">{renderNodes(node.children, item.level)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="p-4">
      {/* Root folder + file wrapper (VSCode-like). */}
      <div className="mb-2">
        <div className="flex items-center gap-2 px-2 py-1 text-sm text-vscode-text-secondary">
          <FolderIcon className="w-4 h-4 opacity-70 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">Documents</span>
        </div>

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
          <div className="min-w-0">
            <div className="text-sm text-vscode-text truncate">{fileLabel}</div>
            <div className="text-xs text-vscode-text-secondary truncate">{fileName}</div>
          </div>
        </div>
      </div>

      {collapsibleIds.length > 0 && (
        <div className="flex items-center justify-end gap-2 mb-2">
          <button
            type="button"
            onClick={collapseAll}
            className="px-2 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHoverBg text-vscode-buttonText rounded border border-vscode-border transition-colors"
          >
            Collapse all
          </button>
          <button
            type="button"
            onClick={expandAll}
            className="px-2 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHoverBg text-vscode-buttonText rounded border border-vscode-border transition-colors"
          >
            Expand all
          </button>
        </div>
      )}

      {!fileCollapsed && (
        <>
          {tree.length > 0 ? (
            <nav className="space-y-1">{renderNodes(tree)}</nav>
          ) : (
            <div className="px-2 py-2 text-sm text-vscode-text-secondary">No outline available</div>
          )}

          {/* Assets folder (only when the doc references zadoox-asset:// files) */}
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
                      style={{ paddingLeft: '2.25rem' }}
                      title={a.relPath}
                      onMouseEnter={() => {
                        setHoveredAssetKey(a.key);
                        void ensureAssetUrl(a.key);
                      }}
                      onMouseLeave={() => {
                        setHoveredAssetKey((cur) => (cur === a.key ? null : cur));
                      }}
                    >
                      <PhotoIcon className="w-4 h-4 opacity-60 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{a.key}</span>

                      {hoveredAssetKey === a.key && assetUrlByKey[a.key] && (
                        <div
                          className="absolute z-50 left-full top-1/2 -translate-y-1/2 ml-2 bg-[#252526] border border-[#3e3e42] rounded p-2 shadow-lg"
                          style={{ width: 180 }}
                          role="tooltip"
                        >
                          <div className="bg-white rounded" style={{ width: '100%', height: 140 }}>
                            <Image
                              src={assetUrlByKey[a.key]}
                              alt={a.key}
                              width={176}
                              height={140}
                              className="block w-full h-full"
                              style={{ objectFit: 'contain' }}
                              unoptimized
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

