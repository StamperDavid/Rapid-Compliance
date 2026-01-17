'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import QuickBooksIntegration from '@/components/integrations/QuickBooksIntegration';
import XeroIntegration from '@/components/integrations/XeroIntegration';
import StripeIntegration from '@/components/integrations/StripeIntegration';
import PayPalIntegration from '@/components/integrations/PayPalIntegration';
import GmailIntegration from '@/components/integrations/GmailIntegration';
import OutlookIntegration from '@/components/integrations/OutlookIntegration';
import GoogleCalendarIntegration from '@/components/integrations/GoogleCalendarIntegration';
import OutlookCalendarIntegration from '@/components/integrations/OutlookCalendarIntegration';
import SlackIntegration from '@/components/integrations/SlackIntegration';
import TeamsIntegration from '@/components/integrations/TeamsIntegration';
import ZapierIntegration from '@/components/integrations/ZapierIntegration';
import type { ConnectedIntegration } from '@/types/integrations';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas'
import { logger } from '@/lib/logger/logger';;

export default function IntegrationsPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const { theme } = useOrgTheme();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, ConnectedIntegration | null>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);

  React.useEffect(() => {

    // Load saved integrations from Firestore
    const loadIntegrations = async () => {
      if (!user?.organizationId) {return;}
      
      try {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const integrationsData = await FirestoreService.get(
          `${COLLECTIONS.ORGANIZATIONS}/${user.organizationId}/${COLLECTIONS.INTEGRATIONS}`,
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
  }, [user?.organizationId]);

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';
  const textColor = theme?.colors?.text?.primary || '#ffffff';
  const bgPaper = theme?.colors?.background?.paper || '#1a1a1a';
  const borderColor = theme?.colors?.border?.main || '#333333';

  const handleConnect = async (integrationId: string, integration: Partial<ConnectedIntegration>) => {
    if (!user?.organizationId) {return;}

    const updated: Record<string, ConnectedIntegration | null> = {
      ...integrations,
      [integrationId]: integration as ConnectedIntegration,
    };
    setIntegrations(updated);
    
    // Save to Firestore
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${user.organizationId}/${COLLECTIONS.INTEGRATIONS}`,
        'all',
        updated,
        false
      );
    } catch (error) {
      logger.error('Failed to save integration:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!user?.organizationId) {return;}
    
    const updated = {
      ...integrations,
      [integrationId]: null,
    };
    setIntegrations(updated);
    
    // Save to Firestore
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${user.organizationId}/${COLLECTIONS.INTEGRATIONS}`,
        'all',
        updated,
        false
      );
    } catch (error) {
      logger.error('Failed to disconnect integration:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  };

  const handleUpdate = async (integrationId: string, updates: Partial<ConnectedIntegration>) => {
    if (!user?.organizationId) {return;}
    
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
          `${COLLECTIONS.ORGANIZATIONS}/${user.organizationId}/${COLLECTIONS.INTEGRATIONS}`,
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
        { id: 'slack', component: SlackIntegration },
        { id: 'teams', component: TeamsIntegration },
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

  const connectedCount = Object.values(integrations).filter(i => i?.status === 'active').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Sidebar */}
        <div style={{ 
          width: sidebarOpen ? '260px' : '70px',
          backgroundColor: '#0a0a0a',
          borderRight: '1px solid #1a1a1a',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            <Link
              href="/crm"
              style={{
                width: '100%',
                padding: '0.875rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'transparent',
                color: '#999',
                borderLeft: '3px solid transparent',
                fontSize: '0.875rem',
                fontWeight: '400',
                textDecoration: 'none'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🏠</span>
              {sidebarOpen && <span>Back to CRM</span>}
            </Link>

            {Object.entries(STANDARD_SCHEMAS).map(([key, schema]) => (
              <Link
                key={key}
                href={`/crm?view=${key}`}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: 'transparent',
                  color: '#999',
                  borderLeft: '3px solid transparent',
                  fontSize: '0.875rem',
                  fontWeight: '400',
                  textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
                {sidebarOpen && <span>{schema.pluralName}</span>}
              </Link>
            ))}
          </nav>

          <div style={{ padding: '1rem', borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#1a1a1a',
                color: '#999',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              {sidebarOpen ? '← Collapse' : '→'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <Link 
                href={`/workspace/${orgId}/settings`} 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  color: primaryColor, 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  textDecoration: 'none', 
                  marginBottom: '1.5rem' 
                }}
              >
                ← Back to Settings
              </Link>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: textColor, marginBottom: '0.5rem' }}>
                    Integrations
                  </h1>
                  <p style={{ color: '#666', fontSize: '0.875rem' }}>
                    Connect your favorite apps and services
                  </p>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Connected</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: primaryColor }}>{connectedCount}</div>
              </div>
              <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Available</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: textColor }}>
                  {integrationCategories.reduce((sum, cat) => sum + cat.integrations.length, 0)}
                </div>
              </div>
            </div>

            {/* Category Filter */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveCategory(null)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: activeCategory === null ? primaryColor : 'transparent',
                  border: `1px solid ${activeCategory === null ? primaryColor : borderColor}`,
                  borderRadius: '0.375rem',
                  color: activeCategory === null ? '#fff' : textColor,
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                All
              </button>
              {integrationCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: activeCategory === category.id ? primaryColor : 'transparent',
                    border: `1px solid ${activeCategory === category.id ? primaryColor : borderColor}`,
                    borderRadius: '0.375rem',
                    color: activeCategory === category.id ? '#fff' : textColor,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
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
                <div key={category.id} style={{ marginBottom: '3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>{category.icon}</span>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: textColor }}>
                      {category.name}
                    </h2>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
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
                          integration={integrations[id] ?? null}
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
        </div>
      </div>
    </div>
  );
}
