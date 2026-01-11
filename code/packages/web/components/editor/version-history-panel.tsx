'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/lib/api/client';
import type { DocumentVersion, VersionMetadata } from '@zadoox/shared';

interface VersionHistoryPanelProps {
  documentId: string;
  onRollback: (versionNumber: number) => Promise<void>;
  onVersionSelect?: (versionNumber: number) => Promise<void>;
  refreshTrigger?: Date | null; // When this changes, refresh versions
}

export function VersionHistoryPanel({ documentId, onRollback, onVersionSelect, refreshTrigger }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [metadata, setMetadata] = useState<VersionMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rollingBack, setRollingBack] = useState<number | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmVersionNumber, setConfirmVersionNumber] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const PAGE_SIZE = 20;
  const isFetchingRef = useRef(false);
  const lastLoadKeyRef = useRef<string>('');
  const pendingLoadKeyRef = useRef<string>('');
  const initialLoadedKeyRef = useRef<string>('');

  useEffect(() => {
    if (!documentId) return;
    const key = `${documentId || ''}:${refreshTrigger?.getTime() ?? 'null'}`;
    if (key === lastLoadKeyRef.current || key === pendingLoadKeyRef.current) return;
    pendingLoadKeyRef.current = key;
    setOffset(0);
    setVersions([]);
    setHasMore(false);
    loadVersions(true, key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, refreshTrigger?.getTime()]);

  const previousRefreshTriggerRef = useRef<number | null>(null);

  async function loadVersions(reset = false, keyForLoad?: string) {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!documentId || documentId === 'default') {
      isFetchingRef.current = false;
      return;
    }
    let pageOffset = reset ? 0 : offset;
    // Prevent a second reset load after the initial one completes for this key.
    if (reset && initialLoadedKeyRef.current === (keyForLoad || lastLoadKeyRef.current) && offset > 0) {
      reset = false;
      pageOffset = offset;
    }
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const [versionsData, metadataData] = await Promise.all([
        api.versions.list(documentId, PAGE_SIZE, pageOffset),
        api.versions.getMetadata(documentId),
      ]);
      setVersions((prev) => (reset ? versionsData : [...prev, ...versionsData]));
      setMetadata(metadataData);
      // If we got a full page, assume there may be more. This is resilient even if the backend
      // returns slightly over/under the requested page size.
      setHasMore(versionsData.length >= PAGE_SIZE);
      setOffset((prev) => (reset ? versionsData.length : prev + versionsData.length));
      if (reset && keyForLoad) {
        lastLoadKeyRef.current = keyForLoad;
        pendingLoadKeyRef.current = '';
        initialLoadedKeyRef.current = keyForLoad;
      }
      
      if (metadataData || versionsData.length > 0) {
        // Get the latest version - use metadata if available, otherwise use first version from list
        let latestVersionNumber: number | null = null;
        if (metadataData?.currentVersion !== undefined && metadataData.currentVersion !== null) {
          latestVersionNumber = Number(metadataData.currentVersion);
        } else if (versionsData.length > 0) {
          // Fallback: first version in list is the latest (sorted DESC)
          latestVersionNumber = versionsData[0].versionNumber;
        }
        
        const currentRefreshTime = refreshTrigger?.getTime() ?? null;
        const isRefresh = currentRefreshTime !== null && previousRefreshTriggerRef.current !== currentRefreshTime;
        
        // If refresh was triggered (new version created), automatically select the latest version
        if (isRefresh && latestVersionNumber !== null) {
          // New version was created - select the latest version in the panel
          const previousSelected = selectedVersion;
          setSelectedVersion(latestVersionNumber);
          // Notify editor-layout to update its state (only if we were viewing the latest before)
          // If user was viewing an older version, they should stay on that version (read-only)
          if (onVersionSelect && (previousSelected === null || previousSelected === latestVersionNumber - 1)) {
            // We were viewing the latest, so update to new latest
            await onVersionSelect(latestVersionNumber);
          }
          previousRefreshTriggerRef.current = currentRefreshTime;
        } else if (selectedVersion === null && latestVersionNumber !== null) {
          // Initial load - select the latest version
          setSelectedVersion(latestVersionNumber);
        }
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
      // If we already have versions, keep them. Otherwise, leave loading spinner visible.
      if (versions.length === 0 && reset) {
        setVersions([]);
        setMetadata(null);
        setHasMore(false);
        setOffset(0);
      }
    } finally {
      if (reset) setLoading(false);
      setLoadingMore(false);
      if (reset && keyForLoad && pendingLoadKeyRef.current === keyForLoad) {
        pendingLoadKeyRef.current = '';
      }
      isFetchingRef.current = false;
    }
  }

  async function handleVersionSelect(versionNumber: number) {
    setSelectedVersion(versionNumber);
    await onVersionSelect?.(versionNumber);
  }

  async function handleRollback(versionNumber: number) {
    setRollingBack(versionNumber);
    try {
      await onRollback(versionNumber);
      await loadVersions(true);
    } catch (error) {
      console.error('Failed to rollback:', error);
      alert('Failed to restore version. Please try again.');
    } finally {
      setRollingBack(null);
    }
  }

  function openConfirm(versionNumber: number) {
    setConfirmVersionNumber(versionNumber);
    setConfirmOpen(true);
  }

  async function confirmRestore() {
    if (confirmVersionNumber === null) return;
    await handleRollback(confirmVersionNumber);
    setConfirmOpen(false);
    setConfirmVersionNumber(null);
  }

  function getChangeTypeLabel(changeType: string): string {
    switch (changeType) {
      case 'manual-save':
        return 'Manual Save';
      case 'auto-save':
        return 'Auto Save';
      case 'ai-action':
        return 'AI Action';
      case 'milestone':
        return 'Milestone';
      case 'rollback':
        return 'Rollback';
      default:
        return changeType;
    }
  }

  function getChangeTypeColor(changeType: string): string {
    switch (changeType) {
      case 'manual-save':
        return 'bg-blue-500/20 text-blue-400';
      case 'auto-save':
        return 'bg-gray-500/20 text-gray-400';
      case 'ai-action':
        return 'bg-purple-500/20 text-purple-400';
      case 'milestone':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'rollback':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  }

  return (
    <div className="h-full flex flex-col">
      {loading ? (
        <div className="p-4 text-vscode-text-secondary text-center">Loading versions...</div>
      ) : versions.length === 0 ? (
        <div className="p-4 text-vscode-text-secondary text-center">No versions found</div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {versions.map((version) => {
            const isSelected = selectedVersion === version.versionNumber;
            const isRollingBack = rollingBack === version.versionNumber;
            const latestVersionNumber =
              metadata?.currentVersion !== undefined && metadata?.currentVersion !== null
                ? Number(metadata.currentVersion)
                : versions.length > 0
                  ? versions[0]!.versionNumber
                  : null;
            const canRollback = latestVersionNumber !== null && version.versionNumber < latestVersionNumber;

            return (
              <div
                key={version.id}
                className={`group p-2 rounded cursor-pointer transition-colors min-h-[64px] ${
                  isSelected
                    ? 'bg-vscode-active border border-vscode-border'
                    : 'bg-vscode-bg hover:bg-vscode-hover border border-transparent'
                }`}
                onClick={() => handleVersionSelect(version.versionNumber)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-vscode-text font-semibold text-sm">v{version.versionNumber}</span>
                  <div className="flex items-center gap-1">
                    {version.isSnapshot && (
                      <span className="text-xs text-vscode-text-secondary bg-vscode-active px-1.5 py-0.5 rounded">
                        Snapshot
                      </span>
                    )}
                    {version.changeType === 'rollback' && (
                      <span className="text-xs text-vscode-text-secondary bg-vscode-active px-1.5 py-0.5 rounded">
                        {version.changeDescription?.match(/Restored version\s*(v?\d+)/i)?.[1]
                          ? `Restored ${version.changeDescription.match(/Restored version\s*(v?\d+)/i)![1]}`
                          : 'Restored'}
                      </span>
                    )}
                    {version.changeType === 'ai-action' && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${getChangeTypeColor(version.changeType)}`}
                      >
                        {getChangeTypeLabel(version.changeType)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-vscode-text-secondary mt-1">
                  {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                </div>
                {version.changeDescription && version.changeType !== 'rollback' && (
                  <div className="text-xs text-vscode-text-secondary mt-1 line-clamp-1">
                    {version.changeDescription}
                  </div>
                )}
                {canRollback && (
                  <div className="hidden group-hover:flex items-center justify-end gap-2 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openConfirm(version.versionNumber);
                      }}
                      disabled={isRollingBack}
                      className="text-xs px-2 py-1 rounded bg-vscode-button text-vscode-button-text hover:bg-vscode-button-hover transition-colors disabled:opacity-50"
                    >
                      <ArrowPathIcon className="w-3 h-3 inline mr-1" />
                      {isRollingBack ? 'Restoring...' : 'Restore'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {hasMore && (
            <div className="mt-2">
              <button
                className="w-full text-xs px-2 py-1 rounded border border-vscode-border bg-vscode-buttonBg text-vscode-text hover:bg-vscode-buttonHoverBg transition-colors disabled:opacity-50"
                onClick={() => loadVersions(false)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

      {confirmOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded border border-vscode-border bg-vscode-editorBg shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border">
              <div className="text-sm font-semibold text-vscode-text">
                Restore version {confirmVersionNumber !== null ? `v${confirmVersionNumber}` : ''}
              </div>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-vscode-border bg-vscode-buttonBg text-vscode-text hover:bg-vscode-buttonHoverBg transition-colors"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmVersionNumber(null);
                }}
                disabled={rollingBack !== null}
              >
                Close
              </button>
            </div>

            <div className="px-4 py-3 text-xs text-vscode-text-secondary">
              This will overwrite the current document content and create a new version entry marked as{' '}
              <span className="font-semibold">Rollback</span>.
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-vscode-border">
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded border border-vscode-border bg-vscode-buttonBg text-vscode-text hover:bg-vscode-buttonHoverBg transition-colors"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmVersionNumber(null);
                }}
                disabled={rollingBack !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                onClick={confirmRestore}
                disabled={rollingBack !== null || confirmVersionNumber === null}
              >
                {rollingBack !== null ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

