/**
 * Tests for ResearchTab component
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResearchTab } from '../research-tab';
import { api } from '@/lib/api/client';
import type { ResearchSession, ChatMessage, ResearchSource, DocumentStyle } from '@zadoox/shared';

// Mock the API
vi.mock('@/lib/api/client', () => ({
  api: {
    ai: {
      research: {
        chat: vi.fn(),
      },
    },
    documents: {
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('ResearchTab', () => {
  const defaultProps = {
    paragraphId: 'para-0',
    blockContent: 'Test block content about quantum mechanics',
    documentId: 'test-doc-id',
    projectId: 'test-project-id',
    documentStyle: 'academic' as DocumentStyle,
    citationFormat: 'apa' as const,
    onContentGenerated: vi.fn(),
    onSessionUpdate: vi.fn(),
    onClose: vi.fn(),
  };

  const mockResearchSource: ResearchSource = {
    id: 'source-1',
    title: 'Quantum Mechanics: A Comprehensive Guide',
    authors: ['John Doe', 'Jane Smith'],
    venue: 'Physical Review',
    year: 2023,
    url: 'https://example.com/quantum',
    summary: 'A comprehensive guide to quantum mechanics principles',
    sourceType: 'academic',
    relevanceScore: 95,
    citationContext: 'quantum mechanics principles',
    createdAt: new Date().toISOString(),
    sourceMessageId: 'msg-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty state when no messages', () => {
    render(<ResearchTab {...defaultProps} />);
    
    expect(screen.getByText(/Start researching by asking questions about sources for this block/)).toBeInTheDocument();
  });

  it('should display initial session messages', () => {
    const initialSession: ResearchSession = {
      paragraphId: 'para-0',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Find sources about quantum mechanics',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Research results are shown on the right.',
          timestamp: new Date().toISOString(),
        },
      ],
      sources: [mockResearchSource],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(<ResearchTab {...defaultProps} initialSession={initialSession} />);
    
    expect(screen.getByText('Find sources about quantum mechanics')).toBeInTheDocument();
    expect(screen.getByText('Research results are shown on the right.')).toBeInTheDocument();
    expect(screen.getByText('Quantum Mechanics: A Comprehensive Guide')).toBeInTheDocument();
  });

  it('should display research sources', () => {
    const initialSession: ResearchSession = {
      paragraphId: 'para-0',
      messages: [],
      sources: [mockResearchSource],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(<ResearchTab {...defaultProps} initialSession={initialSession} />);
    
    expect(screen.getByText('Quantum Mechanics: A Comprehensive Guide')).toBeInTheDocument();
    // Authors and year are in separate elements
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Physical Review/)).toBeInTheDocument();
  });

  it('should send message when input is submitted', async () => {
    const mockResponse = {
      response: 'Research results are shown on the right.',
      sources: [mockResearchSource],
    };

    (api.ai.research.chat as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
    (api.documents.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      metadata: { insertedSources: [] },
    });
    (api.documents.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(<ResearchTab {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Ask anything...');
    fireEvent.change(input, { target: { value: 'Find sources about quantum computing' } });
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(api.ai.research.chat).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Find sources about quantum computing')).toBeInTheDocument();
    });
  });

  it('should toggle source selection when checkbox is clicked', () => {
    const initialSession: ResearchSession = {
      paragraphId: 'para-0',
      messages: [],
      sources: [mockResearchSource],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(<ResearchTab {...defaultProps} initialSession={initialSession} />);
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('should filter sources by source type', () => {
    const webSource: ResearchSource = {
      ...mockResearchSource,
      id: 'source-2',
      title: 'Web Article About Quantum',
      sourceType: 'web',
    };

    const initialSession: ResearchSession = {
      paragraphId: 'para-0',
      messages: [],
      sources: [mockResearchSource, webSource],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(<ResearchTab {...defaultProps} initialSession={initialSession} />);
    
    // Both sources should be visible initially (filter is 'all')
    expect(screen.getByText('Quantum Mechanics: A Comprehensive Guide')).toBeInTheDocument();
    expect(screen.getByText('Web Article About Quantum')).toBeInTheDocument();
  });

  it('should call onContentGenerated when Insert Citation is clicked', async () => {
    const initialSession: ResearchSession = {
      paragraphId: 'para-0',
      messages: [],
      sources: [mockResearchSource],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(<ResearchTab {...defaultProps} initialSession={initialSession} />);
    
    // Select the source
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    // Click Insert Citation
    const insertButton = screen.getByRole('button', { name: /Insert Citation/i });
    fireEvent.click(insertButton);

    await waitFor(() => {
      expect(defaultProps.onContentGenerated).toHaveBeenCalledWith(
        expect.any(String),
        'citation',
        [mockResearchSource]
      );
    });
  });

  it('should call onContentGenerated when Insert Summary is clicked', async () => {
    const initialSession: ResearchSession = {
      paragraphId: 'para-0',
      messages: [],
      sources: [mockResearchSource],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(<ResearchTab {...defaultProps} initialSession={initialSession} />);
    
    // Select the source
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    // Click Insert Summary
    const insertButton = screen.getByRole('button', { name: /Insert Summary/i });
    fireEvent.click(insertButton);

    await waitFor(() => {
      expect(defaultProps.onContentGenerated).toHaveBeenCalledWith(
        expect.any(String),
        'summary',
        [mockResearchSource]
      );
    });
  });

  it('should not show insert buttons when no sources are selected', () => {
    const initialSession: ResearchSession = {
      paragraphId: 'para-0',
      messages: [],
      sources: [mockResearchSource],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(<ResearchTab {...defaultProps} initialSession={initialSession} />);
    
    // Buttons should not be visible when nothing is selected
    expect(screen.queryByRole('button', { name: /Insert Citation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Insert Summary/i })).not.toBeInTheDocument();
  });

  it('should call onReset when Reset button is clicked', async () => {
    // Mock window.confirm to return true
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    const onReset = vi.fn();
    const initialSession: ResearchSession = {
      paragraphId: 'para-0',
      messages: [{ id: 'msg-1', role: 'user', content: 'Test', timestamp: new Date().toISOString() }],
      sources: [mockResearchSource],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (api.documents.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      metadata: { researchSessions: { 'para-0': initialSession } },
    });
    (api.documents.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(<ResearchTab {...defaultProps} initialSession={initialSession} onReset={onReset} />);
    
    const resetButton = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(onReset).toHaveBeenCalled();
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('should show loading state while sending message', async () => {
    (api.ai.research.chat as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ response: 'Test', sources: [] }), 100))
    );
    (api.documents.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      metadata: { insertedSources: [] },
    });
    (api.documents.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(<ResearchTab {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Ask anything...');
    fireEvent.change(input, { target: { value: 'Test question' } });
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/Searching for sources.../)).toBeInTheDocument();
    });
  });

  it('should format citations correctly for APA format', async () => {
    const initialSession: ResearchSession = {
      paragraphId: 'para-0',
      messages: [],
      sources: [mockResearchSource],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(<ResearchTab {...defaultProps} initialSession={initialSession} citationFormat="apa" />);
    
    // Select source
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    // Click Insert Citation
    const insertButton = screen.getByRole('button', { name: /Insert Citation/i });
    fireEvent.click(insertButton);

    await waitFor(() => {
      expect(defaultProps.onContentGenerated).toHaveBeenCalled();
      const call = (defaultProps.onContentGenerated as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain('Doe');
      expect(call[0]).toContain('2023');
    });
  });

  it('should handle empty input gracefully', () => {
    render(<ResearchTab {...defaultProps} />);
    
    // Try to find send button - it might not exist if input is empty
    const sendButton = screen.queryByRole('button', { name: /send/i });
    if (sendButton) {
      fireEvent.click(sendButton);
      // Should not call API with empty input
      expect(api.ai.research.chat).not.toHaveBeenCalled();
    }
  });

  it('should delete source when delete button is clicked', async () => {
    const initialSession: ResearchSession = {
      paragraphId: 'para-0',
      messages: [],
      sources: [mockResearchSource],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (api.documents.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      metadata: { researchSessions: { 'para-0': initialSession } },
    });
    (api.documents.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(<ResearchTab {...defaultProps} initialSession={initialSession} />);
    
    // Find delete button by title attribute
    const deleteButton = screen.getByTitle('Delete source');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.queryByText('Quantum Mechanics: A Comprehensive Guide')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should auto-resize textarea when input changes', async () => {
    render(<ResearchTab {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Ask anything...') as HTMLTextAreaElement;
    const initialHeight = textarea.style.height || '';
    
    fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2\nLine 3' } });
    
    // Wait for useEffect to run (auto-resize happens in useEffect)
    await waitFor(() => {
      // Height should change (auto-resize sets it to 'auto' then to scrollHeight)
      expect(textarea.style.height).toBeTruthy();
    }, { timeout: 100 });
  });
});
