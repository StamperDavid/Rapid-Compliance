'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

export default function IntegrationsPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    }
  }, []);

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const integrations = [
    { id: 'slack', name: 'Slack', description: 'Get notifications in Slack channels', icon: '💬', connected: true },
    { id: 'zapier', name: 'Zapier', description: 'Connect 5,000+ apps via Zapier', icon: '⚡', connected: false },
    { id: 'google-workspace', name: 'Google Workspace', description: 'Sync with Gmail, Calendar, Drive', icon: '📧', connected: true },
    { id: 'microsoft-365', name: 'Microsoft 365', description: 'Integrate with Outlook, Teams, OneDrive', icon: '📨', connected: false },
    { id: 'mailchimp', name: 'Mailchimp', description: 'Sync contacts and campaigns', icon: '📮', connected: false },
    { id: 'hubspot', name: 'HubSpot', description: 'Two-way sync with HubSpot CRM', icon: '🔶', connected: false }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />

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
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <Link href="/workspace/demo-org/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                ← Back to Settings
              </Link>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Business Apps</h1>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>
                Connect Slack, Zapier, and other third-party applications
              </p>
            </div>

            {/* Connected Apps Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Connected Apps</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: primaryColor }}>2</div>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Available</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>{integrations.length}</div>
              </div>
            </div>

            {/* Integrations Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {integrations.map(integration => (
                <div
                  key={integration.id}
                  style={{
                    backgroundColor: '#1a1a1a',
                    border: integration.connected ? `1px solid ${primaryColor}` : '1px solid #333',
                    borderRadius: '1rem',
                    padding: '1.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '3rem' }}>{integration.icon}</div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>{integration.name}</h3>
                      <p style={{ fontSize: '0.875rem', color: '#999' }}>{integration.description}</p>
                    </div>
                  </div>
                  {integration.connected && (
                    <div style={{ padding: '0.75rem', backgroundColor: '#0f4c0f', border: '1px solid #4ade80', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: '600' }}>✓ Connected</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: integration.connected ? '#222' : primaryColor,
                        color: '#fff',
                        border: integration.connected ? '1px solid #333' : 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}
                    >
                      {integration.connected ? 'Configure' : 'Connect'}
                    </button>
                    {integration.connected && (
                      <button
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
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

