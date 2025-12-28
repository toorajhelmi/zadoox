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
import type { ResearchSource, CitationFormat } from '@zadoox/shared';

// Generate references section based on citation format
function generateReferencesSection(sources: ResearchSource[], citationFormat: CitationFormat): string {
  let references = '## References\n\n';
  
  sources.forEach((source, index) => {
    let citation = '';
    switch (citationFormat) {
      case 'apa':
        if (source.authors && source.authors.length > 0) {
          citation = `${source.authors.join(', ')} (${source.year || 'n.d.'}). ${source.title}.`;
          if (source.venue) citation += ` ${source.venue}.`;
        } else {
          citation = `${source.title} (${source.year || 'n.d.'}).`;
        }
        break;
      case 'mla':
        if (source.authors && source.authors.length > 0) {
          citation = `${source.authors.join(', ')}. "${source.title}."`;
          if (source.venue) citation += ` ${source.venue},`;
          if (source.year) citation += ` ${source.year}.`;
        } else {
          citation = `"${source.title}."`;
          if (source.venue) citation += ` ${source.venue},`;
          if (source.year) citation += ` ${source.year}.`;
        }
        break;
      case 'chicago':
        if (source.authors && source.authors.length > 0) {
          citation = `${source.authors.join(', ')}. ${source.year || 'n.d.'}. "${source.title}."`;
          if (source.venue) citation += ` ${source.venue}.`;
        } else {
          citation = `${source.year || 'n.d.'}. "${source.title}."`;
          if (source.venue) citation += ` ${source.venue}.`;
        }
        break;
      case 'ieee':
      case 'numbered':
        citation = `[${index + 1}] `;
        if (source.authors && source.authors.length > 0) {
          citation += `${source.authors.join(', ')}, "${source.title},"`;
        } else {
          citation += `"${source.title},"`;
        }
        if (source.venue) citation += ` ${source.venue},`;
        if (source.year) citation += ` ${source.year}.`;
        break;
      case 'footnote':
        if (source.authors && source.authors.length > 0) {
          citation = `${source.authors.join(', ')}, ${source.title}`;
          if (source.venue) citation += ` (${source.venue})`;
          if (source.year) citation += ` (${source.year})`;
        } else {
          citation = source.title;
          if (source.venue) citation += ` (${source.venue})`;
          if (source.year) citation += ` (${source.year})`;
        }
        break;
      default:
        citation = source.title;
        if (source.authors) citation += `, ${source.authors.join(', ')}`;
        if (source.year) citation += ` (${source.year})`;
    }
    references += `${citation}\n`;
  });
  
  return references;
}

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
  const [citationFormat, setCitationFormat] = useState<CitationFormat>('numbered');
  const currentSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null);

  // Load project settings for citation format
  useEffect(() => {
    async function loadProjectSettings() {
      try {
        const project = await api.projects.get(projectId);
        setCitationFormat(project.settings.citationFormat || 'numbered');
      } catch (error) {
        console.error('Failed to load project settings:', error);
      }
    }

    if (projectId) {
      loadProjectSettings();
    }
  }, [projectId]);

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
            projectId={projectId}
            onContentGenerated={async (generatedContent, mode, sources) => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:489',message:'onContentGenerated called',data:{mode,generatedContentLength:generatedContent?.length,sourcesCount:sources?.length,openParagraphId,contentLength:content.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
              // #endregion
              try {
                if (mode === 'citation' || mode === 'summary') {
                  // Get all existing sources from document metadata
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:493',message:'Fetching document for existing sources',data:{documentId:actualDocumentId},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                  // #endregion
                  const document = await api.documents.get(actualDocumentId);
                  const existingSources = (document.metadata?.insertedSources || []) as ResearchSource[];
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:495',message:'Document fetched',data:{existingSourcesCount:existingSources.length,mode},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                  // #endregion
                
                // For citations, number them based on all sources (existing + new)
                let citationText = generatedContent;
                if (mode === 'citation' && sources && sources.length > 0 && (citationFormat === 'numbered' || citationFormat === 'ieee')) {
                  // Replace [?] placeholders with correct numbers
                  const allSources = [...existingSources];
                  const citations: string[] = [];
                  
                  sources.forEach((source) => {
                    // Check if source already exists
                    const existingIndex = allSources.findIndex(s => s.id === source.id);
                    if (existingIndex >= 0) {
                      citations.push(`[${existingIndex + 1}]`);
                    } else {
                      // New source - add to list and use new number
                      allSources.push(source);
                      citations.push(`[${allSources.length}]`);
                    }
                  });
                  
                  citationText = citations.join(', ');
                }
                
                // For citations, use LLM to find relevant positions in the block
                let newContent = content;
                
                if (mode === 'citation' && sources && sources.length > 0) {
                  // Get block content for finding citation positions
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:521',message:'Starting citation insertion',data:{openParagraphId,sourcesCount:sources.length,contentLength:content.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                  // #endregion
                  if (!openParagraphId) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:524',message:'No openParagraphId, returning early',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                    // #endregion
                    return;
                  }
                  const lines = content.split('\n');
                  const match = openParagraphId.match(/^para-(\d+)$/);
                  if (!match) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:527',message:'Invalid paragraphId format',data:{openParagraphId},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                    // #endregion
                    return;
                  }
                  const startLine = parseInt(match[1], 10);
                  if (startLine < 0 || startLine >= lines.length) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:530',message:'startLine out of bounds',data:{startLine,linesLength:lines.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                    // #endregion
                    return;
                  }
                  
                  const isHeading = (line: string) => /^#{1,6}\s/.test(line.trim());
                  let endLine = startLine;
                  if (isHeading(lines[startLine].trim())) {
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
                  
                  const blockLines = lines.slice(startLine, endLine);
                  const blockContent = blockLines.join('\n');
                  
                  // #region agent log
                  // #endregion
                  
                  // Create a map of sourceId -> citation number
                  // First, determine all sources (existing + new) and assign numbers
                  const allSourcesForNumbering = [...existingSources];
                  const citationMap = new Map<string, string>();
                  
                  sources.forEach((source) => {
                    const existingIndex = allSourcesForNumbering.findIndex(s => s.id === source.id);
                    if (existingIndex >= 0) {
                      // Source already exists - use existing number
                      citationMap.set(source.id, `[${existingIndex + 1}]`);
                    } else {
                      // New source - add to list and use new number
                      allSourcesForNumbering.push(source);
                      citationMap.set(source.id, `[${allSourcesForNumbering.length}]`);
                    }
                  });
                  
                  // Use citation context from sources to find insertion locations
                  // Search for the context words in the block content to locate where to insert citations
                  const findCitationPosition = (text: string, context: string | undefined): number => {
                    if (!context || !context.trim()) {
                      // Fallback: use end of block if context is missing
                      return text.trim().length;
                    }
                    
                    const contextTrimmed = context.trim();
                    // Try exact match first (case-sensitive)
                    let index = text.indexOf(contextTrimmed);
                    if (index !== -1) {
                      // Found the context - return position after it (where citation should go)
                      return index + contextTrimmed.length;
                    }
                    
                    // Try case-insensitive match
                    const lowerText = text.toLowerCase();
                    const lowerContext = contextTrimmed.toLowerCase();
                    index = lowerText.indexOf(lowerContext);
                    if (index !== -1) {
                      return index + contextTrimmed.length;
                    }
                    
                    // Try matching just the last few words of the context
                    const contextWords = contextTrimmed.split(/\s+/);
                    if (contextWords.length > 3) {
                      const lastWords = contextWords.slice(-3).join(' ');
                      index = lowerText.indexOf(lastWords.toLowerCase());
                      if (index !== -1) {
                        // Find the end of the last word
                        const fullMatch = text.substring(index, index + lastWords.length);
                        return index + fullMatch.length;
                      }
                    }
                    
                    // Fallback: use end of block
                    console.warn('Could not find citation context in block:', {
                      context: contextTrimmed,
                      blockPreview: text.substring(0, 100),
                    });
                    return text.trim().length;
                  };
                  
                  const sourcesWithPositions = sources
                    .map(s => {
                      const position = findCitationPosition(blockContent, s.citationContext);
                      return {
                        sourceId: s.id,
                        position,
                        citationContext: s.citationContext,
                      };
                    })
                    .sort((a, b) => b.position - a.position); // Sort descending to insert from end to start
                  
                  console.log('Citation insertion:', {
                    blockContent: blockContent.substring(0, 100),
                    blockLength: blockContent.length,
                    sourcesWithPositions: sourcesWithPositions.map(p => ({ 
                      sourceId: p.sourceId, 
                      position: p.position,
                      context: p.citationContext?.substring(0, 30),
                    })),
                    citationMap: Array.from(citationMap.entries()),
                  });
                  
                  // Insert citations at found positions
                  let modifiedBlock = blockContent;
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:601',message:'Starting citation insertion loop',data:{sourcesWithPositionsCount:sourcesWithPositions.length,initialBlockLength:blockContent.length,sourcesWithPositions:sourcesWithPositions.map(p=>({sourceId:p.sourceId,position:p.position,context:p.citationContext?.substring(0,30)}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                  // #endregion
                  for (const pos of sourcesWithPositions) {
                    const citation = citationMap.get(pos.sourceId);
                    if (!citation) {
                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:605',message:'No citation found for sourceId',data:{sourceId:pos.sourceId},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                      // #endregion
                      continue;
                    }
                    
                    // Position should always be valid at this point
                    if (pos.position >= 0 && pos.position <= modifiedBlock.length) {
                      const before = modifiedBlock.slice(0, pos.position);
                      const after = modifiedBlock.slice(pos.position);
                      // Insert citation with space before it (unless already after space/punctuation)
                      const needsSpace = pos.position > 0 && !/\s$/.test(before) && !/[\.,;:!?)\]}]$/.test(before);
                      modifiedBlock = before + (needsSpace ? ' ' : '') + citation + after;
                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:612',message:'Citation inserted',data:{sourceId:pos.sourceId,position:pos.position,citation,modifiedBlockLength:modifiedBlock.length,context:pos.citationContext?.substring(0,30)},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                      // #endregion
                    } else {
                      // Safety fallback: insert at end if position is out of bounds
                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:619',message:'Citation position out of bounds, using fallback',data:{sourceId:pos.sourceId,position:pos.position,blockLength:modifiedBlock.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                      // #endregion
                      console.warn('Citation position out of bounds, inserting at end:', {
                        sourceId: pos.sourceId,
                        position: pos.position,
                        blockLength: modifiedBlock.length,
                      });
                      modifiedBlock = modifiedBlock.trim() + ' ' + citation;
                    }
                  }
                  
                  // Replace block in content
                  const beforeBlock = lines.slice(0, startLine);
                  const afterBlock = lines.slice(endLine);
                  newContent = [...beforeBlock, modifiedBlock, ...afterBlock].join('\n');
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:627',message:'Block replaced in content',data:{beforeBlockLength:beforeBlock.length,afterBlockLength:afterBlock.length,modifiedBlockLength:modifiedBlock.length,newContentLength:newContent.length,originalContentLength:content.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                  // #endregion
                } else {
                  // For summaries, insert at end of paragraph
                  if (!openParagraphId) return;
                  const lines = content.split('\n');
                  const match = openParagraphId.match(/^para-(\d+)$/);
                  if (!match) return;
                  const startLine = parseInt(match[1], 10);
                  if (startLine < 0 || startLine >= lines.length) return;
                  
                  const isHeading = (line: string) => /^#{1,6}\s/.test(line.trim());
                  let endLine = startLine;
                  if (isHeading(lines[startLine].trim())) {
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
                  const beforeLines = lines.slice(0, endLine);
                  const afterLines = lines.slice(endLine);
                  newContent = [...beforeLines, citationText, ...afterLines].join('\n');
                }
                
                // Update document metadata with new sources
                // Initialize updatedSources outside the if block so it's available for saving
                const updatedSources = sources && sources.length > 0
                  ? (() => {
                      const updated = [...existingSources];
                      sources.forEach((source) => {
                        if (!updated.find(s => s.id === source.id)) {
                          updated.push(source);
                        }
                      });
                      return updated;
                    })()
                  : existingSources;
                
                if (sources && sources.length > 0) {
                  // Add/update references section
                  const hasReferences = newContent.includes('## References') || newContent.includes('## Bibliography');
                  
                  if (!hasReferences) {
                    // Add new references section at the end
                    const referencesSection = generateReferencesSection(updatedSources, citationFormat);
                    newContent = newContent + '\n\n' + referencesSection;
                  } else {
                    // Regenerate entire references section with all sources
                    const refMatch = newContent.match(/(## References|## Bibliography)([\s\S]*)$/);
                    if (refMatch) {
                      const beforeRefs = newContent.slice(0, refMatch.index);
                      const referencesSection = generateReferencesSection(updatedSources, citationFormat);
                      const refsText = referencesSection.split('\n').slice(2).join('\n'); // Skip "## References\n\n"
                      newContent = beforeRefs + '## References\n\n' + refsText;
                    }
                  }
                }
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:687',message:'Calling updateContent',data:{newContentLength:newContent.length,originalContentLength:content.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                // #endregion
                updateContent(newContent);
                
                // Save document with updated metadata including insertedSources
                if (sources && sources.length > 0) {
                  const updatedMetadata = {
                    ...document.metadata,
                    insertedSources: updatedSources,
                  };
                  const updatePayload = {
                    content: newContent,
                    metadata: updatedMetadata,
                    changeType: 'ai-action' as const,
                  };
                  // #region agent log
                  // #endregion
                  console.log('Updating document with payload:', JSON.stringify(updatePayload, null, 2).substring(0, 1000));
                  await api.documents.update(actualDocumentId, updatePayload);
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:702',message:'Document saved successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                  // #endregion
                } else {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:704',message:'Saving document without metadata update',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
                  // #endregion
                  await saveDocument(newContent, 'ai-action');
                }
              } else {
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
                const afterLines = lines.slice(endLine);
                
                let newContent: string;
                if (mode === 'replace') {
                  newContent = [...beforeLines, generatedContent, ...afterLines].join('\n');
                } else {
                  // Blend: the AI already blended it, so just use generated content
                  newContent = [...beforeLines, generatedContent, ...afterLines].join('\n');
                }
                
                updateContent(newContent);
                await saveDocument(newContent, 'ai-action');
              }
            } catch (error) {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'editor-layout.tsx:707',message:'Error in content generation',data:{error:error instanceof Error?error.message:String(error),mode},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
              // #endregion
              console.error('Error in content generation:', error);
              throw error;
            }
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

