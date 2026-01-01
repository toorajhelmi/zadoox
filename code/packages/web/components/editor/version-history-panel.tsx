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
  const [rollingBack, setRollingBack] = useState<number | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  useEffect(() => {
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, refreshTrigger?.getTime()]);

  const previousRefreshTriggerRef = useRef<number | null>(null);

  async function loadVersions() {
    setLoading(true);
    try {
      const [versionsData, metadataData] = await Promise.all([
        api.versions.list(documentId, 100, 0),
        api.versions.getMetadata(documentId),
      ]);
      setVersions(versionsData);
      setMetadata(metadataData);
      
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
    } finally {
      setLoading(false);
    }
  }

  async function handleVersionSelect(versionNumber: number) {
    setSelectedVersion(versionNumber);
    await onVersionSelect?.(versionNumber);
  }

  async function handleRollback(versionNumber: number) {
    if (!confirm(`Are you sure you want to rollback to version ${versionNumber}? This will create a new version with the content from version ${versionNumber}.`)) {
      return;
    }

    setRollingBack(versionNumber);
    try {
      await onRollback(versionNumber);
      await loadVersions();
    } catch (error) {
      console.error('Failed to rollback:', error);
      alert('Failed to rollback version. Please try again.');
    } finally {
      setRollingBack(null);
    }
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
        <div className="flex-1 overflow-y-auto p-2">
          {versions.map((version) => {
            const isSelected = selectedVersion === version.versionNumber;
            const isRollingBack = rollingBack === version.versionNumber;
            const canRollback = metadata && version.versionNumber < metadata.currentVersion;

            return (
              <div
                key={version.id}
                className={`p-3 mb-2 rounded cursor-pointer transition-colors ${
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
                {version.changeDescription && (
                  <div className="text-xs text-vscode-text-secondary mt-1 italic">
                    {version.changeDescription}
                  </div>
                )}
                {canRollback && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRollback(version.versionNumber);
                      }}
                      disabled={isRollingBack}
                      className="text-xs px-2 py-1 rounded bg-vscode-button text-vscode-button-text hover:bg-vscode-button-hover transition-colors disabled:opacity-50"
                    >
                      <ArrowPathIcon className="w-3 h-3 inline mr-1" />
                      {isRollingBack ? 'Rolling back...' : 'Rollback'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

