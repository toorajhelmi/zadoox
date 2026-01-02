import type { DocumentNode, IrNode } from '../ir/types';

/**
 * IR -> LaTeX string (best-effort, Phase 12).
 *
 * Notes:
 * - IR is currently block-level; inline formatting is preserved as markdown-like text inside
 *   paragraph/list items and converted here opportunistically.
 * - This renderer intentionally targets a supported subset of LaTeX.
 */
export function irToLatex(doc: DocumentNode): string {
  return renderNodes(doc.children).trimEnd();
}

function renderNodes(nodes: IrNode[]): string {
  const out: string[] = [];
  for (const n of nodes) {
    const s = renderNode(n);
    if (s.trim().length === 0) continue;
    out.push(s.trimEnd());
  }
  return out.join('\n\n');
}

function renderNode(node: IrNode): string {
  switch (node.type) {
    case 'document_title':
      return `\\title{${escapeLatexText(node.text)}}`;
    case 'section': {
      const cmd =
        node.level <= 1
          ? '\\section'
          : node.level === 2
            ? '\\subsection'
            : '\\subsubsection';
      const heading = `${cmd}{${escapeLatexText(node.title)}}`;
      const body = node.children.length ? renderNodes(node.children) : '';
      return body ? `${heading}\n\n${body}` : heading;
    }
    case 'paragraph':
      return mdInlineToLatex(node.text);
    case 'list': {
      const env = node.ordered ? 'enumerate' : 'itemize';
      const items = node.items
        .map((it) => `\\item ${mdInlineToLatex(it)}`)
        .join('\n');
      return `\\begin{${env}}\n${items}\n\\end{${env}}`;
    }
    case 'code_block': {
      // Keep code verbatim; ignore language for now.
      return `\\begin{verbatim}\n${node.code}\n\\end{verbatim}`;
    }
    case 'math_block': {
      // Keep raw LaTeX math.
      return `\\begin{equation}\n${node.latex}\n\\end{equation}`;
    }
    case 'figure': {
      // Minimal, semantic: embed image; caption is not yet modeled as a full figure env.
      // (Phase 12 is editing-mode switching; export template concerns later.)
      const img = `\\includegraphics{${escapeLatexText(node.src)}}`;
      const cap = node.caption ? `\n% caption: ${escapeLatexText(node.caption)}` : '';
      const lbl = node.label ? `\n% label: ${escapeLatexText(node.label)}` : '';
      return `${img}${cap}${lbl}`.trimEnd();
    }
    case 'table': {
      // Minimal: degrade to a markdown-ish table inside verbatim.
      const header = `| ${node.header.join(' | ')} |`;
      const sep = `| ${node.header.map(() => '---').join(' | ')} |`;
      const rows = node.rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
      const body = rows ? `${header}\n${sep}\n${rows}` : `${header}\n${sep}`;
      return `\\begin{verbatim}\n${body}\n\\end{verbatim}`;
    }
    case 'raw_latex_block':
      return node.latex;
    case 'raw_xmd_block':
      // Preserve unknown XMD; keep as comments so LaTeX remains parseable-ish.
      return node.xmd
        .split('\n')
        .map((l) => `% ${l}`)
        .join('\n');
    case 'document':
      return renderNodes(node.children);
    default: {
      const _exhaustive: never = node;
      return String(_exhaustive);
    }
  }
}

/**
 * Best-effort inline conversion from markdown-ish text to LaTeX subset.
 * This is intentionally limited; unsupported constructs should be handled at switch-time validation.
 */
function mdInlineToLatex(text: string): string {
  let s = text ?? '';

  // Links: [text](url) -> \href{url}{text}
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, url) => {
    return `\\href{${escapeLatexText(String(url))}}{${escapeLatexText(String(t))}}`;
  });

  // Bold: **text** -> \textbf{text}
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, t) => `\\textbf{${escapeLatexText(String(t))}}`);

  // Emphasis: *text* -> \emph{text}
  s = s.replace(/\*([^*]+)\*/g, (_m, t) => `\\emph{${escapeLatexText(String(t))}}`);

  // Inline code: `code` -> \texttt{code}
  s = s.replace(/`([^`]+)`/g, (_m, t) => `\\texttt{${escapeLatexText(String(t))}}`);

  // Preserve inline math $...$ as-is.
  // NOTE: We intentionally avoid globally escaping here, because it would also escape the braces
  // used by LaTeX commands we just generated (e.g. `\textbf{...}`), corrupting the output.
  // For Phase 12 switching, we accept that some raw characters may remain unescaped in plain text.
  return s;
}

function escapeLatexText(text: string): string {
  const s = text ?? '';
  // NOTE: We do not attempt to be perfectly context-aware; this is a pragmatic subset.
  return s
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/_/g, '\\_')
    .replace(/\^/g, '\\^{}');
}


