import { renderMarkdownToHtml } from '../editor/markdown';
import type { DocumentNode, IrNode } from './types';

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

function renderNode(node: IrNode): string {
  switch (node.type) {
    case 'document_title': {
      const text = escapeHtml(node.text ?? '');
      return `<h1 class="doc-title">${text}</h1>`;
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
      // Important: preserve the existing figure attribute-block behavior (align/width/placement)
      // by reusing the original XMD source line when available.
      const raw = node.source?.raw;
      if (raw && raw.trim().startsWith('![') && raw.includes('](')) {
        return renderMarkdownToHtml(raw.trimEnd());
      }

      const src = escapeHtml(node.src ?? '');
      const cap = escapeHtml(node.caption ?? '');
      const caption =
        cap.trim().length > 0
          ? `<em class="figure-caption" style="display:block;width:100%;text-align:center">${cap}</em>`
          : '';
      // Keep caption centered relative to the image width by using an inner inline-block wrapper.
      return `<span class="figure"><span class="figure-inner" style="display:inline-block;max-width:100%;margin-left:0;margin-right:auto"><img src="${src}" alt="${cap}" style="display:block;max-width:100%" />${caption}</span></span>`;
    }
    case 'table': {
      // Simple HTML table rendering.
      const header = `<tr>${(node.header ?? []).map((h) => `<th>${escapeHtml(String(h))}</th>`).join('')}</tr>`;
      const rows = (node.rows ?? [])
        .map((r) => `<tr>${(r ?? []).map((c) => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`)
        .join('');
      return `<table><thead>${header}</thead><tbody>${rows}</tbody></table>`;
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


