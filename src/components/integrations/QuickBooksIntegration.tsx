'use client';

import React, { useState } from 'react';
import type { QuickBooksIntegration as QuickBooksType } from '@/types/integrations';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger/logger';

interface QuickBooksIntegrationProps {
  integration: QuickBooksType | null;
  onConnect: (integration: Partial<QuickBooksType>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: Partial<QuickBooksType['syncSettings']>) => void;
}

export default function QuickBooksIntegration({
  integration,
  onConnect: _onConnect,
  onDisconnect,
  onUpdate
}: QuickBooksIntegrationProps) {
  const { user } = useAuth();
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

  const handleConnect = () => {
    setIsConnecting(true);
    try {
      const userId = user?.id ?? 'anonymous';

      // Redirect to real QuickBooks OAuth flow
      window.location.href = `/api/integrations/quickbooks/auth?userId=${userId}`;
    } catch (error) {
      logger.error('Failed to start QuickBooks OAuth', error instanceof Error ? error : new Error(String(error)));
      setIsConnecting(false);
      logger.warn('Failed to connect to QuickBooks. Please try again.');
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
          <div style={{ fontSize: '3rem' }}>📊</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              QuickBooks
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
              Sync invoices, payments, customers, and items between QuickBooks and your CRM
            </p>
          </div>
        </div>
        <button
          onClick={handleConnect}
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
          {isConnecting ? 'Connecting...' : 'Connect QuickBooks'}
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.75rem', textAlign: 'center' }}>
          You&apos;ll be redirected to QuickBooks to authorize the connection
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
        <div style={{ fontSize: '3rem' }}>📊</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                QuickBooks
              </h3>
              {integration.companyName && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
                  Connected to {integration.companyName}
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
          {integration.connectedAt && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
              Connected {new Date(typeof integration.connectedAt === 'string' ? integration.connectedAt : String(integration.connectedAt)).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {showSettings ? (
        <div style={{ marginTop: '1.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
            Sync Settings
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.syncSettings?.syncInvoices ?? false}
                onChange={(e) => onUpdate({ syncInvoices: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Sync Invoices</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.syncSettings?.syncPayments ?? false}
                onChange={(e) => onUpdate({ syncPayments: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Sync Payments</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.syncSettings?.syncCustomers ?? false}
                onChange={(e) => onUpdate({ syncCustomers: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Sync Customers</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.syncSettings?.syncItems ?? false}
                onChange={(e) => onUpdate({ syncItems: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Sync Items/Products</span>
            </label>
            <div style={{ marginTop: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: textColor, display: 'block', marginBottom: '0.5rem' }}>
                Sync Direction
              </label>
              <select
                value={integration.syncSettings?.syncDirection ?? 'bidirectional'}
                onChange={(e) => onUpdate({ syncDirection: e.target.value as 'from-crm' | 'to-crm' | 'bidirectional' })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.375rem',
                  color: textColor,
                  fontSize: '0.875rem'
                }}
              >
                <option value="from-crm">CRM → QuickBooks</option>
                <option value="to-crm">QuickBooks → CRM</option>
                <option value="bidirectional">Bidirectional</option>
              </select>
            </div>
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

