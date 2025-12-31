'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { BrainstormTab } from './brainstorm-tab';
import { ResearchTab } from './research-tab';
import { DraftTab } from './draft-tab';
import { api } from '@/lib/api/client';
import type { BrainstormingSession, ResearchSession, DocumentStyle, CitationFormat } from '@zadoox/shared';

const DEFAULT_WIDTH = 320; // 80 * 4 (w-80 = 320px)
const MIN_WIDTH = 240;
const MAX_WIDTH = 800;

interface ThinkModePanelProps {
  isOpen: boolean;
  onClose: () => void;
  paragraphId: string | null;
  content: string;
  documentId: string;
  projectId: string;
  onContentGenerated: (
    content: string,
    mode: 'blend' | 'replace' | 'lead' | 'conclude' | 'extend' | 'citation' | 'summary',
    sources?: unknown[],
    scope?: 'block' | 'document'
  ) => void;
  onGeneratingChange?: (isGenerating: boolean) => void;
}

// Helper to check if a line is a markdown heading
function isHeading(line: string): boolean {
  const trimmed = line.trim();
  return /^#{1,6}\s/.test(trimmed);
}

// Get paragraph and section information
function getParagraphInfo(paragraphId: string | null, content: string): {
  blockContent: string;
  sectionHeading?: string;
  sectionContent?: string;
} {
  if (!paragraphId) {
    return { blockContent: '' };
  }

  const lines = content.split('\n');
  const match = paragraphId.match(/^para-(\d+)$/);
  if (!match) {
    return { blockContent: '' };
  }

  const startLine = parseInt(match[1], 10);
  if (startLine < 0 || startLine >= lines.length) {
    return { blockContent: '' };
  }

  // Check if this is a section (starts with heading)
  const startLineIsHeading = isHeading(lines[startLine].trim());
  
  let endLine = startLine;
  if (startLineIsHeading) {
    // For sections, include all content until next heading
    endLine = startLine + 1;
    while (endLine < lines.length) {
      const trimmed = lines[endLine].trim();
      if (isHeading(trimmed)) {
        break;
      }
      endLine++;
    }
  } else {
    // For regular paragraphs, find until next empty line or heading
    while (endLine < lines.length) {
      const trimmed = lines[endLine].trim();
      if (!trimmed) {
        break;
      }
      if (isHeading(trimmed)) {
        break;
      }
      endLine++;
    }
  }

  const blockContent = lines.slice(startLine, endLine).join('\n');
  
  if (startLineIsHeading) {
    const sectionHeading = lines[startLine];
    const sectionContent = lines.slice(startLine, endLine).join('\n');
    return {
      blockContent,
      sectionHeading,
      sectionContent,
    };
  }

  return { blockContent };
}

function makeBlockSnippet(blockContent: string, maxWords = 12): string {
  const normalized = blockContent
    .replace(/\s+/g, ' ')
    .replace(/^#{1,6}\s+/, '') // drop leading markdown heading markers for display
    .trim();

  if (!normalized) return '';
  const words = normalized.split(' ').filter(Boolean);
  const snippet = words.slice(0, maxWords).join(' ');
  return words.length > maxWords ? `${snippet}…` : snippet;
}

function TabLabelWithInfo({
  label,
  tooltip,
  isActive,
}: {
  label: string;
  tooltip: string;
  isActive: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <span className="relative group inline-flex items-center">
        <span
          aria-label={`${label} info`}
          className={`ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full border text-[10px] leading-none ${
            isActive
              ? 'border-vscode-blue text-vscode-blue'
              : 'border-gray-600 text-gray-400 group-hover:text-gray-200 group-hover:border-gray-500'
          }`}
        >
          i
        </span>
        <span className="pointer-events-none absolute left-1/2 top-full mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 border border-gray-700 px-2 py-1 text-[11px] text-gray-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
          {tooltip}
        </span>
      </span>
    </span>
  );
}

/**
 * Think Mode Panel
 * Full-height left-side panel that appears when opened
 * Stays open until explicitly closed
 */
export function ThinkModePanel({
  isOpen,
  onClose,
  paragraphId,
  content,
  documentId,
  projectId,
  onContentGenerated,
  onGeneratingChange,
}: ThinkModePanelProps) {
  const [activeTab, setActiveTab] = useState<'brainstorm' | 'research' | 'draft'>('brainstorm');
  const [targetScope, setTargetScope] = useState<'block' | 'document'>('block');
  const [session, setSession] = useState<BrainstormingSession | null>(null);
  const [researchSession, setResearchSession] = useState<ResearchSession | null>(null);
  const [documentStyle, setDocumentStyle] = useState<DocumentStyle>('other');
  const [citationFormat, setCitationFormat] = useState<CitationFormat>('numbered');
  const [width, setWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('think-panel-width');
      return saved ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parseInt(saved, 10))) : DEFAULT_WIDTH;
    }
    return DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const paragraphInfo = useMemo(() => {
    if (!paragraphId) return { blockContent: '', sectionHeading: undefined, sectionContent: undefined };
    return getParagraphInfo(paragraphId, content);
  }, [paragraphId, content]);

  const targetContentForContext = useMemo(() => {
    return targetScope === 'document' ? content : paragraphInfo.blockContent;
  }, [targetScope, content, paragraphInfo.blockContent]);

  const blockSnippet = useMemo(() => makeBlockSnippet(paragraphInfo.blockContent), [paragraphInfo.blockContent]);
  const docSnippet = useMemo(() => makeBlockSnippet(content), [content]);
  const targetSnippet = targetScope === 'document' ? docSnippet : blockSnippet;
  const effectiveParagraphId = targetScope === 'document' ? 'doc' : paragraphId;

  // Load project settings
  useEffect(() => {
    let cancelled = false;
    async function loadProjectSettings() {
      try {
        const project = await api.projects.get(projectId);
        if (cancelled) return;
        setDocumentStyle(project.settings.documentStyle || 'other');
        setCitationFormat(project.settings.citationFormat || 'numbered');
      } catch (error) {
        console.error('Failed to load project settings:', error);
      }
    }

    if (projectId) {
      loadProjectSettings();
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Load brainstorming session from document metadata when paragraph changes
  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      if (!paragraphId || !documentId) {
        if (!cancelled) setSession(null);
        return;
      }

      try {
        const document = await api.documents.get(documentId);
        if (cancelled) return;
        const sessions = document.metadata?.brainstormingSessions || {};
        const existingSession = sessions[paragraphId];
        if (existingSession) {
          setSession(existingSession);
        } else {
          setSession(null);
        }
      } catch (error) {
        console.error('Failed to load brainstorming session:', error);
        if (!cancelled) setSession(null);
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [paragraphId, documentId]);

  // Load research session from document metadata when paragraph changes
  useEffect(() => {
    let cancelled = false;
    async function loadResearchSession() {
      if (!paragraphId || !documentId) {
        if (!cancelled) setResearchSession(null);
        return;
      }

      try {
        const document = await api.documents.get(documentId);
        if (cancelled) return;
        const sessions = document.metadata?.researchSessions || {};
        const existingSession = sessions[paragraphId];
        if (existingSession) {
          setResearchSession(existingSession);
        } else {
          setResearchSession(null);
        }
      } catch (error) {
        console.error('Failed to load research session:', error);
        if (!cancelled) setResearchSession(null);
      }
    }

    loadResearchSession();

    return () => {
      cancelled = true;
    };
  }, [paragraphId, documentId]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const newWidth = e.clientX;
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      setWidth(clampedWidth);
      localStorage.setItem('think-panel-width', clampedWidth.toString());
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (!isOpen || !paragraphId) {
    return null;
  }

  const handleSessionUpdate = (updatedSession: BrainstormingSession) => {
    setSession(updatedSession);
  };

  const handleContentGenerated = (
    generatedContent: string,
    mode: 'blend' | 'replace' | 'lead' | 'conclude' | 'extend' | 'citation' | 'summary',
    sources?: unknown[]
  ) => {
    onContentGenerated(generatedContent, mode, sources, targetScope);
    // Auto-close the panel after content is generated
    if (mode === 'blend' || mode === 'replace' || mode === 'lead' || mode === 'conclude' || mode === 'extend' || mode === 'citation' || mode === 'summary') {
      onClose();
    }
  };

  const handleDraftContentGenerated = (generatedContent: string, mode: 'blend' | 'replace' | 'lead' | 'conclude' | 'extend') => {
    handleContentGenerated(generatedContent, mode);
  };

  const handleReset = () => {
    // Reload session (will be empty after reset)
    setSession(null);
  };

  const handleResearchReset = () => {
    // Reload research session (will be empty after reset)
    setResearchSession(null);
  };

  const handleResearchSessionUpdate = (updatedSession: ResearchSession) => {
    setResearchSession(updatedSession);
  };

  return (
    <div
      ref={panelRef}
      className="fixed left-0 top-0 h-full z-50 flex flex-col shadow-2xl bg-black border-r border-vscode-border"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-vscode-blue transition-colors z-10 ${
          isResizing ? 'bg-vscode-blue' : ''
        }`}
        style={{ userSelect: 'none' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border bg-black">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center bg-gray-900 border border-gray-700 rounded overflow-hidden shrink-0 whitespace-nowrap">
              <span className="px-2 py-1 text-[10px] text-gray-400 border-r border-gray-700">
                Scope
              </span>
              <button
                type="button"
                onClick={() => setTargetScope('block')}
                className={`px-2 py-1 text-[11px] leading-none transition-colors ${
                  targetScope === 'block' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`}
                title="Apply actions to the selected block"
              >
                Block
              </button>
              <button
                type="button"
                onClick={() => setTargetScope('document')}
                className={`px-2 py-1 text-[11px] leading-none transition-colors ${
                  targetScope === 'document' ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`}
                title="Apply actions to the whole document"
              >
                Whole doc
              </button>
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-white leading-tight">
              Let&apos;s think about
            </div>
            {targetScope === 'block' && targetSnippet && (
              <div className="text-[11px] text-gray-400 leading-tight whitespace-normal break-words">
                {targetSnippet}
              </div>
            )}
            {targetScope === 'document' && (
              <div className="text-[11px] text-gray-400 leading-tight whitespace-normal break-words">
                Whole doc
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors px-2 py-1 hover:bg-gray-800 rounded"
          title="Close Think Mode Panel"
        >
          ✕
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-vscode-border px-4 bg-black">
        <button
          onClick={() => setActiveTab('brainstorm')}
          className={`px-3 py-2 text-xs transition-colors ${
            activeTab === 'brainstorm'
              ? 'bg-gray-800 text-white border-b-2 border-vscode-blue'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <TabLabelWithInfo
            label="Brainstorm"
            isActive={activeTab === 'brainstorm'}
            tooltip='Chat to explore angles and extract idea cards. Use an idea card to generate text. Scope toggle controls whether actions apply to the selected block or the whole document.'
          />
        </button>
        <button
          onClick={() => setActiveTab('research')}
          className={`px-3 py-2 text-xs transition-colors ${
            activeTab === 'research'
              ? 'bg-gray-800 text-white border-b-2 border-vscode-blue'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <TabLabelWithInfo
            label="Research"
            isActive={activeTab === 'research'}
            tooltip='Search and collect sources, then insert citations or summaries into your writing. Scope toggle controls whether insertions apply to the selected block or the whole document.'
          />
        </button>
        <button
          onClick={() => setActiveTab('draft')}
          className={`px-3 py-2 text-xs transition-colors ${
            activeTab === 'draft'
              ? 'bg-gray-800 text-white border-b-2 border-vscode-blue'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <TabLabelWithInfo
            label="Draft"
            isActive={activeTab === 'draft'}
            tooltip='Paste rough notes and transform them into polished text, then insert via Blend/Replace/Lead/Conclude. Scope toggle controls whether insertions apply to the selected block or the whole document.'
          />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'brainstorm' && (
          <BrainstormTab
            paragraphId={effectiveParagraphId || 'doc'}
            blockContent={targetContentForContext}
            sectionHeading={targetScope === 'block' ? paragraphInfo.sectionHeading : undefined}
            sectionContent={targetScope === 'block' ? paragraphInfo.sectionContent : undefined}
            documentId={documentId}
            onContentGenerated={handleContentGenerated}
            onSessionUpdate={handleSessionUpdate}
            initialSession={session}
            onReset={handleReset}
            onGeneratingChange={onGeneratingChange}
          />
        )}
        {activeTab === 'research' && (
          <ResearchTab
            paragraphId={effectiveParagraphId || 'doc'}
            blockContent={targetContentForContext}
            sectionHeading={targetScope === 'block' ? paragraphInfo.sectionHeading : undefined}
            sectionContent={targetScope === 'block' ? paragraphInfo.sectionContent : undefined}
            documentId={documentId}
            projectId={projectId}
            documentStyle={documentStyle}
            citationFormat={citationFormat}
            onContentGenerated={handleContentGenerated}
            onSessionUpdate={handleResearchSessionUpdate}
            initialSession={researchSession}
            onReset={handleResearchReset}
            onClose={onClose}
          />
        )}
        {activeTab === 'draft' && (
          <DraftTab
            paragraphId={effectiveParagraphId || 'doc'}
            blockContent={targetContentForContext}
            sectionHeading={targetScope === 'block' ? paragraphInfo.sectionHeading : undefined}
            sectionContent={targetScope === 'block' ? paragraphInfo.sectionContent : undefined}
            documentId={documentId}
            onContentGenerated={handleDraftContentGenerated}
          />
        )}
      </div>
    </div>
  );
}

