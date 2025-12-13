'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import type { FeatureFlag } from '@/types/admin';

export default function FeatureFlagsPage() {
  const { adminUser, hasPermission } = useAdminAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setFlags([
        {
          id: 'flag-1',
          name: 'New Dashboard UI',
          description: 'Rollout new dashboard design',
          enabled: true,
          rolloutPercentage: 50,
          createdBy: 'admin-1',
          createdAt: new Date('2024-03-01') as any,
          updatedAt: new Date('2024-03-15') as any,
        },
        {
          id: 'flag-2',
          name: 'AI Agent v2',
          description: 'New AI agent architecture',
          enabled: false,
          rolloutPercentage: 0,
          createdBy: 'admin-1',
          createdAt: new Date('2024-03-10') as any,
          updatedAt: new Date('2024-03-10') as any,
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const toggleFlag = (flagId: string) => {
    setFlags(flags.map(flag =>
      flag.id === flagId ? { ...flag, enabled: !flag.enabled } : flag
    ));
  };

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Feature Controls
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Manage feature rollouts and A/B testing
          </p>
        </div>
        {hasPermission('canManageFeatureFlags') && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: primaryColor,
              color: '#fff',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            + Create Flag
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Total Flags" value={flags.length} />
        <StatCard label="Enabled" value={flags.filter(f => f.enabled).length} />
        <StatCard label="Rolling Out" value={flags.filter(f => f.enabled && f.rolloutPercentage < 100).length} />
        <StatCard label="Fully Rolled Out" value={flags.filter(f => f.enabled && f.rolloutPercentage === 100).length} />
      </div>

      {/* Flags List */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          Loading feature controls...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {flags.map((flag) => (
            <FlagCard key={flag.id} flag={flag} onToggle={toggleFlag} canManage={hasPermission('canManageFeatureFlags')} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.5rem',
      padding: '1rem',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#666' }}>{label}</div>
    </div>
  );
}

function FlagCard({ flag, onToggle, canManage }: { flag: FeatureFlag; onToggle: (id: string) => void; canManage: boolean }) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{flag.name}</h3>
            <span style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              fontWeight: '600',
              backgroundColor: flag.enabled ? '#065f46' : '#4b5563',
              color: flag.enabled ? '#10b981' : '#9ca3af',
              textTransform: 'uppercase'
            }}>
              {flag.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.75rem' }}>{flag.description}</p>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#666' }}>
            <span>Rollout: {flag.rolloutPercentage}%</span>
            <span>Updated: {new Date(flag.updatedAt as any).toLocaleDateString()}</span>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => onToggle(flag.id)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: flag.enabled ? '#7f1d1d' : '#065f46',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {flag.enabled ? 'Disable' : 'Enable'}
          </button>
        )}
      </div>
      {flag.enabled && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${borderColor}` }}>
          <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Rollout Progress</div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#0a0a0a',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${flag.rolloutPercentage}%`,
              height: '100%',
              backgroundColor: primaryColor,
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
      )}
    </div>
  );
}















