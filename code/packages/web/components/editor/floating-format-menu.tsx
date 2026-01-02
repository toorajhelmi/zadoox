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

interface FloatingFormatMenuProps {
  position: { x: number; y: number };
  onFormat: (format: FormatType) => void;
}

export type FormatType = 
  | 'bold' 
  | 'italic' 
  | 'underline' 
  | 'subscript' 
  | 'superscript' 
  | 'code' 
  | 'link'
  | 'paragraph'
  | 'title'
  | 'heading1'
  | 'heading2'
  | 'heading3';

const FORMAT_OPTIONS: Array<{ type: FormatType; icon: React.ComponentType<{ className?: string }>; label: string; shortcut?: string }> = [
  { type: 'bold', icon: BoldIcon, label: 'Bold', shortcut: 'Cmd+B' },
  { type: 'italic', icon: ItalicIcon, label: 'Italic', shortcut: 'Cmd+I' },
  { type: 'underline', icon: MinusIcon, label: 'Underline', shortcut: 'Cmd+U' },
  { type: 'superscript', icon: ArrowUpIcon, label: 'Superscript', shortcut: 'Cmd+.' },
  { type: 'subscript', icon: ArrowDownIcon, label: 'Subscript', shortcut: 'Cmd+,' },
  { type: 'code', icon: CodeBracketIcon, label: 'Code', shortcut: 'Cmd+`' },
  { type: 'link', icon: LinkIcon, label: 'Link', shortcut: 'Cmd+K' },
];

export function FloatingFormatMenu({ position, onFormat }: FloatingFormatMenuProps) {
  return (
    <div
      className="floating-format-menu fixed z-50 bg-vscode-sidebar border border-vscode-border rounded-lg shadow-lg p-1 flex items-center gap-1"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)',
        marginTop: '-8px',
        pointerEvents: 'auto', // Ensure clicks work
      }}
      onMouseDown={(e) => {
        e.stopPropagation(); // Prevent editor from handling the click
      }}
      onClick={(e) => {
        e.stopPropagation(); // Prevent editor from handling the click
      }}
    >
      {FORMAT_OPTIONS.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.type}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent editor from losing focus
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFormat(option.type);
            }}
            className="p-2 hover:bg-vscode-active rounded transition-colors text-vscode-text-secondary hover:text-vscode-text"
            title={`${option.label} (${option.shortcut || ''})`}
            aria-label={option.label}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}

