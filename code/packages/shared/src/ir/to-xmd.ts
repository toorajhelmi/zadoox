import type { DocumentNode, GridNode, IrNode, TableNode } from './types';

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
    case 'abstract': {
      // Best-effort bridge: represent as an unnumbered "Abstract" heading.
      const heading = `## Abstract`;
      const body = node.children.length ? renderNodes(node.children) : '';
      return body ? `${heading}\n\n${body}` : heading;
    }
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
      // If this table came from a structured XMD block, prefer preserving the original source text.
      // This avoids unintended reformatting in preview/bridging renders.
      const raw = t.source?.raw;
      if (raw && raw.trim().startsWith(':::')) return raw.trimEnd();

      const schemaCols = (t.schema?.columns ?? []).map((c) => ({ id: c.id, name: c.name ?? '' }));
      const headerCells = schemaCols.length ? schemaCols.map((c) => c.name || c.id) : (t.header ?? []);
      const dataRows = schemaCols.length
        ? (t.data?.rows ?? []).map((r) => schemaCols.map((c) => String(r.cells?.[c.id] ?? '')))
        : (t.rows ?? []);

      const cols = Math.max(2, headerCells.length || 2);
      const align = (t.colAlign && t.colAlign.length === cols ? t.colAlign : Array.from({ length: cols }).map(() => 'left')) as Array<
        'left' | 'center' | 'right'
      >;
      const vRules =
        t.vRules && t.vRules.length === cols + 1 ? t.vRules : Array.from({ length: cols + 1 }).map(() => 'none' as const);

      const boundaryToken = (r: 'none' | 'single' | 'double') => (r === 'single' ? '|' : r === 'double' ? '||' : '');
      const alignToken = (a: 'left' | 'center' | 'right') => (a === 'left' ? 'L' : a === 'center' ? 'C' : 'R');
      const colSpec = (() => {
        let s = '';
        s += boundaryToken(vRules[0] ?? 'none');
        for (let i = 0; i < cols; i++) {
          s += alignToken(align[i] ?? 'left');
          s += boundaryToken(vRules[i + 1] ?? 'none');
        }
        return s.trim().length > 0 ? s : Array.from({ length: cols }).map(() => 'L').join('');
      })();

      const escapeAttr = (value: string) =>
        String(value ?? '')
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, ' ')
          .trim();

      const attrs: string[] = [];
      if ((t.caption ?? '').trim().length > 0) attrs.push(`caption="${escapeAttr(t.caption ?? '')}"`);
      if ((t.label ?? '').trim().length > 0) attrs.push(`label="${escapeAttr(t.label ?? '')}"`);
      if (t.style?.borderStyle) attrs.push(`borderStyle="${escapeAttr(t.style.borderStyle)}"`);
      if (t.style?.borderColor) attrs.push(`borderColor="${escapeAttr(t.style.borderColor)}"`);
      if (Number.isFinite(t.style?.borderWidthPx) && (t.style?.borderWidthPx ?? 0) > 0) attrs.push(`borderWidth="${Math.round(t.style!.borderWidthPx!)}"`);

      const ruleChar = (r: 'none' | 'single' | 'double') => (r === 'single' ? '-' : r === 'double' ? '=' : '.');
      const totalRows = 1 + (t.rows?.length ?? 0);
      const hRules =
        t.hRules && t.hRules.length === totalRows + 1 ? t.hRules : Array.from({ length: totalRows + 1 }).map(() => 'none' as const);

      const headerRow = `| ${headerCells.join(' | ')} |`;
      const sep = `| ${headerCells.map(() => '---').join(' | ')} |`;
      const rowLines = dataRows.map((r) => `| ${r.join(' | ')} |`);

      const lines: string[] = [];
      lines.push(`:::${attrs.length ? ` ${attrs.join(' ')}` : ''}`);
      lines.push(colSpec);
      // Optional header spanners (layout row 0). This is a minimal XMD extension.
      // We only emit non-empty synthetic cells with colspan>1.
      if (t.layout?.header && t.layout.header.length > 1) {
        const spRow = t.layout.header[0]!;
        let c = 0;
        for (const cell of spRow.cells ?? []) {
          const span = Math.max(1, Number(cell.colSpan ?? cell.columnIds?.length ?? 1) || 1);
          if (cell.kind === 'synthetic' && span > 1 && String(cell.text ?? '').trim().length > 0) {
            lines.push(`@span header c=${c} span=${span} text="${escapeAttr(cell.text)}"`);
          }
          c += span;
        }
      }
      if (hRules[0] && hRules[0] !== 'none') lines.push(ruleChar(hRules[0]));
      lines.push(headerRow);
      lines.push(sep);
      if (hRules[1] && hRules[1] !== 'none') lines.push(ruleChar(hRules[1]));
      for (let i = 0; i < rowLines.length; i++) {
        lines.push(rowLines[i]!);
        const boundaryIdx = 2 + i; // between data row i and i+1, and finally bottom at totalRows
        if (boundaryIdx < hRules.length - 1) {
          if (hRules[boundaryIdx] && hRules[boundaryIdx] !== 'none') lines.push(ruleChar(hRules[boundaryIdx]));
        }
      }
      if (hRules[totalRows] && hRules[totalRows] !== 'none') lines.push(ruleChar(hRules[totalRows]));
      lines.push(':::');
      return lines.join('\n');
    }
    case 'grid': {
      const g = node as GridNode;
      const cols =
        g.cols && Number.isFinite(g.cols) && g.cols > 0
          ? g.cols
          : (g.rows ?? []).reduce((m, r) => Math.max(m, (r ?? []).length), 0) || 1;
      const headerParts: string[] = [];
      headerParts.push(`cols=${cols}`);
      const cap = String(g.caption ?? '').trim();
      if (cap.length > 0) headerParts.push(`caption="${cap.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim()}"`);
      const label = String((g as { label?: string }).label ?? '').trim();
      if (label.length > 0) headerParts.push(`label="${label.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim()}"`);
      const borderStyle = String((g as { style?: { borderStyle?: string } }).style?.borderStyle ?? '').trim();
      if (borderStyle.length > 0) headerParts.push(`borderStyle="${borderStyle.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim()}"`);
      const borderColor = String((g as { style?: { borderColor?: string } }).style?.borderColor ?? '').trim();
      if (borderColor.length > 0) headerParts.push(`borderColor="${borderColor.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').trim()}"`);
      const bw = (g as { style?: { borderWidthPx?: number } }).style?.borderWidthPx;
      if (Number.isFinite(bw) && (bw as number) >= 0) headerParts.push(`borderWidth="${Math.round(bw as number)}"`);
      const align = String(g.align ?? '').trim();
      if (align === 'left' || align === 'center' || align === 'right' || align === 'full') headerParts.push(`align="${align}"`);
      const placement = String(g.placement ?? '').trim();
      if (placement === 'inline' || placement === 'block') headerParts.push(`placement="${placement}"`);
      const margin = String(g.margin ?? '').trim();
      if (margin === 'small' || margin === 'medium' || margin === 'large') headerParts.push(`margin="${margin}"`);
      const header = `::: ${headerParts.join(' ')}`;
      const parts: string[] = [header];
      const rows = g.rows ?? [];
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r] ?? [];
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          const cellXmd = renderNodes(cell?.children ?? []).trimEnd();
          if (cellXmd.length > 0) parts.push(cellXmd);
          // Preferred grid delimiters:
          // - `|||` for new cell
          // - `---` for new row
          if (c < row.length - 1) parts.push('|||');
        }
        if (r < rows.length - 1) parts.push('---');
      }
      parts.push(':::');
      return parts.join('\n');
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


