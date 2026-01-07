import { renderMarkdownToHtml } from '../editor/markdown';
import type { DocumentNode, GridNode, IrNode } from './types';

/**
 * Render HTML from IR.
 *
 * Phase 12+:
 * - Render directly from IR nodes so document-level constructs (e.g. `document_title`)
 *   don't get lost when bridging through XMD.
 */
export function renderIrToHtml(ir: DocumentNode): string {
  const html = renderNodes(ir.children);
  return html.trim().length === 0 ? '' : html;
}

function renderNodes(nodes: IrNode[]): string {
  return nodes.map(renderNode).filter(Boolean).join('');
}

function sanitizeDomId(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function renderNode(node: IrNode): string {
  switch (node.type) {
    case 'document_title': {
      const text = escapeHtml(node.text ?? '');
      // Stable id so the Outline can scroll to it.
      return `<h1 id="doc-title" class="doc-title">${text}</h1>`;
    }
    case 'document_author': {
      const text = escapeHtml(node.text ?? '');
      return `<div class="doc-author">${text}</div>`;
    }
    case 'document_date': {
      const text = escapeHtml(node.text ?? '');
      return `<div class="doc-date">${text}</div>`;
    }
    case 'section': {
      // Distinguish title from sections: section level 1 => h2, level 2 => h3, level 3 => h4...
      const tagLevel = Math.max(2, Math.min(6, (node.level ?? 1) + 1));
      const tag = `h${tagLevel}`;
      const heading = `<${tag}>${escapeHtml(node.title ?? '')}</${tag}>`;
      const body = node.children?.length ? renderNodes(node.children) : '';
      return `${heading}${body}`;
    }
    case 'paragraph': {
      const html = renderMarkdownToHtml(node.text ?? '');
      return html;
    }
    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul';
      const items = (node.items ?? [])
        .map((it) => stripOuterPTags(renderMarkdownToHtml(String(it ?? ''))))
        .map((inner) => `<li>${inner}</li>`)
        .join('');
      return `<${tag}>${items}</${tag}>`;
    }
    case 'code_block': {
      const code = escapeHtml(node.code ?? '');
      return `<pre><code>${code}</code></pre>`;
    }
    case 'math_block': {
      // Render as a block; formatting/KaTeX is a later concern.
      const latex = escapeHtml(node.latex ?? '');
      return `<div class="math-block">$$<br />${latex}<br />$$</div>`;
    }
    case 'figure': {
      const figId = node.label ? `figure-${sanitizeDomId(node.label)}` : `figure-${sanitizeDomId(node.id)}`;
      // Important: preserve the existing figure attribute-block behavior (align/width/placement)
      // by reusing the original XMD source line when available.
      const raw = node.source?.raw;
      if (raw && raw.trim().startsWith('![') && raw.includes('](')) {
        // Wrap in an anchor span so the outline can reliably scroll even if the markdown renderer
        // doesn't include an id attribute.
        return `<span id="${figId}">${renderMarkdownToHtml(raw.trimEnd())}</span>`;
      }

      const src = escapeHtml(node.src ?? '');
      const cap = escapeHtml(node.caption ?? '');
      const caption =
        cap.trim().length > 0
          ? `<em class="figure-caption" style="display:block;width:100%;text-align:center">${cap}</em>`
          : '';
      // Keep caption centered relative to the image width by using an inner inline-block wrapper.
      return `<span id="${figId}" class="figure"><span class="figure-inner" style="display:inline-block;max-width:100%;margin-left:0;margin-right:auto"><img src="${src}" alt="${cap}" style="display:block;max-width:100%" />${caption}</span></span>`;
    }
    case 'table': {
      const cols = Math.max(0, (node.header ?? []).length);
      const align = (node.colAlign && node.colAlign.length === cols ? node.colAlign : Array.from({ length: cols }).map(() => 'left')) as Array<
        'left' | 'center' | 'right'
      >;
      const vRules =
        node.vRules && node.vRules.length === cols + 1 ? node.vRules : Array.from({ length: cols + 1 }).map(() => 'none' as const);
      const totalRows = 1 + (node.rows?.length ?? 0);
      const hRules =
        node.hRules && node.hRules.length === totalRows + 1 ? node.hRules : Array.from({ length: totalRows + 1 }).map(() => 'none' as const);

      const borderColor = (node.style?.borderColor ?? '').trim() || 'rgba(255,255,255,0.16)';
      const borderWidth = Number.isFinite(node.style?.borderWidthPx) && (node.style?.borderWidthPx ?? 0) > 0 ? Math.round(node.style!.borderWidthPx!) : 1;
      const singleStyle = (node.style?.borderStyle ?? 'solid') as 'solid' | 'dotted' | 'dashed';

      const cssAlign = (a: 'left' | 'center' | 'right') => (a === 'center' ? 'center' : a === 'right' ? 'right' : 'left');
      const cssBorder = (rule: 'none' | 'single' | 'double') => {
        if (rule === 'none') return 'none';
        const style = rule === 'double' ? 'double' : singleStyle;
        // Double borders look better with a slightly thicker width; keep deterministic.
        const w = rule === 'double' ? Math.max(3, borderWidth) : borderWidth;
        return `${w}px ${style} ${borderColor}`;
      };

      const cellStyle = (params: { rowIndex: number; colIndex: number; isHeader: boolean }): string => {
        const { rowIndex, colIndex } = params;
        const styles: string[] = [];
        styles.push(`text-align:${cssAlign(align[colIndex] ?? 'left')}`);
        // Vertical boundaries:
        // - boundary 0 => left border on col 0 cells
        // - boundary i => left border on col i cells (i in 1..cols-1)
        // - boundary cols => right border on last col cells
        if (colIndex === 0) styles.push(`border-left:${cssBorder(vRules[0] ?? 'none')}`);
        if (colIndex > 0) styles.push(`border-left:${cssBorder(vRules[colIndex] ?? 'none')}`);
        if (colIndex === cols - 1) styles.push(`border-right:${cssBorder(vRules[cols] ?? 'none')}`);
        // Horizontal boundaries:
        // - hRules[0] => top border on header row cells
        // - hRules[1] => top border on first data row cells
        // - hRules[k] => top border on data row (k-1) cells (k in 2..totalRows-1)
        // - hRules[totalRows] => bottom border on last row cells
        if (rowIndex === 0) styles.push(`border-top:${cssBorder(hRules[0] ?? 'none')}`);
        if (rowIndex > 0) styles.push(`border-top:${cssBorder(hRules[rowIndex] ?? 'none')}`);
        if (rowIndex === totalRows - 1) styles.push(`border-bottom:${cssBorder(hRules[totalRows] ?? 'none')}`);
        // Keep cells readable in the default dark preview theme.
        styles.push('padding:6px 10px');
        return styles.join(';');
      };

      const headerCells = (node.header ?? [])
        .map((h, c) => `<th style="${cellStyle({ rowIndex: 0, colIndex: c, isHeader: true })}">${escapeHtml(String(h))}</th>`)
        .join('');
      const header = `<tr>${headerCells}</tr>`;

      const bodyRows = (node.rows ?? [])
        .map((r, rIdx) => {
          const rowIndex = 1 + rIdx;
          const tds = Array.from({ length: cols }).map((_, c) => {
            const cell = (r ?? [])[c] ?? '';
            return `<td style="${cellStyle({ rowIndex, colIndex: c, isHeader: false })}">${escapeHtml(String(cell))}</td>`;
          });
          return `<tr>${tds.join('')}</tr>`;
        })
        .join('');

      const caption = String(node.caption ?? '').trim();
      const capHtml = caption.length > 0 ? `<caption style="caption-side:top;text-align:left;margin-bottom:6px;color:#9aa0a6;font-style:italic">${escapeHtml(caption)}</caption>` : '';
      return `<table style="border-collapse:collapse;width:100%">${capHtml}<thead>${header}</thead><tbody>${bodyRows}</tbody></table>`;
    }
    case 'grid': {
      const g = node as GridNode;
      const rows = g.rows ?? [];
      const cols =
        g.cols && Number.isFinite(g.cols) && g.cols > 0
          ? g.cols
          : rows.reduce((m, r) => Math.max(m, (r ?? []).length), 0) || 1;

      const borderColor = (g.style?.borderColor ?? '').trim() || 'rgba(255,255,255,0.16)';
      const borderWidthRaw = g.style?.borderWidthPx;
      const borderNone = Number.isFinite(borderWidthRaw) && (borderWidthRaw as number) === 0;
      const borderWidth = Number.isFinite(borderWidthRaw) && (borderWidthRaw ?? 0) > 0 ? Math.round(borderWidthRaw!) : 1;
      const borderStyle = (g.style?.borderStyle ?? 'solid') as 'solid' | 'dotted' | 'dashed';
      const cellBorder = borderNone ? 'none' : `${borderWidth}px ${borderStyle} ${borderColor}`;

      const body = rows
        .map((row) => {
          const cells = Array.from({ length: cols }).map((_, i) => {
            const cell = row?.[i];
            const inner = renderNodes(cell?.children ?? []);
            return `<td style="border:${cellBorder};padding:6px 10px;vertical-align:top">${inner}</td>`;
          });
          return `<tr>${cells.join('')}</tr>`;
        })
        .join('');

      const caption = String(g.caption ?? '').trim();
      const capHtml = caption.length > 0 ? `<div class="xmd-grid-caption">${escapeHtml(caption)}</div>` : '';
      const align = g.align ?? 'left';
      const alignCss = align === 'center' ? 'text-align:center' : align === 'right' ? 'text-align:right' : 'text-align:left';
      const margin = g.margin ?? 'medium';
      const pad = margin === 'small' ? 6 : margin === 'large' ? 14 : 10;
      const placement = g.placement ?? 'block';
      const canFloat = placement === 'inline' && (align === 'left' || align === 'right');
      const floatCss = canFloat
        ? `float:${align === 'right' ? 'right' : 'left'};max-width:55%;margin:${align === 'right' ? '0.25em 0 0.75em 1em' : '0.25em 1em 0.75em 0'};`
        : '';
      const gridId = g.label ? ` id="grid-${sanitizeDomId(g.label)}"` : '';
      // NOTE: This enables wrap-around behavior in preview. The editor surface (CodeMirror)
      // cannot do true wrap-around for replacement widgets, so we only implement it here (IR->HTML).
      return `<div class="xmd-grid"${gridId} style="${alignCss};padding:${pad}px;${floatCss}">${capHtml}<table style="border-collapse:collapse;width:100%"><tbody>${body}</tbody></table></div>`;
    }
    case 'raw_xmd_block':
      return renderMarkdownToHtml(node.xmd ?? '');
    case 'raw_latex_block': {
      const raw = escapeHtml(node.latex ?? '');
      return `<pre><code>${raw}</code></pre>`;
    }
    case 'document':
      return renderNodes(node.children ?? []);
    default: {
      const _exhaustive: never = node;
      return String(_exhaustive);
    }
  }
}

function stripOuterPTags(html: string): string {
  const s = (html ?? '').trim();
  // Our markdown renderer wraps in <p>...</p> for plain text. For list items we want inline HTML.
  if (s.startsWith('<p>') && s.endsWith('</p>')) {
    return s.slice(3, -4);
  }
  return s;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


