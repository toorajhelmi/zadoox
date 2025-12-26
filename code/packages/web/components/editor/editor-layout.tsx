'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { EditorSidebar } from './editor-sidebar';
import { EditorToolbar } from './editor-toolbar';
import { EditorStatusBar } from './editor-status-bar';
import { AIEnhancedEditor } from './ai-enhanced-editor';
import { MarkdownPreview } from './markdown-preview';
import { FormattingToolbar } from './formatting-toolbar';
import { useDocumentState } from '@/hooks/use-document-state';
import { api } from '@/lib/api/client';
import type { FormatType } from './floating-format-menu';

interface EditorLayoutProps {
  projectId: string;
  documentId: string;
}

type ViewMode = 'edit' | 'preview' | 'split';

type SidebarTab = 'outline' | 'history';

export function EditorLayout({ projectId, documentId }: EditorLayoutProps) {
  const { content, documentTitle, updateContent, setContentWithoutSave, isSaving, lastSaved, documentId: actualDocumentId, saveDocument } = useDocumentState(documentId, projectId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('outline');
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [latestVersion, setLatestVersion] = useState<number | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ line: number; column: number } | null>(null);
  const currentSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null);

  // Load version metadata to determine latest version
  useEffect(() => {
    if (!actualDocumentId || actualDocumentId === 'default') return;

    async function loadMetadata() {
      try {
        const metadata = await api.versions.getMetadata(actualDocumentId);
        let newLatestVersion: number | null = null;
        
        // Check if currentVersion exists and is valid
        if (metadata.currentVersion !== undefined && metadata.currentVersion !== null) {
          newLatestVersion = Number(metadata.currentVersion);
        } else {
          // Fallback: get latest from versions list
          const versions = await api.versions.list(actualDocumentId, 1, 0);
          if (versions.length > 0) {
            newLatestVersion = versions[0].versionNumber;
          }
        }
        
        if (newLatestVersion !== null) {
          // If the latest version changed and we were viewing the latest, update to new latest
          if (latestVersion !== null && newLatestVersion > latestVersion && selectedVersion === null) {
            // New version was created while viewing the latest - stay on latest
            setLatestVersion(newLatestVersion);
            setSelectedVersion(null); // Ensure we're still viewing the latest
          } else if (latestVersion !== null && newLatestVersion > latestVersion && selectedVersion !== null) {
            // New version was created while viewing an older version - keep viewing that older version (read-only)
            setLatestVersion(newLatestVersion);
            // Don't change selectedVersion - keep it read-only
          } else {
            setLatestVersion(newLatestVersion);
          }
        }
      } catch (error) {
        console.error('Failed to load version metadata:', error);
        // Fallback: try to get latest from versions list
        try {
          const versions = await api.versions.list(actualDocumentId, 1, 0);
          if (versions.length > 0) {
            setLatestVersion(versions[0].versionNumber);
          }
        } catch (listError) {
          console.error('Failed to fetch versions list:', listError);
        }
      }
    }

    loadMetadata();
  }, [actualDocumentId, lastSaved?.getTime()]); // Reload when lastSaved changes (new version created)

  const handleContentChange = useCallback(
    (value: string) => {
      const safeLatestVersion = latestVersion ?? null;
      // Only allow editing if viewing the latest version
      // selectedVersion === null means latest, or selectedVersion === latestVersion means latest
      if (selectedVersion !== null) {
        // If a specific version is selected, check if it's the latest (type-safe comparison)
        if (safeLatestVersion === null || Number(selectedVersion) !== Number(safeLatestVersion)) {
          return; // Don't allow editing older versions
        }
        // If selectedVersion === latestVersion, allow editing (fall through)
      }
      // If selectedVersion === null, allow editing (fall through)
      updateContent(value);
    },
    [updateContent, selectedVersion, latestVersion]
  );

  // Handle selection changes from editor
  const handleSelectionChange = useCallback((selection: { from: number; to: number; text: string } | null) => {
    currentSelectionRef.current = selection;
  }, []);

  // Handle cursor position changes from editor
  const handleCursorPositionChange = useCallback((position: { line: number; column: number } | null) => {
    setCursorPosition(position);
  }, []);

  // Handle keyboard shortcuts (Ctrl+S / Cmd+S for immediate auto-save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't allow save if viewing an older version
      // Allow save if selectedVersion === null (latest) or selectedVersion === latestVersion
      if (selectedVersion !== null && latestVersion !== null && selectedVersion !== latestVersion) {
        return; // Don't allow saving older versions
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Trigger immediate auto-save by calling saveDocument directly
        if (saveDocument) {
          saveDocument(content, 'auto-save');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, saveDocument, selectedVersion, latestVersion]);

  // Handle formatting from toolbar
  const handleFormat = useCallback((format: FormatType) => {
    // Don't allow formatting if viewing an older version
    // Allow formatting if selectedVersion === null (latest) or selectedVersion === latestVersion
    if (selectedVersion !== null && latestVersion !== null && selectedVersion !== latestVersion) {
      return; // Don't allow formatting older versions
    }
    
    const selection = currentSelectionRef.current;
    
    if (selection && selection.text) {
      // Format selected text using exact positions
      let formattedText = '';
      switch (format) {
        case 'bold':
          formattedText = `**${selection.text}**`;
          break;
        case 'italic':
          formattedText = `*${selection.text}*`;
          break;
        case 'underline':
          formattedText = `<u>${selection.text}</u>`;
          break;
        case 'superscript':
          formattedText = `<sup>${selection.text}</sup>`;
          break;
        case 'subscript':
          formattedText = `<sub>${selection.text}</sub>`;
          break;
        case 'code':
          formattedText = `\`${selection.text}\``;
          break;
        case 'link':
          formattedText = `[${selection.text}](url)`;
          break;
      }

      // Replace using exact positions from CodeMirror
      const newContent = 
        content.slice(0, selection.from) + 
        formattedText + 
        content.slice(selection.to);
      updateContent(newContent);
    } else {
      // No selection - insert placeholder at end (for now)
      let placeholder = '';
      switch (format) {
        case 'bold':
          placeholder = '****';
          break;
        case 'italic':
          placeholder = '**';
          break;
        case 'underline':
          placeholder = '<u></u>';
          break;
        case 'superscript':
          placeholder = '<sup></sup>';
          break;
        case 'subscript':
          placeholder = '<sub></sub>';
          break;
        case 'code':
          placeholder = '``';
          break;
        case 'link':
          placeholder = '[]()';
          break;
      }
      // Insert at end (could be improved to insert at cursor)
      const newContent = content + placeholder;
      updateContent(newContent);
    }
  }, [content, updateContent, selectedVersion, latestVersion]);

  return (
    <div className="flex h-screen bg-vscode-bg text-vscode-text">
      {/* Sidebar */}
      <EditorSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        content={content}
        documentId={actualDocumentId}
        lastSaved={lastSaved}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        onRollback={async (versionNumber: number) => {
          const content = await api.versions.reconstruct(actualDocumentId, versionNumber);
          setSelectedVersion(null); // Reset to latest after rollback
          updateContent(content);
        }}
        onVersionSelect={async (versionNumber: number) => {
          const content = await api.versions.reconstruct(actualDocumentId, versionNumber);
          
          // Always fetch latest version metadata to ensure we have the current latest
          let currentLatestVersion: number | null = latestVersion ?? null;
          try {
            const metadata = await api.versions.getMetadata(actualDocumentId);
            // Check if currentVersion exists and is valid
            if (metadata.currentVersion !== undefined && metadata.currentVersion !== null) {
              currentLatestVersion = Number(metadata.currentVersion);
            } else {
              // Metadata exists but currentVersion is missing - fall back to versions list
              const versions = await api.versions.list(actualDocumentId, 1, 0);
              if (versions.length > 0) {
                currentLatestVersion = versions[0].versionNumber; // First version is latest (sorted DESC)
              }
            }
            // Update latestVersion state
            setLatestVersion(currentLatestVersion);
          } catch (error) {
            console.error('Failed to fetch version metadata:', error);
            // Fallback: try to get latest from versions list
            try {
              const versions = await api.versions.list(actualDocumentId, 1, 0);
              if (versions.length > 0) {
                currentLatestVersion = versions[0].versionNumber;
                setLatestVersion(currentLatestVersion);
              }
            } catch (listError) {
              console.error('Failed to fetch versions list:', listError);
            }
          }
          
          // If selecting the latest version, reset to null to enable editing
          // Use Number() to ensure type-safe comparison
          if (currentLatestVersion !== null && Number(versionNumber) === Number(currentLatestVersion)) {
            // This is the latest version - set to null to enable editing
            setSelectedVersion(null);
            // Use updateContent to allow editing
            updateContent(content);
          } else {
            // This is an older version - set selectedVersion and make read-only
            setSelectedVersion(versionNumber);
            // Use setContentWithoutSave to prevent auto-save
            setContentWithoutSave(content);
          }
        }}
      />

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <EditorToolbar
          projectId={projectId}
          documentTitle={documentTitle}
          isSaving={isSaving}
          lastSaved={lastSaved}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Formatting Toolbar */}
        <FormattingToolbar
          onFormat={handleFormat}
          viewMode={viewMode}
        />

        {/* Editor/Preview */}
        <div className="flex-1 overflow-hidden flex">
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className={viewMode === 'split' ? 'flex-1 border-r border-vscode-border overflow-hidden' : 'flex-1 overflow-hidden'}>
              <AIEnhancedEditor
                value={content}
                onChange={handleContentChange}
                onSelectionChange={handleSelectionChange}
                onCursorPositionChange={handleCursorPositionChange}
                model="auto"
                sidebarOpen={sidebarOpen}
                readOnly={(() => {
                  // Handle undefined/null latestVersion and ensure it's a valid number
                  let safeLatestVersion: number | null = null;
                  if (latestVersion !== undefined && latestVersion !== null && !isNaN(Number(latestVersion))) {
                    safeLatestVersion = Number(latestVersion);
                  }
                  const isReadOnly = selectedVersion !== null && 
                                    safeLatestVersion !== null && 
                                    Number(selectedVersion) !== Number(safeLatestVersion);
                  return isReadOnly;
                })()}
                onSaveWithType={async (contentToSave, changeType) => {
                  await saveDocument(contentToSave, changeType);
                }}
              />
            </div>
          )}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={viewMode === 'split' ? 'flex-1 overflow-auto' : 'flex-1'}>
              <MarkdownPreview content={content} />
            </div>
          )}
        </div>

        {/* Status Bar */}
        <EditorStatusBar
          isSaving={isSaving}
          lastSaved={lastSaved}
          content={content}
          cursorPosition={cursorPosition}
        />
      </div>
    </div>
  );
}

