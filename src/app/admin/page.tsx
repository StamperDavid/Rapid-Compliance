'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase/config';
import { useAdminAuth } from '@/hooks/useAdminAuth';

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                Admin Dashboard
              </h1>
              <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                {adminUser
                  ? `Signed in as ${adminUser.email} (${adminUser.role})`
                  : 'RapidCompliance.US Platform Administration'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => void fetchStats()}
                disabled={loading}
                style={{
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
                Refresh
              </button>
            </div>
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

        {/* Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <StatCard
            label="Total Users"
            value={loading ? '...' : (stats?.totalUsers ?? 0).toLocaleString()}
            icon="U"
            color="#6366f1"
          />
          <StatCard
            label="Total Orgs"
            value={loading ? '...' : (stats?.totalOrgs ?? 0).toLocaleString()}
            icon="O"
            color="#8b5cf6"
          />
          <StatCard
            label="Active Agents"
            value={loading ? '...' : (stats?.activeAgents ?? 0).toLocaleString()}
            icon="A"
            color="#10b981"
          />
          <StatCard
            label="Trial Orgs"
            value={loading ? '...' : (stats?.trialOrgs ?? 0).toLocaleString()}
            icon="T"
            color="#f59e0b"
          />
          <StatCard
            label="Pending Tickets"
            value={loading ? '...' : (stats?.pendingTickets ?? 0).toLocaleString()}
            icon="P"
            color="#ec4899"
          />
        </div>

        {/* Info + Navigation */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '1.5rem',
          }}
          className="lg:grid-cols-2"
        >
          {/* Admin Info */}
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '1rem',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>
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

          {/* Quick Navigation */}
          <div
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '1rem',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>
              Admin Actions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <NavLink href="/admin" label="Dashboard" description="Platform overview and stats" active />
              <NavLink href="/dashboard" label="Workspace" description="Return to main workspace" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
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
          <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>{label}</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>{value}</p>
        </div>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '0.5rem',
            backgroundColor: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.875rem', color: '#999' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>{value}</span>
    </div>
  );
}

function NavLink({
  href,
  label,
  description,
  active,
}: {
  href: string;
  label: string;
  description: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '0.75rem 1rem',
        backgroundColor: active ? 'rgba(99, 102, 241, 0.1)' : '#0a0a0a',
        border: `1px solid ${active ? 'rgba(99, 102, 241, 0.3)' : '#222'}`,
        borderRadius: '0.5rem',
        textDecoration: 'none',
      }}
    >
      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>{label}</div>
      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>{description}</div>
    </Link>
  );
}
