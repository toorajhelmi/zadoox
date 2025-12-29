/**
 * Tests for Think Mode integration in EditorLayout
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorLayout } from '../editor-layout';
import { useDocumentState } from '@/hooks/use-document-state';

// Mock dependencies
vi.mock('@/hooks/use-document-state');
vi.mock('@/lib/api/client', () => ({
  api: {
    versions: {
      getMetadata: vi.fn().mockResolvedValue({
        documentId: 'doc-1',
        currentVersion: 1,
        totalVersions: 1,
        lastModifiedAt: new Date(),
      }),
      list: vi.fn().mockResolvedValue([
        {
          id: 'version-1',
          documentId: 'doc-1',
          versionNumber: 1,
          isSnapshot: true,
          authorId: 'user-1',
          createdAt: new Date(),
        },
      ]),
    },
    projects: {
      get: vi.fn().mockResolvedValue({
        settings: {
          citationFormat: 'numbered',
          documentStyle: 'other',
        },
      }),
    },
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../editor-sidebar', () => ({
  EditorSidebar: () => <div data-testid="editor-sidebar">Sidebar</div>,
}));

vi.mock('../editor-toolbar', () => ({
  EditorToolbar: () => <div data-testid="editor-toolbar">Toolbar</div>,
}));

vi.mock('../editor-status-bar', () => ({
  EditorStatusBar: () => <div data-testid="editor-status-bar">Status Bar</div>,
}));

vi.mock('../formatting-toolbar', () => ({
  FormattingToolbar: () => <div data-testid="formatting-toolbar">Formatting</div>,
}));

vi.mock('../markdown-preview', () => ({
  MarkdownPreview: () => <div data-testid="markdown-preview">Preview</div>,
}));

vi.mock('../ai-enhanced-editor', () => ({
  AIEnhancedEditor: ({ onOpenPanel, openParagraphId }: { onOpenPanel?: (id: string) => void; openParagraphId?: string | null }) => (
    <div data-testid="ai-enhanced-editor">
      <button
        data-testid="open-panel-btn"
        onClick={() => onOpenPanel?.('para-0')}
      >
        Open Panel
      </button>
      <div data-testid="open-paragraph-id">{openParagraphId || 'none'}</div>
    </div>
  ),
}));

vi.mock('../think-mode-panel', () => ({
  ThinkModePanel: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="think-mode-panel">
      {isOpen ? (
        <>
          <div>Think Mode Panel</div>
          <button data-testid="close-panel-btn" onClick={onClose}>
            Close
          </button>
        </>
      ) : null}
    </div>
  ),
}));

describe('Think Mode Integration', () => {
  const mockUseDocumentState = vi.mocked(useDocumentState);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDocumentState.mockReturnValue({
      content: 'Test content\n\nAnother paragraph',
      documentTitle: 'Test Document',
      updateContent: vi.fn(),
      setContentWithoutSave: vi.fn(),
      isSaving: false,
      lastSaved: null,
      isLoading: false,
      documentId: 'doc-1',
      saveDocument: vi.fn(),
      paragraphModes: {},
      handleModeToggle: vi.fn(),
    } as any);
  });

  it('should not show Think panel initially', () => {
    render(<EditorLayout documentId="doc-1" projectId="project-1" />);
    
    expect(screen.queryByTestId('think-mode-panel')).toBeInTheDocument();
    expect(screen.queryByText('Think Mode Panel')).not.toBeInTheDocument();
  });

  it('should open Think panel when onOpenPanel is called', async () => {
    render(<EditorLayout documentId="doc-1" projectId="project-1" />);
    
    const openButton = screen.getByTestId('open-panel-btn');
    fireEvent.click(openButton);
    
    await waitFor(() => {
      expect(screen.getByText('Think Mode Panel')).toBeInTheDocument();
    });
  });

  it('should close Think panel when close button is clicked', async () => {
    render(<EditorLayout documentId="doc-1" projectId="project-1" />);
    
    // Open panel
    const openButton = screen.getByTestId('open-panel-btn');
    fireEvent.click(openButton);
    
    await waitFor(() => {
      expect(screen.getByText('Think Mode Panel')).toBeInTheDocument();
    });
    
    // Close panel
    const closeButton = screen.getByTestId('close-panel-btn');
    fireEvent.click(closeButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Think Mode Panel')).not.toBeInTheDocument();
    });
  });

  it('should pass openParagraphId to AIEnhancedEditor', async () => {
    render(<EditorLayout documentId="doc-1" projectId="project-1" />);
    
    const openButton = screen.getByTestId('open-panel-btn');
    fireEvent.click(openButton);
    
    await waitFor(() => {
      const paragraphIdDisplay = screen.getByTestId('open-paragraph-id');
      expect(paragraphIdDisplay).toHaveTextContent('para-0');
    });
  });

  it('should set paragraph to think mode when opening panel', async () => {
    const mockHandleModeToggle = vi.fn();
    mockUseDocumentState.mockReturnValue({
      content: 'Test content',
      documentTitle: 'Test Document',
      updateContent: vi.fn(),
      setContentWithoutSave: vi.fn(),
      isSaving: false,
      lastSaved: null,
      isLoading: false,
      documentId: 'doc-1',
      saveDocument: vi.fn(),
      paragraphModes: {},
      handleModeToggle: mockHandleModeToggle,
    } as any);

    render(<EditorLayout documentId="doc-1" projectId="project-1" />);
    
    const openButton = screen.getByTestId('open-panel-btn');
    fireEvent.click(openButton);
    
    await waitFor(() => {
      expect(mockHandleModeToggle).toHaveBeenCalledWith('para-0', 'think');
    });
  });
});

