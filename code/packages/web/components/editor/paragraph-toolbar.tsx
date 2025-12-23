'use client';

// Removed unused imports
import type { AIAnalysisResponse, AIActionType } from '@zadoox/shared';
import { formatDistanceToNow } from 'date-fns';

interface ParagraphToolbarProps {
  paragraphId: string;
  analysis?: AIAnalysisResponse;
  lastEdited?: Date;
  onAction?: (action: AIActionType) => void;
  onViewDetails?: () => void;
  visible: boolean;
}

/**
 * Paragraph Toolbar
 * Inline horizontal toolbar that appears over a paragraph, pushing content down
 */
export function ParagraphToolbar({
  paragraphId: _paragraphId,
  analysis,
  lastEdited,
  onAction,
  onViewDetails,
  visible,
}: ParagraphToolbarProps) {
  if (!visible) {
    return null;
  }

  const quality = analysis?.quality ?? 0;
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
      className="paragraph-toolbar bg-vscode-sidebar border-y border-vscode-border py-2 px-4 flex items-center justify-between gap-4 flex-wrap"
      style={{
        minHeight: '48px',
        marginTop: '8px',
        marginBottom: '8px',
      }}
    >
      {/* Left side - Status and metrics */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span style={{ color: statusColor }}>{statusIcon}</span>
          {analysis ? (
            <span className="text-sm text-vscode-text-secondary">
              Quality: {Math.round(quality)}%
            </span>
          ) : (
            <span className="text-sm text-vscode-text-secondary">Analyzing...</span>
          )}
        </div>

        {/* Metrics (only show if analysis available) */}
        {analysis && (
          <>
            <div className="text-xs text-vscode-text-secondary">
              Clarity: {Math.round(clarity)}%
            </div>
            <div className="text-xs text-vscode-text-secondary">
              Wordiness: {Math.round(wordiness)}%
            </div>
            {timeAgo && (
              <div className="text-xs text-vscode-text-secondary">
                {timeAgo}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {onAction && (
          <>
            <button
              onClick={() => onAction('improve')}
              className="px-3 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHoverBg text-vscode-buttonText rounded border border-vscode-border transition-colors"
              title="Improve this paragraph"
            >
              Improve
            </button>
            <button
              onClick={() => onAction('expand')}
              className="px-3 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHoverBg text-vscode-buttonText rounded border border-vscode-border transition-colors"
              title="Expand this paragraph"
            >
              Expand
            </button>
            <button
              onClick={() => onAction('clarify')}
              className="px-3 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHoverBg text-vscode-buttonText rounded border border-vscode-border transition-colors"
              title="Clarify this paragraph"
            >
              Clarify
            </button>
            <button
              onClick={() => onAction('condense')}
              className="px-3 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHoverBg text-vscode-buttonText rounded border border-vscode-border transition-colors"
              title="Condense this paragraph"
            >
              Condense
            </button>
            <button
              onClick={() => onAction('formalize')}
              className="px-3 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHoverBg text-vscode-buttonText rounded border border-vscode-border transition-colors"
              title="Make more formal"
            >
              Formalize
            </button>
            <button
              onClick={() => onAction('casualize')}
              className="px-3 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHoverBg text-vscode-buttonText rounded border border-vscode-border transition-colors"
              title="Make more casual"
            >
              Casualize
            </button>
          </>
        )}
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="px-3 py-1 text-xs bg-vscode-buttonBg hover:bg-vscode-buttonHoverBg text-vscode-buttonText rounded border border-vscode-border transition-colors"
            title="View detailed analysis"
          >
            Details
          </button>
        )}
      </div>
    </div>
  );
}

