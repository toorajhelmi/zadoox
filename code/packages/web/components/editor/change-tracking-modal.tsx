'use client';

import { useState } from 'react';
import type { ChangeBlock } from '@zadoox/shared';

interface ChangeTrackingModalProps {
  changes: ChangeBlock[];
  originalContent: string;
  newContent: string;
  onAccept: (changeId: string) => void;
  onReject: (changeId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onApply: () => void;
  onCancel: () => void;
  title?: string;
}

/**
 * Modal for reviewing and accepting/rejecting AI-generated changes
 */
export function ChangeTrackingModal({
  changes,
  originalContent,
  newContent,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  onApply,
  onCancel,
  title = 'Review AI Changes',
}: ChangeTrackingModalProps) {
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);

  const pendingChanges = changes.filter(c => c.accepted === undefined);
  const acceptedChanges = changes.filter(c => c.accepted === true);
  const rejectedChanges = changes.filter(c => c.accepted === false);

  const getChangeColor = (type: ChangeBlock['type']) => {
    switch (type) {
      case 'add':
        return 'bg-green-900/30 border-green-600';
      case 'delete':
        return 'bg-red-900/30 border-red-600';
      case 'modify':
        return 'bg-blue-900/30 border-blue-600';
      default:
        return 'bg-gray-800 border-gray-600';
    }
  };

  const getChangeIcon = (type: ChangeBlock['type']) => {
    switch (type) {
      case 'add':
        return '+';
      case 'delete':
        return '-';
      case 'modify':
        return '~';
      default:
        return '?';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-[90vw] max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 p-4 border-b border-gray-800 bg-gray-950">
          <div className="text-sm text-gray-400">
            <span className="text-white font-semibold">{pendingChanges.length}</span> pending
          </div>
          <div className="text-sm text-gray-400">
            <span className="text-green-500 font-semibold">{acceptedChanges.length}</span> accepted
          </div>
          <div className="text-sm text-gray-400">
            <span className="text-red-500 font-semibold">{rejectedChanges.length}</span> rejected
          </div>
          <div className="flex-1" />
          <button
            onClick={onAcceptAll}
            disabled={pendingChanges.length === 0}
            className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
          >
            Accept All
          </button>
          <button
            onClick={onRejectAll}
            disabled={pendingChanges.length === 0}
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
          >
            Reject All
          </button>
        </div>

        {/* Changes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {changes.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No changes to review</div>
          ) : (
            changes.map((change) => {
              const isPending = change.accepted === undefined;
              const isAccepted = change.accepted === true;
              const isRejected = change.accepted === false;

              return (
                <div
                  key={change.id}
                  className={`p-3 rounded border ${getChangeColor(change.type)} ${
                    selectedChangeId === change.id ? 'ring-2 ring-blue-500' : ''
                  } ${isRejected ? 'opacity-50' : ''}`}
                  onClick={() => setSelectedChangeId(change.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-800">
                          {getChangeIcon(change.type)} {change.type}
                        </span>
                        {isAccepted && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-900 text-green-200">
                            Accepted
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-900 text-red-200">
                            Rejected
                          </span>
                        )}
                      </div>

                      {change.type === 'delete' && change.originalText && (
                        <div className="mb-2">
                          <div className="text-xs text-gray-400 mb-1">Deleted:</div>
                          <div className="text-sm text-red-300 line-through bg-red-950/30 p-2 rounded">
                            {change.originalText.substring(0, 200)}
                            {change.originalText.length > 200 && '...'}
                          </div>
                        </div>
                      )}

                      {change.type === 'add' && change.newText && (
                        <div className="mb-2">
                          <div className="text-xs text-gray-400 mb-1">Added:</div>
                          <div className="text-sm text-green-300 bg-green-950/30 p-2 rounded">
                            {change.newText.substring(0, 200)}
                            {change.newText.length > 200 && '...'}
                          </div>
                        </div>
                      )}

                      {change.type === 'modify' && (
                        <div className="space-y-2">
                          {change.originalText && (
                            <div>
                              <div className="text-xs text-gray-400 mb-1">Original:</div>
                              <div className="text-sm text-red-300 line-through bg-red-950/30 p-2 rounded">
                                {change.originalText.substring(0, 150)}
                                {change.originalText.length > 150 && '...'}
                              </div>
                            </div>
                          )}
                          {change.newText && (
                            <div>
                              <div className="text-xs text-gray-400 mb-1">New:</div>
                              <div className="text-sm text-green-300 bg-green-950/30 p-2 rounded">
                                {change.newText.substring(0, 150)}
                                {change.newText.length > 150 && '...'}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAccept(change.id);
                          }}
                          className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReject(change.id);
                          }}
                          className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-800">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            disabled={acceptedChanges.length === 0}
            className="px-4 py-2 text-sm bg-vscode-blue hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
          >
            Apply Changes ({acceptedChanges.length})
          </button>
        </div>
      </div>
    </div>
  );
}

