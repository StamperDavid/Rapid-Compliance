/**
 * Error Boundary Component
 * 
 * Catches React errors in child components and displays a fallback UI
 * instead of crashing the entire app.
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */

'use client';

import React, { Component, type ReactNode } from 'react';
import { logger } from '@/lib/logger/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to monitoring service
    logger.error(`Error in ${this.props.componentName ?? 'component'}`, error, {
      componentStack: errorInfo.componentStack,
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          componentName={this.props.componentName}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI
 */
interface DefaultErrorFallbackProps {
  error: Error | null;
  componentName?: string;
  onReset: () => void;
}

function DefaultErrorFallback({ error, componentName, onReset }: DefaultErrorFallbackProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
      <div className="flex items-start gap-4">
        {/* Error Icon */}
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Error Content */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
            {componentName ? `Error in ${componentName}` : 'Something went wrong'}
          </h3>
          
          <div className="mt-2 text-sm text-red-700 dark:text-red-300">
            <p>
              We encountered an unexpected error. This has been logged and our team will investigate.
            </p>
            
            {error && process.env.NODE_ENV === 'development' && (
              <details className="mt-3">
                <summary className="cursor-pointer font-medium">
                  Technical details (development only)
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-red-100 p-2 text-xs dark:bg-red-900/30">
                  {error.toString()}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </details>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={onReset}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-500 dark:hover:bg-red-600"
            >
              Try again
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-900/50"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Lightweight error fallback for inline use
 */
export function InlineErrorFallback({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
      <svg
        className="h-4 w-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
      <span>{(message !== '' && message != null) ? message : 'Failed to load content'}</span>
    </div>
  );
}

/**
 * Error boundary with retry mechanism
 */
export function ErrorBoundaryWithRetry({
  children,
  componentName,
  maxRetries = 3
}: {
  children: ReactNode;
  componentName?: string;
  maxRetries?: number;
}) {
  const [retryCount, setRetryCount] = React.useState(0);

  const handleError = () => {
    if (retryCount < maxRetries) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, 1000 * Math.pow(2, retryCount)); // Exponential backoff
    }
  };

  return (
    <ErrorBoundary
      componentName={componentName}
      onError={handleError}
      fallback={
        <DefaultErrorFallback
          error={new Error('Component failed to render')}
          componentName={componentName}
          onReset={() => setRetryCount(prev => prev + 1)}
        />
      }
    >
      {/* Key forces remount on retry */}
      <div key={retryCount}>
        {children}
      </div>
    </ErrorBoundary>
  );
}
