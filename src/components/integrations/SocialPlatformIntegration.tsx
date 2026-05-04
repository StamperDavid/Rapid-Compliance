'use client';

/**
 * SocialPlatformIntegration
 *
 * Generic integration card for OAuth- and credential-based social
 * platforms. Renders with the same card chrome as Zoom / Slack /
 * Twitter so every entry on /settings/integrations looks uniform.
 *
 * `youtube` and `google_business` were removed from the config list —
 * they are part of the central Google account and now live in the
 * unified GoogleServicesIntegration card.
 *
 * `facebook`, `instagram`, `threads`, and `whatsapp_business` were
 * removed for the same reason — they all share one Meta OAuth token
 * and now live in the unified MetaServicesIntegration card.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthFetch } from '@/hooks/useAuthFetch';

type ConnectMethod = 'oauth' | 'credentials';

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'password';
}

interface SocialPlatformConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  connectMethod: ConnectMethod;
  credentialFields?: CredentialField[];
  connectEndpoint?: string;
  /** Where to send the user if they don't have an account yet. */
  signupUrl?: string;
}

export const SOCIAL_PLATFORM_CONFIGS: SocialPlatformConfig[] = [
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    description: 'Schedule and publish videos to your TikTok account',
    color: '#000000',
    connectMethod: 'oauth',
    signupUrl: 'https://www.tiktok.com/signup',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    icon: '👽',
    description: 'Post to subreddits and reply to comments',
    color: '#FF4500',
    connectMethod: 'oauth',
    signupUrl: 'https://www.reddit.com/register',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: '📌',
    description: 'Create pins and manage boards from your account',
    color: '#E60023',
    connectMethod: 'oauth',
    signupUrl: 'https://www.pinterest.com/business/create/',
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    icon: '🦋',
    description: 'Post to your Bluesky handle via app password',
    color: '#0085FF',
    connectMethod: 'credentials',
    connectEndpoint: '/api/social/connect/bluesky',
    signupUrl: 'https://bsky.app/',
    credentialFields: [
      { key: 'identifier', label: 'Handle', placeholder: 'yourname.bsky.social', type: 'text' },
      { key: 'password', label: 'App Password', placeholder: 'From Bluesky Settings > App Passwords', type: 'password' },
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    description: 'Broadcast messages to a Telegram channel or group',
    color: '#26A5E4',
    connectMethod: 'credentials',
    connectEndpoint: '/api/social/connect/telegram',
    signupUrl: 'https://telegram.org/',
    credentialFields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'From @BotFather', type: 'password' },
      { key: 'chatId', label: 'Chat ID', placeholder: 'Channel or group chat ID', type: 'text' },
    ],
  },
  {
    id: 'truth_social',
    name: 'Truth Social',
    icon: '🇺🇸',
    description: 'Post to your Truth Social account via API token',
    color: '#4C75A3',
    connectMethod: 'credentials',
    connectEndpoint: '/api/social/connect/truth_social',
    signupUrl: 'https://truthsocial.com/',
    credentialFields: [
      { key: 'accessToken', label: 'Access Token', placeholder: 'From account settings', type: 'password' },
      { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://truthsocial.com', type: 'text' },
    ],
  },
];

interface SocialPlatformIntegrationProps {
  config: SocialPlatformConfig;
  integration: Record<string, unknown> | null;
  onConnect: (integration: Record<string, unknown>) => void;
  onDisconnect: () => void;
  onUpdate: (settings: Record<string, unknown>) => void;
}

export default function SocialPlatformIntegration({
  config,
  integration,
  onConnect,
  onDisconnect,
}: SocialPlatformIntegrationProps) {
  const authFetch = useAuthFetch();
  const [connecting, setConnecting] = useState(false);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const isConnected = integration?.status === 'active';
  const accountHandle = typeof integration?.handle === 'string' ? integration.handle : null;
  const accountName = typeof integration?.accountName === 'string' ? integration.accountName : null;

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || 'var(--color-text-primary)'
    : 'var(--color-text-primary)';
  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || 'var(--color-border-main)'
    : 'var(--color-border-main)';
  const primaryColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || 'var(--color-primary)'
    : 'var(--color-primary)';

  const handleOAuthConnect = () => {
    window.location.href = `/api/social/oauth/auth/${config.id}`;
  };

  const handleCredentialConnect = async () => {
    if (!config.connectEndpoint || !config.credentialFields) { return; }
    const missing = config.credentialFields.filter((f) => !creds[f.key]?.trim());
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const res = await authFetch(config.connectEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const body = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !body.success) {
        setError(body.error ?? `Connection failed (HTTP ${res.status})`);
        return;
      }
      onConnect({ status: 'active', platform: config.id, ...body });
      setCreds({});
    } catch {
      setError('Connection failed. Check your credentials and try again.');
    } finally {
      setConnecting(false);
    }
  };

  const cardOuterStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-paper)',
    border: `1px solid ${isConnected ? primaryColor : borderColor}`,
    borderRadius: '0.75rem',
    padding: '1.5rem',
  };

  if (!isConnected) {
    return (
      <div style={cardOuterStyle}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>{config.icon}</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              {config.name}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
              {config.description}
            </p>
          </div>
        </div>

        {config.connectMethod === 'oauth' ? (
          <>
            <button
              onClick={handleOAuthConnect}
              disabled={connecting}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: connecting ? 'var(--color-border-strong)' : config.color,
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: connecting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {`Connect ${config.name}`}
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.75rem', textAlign: 'center' }}>
              You&apos;ll be redirected to {config.name} to authorize the connection
            </p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {config.credentialFields?.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`${config.id}-${field.key}`}
                    style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-disabled)', marginBottom: '0.375rem' }}
                  >
                    {field.label}
                  </label>
                  <Input
                    id={`${config.id}-${field.key}`}
                    type={field.type ?? 'text'}
                    placeholder={field.placeholder}
                    value={creds[field.key] ?? ''}
                    onChange={(e) => setCreds({ ...creds, [field.key]: e.target.value })}
                    disabled={connecting}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => void handleCredentialConnect()}
              disabled={connecting}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: connecting ? 'var(--color-border-strong)' : config.color,
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: connecting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {connecting ? 'Connecting…' : `Connect ${config.name}`}
            </button>
          </>
        )}

        {config.signupUrl ? (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.75rem', textAlign: 'center' }}>
            Don&apos;t have an account?{' '}
            <a
              href={config.signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-text-disabled)', textDecoration: 'underline' }}
            >
              Sign up on {config.name} →
            </a>
          </p>
        ) : null}

        {error ? (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-error-light)', marginTop: '0.75rem', textAlign: 'center' }}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div style={cardOuterStyle}>
      <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>{config.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                {config.name}
              </h3>
              {accountHandle ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
                  {accountHandle}{accountName ? ` — ${accountName}` : ''}
                </p>
              ) : null}
            </div>
            <div style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: 'var(--color-success-dark)',
              border: '1px solid var(--color-success-light)',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              color: 'var(--color-success-light)',
              fontWeight: 600,
            }}>
              ✓ Connected
            </div>
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={onDisconnect}
        style={{
          width: '100%',
        }}
      >
        Disconnect
      </Button>
    </div>
  );
}
