'use client';

import { useState } from 'react';
import { ChevronRightIcon, ChevronLeftIcon, DocumentTextIcon, ClockIcon } from '@heroicons/react/24/outline';
import { DocumentOutline } from './document-outline';
import { VersionHistoryPanel } from './version-history-panel';

type SidebarTab = 'outline' | 'history';

interface EditorSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  content: string;
  ir?: import('@zadoox/shared').DocumentNode | null;
  projectName?: string;
  projectId?: string;
  documentId?: string;
  onRollback?: (versionNumber: number) => Promise<void>;
  onVersionSelect?: (versionNumber: number) => Promise<void>;
  lastSaved?: Date | null;
  activeTab?: SidebarTab;
  onTabChange?: (tab: SidebarTab) => void;
}

export function EditorSidebar({ isOpen, onToggle, content, ir, projectName, projectId, documentId, onRollback, onVersionSelect, lastSaved, activeTab: externalActiveTab, onTabChange }: EditorSidebarProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<SidebarTab>('outline');
  const activeTab = externalActiveTab ?? internalActiveTab;
  const resolvedDocumentId = documentId;
  
  const handleTabChange = (tab: SidebarTab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  return (
    <>
      {/* Expanded sidebar */}
      {isOpen && (
        <div className="h-full bg-vscode-sidebar flex flex-col relative">
          {/* Sidebar header with tabs */}
          <div className="h-12 flex items-center border-b border-vscode-border">
            <button
              onClick={() => handleTabChange('outline')}
              className={`flex-1 h-full flex items-center justify-center gap-2 px-4 transition-colors ${
                activeTab === 'outline'
                  ? 'bg-vscode-active text-vscode-text border-b-2 border-vscode-button'
                  : 'text-vscode-text-secondary hover:text-vscode-text hover:bg-vscode-hover'
              }`}
            >
              <DocumentTextIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Outline</span>
            </button>
            {resolvedDocumentId && (
              <button
                onClick={() => handleTabChange('history')}
                className={`flex-1 h-full flex items-center justify-center gap-2 px-4 transition-colors ${
                  activeTab === 'history'
                    ? 'bg-vscode-active text-vscode-text border-b-2 border-vscode-button'
                    : 'text-vscode-text-secondary hover:text-vscode-text hover:bg-vscode-hover'
                }`}
              >
                <ClockIcon className="w-4 h-4" />
                <span className="text-sm font-medium">History</span>
              </button>
            )}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'outline' && (
              <DocumentOutline
                content={content}
                ir={ir}
                projectName={projectName}
                projectId={projectId}
                currentDocumentId={resolvedDocumentId}
              />
            )}
            {activeTab === 'history' && resolvedDocumentId && onRollback && (
              <VersionHistoryPanel
                documentId={resolvedDocumentId}
                onRollback={onRollback}
                onVersionSelect={onVersionSelect}
                refreshTrigger={lastSaved}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

