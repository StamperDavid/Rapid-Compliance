'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase/config';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  Users,
  Bot,
  TrendingUp,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface PlatformStats {
  totalOrgs: number;
  activeAgents: number;
  pendingTickets: number;
  trialOrgs: number;
  totalUsers: number;
  monthlyRevenue?: number;
  fetchedAt: string;
  scope: 'global' | 'organization';
}

interface StatsUser {
  email: string;
  uid: string;
  role: string;
  isGlobalAdmin: boolean;
  orgId: string;
}

interface StatsApiResponse {
  stats: PlatformStats;
  user: StatsUser;
}

// -------------------------------------------------------------------
// Quick-action links for the dashboard
// -------------------------------------------------------------------

const QUICK_ACTIONS = [
  { label: 'View Leads', href: '/leads', color: '#6366f1' },
  { label: 'Deal Pipeline', href: '/deals', color: '#8b5cf6' },
  { label: 'AI Agents', href: '/admin/ai-agents', color: '#06b6d4' },
  { label: 'Workflows', href: '/workflows', color: '#10b981' },
  { label: 'Analytics', href: '/analytics/revenue', color: '#f59e0b' },
  { label: 'Compliance', href: '/admin/compliance-reports', color: '#ef4444' },
];

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export default function AdminDashboardPage() {
  const { adminUser, isSuperAdmin } = useAdminAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsUser, setStatsUser] = useState<StatsUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        setError('Unable to obtain auth token');
        return;
      }

      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        setError(`Failed to load stats (${res.status}): ${text}`);
        return;
      }

      const data = (await res.json()) as StatsApiResponse;
      setStats(data.stats);
      setStatsUser(data.user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Error fetching stats: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                Command Center
              </h1>
              <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                {adminUser
                  ? `${adminUser.email} (${adminUser.role})`
                  : 'RapidCompliance.US Platform Administration'}
              </p>
            </div>
            <button
              onClick={() => void fetchStats()}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.25rem',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              <RefreshCw className="w-4 h-4" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              padding: '1rem',
              marginBottom: '1.5rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.75rem',
              color: '#f87171',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {/* KPI Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2rem',
          }}
        >
          <KpiCard
            label="Total Users"
            value={loading ? '...' : (stats?.totalUsers ?? 0).toLocaleString()}
            icon={Users}
            color="#6366f1"
            trend="+12%"
          />
          <KpiCard
            label="AI Agents"
            value="51"
            icon={Bot}
            color="#06b6d4"
            subtitle="47 swarm + 4 standalone"
          />
          <KpiCard
            label="Active Agents"
            value={loading ? '...' : (stats?.activeAgents ?? 0).toLocaleString()}
            icon={Activity}
            color="#10b981"
            trend="operational"
          />
          <KpiCard
            label="Pending Tickets"
            value={loading ? '...' : (stats?.pendingTickets ?? 0).toLocaleString()}
            icon={AlertTriangle}
            color={stats && stats.pendingTickets > 5 ? '#ef4444' : '#f59e0b'}
          />
          <KpiCard
            label="Revenue"
            value={loading ? '...' : stats?.monthlyRevenue ? `$${stats.monthlyRevenue.toLocaleString()}` : '$--'}
            icon={TrendingUp}
            color="#10b981"
            subtitle="this month"
          />
        </div>

        {/* Quick Actions + Session Info Grid */}
        <div
          style={{
            display: 'grid',
            gap: '1.25rem',
          }}
          className="lg:grid-cols-2"
        >
          {/* Quick Actions */}
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '1rem',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
              Quick Actions
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #222',
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    color: '#fff',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = action.color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#222';
                  }}
                >
                  {action.label}
                  <ArrowUpRight className="w-3.5 h-3.5" style={{ color: '#555' }} />
                </Link>
              ))}
            </div>
          </div>

          {/* Session Info */}
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '1rem',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
              Session Info
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <InfoRow label="Email" value={statsUser?.email ?? adminUser?.email ?? '-'} />
              <InfoRow label="Role" value={statsUser?.role ?? adminUser?.role ?? '-'} />
              <InfoRow
                label="Global Admin"
                value={statsUser?.isGlobalAdmin ? 'Yes' : isSuperAdmin() ? 'Yes' : 'No'}
              />
              <InfoRow label="Stats Scope" value={stats?.scope ?? '-'} />
              <InfoRow
                label="Last Fetched"
                value={stats?.fetchedAt ? new Date(stats.fetchedAt).toLocaleString() : '-'}
              />
            </div>
          </div>
        </div>

        {/* Platform Overview */}
        <div
          style={{
            marginTop: '1.25rem',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '1rem',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
            Platform Overview
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            <OverviewItem label="Physical Routes" value="130+" />
            <OverviewItem label="API Endpoints" value="215+" />
            <OverviewItem label="Swarm Agents" value="47" />
            <OverviewItem label="Standalone Agents" value="4" />
            <OverviewItem label="Firestore Collections" value="60+" />
            <OverviewItem label="RBAC Roles" value="4" />
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// -------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  subtitle,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  trend?: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '1rem',
        padding: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <p style={{ fontSize: '0.8125rem', color: '#999', marginBottom: '0.5rem' }}>{label}</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>{value}</p>
          {(trend ?? subtitle) && (
            <p style={{ fontSize: '0.75rem', color: trend === 'operational' ? '#10b981' : '#666', marginTop: '0.375rem' }}>
              {trend ?? subtitle}
            </p>
          )}
        </div>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '0.5rem',
            backgroundColor: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.8125rem', color: '#999' }}>{label}</span>
      <span style={{ fontSize: '0.8125rem', color: '#fff', fontWeight: '500' }}>{value}</span>
    </div>
  );
}

function OverviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#0a0a0a',
        borderRadius: '0.5rem',
        border: '1px solid #222',
      }}
    >
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}
