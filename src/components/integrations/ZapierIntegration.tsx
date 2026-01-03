'use client';

import React, { useState } from 'react';
import { ZapierIntegration as ZapierType } from '@/types/integrations';

interface ZapierIntegrationProps {
  integration: ZapierType | null;
  onConnect: (integration: Partial<ZapierType>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: Partial<ZapierType['settings']>) => void;
}

export default function ZapierIntegration({ 
  integration, 
  onConnect, 
  onDisconnect, 
  onUpdate 
}: ZapierIntegrationProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

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
    if (!webhookUrl) {
      alert('Please enter your Zapier webhook URL');
      return;
    }
    
    // Validate webhook URL format
    try {
      new URL(webhookUrl);
      if (!webhookUrl.includes('hooks.zapier.com')) {
        throw new Error('Invalid Zapier webhook URL');
      }
    } catch (error) {
      alert('Please enter a valid Zapier webhook URL (e.g., https://hooks.zapier.com/hooks/catch/...)');
      return;
    }
    
    setIsConnecting(true);
    
    try {
      // Test the webhook connection
      const testResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'connection_test',
          timestamp: new Date().toISOString(),
          message: 'Testing Zapier webhook connection',
        }),
      });
      
      if (!testResponse.ok) {
        throw new Error('Webhook test failed - please verify the URL is correct');
      }
      
      // Connection successful
      onConnect({
        id: 'zapier',
        name: 'Zapier',
        description: 'Connect 5,000+ apps via Zapier',
        icon: '⚡',
        category: 'automation',
        status: 'active',
        organizationId: 'demo-org',
        webhookUrl,
        settings: {
          enabledZaps: [],
          webhookSecurity: {
            enabled: false,
          },
        },
        connectedAt: new Date().toISOString(),
      });
      setWebhookUrl('');
    } catch (error: any) {
      alert(`Connection failed: ${error.message}`);
    } finally {
      setIsConnecting(false);
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
          <div style={{ fontSize: '3rem' }}>⚡</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              Zapier
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              Connect 5,000+ apps and automate workflows
            </p>
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.875rem', color: textColor, display: 'block', marginBottom: '0.5rem' }}>
            Zapier Webhook URL
          </label>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/hooks/catch/..."
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
            Get your webhook URL from your Zapier Zap
          </p>
        </div>
        <button
          onClick={handleConnect}
          disabled={isConnecting || !webhookUrl}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: isConnecting || !webhookUrl ? '#444' : primaryColor,
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isConnecting || !webhookUrl ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}
        >
          {isConnecting ? 'Connecting...' : 'Connect Zapier'}
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
        <div style={{ fontSize: '3rem' }}>⚡</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                Zapier
              </h3>
              {integration.webhookUrl && (
                <p style={{ fontSize: '0.75rem', color: '#666', wordBreak: 'break-all' }}>
                  {integration.webhookUrl.substring(0, 50)}...
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
                checked={integration.settings.webhookSecurity?.enabled ?? false}
                onChange={(e) => onUpdate({ 
                  webhookSecurity: { 
                    ...integration.settings.webhookSecurity, 
                    enabled: e.target.checked 
                  }
                })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Enable webhook security</span>
            </label>
            {integration.settings.webhookSecurity?.enabled && (
              <div>
                <label style={{ fontSize: '0.875rem', color: textColor, display: 'block', marginBottom: '0.5rem' }}>
                  Webhook Secret
                </label>
                <input
                  type="password"
                  value={integration.settings.webhookSecurity?.secret || ''}
                  onChange={(e) => onUpdate({ 
                    webhookSecurity: { 
                      ...integration.settings.webhookSecurity, 
                      secret: e.target.value 
                    }
                  })}
                  placeholder="Enter webhook secret"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: 'var(--color-bg-main)',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.375rem',
                    color: textColor,
                    fontSize: '0.875rem'
                  }}
                />
              </div>
            )}
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

