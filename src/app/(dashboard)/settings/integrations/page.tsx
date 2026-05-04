'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import QuickBooksIntegration from '@/components/integrations/QuickBooksIntegration';
import XeroIntegration from '@/components/integrations/XeroIntegration';
import StripeIntegration from '@/components/integrations/StripeIntegration';
import PayPalIntegration from '@/components/integrations/PayPalIntegration';
import ZoomIntegration from '@/components/integrations/ZoomIntegration';
import SlackIntegration from '@/components/integrations/SlackIntegration';
import ZapierIntegration from '@/components/integrations/ZapierIntegration';
import TwitterIntegration from '@/components/integrations/TwitterIntegration';
import LinkedInIntegration from '@/components/integrations/LinkedInIntegration';
import SocialPlatformIntegration, { SOCIAL_PLATFORM_CONFIGS } from '@/components/integrations/SocialPlatformIntegration';
import GoogleServicesIntegration from '@/components/integrations/GoogleServicesIntegration';
import MicrosoftServicesIntegration from '@/components/integrations/MicrosoftServicesIntegration';
import MetaServicesIntegration from '@/components/integrations/MetaServicesIntegration';
import type { ConnectedIntegration } from '@/types/integrations';
import { logger } from '@/lib/logger/logger';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';

interface SocialAccountSummary {
  id: string;
  platform: SocialPlatform;
  accountName: string;
  handle: string;
  profileImageUrl?: string;
  status: 'active' | 'disconnected' | 'expired';
}

const SOCIAL_PLATFORM_IDS = new Set<string>(SOCIAL_PLATFORMS);

export default function IntegrationsPage() {
  const { user } = useAuth();
  const { theme } = useOrgTheme();
  const authFetch = useAuthFetch();
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<string | null>(
    searchParams.get('category') ?? null
  );
  const [integrations, setIntegrations] = useState<Record<string, ConnectedIntegration | null>>({});
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountSummary[]>([]);
  // Central connected-Google account state. Populated from
  // /api/integrations/google/status — drives the Connected state for
  // Gmail, Google Calendar, and Google Search Console cards. The legacy
  // `integrations/all` map doc isn't written by the central OAuth
  // callback, so without this read those cards would always show
  // "Connect" even when the operator has completed OAuth.
  const [googleConnected, setGoogleConnected] = useState<{
    connected: boolean;
    accountEmail?: string;
  } | null>(null);
  // Central connected-Microsoft account state. Populated from
  // /api/integrations/microsoft/status — drives the Connected state for
  // the unified Microsoft Services card (Outlook Mail + Outlook Calendar
  // + OneDrive + Teams via one Azure AD OAuth).
  const [microsoftConnected, setMicrosoftConnected] = useState<{
    connected: boolean;
    accountEmail?: string;
  } | null>(null);

  // Handle success/error URL params from OAuth callbacks
  React.useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success) {
      const providerName = success.charAt(0).toUpperCase() + success.slice(1);
      toast.success(`${providerName} connected successfully!`);
    }
    if (error) {
      const messages: Record<string, string> = {
        state_expired: 'OAuth session expired. Please try again.',
        callback_failed: 'Failed to complete connection. Please try again.',
        invalid_provider: 'Invalid provider specified.',
        invalid_callback: 'Invalid callback parameters.',
      };
      toast.error(messages[error] ?? 'Connection failed. Please try again.');
    }
  }, [searchParams]);

  const loadSocialAccounts = React.useCallback(async () => {
    if (!user) { return; }
    try {
      const res = await authFetch('/api/social/accounts');
      if (!res.ok) { return; }
      const body = (await res.json()) as { success: boolean; accounts?: SocialAccountSummary[] };
      if (body.success && Array.isArray(body.accounts)) {
        setSocialAccounts(body.accounts);
      }
    } catch (error) {
      logger.error('Failed to load social accounts:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  }, [user, authFetch]);

  // Load central-Google connection state. The OAuth callback writes to
  // organizations/{tenant}/connectedAccounts/google (Admin SDK), which
  // the client SDK can't read directly under Firestore rules — so we go
  // through this status endpoint that reads via Admin SDK on the server.
  const loadGoogleStatus = React.useCallback(async () => {
    if (!user) { return; }
    try {
      const res = await authFetch('/api/integrations/google/status');
      if (!res.ok) { return; }
      const body = (await res.json()) as {
        success: boolean;
        connected?: boolean;
        accountEmail?: string;
      };
      if (body.success) {
        setGoogleConnected({
          connected: body.connected === true,
          accountEmail: body.accountEmail,
        });
      }
    } catch (error) {
      logger.error('Failed to load google status:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  }, [user, authFetch]);

  // Load central-Microsoft connection state. Mirrors loadGoogleStatus —
  // the OAuth callback writes to organizations/{tenant}/connectedAccounts/microsoft
  // (Admin SDK), which the client SDK can't read directly under Firestore
  // rules, so we go through this status endpoint that reads via Admin SDK
  // on the server.
  const loadMicrosoftStatus = React.useCallback(async () => {
    if (!user) { return; }
    try {
      const res = await authFetch('/api/integrations/microsoft/status');
      if (!res.ok) { return; }
      const body = (await res.json()) as {
        success: boolean;
        connected?: boolean;
        accountEmail?: string;
      };
      if (body.success) {
        setMicrosoftConnected({
          connected: body.connected === true,
          accountEmail: body.accountEmail,
        });
      }
    } catch (error) {
      logger.error('Failed to load microsoft status:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  }, [user, authFetch]);

  React.useEffect(() => {

    // Load saved integrations from Firestore
    const loadIntegrations = async () => {
      if (!user) {return;}

      try {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const integrationsData = await FirestoreService.get(
          `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.INTEGRATIONS}`,
          'all'
        );

        if (integrationsData) {
          setIntegrations(integrationsData as Record<string, ConnectedIntegration | null>);
        }
      } catch (error) {
        logger.error('Failed to load integrations:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      }
    };

    void loadIntegrations();
    // Also load social accounts — social OAuth callbacks write to the
    // social_accounts collection, not the integrations/all map doc, so the
    // integrations map alone doesn't reflect real connection state for the
    // 14 social platforms.
    void loadSocialAccounts();
    // Load central Google connection state — drives the Connected
    // indicator on the Gmail / Google Calendar / GSC cards.
    void loadGoogleStatus();
    // Load central Microsoft connection state — drives the Connected
    // indicator on the unified Microsoft Services card (covers Outlook
    // Mail, Outlook Calendar, OneDrive, and Teams via one Azure AD OAuth).
    void loadMicrosoftStatus();
  }, [user, searchParams, loadSocialAccounts, loadGoogleStatus, loadMicrosoftStatus]);

  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';
  const textColor = theme?.colors?.text?.primary || 'var(--color-text-primary)';
  const borderColor = theme?.colors?.border?.main || 'var(--color-border-strong)';

  const handleConnect = async (integrationId: string, integration: Partial<ConnectedIntegration>) => {
    if (!user) {return;}

    const updated: Record<string, ConnectedIntegration | null> = {
      ...integrations,
      [integrationId]: integration as ConnectedIntegration,
    };
    setIntegrations(updated);
    
    // Save to Firestore
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.INTEGRATIONS}`,
        'all',
        updated,
        false
      );
    } catch (error) {
      logger.error('Failed to save integration:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!user) {return;}

    // Social platforms: delete the matching social_accounts records so the
    // real connection state flips. The integrations/all map is cleared too
    // in case any legacy write left a stale entry.
    if (SOCIAL_PLATFORM_IDS.has(integrationId)) {
      const matching = socialAccounts.filter((a) => a.platform === integrationId);
      try {
        await Promise.all(matching.map((acct) =>
          authFetch(`/api/social/accounts?id=${encodeURIComponent(acct.id)}`, { method: 'DELETE' })
        ));
        setSocialAccounts((prev) => prev.filter((a) => a.platform !== integrationId));
      } catch (error) {
        logger.error('Failed to remove social accounts:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      }
    }

    const updated = {
      ...integrations,
      [integrationId]: null,
    };
    setIntegrations(updated);

    // Save to Firestore
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.INTEGRATIONS}`,
        'all',
        updated,
        false
      );
    } catch (error) {
      logger.error('Failed to disconnect integration:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  };

  const handleUpdate = async (integrationId: string, updates: Partial<ConnectedIntegration>) => {
    if (!user) {return;}
    
    const current = integrations[integrationId];
    if (current) {
      const updated = {
        ...integrations,
        [integrationId]: { ...current, ...updates },
      };
      setIntegrations(updated);
      
      // Save to Firestore
      try {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.INTEGRATIONS}`,
          'all',
          updated,
          false
        );
      } catch (error) {
        logger.error('Failed to update integration:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      }
    }
  };

  const integrationCategories = [
    {
      id: 'accounting',
      name: 'Accounting',
      icon: '📊',
      integrations: [
        { id: 'quickbooks', component: QuickBooksIntegration },
        { id: 'xero', component: XeroIntegration },
      ],
    },
    {
      id: 'payment',
      name: 'Payment Processing',
      icon: '💳',
      integrations: [
        { id: 'stripe', component: StripeIntegration },
        { id: 'paypal', component: PayPalIntegration },
      ],
    },
    {
      // Workspace accounts — Google + Microsoft side-by-side. Each is a
      // unified card that, with one OAuth, grants access to that
      // provider's full suite (Gmail/Calendar/Drive/YouTube/GBP/Analytics/
      // Search Console/Ads on Google; Outlook Mail/Outlook Calendar/
      // OneDrive/Teams on Microsoft). Grouped together so the 2-col grid
      // fills cleanly instead of each leaving a ghost empty cell.
      id: 'workspace',
      name: 'Workspace Accounts',
      icon: '🔐',
      integrations: [
        { id: 'google-services', component: null },
        { id: 'microsoft-services', component: null },
      ],
    },
    {
      // Meta — single unified card that covers Facebook, Instagram,
      // Threads, and WhatsApp Business through one OAuth. Sits between
      // Workspace Accounts and Communication so the consolidation
      // pattern (Google + Microsoft + Meta) is visually adjacent.
      id: 'meta',
      name: 'Meta',
      icon: '📘',
      integrations: [
        { id: 'meta-services', component: null },
      ],
    },
    {
      id: 'communication',
      name: 'Communication',
      icon: '💬',
      integrations: [
        { id: 'zoom', component: ZoomIntegration },
        { id: 'slack', component: SlackIntegration },
      ],
    },
    {
      id: 'social',
      name: 'Social Media',
      icon: '📱',
      integrations: [
        { id: 'twitter', component: TwitterIntegration },
        { id: 'linkedin', component: LinkedInIntegration },
        ...SOCIAL_PLATFORM_CONFIGS.map((cfg) => ({
          id: cfg.id,
          component: function SocialWrapper(props: {
            integration: ConnectedIntegration | null;
            onConnect: (integration: Partial<ConnectedIntegration>) => void;
            onDisconnect: () => void;
            onUpdate: (updates: Record<string, unknown>) => void;
          }) {
            return (
              <SocialPlatformIntegration
                config={cfg}
                integration={props.integration as Record<string, unknown> | null}
                onConnect={(data) => props.onConnect(data as Partial<ConnectedIntegration>)}
                onDisconnect={props.onDisconnect}
                onUpdate={props.onUpdate}
              />
            );
          },
        })),
      ],
    },
    {
      id: 'automation',
      name: 'Automation',
      icon: '⚡',
      integrations: [
        { id: 'zapier', component: ZapierIntegration },
      ],
    },
  ];

  // Synthesize a ConnectedIntegration-shape view for social platforms that
  // have at least one active account in social_accounts. This is what the
  // integration cards need in order to render as "Connected".
  const socialAccountsByPlatform = React.useMemo(() => {
    const map = new Map<string, SocialAccountSummary[]>();
    for (const acct of socialAccounts) {
      if (acct.status !== 'active') { continue; }
      const list = map.get(acct.platform) ?? [];
      list.push(acct);
      map.set(acct.platform, list);
    }
    return map;
  }, [socialAccounts]);

  const resolveIntegrationForCard = (integrationId: string): ConnectedIntegration | null => {
    if (SOCIAL_PLATFORM_IDS.has(integrationId)) {
      const accounts = socialAccountsByPlatform.get(integrationId);
      if (accounts && accounts.length > 0) {
        const primary = accounts[0];
        return {
          status: 'active',
          platform: integrationId,
          handle: primary.handle,
          accountName: primary.accountName,
          profileImageUrl: primary.profileImageUrl,
          accountCount: accounts.length,
        } as unknown as ConnectedIntegration;
      }
      // No active social account → card stays "Connect"
      return null;
    }

    return integrations[integrationId] ?? null;
  };

  // Meta sub-platform IDs roll up under one unified card and one OAuth.
  // Keep them out of the per-platform social count so a user with all
  // four sub-platforms connected counts as +1 (Meta), not +4.
  const META_SUB_PLATFORMS = new Set(['facebook', 'instagram', 'threads', 'whatsapp_business']);
  const connectedSocialPlatformCount = Array.from(socialAccountsByPlatform.keys()).filter(
    (p) => !META_SUB_PLATFORMS.has(p),
  ).length;
  const metaSubConnected = Array.from(socialAccountsByPlatform.keys()).some((p) =>
    META_SUB_PLATFORMS.has(p),
  );
  const connectedMetaCount = metaSubConnected ? 1 : 0;
  const connectedOtherCount = Object.entries(integrations).filter(
    ([id, i]) => !SOCIAL_PLATFORM_IDS.has(id) && i?.status === 'active'
  ).length;
  // Central Google connection is one unified card now (covers Gmail,
  // Calendar, Drive, YouTube, GBP, Analytics, Search Console, Ads).
  const connectedGoogleCount = googleConnected?.connected === true ? 1 : 0;
  // Central Microsoft connection is one unified card too (covers Outlook
  // Mail, Outlook Calendar, OneDrive, Teams).
  const connectedMicrosoftCount = microsoftConnected?.connected === true ? 1 : 0;
  const connectedCount =
    connectedSocialPlatformCount +
    connectedOtherCount +
    connectedGoogleCount +
    connectedMicrosoftCount +
    connectedMetaCount;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm font-medium no-underline mb-6"
          style={{ color: primaryColor }}
        >
          ← Back to Settings
        </Link>
        <PageTitle>Integrations</PageTitle>
        <SectionDescription className="mt-1">
          Connect your favorite apps and services
        </SectionDescription>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-sm text-muted-foreground mb-2">Connected</div>
          <div className="text-3xl font-bold" style={{ color: primaryColor }}>{connectedCount}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-sm text-muted-foreground mb-2">Available</div>
          <div className="text-3xl font-bold text-foreground">
            {integrationCategories.reduce((sum, cat) => sum + cat.integrations.length, 0)}
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveCategory(null)}
          className="px-4 py-2 rounded text-sm cursor-pointer"
          style={{
            backgroundColor: activeCategory === null ? primaryColor : 'transparent',
            border: `1px solid ${activeCategory === null ? primaryColor : borderColor}`,
            color: activeCategory === null ? 'var(--color-text-primary)' : textColor,
          }}
        >
          All
        </button>
        {integrationCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className="px-4 py-2 rounded text-sm cursor-pointer inline-flex items-center gap-2"
            style={{
              backgroundColor: activeCategory === category.id ? primaryColor : 'transparent',
              border: `1px solid ${activeCategory === category.id ? primaryColor : borderColor}`,
              color: activeCategory === category.id ? 'var(--color-text-primary)' : textColor,
            }}
          >
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      {/* Integrations by Category */}
      {integrationCategories
        .filter(cat => !activeCategory || cat.id === activeCategory)
        .map((category) => (
          <div key={category.id} className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{category.icon}</span>
              <h2 className="text-2xl font-bold text-foreground">{category.name}</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {category.integrations.map(({ id, component: Component }) => {
                // Unified Google Services card — one OAuth covers Gmail,
                // Calendar, Drive, YouTube, GBP, Analytics, Search
                // Console, and Ads. Reads connection state from the
                // /api/integrations/google/status hook above.
                if (id === 'google-services') {
                  return (
                    <GoogleServicesIntegration
                      key={id}
                      connected={googleConnected?.connected === true}
                      accountEmail={googleConnected?.accountEmail}
                      onRefresh={() => { void loadGoogleStatus(); }}
                    />
                  );
                }
                // Unified Microsoft Services card — one Azure AD OAuth
                // covers Outlook Mail, Outlook Calendar, OneDrive, and
                // Teams. Reads connection state from
                // /api/integrations/microsoft/status above.
                if (id === 'microsoft-services') {
                  return (
                    <MicrosoftServicesIntegration
                      key={id}
                      connected={microsoftConnected?.connected === true}
                      accountEmail={microsoftConnected?.accountEmail}
                      onRefresh={() => { void loadMicrosoftStatus(); }}
                    />
                  );
                }
                // Unified Meta Services card — one Facebook OAuth covers
                // Facebook Page, Instagram Business, Threads, and
                // WhatsApp Business. Connection state is derived from
                // the social_accounts loaded above (no separate status
                // endpoint — the OAuth callback writes one row per
                // sub-platform that the user has provisioned).
                if (id === 'meta-services') {
                  return (
                    <MetaServicesIntegration
                      key={id}
                      subAccountsByPlatform={socialAccountsByPlatform}
                      onRefresh={() => { void loadSocialAccounts(); }}
                    />
                  );
                }
                if (!Component) {
                  return null;
                }
                const IntegrationComponent = Component as React.ComponentType<{
                  integration: ConnectedIntegration | null;
                  onConnect: (integration: Partial<ConnectedIntegration>) => void;
                  onDisconnect: () => void;
                  onUpdate: (updates: Record<string, unknown>) => void;
                }>;
                return (
                  <IntegrationComponent
                    key={id}
                    integration={resolveIntegrationForCard(id)}
                    onConnect={(integration) => { void handleConnect(id, integration); }}
                    onDisconnect={() => { void handleDisconnect(id); }}
                    onUpdate={(updates) => {
                      if (id === 'quickbooks' || id === 'xero') {
                        const current = integrations[id];
                        const currentSync = current?.settings ?? {};
                        void handleUpdate(id, { settings: { ...currentSync, syncSettings: { ...(currentSync.syncSettings as Record<string, unknown> | undefined), ...updates } } });
                      } else {
                        const current = integrations[id];
                        void handleUpdate(id, { settings: { ...current?.settings, ...updates } });
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
