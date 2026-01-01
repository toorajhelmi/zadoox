'use client';

import type { InlineWizardProps } from './types';

export function TodoWizard({ ctx, onCancel, onCloseAll }: InlineWizardProps) {
  return (
    <div className="p-3">
      <div className="text-xs text-gray-400 mb-2">{ctx.option.label}</div>
      <div className="text-sm text-gray-200">TODO: Wizard not implemented yet.</div>
      <div className="text-xs text-gray-500 mt-1">
        This action will be implemented as a multi-step wizard with preview/apply.
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-1 text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 rounded border border-gray-800 transition-colors mr-2"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onCloseAll}
          className="px-2 py-1 text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 rounded border border-gray-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}


