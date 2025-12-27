'use client';

// Removed unused imports
import type { AIAnalysisResponse, AIActionType } from '@zadoox/shared';
import { formatDistanceToNow } from 'date-fns';

interface ParagraphToolbarProps {
  paragraphId: string;
  analysis?: AIAnalysisResponse;
  previousAnalysis?: AIAnalysisResponse; // Previous analysis to show deltas
  lastEdited?: Date;
  onAction?: (action: AIActionType) => void;
  onViewDetails?: () => void;
  visible: boolean;
  isProcessing?: boolean;
  processingAction?: AIActionType;
}

/**
 * Paragraph Toolbar
 * Inline horizontal toolbar that appears over a paragraph, pushing content down
 */
export function ParagraphToolbar({
  paragraphId: _paragraphId,
  analysis,
  previousAnalysis,
  lastEdited,
  onAction,
  onViewDetails,
  visible,
  isProcessing = false,
  processingAction,
}: ParagraphToolbarProps) {
  if (!visible) {
    return null;
  }

  // Get action label
  const getActionLabel = (action?: AIActionType): string => {
    switch (action) {
      case 'improve': return 'Improving';
      case 'expand': return 'Expanding';
      case 'clarify': return 'Clarifying';
      case 'condense': return 'Condensing';
      case 'formalize': return 'Formalizing';
      case 'casualize': return 'Casualizing';
      default: return 'Processing';
    }
  };

  const quality = analysis?.quality ?? 0;
  const wordiness = analysis?.wordiness ?? 50;
  const clarity = analysis?.clarity ?? 50;

  // Calculate deltas if we have previous analysis (show changes after AI action)
  const qualityDelta = previousAnalysis && analysis ? Math.round(quality - previousAnalysis.quality) : null;
  const clarityDelta = previousAnalysis && analysis ? Math.round(clarity - previousAnalysis.clarity) : null;
  const wordinessDelta = previousAnalysis && analysis ? Math.round(wordiness - previousAnalysis.wordiness) : null;

  // Format delta with sign and color
  const formatDelta = (delta: number | null): { text: string; color: string } | null => {
    if (delta === null || delta === 0) return null;
    const sign = delta > 0 ? '+' : '';
    const color = delta > 0 ? '#4ec9b0' : '#f48771'; // Green for positive, red for negative
    return { text: `${sign}${delta}`, color };
  };

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

  // Show progress spinner when processing
  if (isProcessing) {
    return (
      <div
        className="paragraph-toolbar bg-vscode-sidebar border-y border-vscode-border py-2 px-4 flex items-center justify-center"
        style={{
          minHeight: '48px',
          marginTop: '8px',
          marginBottom: '8px',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-vscode-blue border-t-transparent"></div>
          <span className="text-sm text-vscode-text-secondary">
            {getActionLabel(processingAction)} paragraph...
          </span>
        </div>
      </div>
    );
  }

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
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span style={{ color: statusColor }}>{statusIcon}</span>
          {analysis ? (
            <span className="text-sm text-vscode-text-secondary">
              Quality: {Math.round(quality)}%
              {formatDelta(qualityDelta) && (
                <span style={{ color: formatDelta(qualityDelta)!.color, marginLeft: '4px' }}>
                  ({formatDelta(qualityDelta)!.text})
                </span>
              )}
            </span>
          ) : (
            <span className="text-sm text-vscode-text-secondary">Analyzing...</span>
          )}
        </div>

        {/* Metrics (only show if analysis available) */}
        {analysis && (
          <>
            <span className="text-vscode-text-secondary opacity-50">|</span>
            <div className="text-xs text-vscode-text-secondary">
              Clarity: {Math.round(clarity)}%
              {formatDelta(clarityDelta) && (
                <span style={{ color: formatDelta(clarityDelta)!.color, marginLeft: '4px' }}>
                  ({formatDelta(clarityDelta)!.text})
                </span>
              )}
            </div>
            <span className="text-vscode-text-secondary opacity-50">|</span>
            <div className="text-xs text-vscode-text-secondary">
              Wordiness: {Math.round(wordiness)}%
              {formatDelta(wordinessDelta) && (
                <span style={{ color: formatDelta(wordinessDelta)!.color, marginLeft: '4px' }}>
                  ({formatDelta(wordinessDelta)!.text})
                </span>
              )}
            </div>
            {timeAgo && (
              <>
                <span className="text-vscode-text-secondary opacity-50">|</span>
                <div className="text-xs text-vscode-text-secondary">
                  {timeAgo}
                </div>
              </>
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

