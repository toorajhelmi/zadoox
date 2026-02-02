import type { DocumentNode, GridNode, IrNode } from './types';
import type { OutlineItem } from '../editor/markdown';

function slugifyId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeDomId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// NOTE: We intentionally avoid a generic walk() here because grid nesting needs parentId context.

/**
 * Derive outline items (headings + labeled figures) from IR.
 *
 * NOTE: For now, heading IDs are slugified from the title to stay compatible with the existing
 * markdown preview that injects ids based on heading text.
 */
export function extractOutlineItemsFromIr(ir: DocumentNode): OutlineItem[] {
  const items: OutlineItem[] = [];
  let figureCount = 0;
  let gridCount = 0;

  const visit = (n: IrNode, parentGridOutlineId: string | null) => {
    // Document title: show as a top-level heading.
    // NOTE: We use a stable DOM id so the outline can scroll to it.
    if (n.type === 'document_title') {
      const id = 'doc-title';
      items.push({ kind: 'heading', level: 1, text: n.text, id });
      return;
    }

    if (n.type === 'section') {
      const label = String((n as unknown as { label?: string }).label ?? '').trim();
      const id = label ? `sec-${sanitizeDomId(label)}` : slugifyId(n.title);
      items.push({ kind: 'heading', level: n.level, text: n.title, id });
      for (const c of n.children ?? []) visit(c, parentGridOutlineId);
      return;
    }

    if (n.type === 'grid') {
      gridCount += 1;
      const caption = String(n.caption ?? '').trim();
      const captionOrNull = caption.length > 0 ? caption : null;
      const id = `grid-${sanitizeDomId(n.id ?? `grid-${gridCount}`)}`;
      const text = captionOrNull ? `Grid — ${captionOrNull}` : `Grid ${gridCount}`;
      items.push({ kind: 'grid', id, text, gridNumber: gridCount, caption: captionOrNull });

      // Traverse child nodes, tagging figures with parentId so the UI can nest them.
      const rows = (n as GridNode).rows ?? [];
      for (const row of rows) {
        for (const cell of row ?? []) {
          for (const c of cell?.children ?? []) visit(c, id);
        }
      }
      return;
    }

    if (n.type === 'figure') {
      figureCount += 1;
      const id = n.label ? `figure-${sanitizeDomId(n.label)}` : `figure-${sanitizeDomId(n.id)}`;
      const caption = (n.caption || '').trim();
      const captionOrNull = caption.length > 0 ? caption : null;
      // If this figure is inside a grid, keep the outline label compact (caption only).
      const text =
        parentGridOutlineId && captionOrNull
          ? captionOrNull
          : captionOrNull
            ? `Figure — ${captionOrNull}`
            : `Figure ${figureCount}`;
      items.push({
        kind: 'figure',
        id,
        text,
        figureNumber: figureCount,
        caption: captionOrNull,
        ...(parentGridOutlineId ? { parentId: parentGridOutlineId } : null),
      });
      return;
    }

    // Default recursion for containers
    if (n.type === 'document') {
      for (const c of n.children ?? []) visit(c, parentGridOutlineId);
    }
  };

  // Start traversal from doc root.
  visit(ir, null);

  return items;
}



