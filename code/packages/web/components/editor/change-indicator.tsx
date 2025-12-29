'use client';

import { useState } from 'react';
import type { ChangeBlock } from '@zadoox/shared';

interface ChangeIndicatorProps {
  change: ChangeBlock;
  onAccept: (changeId: string) => void;
  onReject: (changeId: string) => void;
  position: { from: number; to: number };
}

/**
 * Inline change indicator widget for CodeMirror
 * Shows a small badge with Accept/Reject buttons
 */
export function ChangeIndicator({ change, onAccept, onReject }: ChangeIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getChangeColor = () => {
    switch (change.type) {
      case 'add':
        return 'bg-green-900/50 border-green-600';
      case 'delete':
        return 'bg-red-900/50 border-red-600';
      case 'modify':
        return 'bg-blue-900/50 border-blue-600';
      default:
        return 'bg-gray-800 border-gray-600';
    }
  };

  const getChangeLabel = () => {
    switch (change.type) {
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
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border ${getChangeColor()} cursor-pointer transition-opacity ${isHovered ? 'opacity-100' : 'opacity-70'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="text-gray-300">{getChangeLabel()}</span>
      {isHovered && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAccept(change.id);
            }}
            className="px-1.5 py-0.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            title="Accept change"
          >
            ✓
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject(change.id);
            }}
            className="px-1.5 py-0.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            title="Reject change"
          >
            ✕
          </button>
        </>
      )}
    </span>
  );
}

