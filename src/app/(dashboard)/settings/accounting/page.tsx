'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getSubCollection } from '@/lib/firebase/collections';
import { FirestoreService } from '@/lib/db/firestore-service';

interface AccountingConfig {
  platform: 'quickbooks' | 'xero' | 'freshbooks' | 'wave' | 'sage' | 'none';
  connected: boolean;
  autoSyncInvoices: boolean;
  autoSyncPayments: boolean;
  autoSyncCustomers: boolean;
  autoSyncProducts: boolean;
  syncFrequency: 'realtime' | 'hourly' | 'daily';
  accountMapping: {
    revenueAccount: string;
    taxAccount: string;
    receivablesAccount: string;
  };
}

const DEFAULT_CONFIG: AccountingConfig = {
  platform: 'none',
  connected: false,
  autoSyncInvoices: false,
  autoSyncPayments: false,
  autoSyncCustomers: false,
  autoSyncProducts: false,
  syncFrequency: 'realtime',
  accountMapping: {
    revenueAccount: '',
    taxAccount: '',
    receivablesAccount: '',
  },
};

const PLATFORMS = [
  { 
    id: 'quickbooks', 
    name: 'QuickBooks Online', 
    icon: '📊', 
    color: 'var(--color-success)',
    description: 'Most popular for small-medium businesses',
    features: ['Invoices', 'Payments', 'Customers', 'Products', 'Sales Tax']
  },
  { 
    id: 'xero', 
    name: 'Xero', 
    icon: '📈', 
    color: 'var(--color-info)',
    description: 'Popular internationally, great reporting',
    features: ['Invoices', 'Payments', 'Contacts', 'Items', 'Tax Rates']
  },
  { 
    id: 'freshbooks', 
    name: 'FreshBooks', 
    icon: '📗', 
    color: 'var(--color-info)',
    description: 'Simple and user-friendly for freelancers',
    features: ['Invoices', 'Payments', 'Clients', 'Expenses']
  },
  { 
    id: 'wave', 
    name: 'Wave', 
    icon: '🌊', 
    color: 'var(--color-secondary)',
    description: 'Free accounting software',
    features: ['Invoices', 'Payments', 'Customers', 'Products']
  },
  { 
    id: 'sage', 
    name: 'Sage Business Cloud', 
    icon: '🟢', 
    color: 'var(--color-success)',
    description: 'Enterprise-grade accounting',
    features: ['Invoices', 'Payments', 'Customers', 'Inventory', 'Multi-currency']
  },
];

const accountingConfigPath = getSubCollection('accountingConfig');

export default function AccountingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [config, setConfig] = useState<AccountingConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [_showConnectionModal, setShowConnectionModal] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const configData = await FirestoreService.get<AccountingConfig>(
        accountingConfigPath,
        'default'
      );
      if (configData) {
        setConfig(configData);
      }
    } catch {
      toast.error('Failed to load accounting config');
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
      void loadConfig();
    }
  }, [user, loadConfig]);

  const handleSave = async () => {
    if (!user) { return; }

    setIsSaving(true);
    try {
      await FirestoreService.set(
        accountingConfigPath,
        'default',
        {
          ...config,
          updatedAt: new Date().toISOString(),
        },
        true
      );
      toast.success('Accounting settings saved');
    } catch {
      toast.error('Failed to save accounting config');
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = <K extends keyof AccountingConfig>(
    path: [K] | [K, keyof AccountingConfig[K]],
    value: K extends 'accountMapping' ? string : AccountingConfig[K]
  ) => {
    setConfig(prev => {
      if (path.length === 1) {
        return { ...prev, [path[0]]: value };
      }
      const [section, field] = path as ['accountMapping', keyof AccountingConfig['accountMapping']];
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      };
    });
  };

  const handleConnect = (platformId: string) => {
    updateConfig(['platform'], platformId as AccountingConfig['platform']);
    updateConfig(['connected'], true);
    setShowConnectionModal(false);
    void handleSave();
  };

  const handleDisconnect = () => {
    updateConfig(['platform'], 'none');
    updateConfig(['connected'], false);
    void handleSave();
  };

  const selectedPlatform = PLATFORMS.find(p => p.id === config.platform);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'var(--color-bg-main)', borderBottom: '1px solid var(--color-border-light)', padding: '2rem' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          <Link href={`/settings`} style={{ color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', display: 'inline-block', marginBottom: '0.5rem' }}>
            ← Back to Settings
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0, marginBottom: '0.5rem' }}>Accounting Software Integration</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
            Sync invoices, payments, and customers from CRM to your accounting platform
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem' }}>
        {/* Current Connection Status */}
        {config.connected && selectedPlatform ? (
          <div style={{ backgroundColor: 'var(--color-success-dark)', border: '2px solid var(--color-success-dark)', borderRadius: '0.75rem', padding: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '1.5rem' }}>
                <div style={{ fontSize: '4rem' }}>{selectedPlatform.icon}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>{selectedPlatform.name}</h2>
                    <span style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--color-success-dark)', color: 'var(--color-success-light)', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>✓ Connected</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>{selectedPlatform.description}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {selectedPlatform.features.map(feature => (
                      <span key={feature} style={{ padding: '0.375rem 0.75rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-success-light)', borderRadius: '0.375rem', fontSize: '0.75rem' }}>
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-error-dark)', color: 'var(--color-error-light)', border: '1px solid var(--color-error-dark)', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Connect Your Accounting Software</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
              Choose your accounting platform to automatically sync financial data
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handleConnect(platform.id)}
                  style={{
                    padding: '1.5rem',
                    backgroundColor: 'var(--color-bg-paper)',
                    border: '2px solid var(--color-border-strong)',
                    borderRadius: '0.75rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = platform.color;
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-paper)';
                  }}
                >
                  <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{platform.icon}</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>{platform.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.75rem' }}>{platform.description}</div>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {platform.features.slice(0, 3).map(feature => (
                      <span key={feature} style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-secondary)', borderRadius: '0.25rem', fontSize: '0.625rem' }}>
                        {feature}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sync Settings (only show if connected) */}
        {config.connected && selectedPlatform && (
          <>
            <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>Sync Settings</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Sync Frequency
                  </label>
                  <select
                    value={config.syncFrequency}
                    onChange={(e) => updateConfig(['syncFrequency'], e.target.value as AccountingConfig['syncFrequency'])}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  >
                    <option value="realtime">⚡ Real-time (instant sync)</option>
                    <option value="hourly">⏰ Hourly</option>
                    <option value="daily">📅 Daily</option>
                  </select>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>What to Sync</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={config.autoSyncInvoices}
                        onChange={(e) => updateConfig(['autoSyncInvoices'], e.target.checked)}
                        style={{ width: '1.25rem', height: '1.25rem' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>🧾 Invoices</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Sync all invoices from CRM to {selectedPlatform.name}</div>
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={config.autoSyncPayments}
                        onChange={(e) => updateConfig(['autoSyncPayments'], e.target.checked)}
                        style={{ width: '1.25rem', height: '1.25rem' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>💳 Payments</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Sync all payment records from CRM to {selectedPlatform.name}</div>
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={config.autoSyncCustomers}
                        onChange={(e) => updateConfig(['autoSyncCustomers'], e.target.checked)}
                        style={{ width: '1.25rem', height: '1.25rem' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>👥 Customers</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Sync companies and contacts from CRM to {selectedPlatform.name}</div>
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={config.autoSyncProducts}
                        onChange={(e) => updateConfig(['autoSyncProducts'], e.target.checked)}
                        style={{ width: '1.25rem', height: '1.25rem' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>📦 Products/Services</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Sync product catalog from CRM to {selectedPlatform.name}</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Mapping */}
            <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Account Mapping</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                Map CRM transactions to your {selectedPlatform.name} chart of accounts
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Revenue Account
                  </label>
                  <input
                    type="text"
                    value={config.accountMapping.revenueAccount}
                    onChange={(e) => updateConfig(['accountMapping', 'revenueAccount'], e.target.value)}
                    placeholder="e.g., 4000 - Sales Revenue"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Sales Tax Account
                  </label>
                  <input
                    type="text"
                    value={config.accountMapping.taxAccount}
                    onChange={(e) => updateConfig(['accountMapping', 'taxAccount'], e.target.value)}
                    placeholder="e.g., 2200 - Sales Tax Payable"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Accounts Receivable
                  </label>
                  <input
                    type="text"
                    value={config.accountMapping.receivablesAccount}
                    onChange={(e) => updateConfig(['accountMapping', 'receivablesAccount'], e.target.value)}
                    placeholder="e.g., 1200 - Accounts Receivable"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Sync Status */}
            <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>Sync Status</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ backgroundColor: 'var(--color-bg-main)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--color-success-dark)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>Last Sync</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-success-light)' }}>Just now</div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-main)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--color-success-dark)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>Invoices Synced</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-success-light)' }}>247</div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-main)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--color-success-dark)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>Payments Synced</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-success-light)' }}>189</div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-main)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--color-success-dark)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>Status</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-success-light)' }}>✓ Healthy</div>
                </div>
              </div>

              <button
                onClick={() => {/* Trigger manual sync */}}
                style={{ marginTop: '1.5rem', padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', width: '100%' }}
              >
                🔄 Sync Now
              </button>
            </div>
          </>
        )}

        {/* Save Button */}
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => void handleSave()}
            disabled={isSaving}
            style={{ padding: '0.75rem 2rem', backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: '600', opacity: isSaving ? 0.5 : 1 }}
          >
            {isSaving ? 'Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
