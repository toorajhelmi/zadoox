'use client';

interface ChangeAcceptRejectButtonsProps {
  onAccept: () => void;
  onReject: () => void;
  acceptedCount: number;
  totalCount: number;
}

/**
 * Bottom-right buttons for accepting/rejecting all changes
 * Similar to Cursor's "Keep" and "Undo" buttons
 * Uses fixed positioning to stick to viewport bottom-right
 */
export function ChangeAcceptRejectButtons({
  onAccept,
  onReject,
  acceptedCount: _acceptedCount,
  totalCount,
}: ChangeAcceptRejectButtonsProps) {
  return (
    <div className="fixed bottom-20 right-4 flex gap-2 z-[100] pointer-events-auto shadow-lg">
      <button
        onClick={onReject}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded border border-gray-600 transition-colors flex items-center gap-2"
      >
        <span>Undo</span>
        <span className="text-xs text-gray-400">⌘N</span>
      </button>
      <button
        onClick={onAccept}
        disabled={totalCount === 0}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors flex items-center gap-2"
      >
        <span>Keep</span>
        <span className="text-xs opacity-75">⌘Y</span>
        {totalCount > 0 && (
          <span className="text-xs opacity-75 ml-1">({totalCount})</span>
        )}
      </button>
    </div>
  );
}

