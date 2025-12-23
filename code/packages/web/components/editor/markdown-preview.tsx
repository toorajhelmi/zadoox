'use client';

import { renderMarkdownToHtml, extractHeadings } from '@zadoox/shared';
import { useMemo } from 'react';

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    if (!content.trim()) {
      return '';
    }
    
    // Extract headings from markdown before rendering
    const headings = extractHeadings(content);
    
    // Render markdown to HTML
    let htmlContent = renderMarkdownToHtml(content);
    
    // Add IDs to headings for outline navigation
    // Replace headings in order, matching by level and text
    headings.forEach((heading) => {
      const headingTag = `h${heading.level}`;
      // Create regex to match heading tag with the exact text
      // Escape special characters in the text for regex
      const escapedText = heading.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`<${headingTag}>${escapedText}</${headingTag}>`);
      htmlContent = htmlContent.replace(regex, `<${headingTag} id="${heading.id}">${heading.text}</${headingTag}>`);
    });
    
    return htmlContent;
  }, [content]);

  if (!content.trim()) {
    return (
      <div className="h-full flex items-center justify-center text-vscode-text-secondary">
        <p>No content to preview</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 bg-vscode-bg">
      <div
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          color: '#cccccc',
          fontFamily: 'var(--font-vscode, Consolas, Monaco, "Courier New", monospace)',
          lineHeight: '1.6',
        }}
      />
      <style jsx global>{`
        .markdown-content h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 1em 0 0.5em 0;
          color: #ffffff;
        }
        .markdown-content h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.8em 0 0.4em 0;
          color: #ffffff;
        }
        .markdown-content h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin: 0.6em 0 0.3em 0;
          color: #ffffff;
        }
        .markdown-content p {
          margin: 0.5em 0;
        }
        .markdown-content code {
          background-color: #3e3e42;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: var(--font-vscode, Consolas, Monaco, "Courier New", monospace);
        }
        .markdown-content pre {
          background-color: #252526;
          padding: 1em;
          border-radius: 4px;
          overflow-x: auto;
          margin: 1em 0;
        }
        .markdown-content pre code {
          background-color: transparent;
          padding: 0;
        }
        .markdown-content strong {
          font-weight: bold;
          color: #ffffff;
        }
        .markdown-content em {
          font-style: italic;
        }
        .markdown-content a {
          color: #4ec9b0;
          text-decoration: underline;
        }
        .markdown-content a:hover {
          color: #6ed4c0;
        }
        .markdown-content u {
          text-decoration: underline;
        }
        .markdown-content sup {
          vertical-align: super;
          font-size: 0.8em;
        }
        .markdown-content sub {
          vertical-align: sub;
          font-size: 0.8em;
        }
      `}</style>
    </div>
  );
}

