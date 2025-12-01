'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';
import Tooltip from '@/components/Tooltip';
import type { PlatformMetrics, SystemHealth } from '@/types/admin';

export default function AdminDashboard() {
  const { adminUser } = useAdminAuth();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load dashboard data
    // In production, this would fetch from API
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

      setSystemHealth({
        status: 'healthy',
        timestamp: new Date() as any,
        services: {
          database: { status: 'healthy', responseTime: 12, lastChecked: new Date() as any },
          storage: { status: 'healthy', responseTime: 45, lastChecked: new Date() as any },
          ai: { status: 'healthy', responseTime: 234, lastChecked: new Date() as any },
          email: { status: 'healthy', responseTime: 89, lastChecked: new Date() as any },
          sms: { status: 'degraded', responseTime: 456, lastChecked: new Date() as any, message: 'Slightly elevated response times' },
          api: { status: 'healthy', responseTime: 23, lastChecked: new Date() as any },
        },
        performance: {
          averageResponseTime: 89,
          errorRate: 0.12,
          uptime: 99.98,
          activeConnections: 3421,
        },
        alerts: [
          {
            id: '1',
            severity: 'warning',
            service: 'sms',
            message: 'SMS service response time elevated',
            timestamp: new Date() as any,
            resolved: false,
          },
        ],
      });

      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡</div>
          <div>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  const primaryColor = '#6366f1';
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff' }}>
      <div style={{ padding: '2rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Admin Dashboard
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Platform overview and system health
          </p>
        </div>

      {/* System Health Alert */}
      {systemHealth && systemHealth.status !== 'healthy' && (
        <div style={{
          padding: '1rem',
          backgroundColor: systemHealth.status === 'down' ? '#7f1d1d' : '#7c2d12',
          border: '1px solid #991b1b',
          borderRadius: '0.5rem',
          marginBottom: '2rem',
          color: '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: '600' }}>System Status: {systemHealth.status.toUpperCase()}</div>
              <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {systemHealth.alerts.filter(a => !a.resolved).length} active alerts
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <MetricCard
          label="Total Organizations"
          value={metrics?.totalOrganizations.toLocaleString() || '0'}
          change={`${metrics?.activeOrganizations || 0} active`}
          icon="🏢"
          color="#6366f1"
          tooltip="Total number of customer organizations on the platform. Includes active, trial, and suspended organizations."
        />
        <MetricCard
          label="Total Users"
          value={metrics?.totalUsers.toLocaleString() || '0'}
          change={`+${metrics?.newUsersThisPeriod || 0} this period`}
          icon="👥"
          color="#10b981"
          tooltip="Total number of users across all organizations. Shows new users added in the current period."
        />
        <MetricCard
          label="Monthly Recurring Revenue"
          value={`$${metrics?.mrr.toLocaleString() || '0'}`}
          change={`ARR: $${metrics?.arr.toLocaleString() || '0'}`}
          icon="💵"
          color="#ec4899"
          tooltip="Monthly Recurring Revenue (MRR) from all active subscriptions. ARR = Annual Recurring Revenue (MRR × 12)."
        />
        <MetricCard
          label="System Uptime"
          value={`${systemHealth?.performance.uptime.toFixed(2) || '0'}%`}
          change={`${systemHealth?.performance.activeConnections || 0} active connections`}
          icon="⚡"
          color="#f59e0b"
          tooltip="Platform uptime percentage. Shows current number of active user connections to the system."
        />
      </div>

      {/* Quick Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <QuickStat 
          label="Active Orgs" 
          value={metrics?.activeOrganizations || 0}
          tooltip="Organizations with active paid subscriptions (not trial or suspended)"
        />
        <QuickStat 
          label="Trial Orgs" 
          value={metrics?.trialOrganizations || 0}
          tooltip="Organizations currently in their free trial period (7-14 days)"
        />
        <QuickStat 
          label="Suspended" 
          value={metrics?.suspendedOrganizations || 0}
          tooltip="Organizations that have been suspended (usually due to payment issues or policy violations)"
        />
        <QuickStat 
          label="Churn Rate" 
          value={`${metrics?.churnRate || 0}%`}
          tooltip="Percentage of organizations that cancel their subscription per month. Lower is better."
        />
      </div>

      {/* System Health */}
      {systemHealth && (
        <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>System Health</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {Object.entries(systemHealth.services).map(([service, status]) => {
              const serviceTooltips: Record<string, string> = {
                database: 'Firestore database status. Healthy = normal response times, Degraded = slow, Down = unavailable',
                storage: 'Cloud Storage status for file uploads and documents',
                ai: 'AI service (Gemini API) status. Response time includes API call latency',
                email: 'Email service (SendGrid/Resend) status for sending emails',
                sms: 'SMS service (Twilio) status for sending text messages',
                api: 'Platform API status and response times',
              };

              return (
                <Tooltip 
                  key={service} 
                  content={serviceTooltips[service] || `${service} service status`}
                  position="top"
                >
                  <div style={{
                    padding: '1rem',
                    backgroundColor: '#0a0a0a',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.5rem',
                    cursor: 'help'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', textTransform: 'capitalize' }}>{service}</span>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        backgroundColor: status.status === 'healthy' ? '#065f46' : status.status === 'degraded' ? '#78350f' : '#7f1d1d',
                        color: status.status === 'healthy' ? '#10b981' : status.status === 'degraded' ? '#f59e0b' : '#ef4444'
                      }}>
                        {status.status}
                      </span>
                    </div>
                    {status.responseTime && (
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>
                        {status.responseTime}ms
                      </div>
                    )}
                    {status.message && (
                      <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.25rem' }}>
                        {status.message}
                      </div>
                    )}
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Alerts */}
      {systemHealth && systemHealth.alerts.filter(a => !a.resolved).length > 0 && (
        <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Active Alerts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {systemHealth.alerts.filter(a => !a.resolved).map((alert) => (
              <div key={alert.id} style={{
                padding: '1rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'start',
                gap: '1rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>
                  {alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{alert.service.toUpperCase()}</div>
                  <div style={{ fontSize: '0.875rem', color: '#999' }}>{alert.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        <QuickActionCard
          title="Organizations"
          description="Manage all organizations"
          href="/admin/organizations"
          icon="🏢"
          tooltip="View, create, edit, suspend, or delete customer organizations. See organization details, users, and usage."
        />
        <QuickActionCard
          title="Users"
          description="View and manage users"
          href="/admin/users"
          icon="👥"
          tooltip="View all users across all organizations. Manage user accounts, roles, and permissions."
        />
        <QuickActionCard
          title="Billing"
          description="Subscriptions and payments"
          href="/admin/billing"
          icon="💳"
          tooltip="View all subscriptions, payment history, invoices, and handle billing issues or refunds."
        />
        <QuickActionCard
          title="System Health"
          description="Monitor system status"
          href="/admin/system/health"
          icon="🏥"
          tooltip="Detailed system health monitoring: service status, response times, alerts, and performance metrics."
        />
      </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, change, icon, color, tooltip }: {
  label: string;
  value: string;
  change: string;
  icon: string;
  color: string;
  tooltip?: string;
}) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  const card = (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem',
      cursor: tooltip ? 'help' : 'default'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>{label}</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>{value}</p>
        </div>
        <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>{icon}</div>
      </div>
      <div style={{ fontSize: '0.875rem', color: '#666' }}>{change}</div>
    </div>
  );

  if (tooltip) {
    return <Tooltip content={tooltip} position="top">{card}</Tooltip>;
  }

  return card;
}

function QuickStat({ label, value, tooltip }: { 
  label: string; 
  value: string | number;
  tooltip?: string;
}) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  const stat = (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.5rem',
      padding: '1rem',
      textAlign: 'center',
      cursor: tooltip ? 'help' : 'default'
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#666' }}>{label}</div>
    </div>
  );

  if (tooltip) {
    return <Tooltip content={tooltip} position="top">{stat}</Tooltip>;
  }

  return stat;
}

function QuickActionCard({ title, description, href, icon, tooltip }: {
  title: string;
  description: string;
  href: string;
  icon: string;
  tooltip?: string;
}) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  const card = (
    <Link
      href={href}
      style={{
        display: 'block',
        backgroundColor: bgPaper,
        border: `1px solid ${borderColor}`,
        borderRadius: '0.75rem',
        padding: '1.5rem',
        textDecoration: 'none',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#6366f1';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = borderColor;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{icon}</div>
      <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>
        {title}
      </div>
      <div style={{ fontSize: '0.875rem', color: '#666' }}>{description}</div>
    </Link>
  );

  if (tooltip) {
    return <Tooltip content={tooltip} position="top">{card}</Tooltip>;
  }

  return card;
}

