/**
 * Unit tests for EditorToolbar component (Phase 7)
 */

/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EditorToolbar } from '../editor-toolbar';
import { api } from '@/lib/api/client';
import type { Project } from '@zadoox/shared';

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  api: {
    projects: {
      get: vi.fn(),
    },
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn((date: Date) => '2 minutes ago'),
}));

// Mock useRouter before importing the component
const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

describe('EditorToolbar', () => {
  const mockOnToggleSidebar = vi.fn();
  const mockOnViewModeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterPush.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render sidebar toggle button', () => {
    render(
      <EditorToolbar
        projectId="project-1"
        isSaving={false}
        lastSaved={null}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    const toggleButton = screen.getByLabelText('Toggle sidebar');
    expect(toggleButton).toBeInTheDocument();
  });

  it('should call onToggleSidebar when sidebar button is clicked', () => {
    render(
      <EditorToolbar
        projectId="project-1"
        isSaving={false}
        lastSaved={null}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    const toggleButton = screen.getByLabelText('Toggle sidebar');
    fireEvent.click(toggleButton);

    expect(mockOnToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('should render breadcrumbs with Projects link', () => {
    render(
      <EditorToolbar
        projectId="project-1"
        isSaving={false}
        lastSaved={null}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('should render document title in breadcrumbs when provided', () => {
    render(
      <EditorToolbar
        projectId="project-1"
        documentTitle="My Document"
        isSaving={false}
        lastSaved={null}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    expect(screen.getByText('My Document')).toBeInTheDocument();
  });

  it('should load and display project name', async () => {
    const mockProject: Project = {
      id: 'project-1',
      name: 'Test Project',
      type: 'academic',
      ownerId: 'user-1',
      settings: {
        defaultFormat: 'latex',
        chapterNumbering: true,
        autoSync: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(api.projects.get).mockResolvedValueOnce(mockProject);

    render(
      <EditorToolbar
        projectId="project-1"
        isSaving={false}
        lastSaved={null}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });

  it('should display "Project" when project name is not loaded', () => {
    vi.mocked(api.projects.get).mockRejectedValueOnce(new Error('Not found'));

    render(
      <EditorToolbar
        projectId="project-1"
        isSaving={false}
        lastSaved={null}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    expect(screen.getByText('Project')).toBeInTheDocument();
  });

  it('should render view mode toggle buttons', () => {
    render(
      <EditorToolbar
        projectId="project-1"
        isSaving={false}
        lastSaved={null}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    expect(screen.getByLabelText('Edit mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Split view')).toBeInTheDocument();
    expect(screen.getByLabelText('Preview mode')).toBeInTheDocument();
  });

  it('should call onViewModeChange when view mode button is clicked', () => {
    render(
      <EditorToolbar
        projectId="project-1"
        isSaving={false}
        lastSaved={null}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    const previewButton = screen.getByLabelText('Preview mode');
    fireEvent.click(previewButton);

    expect(mockOnViewModeChange).toHaveBeenCalledWith('preview');
  });

  it('should highlight active view mode', () => {
    const { rerender } = render(
      <EditorToolbar
        projectId="project-1"
        isSaving={false}
        lastSaved={null}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    const editButton = screen.getByLabelText('Edit mode');
    expect(editButton.className).toContain('bg-vscode-active');

    rerender(
      <EditorToolbar
        projectId="project-1"
        isSaving={false}
        lastSaved={null}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="preview"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    const previewButton = screen.getByLabelText('Preview mode');
    expect(previewButton.className).toContain('bg-vscode-active');
  });

  it('should display "Saving..." when isSaving is true', () => {
    render(
      <EditorToolbar
        projectId="project-1"
        isSaving={true}
        lastSaved={null}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('should display saved time when lastSaved is provided', () => {
    const lastSaved = new Date();
    render(
      <EditorToolbar
        projectId="project-1"
        isSaving={false}
        lastSaved={lastSaved}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    expect(screen.getByText(/Saved/)).toBeInTheDocument();
  });

  it('should display "Not saved" when not saving and no lastSaved', () => {
    render(
      <EditorToolbar
        projectId="project-1"
        isSaving={false}
        lastSaved={null}
        onToggleSidebar={mockOnToggleSidebar}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    expect(screen.getByText('Not saved')).toBeInTheDocument();
  });
});

