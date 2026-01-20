import type { BlockGraph, BlockGraphBlock, BlockType } from '@zadoox/shared';
import type { DocumentNode, IrNode } from '@zadoox/shared';

function clampText(s: string, max = 240): string {
  const t = String(s ?? '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function blockFromIrNode(node: IrNode): BlockGraphBlock | null {
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
      return mk('figure', node.caption || node.label || node.src);
    case 'table':
      return mk('table', node.caption || node.label || `table ${node.header.length}x${node.rows.length}`);
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

function walk(node: IrNode, out: BlockGraphBlock[]) {
  const b = blockFromIrNode(node);
  if (b) out.push(b);

  // Recurse into containers
  if (node.type === 'document' || node.type === 'section') {
    for (const ch of node.children) walk(ch, out);
  } else if (node.type === 'grid') {
    for (const row of node.rows) {
      for (const cell of row) {
        for (const ch of cell.children) walk(ch, out);
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


