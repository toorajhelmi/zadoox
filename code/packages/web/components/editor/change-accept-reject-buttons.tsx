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
 */
export function ChangeAcceptRejectButtons({
  onAccept,
  onReject,
  acceptedCount,
  totalCount,
}: ChangeAcceptRejectButtonsProps) {
  return (
    <div className="absolute bottom-4 right-4 flex gap-2 z-50 pointer-events-auto">
      <button
        onClick={onReject}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded border border-gray-600 transition-colors flex items-center gap-2"
      >
        <span>Undo</span>
        <span className="text-xs text-gray-400">⌘Z</span>
      </button>
      <button
        onClick={onAccept}
        disabled={acceptedCount === 0}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors flex items-center gap-2"
      >
        <span>Keep</span>
        {acceptedCount > 0 && (
          <span className="text-xs opacity-75">({acceptedCount}/{totalCount})</span>
        )}
      </button>
    </div>
  );
}

