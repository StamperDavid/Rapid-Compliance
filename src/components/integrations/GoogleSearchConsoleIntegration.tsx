'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ConnectedIntegration } from '@/types/integrations';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';

interface GSCSettings {
  selectedProperty?: string;
  syncImpressions?: boolean;
  syncClicks?: boolean;
  syncPositions?: boolean;
}

interface GSCProperty {
  siteUrl: string;
  permissionLevel: string;
}

interface GSCIntegrationProps {
  integration: ConnectedIntegration | null;
  onConnect: (integration: Partial<ConnectedIntegration>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: GSCSettings) => void;
}

export default function GoogleSearchConsoleIntegration({
  integration,
  onConnect: _onConnect,
  onDisconnect,
  onUpdate
}: GSCIntegrationProps) {
  const { user } = useAuth();
  const authFetch = useAuthFetch();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [properties, setProperties] = useState<GSCProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || 'var(--color-text-primary)'
    : 'var(--color-text-primary)';

  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || 'var(--color-border-main)'
    : 'var(--color-border-main)';

  const primaryColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || 'var(--color-primary)'
    : 'var(--color-primary)';

  const getSettings = (): GSCSettings => {
    const settings = integration?.settings;
    if (settings) {
      return {
        selectedProperty: settings.selectedProperty as string | undefined,
        syncImpressions: settings.syncImpressions as boolean | undefined,
        syncClicks: settings.syncClicks as boolean | undefined,
        syncPositions: settings.syncPositions as boolean | undefined,
      };
    }
    return {};
  };

  const fetchProperties = useCallback(async () => {
    setLoadingProperties(true);
    try {
      const response = await authFetch('/api/seo/gsc/properties');
      if (response.ok) {
        const data = await response.json() as { success: boolean; data: GSCProperty[] };
        if (data.success && data.data) {
          setProperties(data.data);
        }
      }
    } catch (error) {
      logger.warn('Failed to fetch GSC properties', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoadingProperties(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (integration?.status === 'active' && showSettings) {
      void fetchProperties();
    }
  }, [integration?.status, showSettings, fetchProperties]);

  const handleConnect = () => {
    setIsConnecting(true);
    try {
      const userId = user?.id ?? 'anonymous';
      window.location.href = `/api/integrations/google/auth?userId=${userId}&service=gsc`;
    } catch (error) {
      logger.error('Failed to start GSC OAuth', error instanceof Error ? error : new Error(String(error)));
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
          <div style={{ fontSize: '3rem' }}>🔍</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              Google Search Console
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
              Monitor search performance, impressions, clicks, and keyword positions
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
          {isConnecting ? 'Connecting...' : 'Connect Google Search Console'}
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.75rem', textAlign: 'center' }}>
          You&apos;ll be redirected to Google to authorize Search Console access
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
        <div style={{ fontSize: '3rem' }}>🔍</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                Google Search Console
              </h3>
              {getSettings().selectedProperty && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
                  {getSettings().selectedProperty}
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
        </div>
      </div>

      {showSettings ? (
        <div style={{ marginTop: '1.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
            Settings
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: 'var(--color-text-disabled)', marginBottom: '0.375rem' }}>
                Property
              </label>
              <select
                value={getSettings().selectedProperty ?? ''}
                onChange={(e) => onUpdate({ selectedProperty: e.target.value })}
                disabled={loadingProperties}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.375rem',
                  color: textColor,
                  fontSize: '0.875rem'
                }}
              >
                <option value="">{loadingProperties ? 'Loading properties...' : 'Select a property'}</option>
                {properties.map(p => (
                  <option key={p.siteUrl} value={p.siteUrl}>{p.siteUrl}</option>
                ))}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={getSettings().syncImpressions ?? true}
                onChange={(e) => onUpdate({ syncImpressions: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Sync impressions data</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={getSettings().syncClicks ?? true}
                onChange={(e) => onUpdate({ syncClicks: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Sync clicks data</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={getSettings().syncPositions ?? true}
                onChange={(e) => onUpdate({ syncPositions: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.875rem', color: textColor }}>Sync keyword positions</span>
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
