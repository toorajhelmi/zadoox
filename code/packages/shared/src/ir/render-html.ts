import { renderMarkdownToHtml } from '../editor/markdown';
import type { DocumentNode } from './types';
import { irToXmd } from './to-xmd';

/**
 * Render HTML from IR.
 *
 * Phase 11 bridge:
 * - Convert IR -> XMD (best-effort)
 * - Reuse the existing markdown-to-HTML renderer
 */
export function renderIrToHtml(ir: DocumentNode): string {
  const xmd = irToXmd(ir);
  return xmd.trim().length === 0 ? '' : renderMarkdownToHtml(xmd);
}


