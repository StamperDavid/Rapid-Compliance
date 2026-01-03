'use client';

import { useState, useEffect } from 'react';
import type { Timestamp } from 'firebase/firestore';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import type { PlatformMetrics } from '@/types/admin';

export default function AnalyticsPage() {
  const { adminUser } = useAdminAuth();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  useEffect(() => {
    setTimeout(() => {
      setMetrics({
        period: '2024-03',
        totalOrganizations: 1247,
        activeOrganizations: 1189,
        trialOrganizations: 58,
        suspendedOrganizations: 12,
        totalUsers: 8934,
        activeUsers: 7821,
        newUsersThisPeriod: 342,
        totalApiCalls: 2847392,
        totalAICalls: 156234,
        totalStorageGB: 1247.8,
        totalRecords: 2847392,
        mrr: 124750,
        arr: 1497000,
        totalRevenue: 2847392,
        newRevenue: 34200,
        churnRate: 2.3,
        growthRate: 12.5,
        conversionRate: 8.7,
        updatedAt: new Date() as any,
      });
      setLoading(false);
    }, 500);
  }, [dateRange]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        Loading analytics...
      </div>
    );
  }

  if (!metrics) return null;

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Usage Analytics
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Platform-wide usage and performance metrics
          </p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as any)}
          style={{
            padding: '0.625rem 1rem',
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem'
          }}
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <MetricCard label="Total Organizations" value={metrics.totalOrganizations.toLocaleString()} icon="🏢" />
        <MetricCard label="Active Users" value={metrics.activeUsers.toLocaleString()} icon="👥" />
        <MetricCard label="Monthly Recurring Revenue" value={`$${metrics.mrr.toLocaleString()}`} icon="💵" />
        <MetricCard label="Total API Calls" value={metrics.totalApiCalls.toLocaleString()} icon="📡" />
      </div>

      {/* Usage Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <UsageCard
          title="API Usage"
          data={[
            { label: 'Total Calls', value: metrics.totalApiCalls.toLocaleString() },
            { label: 'AI Calls', value: metrics.totalAICalls.toLocaleString() },
            { label: 'Avg per Org', value: Math.round(metrics.totalApiCalls / metrics.totalOrganizations).toLocaleString() },
          ]}
        />
        <UsageCard
          title="Storage"
          data={[
            { label: 'Total Storage', value: `${metrics.totalStorageGB.toFixed(1)} GB` },
            { label: 'Avg per Org', value: `${(metrics.totalStorageGB / metrics.totalOrganizations).toFixed(2)} GB` },
            { label: 'Total Records', value: metrics.totalRecords.toLocaleString() },
          ]}
        />
      </div>

      {/* Revenue Metrics */}
      <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Revenue Metrics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <RevenueMetric label="MRR" value={`$${metrics.mrr.toLocaleString()}`} />
          <RevenueMetric label="ARR" value={`$${metrics.arr.toLocaleString()}`} />
          <RevenueMetric label="Total Revenue" value={`$${metrics.totalRevenue.toLocaleString()}`} />
          <RevenueMetric label="New Revenue" value={`$${metrics.newRevenue.toLocaleString()}`} />
        </div>
      </div>

      {/* Growth Metrics */}
      <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Growth Metrics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <GrowthMetric label="Growth Rate" value={`${metrics.growthRate}%`} positive />
          <GrowthMetric label="Conversion Rate" value={`${metrics.conversionRate}%`} positive />
          <GrowthMetric label="Churn Rate" value={`${metrics.churnRate}%`} positive={false} />
          <GrowthMetric label="New Users" value={`+${metrics.newUsersThisPeriod}`} positive />
        </div>
      </div>

      {/* Organization Breakdown */}
      <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Organization Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <OrgStat label="Active" value={metrics.activeOrganizations} total={metrics.totalOrganizations} color="#10b981" />
          <OrgStat label="Trial" value={metrics.trialOrganizations} total={metrics.totalOrganizations} color="#f59e0b" />
          <OrgStat label="Suspended" value={metrics.suspendedOrganizations} total={metrics.totalOrganizations} color="#ef4444" />
          <OrgStat label="Total" value={metrics.totalOrganizations} total={metrics.totalOrganizations} color="#6366f1" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>{label}</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>{value}</p>
        </div>
        <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>{icon}</div>
      </div>
    </div>
  );
}

function UsageCard({ title, data }: { title: string; data: Array<{ label: string; value: string }> }) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem'
    }}>
      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {data.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: '#666' }}>{item.label}</span>
            <span style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenueMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{value}</div>
    </div>
  );
}

function GrowthMetric({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: positive ? '#10b981' : '#ef4444'
      }}>
        {value}
      </div>
    </div>
  );
}

function OrgStat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = (value / total) * 100;

  return (
    <div>
      <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
        {value} <span style={{ fontSize: '0.875rem', color: '#666' }}>({percentage.toFixed(1)}%)</span>
      </div>
      <div style={{
        width: '100%',
        height: '4px',
        backgroundColor: '#0a0a0a',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: color,
          transition: 'width 0.3s'
        }} />
      </div>
    </div>
  );
}























