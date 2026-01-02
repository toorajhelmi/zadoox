/**
 * Extended Markdown utilities
 * Extended Markdown is standard Markdown with support for placeholders ({CH}, {REF})
 */

import { PLACEHOLDER_PATTERNS } from '../constants/placeholders';

/**
 * Parse Extended Markdown text
 * Currently, Extended Markdown is just standard Markdown with placeholders
 * This function validates the markdown and extracts metadata
 */
export interface ParsedMarkdown {
  content: string;
  hasPlaceholders: boolean;
  placeholderTypes: Array<'CH' | 'REF'>;
}

/**
 * Parse Extended Markdown content
 */
export function parseMarkdown(content: string): ParsedMarkdown {
  const hasChapterPlaceholder = PLACEHOLDER_PATTERNS.chapter.test(content);
  const hasRefPlaceholder = PLACEHOLDER_PATTERNS.ref.test(content);
  
  const placeholderTypes: Array<'CH' | 'REF'> = [];
  if (hasChapterPlaceholder) placeholderTypes.push('CH');
  if (hasRefPlaceholder) placeholderTypes.push('REF');

  return {
    content,
    hasPlaceholders: hasChapterPlaceholder || hasRefPlaceholder,
    placeholderTypes,
  };
}

/**
 * Render Markdown to HTML
 * Basic implementation - can be extended with a proper markdown library later
 */
export function renderMarkdownToHtml(content: string): string {
  // Basic markdown to HTML conversion
  // For MVP, we'll do a simple conversion
  // This can be enhanced with a library like marked or remark later
  
  let html = content;

  const parseAttr = (attrs: string, key: string): string | null => {
    const re = new RegExp(`${key}="([^"]*)"`);
    const m = re.exec(attrs);
    return m ? m[1] : null;
  };

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/gim, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  // NOTE: Avoid matching underscores inside "words" (e.g. URLs, IDs) and avoid empty "__" matches.
  // This keeps asset refs like `zadoox-asset://...__...` intact.
  html = html.replace(/(^|[^\w])_([^_\n]+?)_([^\w]|$)/gim, '$1<em>$2</em>$3');

  // Code blocks
  html = html.replace(/```[\s\S]*?```/gim, (match) => {
    const code = match.replace(/```/g, '');
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

  // Images (must come before links to avoid matching images as links)
  //
  // Also support Zadoox/Pandoc-style attribute blocks after images:
  // ![Alt](url){#fig:xyz label="Figure {REF}.1"}
  //
  // Our preview renderer doesn't interpret those attributes yet, but it must not show them as text.
  // Additionally, for figures with attribute blocks, we render the alt text as a visible caption.
  //
  // NOTE: the attribute block may contain placeholders like `{REF}`/`{CH}` which include `}`.
  // So we explicitly allow those placeholder tokens inside the `{...}` to avoid leaving tail text behind.
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)\s*(\{(?:\{REF\}|\{CH\}|[^}])*\})/gim,
    (_m, alt, url, attrBlock) => {
      const safeAlt = String(alt || '');
      const safeUrl = String(url || '');

      // Parse rendering hints from attribute block (if present)
      const rawAttrs = String(attrBlock || '').trim();
      const attrs = rawAttrs.startsWith('{') && rawAttrs.endsWith('}') ? rawAttrs.slice(1, -1) : rawAttrs;
      const figIdMatch = /#(fig:[^\s}]+)/i.exec(attrs);
      const figureDomId = figIdMatch?.[1] ? `figure-${sanitizeDomId(figIdMatch[1])}` : null;
      const align = parseAttr(attrs, 'align'); // left|center|right
      const width = parseAttr(attrs, 'width'); // e.g. 50% or 320px
      const placement = parseAttr(attrs, 'placement'); // inline|block

      const imgStyleParts: string[] = [];
      // Block vs inline sizing:
      // - inline: wrapper width drives image width (fill wrapper), caption matches wrapper width
      // - block: wrapper is full-width, width constrains image inside it (max-width), caption spans wrapper
      imgStyleParts.push('max-width:100%');
      if (placement === 'inline' && width) {
        imgStyleParts.push('width:100%');
      } else if (placement !== 'inline' && width) {
        imgStyleParts.push(`max-width:${width}`);
      }
      imgStyleParts.push('display:block');
      if (align === 'center') imgStyleParts.push('margin-left:auto', 'margin-right:auto');
      if (align === 'right') imgStyleParts.push('margin-left:auto');
      const imgStyle = imgStyleParts.length > 0 ? ` style="${imgStyleParts.join(';')}"` : '';

      // Caption alignment should be independent of figure/image alignment.
      // Product rule: captions are always centered (text), but the caption box should match
      // the figure's width/alignment so it sits under the image.
      const captionStyleParts: string[] = [];
      captionStyleParts.push('display:block');
      captionStyleParts.push('text-align:center');
      if (placement !== 'inline' && width) {
        captionStyleParts.push(`max-width:${width}`);
        if (align === 'center') captionStyleParts.push('margin-left:auto', 'margin-right:auto');
        if (align === 'right') captionStyleParts.push('margin-left:auto');
      } else {
        captionStyleParts.push('width:100%');
      }
      const captionStyle = ` style="${captionStyleParts.join(';')}"`;

      // For inline placement, float so surrounding text can wrap.
      // Default to float-left when placement="inline" (even if no align was specified),
      // and float-right when align="right".
      const wrapperStyleParts: string[] = [];
      if (placement === 'inline') {
        // Ensure wrapper hugs the image/caption block.
        wrapperStyleParts.push('display:inline-block');
        if (width) wrapperStyleParts.push(`width:${width}`);
        const floatSide = align === 'right' ? 'right' : 'left';
        wrapperStyleParts.push(`float:${floatSide}`);
        wrapperStyleParts.push(floatSide === 'left' ? 'margin:0 12px 12px 0' : 'margin:0 0 12px 12px');
      } else {
        wrapperStyleParts.push('display:block');
        wrapperStyleParts.push('width:100%');
      }
      const wrapperStyle =
        wrapperStyleParts.length > 0 ? ` style="${wrapperStyleParts.join(';')}"` : '';

      const caption =
        safeAlt.trim().length > 0
          ? `<em class="figure-caption"${captionStyle}>${safeAlt}</em>`
          : '';

      const idAttr = figureDomId ? ` id="${figureDomId}"` : '';
      return `<span class="figure"${idAttr}${wrapperStyle}><img src="${safeUrl}" alt="${safeAlt}"${imgStyle} />${caption}</span>`;
    }
  );

  // Plain images (no attribute blocks)
  // Zadoox convention: treat the image alt text as a visible caption in preview.
  // This keeps preview consistent with the editor's embedded figure card and avoids requiring
  // a non-standard caption syntax.
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, (_m, alt, url) => {
    const safeAlt = String(alt || '');
    const safeUrl = String(url || '');

    const captionStyleParts: string[] = [];
    captionStyleParts.push('display:block');
    captionStyleParts.push('width:100%');
    captionStyleParts.push('text-align:center');
    const captionStyle = ` style="${captionStyleParts.join(';')}"`;

    const caption =
      safeAlt.trim().length > 0
        ? `<em class="figure-caption"${captionStyle}>${safeAlt}</em>`
        : '';

    return `<span class="figure"><img src="${safeUrl}" alt="${safeAlt}" />${caption}</span>`;
  });

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');

  // HTML tags (underline, superscript, subscript - these are allowed in markdown)
  // These are already HTML, so we don't need to convert them
  // Just ensure they're preserved (they will be passed through)

  // Line breaks
  html = html.replace(/\n\n/gim, '</p><p>');
  html = html.replace(/\n/gim, '<br />');

  // Wrap in paragraph if not already wrapped
  if (!html.startsWith('<')) {
    html = '<p>' + html + '</p>';
  }

  return html;
}

/**
 * Extract headings from markdown content
 */
export interface Heading {
  level: number; // 1-6 for h1-h6
  text: string;
  id: string; // URL-friendly ID for anchor links
}

export function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    // Match markdown headings: # Heading, ## Heading, etc.
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      // Generate URL-friendly ID from heading text
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
      
      headings.push({ level, text, id });
    }
  }
  
  return headings;
}

export type OutlineItem =
  | { kind: 'heading'; level: number; text: string; id: string }
  | { kind: 'figure'; text: string; id: string; figureNumber: number; caption: string | null };

function slugifyId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeDomId(raw: string): string {
  // HTML ids can include more chars, but we keep this conservative for querySelector/getElementById.
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract an outline consisting of headings + figures.
 * A "figure" is any markdown image with an attribute block containing a `#fig:` identifier.
 */
export function extractOutlineItems(content: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  const lines = content.split('\n');

  let figureCount = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const id = slugifyId(text);
      items.push({ kind: 'heading', level, text, id });
      continue;
    }

    // Figure: ![caption](url){#fig:xyz ...}
    const figMatch = line.match(/!\[([^\]]*)\]\([^)]+\)\s*(\{(?:\{REF\}|\{CH\}|[^}])*\})/i);
    if (figMatch) {
      const captionRaw = (figMatch[1] || '').trim();
      const attrBlock = String(figMatch[2] || '').trim();
      const attrs = attrBlock.startsWith('{') && attrBlock.endsWith('}') ? attrBlock.slice(1, -1) : attrBlock;
      const idMatch = /#(fig:[^\s}]+)/i.exec(attrs);
      if (idMatch) {
        figureCount += 1;
        const rawId = idMatch[1];
        const id = `figure-${sanitizeDomId(rawId)}`;
        const caption = captionRaw.length > 0 ? captionRaw : null;
        const text = caption ? `Figure — ${caption}` : `Figure ${figureCount}`;
        items.push({ kind: 'figure', id, text, figureNumber: figureCount, caption });
      }
    }
  }

  return items;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

