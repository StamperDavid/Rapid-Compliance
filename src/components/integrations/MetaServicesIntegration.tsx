'use client';

/**
 * MetaServicesIntegration
 *
 * Single unified card for the central connected-Meta account. Replaces
 * the previous four fragmented entries (Facebook, Instagram, Threads,
 * WhatsApp Business) — one OAuth grants access to all four sub-platforms
 * via the shared Facebook Graph token, so showing them as separate
 * "Connect" buttons was misleading and visually inconsistent.
 *
 * Connection state is determined by whether the parent integrations page
 * has loaded any active social_accounts rows for the four sub-platforms.
 * The Facebook callback at /api/social/oauth/callback/facebook writes
 * one social_accounts row per sub-platform that the user has provisioned
 * on their Meta account, all sharing the same encrypted Meta access
 * token (and the same metaUserId on the Facebook row, used as the
 * disconnect anchor).
 *
 * Visual shape matches the GoogleServicesIntegration / Microsoft /
 * Zoom / Slack reference exactly. Disconnect is two-step (per the
 * destructive-actions standing rule) and sweeps all four sub-platform
 * rows in one go so the shared token isn't orphaned.
 */

import * as React from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';

export interface MetaSubAccount {
  id: string;
  platform: string;
  accountName: string;
  handle: string;
  profileImageUrl?: string;
  status: 'active' | 'disconnected' | 'expired';
}

interface MetaServicesProps {
  /**
   * Lookup of connected social_accounts rows by sub-platform, supplied
   * by the parent integrations page so we don't hit the API twice.
   * Keys are 'facebook' | 'instagram' | 'threads' | 'whatsapp_business'.
   */
  subAccountsByPlatform: Map<string, MetaSubAccount[]>;
  /** Trigger the parent to refresh its social-account list after disconnect. */
  onRefresh: () => void;
}

interface SubPlatformRow {
  key: 'facebook' | 'instagram' | 'threads' | 'whatsapp_business';
  label: string;
  setupHelp: string;
  setupUrl: string;
}

const SUB_PLATFORMS: SubPlatformRow[] = [
  {
    key: 'facebook',
    label: 'Facebook Page',
    setupHelp: 'Create a Facebook Page',
    setupUrl: 'https://www.facebook.com/pages/create',
  },
  {
    key: 'instagram',
    label: 'Instagram Business',
    setupHelp: 'Convert your Instagram to a Business account and link it to your Facebook Page',
    setupUrl: 'https://help.instagram.com/502981923235522',
  },
  {
    key: 'threads',
    label: 'Threads',
    setupHelp: 'Sign up for Threads from your Instagram account',
    setupUrl: 'https://www.threads.net/',
  },
  {
    key: 'whatsapp_business',
    label: 'WhatsApp Business',
    setupHelp: 'Create a WhatsApp Business Account in Meta Business Suite',
    setupUrl: 'https://business.whatsapp.com/',
  },
];

export default function MetaServicesIntegration({
  subAccountsByPlatform,
  onRefresh,
}: MetaServicesProps): React.ReactElement {
  const authFetch = useAuthFetch();
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [disconnectArmed, setDisconnectArmed] = React.useState(false);
  const disarmTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (disarmTimerRef.current) {
        clearTimeout(disarmTimerRef.current);
      }
    };
  }, []);

  const textColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || 'var(--color-text-primary)'
    : 'var(--color-text-primary)';
  const borderColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-border-main').trim() || 'var(--color-border-main)'
    : 'var(--color-border-main)';
  const primaryColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || 'var(--color-primary)'
    : 'var(--color-primary)';

  // Connection state is derived from the Facebook sub-platform: the
  // callback always writes a Facebook row when OAuth completes, even if
  // the user has no Pages or Instagram accounts linked. If there's no
  // Facebook row, the entire Meta connection is treated as not-connected.
  const facebookAccounts = subAccountsByPlatform.get('facebook') ?? [];
  const connected = facebookAccounts.length > 0;
  const primaryFacebookAccount = connected ? facebookAccounts[0] : undefined;

  const armDisconnect = (): void => {
    setDisconnectArmed(true);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
    }
    disarmTimerRef.current = setTimeout(() => {
      setDisconnectArmed(false);
      disarmTimerRef.current = null;
    }, 5000);
  };

  const cancelDisconnect = (): void => {
    setDisconnectArmed(false);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = null;
    }
  };

  const handleConnect = (): void => {
    setIsConnecting(true);
    // The Facebook auth route kicks off the shared Meta OAuth covering
    // all four sub-platforms (Facebook, Instagram, Threads, WhatsApp).
    window.location.href = '/api/social/oauth/auth/facebook';
  };

  const handleDisconnect = async (): Promise<void> => {
    setIsDisconnecting(true);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = null;
    }
    try {
      // Sweep all four sub-platform rows in one go. Naive per-platform
      // disconnect would orphan the shared Meta token on the others, so
      // we delete every active row for every sub-platform that has one.
      const subKeys: SubPlatformRow['key'][] = [
        'facebook',
        'instagram',
        'threads',
        'whatsapp_business',
      ];
      const deletions: Array<Promise<Response>> = [];
      for (const key of subKeys) {
        const rows = subAccountsByPlatform.get(key) ?? [];
        for (const row of rows) {
          deletions.push(
            authFetch(`/api/social/accounts?id=${encodeURIComponent(row.id)}`, {
              method: 'DELETE',
            }),
          );
        }
      }
      await Promise.all(deletions);
    } catch (error) {
      logger.error(
        'Meta disconnect failed',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'MetaServicesIntegration.tsx' },
      );
    } finally {
      setIsDisconnecting(false);
      setDisconnectArmed(false);
      onRefresh();
    }
  };

  if (!connected) {
    return (
      <div style={{
        backgroundColor: 'var(--color-bg-paper)',
        border: `1px solid ${borderColor}`,
        borderRadius: '0.75rem',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>📘</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
              Meta Services
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
              One sign-in connects Facebook, Instagram, Threads, and WhatsApp Business
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
            fontWeight: 600,
          }}
        >
          {isConnecting ? 'Connecting…' : 'Connect Meta'}
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.75rem', textAlign: 'center' }}>
          You&apos;ll be redirected to Facebook to authorize the connection
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-paper)',
      border: `1px solid ${primaryColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>📘</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: textColor, marginBottom: '0.25rem' }}>
                Meta Services
              </h3>
              {primaryFacebookAccount?.accountName ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
                  Connected as {primaryFacebookAccount.accountName}
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

      <div style={{
        backgroundColor: 'var(--color-bg-elevated)',
        border: `1px solid ${borderColor}`,
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-disabled)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Sub-platforms
        </div>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyle: 'none', padding: 0, margin: 0 }}>
          {SUB_PLATFORMS.map((sub) => {
            const rows = subAccountsByPlatform.get(sub.key) ?? [];
            const provisioned = rows.length > 0;
            const primaryRow = provisioned ? rows[0] : undefined;
            return (
              <li
                key={sub.key}
                style={{
                  fontSize: '0.8125rem',
                  color: textColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                  <span style={{ color: provisioned ? 'var(--color-success-light)' : 'var(--color-text-disabled)' }}>
                    {provisioned ? '✓' : '○'}
                  </span>
                  <span style={{ fontWeight: 500 }}>{sub.label}</span>
                  {provisioned && primaryRow ? (
                    <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      — {primaryRow.accountName}
                      {rows.length > 1 ? ` (+${rows.length - 1} more)` : ''}
                    </span>
                  ) : null}
                </div>
                {!provisioned ? (
                  <a
                    href={sub.setupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-disabled)',
                      textDecoration: 'underline',
                      whiteSpace: 'nowrap',
                    }}
                    title={sub.setupHelp}
                  >
                    Not provisioned in your Meta account →
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        {disconnectArmed ? (
          <>
            <button
              onClick={() => { void handleDisconnect(); }}
              disabled={isDisconnecting}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--color-error)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                opacity: isDisconnecting ? 0.6 : 1,
              }}
            >
              {isDisconnecting ? 'Disconnecting…' : 'Click again to confirm'}
            </button>
            <button
              onClick={cancelDisconnect}
              disabled={isDisconnecting}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'transparent',
                color: textColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={armDisconnect}
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-error-dark)',
              color: 'var(--color-error-light)',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
