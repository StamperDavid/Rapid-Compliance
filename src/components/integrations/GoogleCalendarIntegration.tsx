'use client';

import React, { useState } from 'react';
import type { GoogleCalendarIntegration as GoogleCalendarType } from '@/types/integrations'
import { logger } from '@/lib/logger/logger';
import { useAuth } from '@/hooks/useAuth';
import { PLATFORM_ID } from '@/lib/constants/platform';

interface GoogleCalendarIntegrationProps {
  integration: GoogleCalendarType | null;
  onConnect: (integration: Partial<GoogleCalendarType>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: Partial<GoogleCalendarType['settings']>) => void;
}

export default function GoogleCalendarIntegration({
  integration,
  onConnect: _onConnect,
  onDisconnect,
  onUpdate
}: GoogleCalendarIntegrationProps) {
  const { user: authUser } = useAuth();
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
      const user = { uid: authUser?.id };
      const org = { id: PLATFORM_ID };

      if (!user.uid || !org.id) {
        logger.error('User or organization not found', new Error('User or organization not found'), { file: 'GoogleCalendarIntegration.tsx' });
        setIsConnecting(false);
        return;
      }

      // Redirect to REAL Google OAuth
      window.location.href = `/api/integrations/google/auth?userId=${user.uid}`;
    } catch (error) {
      logger.error('Connection failed:', error instanceof Error ? error : new Error(String(error)), { file: 'GoogleCalendarIntegration.tsx' });
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
          <div style={{ fontSize: '3rem' }}>📅</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              Google Calendar
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
              Sync events, meetings, and appointments
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
          {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
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
        <div style={{ fontSize: '3rem' }}>📅</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                Google Calendar
              </h3>
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
                checked={integration.settings.autoCreateEvents}
                onChange={(e) => onUpdate({ autoCreateEvents: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Auto-create events from CRM</span>
            </label>
            <div>
              <label style={{ fontSize: '0.875rem', color: textColor, display: 'block', marginBottom: '0.5rem' }}>
                Default Reminder (minutes)
              </label>
              <input
                type="number"
                value={integration.settings.reminderSettings?.defaultReminderMinutes ?? 15}
                onChange={(e) => onUpdate({ 
                  reminderSettings: { 
                    defaultReminderMinutes: parseInt(e.target.value) || 15 
                  } 
                })}
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

