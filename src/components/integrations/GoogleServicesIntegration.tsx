'use client';

/**
 * GoogleServicesIntegration
 *
 * Single unified card for the central connected-Google account. Replaces
 * the previous five fragmented entries (Gmail, Google Calendar, Google
 * Search Console, YouTube on the social grid, Google Business on the
 * social grid) — one OAuth grants access to all of them via the
 * GOOGLE_FULL_SCOPE_BUNDLE, so showing them as separate "Connect"
 * buttons was misleading and visually inconsistent.
 *
 * Reads the connection state from /api/integrations/google/status, which
 * goes through the Admin SDK and returns a narrow non-secret summary
 * (connected flag, accountEmail, GBP selection). Tokens never reach the
 * client.
 *
 * Visual shape matches the Zoom / Slack reference exactly: card chrome,
 * icon + title + description, full-width Connect button on the
 * disconnected state, "Connected as <email>" + service list +
 * Disconnect button on the connected state. Disconnect is two-step
 * (per the destructive-actions standing rule).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import GoogleBusinessLocationPicker from './GoogleBusinessLocationPicker';

interface GoogleServicesProps {
  /**
   * Live connection state passed in by the parent integrations page.
   * Parent already calls /api/integrations/google/status on load — we
   * accept it as a prop instead of fetching twice.
   */
  connected: boolean;
  accountEmail?: string;
  gbpLocationName?: string;
  /** Trigger the parent to refresh its connection state after disconnect / GBP pick. */
  onRefresh: () => void;
}

const SERVICES_GRANTED = [
  { key: 'gmail', icon: 'M', label: 'Gmail — send & sync replies' },
  { key: 'calendar', icon: 'C', label: 'Calendar — events for every scheduled action' },
  { key: 'drive', icon: 'D', label: 'Drive — file storage' },
  { key: 'youtube', icon: 'Y', label: 'YouTube — channel + uploads' },
  { key: 'gbp', icon: 'B', label: 'Google Business Profile' },
  { key: 'analytics', icon: 'A', label: 'Analytics — traffic data' },
  { key: 'search-console', icon: 'S', label: 'Search Console — SEO data' },
  { key: 'ads', icon: 'P', label: 'Google Ads — campaign data' },
];

export default function GoogleServicesIntegration({
  connected,
  accountEmail,
  gbpLocationName,
  onRefresh,
}: GoogleServicesProps) {
  const authFetch = useAuthFetch();
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [disconnectArmed, setDisconnectArmed] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
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

  const handleConnect = async (): Promise<void> => {
    setIsConnecting(true);
    try {
      const res = await authFetch('/api/integrations/google/auth');
      if (!res.ok) {
        throw new Error(`Auth route returned ${res.status}`);
      }
      const data = (await res.json()) as { success: boolean; authUrl?: string; error?: string };
      if (!data.success || !data.authUrl) {
        throw new Error(data.error ?? 'Auth route did not return an authUrl');
      }
      window.location.href = data.authUrl;
    } catch (error) {
      logger.error(
        'Google connect failed',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'GoogleServicesIntegration.tsx' },
      );
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    setIsDisconnecting(true);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = null;
    }
    try {
      const res = await authFetch('/api/integrations/google/disconnect', { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Disconnect returned ${res.status}`);
      }
    } catch (error) {
      logger.error(
        'Google disconnect failed',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'GoogleServicesIntegration.tsx' },
      );
    } finally {
      setIsDisconnecting(false);
      setDisconnectArmed(false);
      onRefresh();
    }
  };

  if (!connected) {
    return (
      <div style={{
        backgroundColor: 'var(--color-bg-paper)',
        border: `1px solid ${borderColor}`,
        borderRadius: '0.75rem',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>🔵</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              Google Services
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
              One sign-in connects Gmail, Calendar, Drive, YouTube, Google Business, Analytics, Search Console, and Ads
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
          {isConnecting ? 'Connecting…' : 'Connect Google'}
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.75rem', textAlign: 'center' }}>
          You&apos;ll be redirected to Google to authorize the connection
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
        <div style={{ fontSize: '3rem' }}>🔵</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                Google Services
              </h3>
              {accountEmail ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
                  Connected as {accountEmail}
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

      <div style={{
        backgroundColor: 'var(--color-bg-elevated)',
        border: `1px solid ${borderColor}`,
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-disabled)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Services Granted
        </div>
        <ul style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem', listStyle: 'none', padding: 0, margin: 0 }}>
          {SERVICES_GRANTED.map((s) => (
            <li key={s.key} style={{ fontSize: '0.8125rem', color: textColor, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--color-success-light)' }}>✓</span>
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      <div style={{
        backgroundColor: 'var(--color-bg-elevated)',
        border: `1px solid ${borderColor}`,
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: textColor, marginBottom: '0.125rem' }}>
              Google Business Profile location
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
              {gbpLocationName ?? 'Pick which location the platform should post to'}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            {gbpLocationName ? 'Change' : 'Select'}
          </Button>
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

      <GoogleBusinessLocationPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSaved={() => {
          setPickerOpen(false);
          onRefresh();
        }}
      />
    </div>
  );
}
