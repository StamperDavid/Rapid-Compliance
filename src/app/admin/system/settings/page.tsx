'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import type { SystemConfig } from '@/types/admin';

export default function SystemSettingsPage() {
  const { adminUser, hasPermission } = useAdminAuth();
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>('');

  useEffect(() => {
    setTimeout(() => {
      setConfigs([
        {
          id: 'config-1',
          key: 'max_organizations',
          value: 10000,
          type: 'number',
          description: 'Maximum number of organizations allowed',
          category: 'general',
          updatedBy: 'admin-1',
          updatedAt: new Date('2024-03-01') as any,
        },
        {
          id: 'config-2',
          key: 'maintenance_mode',
          value: false,
          type: 'boolean',
          description: 'Enable maintenance mode',
          category: 'general',
          updatedBy: 'admin-1',
          updatedAt: new Date('2024-03-15') as any,
        },
        {
          id: 'config-3',
          key: 'ai_rate_limit',
          value: 1000,
          type: 'number',
          description: 'AI API calls per minute per organization',
          category: 'ai',
          updatedBy: 'admin-1',
          updatedAt: new Date('2024-03-10') as any,
        },
        {
          id: 'config-4',
          key: 'stripe_webhook_secret',
          value: 'whsec_...',
          type: 'string',
          description: 'Stripe webhook secret for payment processing',
          category: 'billing',
          updatedBy: 'admin-1',
          updatedAt: new Date('2024-02-20') as any,
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  if (!hasPermission('canManageSystemSettings')) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ padding: '1.5rem', backgroundColor: '#7f1d1d', border: '1px solid #991b1b', borderRadius: '0.5rem', color: '#fff' }}>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Access Denied</div>
          <div style={{ fontSize: '0.875rem' }}>You don't have permission to manage system settings.</div>
        </div>
      </div>
    );
  }

  const handleEdit = (config: SystemConfig) => {
    setEditingKey(config.id);
    setEditValue(config.value);
  };

  const handleSave = (configId: string) => {
    setConfigs(configs.map(c => 
      c.id === configId 
        ? { ...c, value: editValue, updatedAt: new Date() as any, updatedBy: adminUser?.id || '' }
        : c
    ));
    setEditingKey(null);
    setEditValue('');
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const categories = Array.from(new Set(configs.map(c => c.category)));

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          System Settings
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Configure platform-wide settings and parameters
        </p>
      </div>

      {/* Warning */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#78350f',
        border: '1px solid #92400e',
        borderRadius: '0.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'start',
        gap: '1rem'
      }}>
        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
        <div>
          <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Warning</div>
          <div style={{ fontSize: '0.875rem' }}>
            Changing system settings can affect all organizations. Please verify changes before saving.
          </div>
        </div>
      </div>

      {/* Settings by Category */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          Loading settings...
        </div>
      ) : (
        categories.map(category => {
          const categoryConfigs = configs.filter(c => c.category === category);
          return (
            <div key={category} style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', textTransform: 'capitalize' }}>
                {category}
              </h2>
              <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {categoryConfigs.map((config) => (
                    <div
                      key={config.id}
                      style={{
                        padding: '1rem',
                        backgroundColor: '#0a0a0a',
                        border: `1px solid ${borderColor}`,
                        borderRadius: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{config.key}</div>
                        {config.description && (
                          <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                            {config.description}
                          </div>
                        )}
                        {editingKey === config.id ? (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {config.type === 'boolean' ? (
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={editValue}
                                  onChange={(e) => setEditValue(e.target.checked)}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.875rem' }}>Enabled</span>
                              </label>
                            ) : (
                              <input
                                type={config.type === 'number' ? 'number' : 'text'}
                                value={editValue}
                                onChange={(e) => setEditValue(config.type === 'number' ? Number(e.target.value) : e.target.value)}
                                style={{
                                  padding: '0.5rem',
                                  backgroundColor: '#1a1a1a',
                                  border: `1px solid ${borderColor}`,
                                  borderRadius: '0.375rem',
                                  color: '#fff',
                                  fontSize: '0.875rem',
                                  fontFamily: config.type === 'json' ? 'monospace' : 'inherit'
                                }}
                              />
                            )}
                            <button
                              onClick={() => handleSave(config.id)}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: primaryColor,
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancel}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: 'transparent',
                                color: '#999',
                                border: `1px solid ${borderColor}`,
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                cursor: 'pointer'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.875rem', color: '#999' }}>
                            Value: <span style={{ fontFamily: 'monospace', color: '#fff' }}>
                              {typeof config.value === 'boolean' ? (config.value ? 'true' : 'false') : String(config.value)}
                            </span>
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                          Updated: {new Date(config.updatedAt as any).toLocaleString()}
                        </div>
                      </div>
                      {editingKey !== config.id && (
                        <button
                          onClick={() => handleEdit(config)}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: 'transparent',
                            border: `1px solid ${borderColor}`,
                            borderRadius: '0.375rem',
                            color: '#fff',
                            fontSize: '0.875rem',
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}






















