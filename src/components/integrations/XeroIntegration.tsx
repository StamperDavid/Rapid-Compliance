'use client';

import React, { useState } from 'react';
import { XeroIntegration as XeroType } from '@/types/integrations';

interface XeroIntegrationProps {
  integration: XeroType | null;
  onConnect: (integration: Partial<XeroType>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: Partial<XeroType['syncSettings']>) => void;
}

export default function XeroIntegration({ 
  integration, 
  onConnect, 
  onDisconnect, 
  onUpdate 
}: XeroIntegrationProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
    setIsConnecting(true);
    try {
      // Get current user and org from context or URL
      const userId = localStorage.getItem('userId') || 'current-user';
      const orgId = window.location.pathname.split('/')[2] || 'current-org';
      
      // Note: Xero OAuth implementation needs to be completed in backend
      // For now, show configuration needed message
      alert('Xero integration requires additional backend configuration. Please contact support.');
      setIsConnecting(false);
    } catch (error) {
      console.error('Failed to start Xero OAuth:', error);
      setIsConnecting(false);
      alert('Failed to connect to Xero. Please try again.');
    }
  };

  if (!integration || integration.status !== 'active') {
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
              Xero
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              Sync invoices, payments, contacts, and items between Xero and your CRM
            </p>
          </div>
        </div>
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: isConnecting ? '#444' : primaryColor,
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}
        >
          {isConnecting ? 'Connecting...' : 'Connect Xero'}
        </button>
        <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.75rem', textAlign: 'center' }}>
          You'll be redirected to Xero to authorize the connection
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
                Xero
              </h3>
              {integration.organizationName && (
                <p style={{ fontSize: '0.875rem', color: '#666' }}>
                  Connected to {integration.organizationName}
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
          {integration.connectedAt && (
            <p style={{ fontSize: '0.75rem', color: '#666' }}>
              Connected {new Date(typeof integration.connectedAt === 'string' ? integration.connectedAt : (integration.connectedAt as any).toDate()).toLocaleDateString()}
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
                checked={integration.syncSettings.syncInvoices}
                onChange={(e) => onUpdate({ syncInvoices: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Sync Invoices</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.syncSettings.syncPayments}
                onChange={(e) => onUpdate({ syncPayments: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Sync Payments</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.syncSettings.syncContacts}
                onChange={(e) => onUpdate({ syncContacts: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Sync Contacts</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.syncSettings.syncItems}
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
                value={integration.syncSettings.syncDirection}
                onChange={(e) => onUpdate({ syncDirection: e.target.value as any })}
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
                <option value="crm_to_xero">CRM → Xero</option>
                <option value="xero_to_crm">Xero → CRM</option>
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

