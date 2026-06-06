'use client';

/**
 * ClientLogBridge — dev-only browser→server telemetry.
 *
 * Forwards uncaught errors, unhandled promise rejections, React/console errors,
 * and route changes to /api/dev/client-log so they appear in the dev-server log
 * (and the live monitor) alongside the server's request/response lines. This is
 * how we see BOTH what the operator did and how the system responded.
 *
 * No-ops in production. Mounted once in the dashboard layout.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const IS_DEV = process.env.NODE_ENV !== 'production';

type ClientLevel = 'error' | 'warn' | 'info';

function postClientLog(level: ClientLevel, message: string, stack?: string): void {
  try {
    void fetch('/api/dev/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        message: message.slice(0, 4000),
        path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        ...(stack ? { stack: stack.slice(0, 4000) } : {}),
      }),
      keepalive: true,
    }).catch(() => {
      /* swallow — never let telemetry failures surface or loop */
    });
  } catch {
    /* ignore */
  }
}

export function ClientLogBridge() {
  const pathname = usePathname();

  // Error + console capture (set up once).
  useEffect(() => {
    if (!IS_DEV) {
      return;
    }

    let capturing = false; // guard against re-entrancy from our own logging

    const onError = (e: ErrorEvent) => {
      postClientLog('error', `window.onerror: ${e.message}`, e.error instanceof Error ? e.error.stack : undefined);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason: unknown = e.reason;
      postClientLog(
        'error',
        `unhandledrejection: ${reason instanceof Error ? reason.message : String(reason)}`,
        reason instanceof Error ? reason.stack : undefined,
      );
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    // React surfaces render/runtime errors (incl. ChunkLoadError) via console.error.
    const originalError = console.error.bind(console);
    const patchedError = (...args: unknown[]) => {
      originalError(...args);
      if (capturing) {
        return;
      }
      capturing = true;
      try {
        postClientLog('error', args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack ?? ''}` : String(a))).join(' '));
      } finally {
        capturing = false;
      }
    };
    console.error = patchedError;

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      if (console.error === patchedError) {
        console.error = originalError;
      }
    };
  }, []);

  // Route-change breadcrumb so the action stream shows where the operator went.
  useEffect(() => {
    if (!IS_DEV || !pathname) {
      return;
    }
    postClientLog('info', `route: ${pathname}`);
  }, [pathname]);

  return null;
}

export default ClientLogBridge;
