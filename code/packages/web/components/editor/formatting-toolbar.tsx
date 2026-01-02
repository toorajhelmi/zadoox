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
  viewMode: 'edit' | 'preview' | 'split' | 'ir';
  currentStyle?: 'paragraph' | 'heading1' | 'heading2' | 'heading3';
}

export function FormattingToolbar({ onFormat, viewMode, currentStyle = 'paragraph' }: FormattingToolbarProps) {
  // Only show in edit or split mode
  if (viewMode === 'preview' || viewMode === 'ir') {
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
      {/* Block style (headings) */}
      <div className="mr-2">
        <select
          aria-label="Text style"
          className="h-7 px-2 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHoverBg text-vscode-buttonText rounded border border-vscode-border transition-colors"
          value={currentStyle}
          onChange={(e) => {
            const v = e.target.value as FormatType;
            onFormat(v);
          }}
        >
          <option value="paragraph">Normal</option>
          <option value="heading1">Title</option>
          <option value="heading2">Section</option>
          <option value="heading3">Subsection</option>
        </select>
      </div>

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

