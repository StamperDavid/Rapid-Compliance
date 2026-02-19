'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger/logger';

interface TwitterAccount {
  id?: string;
  status?: 'active' | 'disconnected' | 'expired';
  handle?: string;
  accountName?: string;
  profileImageUrl?: string;
}

interface TwitterIntegrationProps {
  integration: TwitterAccount | null;
  onConnect: (integration: Partial<TwitterAccount>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: Record<string, unknown>) => void;
}

export default function TwitterIntegration({
  integration,
  onConnect: _onConnect,
  onDisconnect,
  onUpdate: _onUpdate,
}: TwitterIntegrationProps) {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message?: string } | null>(null);

  const [manualCreds, setManualCreds] = useState({
    clientId: '',
    clientSecret: '',
    accessToken: '',
    refreshToken: '',
    bearerToken: '',
    accountName: '',
    handle: '',
  });

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || 'var(--color-text-primary)'
    : 'var(--color-text-primary)';

  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || 'var(--color-border-main)'
    : 'var(--color-border-main)';

  const primaryColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || 'var(--color-primary)'
    : 'var(--color-primary)';

  const handleOAuthConnect = () => {
    setIsConnecting(true);
    const userId = user?.id ?? 'anonymous';
    window.location.href = `/api/social/oauth/auth/twitter?userId=${userId}`;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    try {
      const response = await fetch('/api/social/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'twitter',
          accountName: manualCreds.accountName,
          handle: manualCreds.handle,
          isDefault: true,
          credentials: {
            clientId: manualCreds.clientId,
            clientSecret: manualCreds.clientSecret,
            accessToken: manualCreds.accessToken,
            refreshToken: manualCreds.refreshToken || undefined,
            bearerToken: manualCreds.bearerToken || undefined,
          },
        }),
      });

      const data = await response.json() as { success: boolean; account?: TwitterAccount };
      if (data.success && data.account) {
        _onConnect({ ...data.account, status: 'active' });
        setShowManual(false);
      }
    } catch (error) {
      logger.error('Failed to connect Twitter manually', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!integration?.id) {return;}
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/social/accounts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: integration.id }),
      });
      const data = await response.json() as {
        success: boolean;
        valid: boolean;
        profile?: { name?: string; handle?: string };
      };
      setTestResult({
        valid: data.valid,
        message: data.valid
          ? `Connected as @${data.profile?.handle ?? integration.handle}`
          : 'Connection failed. Token may be expired.',
      });
    } catch {
      setTestResult({ valid: false, message: 'Failed to verify connection.' });
    } finally {
      setTesting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem',
    backgroundColor: 'var(--color-bg-elevated)',
    color: textColor,
    border: `1px solid ${borderColor}`,
    borderRadius: '0.375rem',
    fontSize: '0.8125rem',
    boxSizing: 'border-box',
  };

  // ─── Disconnected State ───────────────────────────────────────────────

  if (integration?.status !== 'active') {
    return (
      <div style={{
        backgroundColor: 'var(--color-bg-paper)',
        border: `1px solid ${borderColor}`,
        borderRadius: '0.75rem',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              X (Twitter)
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
              Post and manage content on X/Twitter
            </p>
          </div>
        </div>

        <button
          onClick={handleOAuthConnect}
          disabled={isConnecting}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: isConnecting ? 'var(--color-border-strong)' : '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
            marginBottom: '0.75rem',
          }}
        >
          {isConnecting ? 'Connecting...' : 'Connect with X'}
        </button>

        <button
          onClick={() => setShowManual(!showManual)}
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor: 'transparent',
            color: 'var(--color-text-disabled)',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}
        >
          {showManual ? 'Hide Manual Setup' : 'Manual Setup (API Keys)'}
        </button>

        {showManual && (
          <form onSubmit={(e) => void handleManualSubmit(e)} style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input placeholder="Account Name" required value={manualCreds.accountName} onChange={(e) => setManualCreds({ ...manualCreds, accountName: e.target.value })} style={inputStyle} />
              <input placeholder="@handle" required value={manualCreds.handle} onChange={(e) => setManualCreds({ ...manualCreds, handle: e.target.value })} style={inputStyle} />
              <input placeholder="Client ID" required value={manualCreds.clientId} onChange={(e) => setManualCreds({ ...manualCreds, clientId: e.target.value })} style={inputStyle} />
              <input placeholder="Client Secret" required type="password" value={manualCreds.clientSecret} onChange={(e) => setManualCreds({ ...manualCreds, clientSecret: e.target.value })} style={inputStyle} />
              <input placeholder="Access Token" required type="password" value={manualCreds.accessToken} onChange={(e) => setManualCreds({ ...manualCreds, accessToken: e.target.value })} style={inputStyle} />
              <input placeholder="Refresh Token (optional)" type="password" value={manualCreds.refreshToken} onChange={(e) => setManualCreds({ ...manualCreds, refreshToken: e.target.value })} style={inputStyle} />
              <input placeholder="Bearer Token (optional)" type="password" value={manualCreds.bearerToken} onChange={(e) => setManualCreds({ ...manualCreds, bearerToken: e.target.value })} style={inputStyle} />
              <button
                type="submit"
                disabled={isConnecting}
                style={{
                  padding: '0.625rem',
                  backgroundColor: primaryColor,
                  color: 'var(--color-text-primary)',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: isConnecting ? 'not-allowed' : 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: '600',
                }}
              >
                {isConnecting ? 'Saving...' : 'Save Credentials'}
              </button>
            </div>
          </form>
        )}

        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.75rem', textAlign: 'center' }}>
          OAuth connects securely via X. Manual setup requires API keys from the X Developer Portal.
        </p>
      </div>
    );
  }

  // ─── Connected State ──────────────────────────────────────────────────

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-paper)',
      border: `1px solid ${primaryColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                X (Twitter)
              </h3>
              {integration.handle && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
                  @{integration.handle}
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
              fontWeight: '600',
            }}>
              Connected
            </div>
          </div>
        </div>
      </div>

      {testResult && (
        <div style={{
          padding: '0.5rem 0.75rem',
          marginBottom: '0.75rem',
          borderRadius: '0.375rem',
          fontSize: '0.75rem',
          backgroundColor: testResult.valid ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)',
          color: testResult.valid ? '#4CAF50' : '#F44336',
          border: `1px solid ${testResult.valid ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'}`,
        }}>
          {testResult.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={() => void handleTestConnection()}
          disabled={testing}
          style={{
            flex: 1,
            padding: '0.75rem',
            backgroundColor: primaryColor,
            color: 'var(--color-text-primary)',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: testing ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
          }}
        >
          {testing ? 'Testing...' : 'Test Connection'}
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
            fontWeight: '600',
          }}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
