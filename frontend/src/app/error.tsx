'use client';

import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // If it's a chunk loading failure/timeout, trigger auto-reload once to fetch fresh chunks
    if (
      error.name === 'ChunkLoadError' ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('timeout')
    ) {
      const hasReloaded = sessionStorage.getItem('chunk_error_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_error_reload', 'true');
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full p-8 rounded-2xl bg-surface border border-border text-center shadow-xl">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-xl">
          !
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Page Loading Error
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          A script chunk took too long to load or was updated during development.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              sessionStorage.removeItem('chunk_error_reload');
              window.location.reload();
            }}
            className="px-4 py-2 rounded-lg bg-gradient-brand text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Reload Page
          </button>
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-surface-elevated border border-border text-text-primary text-sm font-medium hover:bg-surface-hover transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
