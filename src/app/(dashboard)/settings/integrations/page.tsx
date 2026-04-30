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
import GmailIntegration from '@/components/integrations/GmailIntegration';
import OutlookIntegration from '@/components/integrations/OutlookIntegration';
import GoogleCalendarIntegration from '@/components/integrations/GoogleCalendarIntegration';
import ZoomIntegration from '@/components/integrations/ZoomIntegration';
import OutlookCalendarIntegration from '@/components/integrations/OutlookCalendarIntegration';
import SlackIntegration from '@/components/integrations/SlackIntegration';
import TeamsIntegration from '@/components/integrations/TeamsIntegration';
import ZapierIntegration from '@/components/integrations/ZapierIntegration';
import TwitterIntegration from '@/components/integrations/TwitterIntegration';
import LinkedInIntegration from '@/components/integrations/LinkedInIntegration';
import SocialPlatformIntegration, { SOCIAL_PLATFORM_CONFIGS } from '@/components/integrations/SocialPlatformIntegration';
import GoogleSearchConsoleIntegration from '@/components/integrations/GoogleSearchConsoleIntegration';
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
  }, [user, searchParams, loadSocialAccounts]);

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
      id: 'email',
      name: 'Email',
      icon: '📧',
      integrations: [
        { id: 'gmail', component: GmailIntegration },
        { id: 'outlook', component: OutlookIntegration },
      ],
    },
    {
      id: 'calendar',
      name: 'Calendar',
      icon: '📅',
      integrations: [
        { id: 'google-calendar', component: GoogleCalendarIntegration },
        { id: 'outlook-calendar', component: OutlookCalendarIntegration },
      ],
    },
    {
      id: 'communication',
      name: 'Communication',
      icon: '💬',
      integrations: [
        { id: 'zoom', component: ZoomIntegration },
        { id: 'slack', component: SlackIntegration },
        { id: 'teams', component: TeamsIntegration },
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
      id: 'seo',
      name: 'SEO Tools',
      icon: '🔍',
      integrations: [
        { id: 'google-search-console', component: GoogleSearchConsoleIntegration },
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

  const connectedSocialPlatformCount = socialAccountsByPlatform.size;
  const connectedOtherCount = Object.entries(integrations).filter(
    ([id, i]) => !SOCIAL_PLATFORM_IDS.has(id) && i?.status === 'active'
  ).length;
  const connectedCount = connectedSocialPlatformCount + connectedOtherCount;

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
