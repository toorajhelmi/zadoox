import { renderMarkdownToHtml } from '../editor/markdown';
import type { DocumentNode, GridNode, IrNode, TextStyle } from './types';
import { getGridSpacingPreset } from './grid-spacing';

const TRANSPARENT_PIXEL =
  // 1x1 transparent GIF
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

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
  const parts: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    if (n.type === 'document_author') {
      const authors: Array<{ text: string }> = [];
      while (i < nodes.length && nodes[i]!.type === 'document_author') {
        const a = nodes[i]! as { type: 'document_author'; text?: string };
        const t = String(a.text ?? '').trim();
        if (t) authors.push({ text: t });
        i++;
      }
      i--; // compensate for for-loop increment
      if (authors.length > 0) {
        const inner = authors.map((a) => `<div class="doc-author">${escapeHtml(a.text)}</div>`).join('');
        parts.push(`<div class="doc-authors">${inner}</div>`);
        continue;
      }
    }
    const rendered = renderNode(n);
    if (rendered) parts.push(rendered);
  }
  return parts.join('');
}

function styleToCss(style?: TextStyle): string {
  if (!style) return '';
  const parts: string[] = [];
  if (style.align) parts.push(`text-align:${style.align}`);
  if (style.color) parts.push(`color:${style.color}`);
  if (style.size) {
    // Use conservative scaling (avoid huge typography changes).
    const fs = style.size === 'small' ? '0.92em' : style.size === 'large' ? '1.12em' : '1em';
    parts.push(`font-size:${fs}`);
  }
  return parts.join(';');
}

function forceGridCellMediaToFill(html: string): string {
  const s = String(html ?? '');
  if (s.trim().length === 0) return s;

  const styleHasExplicitWidth = (style: string): boolean => /\b(width|max-width)\s*:/i.test(style || '');

  // Make figure wrappers fill the cell so percentage-based <img width:100%> resolves properly.
  const withFigureInner = s
    .replace(/<span([^>]*?)class="figure-inner"([^>]*?)>/g, (m, a, b) => {
      const attrs = `${a || ''}${b || ''}`;
      if (/\sstyle="/i.test(attrs)) {
        return m.replace(/\sstyle="([^"]*)"/i, (_m2, style) => {
          // Respect explicit widths set by the markdown figure renderer (e.g. width="50%").
          if (styleHasExplicitWidth(style)) return ` style="${style}"`;
          const next = `${style};display:block;width:100%;max-width:100%`;
          return ` style="${next}"`;
        });
      }
      return `<span${a || ''}class="figure-inner"${b || ''} style="display:block;width:100%;max-width:100%">`;
    })
    .replace(/<span([^>]*?)class="figure"([^>]*?)>/g, (m, a, b) => {
      const attrs = `${a || ''}${b || ''}`;
      if (/\sstyle="/i.test(attrs)) {
        return m.replace(/\sstyle="([^"]*)"/i, (_m2, style) => {
          // Respect explicit widths set by the markdown figure renderer (e.g. width="50%").
          if (styleHasExplicitWidth(style)) return ` style="${style}"`;
          const next = `${style};display:block;width:100%;max-width:100%`;
          return ` style="${next}"`;
        });
      }
      return `<span${a || ''}class="figure"${b || ''} style="display:block;width:100%;max-width:100%">`;
    });

  // Ensure images expand to the available cell width (removes the blank space beside images).
  return withFigureInner.replace(/<img([^>]*?)>/g, (m, attrs) => {
    const a = String(attrs || '');
    const inject = 'display:block;max-width:100%;width:100%;height:auto';
    if (/\sstyle="/i.test(a)) {
      return `<img${a.replace(/\sstyle="([^"]*)"/i, (_m2, style) => {
        // If the renderer already set width/max-width, don't override it.
        if (styleHasExplicitWidth(style)) return ` style="${style}"`;
        return ` style="${style};${inject}"`;
      })}>`;
    }
    return `<img${a} style="${inject}">`;
  });
}

function shrinkWrapGridCellMedia(html: string): string {
  const s = String(html ?? '');
  if (s.trim().length === 0) return s;

  const removeWidth100Only = (style: string): string => {
    const parts = String(style || '')
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);
    const kept: string[] = [];
    for (const decl of parts) {
      const idx = decl.indexOf(':');
      if (idx <= 0) {
        kept.push(decl);
        continue;
      }
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const val = decl.slice(idx + 1).trim().toLowerCase();
      if (prop === 'width' && val === '100%') continue;
      kept.push(decl);
    }
    return kept.join(';');
  };

  // In grids, our markdown figure renderer uses block placement by default and sets:
  //   <span class="figure" style="display:block;width:100%;text-align:...">
  // That forces grid tables to expand to full width even for center/left/right alignments.
  //
  // For shrink-wrap grids we want figures to hug content, so strip width:100% and use inline-block.
  let sampleImgBefore: string | null = null;
  let sampleImgAfter: string | null = null;
  let out = s.replace(/<span([^>]*?)class="figure"([^>]*?)>/g, (m, a, b) => {
    const attrs = `${a || ''}${b || ''}`;
    if (!/\sstyle="/i.test(attrs)) return m;
    return m.replace(/\sstyle="([^"]*)"/i, (_m2, style) => {
      let next = removeWidth100Only(String(style || ''));
      next = next.replace(/(^|;)\s*display\s*:\s*block\s*(;|$)/gi, '$1display:inline-block$2');
      next = next.replace(/(^|;)\s*float\s*:\s*(left|right|none)\s*(;|$)/gi, '$1float:none$3');
      // Ensure it can still shrink, but never overflow the cell.
      if (!/\bmax-width\s*:/i.test(next)) next += ';max-width:100%';
      if (!/\bwidth\s*:/i.test(next)) next += ';width:fit-content';
      return ` style="${next.replace(/;;+/g, ';')}"`;
    });
  });
  // In shrink-wrap grids, percent widths like width:50% should behave like "scale intrinsic size",
  // NOT "half of the table cell". We can't know intrinsic size here, so we tag the element so the
  // client preview can convert it to a pixel width after the image loads.
  out = out.replace(/<span([^>]*?)class="figure-inner"([^>]*?)>/g, (m, a, b) => {
    const attrs = `${a || ''}${b || ''}`;
    const styleMatch = /\sstyle="([^"]*)"/i.exec(attrs);
    if (!styleMatch) return m;
    const style = String(styleMatch[1] || '');
    const pct = /(^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)%\s*(;|$)/i.exec(style);
    if (!pct) return m;
    const n = Number(pct[2]);
    if (!Number.isFinite(n) || n <= 0 || n >= 100) return m;
    const nextStyle = style.replace(pct[0], `${pct[1]}width:auto${pct[3]}`);
    const injected = m
      .replace(/\sstyle="([^"]*)"/i, ` style="${nextStyle.replace(/;;+/g, ';')}"`)
      // add data-zx-width-pct if not already present
      .replace(/>$/, ` data-zx-width-pct="${String(Math.round(n))}">`);
    return injected;
  });
  // Also strip width:100% from <img> inside shrink-wrapped grids.
  out = out.replace(/<img([^>]*?)>/g, (m, attrs) => {
    const a = String(attrs || '');
    if (!/\sstyle="/i.test(a)) return m;
    return `<img${a.replace(/\sstyle="([^"]*)"/i, (_m2, style) => {
      const raw = String(style || '');
      if (!sampleImgBefore) sampleImgBefore = raw;
      let next = removeWidth100Only(raw);
      if (!/\bmax-width\s*:/i.test(next)) next += ';max-width:100%';
      if (!sampleImgAfter) sampleImgAfter = next;
      return ` style="${next.replace(/;;+/g, ';')}"`;
    })}>`;
  });
  return out;
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
      const css = styleToCss((node as unknown as { style?: TextStyle }).style);
      if (!css) return html;
      // Wrap so we can apply block-level styling without re-parsing the markdown HTML.
      return `<div class="text-block" style="${css}">${html}</div>`;
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
      // We still render it in a dedicated wrapper so the UI can style it cleanly.
      const latex = escapeHtml(node.latex ?? '');
      return `<div class="math-block"><code class="math-latex">${latex}</code></div>`;
    }
    case 'figure': {
      const figId = node.label ? `figure-${sanitizeDomId(node.label)}` : `figure-${sanitizeDomId(node.id)}`;
      // Important: preserve the existing figure attribute-block behavior (align/width/placement)
      // by reusing the original XMD source line when available.
      const raw = node.source?.raw;
      const rawSrc = String(node.src ?? '').trim();
      const isAlreadyResolvable =
        rawSrc.startsWith('zadoox-asset://') || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rawSrc) || rawSrc.startsWith('data:');
      // For LaTeX bundle figures we often have relative paths; prefer the native renderer
      // (data-latex-asset-path) so the preview can fetch from storage. In that case, do NOT
      // route through the markdown image renderer (it would emit <img src="relative"> which 404s).
      if (raw && isAlreadyResolvable && raw.trim().startsWith('![') && raw.includes('](')) {
        // Wrap in an anchor span so the outline can reliably scroll even if the markdown renderer
        // doesn't include an id attribute.
        return `<span id="${figId}">${renderMarkdownToHtml(raw.trimEnd())}</span>`;
      }

      // For imported LaTeX bundles, figures often reference relative paths (e.g. Figures/foo or figures/foo.pdf).
      // Those should be resolved by the web preview layer via /documents/:id/latex/file.
      // Use generic "zx asset" attributes (scope + path) so this isn't LaTeX-specific in naming.
      const relPath = escapeHtml(rawSrc.replace(/^\/+/, ''));
      const ext = rawSrc.split('?')[0]!.split('#')[0]!.toLowerCase().trim().endsWith('.pdf') ? '.pdf' : '';
      const cap = escapeHtml(node.caption ?? '');
      const caption =
        cap.trim().length > 0
          ? `<em class="figure-caption" style="display:block;width:100%;text-align:center">${cap}</em>`
          : '';
      // Keep caption centered relative to the image width by using an inner inline-block wrapper.
      if (isAlreadyResolvable) {
        return `<span id="${figId}" class="figure"><span class="figure-inner" style="display:inline-block;max-width:100%;margin-left:0;margin-right:auto"><img src="${escapeHtml(
          rawSrc
        )}" alt="${cap}" style="display:block;max-width:100%" />${caption}</span></span>`;
      }
      if (ext === '.pdf') {
        // Render PDFs via <object> so browsers can display them inline (or at least provide a fallback link).
        return `<span id="${figId}" class="figure"><span class="figure-inner" style="display:inline-block;max-width:100%;margin-left:0;margin-right:auto">
          <object class="latex-figure-pdf" data="${TRANSPARENT_PIXEL}" data-zx-asset-scope="latex" data-zx-asset-path="${relPath}" type="application/pdf" style="width:min(900px,100%);height:520px;display:block;border:1px solid rgba(255,255,255,0.12);border-radius:8px">
            <a class="latex-figure-link" href="#" data-zx-asset-scope="latex" data-zx-asset-path="${relPath}">Open figure (PDF)</a>
          </object>
          ${caption}
        </span></span>`;
      }
      return `<span id="${figId}" class="figure"><span class="figure-inner" style="display:inline-block;max-width:100%;margin-left:0;margin-right:auto"><img src="${TRANSPARENT_PIXEL}" data-zx-asset-scope="latex" data-zx-asset-path="${relPath}" alt="${cap}" style="display:block;max-width:100%" />${caption}</span></span>`;
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

      const align = g.align ?? 'left';
      const isFullWidth = align === 'full';
      const spacing = getGridSpacingPreset(g.margin ?? 'medium');

      const borderColor = (g.style?.borderColor ?? '').trim() || 'rgba(255,255,255,0.16)';
      const borderWidthRaw = g.style?.borderWidthPx;
      const borderNone = Number.isFinite(borderWidthRaw) && (borderWidthRaw as number) === 0;
      const borderWidth = Number.isFinite(borderWidthRaw) && (borderWidthRaw ?? 0) > 0 ? Math.round(borderWidthRaw!) : 1;
      const borderStyle = (g.style?.borderStyle ?? 'solid') as 'solid' | 'dotted' | 'dashed';
      const cellBorder = borderNone ? 'none' : `${borderWidth}px ${borderStyle} ${borderColor}`;
      const tdWidthPct = Math.round((100 / cols) * 1000) / 1000;

      const body = rows
        .map((row) => {
          const cells = Array.from({ length: cols }).map((_, i) => {
            const cell = row?.[i];
            // Only force "fill cell" media sizing in full-width grids.
            // For left/center/right we want the grid to shrink-wrap to its natural content.
            const inner = isFullWidth
              ? forceGridCellMediaToFill(renderNodes(cell?.children ?? []))
              : shrinkWrapGridCellMedia(renderNodes(cell?.children ?? []));
            const widthStyle = isFullWidth ? `width:${tdWidthPct}%;` : '';
            return `<td style="${widthStyle}border:${cellBorder};padding:${spacing.previewCellPadY}px ${spacing.previewCellPadX}px;vertical-align:top">${inner}</td>`;
          });
          return `<tr>${cells.join('')}</tr>`;
        })
        .join('');

      const caption = String(g.caption ?? '').trim();
      const capHtml = caption.length > 0 ? `<div class="xmd-grid-caption">${escapeHtml(caption)}</div>` : '';
      const alignCss =
        align === 'center'
          ? 'text-align:center'
          : align === 'right'
            ? 'text-align:right'
            : 'text-align:left';
      const pad = spacing.outerPadPx;
      const placement = g.placement ?? 'block';
      const canFloat = placement === 'inline' && (align === 'left' || align === 'right');
      const floatCss = canFloat
        ? `float:${align === 'right' ? 'right' : 'left'};max-width:55%;margin:${align === 'right' ? '0.25em 0 0.75em 1em' : '0.25em 1em 0.75em 0'};`
        : '';
      const gridId = g.label ? ` id="grid-${sanitizeDomId(g.label)}"` : '';
      // NOTE: This enables wrap-around behavior in preview. The editor surface (CodeMirror)
      // cannot do true wrap-around for replacement widgets, so we only implement it here (IR->HTML).

      // Alignment model (matches editor intent):
      // - align="full": grid occupies full available width
      // - align=left|center|right: grid occupies ONLY its content width (plus padding/margins), not full line width
      //
      // IMPORTANT: previously we wrapped `.xmd-grid` in a full-width div for alignment, which made the grid
      // appear full-width even when the table itself was shrink-wrapped. The UX requirement is that the grid
      // should not take extra space beyond its content unless align="full".
      const outerCss = (() => {
        if (isFullWidth) return `display:block;width:100%;max-width:100%;padding:${pad}px;${floatCss}`;
        // placement=inline uses floatCss (left/right) when applicable; in that case we should not apply auto margins.
        if (floatCss && floatCss.includes('float:')) return `display:inline-block;width:fit-content;max-width:100%;padding:${pad}px;${floatCss}`;
        // Use display:table for reliable shrink-to-fit centering (more consistent than width:fit-content on block).
        if (align === 'center') return `display:table;max-width:100%;margin-left:auto;margin-right:auto;padding:${pad}px;`;
        if (align === 'right') return `display:table;max-width:100%;margin-left:auto;margin-right:0;padding:${pad}px;`;
        return `display:table;max-width:100%;margin-left:0;margin-right:auto;padding:${pad}px;`;
      })();
      // IMPORTANT: preview CSS (both in-app and publish) sets `.markdown-content table { width: 100% }`.
      // For shrink-wrapped grids (left/center/right), we must override that, otherwise the table becomes
      // full-width and alignment is impossible.
      const tableCss = isFullWidth
        ? 'border-collapse:collapse;width:100%;table-layout:fixed'
        : 'border-collapse:collapse;table-layout:auto;display:inline-table;width:auto;max-width:100%';
      return `<div class="xmd-grid"${gridId} style="${alignCss};${outerCss}">${capHtml}<table style="${tableCss}"><tbody>${body}</tbody></table></div>`;
    }
    case 'raw_xmd_block': {
      const raw = escapeHtml(node.xmd ?? '');
      if (!raw.trim()) return '';
      return `<div class="unrecognized-block"><div class="unrecognized-badge">Unrecognized</div><pre><code>${raw}</code></pre></div>`;
    }
    case 'raw_latex_block': {
      // Best-effort: remove comment-only lines and boilerplate so previews don't show LaTeX scaffolding.
      const raw = String(node.latex ?? '');
      const cleaned = raw
        .split('\n')
        .map((ln) => ln.replace(/^[\uFEFF\u200B\u200C\u200D]+/, ''))
        .filter((ln) => {
          const t = ln.trim();
          if (!t) return false;
          if (t.startsWith('%')) return false;
          if (/^\\+documentclass\{[^}]+\}/.test(t)) return false;
          if (/^\\+usepackage(\[[^\]]+\])?\{[^}]+\}/.test(t)) return false;
          if (/^\\+begin\{document\}/.test(t)) return false;
          if (/^\\+end\{document\}/.test(t)) return false;
          if (/^\\+maketitle/.test(t)) return false;
          return true;
        })
        .map((ln) => {
          // strip trailing comment
          let escaped = false;
          for (let k = 0; k < ln.length; k++) {
            const ch = ln[k]!;
            if (escaped) {
              escaped = false;
              continue;
            }
            if (ch === '\\') {
              escaped = true;
              continue;
            }
            if (ch === '%') return ln.slice(0, k).trimEnd();
          }
          return ln;
        })
        .join('\n')
        .trim();
      if (!cleaned) return '';
      return `<div class="unrecognized-block raw-latex-block"><div class="unrecognized-badge">Unrecognized</div><pre><code>${escapeHtml(cleaned)}</code></pre></div>`;
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


