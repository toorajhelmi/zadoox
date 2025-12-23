'use client';

import { useState, useCallback, useRef } from 'react';
import { EditorSidebar } from './editor-sidebar';
import { EditorToolbar } from './editor-toolbar';
import { CodeMirrorEditor } from './codemirror-editor';
import { MarkdownPreview } from './markdown-preview';
import { FormattingToolbar } from './formatting-toolbar';
import { useDocumentState } from '@/hooks/use-document-state';
import type { FormatType } from './floating-format-menu';

interface EditorLayoutProps {
  projectId: string;
  documentId: string;
}

type ViewMode = 'edit' | 'preview' | 'split';

export function EditorLayout({ projectId, documentId }: EditorLayoutProps) {
  const { content, documentTitle, updateContent, isSaving, lastSaved } = useDocumentState(documentId, projectId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const currentSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null);

  const handleContentChange = useCallback(
    (value: string) => {
      updateContent(value);
    },
    [updateContent]
  );

  // Handle selection changes from editor
  const handleSelectionChange = useCallback((selection: { from: number; to: number; text: string } | null) => {
    currentSelectionRef.current = selection;
  }, []);

  // Handle formatting from toolbar
  const handleFormat = useCallback((format: FormatType) => {
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
  }, [content, updateContent]);

  return (
    <div className="flex h-screen bg-vscode-bg text-vscode-text">
      {/* Sidebar */}
      <EditorSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        content={content}
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
            <div className={viewMode === 'split' ? 'flex-1 border-r border-vscode-border' : 'flex-1'}>
              <CodeMirrorEditor
                value={content}
                onChange={handleContentChange}
                onSelectionChange={handleSelectionChange}
              />
            </div>
          )}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={viewMode === 'split' ? 'flex-1 overflow-auto' : 'flex-1'}>
              <MarkdownPreview content={content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

