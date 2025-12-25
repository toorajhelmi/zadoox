'use client';

import { useState, useEffect } from 'react';
import { ArrowPathIcon, EyeIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow, format } from 'date-fns';
import { api } from '@/lib/api/client';
import type { DocumentVersion, VersionMetadata } from '@zadoox/shared';

interface VersionHistoryPanelProps {
  documentId: string;
  onRollback: (versionNumber: number) => Promise<void>;
}

export function VersionHistoryPanel({ documentId, onRollback }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [metadata, setMetadata] = useState<VersionMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [viewingContent, setViewingContent] = useState<string | null>(null);
  const [comparingVersion, setComparingVersion] = useState<number | null>(null);
  const [compareContent, setCompareContent] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<number | null>(null);

  useEffect(() => {
    if (documentId) {
      loadVersions();
    }
  }, [documentId]);

  async function loadVersions() {
    try {
      setLoading(true);
      const [versionsData, metadataData] = await Promise.all([
        api.versions.list(documentId, 100, 0),
        api.versions.getMetadata(documentId),
      ]);
      setVersions(versionsData);
      setMetadata(metadataData);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewVersion(version: DocumentVersion) {
    setSelectedVersion(version);
    try {
      const content = await api.versions.reconstruct(documentId, version.versionNumber);
      setViewingContent(content);
    } catch (error) {
      console.error('Failed to load version content:', error);
      setViewingContent(null);
    }
  }

  async function handleCompareVersion(versionNumber: number) {
    if (comparingVersion === versionNumber) {
      setComparingVersion(null);
      setCompareContent(null);
      return;
    }

    setComparingVersion(versionNumber);
    try {
      const content = await api.versions.reconstruct(documentId, versionNumber);
      setCompareContent(content);
    } catch (error) {
      console.error('Failed to load version for comparison:', error);
      setCompareContent(null);
    }
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
        <>
          {/* Metadata */}
          {metadata && (
            <div className="p-3 bg-vscode-bg border-b border-vscode-border text-sm">
              <div className="text-vscode-text-secondary mb-1">Current Version</div>
              <div className="text-vscode-text font-semibold">v{metadata.currentVersion}</div>
              <div className="text-vscode-text-secondary text-xs mt-1">
                {metadata.totalVersions} total versions
              </div>
            </div>
          )}

          {/* Versions List */}
          <div className="flex-1 overflow-y-auto p-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className={`p-3 mb-2 rounded cursor-pointer transition-colors ${
                  selectedVersion?.id === version.id
                    ? 'bg-vscode-active border border-vscode-border'
                    : 'bg-vscode-bg hover:bg-vscode-hover border border-transparent'
                }`}
                onClick={() => handleViewVersion(version)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-vscode-text font-semibold text-sm">v{version.versionNumber}</span>
                  {version.isSnapshot && (
                    <span className="text-xs text-vscode-text-secondary bg-vscode-active px-1.5 py-0.5 rounded">
                      Snapshot
                    </span>
                  )}
                </div>
                <div className={`text-xs px-1.5 py-0.5 rounded inline-block mb-1 ${getChangeTypeColor(version.changeType)}`}>
                  {getChangeTypeLabel(version.changeType)}
                </div>
                <div className="text-xs text-vscode-text-secondary mt-1">
                  {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                </div>
                {version.changeDescription && (
                  <div className="text-xs text-vscode-text-secondary mt-1 italic">
                    {version.changeDescription}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCompareVersion(version.versionNumber);
                    }}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      comparingVersion === version.versionNumber
                        ? 'bg-vscode-button text-vscode-button-text'
                        : 'bg-vscode-active text-vscode-text-secondary hover:text-vscode-text'
                    }`}
                  >
                    <EyeIcon className="w-3 h-3 inline mr-1" />
                    Compare
                  </button>
                  {version.versionNumber < (metadata?.currentVersion || 0) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRollback(version.versionNumber);
                      }}
                      disabled={rollingBack === version.versionNumber}
                      className="text-xs px-2 py-1 rounded bg-vscode-button text-vscode-button-text hover:bg-vscode-button-hover transition-colors disabled:opacity-50"
                    >
                      <ArrowPathIcon className="w-3 h-3 inline mr-1" />
                      {rollingBack === version.versionNumber ? 'Rolling back...' : 'Rollback'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Version Content View (if selected) */}
          {selectedVersion && viewingContent !== null && (
            <div className="border-t border-vscode-border p-3 bg-vscode-bg max-h-64 overflow-y-auto">
              <div className="mb-2">
                <h4 className="text-vscode-text font-semibold text-sm mb-1">
                  Version {selectedVersion.versionNumber}
                </h4>
                <div className="text-xs text-vscode-text-secondary mb-2">
                  {format(new Date(selectedVersion.createdAt), 'PPpp')}
                </div>
              </div>
              {comparingVersion && compareContent && comparingVersion !== selectedVersion.versionNumber ? (
                <div>
                  <div className="text-xs text-vscode-text-secondary mb-2">Comparison</div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="text-vscode-text-secondary mb-1">v{selectedVersion.versionNumber}</div>
                      <pre className="bg-vscode-sidebar p-2 rounded text-xs text-vscode-text whitespace-pre-wrap font-mono overflow-auto max-h-24">
                        {viewingContent.substring(0, 200)}...
                      </pre>
                    </div>
                    <div>
                      <div className="text-vscode-text-secondary mb-1">v{comparingVersion}</div>
                      <pre className="bg-vscode-sidebar p-2 rounded text-xs text-vscode-text whitespace-pre-wrap font-mono overflow-auto max-h-24">
                        {compareContent.substring(0, 200)}...
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <pre className="bg-vscode-sidebar p-2 rounded text-xs text-vscode-text whitespace-pre-wrap font-mono overflow-auto max-h-48">
                  {viewingContent.substring(0, 500)}...
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

