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

function* walk(node: IrNode): Generator<IrNode, void, void> {
  yield node;
  if (node.type === 'document' || node.type === 'section') {
    for (const c of node.children) yield* walk(c);
  }
  if (node.type === 'grid') {
    const rows = (node as GridNode).rows ?? [];
    for (const row of rows) {
      for (const cell of row ?? []) {
        for (const c of cell?.children ?? []) yield* walk(c);
      }
    }
  }
}

/**
 * Derive outline items (headings + labeled figures) from IR.
 *
 * NOTE: For now, heading IDs are slugified from the title to stay compatible with the existing
 * markdown preview that injects ids based on heading text.
 */
export function extractOutlineItemsFromIr(ir: DocumentNode): OutlineItem[] {
  const items: OutlineItem[] = [];
  let figureCount = 0;

  for (const n of walk(ir)) {
    // Document title: show as a top-level heading.
    // NOTE: We use a stable DOM id so the outline can scroll to it.
    if (n.type === 'document_title') {
      const id = 'doc-title';
      items.push({ kind: 'heading', level: 1, text: n.text, id });
      continue;
    }

    if (n.type === 'section') {
      const id = slugifyId(n.title);
      items.push({ kind: 'heading', level: n.level, text: n.title, id });
      continue;
    }

    if (n.type === 'figure') {
      figureCount += 1;
      const id = n.label ? `figure-${sanitizeDomId(n.label)}` : `figure-${sanitizeDomId(n.id)}`;
      const caption = (n.caption || '').trim();
      const captionOrNull = caption.length > 0 ? caption : null;
      const text = captionOrNull ? `Figure — ${captionOrNull}` : `Figure ${figureCount}`;
      items.push({ kind: 'figure', id, text, figureNumber: figureCount, caption: captionOrNull });
      continue;
    }

    // Treat grids as figures in the outline so they appear under sections (and are count-stable).
    if (n.type === 'grid') {
      figureCount += 1;
      const caption = String(n.caption ?? '').trim();
      const captionOrNull = caption.length > 0 ? caption : null;
      const id = `figure-${sanitizeDomId(n.id ?? `grid-${figureCount}`)}`;
      const text = captionOrNull ? `Figure — ${captionOrNull}` : `Figure ${figureCount}`;
      items.push({ kind: 'figure', id, text, figureNumber: figureCount, caption: captionOrNull });
    }
  }

  return items;
}



