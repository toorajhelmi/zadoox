'use client';

import { useEffect, useMemo, useState } from 'react';
import { extractOutlineItemsFromIr, parseXmdToIr, type DocumentNode } from '@zadoox/shared';
import { ChevronRightIcon, DocumentTextIcon, PhotoIcon } from '@heroicons/react/24/outline';
import type { OutlineItem } from '@zadoox/shared';

interface DocumentOutlineProps {
  content: string;
  ir?: DocumentNode | null;
}

type HeadingItem = Extract<OutlineItem, { kind: 'heading' }>;
type FigureItem = Extract<OutlineItem, { kind: 'figure' }>;
type OutlineNode =
  | { kind: 'heading_node'; item: HeadingItem; children: OutlineNode[] }
  | { kind: 'figure_node'; item: FigureItem };

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
  const items = useMemo(() => {
    // Phase 11: outline is IR-driven.
    const derived = ir ?? parseXmdToIr({ docId: 'outline-doc', xmd: content });
    return extractOutlineItemsFromIr(derived);
  }, [content, ir]);

  const tree = useMemo(() => buildOutlineTree(items), [items]);
  const storageKey = useMemo(() => `zadoox:outline:collapsed:${ir?.docId ?? 'unknown'}`, [ir?.docId]);
  const collapsibleIds = useMemo(() => collectCollapsibleHeadingIds(tree), [tree]);

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

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

  if (items.length === 0) {
    return (
      <div className="p-4 text-sm text-vscode-text-secondary">
        No outline available
      </div>
    );
  }

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

      <nav className="space-y-1">{renderNodes(tree)}</nav>
    </div>
  );
}

