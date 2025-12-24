/**
 * LaTeX conversion utilities
 * Converts between Extended Markdown and LaTeX
 */

// Placeholder imports removed - not currently used in latex.ts

/**
 * Convert Extended Markdown to LaTeX
 */
export function markdownToLatex(content: string): string {
  let latex = content;

  // Headers
  latex = latex.replace(/^### (.*$)/gim, '\\subsubsection{$1}');
  latex = latex.replace(/^## (.*$)/gim, '\\subsection{$1}');
  latex = latex.replace(/^# (.*$)/gim, '\\section{$1}');

  // Bold
  latex = latex.replace(/\*\*(.*?)\*\*/gim, '\\textbf{$1}');
  latex = latex.replace(/__(.*?)__/gim, '\\textbf{$1}');

  // Italic
  latex = latex.replace(/\*(.*?)\*/gim, '\\textit{$1}');
  latex = latex.replace(/_(.*?)_/gim, '\\textit{$1}');

  // Code blocks - use verbatim environment
  latex = latex.replace(/```[\s\S]*?```/gim, (match) => {
    const code = match.replace(/```/g, '').trim();
    return `\\begin{verbatim}\n${code}\n\\end{verbatim}`;
  });

  // Inline code
  latex = latex.replace(/`([^`]+)`/gim, '\\texttt{$1}');

  // Links
  latex = latex.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '\\href{$2}{$1}');

  // Images
  latex = latex.replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '\\includegraphics{$2}');

  // Math mode (basic support)
  // Inline math: $...$
  // Block math: $$...$$
  // Already handled by LaTeX, just ensure they're preserved

  // Escape special LaTeX characters (before line break replacements to preserve \par and \\)
  latex = escapeLatex(latex);

  // Line breaks - LaTeX uses \\ for line breaks, \par for paragraphs
  // Do this after escaping to avoid escaping the LaTeX commands we're adding
  latex = latex.replace(/\n\n/gim, '\n\n\\par\n\n');
  latex = latex.replace(/\n/gim, '\\\\\n');

  return latex;
}

/**
 * Convert LaTeX to Extended Markdown
 */
export function latexToMarkdown(content: string): string {
  let markdown = content;

  // Sections
  markdown = markdown.replace(/\\section\{([^}]+)\}/gim, '# $1');
  markdown = markdown.replace(/\\subsection\{([^}]+)\}/gim, '## $1');
  markdown = markdown.replace(/\\subsubsection\{([^}]+)\}/gim, '### $1');

  // Bold
  markdown = markdown.replace(/\\textbf\{([^}]+)\}/gim, '**$1**');
  markdown = markdown.replace(/\\textbf\{([^}]+)\}/gim, '**$1**');

  // Italic
  markdown = markdown.replace(/\\textit\{([^}]+)\}/gim, '*$1*');

  // Code blocks
  markdown = markdown.replace(/\\begin\{verbatim\}[\s\S]*?\\end\{verbatim\}/gim, (match) => {
    const code = match.replace(/\\begin\{verbatim\}/g, '').replace(/\\end\{verbatim\}/g, '').trim();
    return `\`\`\`\n${code}\n\`\`\``;
  });

  // Inline code
  markdown = markdown.replace(/\\texttt\{([^}]+)\}/gim, '`$1`');

  // Links
  markdown = markdown.replace(/\\href\{([^}]+)\}\{([^}]+)\}/gim, '[$2]($1)');

  // Images
  markdown = markdown.replace(/\\includegraphics\{([^}]+)\}/gim, '![]($1)');

  // Line breaks
  markdown = markdown.replace(/\\\\/gim, '\n');
  markdown = markdown.replace(/\\par/gim, '\n\n');

  return markdown;
}

/**
 * Escape special LaTeX characters
 */
function escapeLatex(text: string): string {
  // Characters that need escaping in LaTeX
  const specialChars = ['&', '%', '$', '#', '^', '_', '{', '}'];
  let escaped = text;

  for (const char of specialChars) {
    // Don't escape if already escaped
    const regex = new RegExp(`([^\\\\])${char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    escaped = escaped.replace(regex, `$1\\${char}`);
  }

  // Handle backslashes
  escaped = escaped.replace(/\\(?![{}])/g, '\\textbackslash{}');

  return escaped;
}

