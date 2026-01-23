'use client';

import React, { useState } from 'react';
import type { OutlookIntegration as OutlookType } from '@/types/integrations';

interface OutlookIntegrationProps {
  integration: OutlookType | null;
  onConnect: (integration: Partial<OutlookType>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: Partial<OutlookType['settings']>) => void;
}

export default function OutlookIntegration({
  integration,
  onConnect: _onConnect,
  onDisconnect,
  onUpdate
}: OutlookIntegrationProps) {
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

  const handleConnect = () => {
    setIsConnecting(true);
    try {
      // Get current user and org from context or URL
      const userId =(localStorage.getItem('userId') !== '' && localStorage.getItem('userId') != null) ? localStorage.getItem('userId') : 'current-user';
      const orgId = window.location.pathname.split('/')[2] || 'current-org';

      // Redirect to real Microsoft OAuth flow
      window.location.href = `/api/integrations/microsoft/auth?userId=${userId}&orgId=${orgId}`;
    } catch (error) {
      console.error('Failed to start Outlook OAuth:', error);
      setIsConnecting(false);
      console.error('Failed to connect to Outlook. Please try again.');
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
          <div style={{ fontSize: '3rem' }}>📨</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              Outlook
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              Sync emails, track opens and clicks, auto-create contacts
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
          {isConnecting ? 'Connecting...' : 'Connect Outlook'}
        </button>
        <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.75rem', textAlign: 'center' }}>
          You&apos;ll be redirected to Microsoft to authorize the connection
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
        <div style={{ fontSize: '3rem' }}>📨</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                Outlook
              </h3>
              {integration.email && (
                <p style={{ fontSize: '0.875rem', color: '#666' }}>
                  {integration.email}
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
                checked={integration.settings.trackOpens}
                onChange={(e) => onUpdate({ trackOpens: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Track email opens</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.settings.trackClicks}
                onChange={(e) => onUpdate({ trackClicks: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Track link clicks</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.settings.autoCreateContacts}
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

