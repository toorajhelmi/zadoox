'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from './chat-message';
import { api } from '@/lib/api/client';
import { MicIcon, ArrowRightIcon } from '@/components/dashboard/icons';
import type { ResearchSession, ChatMessage as ChatMessageType, ResearchSource, DocumentStyle } from '@zadoox/shared';

// Helper to generate UUID
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

interface ResearchTabProps {
  paragraphId: string;
  blockContent: string;
  sectionHeading?: string;
  sectionContent?: string;
  documentId: string;
  projectId: string;
  documentStyle: DocumentStyle;
  citationFormat: 'apa' | 'mla' | 'chicago' | 'ieee' | 'numbered' | 'footnote';
  onContentGenerated: (content: string, mode: 'citation' | 'summary', sources?: ResearchSource[]) => void;
  onSessionUpdate?: (session: ResearchSession) => void;
  initialSession?: ResearchSession | null;
  onReset?: () => void;
  onClose?: () => void;
}

export function ResearchTab({
  paragraphId,
  blockContent,
  sectionHeading,
  sectionContent,
  documentId,
  projectId,
  documentStyle,
  citationFormat,
  onContentGenerated,
  onSessionUpdate,
  initialSession,
  onReset,
  onClose,
}: ResearchTabProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>(initialSession?.messages || []);
  const [sources, setSources] = useState<ResearchSource[]>(initialSession?.sources || []);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'academic' | 'all'>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);


  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  // Save session to document metadata
  const saveSession = useCallback(async (updatedMessages: ChatMessageType[], updatedSources: ResearchSource[]) => {
    const session: ResearchSession = {
      paragraphId,
      messages: updatedMessages,
      sources: updatedSources,
      createdAt: initialSession?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (onSessionUpdate) {
      onSessionUpdate(session);
    }

    try {
      const currentDocument = await api.documents.get(documentId);
      const updatedMetadata = {
        ...currentDocument.metadata,
        researchSessions: {
          ...(currentDocument.metadata.researchSessions || {}),
          [paragraphId]: session,
        },
      };
      await api.documents.update(documentId, {
        metadata: updatedMetadata,
      });
    } catch (error) {
      console.error('Failed to save research session:', error);
    }
  }, [paragraphId, documentId, initialSession, onSessionUpdate]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessageType = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const chatHistory = updatedMessages
        .filter(msg => msg.role === 'assistant' || msg.role === 'user')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      const existingSources = sources.map(src => ({
        id: src.id,
        title: src.title,
        url: src.url,
      }));

      const response = await api.ai.research.chat({
        paragraphId,
        query: inputValue.trim(),
        context: {
          blockContent,
          sectionHeading,
          sectionContent,
        },
        documentStyle,
        sourceType: sourceTypeFilter === 'all' ? undefined : (sourceTypeFilter === 'academic' ? 'academic' : undefined),
        chatHistory: chatHistory.slice(0, -1), // Exclude current message
        existingSources,
      });

      const assistantMessage: ChatMessageType = {
        id: generateId(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };

      // Add new sources with IDs
      const newSources: ResearchSource[] = response.sources.map((source, index) => {
        // Extract citationContext from API response
        const citationContext = source.citationContext ? String(source.citationContext).trim() : undefined;
        
        return {
          id: generateId(),
          title: source.title,
          authors: source.authors,
          venue: source.venue,
          year: source.year,
          url: source.url,
          summary: source.summary,
          sourceType: source.sourceType,
          relevanceScore: source.relevanceScore,
          citationContext, // 3-7 words from block content before citation location
          createdAt: new Date().toISOString(),
          sourceMessageId: assistantMessage.id,
        };
      });

      const finalMessages = [...updatedMessages, assistantMessage];
      const finalSources = [...sources, ...newSources];

      setMessages(finalMessages);
      setSources(finalSources);
      await saveSession(finalMessages, finalSources);
    } catch (error) {
      console.error('Failed to send research message:', error);
      const errorMessage: ChatMessageType = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while searching for sources. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, sources, paragraphId, blockContent, sectionHeading, sectionContent, documentStyle, sourceTypeFilter, saveSession]);

  const handleDeleteSource = useCallback(async (sourceId: string) => {
    const updatedSources = sources.filter(src => src.id !== sourceId);
    setSources(updatedSources);
    await saveSession(messages, updatedSources);
  }, [sources, messages, saveSession]);

  const handleToggleSourceSelection = useCallback((sourceId: string) => {
    setSelectedSourceIds(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);

  const handleInsertCitation = useCallback(() => {
    const selectedSources = sources.filter(src => selectedSourceIds.has(src.id));
    if (selectedSources.length === 0) return;

    console.log('Insert Citation - selectedSources:', selectedSources.map(s => ({
      id: s.id,
      title: s.title.substring(0, 50),
      citationContext: s.citationContext?.substring(0, 50),
    })));

    // Format citations based on citationFormat
    // For numbered formats, we'll let the backend handle numbering based on all sources in document
    const citations = selectedSources.map((source) => {
      switch (citationFormat) {
        case 'apa':
          return source.authors && source.authors.length > 0
            ? `(${source.authors[0]}, ${source.year || 'n.d.'})`
            : `(${source.title}, ${source.year || 'n.d.'})`;
        case 'mla':
          return source.authors && source.authors.length > 0
            ? `(${source.authors[0]} ${source.year || 'n.d.'})`
            : `(${source.title} ${source.year || 'n.d.'})`;
        case 'chicago':
          return source.authors && source.authors.length > 0
            ? `(${source.authors[0]} ${source.year || 'n.d.'})`
            : `(${source.title} ${source.year || 'n.d.'})`;
        case 'ieee':
        case 'numbered':
          // Use placeholder - will be replaced with correct number based on all sources
          return `[?]`;
        case 'footnote':
          return source.citation || `${source.title}${source.authors ? `, ${source.authors.join(', ')}` : ''}${source.year ? ` (${source.year})` : ''}`;
        default:
          return `(${source.title})`;
      }
    });

    const citationText = citations.join(', ');
    onContentGenerated(citationText, 'citation', selectedSources);
    setSelectedSourceIds(new Set());
    if (onClose) {
      onClose();
    }
  }, [citationFormat, sources, selectedSourceIds, onContentGenerated, onClose]);

  const handleInsertSummary = useCallback(() => {
    const selectedSources = sources.filter(src => selectedSourceIds.has(src.id));
    if (selectedSources.length === 0) return;

    const summaries = selectedSources.map(source => {
      const summary = source.summary || source.title;
      const citation = source.citation || `${source.title}${source.authors ? `, ${source.authors.join(', ')}` : ''}${source.year ? ` (${source.year})` : ''}`;
      return `${summary} (${citation})`;
    });

    const content = summaries.join('\n\n');
    onContentGenerated(content, 'summary', selectedSources);
    setSelectedSourceIds(new Set());
    if (onClose) {
      onClose();
    }
  }, [selectedSourceIds, sources, onContentGenerated, onClose]);

  const handleReset = useCallback(async () => {
    if (!window.confirm('Are you sure you want to reset this research session? All sources and messages will be deleted.')) {
      return;
    }

    try {
      const currentDocument = await api.documents.get(documentId);
      const currentSessions = currentDocument.metadata.researchSessions || {};
      const { [paragraphId]: _, ...remainingSessions } = currentSessions;
      const updatedMetadata = {
        ...currentDocument.metadata,
        researchSessions: remainingSessions,
      };
      await api.documents.update(documentId, {
        metadata: updatedMetadata,
      });

      setMessages([]);
      setSources([]);
      if (onReset) {
        onReset();
      }
    } catch (error) {
      console.error('Failed to reset research session:', error);
    }
  }, [documentId, paragraphId, onReset]);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Split View: Chat Left, Results Right */}
      <div className="flex-1 flex overflow-hidden min-w-0">
        {/* Left Side: Chat */}
        <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0">
          {/* Source Type Filter */}
          <div className="p-3 border-b border-vscode-border flex-shrink-0">
            <label className="text-xs text-vscode-text-secondary mb-2 block">
              Source Type
            </label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full bg-vscode-input border border-vscode-input-border rounded px-2 py-1 text-xs text-vscode-text focus:outline-none focus:border-vscode-blue hover:bg-vscode-hover transition-colors flex items-center justify-between"
              >
                <span>
                  {sourceTypeFilter === 'all' ? 'All Sources' : 'Journal/Conference'}
                </span>
                <span className="text-vscode-text-secondary">{isDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {isDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-vscode-sidebar border border-vscode-border rounded shadow-lg">
                  {(['all', 'academic'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setSourceTypeFilter(option);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1 text-xs transition-colors ${
                        sourceTypeFilter === option
                          ? 'bg-vscode-active text-vscode-text'
                          : 'text-vscode-text hover:bg-vscode-hover'
                      }`}
                    >
                      {option === 'all' ? 'All Sources' : 'Journal/Conference'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 min-w-0">
            {messages.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-8">
                Start researching by asking questions about sources for this block.
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                {isLoading && (
                  <div className="text-xs text-gray-400 text-center py-2">
                    Searching for sources...
                  </div>
                )}
                {!isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
                  <div className="text-xs text-gray-400 text-center py-2">
                    Research results are shown on the right. Select sources to insert citations or summaries.
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Quick Commands */}
          <div className="border-t border-gray-800 bg-black px-2 pt-2 pb-1 flex-shrink-0">
            <div className="flex flex-wrap gap-1">
              {['Find references', 'Find recent'].map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => {
                    setInputValue(cmd);
                    // Auto-focus textarea after setting value
                    setTimeout(() => {
                      textareaRef.current?.focus();
                    }, 0);
                  }}
                  className="text-xs px-2 py-1 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-gray-300 rounded border border-gray-800 transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-800 bg-black p-2">
            <div className="border border-gray-800 rounded-lg bg-gray-950">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask anything..."
                  className="w-full bg-transparent text-xs text-gray-400 p-3 pr-12 resize-none focus:outline-none"
                  rows={1}
                  style={{ minHeight: '40px', maxHeight: '120px' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="absolute right-2 bottom-2 p-2 bg-vscode-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center"
                  title={inputValue.trim() ? 'Send message' : 'Start conversation'}
                >
                  {inputValue.trim() ? (
                    <ArrowRightIcon className="w-4 h-4" />
                  ) : (
                    <MicIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Research Results */}
        <div className="flex-1 flex flex-col bg-black min-w-0">
          {/* Header with Reset */}
          <div className="flex items-center justify-between p-3 border-b border-gray-800 flex-shrink-0">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Research Sources ({sources.filter(s => sourceTypeFilter === 'all' || (sourceTypeFilter === 'academic' && s.sourceType === 'academic')).length})
            </div>
            {sources.length > 0 && (
              <button
                onClick={handleReset}
                className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                title="Reset research session"
              >
                Reset
              </button>
            )}
          </div>

          {/* Sources List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-visible-on-overflow">
            {sources.filter(s => sourceTypeFilter === 'all' || (sourceTypeFilter === 'academic' && s.sourceType === 'academic')).length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-8">
                {sources.length === 0
                  ? 'No sources found yet. Start a conversation to discover relevant sources.'
                  : 'No sources match the selected filter.'}
              </div>
            ) : (
              sources
                .filter(s => sourceTypeFilter === 'all' || (sourceTypeFilter === 'academic' && s.sourceType === 'academic'))
                .map((source) => (
                  <div
                    key={source.id}
                    className={`border-b border-gray-800 pb-3 last:border-b-0 ${
                      selectedSourceIds.has(source.id) ? 'bg-gray-900' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedSourceIds.has(source.id)}
                        onChange={() => handleToggleSourceSelection(source.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="mb-2">
                          <h4 className="text-xs font-semibold text-gray-300 mb-1">{source.title}</h4>
                          {source.authors && source.authors.length > 0 && (
                            <p className="text-xs text-gray-500 mb-1">
                              {source.authors.join(', ')}
                              {source.year && ` (${source.year})`}
                            </p>
                          )}
                          {source.venue && (
                            <p className="text-xs text-gray-500 mb-1">{source.venue}</p>
                          )}
                          {source.url && !source.url.includes('example.com') && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-vscode-blue hover:underline"
                            >
                              {source.url}
                            </a>
                          )}
                        </div>
                        {source.summary && (
                          <p className="text-xs text-gray-400 mb-2">{source.summary}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => handleDeleteSource(source.id)}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-400 hover:bg-gray-800 rounded transition-colors"
                            title="Delete source"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Fixed Bottom Actions */}
          {selectedSourceIds.size > 0 && (
            <div className="flex items-center justify-between p-3 border-t border-gray-800 bg-black flex-shrink-0">
              <div className="text-xs text-gray-400">
                {selectedSourceIds.size} source{selectedSourceIds.size > 1 ? 's' : ''} selected
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleInsertCitation}
                  className="px-3 py-1.5 text-xs bg-vscode-blue hover:bg-blue-600 text-white rounded transition-colors font-medium"
                  title="Insert citations for selected sources"
                >
                  Insert Citation
                </button>
                <button
                  onClick={handleInsertSummary}
                  className="px-3 py-1.5 text-xs bg-vscode-blue hover:bg-blue-600 text-white rounded transition-colors font-medium"
                  title="Insert summaries for selected sources"
                >
                  Insert Summary
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

