/**
 * Unit tests for EditorToolbar component (Phase 7)
 * Focus: Core functionality only
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorToolbar } from '../editor-toolbar';

// Mock useRouter
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

describe('EditorToolbar', () => {
  const mockOnViewModeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render IR preview view mode button', () => {
    render(
      <EditorToolbar
        projectId="project-1"
        documentTitle="Test Document"
        isSaving={false}
        lastSaved={null}
        viewMode="edit"
        onViewModeChange={mockOnViewModeChange}
      />
    );

    expect(screen.getByLabelText('IR preview')).toBeInTheDocument();
  });
});
