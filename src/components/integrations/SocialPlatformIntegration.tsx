'use client';

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
  color: string;
  connectMethod: ConnectMethod;
  credentialFields?: CredentialField[];
  connectEndpoint?: string;
  /** Where to send the user if they don't have an account yet. */
  signupUrl?: string;
}

export const SOCIAL_PLATFORM_CONFIGS: SocialPlatformConfig[] = [
  { id: 'facebook', name: 'Facebook', color: '#1877F2', connectMethod: 'oauth', signupUrl: 'https://www.facebook.com/r.php' },
  { id: 'instagram', name: 'Instagram', color: '#E4405F', connectMethod: 'oauth', signupUrl: 'https://www.instagram.com/accounts/emailsignup/' },
  { id: 'threads', name: 'Threads', color: '#000000', connectMethod: 'oauth', signupUrl: 'https://www.threads.net/' },
  { id: 'whatsapp_business', name: 'WhatsApp Business', color: '#25D366', connectMethod: 'oauth', signupUrl: 'https://business.whatsapp.com/' },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', connectMethod: 'oauth', signupUrl: 'https://accounts.google.com/signup' },
  { id: 'google_business', name: 'Google Business', color: '#4285F4', connectMethod: 'oauth', signupUrl: 'https://business.google.com/create' },
  { id: 'tiktok', name: 'TikTok', color: '#000000', connectMethod: 'oauth', signupUrl: 'https://www.tiktok.com/signup' },
  { id: 'reddit', name: 'Reddit', color: '#FF4500', connectMethod: 'oauth', signupUrl: 'https://www.reddit.com/register' },
  { id: 'pinterest', name: 'Pinterest', color: '#E60023', connectMethod: 'oauth', signupUrl: 'https://www.pinterest.com/business/create/' },
  {
    id: 'bluesky', name: 'Bluesky', color: '#0085FF', connectMethod: 'credentials',
    connectEndpoint: '/api/social/connect/bluesky',
    signupUrl: 'https://bsky.app/',
    credentialFields: [
      { key: 'identifier', label: 'Handle', placeholder: 'yourname.bsky.social', type: 'text' },
      { key: 'password', label: 'App Password', placeholder: 'From Bluesky Settings > App Passwords', type: 'password' },
    ],
  },
  {
    id: 'telegram', name: 'Telegram', color: '#26A5E4', connectMethod: 'credentials',
    connectEndpoint: '/api/social/connect/telegram',
    signupUrl: 'https://telegram.org/',
    credentialFields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'From @BotFather', type: 'password' },
      { key: 'chatId', label: 'Chat ID', placeholder: 'Channel or group chat ID', type: 'text' },
    ],
  },
  {
    id: 'truth_social', name: 'Truth Social', color: '#4C75A3', connectMethod: 'credentials',
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: config.color }}
          />
          <span className="font-semibold text-sm text-foreground">{config.name}</span>
          {isConnected && (
            <span className="text-xs text-success font-medium">Connected</span>
          )}
        </div>
        {isConnected && (
          <Button variant="outline" size="sm" onClick={onDisconnect}>
            Disconnect
          </Button>
        )}
      </div>

      {!isConnected && config.connectMethod === 'oauth' && (
        <Button
          size="sm"
          onClick={handleOAuthConnect}
          style={{ backgroundColor: config.color, color: '#fff' }}
        >
          Connect {config.name}
        </Button>
      )}

      {!isConnected && config.connectMethod === 'credentials' && config.credentialFields && (
        <div className="space-y-2">
          {config.credentialFields.map((field) => (
            <div key={field.key}>
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`${config.id}-${field.key}`}>
                {field.label}
              </label>
              <Input
                id={`${config.id}-${field.key}`}
                type={field.type ?? 'text'}
                placeholder={field.placeholder}
                value={creds[field.key] ?? ''}
                onChange={(e) => setCreds({ ...creds, [field.key]: e.target.value })}
                disabled={connecting}
                className="mt-1"
              />
            </div>
          ))}
          <Button
            size="sm"
            disabled={connecting}
            onClick={() => void handleCredentialConnect()}
            style={{ backgroundColor: config.color, color: '#fff' }}
          >
            {connecting ? 'Connecting...' : `Connect ${config.name}`}
          </Button>
        </div>
      )}

      {!isConnected && config.signupUrl && (
        <div className="text-xs text-muted-foreground">
          Don&apos;t have an account?{' '}
          <a
            href={config.signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Sign up on {config.name} →
          </a>
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}
    </div>
  );
}
