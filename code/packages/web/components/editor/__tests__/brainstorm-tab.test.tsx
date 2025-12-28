/**
 * Tests for BrainstormTab component
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrainstormTab } from '../brainstorm-tab';
import { api } from '@/lib/api/client';
import type { BrainstormingSession, ChatMessage, IdeaCard } from '@zadoox/shared';

// Mock the API
vi.mock('@/lib/api/client', () => ({
  api: {
    ai: {
      brainstorm: {
        chat: vi.fn(),
        generate: vi.fn(),
      },
    },
    documents: {
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('BrainstormTab', () => {
  const defaultProps = {
    paragraphId: 'para-0',
    blockContent: 'Test block content',
    documentId: 'test-doc-id',
    onContentGenerated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty state when no messages', () => {
    render(<BrainstormTab {...defaultProps} />);
    
    expect(screen.getByText(/Start brainstorming by asking questions or sharing ideas about this block/)).toBeInTheDocument();
  });

  it('should display initial session messages', () => {
    const initialSession: BrainstormingSession = {
      paragraphId: 'para-0',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test user message',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Test assistant response',
          timestamp: new Date().toISOString(),
        },
      ],
      ideaCards: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(<BrainstormTab {...defaultProps} initialSession={initialSession} />);
    
    expect(screen.getByText('Test user message')).toBeInTheDocument();
    expect(screen.getByText('Test assistant response')).toBeInTheDocument();
  });

  it('should display idea cards when present', () => {
    const initialSession: BrainstormingSession = {
      paragraphId: 'para-0',
      messages: [],
      ideaCards: [
        {
          id: 'idea-1',
          topic: 'Test Idea',
          description: 'This is a test idea description',
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(<BrainstormTab {...defaultProps} initialSession={initialSession} />);
    
    expect(screen.getByText('Test Idea')).toBeInTheDocument();
  });

  it('should send message when input is submitted', async () => {
    const mockResponse = {
      response: 'Test assistant response',
      extractedIdeas: [],
    };

    vi.mocked(api.ai.brainstorm.chat).mockResolvedValue(mockResponse);
    vi.mocked(api.documents.get).mockResolvedValue({
      id: 'test-doc-id',
      metadata: {},
    } as any);
    vi.mocked(api.documents.update).mockResolvedValue({} as any);

    render(<BrainstormTab {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Ask anything...');
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    
    const sendButton = screen.getByTitle('Send message');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(api.ai.brainstorm.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test message',
        })
      );
    });
  });

  it('should show mic icon when input is empty', () => {
    render(<BrainstormTab {...defaultProps} />);
    
    const button = screen.getByTitle('Start conversation');
    expect(button).toBeInTheDocument();
  });

  it('should show arrow icon when input has text', () => {
    render(<BrainstormTab {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Ask anything...');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    
    const button = screen.getByTitle('Send message');
    expect(button).toBeInTheDocument();
  });

  it('should handle idea deletion', async () => {
    const onSessionUpdate = vi.fn();
    const initialSession: BrainstormingSession = {
      paragraphId: 'para-0',
      messages: [],
      ideaCards: [
        {
          id: 'idea-1',
          topic: 'Test Idea',
          description: 'Test description',
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(api.documents.get).mockResolvedValue({
      id: 'test-doc-id',
      metadata: {
        brainstormingSessions: {
          'para-0': initialSession,
        },
      },
    } as any);
    vi.mocked(api.documents.update).mockResolvedValue({} as any);

    render(<BrainstormTab {...defaultProps} initialSession={initialSession} onSessionUpdate={onSessionUpdate} />);
    
    const deleteButton = screen.getByTitle('Delete this idea');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(api.documents.update).toHaveBeenCalled();
    });
  });

  it('should show blend/replace dialog when using idea with existing content', async () => {
    const initialSession: BrainstormingSession = {
      paragraphId: 'para-0',
      messages: [],
      ideaCards: [
        {
          id: 'idea-1',
          topic: 'Test Idea',
          description: 'Test description',
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(<BrainstormTab {...defaultProps} blockContent="Existing content" initialSession={initialSession} />);
    
    const useButton = screen.getByText('Use');
    fireEvent.click(useButton);

    await waitFor(() => {
      expect(screen.getByText('Generate Content')).toBeInTheDocument();
      expect(screen.getByText('Blend')).toBeInTheDocument();
      expect(screen.getByText('Replace')).toBeInTheDocument();
    });
  });

  it('should generate content directly when no existing content', async () => {
    const onContentGenerated = vi.fn();
    const initialSession: BrainstormingSession = {
      paragraphId: 'para-0',
      messages: [],
      ideaCards: [
        {
          id: 'idea-1',
          topic: 'Test Idea',
          description: 'Test description',
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(api.ai.brainstorm.generate).mockResolvedValue({
      content: 'Generated content',
    });

    render(
      <BrainstormTab
        {...defaultProps}
        blockContent=""
        initialSession={initialSession}
        onContentGenerated={onContentGenerated}
      />
    );
    
    const useButton = screen.getByText('Use');
    fireEvent.click(useButton);

    await waitFor(() => {
      expect(api.ai.brainstorm.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'replace',
        })
      );
      expect(onContentGenerated).toHaveBeenCalledWith('Generated content', 'replace');
    });
  });

  it('should handle reset brainstorming', async () => {
    const onReset = vi.fn();
    const initialSession: BrainstormingSession = {
      paragraphId: 'para-0',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date().toISOString(),
        },
      ],
      ideaCards: [
        {
          id: 'idea-1',
          topic: 'Test Idea',
          description: 'Test description',
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(api.documents.get).mockResolvedValue({
      id: 'test-doc-id',
      metadata: {
        brainstormingSessions: {
          'para-0': initialSession,
        },
      },
    } as any);
    vi.mocked(api.documents.update).mockResolvedValue({} as any);

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<BrainstormTab {...defaultProps} initialSession={initialSession} onReset={onReset} />);
    
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(api.documents.update).toHaveBeenCalled();
      expect(onReset).toHaveBeenCalled();
    });

    confirmSpy.mockRestore();
  });

  it('should not reset if user cancels confirmation', async () => {
    const onReset = vi.fn();
    const initialSession: BrainstormingSession = {
      paragraphId: 'para-0',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date().toISOString(),
        },
      ],
      ideaCards: [
        {
          id: 'idea-1',
          topic: 'Test Idea',
          description: 'Test description',
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(api.documents.get).mockResolvedValue({
      id: 'test-doc-id',
      metadata: {
        brainstormingSessions: {
          'para-0': initialSession,
        },
      },
    } as any);
    vi.mocked(api.documents.update).mockResolvedValue({} as any);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<BrainstormTab {...defaultProps} initialSession={initialSession} onReset={onReset} />);
    
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(api.documents.update).not.toHaveBeenCalled();
      expect(onReset).not.toHaveBeenCalled();
    });

    confirmSpy.mockRestore();
  });

  it('should display loading state when sending message', async () => {
    vi.mocked(api.ai.brainstorm.chat).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ response: 'Test', extractedIdeas: [] }), 100))
    );
    vi.mocked(api.documents.get).mockResolvedValue({
      id: 'test-doc-id',
      metadata: {},
    } as any);
    vi.mocked(api.documents.update).mockResolvedValue({} as any);

    render(<BrainstormTab {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Ask anything...');
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    
    const sendButton = screen.getByTitle('Send message');
    fireEvent.click(sendButton);

    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });
});

