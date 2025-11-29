'use client';

import React, { useState } from 'react';
import { SlackIntegration as SlackType } from '@/types/integrations';

interface SlackIntegrationProps {
  integration: SlackType | null;
  onConnect: (integration: Partial<SlackType>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: Partial<SlackType['settings']>) => void;
}

export default function SlackIntegration({ 
  integration, 
  onConnect, 
  onDisconnect, 
  onUpdate 
}: SlackIntegrationProps) {
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
    // MOCK: Simulate OAuth flow
    setTimeout(() => {
      onConnect({
        id: 'slack',
        name: 'Slack',
        description: 'Get notifications in Slack channels',
        icon: '💬',
        category: 'communication',
        status: 'connected',
        organizationId: 'demo-org',
        teamName: 'My Team',
        settings: {
          notifications: {
            newDeal: true,
            dealWon: true,
            dealLost: false,
            newLead: true,
            taskDue: true,
          },
          channels: {
            deals: '#deals',
            leads: '#leads',
            tasks: '#tasks',
            general: '#general',
          },
        },
        connectedAt: new Date(),
      });
      setIsConnecting(false);
    }, 2000);
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
          <div style={{ fontSize: '3rem' }}>💬</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              Slack
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              Get real-time notifications in Slack channels
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
          {isConnecting ? 'Connecting...' : 'Connect Slack'}
        </button>
        <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.75rem', textAlign: 'center' }}>
          You'll be redirected to Slack to authorize the connection
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
        <div style={{ fontSize: '3rem' }}>💬</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                Slack
              </h3>
              {integration.teamName && (
                <p style={{ fontSize: '0.875rem', color: '#666' }}>
                  {integration.teamName}
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
            Notification Settings
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.settings.notifications.newDeal}
                onChange={(e) => onUpdate({ 
                  notifications: { ...integration.settings.notifications, newDeal: e.target.checked }
                })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>New Deal</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.settings.notifications.dealWon}
                onChange={(e) => onUpdate({ 
                  notifications: { ...integration.settings.notifications, dealWon: e.target.checked }
                })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Deal Won</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.settings.notifications.dealLost}
                onChange={(e) => onUpdate({ 
                  notifications: { ...integration.settings.notifications, dealLost: e.target.checked }
                })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Deal Lost</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.settings.notifications.newLead}
                onChange={(e) => onUpdate({ 
                  notifications: { ...integration.settings.notifications, newLead: e.target.checked }
                })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>New Lead</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={integration.settings.notifications.taskDue}
                onChange={(e) => onUpdate({ 
                  notifications: { ...integration.settings.notifications, taskDue: e.target.checked }
                })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Task Due</span>
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

