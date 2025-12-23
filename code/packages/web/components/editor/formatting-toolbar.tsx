'use client';

import { 
  BoldIcon, 
  ItalicIcon, 
  CodeBracketIcon,
  LinkIcon,
  MinusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import type { FormatType } from './floating-format-menu';

interface FormattingToolbarProps {
  onFormat: (format: FormatType) => void;
  viewMode: 'edit' | 'preview' | 'split';
}

export function FormattingToolbar({ onFormat, viewMode }: FormattingToolbarProps) {
  // Only show in edit or split mode
  if (viewMode === 'preview') {
    return null;
  }

  const formatButtons: Array<{ type: FormatType; icon: React.ComponentType<{ className?: string }>; label: string }> = [
    { type: 'bold', icon: BoldIcon, label: 'Bold' },
    { type: 'italic', icon: ItalicIcon, label: 'Italic' },
    { type: 'underline', icon: MinusIcon, label: 'Underline' },
    { type: 'superscript', icon: ArrowUpIcon, label: 'Superscript' },
    { type: 'subscript', icon: ArrowDownIcon, label: 'Subscript' },
    { type: 'code', icon: CodeBracketIcon, label: 'Code' },
    { type: 'link', icon: LinkIcon, label: 'Link' },
  ];

  return (
    <div className="h-10 bg-vscode-sidebar border-b border-vscode-border flex items-center gap-1 px-3">
      {formatButtons.map((button) => {
        const Icon = button.icon;
        return (
          <button
            key={button.type}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFormat(button.type);
            }}
            className="p-1.5 hover:bg-vscode-active rounded transition-colors text-vscode-text-secondary hover:text-vscode-text"
            title={button.label}
            aria-label={button.label}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}

