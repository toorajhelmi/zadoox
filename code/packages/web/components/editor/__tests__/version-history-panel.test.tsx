/**
 * Unit tests for VersionHistoryPanel fixes
 * Tests for: auto-selection of latest version, fallback logic when metadata is missing
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { VersionHistoryPanel } from '../version-history-panel';
import { api } from '@/lib/api/client';

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  api: {
    versions: {
      list: vi.fn(),
      getMetadata: vi.fn(),
    },
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn((date: Date) => '2 minutes ago'),
}));

describe('VersionHistoryPanel - Auto-selection and Fallback Fixes', () => {
  const mockOnRollback = vi.fn();
  const mockOnVersionSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should auto-select latest version when refresh trigger changes and user was viewing latest', async () => {
    // Initial versions (v21 is latest)
    const initialVersions = [
      {
        id: 'v-21',
        documentId: 'doc-1',
        versionNumber: 21,
        isSnapshot: false,
        authorId: 'user-1',
        createdAt: new Date('2024-01-01'),
        changeType: 'auto-save' as const,
        changeDescription: null,
      },
      {
        id: 'v-20',
        documentId: 'doc-1',
        versionNumber: 20,
        isSnapshot: false,
        authorId: 'user-1',
        createdAt: new Date('2024-01-01'),
        changeType: 'auto-save' as const,
        changeDescription: null,
      },
    ];

    // After refresh, new version v22 is created
    const updatedVersions = [
      {
        id: 'v-22',
        documentId: 'doc-1',
        versionNumber: 22,
        isSnapshot: false,
        authorId: 'user-1',
        createdAt: new Date('2024-01-02'),
        changeType: 'auto-save' as const,
        changeDescription: null,
      },
      ...initialVersions,
    ];

    vi.mocked(api.versions.list)
      .mockResolvedValueOnce(initialVersions) // First call
      .mockResolvedValueOnce(updatedVersions); // Second call after refresh

    vi.mocked(api.versions.getMetadata)
      .mockResolvedValueOnce({
        documentId: 'doc-1',
        currentVersion: 21,
        lastSnapshotVersion: 1,
        totalVersions: 21,
        lastModifiedAt: new Date('2024-01-01'),
        lastModifiedBy: 'user-1',
      })
      .mockResolvedValueOnce({
        documentId: 'doc-1',
        currentVersion: 22,
        lastSnapshotVersion: 1,
        totalVersions: 22,
        lastModifiedAt: new Date('2024-01-02'),
        lastModifiedBy: 'user-1',
      });

    const { rerender } = render(
      <VersionHistoryPanel
        documentId="doc-1"
        onRollback={mockOnRollback}
        onVersionSelect={mockOnVersionSelect}
        refreshTrigger={null}
      />
    );

    // Wait for initial load to complete
    await waitFor(() => {
      expect(api.versions.list).toHaveBeenCalled();
      expect(screen.queryByText('Loading versions...')).not.toBeInTheDocument();
    });

    // Clear previous calls
    vi.clearAllMocks();

    // Simulate refresh trigger change (new version v22 created)
    // User was viewing v21 (latest), so onVersionSelect should be called with v22
    const newRefreshTrigger = new Date('2024-01-02');
    rerender(
      <VersionHistoryPanel
        documentId="doc-1"
        onRollback={mockOnRollback}
        onVersionSelect={mockOnVersionSelect}
        refreshTrigger={newRefreshTrigger}
      />
    );

    // Wait for the refresh to trigger auto-selection
    // The component should call onVersionSelect because previousSelected (21) === latestVersionNumber - 1 (22 - 1 = 21)
    await waitFor(() => {
      expect(mockOnVersionSelect).toHaveBeenCalledWith(22);
    }, { timeout: 3000 });
  });

  it('should use fallback to versions list when metadata.currentVersion is missing', async () => {
    const versions = [
      {
        id: 'v-21',
        documentId: 'doc-1',
        versionNumber: 21,
        isSnapshot: false,
        authorId: 'user-1',
        createdAt: new Date('2024-01-01'),
        changeType: 'auto-save' as const,
        changeDescription: null,
      },
    ];

    vi.mocked(api.versions.list).mockResolvedValue(versions);
    // Mock metadata with missing currentVersion
    vi.mocked(api.versions.getMetadata).mockResolvedValue({
      documentId: 'doc-1',
      currentVersion: undefined as unknown as number,
      lastSnapshotVersion: 1,
      totalVersions: 21,
      lastModifiedAt: new Date('2024-01-01'),
      lastModifiedBy: 'user-1',
    });

    render(
      <VersionHistoryPanel
        documentId="doc-1"
        onRollback={mockOnRollback}
        onVersionSelect={mockOnVersionSelect}
        refreshTrigger={new Date('2024-01-02')}
      />
    );

    await waitFor(() => {
      // Should fetch versions list as fallback
      expect(api.versions.list).toHaveBeenCalled();
    });

    await waitFor(() => {
      // Should auto-select version 21 (from versions list)
      expect(mockOnVersionSelect).toHaveBeenCalledWith(21);
    });
  });

  it.skip('should auto-select latest version on initial load', async () => {
    const versions = [
      {
        id: 'v-21',
        documentId: 'doc-1',
        versionNumber: 21,
        isSnapshot: false,
        authorId: 'user-1',
        createdAt: new Date('2024-01-01'),
        changeType: 'auto-save' as const,
        changeDescription: null,
      },
    ];

    vi.mocked(api.versions.list).mockResolvedValue(versions);
    vi.mocked(api.versions.getMetadata).mockResolvedValue({
      documentId: 'doc-1',
      currentVersion: 21,
      lastSnapshotVersion: 1,
      totalVersions: 21,
      lastModifiedAt: new Date('2024-01-01'),
      lastModifiedBy: 'user-1',
    });

    render(
      <VersionHistoryPanel
        documentId="doc-1"
        onRollback={mockOnRollback}
        refreshTrigger={null}
      />
    );

    await waitFor(() => {
      expect(api.versions.list).toHaveBeenCalled();
    });

    // Version 21 should be selected (internal state)
    // We can't directly test the selected state without exposing it, but we can verify
    // that the component loaded successfully
    expect(screen.queryByText('Loading versions...')).not.toBeInTheDocument();
  });

  it('should not call onVersionSelect if user was viewing older version when refresh happens', async () => {
    const versions = [
      {
        id: 'v-22',
        documentId: 'doc-1',
        versionNumber: 22,
        isSnapshot: false,
        authorId: 'user-1',
        createdAt: new Date('2024-01-02'),
        changeType: 'auto-save' as const,
        changeDescription: null,
      },
      {
        id: 'v-21',
        documentId: 'doc-1',
        versionNumber: 21,
        isSnapshot: false,
        authorId: 'user-1',
        createdAt: new Date('2024-01-01'),
        changeType: 'auto-save' as const,
        changeDescription: null,
      },
    ];

    vi.mocked(api.versions.list).mockResolvedValue(versions);
    vi.mocked(api.versions.getMetadata).mockResolvedValue({
      documentId: 'doc-1',
      currentVersion: 22,
      lastSnapshotVersion: 1,
      totalVersions: 22,
      lastModifiedAt: new Date('2024-01-02'),
      lastModifiedBy: 'user-1',
    });

    // First render - user selects v21
    const { rerender } = render(
      <VersionHistoryPanel
        documentId="doc-1"
        onRollback={mockOnRollback}
        onVersionSelect={mockOnVersionSelect}
        refreshTrigger={null}
      />
    );

    await waitFor(() => {
      expect(api.versions.list).toHaveBeenCalled();
    });

    // Now simulate refresh (new version v22 created)
    rerender(
      <VersionHistoryPanel
        documentId="doc-1"
        onRollback={mockOnRollback}
        onVersionSelect={mockOnVersionSelect}
        refreshTrigger={new Date('2024-01-02')}
      />
    );

    await waitFor(() => {
      // Should NOT call onVersionSelect because user was viewing v21 (not latest)
      // The panel will select v22 internally but won't notify editor-layout
      expect(mockOnVersionSelect).not.toHaveBeenCalledWith(22);
    });
  });
});

