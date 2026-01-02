import type { DocumentNode, IrNode, TableNode } from './types';

/**
 * IR -> XMD string (best-effort).
 *
 * IMPORTANT:
 * - This is intended as a rendering bridge (IR -> XMD -> existing markdown renderer).
 * - It is NOT intended to regenerate the user's editable source-of-record.
 * - Lossless fidelity is not guaranteed (use RawXmdBlockNode to preserve exact text).
 */
export function irToXmd(doc: DocumentNode): string {
  return renderNodes(doc.children).trimEnd();
}

function renderNodes(nodes: IrNode[]): string {
  const parts: string[] = [];
  for (const n of nodes) {
    const s = renderNode(n);
    if (s.trim().length === 0) continue;
    parts.push(s.trimEnd());
  }
  return parts.join('\n\n');
}

function renderNode(node: IrNode): string {
  switch (node.type) {
    case 'document_title':
      return `@ ${node.text}`;
    case 'document_author':
      return (node.text ?? '').trim().length > 0 ? `@^ ${node.text}` : '@^';
    case 'document_date':
      return (node.text ?? '').trim().length > 0 ? `@= ${node.text}` : '@=';
    case 'section': {
      const heading = `${'#'.repeat(Math.max(1, Math.min(6, node.level)))} ${node.title}`;
      const body = node.children.length ? renderNodes(node.children) : '';
      return body ? `${heading}\n\n${body}` : heading;
    }
    case 'paragraph':
      return node.text;
    case 'list': {
      if (node.ordered) {
        return node.items.map((it, idx) => `${idx + 1}. ${it}`).join('\n');
      }
      return node.items.map((it) => `- ${it}`).join('\n');
    }
    case 'code_block': {
      const lang = node.language ? node.language.trim() : '';
      const fence = lang ? `\`\`\`${lang}` : '```';
      return `${fence}\n${node.code}\n\`\`\``;
    }
    case 'math_block':
      return `$$\n${node.latex}\n$$`;
    case 'figure': {
      // For parity during IR-compare: if we have the original XMD for this figure block,
      // prefer returning it verbatim. This preserves attribute blocks (width/align/placement/etc)
      // that our minimal IR does not model yet.
      const raw = node.source?.raw;
      if (raw && raw.trim().startsWith('![') && raw.includes('](')) {
        return raw.trimEnd();
      }

      const caption = node.caption ?? '';
      const label = node.label ? `{#${node.label}}` : '';
      // Prefer the existing inline figure syntax used elsewhere in the codebase.
      return `![${caption}](${node.src})${label}`;
    }
    case 'table': {
      const t = node as TableNode;
      const header = `| ${t.header.join(' | ')} |`;
      const sep = `| ${t.header.map(() => '---').join(' | ')} |`;
      const rows = t.rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
      const body = rows ? `${header}\n${sep}\n${rows}` : `${header}\n${sep}`;
      return body;
    }
    case 'raw_xmd_block':
      return node.xmd;
    case 'raw_latex_block':
      return node.latex;
    case 'document':
      return renderNodes(node.children);
    default: {
      const _exhaustive: never = node;
      return String(_exhaustive);
    }
  }
}


