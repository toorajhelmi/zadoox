'use client';

import { useMemo } from 'react';
import { extractOutlineItems } from '@zadoox/shared';

interface DocumentOutlineProps {
  content: string;
}

export function DocumentOutline({ content }: DocumentOutlineProps) {
  const items = useMemo(() => {
    return extractOutlineItems(content);
  }, [content]);

  if (items.length === 0) {
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
        {items.map((item, index) => {
          if (item.kind === 'heading') {
            return (
              <a
                key={`heading-${item.id}-${index}`}
                href={`#${item.id}`}
                onClick={(e) => handleHeadingClick(e, item.id)}
                className="block py-1 px-2 text-sm hover:bg-vscode-active rounded transition-colors text-vscode-text-secondary hover:text-vscode-text"
                style={{ paddingLeft: `${(item.level - 1) * 0.75 + 0.5}rem` }}
              >
                {item.text}
              </a>
            );
          }

          return (
            <a
              key={`figure-${item.id}-${index}`}
              href={`#${item.id}`}
              onClick={(e) => handleHeadingClick(e, item.id)}
              className="block py-1 px-2 text-sm hover:bg-vscode-active rounded transition-colors text-vscode-text-secondary hover:text-vscode-text"
              style={{ paddingLeft: `1.25rem` }}
              title={item.caption || undefined}
            >
              <span className="opacity-80">{item.text}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}

