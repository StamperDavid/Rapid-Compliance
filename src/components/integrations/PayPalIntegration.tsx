'use client';

import React, { useState } from 'react';
import type { PayPalIntegration as PayPalType } from '@/types/integrations';
import { logger } from '@/lib/logger/logger';
import { useAuthFetch } from '@/hooks/useAuthFetch';

interface PayPalIntegrationProps {
  integration: PayPalType | null;
  onConnect: (integration: Partial<PayPalType>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: Partial<PayPalType['settings']>) => void;
}

export default function PayPalIntegration({
  integration,
  onConnect,
  onDisconnect,
  onUpdate
}: PayPalIntegrationProps) {
  const authFetch = useAuthFetch();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox');

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || 'var(--color-text-primary)'
    : 'var(--color-text-primary)';

  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || 'var(--color-border-main)'
    : 'var(--color-border-main)';

  const primaryColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || 'var(--color-primary)'
    : 'var(--color-primary)';

  const handleConnect = async () => {
    if (!clientId || !clientSecret) {
      logger.warn('Please enter your PayPal credentials');
      return;
    }
    setIsConnecting(true);
    try {
      // Save PayPal API keys to backend
      const response = await authFetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'paypal',
          apiKey: clientId,
          apiSecret: clientSecret,
          mode: mode,
        }),
      });

      if (!response.ok) {throw new Error('Failed to save PayPal credentials');}

      onConnect({
        id: 'paypal',
        name: 'PayPal',
        description: 'Accept PayPal payments',
        icon: '💳',
        category: 'payment',
        status: 'active',
        clientId: `${clientId.substring(0, 10)  }...`,
        clientSecret: '***',
        mode,
        settings: {
          autoCreateCustomers: true,
          autoCreateInvoices: true,
        },
        connectedAt: new Date().toISOString(),
      });
      setClientId('');
      setClientSecret('');
    } catch (error) {
      logger.error('Failed to configure PayPal', error instanceof Error ? error : new Error(String(error)));
      logger.warn('Failed to save PayPal credentials. Please try again.');
    } finally {
      setIsConnecting(false);
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
          <div style={{ fontSize: '3rem' }}>💳</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              PayPal
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
              Accept PayPal payments and manage transactions
            </p>
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.875rem', color: textColor, display: 'block', marginBottom: '0.5rem' }}>
            Mode
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'sandbox' | 'live')}
            style={{
              width: '100%',
              padding: '0.625rem',
              backgroundColor: 'var(--color-bg-main)',
              border: `1px solid ${borderColor}`,
              borderRadius: '0.375rem',
              color: textColor,
              fontSize: '0.875rem',
              marginBottom: '0.75rem'
            }}
          >
            <option value="sandbox">Sandbox (Testing)</option>
            <option value="live">Live (Production)</option>
          </select>
          <label style={{ fontSize: '0.875rem', color: textColor, display: 'block', marginBottom: '0.5rem' }}>
            Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Your PayPal Client ID"
            style={{
              width: '100%',
              padding: '0.625rem',
              backgroundColor: 'var(--color-bg-main)',
              border: `1px solid ${borderColor}`,
              borderRadius: '0.375rem',
              color: textColor,
              fontSize: '0.875rem',
              marginBottom: '0.75rem'
            }}
          />
          <label style={{ fontSize: '0.875rem', color: textColor, display: 'block', marginBottom: '0.5rem' }}>
            Client Secret
          </label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Your PayPal Client Secret"
            style={{
              width: '100%',
              padding: '0.625rem',
              backgroundColor: 'var(--color-bg-main)',
              border: `1px solid ${borderColor}`,
              borderRadius: '0.375rem',
              color: textColor,
              fontSize: '0.875rem'
            }}
          />
        </div>
        <button
          onClick={() => { void handleConnect(); }}
          disabled={isConnecting || !clientId || !clientSecret}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: isConnecting || !clientId || !clientSecret ? 'var(--color-border-strong)' : primaryColor,
            color: 'var(--color-text-primary)',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isConnecting || !clientId || !clientSecret ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}
        >
          {isConnecting ? 'Connecting...' : 'Connect PayPal'}
        </button>
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
        <div style={{ fontSize: '3rem' }}>💳</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                PayPal
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
                Mode: {integration.mode === 'live' ? 'Live' : 'Sandbox'}
              </p>
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
                checked={integration.settings.autoCreateCustomers}
                onChange={(e) => onUpdate({ autoCreateCustomers: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Auto-create customers in PayPal</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.settings.autoCreateInvoices}
                onChange={(e) => onUpdate({ autoCreateInvoices: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Auto-create invoices in PayPal</span>
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

