'use client';

interface ThinkModePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Think Mode Panel
 * Full-height right-side panel that appears when opened
 * Stays open until explicitly closed
 */
export function ThinkModePanel({ isOpen, onClose }: ThinkModePanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-vscode-sidebar border-l border-vscode-border z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border">
        <h2 className="text-sm font-semibold text-vscode-text">Think Mode</h2>
        <button
          onClick={onClose}
          className="text-vscode-text-secondary hover:text-vscode-text transition-colors px-2 py-1 hover:bg-vscode-buttonBg rounded"
          title="Close Think Mode Panel"
        >
          ✕
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Tabs for Think Mode Features */}
          <div className="space-y-2">
            {/* Tab Navigation */}
            <div className="flex gap-1 border-b border-vscode-border">
              <button className="px-3 py-2 text-xs bg-vscode-buttonBg text-vscode-buttonText border-b-2 border-vscode-blue">
                Brainstorm
              </button>
              <button className="px-3 py-2 text-xs text-vscode-text-secondary hover:text-vscode-text hover:bg-vscode-buttonBg">
                Research
              </button>
              <button className="px-3 py-2 text-xs text-vscode-text-secondary hover:text-vscode-text hover:bg-vscode-buttonBg">
                Fragments
              </button>
            </div>

            {/* Tab Content - Brainstorm */}
            <div className="mt-4 space-y-3">
              <div className="text-xs text-vscode-text-secondary">
                <p>Use this space to brainstorm ideas, create mind maps, and organize thoughts for your paragraphs.</p>
              </div>
              
              {/* Placeholder for brainstorming tools */}
              <div className="bg-vscode-editorBg border border-vscode-border rounded p-3 min-h-32">
                <div className="text-xs text-vscode-text-secondary text-center">
                  Brainstorming tools coming soon...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

