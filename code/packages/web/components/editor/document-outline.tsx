'use client';

import { useMemo } from 'react';
import { extractOutlineItemsFromIr, parseXmdToIr, type DocumentNode } from '@zadoox/shared';
import { DocumentTextIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface DocumentOutlineProps {
  content: string;
  ir?: DocumentNode | null;
}

export function DocumentOutline({ content, ir }: DocumentOutlineProps) {
  const items = useMemo(() => {
    // Phase 11: outline is IR-driven.
    const derived = ir ?? parseXmdToIr({ docId: 'outline-doc', xmd: content });
    return extractOutlineItemsFromIr(derived);
  }, [content, ir]);

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
                className="flex items-center gap-2 py-1 px-2 text-sm hover:bg-vscode-active rounded transition-colors text-vscode-text-secondary hover:text-vscode-text"
                style={{ paddingLeft: `${(item.level - 1) * 0.75 + 0.5}rem` }}
              >
                <DocumentTextIcon className="w-4 h-4 opacity-60 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{item.text}</span>
              </a>
            );
          }

          return (
            <a
              key={`figure-${item.id}-${index}`}
              href={`#${item.id}`}
              onClick={(e) => handleHeadingClick(e, item.id)}
              className="flex items-center gap-2 py-1 px-2 text-sm hover:bg-vscode-active rounded transition-colors text-vscode-text-secondary hover:text-vscode-text"
              style={{ paddingLeft: `1.25rem` }}
              title={item.caption || undefined}
            >
              <PhotoIcon className="w-4 h-4 opacity-60 flex-shrink-0" aria-hidden="true" />
              <span className="opacity-80 truncate">{item.text}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}

