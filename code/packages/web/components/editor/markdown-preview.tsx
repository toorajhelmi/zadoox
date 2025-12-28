'use client';

import { renderMarkdownToHtml, extractHeadings } from '@zadoox/shared';
import { useMemo, useEffect } from 'react';

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
    
    // Add IDs to reference entries in References section FIRST (before converting citations to links)
    // This ensures references have IDs before citations link to them
    const referencesSectionMatch = htmlContent.match(/(<h2[^>]*>References<\/h2>)([\s\S]*?)(?=<h[1-6]|<\/div>|$)/i);
    if (referencesSectionMatch) {
      let referencesContent = referencesSectionMatch[2];
      let refNumber = 1;
      
      // First, handle numbered/IEEE format: [1] ..., [2] ...
      // References might be in separate paragraphs OR in the same paragraph separated by <br />
      // We need to handle both cases:
      // Case 1: <p>[1] text</p><p>[2] text</p> (separate paragraphs)
      // Case 2: <p>[1] text<br />[2] text</p> (same paragraph with breaks)
      
      // First, handle separate paragraphs starting with [number]
      referencesContent = referencesContent.replace(
        /<p([^>]*)>\[(\d+)\]\s*/g,
        (match, attrs, number) => {
          // If attrs is empty, just add id and class
          if (!attrs || attrs.trim() === '') {
            return `<p id="ref-${number}" class="reference-entry">[${number}] `;
          } else {
            // Preserve existing attributes but add id (if not present) and class
            const hasId = /id=/.test(attrs);
            const hasClass = /class=/.test(attrs);
            if (!hasId) {
              return `<p id="ref-${number}" ${hasClass ? '' : 'class="reference-entry" '}${attrs}>[${number}] `;
            } else {
              // ID already exists, just ensure class is present
              return `<p ${attrs}${hasClass ? '' : ' class="reference-entry"'}>[${number}] `;
            }
          }
        }
      );
      
      // Then, handle references that appear after <br /> tags (same paragraph case)
      // Match <br /> followed by [number] - convert to separate paragraph with ID
      // So we'll convert <br />[number] to </p><p id="ref-X">[number]
      referencesContent = referencesContent.replace(
        /<br\s*\/?>\s*\[(\d+)\]\s*/g,
        (match, number) => {
          // Close the previous paragraph and start a new one with the ID
          return `</p><p id="ref-${number}" class="reference-entry">[${number}] `;
        }
      );
      
      // Then, for other formats (APA, MLA, Chicago, footnote), number them sequentially
      // Only process paragraphs that don't already have an id (were not processed above)
      referencesContent = referencesContent.replace(
        /<p(?!\s+id=)([^>]*)>([^<]+)<\/p>/g,
        (match, attrs, content) => {
          // Skip if empty
          if (content.trim() === '') {
            return match;
          }
          // Add ID to this reference
          const id = `id="ref-${refNumber}"`;
          refNumber++;
          return `<p ${id} class="reference-entry"${attrs}>${content}</p>`;
        }
      );
      
      htmlContent = htmlContent.replace(referencesSectionMatch[0], referencesSectionMatch[1] + referencesContent);
    }
    
    // Convert citation markers [1], [2], etc. to clickable anchors
    // Match citations like [1], [2], [10], etc. but not those already in links
    // Also skip citations at the start of reference paragraphs (they're part of the reference format)
    let processedHtml = htmlContent;
    const citationMatches: Array<{ full: string; number: string; index: number }> = [];
    const citationRegex = /\[(\d+)\]/g;
    let match;
    
    // Find the References section boundaries
    const refSectionStart = htmlContent.indexOf('<h2') !== -1 ? htmlContent.indexOf('References</h2>') : -1;
    const refSectionEnd = refSectionStart !== -1 ? htmlContent.indexOf('<h', refSectionStart + 100) : -1;
    
    // Collect all citation matches with their positions
    while ((match = citationRegex.exec(htmlContent)) !== null) {
      const beforeText = htmlContent.substring(0, match.index);
      
      // Skip if already inside an <a> tag or inside code/pre blocks
      const lastOpenA = beforeText.lastIndexOf('<a');
      const lastCloseA = beforeText.lastIndexOf('</a>');
      const lastOpenPre = beforeText.lastIndexOf('<pre');
      const lastClosePre = beforeText.lastIndexOf('</pre>');
      const lastOpenCode = beforeText.lastIndexOf('<code');
      const lastCloseCode = beforeText.lastIndexOf('</code>');
      
      // Skip if inside a link (open tag without matching close)
      if (lastOpenA > lastCloseA) {
        continue;
      }
      
      // Skip if inside a <pre> block (open tag without matching close)
      if (lastOpenPre > lastClosePre) {
        continue;
      }
      
      // Skip if inside a <code> block (open tag without matching close)
      // Only check if we found an opening code tag
      if (lastOpenCode !== -1 && lastOpenCode > lastCloseCode) {
        continue;
      }
      
      // Skip if this citation is at the start of a reference paragraph (in References section)
      // Check if we're in the References section and the citation is part of a reference entry
      if (refSectionStart !== -1 && match.index > refSectionStart) {
        // Look backwards to find the nearest opening tag
        const beforeCitation = htmlContent.substring(Math.max(0, match.index - 200), match.index);
        const lastPTagIndex = beforeCitation.lastIndexOf('<p');
        if (lastPTagIndex !== -1) {
          const pTagAndAfter = beforeCitation.substring(lastPTagIndex);
          // Check if this is a reference entry paragraph (has id="ref-X" or class="reference-entry")
          if (/<p[^>]*(id="ref-|class="reference-entry")/.test(pTagAndAfter)) {
            // Extract what's between the <p> tag and the citation
            const pTagMatch = pTagAndAfter.match(/<p[^>]*>/);
            if (pTagMatch) {
              const betweenPAndCitation = pTagAndAfter.substring(pTagMatch[0].length);
              // If there's only whitespace between <p> tag and citation, it's at the start - skip it
              if (/^\s*$/.test(betweenPAndCitation)) {
                continue;
              }
            }
          }
        }
      }
      
      citationMatches.push({
        full: match[0],
        number: match[1],
        index: match.index,
      });
    }
    
    // Replace citations from end to start to preserve indices
    citationMatches.reverse().forEach((citation) => {
      const before = processedHtml.substring(0, citation.index);
      const after = processedHtml.substring(citation.index + citation.full.length);
      const linkHtml = `<a href="#ref-${citation.number}" class="citation-link" data-ref-number="${citation.number}">${citation.full}</a>`;
      processedHtml = before + linkHtml + after;
    });
    
    htmlContent = processedHtml;
    
    return htmlContent;
  }, [content]);

  // Handle citation link clicks
  useEffect(() => {
    const handleCitationClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const citationLink = target.closest('.citation-link') as HTMLAnchorElement;
      
      if (citationLink) {
        e.preventDefault();
        const refNumber = citationLink.getAttribute('data-ref-number');
        if (refNumber) {
          const refId = `ref-${refNumber}`;
          const refElement = document.getElementById(refId);
          if (refElement) {
            // Scroll to the reference
            refElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Highlight the reference temporarily
            refElement.classList.add('reference-highlight');
            setTimeout(() => {
              refElement.classList.remove('reference-highlight');
            }, 2000);
          }
        }
      }
    };

    const container = document.querySelector('.markdown-content');
    if (container) {
      container.addEventListener('click', handleCitationClick as EventListener);
      return () => {
        container.removeEventListener('click', handleCitationClick as EventListener);
      };
    }
  }, [html]);

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
        .markdown-content .citation-link {
          color: #4ec9b0;
          text-decoration: underline;
          cursor: pointer;
          transition: color 0.2s;
        }
        .markdown-content .citation-link:hover {
          color: #6ed4c0;
          text-decoration: underline;
        }
        .markdown-content .reference-entry {
          transition: background-color 0.3s;
        }
        .markdown-content .reference-entry.reference-highlight {
          background-color: rgba(78, 201, 176, 0.2);
          padding: 0.2em 0.4em;
          border-radius: 4px;
          animation: highlight-fade 2s ease-out;
        }
        @keyframes highlight-fade {
          0% {
            background-color: rgba(78, 201, 176, 0.4);
          }
          100% {
            background-color: rgba(78, 201, 176, 0);
          }
        }
      `}</style>
    </div>
  );
}

