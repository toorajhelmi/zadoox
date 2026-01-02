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

/**
 * IR -> full, compilable LaTeX document.
 *
 * Goal: the user can copy/paste into Overleaf and it should compile.
 *
 * Notes:
 * - We include only a minimal preamble required by commands we generate:
 *   - graphicx for \\includegraphics
 *   - hyperref for \\href
 *   - amsmath for equation environments
 * - This boilerplate is treated as "system generated"; the LaTeX->IR parser will ignore it.
 */
export function irToLatexDocument(doc: DocumentNode): string {
  const titleNode = doc.children.find((n) => n.type === 'document_title');
  const titleLine = titleNode ? `\\title{${escapeLatexText(titleNode.text)}}` : '';
  const authorNode = doc.children.find((n) => n.type === 'document_author');
  const dateNode = doc.children.find((n) => n.type === 'document_date');
  const authorLine = authorNode ? `\\author{${escapeLatexText(authorNode.text)}}` : '';
  const dateLine = dateNode ? `\\date{${escapeLatexText(dateNode.text)}}` : '';

  // Exclude title nodes from body (we place \\title in preamble for standard LaTeX structure).
  const bodyNodes = doc.children.filter(
    (n) => n.type !== 'document_title' && n.type !== 'document_author' && n.type !== 'document_date'
  );
  const body = renderNodes(bodyNodes).trimEnd();

  // Minimal, broadly compatible, and IR-compatible:
  // avoid \\usepackage and other preamble directives that are not represented in IR.
  const preambleParts = [
    '\\documentclass{article}',
  ];
  if (titleLine) preambleParts.push(titleLine);
  // Only emit author/date if IR actually has them (i.e. present in XMD or added in LaTeX then parsed).
  if (authorLine) preambleParts.push(authorLine);
  if (dateLine) preambleParts.push(dateLine);
  // NOTE: If title exists but date does not, LaTeX defaults to \today. If we want "no date shown"
  // without injecting date semantics into IR, we'd need a policy decision; for now we do not inject.

  const preamble = `${preambleParts.join('\n')}\n\n`;
  const begin = '\\begin{document}\n';
  // \maketitle requires at least \title{...}.
  const maketitle = titleLine ? '\\maketitle\n\n' : '';
  const end = '\n\\end{document}\n';

  return `${preamble}${begin}${maketitle}${body}${end}`;
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
    case 'document_author':
      return `\\author{${escapeLatexText(node.text)}}`;
    case 'document_date':
      return `\\date{${escapeLatexText(node.text)}}`;
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
      // Use a real LaTeX figure environment so the LaTeX->IR parser can round-trip this back to XMD.
      // Keep it compilable without \\usepackage by *not* emitting \\includegraphics (graphicx).
      // Instead, embed the source as a structured comment.
      const src = escapeLatexText(node.src);
      const caption = escapeLatexText(node.caption ?? '');
      const label = node.label ? escapeLatexText(node.label) : '';

      const lines: string[] = [];
      lines.push('\\begin{figure}');
      lines.push(`% zadoox-src: ${src}`);
      if (caption.trim().length > 0) lines.push(`\\caption{${caption}}`);
      if (label.trim().length > 0) lines.push(`\\label{${label}}`);
      lines.push('\\end{figure}');
      return lines.join('\n');
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

  // Links: keep compilable without packages (avoid \\href/\\url).
  // Render as: "text (url)".
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, url) => {
    const tt = escapeLatexText(String(t));
    const uu = escapeLatexText(String(url));
    return `${tt} (${uu})`;
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


