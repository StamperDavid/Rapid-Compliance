'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches React errors and sends them to Sentry
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center text-white bg-neutral-900">
          <h2 className="text-2xl mb-4 text-red-500">
            Something went wrong
          </h2>
          <p className="mb-6 text-neutral-400">
            {(() => { const v = this.state.error?.message; return (v !== '' && v != null) ? v : 'An unexpected error occurred'; })()}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-6 py-3 bg-indigo-500 text-white border-none rounded-lg cursor-pointer text-base font-medium"
          >
            Reload Page
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-8 text-left max-w-[800px]">
              <summary className="cursor-pointer text-neutral-400 mb-4">
                Error Details (Development Only)
              </summary>
              <pre className="p-4 bg-black rounded-lg overflow-auto text-sm text-red-500">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}




















