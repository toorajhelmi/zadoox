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

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/gim, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  html = html.replace(/_(.*?)_/gim, '<em>$1</em>');

  // Code blocks
  html = html.replace(/```[\s\S]*?```/gim, (match) => {
    const code = match.replace(/```/g, '');
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

  // Images (must come before links, as images start with !)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" />');

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

