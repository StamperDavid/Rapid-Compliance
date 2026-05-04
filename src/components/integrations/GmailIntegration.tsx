'use client';

import React, { useState } from 'react';
import type { ConnectedIntegration } from '@/types/integrations';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';

interface GmailSettings {
  trackOpens?: boolean;
  trackClicks?: boolean;
  autoCreateContacts?: boolean;
}

interface GmailIntegrationProps {
  integration: ConnectedIntegration | null;
  onConnect: (integration: Partial<ConnectedIntegration>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: GmailSettings) => void;
}

export default function GmailIntegration({
  integration,
  onConnect: _onConnect,
  onDisconnect,
  onUpdate
}: GmailIntegrationProps) {
  // useAuth hook still mounted for session-state side effects, but the
  // user object itself is no longer read here — authFetch carries the
  // bearer token directly.
  const { user: _user } = useAuth();
  const authFetch = useAuthFetch();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || 'var(--color-text-primary)'
    : 'var(--color-text-primary)';

  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || 'var(--color-border-main)'
    : 'var(--color-border-main)';

  const primaryColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || 'var(--color-primary)'
    : 'var(--color-primary)';

  // Helper to safely get email from config
  const getEmail = (): string | null => {
    const config = integration?.config;
    if (config && 'email' in config) {
      const email = config.email;
      return email ? String(email) : null;
    }
    return null;
  };

  // Helper to safely get settings
  const getSettings = (): GmailSettings => {
    const settings = integration?.settings;
    if (settings) {
      return {
        trackOpens: settings.trackOpens as boolean | undefined,
        trackClicks: settings.trackClicks as boolean | undefined,
        autoCreateContacts: settings.autoCreateContacts as boolean | undefined,
      };
    }
    return {};
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // We can't use a plain `window.location.href` to start OAuth
      // because the /api/integrations/google/auth route requires the
      // Authorization header (Bearer token), which browser navigations
      // do not send. So: fetch the route with authFetch (which adds
      // the token), receive { authUrl }, then do the navigation.
      const res = await authFetch('/api/integrations/google/auth');
      if (!res.ok) {
        throw new Error(`Auth route returned ${res.status}`);
      }
      const body = (await res.json()) as { success: boolean; authUrl?: string; error?: string };
      if (!body.success || !body.authUrl) {
        throw new Error(body.error ?? 'Auth route did not return an authUrl');
      }
      window.location.href = body.authUrl;
    } catch (error) {
      logger.error('Failed to start Gmail OAuth', error instanceof Error ? error : new Error(String(error)));
      setIsConnecting(false);
      logger.warn('Failed to connect to Gmail. Please try again.');
    }
  };

  if (integration?.status !== 'active') {
    return (
      <div style={{
        backgroundColor: 'var(--color-bg-paper)',
        border: `1px solid ${borderColor}`,
        borderRadius: '0.75rem',
        padding: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>📧</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              Gmail
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
              Sync emails, track opens and clicks, auto-create contacts
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
            fontWeight: '600'
          }}
        >
          {isConnecting ? 'Connecting...' : 'Connect Gmail'}
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
      padding: '1.5rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>📧</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                Gmail
              </h3>
              {getEmail() && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
                  {getEmail()}
                </p>
              )}
            </div>
            <div style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: 'var(--color-success-dark)',
              border: '1px solid var(--color-success-light)',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              color: 'var(--color-success-light)',
              fontWeight: '600'
            }}>
              ✓ Connected
            </div>
          </div>
        </div>
      </div>

      {showSettings ? (
        <div style={{ marginTop: '1.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
            Settings
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={getSettings().trackOpens ?? false}
                onChange={(e) => onUpdate({ trackOpens: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Track email opens</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={getSettings().trackClicks ?? false}
                onChange={(e) => onUpdate({ trackClicks: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Track link clicks</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={getSettings().autoCreateContacts ?? false}
                onChange={(e) => onUpdate({ autoCreateContacts: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Auto-create contacts from emails</span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                flex: 1,
                padding: '0.625rem',
                backgroundColor: 'transparent',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: textColor,
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              Done
            </button>
            <button
              onClick={onDisconnect}
              style={{
                padding: '0.625rem 1rem',
                backgroundColor: 'var(--color-error-dark)',
                color: 'var(--color-error-light)',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: primaryColor,
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}
          >
            Configure
          </button>
          <button
            onClick={onDisconnect}
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-error-dark)',
              color: 'var(--color-error-light)',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

