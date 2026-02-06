'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-5 py-10">
      <div
        className="rounded-xl p-10 w-full max-w-md text-center"
        style={{
          backgroundColor: 'var(--color-bg-paper)',
          border: '1px solid var(--color-border-main)',
        }}
      >
        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Something went wrong
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white border-none cursor-pointer"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="px-6 py-2.5 rounded-lg text-sm font-medium no-underline"
            style={{
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-main)',
            }}
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
