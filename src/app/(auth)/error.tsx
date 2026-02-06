'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function AuthError({
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
    <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10 bg-gray-50">
      <div className="text-center max-w-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Authentication Error
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          {error.message || 'Something went wrong. Please try signing in again.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium cursor-pointer border-none"
          >
            Try again
          </button>
          <a
            href="/login"
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 no-underline"
          >
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
