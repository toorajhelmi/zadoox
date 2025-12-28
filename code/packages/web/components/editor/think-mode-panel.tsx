'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { BrainstormTab } from './brainstorm-tab';
import { ResearchTab } from './research-tab';
import { api } from '@/lib/api/client';
import type { BrainstormingSession, ResearchSession, DocumentStyle, CitationFormat, ResearchSource } from '@zadoox/shared';

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
  onContentGenerated: (content: string, mode: 'blend' | 'replace' | 'citation' | 'summary', sources?: ResearchSource[]) => void;
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
}: ThinkModePanelProps) {
  const [activeTab, setActiveTab] = useState<'brainstorm' | 'research' | 'fragments'>('brainstorm');
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

  // Load project settings
  useEffect(() => {
    async function loadProjectSettings() {
      try {
        const project = await api.projects.get(projectId);
        setDocumentStyle(project.settings.documentStyle || 'other');
        setCitationFormat(project.settings.citationFormat || 'numbered');
      } catch (error) {
        console.error('Failed to load project settings:', error);
      }
    }

    if (projectId) {
      loadProjectSettings();
    }
  }, [projectId]);

  // Load brainstorming session from document metadata when paragraph changes
  useEffect(() => {
    async function loadSession() {
      if (!paragraphId || !documentId) {
        setSession(null);
        return;
      }

      try {
        const document = await api.documents.get(documentId);
        const sessions = document.metadata?.brainstormingSessions || {};
        const existingSession = sessions[paragraphId];
        if (existingSession) {
          setSession(existingSession);
        } else {
          setSession(null);
        }
      } catch (error) {
        console.error('Failed to load brainstorming session:', error);
        setSession(null);
      }
    }

    loadSession();
  }, [paragraphId, documentId]);

  // Load research session from document metadata when paragraph changes
  useEffect(() => {
    async function loadResearchSession() {
      if (!paragraphId || !documentId) {
        setResearchSession(null);
        return;
      }

      try {
        const document = await api.documents.get(documentId);
        const sessions = document.metadata?.researchSessions || {};
        const existingSession = sessions[paragraphId];
        if (existingSession) {
          setResearchSession(existingSession);
        } else {
          setResearchSession(null);
        }
      } catch (error) {
        console.error('Failed to load research session:', error);
        setResearchSession(null);
      }
    }

    loadResearchSession();
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

  const handleContentGenerated = (generatedContent: string, mode: 'blend' | 'replace' | 'citation' | 'summary', sources?: ResearchSource[]) => {
    onContentGenerated(generatedContent, mode, sources);
    // Auto-close the panel after content is generated
    if (mode === 'blend' || mode === 'replace' || mode === 'citation' || mode === 'summary') {
      onClose();
    }
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
        <h2 className="text-sm font-semibold text-white">Think Mode</h2>
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
          Brainstorm
        </button>
        <button
          onClick={() => setActiveTab('research')}
          className={`px-3 py-2 text-xs transition-colors ${
            activeTab === 'research'
              ? 'bg-gray-800 text-white border-b-2 border-vscode-blue'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          Research
        </button>
        <button
          onClick={() => setActiveTab('fragments')}
          className={`px-3 py-2 text-xs transition-colors ${
            activeTab === 'fragments'
              ? 'bg-gray-800 text-white border-b-2 border-vscode-blue'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          Fragments
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'brainstorm' && (
          <BrainstormTab
            paragraphId={paragraphId}
            blockContent={paragraphInfo.blockContent}
            sectionHeading={paragraphInfo.sectionHeading}
            sectionContent={paragraphInfo.sectionContent}
            documentId={documentId}
            onContentGenerated={handleContentGenerated}
            onSessionUpdate={handleSessionUpdate}
            initialSession={session}
            onReset={handleReset}
          />
        )}
        {activeTab === 'research' && (
          <ResearchTab
            paragraphId={paragraphId}
            blockContent={paragraphInfo.blockContent}
            sectionHeading={paragraphInfo.sectionHeading}
            sectionContent={paragraphInfo.sectionContent}
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
        {activeTab === 'fragments' && (
          <div className="flex-1 overflow-y-auto p-4 bg-black">
            <div className="text-xs text-gray-400 text-center py-8">
              Fragments features coming soon...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

