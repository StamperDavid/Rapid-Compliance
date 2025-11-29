'use client';

import React, { useState } from 'react';
import { StripeIntegration as StripeType } from '@/types/integrations';

interface StripeIntegrationProps {
  integration: StripeType | null;
  onConnect: (integration: Partial<StripeType>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: Partial<StripeType['settings']>) => void;
}

export default function StripeIntegration({ 
  integration, 
  onConnect, 
  onDisconnect, 
  onUpdate 
}: StripeIntegrationProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || '#ffffff'
    : '#ffffff';

  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || '#333333'
    : '#333333';

  const primaryColor = typeof window !== 'undefined' 
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#6366f1'
    : '#6366f1';

  const handleConnect = async () => {
    if (!apiKey) {
      alert('Please enter your Stripe API key');
      return;
    }
    setIsConnecting(true);
    // MOCK: Simulate connection
    setTimeout(() => {
      onConnect({
        id: 'stripe',
        name: 'Stripe',
        description: 'Process payments and manage subscriptions',
        icon: '💳',
        category: 'payment',
        status: 'connected',
        organizationId: 'demo-org',
        apiKey: apiKey.substring(0, 10) + '...', // Show partial key
        settings: {
          autoCreateCustomers: true,
          autoCreateInvoices: true,
        },
        connectedAt: new Date(),
      });
      setIsConnecting(false);
      setApiKey('');
    }, 1500);
  };

  if (!integration || integration.status !== 'connected') {
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
              Stripe
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              Process payments, manage subscriptions, and handle invoices
            </p>
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.875rem', color: textColor, display: 'block', marginBottom: '0.5rem' }}>
            Stripe Secret Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk_live_..."
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
          <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
            Find your API keys in the Stripe Dashboard → Developers → API keys
          </p>
        </div>
        <button
          onClick={handleConnect}
          disabled={isConnecting || !apiKey}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: isConnecting || !apiKey ? '#444' : primaryColor,
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isConnecting || !apiKey ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}
        >
          {isConnecting ? 'Connecting...' : 'Connect Stripe'}
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
                Stripe
              </h3>
              {integration.accountId && (
                <p style={{ fontSize: '0.875rem', color: '#666' }}>
                  Account: {integration.accountId.substring(0, 20)}...
                </p>
              )}
            </div>
            <div style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: '#0f4c0f',
              border: '1px solid #4ade80',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              color: '#4ade80',
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
              <span style={{ fontSize: '0.875rem', color: textColor }}>Auto-create customers in Stripe</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.settings.autoCreateInvoices}
                onChange={(e) => onUpdate({ autoCreateInvoices: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Auto-create invoices in Stripe</span>
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
                backgroundColor: '#4c0f0f',
                color: '#f87171',
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
              color: '#fff',
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
              backgroundColor: '#4c0f0f',
              color: '#f87171',
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

