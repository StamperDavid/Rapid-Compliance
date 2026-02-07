'use client';

/**
 * Impersonation Banner Component
 * Displays a persistent banner when the owner is impersonating a user.
 * Reads impersonation state from sessionStorage and provides an "End Session" action.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Eye, X, User } from 'lucide-react';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

interface ImpersonationState {
  sessionId: string;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName: string;
  targetUserRole: string;
  reason: string;
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

const STORAGE_KEY = 'sv_impersonation_session';

export function getActiveImpersonation(): ImpersonationState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as ImpersonationState;
  } catch {
    return null;
  }
}

export function setActiveImpersonation(state: ImpersonationState): void {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearActiveImpersonation(): void {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.removeItem(STORAGE_KEY);
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ImpersonationBanner(): React.ReactElement | null {
  const { user, hasPermission } = useUnifiedAuth();
  const [session, setSession] = useState<ImpersonationState | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const active = getActiveImpersonation();
    setSession(active);
  }, []);

  const handleEndSession = useCallback(async () => {
    if (!session || ending) {
      return;
    }

    setEnding(true);
    try {
      const { auth } = await import('@/lib/firebase/config');
      const token = auth ? await auth.currentUser?.getIdToken() : null;

      if (!token) {
        logger.error('No auth token for ending impersonation', new Error('Missing token'), {
          file: 'ImpersonationBanner.tsx',
        });
        setEnding(false);
        return;
      }

      const response = await fetch('/api/admin/impersonate', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });

      if (response.ok) {
        clearActiveImpersonation();
        setSession(null);
      } else {
        const errorData = (await response.json()) as { error?: string };
        logger.error(
          'Failed to end impersonation session',
          new Error(errorData.error ?? 'Unknown error'),
          { file: 'ImpersonationBanner.tsx' }
        );
      }
    } catch (error: unknown) {
      logger.error(
        'Error ending impersonation',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'ImpersonationBanner.tsx' }
      );
    } finally {
      setEnding(false);
    }
  }, [session, ending]);

  // Only show for owner with an active session
  if (!session || !user || !hasPermission('canImpersonateUsers')) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: 'var(--color-warning)',
        color: '#000',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <Eye className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <User className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span>
        Impersonating:{' '}
        <strong>{session.targetUserName}</strong>{' '}
        ({session.targetUserEmail}) &mdash; {session.targetUserRole}
      </span>
      <button
        onClick={() => { void handleEndSession(); }}
        disabled={ending}
        aria-label="End impersonation session"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.25rem 0.75rem',
          borderRadius: '0.375rem',
          backgroundColor: '#000',
          color: '#fff',
          border: 'none',
          cursor: ending ? 'wait' : 'pointer',
          fontSize: '0.8125rem',
          fontWeight: 600,
          opacity: ending ? 0.7 : 1,
          transition: 'opacity 150ms',
        }}
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
        {ending ? 'Ending...' : 'End Session'}
      </button>
    </div>
  );
}
