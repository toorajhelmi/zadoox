'use client';

export type GeneratedContentInsertMode = 'blend' | 'replace' | 'lead' | 'conclude';

interface GeneratedContentActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  isBusy?: boolean;
  onSelect: (mode: GeneratedContentInsertMode) => void;
  onCancel: () => void;
}

export function GeneratedContentActionModal({
  isOpen,
  title,
  description,
  isBusy = false,
  onSelect,
  onCancel,
}: GeneratedContentActionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 w-96">
        <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
        <p className="text-xs text-gray-400 mb-4">{description}</p>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onSelect('blend')}
            disabled={isBusy}
            className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 transition-colors disabled:opacity-50"
          >
            Blend
          </button>
          <button
            onClick={() => onSelect('replace')}
            disabled={isBusy}
            className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 transition-colors disabled:opacity-50"
          >
            Replace
          </button>
          <button
            onClick={() => onSelect('lead')}
            disabled={isBusy}
            className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 transition-colors disabled:opacity-50"
          >
            Lead
          </button>
          <button
            onClick={() => onSelect('conclude')}
            disabled={isBusy}
            className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 transition-colors disabled:opacity-50"
          >
            Conclude
          </button>

          <button
            onClick={onCancel}
            disabled={isBusy}
            className="col-span-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


