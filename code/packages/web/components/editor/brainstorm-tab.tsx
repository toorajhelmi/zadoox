'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { IdeaCard } from './idea-card';
import { ChatMessage } from './chat-message';
import { api } from '@/lib/api/client';
import { MicIcon, ArrowRightIcon } from '@/components/dashboard/icons';
import type { BrainstormingSession, ChatMessage as ChatMessageType, IdeaCard as IdeaCardType } from '@zadoox/shared';

// Helper to generate UUID
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

interface BrainstormTabProps {
  paragraphId: string;
  blockContent: string;
  sectionHeading?: string;
  sectionContent?: string;
  documentId: string;
  onContentGenerated: (content: string, mode: 'blend' | 'replace' | 'extend') => void;
  onSessionUpdate?: (session: BrainstormingSession) => void;
  initialSession?: BrainstormingSession | null;
  onReset?: () => void;
  onGeneratingChange?: (isGenerating: boolean) => void;
}

export function BrainstormTab({
  paragraphId,
  blockContent,
  sectionHeading,
  sectionContent,
  documentId,
  onContentGenerated,
  onSessionUpdate,
  initialSession,
  onReset,
  onGeneratingChange,
}: BrainstormTabProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>(initialSession?.messages || []);
  const [ideaCards, setIdeaCards] = useState<IdeaCardType[]>(initialSession?.ideaCards || []);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBlendReplaceDialog, setShowBlendReplaceDialog] = useState(false);
  const [pendingIdea, setPendingIdea] = useState<IdeaCardType | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Save session to document metadata
  const saveSession = useCallback(async (updatedMessages: ChatMessageType[], updatedIdeaCards: IdeaCardType[]) => {
    const session: BrainstormingSession = {
      paragraphId,
      messages: updatedMessages,
      ideaCards: updatedIdeaCards,
      createdAt: initialSession?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (onSessionUpdate) {
      onSessionUpdate(session);
    }

    // Also save to document metadata
    try {
      const currentDocument = await api.documents.get(documentId);
      const updatedMetadata = {
        ...currentDocument.metadata,
        brainstormingSessions: {
          ...(currentDocument.metadata.brainstormingSessions || {}),
          [paragraphId]: session,
        },
      };
      await api.documents.update(documentId, {
        metadata: updatedMetadata,
      });
    } catch (error) {
      console.error('Failed to save brainstorming session:', error);
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
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      // Convert messages to format expected by API (without ideaCardIds for history)
      const chatHistory = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));

      const response = await api.ai.brainstorm.chat({
        paragraphId,
        message: userMessage.content,
        context: {
          blockContent,
          sectionHeading,
          sectionContent,
        },
        chatHistory,
        existingIdeaCards: ideaCards.map(card => ({
          id: card.id,
          topic: card.topic,
          description: card.description,
          sourceMessageId: card.sourceMessageId,
          createdAt: card.createdAt,
        })),
      });

      const assistantMessage: ChatMessageType = {
        id: generateId(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);

      // Extract ideas if any were found
      let updatedIdeaCards = [...ideaCards];
      if (response.extractedIdeas && response.extractedIdeas.length > 0) {
        const newIdeas: IdeaCardType[] = response.extractedIdeas.map(idea => ({
          id: generateId(),
          topic: idea.topic,
          description: idea.description,
          sourceMessageId: assistantMessage.id,
          createdAt: new Date().toISOString(),
        }));

        updatedIdeaCards = [...ideaCards, ...newIdeas];
        setIdeaCards(updatedIdeaCards);

        // Link ideas to the message
        assistantMessage.ideaCardIds = newIdeas.map(idea => idea.id);
      }

      // Save session
      await saveSession(finalMessages, updatedIdeaCards);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: ChatMessageType = {
        id: generateId(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, ideaCards, paragraphId, blockContent, sectionHeading, sectionContent, saveSession]);

  const handleDeleteIdea = useCallback(async (ideaId: string) => {
    const updatedIdeaCards = ideaCards.filter(card => card.id !== ideaId);
    setIdeaCards(updatedIdeaCards);
    await saveSession(messages, updatedIdeaCards);
  }, [ideaCards, messages, saveSession]);

  const handleReset = useCallback(async () => {
    if (!confirm('Are you sure you want to reset brainstorming? This will delete all messages and ideas.')) {
      return;
    }

    try {
      // Clear local state
      setMessages([]);
      setIdeaCards([]);

      // Remove session from document metadata
      const currentDocument = await api.documents.get(documentId);
      const updatedMetadata = {
        ...currentDocument.metadata,
        brainstormingSessions: {
          ...(currentDocument.metadata.brainstormingSessions || {}),
        },
      };
      // Delete the session for this paragraph
      delete updatedMetadata.brainstormingSessions[paragraphId];
      
      await api.documents.update(documentId, {
        metadata: updatedMetadata,
      });

      // Notify parent component
      if (onReset) {
        onReset();
      }
    } catch (error) {
      console.error('Failed to reset brainstorming session:', error);
      alert(`Failed to reset brainstorming: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [documentId, paragraphId, onReset]);

  const handleUseIdea = useCallback(async (idea: IdeaCardType) => {
    // Check if block has existing content
    if (blockContent.trim()) {
      // Show blend/replace dialog
      setPendingIdea(idea);
      setShowBlendReplaceDialog(true);
    } else {
      // Generate directly
      await generateContent(idea, 'replace');
    }
  }, [blockContent]);

  const generateContent = useCallback(async (idea: IdeaCardType, mode: 'blend' | 'replace' | 'extend') => {
    try {
      setIsLoading(true);
      if (onGeneratingChange) {
        onGeneratingChange(true);
      }
      const response = await api.ai.brainstorm.generate({
        paragraphId,
        ideaCard: {
          topic: idea.topic,
          description: idea.description,
        },
        context: {
          blockContent,
          sectionHeading,
          sectionContent,
        },
        mode: mode === 'extend' ? 'replace' : mode, // extend handled in frontend
      });

      onContentGenerated(response.content, mode);
      setShowBlendReplaceDialog(false);
      setPendingIdea(null);
    } catch (error) {
      console.error('Failed to generate content:', error);
      alert(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (onGeneratingChange) {
        onGeneratingChange(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [paragraphId, blockContent, sectionHeading, sectionContent, onContentGenerated, onGeneratingChange]);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Idea Cards Section */}
      {ideaCards.length > 0 && (
        <div className="border-b border-gray-800 bg-black" style={{ maxHeight: '25%', display: 'flex', flexDirection: 'column' }}>
          {/* Fixed Header with Reset Button */}
          <div className="flex items-center justify-end p-3 pb-2 flex-shrink-0">
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
              title="Reset brainstorming session"
            >
              Reset
            </button>
          </div>
          {/* Scrollable Idea Cards */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0 idea-cards-scroll">
            {ideaCards.map((idea, index) => (
              <div key={idea.id}>
                <IdeaCard
                  idea={idea}
                  onDelete={handleDeleteIdea}
                  onUse={handleUseIdea}
                />
                {index < ideaCards.length - 1 && (
                  <div className="border-b border-gray-800 my-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages Section */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-black">
        {messages.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-8">
            Start brainstorming by asking questions or sharing ideas about this block.
          </div>
        )}
        {messages.length > 0 && ideaCards.length === 0 && (
          <div className="flex justify-end mb-2 px-4">
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
              title="Reset brainstorming session"
            >
              Reset
            </button>
          </div>
        )}
        {messages.map(message => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
              <div className="text-xs text-gray-400">Thinking...</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Command Bar Style */}
      <div className="bg-black p-2 mt-2">
        <div className="rounded-lg bg-gray-950 border border-gray-800">
          {/* Text Input Area */}
          <div className="px-4 pt-4 pb-3">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Auto-resize textarea
                const textarea = e.target;
                textarea.style.height = 'auto';
                textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                  // Reset textarea height after sending
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                  }
                }
              }}
              placeholder="Ask anything..."
              rows={1}
              className="w-full text-xs bg-transparent text-gray-400 placeholder-gray-500 focus:outline-none resize-none overflow-y-auto"
              disabled={isLoading}
              style={{ minHeight: '20px', maxHeight: '200px' }}
            />
          </div>
          
          {/* Bottom Controls Bar */}
          <div className="flex items-center justify-between px-4 pb-3 pt-2 border-t border-gray-900">
            {/* Left side - Controls */}
            <div className="flex items-center gap-3">
              {/* Placeholder for future controls like Agent, Auto, etc. */}
            </div>
            
            {/* Right side - Action icons */}
            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              )}
              <button
                onClick={handleSendMessage}
                disabled={isLoading}
                className={`p-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                  inputValue.trim()
                    ? 'bg-vscode-blue hover:bg-blue-600 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
                title={inputValue.trim() ? "Send message" : "Start conversation"}
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

      {/* Blend/Replace Dialog */}
      {showBlendReplaceDialog && pendingIdea && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 w-96">
            <h3 className="text-sm font-semibold text-white mb-2">Generate Content</h3>
            <p className="text-xs text-gray-400 mb-4">
              This block already has content. How would you like to proceed?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => generateContent(pendingIdea, 'blend')}
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 transition-colors disabled:opacity-50"
              >
                Blend
              </button>
              <button
                onClick={() => generateContent(pendingIdea, 'replace')}
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 transition-colors disabled:opacity-50"
              >
                Replace
              </button>
              <button
                onClick={() => {
                  setShowBlendReplaceDialog(false);
                  setPendingIdea(null);
                }}
                disabled={isLoading}
                className="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay - Only show when generating content (not just thinking in chat) */}
      {isLoading && !showBlendReplaceDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-4 min-w-[200px]">
            <div className="w-8 h-8 border-4 border-gray-600 border-t-vscode-blue rounded-full animate-spin" />
            <div className="text-sm text-gray-400">Generating content...</div>
          </div>
        </div>
      )}
    </div>
  );
}

