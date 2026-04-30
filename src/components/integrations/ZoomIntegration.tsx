'use client';

import React, { useState } from 'react';
import { logger } from '@/lib/logger/logger';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';

interface ZoomConnection {
  status?: 'active' | 'inactive' | 'expired';
  metadata?: {
    connectedEmail?: string;
    connectedName?: string;
    connectedAt?: string;
  };
}

interface ZoomIntegrationProps {
  integration: ZoomConnection | null;
  onConnect: (integration: Partial<ZoomConnection>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: Record<string, unknown>) => void;
}

export default function ZoomIntegration({
  integration,
  onConnect: _onConnect,
  onDisconnect,
  onUpdate: _onUpdate,
}: ZoomIntegrationProps) {
  const { user: authUser } = useAuth();
  const authFetch = useAuthFetch();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  // Two-step disconnect: first click arms the confirmation, second click
  // actually fires. Auto-disarms after 5 seconds so a stale armed state
  // doesn't disconnect the operator unexpectedly later.
  const [disconnectArmed, setDisconnectArmed] = useState(false);
  const disarmTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (disarmTimerRef.current) {
        clearTimeout(disarmTimerRef.current);
      }
    };
  }, []);

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || 'var(--color-text-primary)'
    : 'var(--color-text-primary)';
  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || 'var(--color-border-main)'
    : 'var(--color-border-main)';
  const primaryColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || 'var(--color-primary)'
    : 'var(--color-primary)';

  const armDisconnect = (): void => {
    setDisconnectArmed(true);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
    }
    disarmTimerRef.current = setTimeout(() => {
      setDisconnectArmed(false);
      disarmTimerRef.current = null;
    }, 5000);
  };

  const cancelDisconnect = (): void => {
    setDisconnectArmed(false);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = null;
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    setIsDisconnecting(true);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = null;
    }
    try {
      const res = await authFetch('/api/integrations/zoom/disconnect', { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Disconnect returned ${res.status}`);
      }
    } catch (error) {
      logger.error(
        'Zoom disconnect API call failed',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'ZoomIntegration.tsx' },
      );
      // Still notify the parent so local state clears even if the server call hiccupped
    } finally {
      setIsDisconnecting(false);
      setDisconnectArmed(false);
      onDisconnect();
    }
  };

  const handleConnect = async (): Promise<void> => {
    setIsConnecting(true);
    try {
      if (!authUser?.id) {
        logger.error(
          'User not found for Zoom connect',
          new Error('Auth user missing'),
          { file: 'ZoomIntegration.tsx' },
        );
        setIsConnecting(false);
        return;
      }
      // Fetch the Zoom authorize URL via authFetch (sets Authorization
      // header). A plain window.location.href to the auth route would not
      // include the Bearer token and would 401. Once we have the URL the
      // component navigates the browser there directly — the redirect
      // back from Zoom hits the public callback route which doesn't need
      // the operator's auth header (it validates a CSRF state instead).
      const res = await authFetch('/api/integrations/zoom/auth');
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Auth route returned ${res.status}`);
      }
      const data = (await res.json()) as { success: boolean; authUrl?: string };
      if (!data.success || !data.authUrl) {
        throw new Error('Auth route did not return an authUrl');
      }
      window.location.href = data.authUrl;
    } catch (error) {
      logger.error(
        'Zoom connect failed',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'ZoomIntegration.tsx' },
      );
      setIsConnecting(false);
    }
  };

  // Treat any non-null integration with a not-explicitly-disconnected status as
  // connected — both the existing 'active' and the OAuth-callback-written
  // 'connected' values mean the same thing here. Stale-token detection is the
  // verify script's job, not the UI's.
  const isConnected = integration != null && integration.status !== 'inactive' && integration.status !== 'expired';
  const connectedEmail = integration?.metadata?.connectedEmail;

  if (!isConnected) {
    return (
      <div style={{
        backgroundColor: 'var(--color-bg-paper)',
        border: `1px solid ${borderColor}`,
        borderRadius: '0.75rem',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>📹</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              Zoom
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
              Auto-create Zoom meetings for booked demos and operator-scheduled calls
            </p>
          </div>
        </div>
        <button
          onClick={() => { void handleConnect(); }}
          disabled={isConnecting}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: isConnecting ? 'var(--color-border-strong)' : primaryColor,
            color: 'var(--color-text-primary)',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {isConnecting ? 'Connecting…' : 'Connect Zoom'}
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.75rem', textAlign: 'center' }}>
          You&apos;ll be redirected to Zoom to authorize the connection
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-paper)',
      border: `1px solid ${primaryColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>📹</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                Zoom
              </h3>
              {connectedEmail ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
                  Connected as {connectedEmail}
                </p>
              ) : null}
            </div>
            <div style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: 'var(--color-success-dark)',
              border: '1px solid var(--color-success-light)',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              color: 'var(--color-success-light)',
              fontWeight: 600,
            }}>
              ✓ Connected
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        {disconnectArmed ? (
          <>
            <button
              onClick={() => { void handleDisconnect(); }}
              disabled={isDisconnecting}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--color-error)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                opacity: isDisconnecting ? 0.6 : 1,
              }}
            >
              {isDisconnecting ? 'Disconnecting…' : 'Click again to confirm'}
            </button>
            <button
              onClick={cancelDisconnect}
              disabled={isDisconnecting}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'transparent',
                color: textColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={armDisconnect}
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-error-dark)',
              color: 'var(--color-error-light)',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
