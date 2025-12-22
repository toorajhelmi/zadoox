'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-vscode-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="rounded-lg bg-red-900/30 border border-red-700 p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-4">Something went wrong!</h2>
          <p className="text-sm text-red-300 mb-4">{error.message}</p>
          <button
            onClick={reset}
            className="w-full px-4 py-2 bg-vscode-blue hover:bg-vscode-blue-hover text-white rounded-md transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}


