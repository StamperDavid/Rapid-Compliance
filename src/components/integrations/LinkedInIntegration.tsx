'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface LinkedInAccount {
  id?: string;
  status?: 'active' | 'disconnected' | 'expired';
  handle?: string;
  accountName?: string;
  profileImageUrl?: string;
}

interface LinkedInIntegrationProps {
  integration: LinkedInAccount | null;
  onConnect: (integration: Partial<LinkedInAccount>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: Record<string, unknown>) => void;
}

export default function LinkedInIntegration({
  integration,
  onConnect: _onConnect,
  onDisconnect,
  onUpdate: _onUpdate,
}: LinkedInIntegrationProps) {
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message?: string } | null>(null);

  const [manualCreds, setManualCreds] = useState({
    accessToken: '',
    refreshToken: '',
    orgId: '',
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

  const linkedInBlue = '#0A66C2';

  const handleOAuthConnect = () => {
    setIsConnecting(true);
    const userId = user?.id ?? 'anonymous';
    window.location.href = `/api/social/oauth/auth/linkedin?userId=${userId}`;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    try {
      const response = await fetch('/api/social/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'linkedin',
          accountName: manualCreds.accountName,
          handle: manualCreds.handle,
          isDefault: true,
          credentials: {
            accessToken: manualCreds.accessToken,
            refreshToken: manualCreds.refreshToken || undefined,
            orgId: manualCreds.orgId || undefined,
          },
        }),
      });

      const data = await response.json() as { success: boolean; account?: LinkedInAccount };
      if (data.success && data.account) {
        _onConnect({ ...data.account, status: 'active' });
        setShowManual(false);
      }
    } catch (error) {
      console.error('Failed to connect LinkedIn manually:', error);
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
          ? `Connected as ${data.profile?.name ?? integration.accountName}`
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
            <svg width="48" height="48" viewBox="0 0 24 24" fill={linkedInBlue}>
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              LinkedIn
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
              Share updates and manage your LinkedIn presence
            </p>
          </div>
        </div>

        <button
          onClick={handleOAuthConnect}
          disabled={isConnecting}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: isConnecting ? 'var(--color-border-strong)' : linkedInBlue,
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
            marginBottom: '0.75rem',
          }}
        >
          {isConnecting ? 'Connecting...' : 'Connect with LinkedIn'}
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
              <input placeholder="Profile URL or Handle" required value={manualCreds.handle} onChange={(e) => setManualCreds({ ...manualCreds, handle: e.target.value })} style={inputStyle} />
              <input placeholder="Access Token" required type="password" value={manualCreds.accessToken} onChange={(e) => setManualCreds({ ...manualCreds, accessToken: e.target.value })} style={inputStyle} />
              <input placeholder="Refresh Token (optional)" type="password" value={manualCreds.refreshToken} onChange={(e) => setManualCreds({ ...manualCreds, refreshToken: e.target.value })} style={inputStyle} />
              <input placeholder="Organization ID (optional)" value={manualCreds.orgId} onChange={(e) => setManualCreds({ ...manualCreds, orgId: e.target.value })} style={inputStyle} />
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
          OAuth connects via LinkedIn. Manual setup requires API credentials from the LinkedIn Developer Portal.
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
          <svg width="48" height="48" viewBox="0 0 24 24" fill={linkedInBlue}>
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                LinkedIn
              </h3>
              {(integration.accountName ?? integration.handle) && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
                  {integration.accountName ?? integration.handle}
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
