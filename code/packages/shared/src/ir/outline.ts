import type { DocumentNode, IrNode } from './types';
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
  // #region agent log
  const typeCounts: Record<string, number> = {};
  let itemsHeadingCount = 0;
  let itemsFigureCount = 0;
  // #endregion

  for (const n of walk(ir)) {
    // #region agent log
    typeCounts[n.type] = (typeCounts[n.type] ?? 0) + 1;
    // #endregion
    // Document title: show as a top-level heading.
    // NOTE: We use a stable DOM id so the outline can scroll to it.
    if (n.type === 'document_title') {
      const id = 'doc-title';
      items.push({ kind: 'heading', level: 1, text: n.text, id });
      // #region agent log
      itemsHeadingCount += 1;
      // #endregion
      continue;
    }

    if (n.type === 'section') {
      const id = slugifyId(n.title);
      items.push({ kind: 'heading', level: n.level, text: n.title, id });
      // #region agent log
      itemsHeadingCount += 1;
      // #endregion
      continue;
    }

    if (n.type === 'figure') {
      figureCount += 1;
      const id = n.label ? `figure-${sanitizeDomId(n.label)}` : `figure-${sanitizeDomId(n.id)}`;
      const caption = (n.caption || '').trim();
      const captionOrNull = caption.length > 0 ? caption : null;
      const text = captionOrNull ? `Figure — ${captionOrNull}` : `Figure ${figureCount}`;
      items.push({ kind: 'figure', id, text, figureNumber: figureCount, caption: captionOrNull });
      // #region agent log
      itemsFigureCount += 1;
      // #endregion
    }
  }

  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'outline1',hypothesisId:'OL2',location:'ir/outline.ts:extractOutlineItemsFromIr',message:'Outline extraction summary',data:{typeCounts,itemsLen:items.length,itemsHeadingCount,itemsFigureCount},timestamp:Date.now()})}).catch(()=>{});
  } catch {}
  // #endregion

  return items;
}


