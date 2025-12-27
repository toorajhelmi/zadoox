'use client';

import { useState } from 'react';
import type { IdeaCard as IdeaCardType } from '@zadoox/shared';

interface IdeaCardProps {
  idea: IdeaCardType;
  onDelete: (id: string) => void;
  onUse: (idea: IdeaCardType) => void;
}

export function IdeaCard({ idea, onDelete, onUse }: IdeaCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-left w-full flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-xs">💡</span>
            <span className="text-xs font-semibold text-gray-400 flex-1 truncate">
              {idea.topic}
            </span>
            <span className="text-xs text-gray-500">
              {isExpanded ? '▼' : '▶'}
            </span>
          </button>
          {isExpanded && (
            <div className="mt-1 text-xs text-gray-400 pl-4">
              {idea.description}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUse(idea)}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors"
            title="Use this idea to generate content"
          >
            Use
          </button>
          <button
            onClick={() => onDelete(idea.id)}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-400 hover:bg-gray-800 rounded transition-colors"
            title="Delete this idea"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

