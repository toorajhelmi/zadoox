import type { BlockGraph, BlockGraphBlock, BlockType } from '@zadoox/shared';
import type { DocumentNode, IrNode } from '@zadoox/shared';

function clampText(s: string, max = 240): string {
  const t = String(s ?? '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function tableToText(node: any): string {
  const cap = (node?.caption || node?.label || '').toString().trim();
  const header: string[] = Array.isArray(node?.header) ? node.header.map((x: any) => String(x ?? '').trim()) : [];
  const rows: string[][] = Array.isArray(node?.rows)
    ? node.rows.map((r: any) => (Array.isArray(r) ? r.map((c: any) => String(c ?? '').trim()) : []))
    : [];
  const lines: string[] = [];
  if (cap) lines.push(`Table: ${cap}`);
  if (header.length) lines.push(header.join(' | '));
  for (const r of rows.slice(0, 6)) {
    const line = r.filter(Boolean).join(' | ');
    if (line) lines.push(line);
  }
  if (rows.length > 6) lines.push(`(+${rows.length - 6} more rows)`);
  return lines.join('\n') || `table ${header.length}x${rows.length}`;
}

function figureToText(node: any, ctx?: { gridCaption?: string }): string {
  const cap = (node?.caption || '').toString().trim();
  const label = (node?.label || '').toString().trim();
  const src = (node?.src || '').toString().trim();
  const base = cap || label || src;
  const gridCap = (ctx?.gridCaption || '').toString().trim();
  // If a grid image has a tiny caption (e.g. "A"), include grid caption as context.
  if (gridCap && base && base.length < 12) return `${gridCap}: ${base}`;
  if (gridCap && !base) return gridCap;
  return base;
}

function blockFromIrNode(node: IrNode, ctx?: { gridCaption?: string }): BlockGraphBlock | null {
  const src = node.source
    ? { startOffset: node.source.startOffset, endOffset: node.source.endOffset, blockIndex: node.source.blockIndex }
    : undefined;

  const mk = (type: BlockType, text: string): BlockGraphBlock => ({ id: node.id, type, text: clampText(text), source: src });

  switch (node.type) {
    case 'document_title':
      return mk('doc_title', node.text);
    case 'document_author':
      return mk('doc_author', node.text);
    case 'document_date':
      return mk('doc_date', node.text);
    case 'section':
      return mk('heading', node.title);
    case 'paragraph':
      return mk('paragraph', node.text);
    case 'list':
      return mk('list', node.items.join('\n'));
    case 'code_block':
      return mk('code', node.code);
    case 'math_block':
      return mk('math', node.latex);
    case 'figure':
      return mk('figure', figureToText(node as any, ctx));
    case 'table':
      return mk('table', tableToText(node as any));
    case 'grid': {
      const cap = node.caption || node.label || 'grid';
      return mk('grid', cap);
    }
    case 'raw_latex_block':
      return mk('raw', node.latex);
    case 'raw_xmd_block':
      return mk('raw', node.xmd);
    case 'document':
      return null;
    default:
      return null;
  }
}

function walk(node: IrNode, out: BlockGraphBlock[], ctx?: { gridCaption?: string }) {
  const b = blockFromIrNode(node, ctx);
  if (b) out.push(b);

  // Recurse into containers
  if (node.type === 'document' || node.type === 'section') {
    for (const ch of node.children) walk(ch, out, ctx);
  } else if (node.type === 'grid') {
    const gridCaption = (node.caption || node.label || '').toString().trim();
    for (const row of node.rows) {
      for (const cell of row) {
        for (const ch of cell.children) walk(ch, out, { gridCaption: gridCaption || ctx?.gridCaption });
      }
    }
  }
}

export function extractBlockGraphFromIr(ir: DocumentNode): BlockGraph {
  const blocks: BlockGraphBlock[] = [];
  walk(ir, blocks);
  return {
    version: 1,
    blocks,
    updatedAt: new Date().toISOString(),
  };
}


