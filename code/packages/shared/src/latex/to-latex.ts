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

  const needsGraphicx = containsFigure(bodyNodes);
  const needsWrapfig = containsInlineFigure(bodyNodes);

  // Minimal, broadly compatible, and IR-compatible:
  // avoid \\usepackage and other preamble directives that are not represented in IR.
  const preambleParts = [
    '\\documentclass{article}',
  ];
  if (needsGraphicx) preambleParts.push('\\usepackage{graphicx}');
  if (needsWrapfig) preambleParts.push('\\usepackage{wrapfig}');
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

function containsFigure(nodes: IrNode[]): boolean {
  for (const n of nodes) {
    if (n.type === 'figure') return true;
    if (n.type === 'section' && n.children?.length) {
      if (containsFigure(n.children)) return true;
    }
  }
  return false;
}

function containsInlineFigure(nodes: IrNode[]): boolean {
  for (const n of nodes) {
    if (n.type === 'figure') {
      const raw = (n as unknown as { source?: { raw?: string } }).source?.raw;
      const attrs = parseFigureAttrsFromXmd(raw);
      const placement = String(attrs.placement ?? '').trim().toLowerCase();
      const align = String(attrs.align ?? '').trim().toLowerCase();
      if (placement === 'inline' && align !== 'center') return true;
    }
    if (n.type === 'section' && n.children?.length) {
      if (containsInlineFigure(n.children)) return true;
    }
  }
  return false;
}

function zadooxAssetSrcToLatexPath(src: string): string {
  const s = String(src ?? '').trim();
  const prefix = 'zadoox-asset://';
  if (s.startsWith(prefix)) {
    const key = s.slice(prefix.length);
    return `assets/${key}`;
  }
  return s;
}

function widthAttrToIncludegraphicsOption(widthRaw: string | undefined): string | null {
  const w = String(widthRaw ?? '').trim();
  if (!w) return null;
  const pct = /^(\d+(?:\.\d+)?)%$/.exec(w);
  if (pct) {
    const n = Number(pct[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    return `width=${(n / 100).toFixed(3)}\\textwidth`;
  }
  if (/\\(textwidth|linewidth|columnwidth)\b/.test(w)) return `width=${w}`;
  if (/^\d+(\.\d+)?(cm|mm|in|pt)$/.test(w)) return `width=${w}`;
  return null;
}

function alignToLatex(n: { align?: string }): string {
  const a = String(n.align ?? '').trim().toLowerCase();
  if (a === 'left') return '\\raggedright';
  if (a === 'right') return '\\raggedleft';
  return '\\centering';
}

function widthAttrToLatexDim(widthRaw: string | undefined): string | null {
  const opt = widthAttrToIncludegraphicsOption(widthRaw);
  if (!opt) return null;
  const m = /^width=(.+)$/.exec(opt.trim());
  return m ? String(m[1]).trim() : null;
}

function renderNodes(nodes: IrNode[]): string {
  const out: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];

    // Special-case: inline figure wrapping.
    // `wrapfigure` only works when there is following text to wrap around.
    // Also, our renderer joins blocks with blank lines; a blank line immediately after a wrapfigure
    // can prevent text from wrapping in practice. So we join wrapfigure + next paragraph tightly.
    if (n.type === 'figure') {
      const next = nodes[i + 1];
      const raw = (n as unknown as { source?: { raw?: string } }).source?.raw;
      const attrs = parseFigureAttrsFromXmd(raw);
      const placement = String(attrs.placement ?? '').trim().toLowerCase();
      const align = String(attrs.align ?? '').trim().toLowerCase();
      const canWrap =
        placement === 'inline' &&
        align !== 'center' &&
        next?.type === 'paragraph' &&
        String((next as { text?: unknown }).text ?? '').trim().length > 0;

      if (canWrap) {
        const wrap = renderNode(n).trimEnd();
        const para = renderNode(next).trimEnd();
        // Join without a blank line so LaTeX sees the paragraph as immediately following.
        out.push(`${wrap}\n${para}`.trimEnd());
        i++; // consumed next paragraph
        continue;
      }
    }

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
      // Emit a real LaTeX figure so what the user sees in LaTeX mode is exactly what will compile.
      // - XMD figure src `zadoox-asset://<key>` becomes `assets/<key>` (file provided at compile time)
      // - We keep caption/label and apply optional width/align hints when present.
      const src = zadooxAssetSrcToLatexPath(node.src);
      const caption = escapeLatexText(node.caption ?? '');
      const label = node.label ? escapeLatexText(node.label) : '';
      const attrs = parseFigureAttrsFromXmd(node.source?.raw);
      const placement = String(attrs.placement ?? '').trim().toLowerCase();
      const align = String(attrs.align ?? '').trim().toLowerCase();

      const lines: string[] = [];
      if (placement === 'inline' && align !== 'center') {
        // Inline placement: wrap the figure so surrounding text can flow around it (like the web preview).
        // Map align -> side. Default inline side is left.
        const side = align === 'right' ? 'r' : 'l';
        const wrapWidth = widthAttrToLatexDim(attrs.width) ?? '0.450\\textwidth';
        lines.push(`\\begin{wrapfigure}{${side}}{${wrapWidth}}`);
        lines.push(alignToLatex(attrs));
        // In wrapfigure, \linewidth equals the wrap width; keep image constrained.
        lines.push(`\\includegraphics[width=\\linewidth]{\\detokenize{${src}}}`);
        if (caption.trim().length > 0) lines.push(`\\caption{${caption}}`);
        if (label.trim().length > 0) lines.push(`\\label{${label}}`);
        lines.push('\\end{wrapfigure}');
        return lines.join('\n');
      }

      // Block placement (default): standard figure environment.
      lines.push('\\begin{figure}');
      lines.push(alignToLatex(attrs));
      const widthOpt = widthAttrToIncludegraphicsOption(attrs.width);
      const optStr = widthOpt ? `[${widthOpt}]` : '';
      // Use \detokenize so asset keys (with underscores) work without manual escaping.
      lines.push(`\\includegraphics${optStr}{\\detokenize{${src}}}`);
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

function parseAttrValue(attrs: string, key: string): string | null {
  const re = new RegExp(`${key}="([^"]*)"`);
  const m = re.exec(attrs);
  return m ? m[1] : null;
}

function parseFigureAttrsFromXmd(raw: string | undefined): {
  align?: string;
  placement?: string;
  width?: string;
  desc?: string;
} {
  const s = (raw ?? '').trim();
  if (!s.startsWith('![') || !s.includes('](')) return {};
  // Attribute block can contain placeholder tokens like {REF}/{CH} which include braces.
  // Also, the figure line might not be standalone (can have trailing text on the same line).
  // So we search for the attr block after the image token, not only at end-of-line.
  // Mirror the permissive pattern used by the markdown renderer.
  const m = /!\[[^\]]*\]\([^)]+\)\s*(\{(?:\{REF\}|\{CH\}|[^}])*\})/i.exec(s);
  if (!m) return {};
  const rawBlock = (m[1] ?? '').trim();
  const attrs =
    rawBlock.startsWith('{') && rawBlock.endsWith('}') ? rawBlock.slice(1, -1).trim() : rawBlock;
  return {
    align: parseAttrValue(attrs, 'align') ?? undefined,
    placement: parseAttrValue(attrs, 'placement') ?? undefined,
    width: parseAttrValue(attrs, 'width') ?? undefined,
    desc: parseAttrValue(attrs, 'desc') ?? undefined,
  };
}

