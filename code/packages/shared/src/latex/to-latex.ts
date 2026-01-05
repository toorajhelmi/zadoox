import type { DocumentNode, FigureNode, GridNode, IrNode } from '../ir/types';

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
  const needsGrid = containsGrid(bodyNodes);
  const needsSubcaption = needsGrid && gridIsFigureOnly(bodyNodes);
  const needsCaption = needsGrid && !needsSubcaption && gridNeedsCaptionOf(bodyNodes);

  // Minimal, broadly compatible, and IR-compatible:
  // avoid \\usepackage and other preamble directives that are not represented in IR.
  const preambleParts = [
    '\\documentclass{article}',
  ];
  if (needsGraphicx) preambleParts.push('\\usepackage{graphicx}');
  if (needsWrapfig) preambleParts.push('\\usepackage{wrapfig}');
  if (needsSubcaption) preambleParts.push('\\usepackage{subcaption}');
  if (needsGrid) {
    preambleParts.push('\\usepackage{tabularx}');
    preambleParts.push('\\usepackage{array}');
  }
  if (needsCaption) preambleParts.push('\\usepackage{caption}');
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
    if (n.type === 'grid') {
      const g = n as unknown as GridNode;
      for (const row of g.rows ?? []) {
        for (const cell of row ?? []) {
          if (containsFigure(cell?.children ?? [])) return true;
        }
      }
    }
  }
  return false;
}

function containsInlineFigure(nodes: IrNode[], inGrid = false): boolean {
  for (const n of nodes) {
    if (n.type === 'figure' && !inGrid) {
      const raw = (n as unknown as { source?: { raw?: string } }).source?.raw;
      const attrs = parseFigureAttrsFromXmd(raw);
      const placement = String(attrs.placement ?? '').trim().toLowerCase();
      const align = String(attrs.align ?? '').trim().toLowerCase();
      if (placement === 'inline' && align !== 'center') return true;
    }
    if (n.type === 'section' && n.children?.length) {
      if (containsInlineFigure(n.children, inGrid)) return true;
    }
    if (n.type === 'grid') {
      const g = n as unknown as GridNode;
      for (const row of g.rows ?? []) {
        for (const cell of row ?? []) {
          if (containsInlineFigure(cell?.children ?? [], true)) return true;
        }
      }
    }
  }
  return false;
}

function containsGrid(nodes: IrNode[]): boolean {
  for (const n of nodes) {
    if (n.type === 'grid') return true;
    if (n.type === 'section' && n.children?.length) {
      if (containsGrid(n.children)) return true;
    }
  }
  return false;
}

function gridIsFigureOnly(nodes: IrNode[]): boolean {
  for (const n of nodes) {
    if (n.type === 'grid') {
      const g = n as unknown as GridNode;
      for (const row of g.rows ?? []) {
        for (const cell of row ?? []) {
          for (const cn of cell?.children ?? []) {
            if (cn.type !== 'figure') return false;
          }
        }
      }
      // A grid with no non-figure nodes is "figure-only" (empty cells allowed).
      continue;
    }
    if (n.type === 'section' && n.children?.length) {
      if (!gridIsFigureOnly(n.children)) return false;
    }
  }
  return true;
}

function gridNeedsCaptionOf(nodes: IrNode[]): boolean {
  // We use \captionof{figure} for figures inside grid cells when a caption is present.
  for (const n of nodes) {
    if (n.type === 'grid') {
      const g = n as unknown as GridNode;
      for (const row of g.rows ?? []) {
        for (const cell of row ?? []) {
          for (const cn of cell?.children ?? []) {
            if (cn.type === 'figure') {
              const cap = String((cn as FigureNode).caption ?? '').trim();
              const lab = String((cn as FigureNode).label ?? '').trim();
              if (cap.length > 0 || lab.length > 0) return true;
            }
          }
          if (gridNeedsCaptionOf(cell?.children ?? [])) return true;
        }
      }
    }
    if (n.type === 'section' && n.children?.length) {
      if (gridNeedsCaptionOf(n.children)) return true;
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
    case 'grid': {
      const g = node as unknown as GridNode;
      return renderGrid(g);
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

function renderGrid(grid: GridNode): string {
  const figureOnly = gridIsFigureOnly([grid]);
  // #region agent log
  try {
    const rows = grid.rows ?? [];
    const cellNodes = rows.flatMap((r) => (r ?? []).flatMap((c) => c?.children ?? []));
    const typeCounts: Record<string, number> = {};
    for (const n of cellNodes) typeCounts[n.type] = (typeCounts[n.type] ?? 0) + 1;
    fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'md-latex-roundtrip',hypothesisId:'H10',location:'latex/to-latex.ts:renderGrid',message:'Rendering grid to LaTeX',data:{figureOnly,cols:grid.cols||null,caption:(grid.caption??'').slice(0,120),rowCount:rows.length,cellNodeTypes:typeCounts},timestamp:Date.now()})}).catch(()=>{});
  } catch { /* ignore */ }
  // #endregion agent log
  if (figureOnly) return renderFigureGrid(grid);

  const rows = grid.rows ?? [];
  const cols = grid.cols && Number.isFinite(grid.cols) && grid.cols > 0 ? grid.cols : rows.reduce((m, r) => Math.max(m, (r ?? []).length), 0);
  const safeCols = cols > 0 ? cols : 1;
  const colSpec = Array.from({ length: safeCols }).map(() => 'X').join('|');

  const out: string[] = [];
  out.push(`\\begin{tabularx}{\\linewidth}{|${colSpec}|}`);
  out.push('\\hline');

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const cells: string[] = [];
    for (let c = 0; c < safeCols; c++) {
      const cell = row[c];
      cells.push(renderGridCell(cell?.children ?? []));
    }
    out.push(`${cells.join(' & ')} \\\\`);
    out.push('\\hline');
  }

  out.push('\\end{tabularx}');
  return out.join('\n');
}

function renderFigureGrid(grid: GridNode): string {
  const rows = grid.rows ?? [];
  const cols =
    grid.cols && Number.isFinite(grid.cols) && grid.cols > 0
      ? grid.cols
      : rows.reduce((m, r) => Math.max(m, (r ?? []).length), 0) || 1;

  const margin = grid.margin ?? 'medium';
  // Compute a reasonable subfigure width. Keep a little gutter so \hfill has room.
  const gutter = margin === 'small' ? 0.005 : margin === 'large' ? 0.06 : 0.02;
  const usable = Math.max(0.5, 1 - gutter * (cols - 1));
  const w = usable / cols;
  const rowVspace = margin === 'small' ? '0.25em' : margin === 'large' ? '1.75em' : '0.75em';

  const out: string[] = [];
  const placement = grid.placement ?? 'block';
  const align = grid.align ?? 'center';
  const placementIsInline = placement === 'inline' && (align === 'left' || align === 'right');
  // IMPORTANT: inside wrapfigure, the relevant width is the wrap box's \linewidth, not \textwidth.
  const widthStr = `${w.toFixed(3)}${placementIsInline ? '\\linewidth' : '\\textwidth'}`;
  if (placementIsInline) {
    const side = align === 'right' ? 'r' : 'l';
    // Heuristic: inline grids should not exceed ~60% of text width for 2-col grids, wider for 3+.
    const wrapWidth = cols <= 2 ? '0.55\\textwidth' : cols === 3 ? '0.80\\textwidth' : '0.95\\textwidth';
    out.push(`\\begin{wrapfigure}{${side}}{${wrapWidth}}`);
  } else {
    out.push('\\begin{figure}');
  }
  // Grid-level alignment (default: center).
  if (align === 'right') out.push('\\raggedleft');
  else if (align === 'left') out.push('\\raggedright');
  else out.push('\\centering');

  // IMPORTANT: Use a tabular to force stable row/column layout.
  // This avoids edge cases where \hfill + paragraphing can stack subfigures vertically in some templates.
  const colSpec = `@{}${'c'.repeat(cols)}@{}`;
  out.push(`\\begin{tabular}{${colSpec}}`);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const cells: string[] = [];
    for (let c = 0; c < cols; c++) {
      const cell = row[c];
      const figs = (cell?.children ?? []).filter((n): n is FigureNode => n.type === 'figure');
      const fig = figs[0];

      const cellLines: string[] = [];
      cellLines.push(`\\begin{subfigure}[t]{${widthStr}}`);
      cellLines.push('\\centering');
      if (fig) cellLines.push(renderFigureInFigureGrid(fig));
      else cellLines.push('~');
      cellLines.push('\\end{subfigure}');
      cells.push(cellLines.join('\n'));
    }
    const rowSuffix = r < rows.length - 1 ? ` \\\\[${rowVspace}]` : '';
    out.push(`${cells.join(' & ')}${rowSuffix}`);
  }
  out.push('\\end{tabular}');

  const gridCaption = String(grid.caption ?? '').trim();
  if (gridCaption.length > 0) out.push(`\\caption{${escapeLatexText(gridCaption)}}`);

  out.push(placementIsInline ? '\\end{wrapfigure}' : '\\end{figure}');
  return out.join('\n');
}

function renderFigureInFigureGrid(node: FigureNode): string {
  const src = zadooxAssetSrcToLatexPath(node.src);
  const caption = escapeLatexText(node.caption ?? '');
  const label = node.label ? escapeLatexText(node.label) : '';
  const attrs = parseFigureAttrsFromXmd((node as unknown as { source?: { raw?: string } }).source?.raw);

  const lines: string[] = [];
  // In a figure grid, alignment is handled by the subfigure container; keep image full-width by default.
  const widthOpt = widthAttrToIncludegraphicsOptionInCell(attrs.width) ?? 'width=\\linewidth';
  lines.push(`\\includegraphics[${widthOpt}]{\\detokenize{${src}}}`);
  if (caption.trim().length > 0) lines.push(`\\caption{${caption}}`);
  if (label.trim().length > 0) lines.push(`\\label{${label}}`);
  return lines.join('\n');
}

function renderGridCell(nodes: IrNode[]): string {
  const body = renderNodesInGridCell(nodes).trimEnd();
  if (body.trim().length === 0) return '';
  return `\\begin{minipage}[t]{\\linewidth}\n${body}\n\\end{minipage}`;
}

function renderNodesInGridCell(nodes: IrNode[]): string {
  const out: string[] = [];
  for (const n of nodes) {
    const s = renderNodeInGridCell(n);
    if (s.trim().length === 0) continue;
    out.push(s.trimEnd());
  }
  return out.join('\n\n');
}

function renderNodeInGridCell(node: IrNode): string {
  switch (node.type) {
    case 'figure':
      return renderFigureInGridCell(node as FigureNode);
    case 'section':
      // Sections are not expected inside cells; render their body only.
      return node.children?.length ? renderNodesInGridCell(node.children) : '';
    case 'grid':
      // Nested grids are allowed; just render them.
      return renderGrid(node as unknown as GridNode);
    default:
      // Reuse the normal renderer for everything else (paragraphs, lists, code, math, tables, raw).
      // NOTE: This avoids wrapfigure logic because we don't call renderNodes().
      return renderNode(node);
  }
}

function widthAttrToIncludegraphicsOptionInCell(widthRaw: string | undefined): string | null {
  const w = String(widthRaw ?? '').trim();
  if (!w) return null;
  const pct = /^(\d+(?:\.\d+)?)%$/.exec(w);
  if (pct) {
    const n = Number(pct[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    return `width=${(n / 100).toFixed(3)}\\linewidth`;
  }
  if (/\\(linewidth|columnwidth|textwidth)\b/.test(w)) return `width=${w}`;
  if (/^\d+(\.\d+)?(cm|mm|in|pt)$/.test(w)) return `width=${w}`;
  return null;
}

function renderFigureInGridCell(node: FigureNode): string {
  const src = zadooxAssetSrcToLatexPath(node.src);
  const caption = escapeLatexText(node.caption ?? '');
  const label = node.label ? escapeLatexText(node.label) : '';
  const attrs = parseFigureAttrsFromXmd((node as unknown as { source?: { raw?: string } }).source?.raw);

  const lines: string[] = [];
  lines.push(alignToLatex(attrs));
  const widthOpt = widthAttrToIncludegraphicsOptionInCell(attrs.width) ?? 'width=\\linewidth';
  lines.push(`\\includegraphics[${widthOpt}]{\\detokenize{${src}}}`);
  if (caption.trim().length > 0) lines.push(`\\captionof{figure}{${caption}}`);
  if (label.trim().length > 0) lines.push(`\\label{${label}}`);
  return lines.join('\n');
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

