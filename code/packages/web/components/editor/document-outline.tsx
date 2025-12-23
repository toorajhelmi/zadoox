'use client';

import { useMemo } from 'react';
import { extractHeadings } from '@zadoox/shared';

interface DocumentOutlineProps {
  content: string;
}

export function DocumentOutline({ content }: DocumentOutlineProps) {
  const headings = useMemo(() => {
    return extractHeadings(content);
  }, [content]);

  if (headings.length === 0) {
    return (
      <div className="p-4 text-sm text-vscode-text-secondary">
        No outline available
      </div>
    );
  }

  const handleHeadingClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    // Scroll to heading in preview (if visible) or editor
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="p-4">
      <nav className="space-y-1">
        {headings.map((heading, index) => (
          <a
            key={`${heading.id}-${index}`}
            href={`#${heading.id}`}
            onClick={(e) => handleHeadingClick(e, heading.id)}
            className="block py-1 px-2 text-sm hover:bg-vscode-active rounded transition-colors text-vscode-text-secondary hover:text-vscode-text"
            style={{ paddingLeft: `${(heading.level - 1) * 0.75 + 0.5}rem` }}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </div>
  );
}

