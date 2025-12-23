'use client';

// Removed unused imports
import type { AIAnalysisResponse, AIActionType } from '@zadoox/shared';
import { formatDistanceToNow } from 'date-fns';

interface ParagraphInfoBannerProps {
  paragraphId: string;
  analysis?: AIAnalysisResponse;
  lastEdited?: Date;
  onAction?: (action: AIActionType) => void;
  onViewDetails?: () => void;
  position: { top: number; left: number };
  visible: boolean;
}

/**
 * Paragraph Info Banner
 * Shows metadata and quick actions when hovering over a paragraph
 */
export function ParagraphInfoBanner({
  paragraphId: _paragraphId,
  analysis,
  lastEdited,
  onAction,
  onViewDetails,
  position: _position,
  visible,
}: ParagraphInfoBannerProps) {
  // Removed auto-hide timer - menu should stay open while mouse is over it

  if (!visible) {
    return null;
  }

  const quality = analysis?.quality ?? 0;
  const sentiment = analysis?.sentiment ?? 'neutral';
  const wordiness = analysis?.wordiness ?? 50;
  const clarity = analysis?.clarity ?? 50;

  // Determine status color
  let statusColor = '#858585'; // Gray (pending)
  let statusIcon = '⚪';
  if (analysis) {
    if (quality < 60) {
      statusColor = '#f48771'; // Red
      statusIcon = '🔴';
    } else if (quality < 80) {
      statusColor = '#dcdcaa'; // Yellow
      statusIcon = '🟡';
    } else {
      statusColor = '#4ec9b0'; // Green
      statusIcon = '🟢';
    }
  }

  // Only show time if we have analysis data
  const timeAgo = lastEdited && analysis ? formatDistanceToNow(lastEdited, { addSuffix: true }) : null;

  return (
    <div
      className="paragraph-info-banner bg-vscode-sidebar border border-vscode-border rounded shadow-lg p-3"
      style={{
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        width: '280px',
        maxWidth: '280px',
      }}
      // Mouse events are handled by parent wrapper div
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-vscode-text-secondary flex-wrap">
          {analysis ? (
            <>
              {timeAgo && (
                <>
                  <span>{timeAgo}</span>
                  <span>•</span>
                </>
              )}
              <span>Quality: {quality}%</span>
              <span>•</span>
              <span style={{ color: statusColor }}>{statusIcon}</span>
            </>
          ) : (
            <span className="text-vscode-text-secondary">Analyzing paragraph...</span>
          )}
        </div>
      </div>

      {/* Metrics */}
      {analysis && (
        <div className="grid grid-cols-3 gap-2 mb-3 text-xs text-vscode-text-secondary">
          <div>
            <span className="font-semibold">Sentiment:</span> {sentiment}
          </div>
          <div>
            <span className="font-semibold">Wordiness:</span> {wordiness}%
          </div>
          <div>
            <span className="font-semibold">Clarity:</span> {clarity}%
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onAction?.('improve')}
          className="px-3 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHover text-vscode-buttonText rounded transition-colors"
        >
          Improve
        </button>
        <button
          onClick={() => onAction?.('expand')}
          className="px-3 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHover text-vscode-buttonText rounded transition-colors"
        >
          Expand
        </button>
        <button
          onClick={() => onAction?.('clarify')}
          className="px-3 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHover text-vscode-buttonText rounded transition-colors"
        >
          Clarify
        </button>
        <button
          onClick={() => onAction?.('condense')}
          className="px-3 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHover text-vscode-buttonText rounded transition-colors"
        >
          Condense
        </button>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="px-3 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHover text-vscode-buttonText rounded transition-colors"
          >
            Details
          </button>
        )}
      </div>
    </div>
  );
}

