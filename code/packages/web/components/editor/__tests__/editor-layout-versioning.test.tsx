/**
 * Unit tests for EditorLayout version editing fixes
 * Tests for: readOnly logic, version selection, blocking edits for older versions
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EditorLayout } from '../editor-layout';
import { api } from '@/lib/api/client';
import { useDocumentState } from '@/hooks/use-document-state';

// Mock dependencies
vi.mock('@/hooks/use-document-state');
vi.mock('@/lib/api/client', () => ({
  api: {
    versions: {
      getMetadata: vi.fn(),
      list: vi.fn(),
      reconstruct: vi.fn(),
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

// Mock child components to focus on EditorLayout logic
vi.mock('../editor-sidebar', () => ({
  EditorSidebar: ({ onVersionSelect, refreshTrigger }: { onVersionSelect?: (v: number) => Promise<void>; refreshTrigger?: Date | null }) => (
    <div data-testid="editor-sidebar">
      <button
        onClick={() => onVersionSelect?.(21)}
        data-testid="select-version-21"
      >
        Select v21
      </button>
      <button
        onClick={() => onVersionSelect?.(20)}
        data-testid="select-version-20"
      >
        Select v20
      </button>
      {refreshTrigger && <div data-testid="refresh-trigger">{refreshTrigger.getTime()}</div>}
    </div>
  ),
}));

vi.mock('../ai-enhanced-editor', () => ({
  AIEnhancedEditor: ({ readOnly, onChange, value }: { readOnly?: boolean; onChange: (v: string) => void; value: string }) => (
    <div data-testid="ai-enhanced-editor">
      <input
        data-testid="editor-input"
        data-readonly={readOnly}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
      />
    </div>
  ),
}));

vi.mock('../editor-toolbar', () => ({
  EditorToolbar: () => <div data-testid="editor-toolbar">Toolbar</div>,
}));

vi.mock('../formatting-toolbar', () => ({
  FormattingToolbar: ({ onFormat }: { onFormat: (f: string) => void }) => (
    <button onClick={() => onFormat('bold')} data-testid="format-bold">Bold</button>
  ),
}));

vi.mock('../markdown-preview', () => ({
  MarkdownPreview: () => <div data-testid="markdown-preview">Preview</div>,
}));

describe('EditorLayout - Version Editing Fixes', () => {
  const mockUpdateContent = vi.fn();
  const mockSetContentWithoutSave = vi.fn();
  const mockSaveDocument = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(useDocumentState).mockReturnValue({
      content: 'Test content',
      documentTitle: 'Test Document',
      updateContent: mockUpdateContent,
      setContentWithoutSave: mockSetContentWithoutSave,
      isSaving: false,
      lastSaved: new Date('2024-01-01'),
      isLoading: false,
      documentId: 'doc-1',
      saveDocument: mockSaveDocument,
    });

    vi.mocked(api.versions.getMetadata).mockResolvedValue({
      documentId: 'doc-1',
      currentVersion: 21,
      lastSnapshotVersion: 1,
      totalVersions: 21,
      lastModifiedAt: new Date('2024-01-01'),
      lastModifiedBy: 'user-1',
    });

    vi.mocked(api.versions.reconstruct).mockResolvedValue('Reconstructed content');
  });

  it('should set readOnly to false when viewing latest version (selectedVersion is null)', async () => {
    render(<EditorLayout projectId="project-1" documentId="doc-1" />);

    await waitFor(() => {
      const editor = screen.getByTestId('editor-input');
      expect(editor).toHaveAttribute('data-readonly', 'false');
    });
  });

  it('should set readOnly to true when viewing older version', async () => {
    render(<EditorLayout projectId="project-1" documentId="doc-1" />);

    // Wait for metadata to load
    await waitFor(() => {
      expect(api.versions.getMetadata).toHaveBeenCalled();
    });

    // Select version 20 (older than latest 21)
    const selectV20Button = screen.getByTestId('select-version-20');
    fireEvent.click(selectV20Button);

    await waitFor(() => {
      const editor = screen.getByTestId('editor-input');
      expect(editor).toHaveAttribute('data-readonly', 'true');
    });
  });

  it('should set readOnly to false when selecting latest version', async () => {
    render(<EditorLayout projectId="project-1" documentId="doc-1" />);

    // Wait for metadata to load
    await waitFor(() => {
      expect(api.versions.getMetadata).toHaveBeenCalled();
    });

    // Select version 21 (latest)
    const selectV21Button = screen.getByTestId('select-version-21');
    fireEvent.click(selectV21Button);

    await waitFor(() => {
      const editor = screen.getByTestId('editor-input');
      expect(editor).toHaveAttribute('data-readonly', 'false');
    });
  });

  it('should use fallback to versions list when metadata.currentVersion is missing', async () => {
    // Mock metadata with missing currentVersion
    vi.mocked(api.versions.getMetadata).mockResolvedValueOnce({
      documentId: 'doc-1',
      currentVersion: undefined as unknown as number,
      lastSnapshotVersion: 1,
      totalVersions: 21,
      lastModifiedAt: new Date('2024-01-01'),
      lastModifiedBy: 'user-1',
    });

    vi.mocked(api.versions.list).mockResolvedValueOnce([
      {
        id: 'v-21',
        documentId: 'doc-1',
        versionNumber: 21,
        isSnapshot: false,
        authorId: 'user-1',
        createdAt: new Date('2024-01-01'),
        changeType: 'auto-save',
        changeDescription: null,
      },
    ]);

    render(<EditorLayout projectId="project-1" documentId="doc-1" />);

    await waitFor(() => {
      expect(api.versions.list).toHaveBeenCalledWith('doc-1', 1, 0);
    });

    // Select version 21 should work (fallback found it as latest)
    const selectV21Button = screen.getByTestId('select-version-21');
    fireEvent.click(selectV21Button);

    await waitFor(() => {
      const editor = screen.getByTestId('editor-input');
      expect(editor).toHaveAttribute('data-readonly', 'false');
    });
  });

  it('should block content changes when viewing older version', async () => {
    render(<EditorLayout projectId="project-1" documentId="doc-1" />);

    // Wait for metadata to load
    await waitFor(() => {
      expect(api.versions.getMetadata).toHaveBeenCalled();
    });

    // Select version 20 (older)
    const selectV20Button = screen.getByTestId('select-version-20');
    fireEvent.click(selectV20Button);

    await waitFor(() => {
      expect(mockSetContentWithoutSave).toHaveBeenCalledWith('Reconstructed content');
    });

    // Try to edit content
    const editor = screen.getByTestId('editor-input') as HTMLInputElement;
    fireEvent.change(editor, { target: { value: editor.value + 'New text' } });

    // updateContent should NOT be called (blocked)
    expect(mockUpdateContent).not.toHaveBeenCalled();
  });

  it('should allow content changes when viewing latest version', async () => {
    render(<EditorLayout projectId="project-1" documentId="doc-1" />);

    // Wait for metadata to load
    await waitFor(() => {
      expect(api.versions.getMetadata).toHaveBeenCalled();
    });

    // Select version 21 (latest)
    const selectV21Button = screen.getByTestId('select-version-21');
    fireEvent.click(selectV21Button);

    await waitFor(() => {
      expect(mockUpdateContent).toHaveBeenCalledWith('Reconstructed content');
    });

    // Try to edit content
    const editor = screen.getByTestId('editor-input') as HTMLInputElement;
    fireEvent.change(editor, { target: { value: editor.value + 'New text' } });

    // updateContent should be called (allowed)
    expect(mockUpdateContent).toHaveBeenCalled();
  });

  it('should block formatting when viewing older version', async () => {
    render(<EditorLayout projectId="project-1" documentId="doc-1" />);

    // Wait for metadata to load
    await waitFor(() => {
      expect(api.versions.getMetadata).toHaveBeenCalled();
    });

    // Select version 20 (older)
    const selectV20Button = screen.getByTestId('select-version-20');
    fireEvent.click(selectV20Button);

    await waitFor(() => {
      const editor = screen.getByTestId('editor-input');
      expect(editor).toHaveAttribute('data-readonly', 'true');
    });

    // Try to format
    const formatButton = screen.getByTestId('format-bold');
    fireEvent.click(formatButton);

    // updateContent should NOT be called (blocked)
    expect(mockUpdateContent).not.toHaveBeenCalled();
  });

  it('should set selectedVersion to null when selecting latest version', async () => {
    render(<EditorLayout projectId="project-1" documentId="doc-1" />);

    // Wait for metadata to load
    await waitFor(() => {
      expect(api.versions.getMetadata).toHaveBeenCalled();
    });

    // Select version 21 (latest)
    const selectV21Button = screen.getByTestId('select-version-21');
    fireEvent.click(selectV21Button);

    await waitFor(() => {
      // Should use updateContent (not setContentWithoutSave) for latest version
      expect(mockUpdateContent).toHaveBeenCalledWith('Reconstructed content');
      expect(mockSetContentWithoutSave).not.toHaveBeenCalled();
    });
  });

  it('should use setContentWithoutSave when selecting older version', async () => {
    render(<EditorLayout projectId="project-1" documentId="doc-1" />);

    // Wait for metadata to load
    await waitFor(() => {
      expect(api.versions.getMetadata).toHaveBeenCalled();
    });

    // Select version 20 (older)
    const selectV20Button = screen.getByTestId('select-version-20');
    fireEvent.click(selectV20Button);

    await waitFor(() => {
      // Should use setContentWithoutSave (not updateContent) for older version
      expect(mockSetContentWithoutSave).toHaveBeenCalledWith('Reconstructed content');
      expect(mockUpdateContent).not.toHaveBeenCalled();
    });
  });
});

