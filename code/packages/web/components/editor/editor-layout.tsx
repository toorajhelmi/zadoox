'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { EditorSidebar } from './editor-sidebar';
import { EditorToolbar } from './editor-toolbar';
import { EditorStatusBar } from './editor-status-bar';
import { AIEnhancedEditor } from './ai-enhanced-editor';
import { MarkdownPreview } from './markdown-preview';
import { FormattingToolbar } from './formatting-toolbar';
import { ThinkModePanel } from './think-mode-panel';
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
  const { content, documentTitle, updateContent, setContentWithoutSave, isSaving, lastSaved, documentId: actualDocumentId, saveDocument, paragraphModes, handleModeToggle: handleModeToggleFromHook } = useDocumentState(documentId, projectId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('outline');
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [latestVersion, setLatestVersion] = useState<number | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ line: number; column: number } | null>(null);
  const [thinkPanelOpen, setThinkPanelOpen] = useState(false);
  const [openParagraphId, setOpenParagraphId] = useState<string | null>(null);
  const currentSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null);

  // Handle opening panel for a paragraph
  const handleOpenPanel = useCallback((paragraphId: string) => {
    setThinkPanelOpen(true);
    setOpenParagraphId(paragraphId);
    // Ensure paragraph is in Think mode
    handleModeToggleFromHook(paragraphId, 'think');
  }, [handleModeToggleFromHook]);

  // Handle closing panel
  const handleClosePanel = useCallback(() => {
    setThinkPanelOpen(false);
    setOpenParagraphId(null);
  }, []);


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

  // Handle keyboard shortcuts (Ctrl+S / Cmd+S for immediate auto-save, Ctrl+T / Cmd+T for mode toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't allow shortcuts if viewing an older version
      // Allow shortcuts if selectedVersion === null (latest) or selectedVersion === latestVersion
      if (selectedVersion !== null && latestVersion !== null && selectedVersion !== latestVersion) {
        return; // Don't allow shortcuts for older versions
      }
      
      // Ctrl+S / Cmd+S for immediate auto-save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Trigger immediate auto-save by calling saveDocument directly
        if (saveDocument) {
          saveDocument(content, 'auto-save');
        }
      }
      
      // Ctrl+T / Cmd+T to open Think panel for paragraph at cursor
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        // Find paragraph at cursor position
        if (cursorPosition && handleOpenPanel) {
          const lines = content.split('\n');
          const cursorLine = cursorPosition.line - 1; // Convert to 0-based
          
          // Find which paragraph contains this line
          let currentParagraph: { startLine: number; text: string } | null = null;
          let paragraphStartLine = 0;
          
          for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            
            if (!trimmed && currentParagraph) {
              // Blank line ends current paragraph
              if (cursorLine >= paragraphStartLine && cursorLine < i) {
                // Cursor is in this paragraph
                const paragraphId = `para-${paragraphStartLine}`;
                handleOpenPanel(paragraphId);
                return;
              }
              currentParagraph = null;
            } else if (trimmed) {
              // Non-empty line - start or continue paragraph
              if (!currentParagraph) {
                currentParagraph = { startLine: i, text: trimmed };
                paragraphStartLine = i;
              } else {
                currentParagraph.text += ' ' + trimmed;
              }
            }
          }
          
          // Check if cursor is in the final paragraph
          if (currentParagraph && cursorLine >= paragraphStartLine) {
            const paragraphId = `para-${paragraphStartLine}`;
            handleOpenPanel(paragraphId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, saveDocument, selectedVersion, latestVersion, cursorPosition, handleOpenPanel]);

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
        <div className="flex-1 overflow-hidden flex relative">
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className={viewMode === 'split' ? 'flex-1 border-r border-vscode-border overflow-hidden relative' : 'flex-1 overflow-hidden relative'}>
              <AIEnhancedEditor
                value={content}
                onChange={handleContentChange}
                onSelectionChange={handleSelectionChange}
                onCursorPositionChange={handleCursorPositionChange}
                model="auto"
                sidebarOpen={sidebarOpen}
                paragraphModes={paragraphModes}
                documentId={actualDocumentId}
                thinkPanelOpen={thinkPanelOpen}
                openParagraphId={openParagraphId}
                onOpenPanel={handleOpenPanel}
                readOnly={(() => {
                  // Disable editing when Think panel is open
                  if (thinkPanelOpen) {
                    return true;
                  }
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
          
          {/* Think Mode Panel - Shows on left when opened */}
          <ThinkModePanel 
            isOpen={thinkPanelOpen}
            onClose={handleClosePanel}
            paragraphId={openParagraphId}
            content={content}
            documentId={actualDocumentId}
            onContentGenerated={async (generatedContent, mode) => {
              // Find the paragraph and replace/blend content
              if (!openParagraphId) return;
              
              const lines = content.split('\n');
              const match = openParagraphId.match(/^para-(\d+)$/);
              if (!match) return;
              
              const startLine = parseInt(match[1], 10);
              if (startLine < 0 || startLine >= lines.length) return;
              
              // Check if section
              const isHeading = (line: string) => /^#{1,6}\s/.test(line.trim());
              const startLineIsHeading = startLine < lines.length && isHeading(lines[startLine].trim());
              
              let endLine = startLine;
              if (startLineIsHeading) {
                endLine = startLine + 1;
                while (endLine < lines.length) {
                  if (isHeading(lines[endLine].trim())) break;
                  endLine++;
                }
              } else {
                while (endLine < lines.length) {
                  const trimmed = lines[endLine].trim();
                  if (!trimmed || isHeading(trimmed)) break;
                  endLine++;
                }
              }
              
              const beforeLines = lines.slice(0, startLine);
              const afterLines = lines.slice(endLine); // endLine is exclusive (first line after block)
              
              let newContent: string;
              if (mode === 'replace' || mode === 'extend') {
                // Replace: use generated content directly
                // Extend: append generated content (handled in frontend)
                if (mode === 'extend') {
                  // Extend: append generated content to the existing block content
                  const currentBlockContent = lines.slice(startLine, endLine).join('\n');
                  newContent = [...beforeLines, currentBlockContent + '\n\n' + generatedContent, ...afterLines].join('\n');
                } else {
                  newContent = [...beforeLines, generatedContent, ...afterLines].join('\n');
                }
              } else {
                // Blend: the AI already returned the complete blended content (existing + new)
                // So we replace the entire block with the blended result
                newContent = [...beforeLines, generatedContent, ...afterLines].join('\n');
              }
              
              updateContent(newContent);
              await saveDocument(newContent, 'ai-action');
            }}
          />
          
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

