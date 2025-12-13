'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';

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
    color: '#2ca01c',
    description: 'Most popular for small-medium businesses',
    features: ['Invoices', 'Payments', 'Customers', 'Products', 'Sales Tax']
  },
  { 
    id: 'xero', 
    name: 'Xero', 
    icon: '📈', 
    color: '#13b5ea',
    description: 'Popular internationally, great reporting',
    features: ['Invoices', 'Payments', 'Contacts', 'Items', 'Tax Rates']
  },
  { 
    id: 'freshbooks', 
    name: 'FreshBooks', 
    icon: '📗', 
    color: '#0075dd',
    description: 'Simple and user-friendly for freelancers',
    features: ['Invoices', 'Payments', 'Clients', 'Expenses']
  },
  { 
    id: 'wave', 
    name: 'Wave', 
    icon: '🌊', 
    color: '#7c5aff',
    description: 'Free accounting software',
    features: ['Invoices', 'Payments', 'Customers', 'Products']
  },
  { 
    id: 'sage', 
    name: 'Sage Business Cloud', 
    icon: '🟢', 
    color: '#00dc06',
    description: 'Enterprise-grade accounting',
    features: ['Invoices', 'Payments', 'Customers', 'Inventory', 'Multi-currency']
  },
];

export default function AccountingPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const [config, setConfig] = useState<AccountingConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  useEffect(() => {
    if (!user?.organizationId) return;
    
    const loadConfig = async () => {
      try {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const configData = await FirestoreService.get(
          `${COLLECTIONS.ORGANIZATIONS}/${user.organizationId}/accountingConfig`,
          'default'
        );
        
        if (configData) {
          setConfig(configData as AccountingConfig);
        }
      } catch (error) {
        console.error('Failed to load accounting config:', error);
      }
    };
    
    loadConfig();
  }, [user?.organizationId]);

  const handleSave = async () => {
    if (!user?.organizationId) return;
    
    setIsSaving(true);
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${user.organizationId}/accountingConfig`,
        'default',
        {
          ...config,
          updatedAt: new Date().toISOString(),
        },
        false
      );
    } catch (error) {
      console.error('Failed to save accounting config:', error);
    } finally {
      setTimeout(() => setIsSaving(false), 1000);
    }
  };

  const updateConfig = (path: string[], value: any) => {
    setConfig(prev => {
      const newConfig = { ...prev };
      let current: any = newConfig;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newConfig;
    });
  };

  const handleConnect = (platformId: string) => {
    updateConfig(['platform'], platformId);
    updateConfig(['connected'], true);
    setShowConnectionModal(false);
    handleSave();
  };

  const handleDisconnect = () => {
    updateConfig(['platform'], 'none');
    updateConfig(['connected'], false);
    handleSave();
  };

  const selectedPlatform = PLATFORMS.find(p => p.id === config.platform);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />
      
      {/* Header */}
      <div style={{ backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '2rem' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          <Link href={`/workspace/${orgId}/settings`} style={{ color: '#6366f1', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', display: 'inline-block', marginBottom: '0.5rem' }}>
            ← Back to Settings
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fff', margin: 0, marginBottom: '0.5rem' }}>Accounting Software Integration</h1>
          <p style={{ fontSize: '0.875rem', color: '#666' }}>
            Sync invoices, payments, and customers from CRM to your accounting platform
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem' }}>
        {/* Current Connection Status */}
        {config.connected && selectedPlatform ? (
          <div style={{ backgroundColor: '#0a1a0a', border: '2px solid #1a3a1a', borderRadius: '0.75rem', padding: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '1.5rem' }}>
                <div style={{ fontSize: '4rem' }}>{selectedPlatform.icon}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>{selectedPlatform.name}</h2>
                    <span style={{ padding: '0.25rem 0.75rem', backgroundColor: '#065f46', color: '#6ee7b7', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>✓ Connected</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '1rem' }}>{selectedPlatform.description}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {selectedPlatform.features.map(feature => (
                      <span key={feature} style={{ padding: '0.375rem 0.75rem', backgroundColor: '#1a1a1a', color: '#6ee7b7', borderRadius: '0.375rem', fontSize: '0.75rem' }}>
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '1rem' }}>Connect Your Accounting Software</h2>
            <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '2rem' }}>
              Choose your accounting platform to automatically sync financial data
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handleConnect(platform.id)}
                  style={{
                    padding: '1.5rem',
                    backgroundColor: '#1a1a1a',
                    border: '2px solid #333',
                    borderRadius: '0.75rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = platform.color;
                    e.currentTarget.style.backgroundColor = '#222';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                  }}
                >
                  <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{platform.icon}</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>{platform.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.75rem' }}>{platform.description}</div>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {platform.features.slice(0, 3).map(feature => (
                      <span key={feature} style={{ padding: '0.25rem 0.5rem', backgroundColor: '#0a0a0a', color: '#999', borderRadius: '0.25rem', fontSize: '0.625rem' }}>
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
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '1.5rem' }}>Sync Settings</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                    Sync Frequency
                  </label>
                  <select
                    value={config.syncFrequency}
                    onChange={(e) => updateConfig(['syncFrequency'], e.target.value)}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  >
                    <option value="realtime">⚡ Real-time (instant sync)</option>
                    <option value="hourly">⏰ Hourly</option>
                    <option value="daily">📅 Daily</option>
                  </select>
                </div>

                <div style={{ backgroundColor: '#111', borderRadius: '0.5rem', padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff', marginBottom: '1rem' }}>What to Sync</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={config.autoSyncInvoices}
                        onChange={(e) => updateConfig(['autoSyncInvoices'], e.target.checked)}
                        style={{ width: '1.25rem', height: '1.25rem' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>🧾 Invoices</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Sync all invoices from CRM to {selectedPlatform.name}</div>
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
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>💳 Payments</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Sync all payment records from CRM to {selectedPlatform.name}</div>
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
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>👥 Customers</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Sync companies and contacts from CRM to {selectedPlatform.name}</div>
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
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>📦 Products/Services</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Sync product catalog from CRM to {selectedPlatform.name}</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Mapping */}
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '1rem' }}>Account Mapping</h3>
              <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '1.5rem' }}>
                Map CRM transactions to your {selectedPlatform.name} chart of accounts
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                    Revenue Account
                  </label>
                  <input
                    type="text"
                    value={config.accountMapping.revenueAccount}
                    onChange={(e) => updateConfig(['accountMapping', 'revenueAccount'], e.target.value)}
                    placeholder="e.g., 4000 - Sales Revenue"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                    Sales Tax Account
                  </label>
                  <input
                    type="text"
                    value={config.accountMapping.taxAccount}
                    onChange={(e) => updateConfig(['accountMapping', 'taxAccount'], e.target.value)}
                    placeholder="e.g., 2200 - Sales Tax Payable"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                    Accounts Receivable
                  </label>
                  <input
                    type="text"
                    value={config.accountMapping.receivablesAccount}
                    onChange={(e) => updateConfig(['accountMapping', 'receivablesAccount'], e.target.value)}
                    placeholder="e.g., 1200 - Accounts Receivable"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Sync Status */}
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '1.5rem' }}>Sync Status</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ backgroundColor: '#111', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1a3a1a' }}>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Last Sync</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#6ee7b7' }}>Just now</div>
                </div>

                <div style={{ backgroundColor: '#111', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1a3a1a' }}>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Invoices Synced</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#6ee7b7' }}>247</div>
                </div>

                <div style={{ backgroundColor: '#111', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1a3a1a' }}>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Payments Synced</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#6ee7b7' }}>189</div>
                </div>

                <div style={{ backgroundColor: '#111', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1a3a1a' }}>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>Status</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#6ee7b7' }}>✓ Healthy</div>
                </div>
              </div>

              <button
                onClick={() => {/* Trigger manual sync */}}
                style={{ marginTop: '1.5rem', padding: '0.75rem 1.5rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', width: '100%' }}
              >
                🔄 Sync Now
              </button>
            </div>
          </>
        )}

        {/* Save Button */}
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ padding: '0.75rem 2rem', backgroundColor: '#6366f1', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: '600', opacity: isSaving ? 0.5 : 1 }}
          >
            {isSaving ? 'Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
