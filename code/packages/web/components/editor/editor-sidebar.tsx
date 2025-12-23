'use client';

import { ChevronRightIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { DocumentOutline } from './document-outline';

interface EditorSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  content: string;
}

export function EditorSidebar({ isOpen, onToggle, content }: EditorSidebarProps) {
  return (
    <>
      {/* Collapsed sidebar button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="w-8 bg-vscode-sidebar border-r border-vscode-border hover:bg-vscode-active transition-colors flex items-center justify-center"
          aria-label="Open sidebar"
        >
          <ChevronRightIcon className="w-5 h-5 text-vscode-text-secondary" />
        </button>
      )}

      {/* Expanded sidebar */}
      {isOpen && (
        <div className="w-64 bg-vscode-sidebar border-r border-vscode-border flex flex-col">
          {/* Sidebar header */}
          <div className="h-12 flex items-center px-4 border-b border-vscode-border">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-vscode-text-secondary" />
              <span className="text-sm font-medium text-vscode-text">Outline</span>
            </div>
          </div>

          {/* Document outline */}
          <div className="flex-1 overflow-y-auto">
            <DocumentOutline content={content} />
          </div>
        </div>
      )}
    </>
  );
}

