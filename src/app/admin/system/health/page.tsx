'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import type { SystemHealth } from '@/types/admin';

export default function SystemHealthPage() {
  const { adminUser } = useAdminAuth();
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const loadHealth = () => {
      // In production, this would fetch from API
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
    };

    loadHealth();
    if (autoRefresh) {
      const interval = setInterval(loadHealth, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        Loading system health...
      </div>
    );
  }

  if (!systemHealth) return null;

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            System Health
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Monitor system status and performance
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.875rem', color: '#999' }}>Auto-refresh (30s)</span>
        </label>
      </div>

      {/* Overall Status */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: systemHealth.status === 'healthy' ? '#065f46' : systemHealth.status === 'degraded' ? '#78350f' : '#7f1d1d',
        border: `1px solid ${systemHealth.status === 'healthy' ? '#10b981' : systemHealth.status === 'degraded' ? '#f59e0b' : '#ef4444'}`,
        borderRadius: '0.75rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <span style={{ fontSize: '3rem' }}>
          {systemHealth.status === 'healthy' ? '✅' : systemHealth.status === 'degraded' ? '⚠️' : '🔴'}
        </span>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            System Status: {systemHealth.status.toUpperCase()}
          </div>
          <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
            Last updated: {new Date(systemHealth.timestamp as any).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <MetricCard
          label="Average Response Time"
          value={`${systemHealth.performance.averageResponseTime}ms`}
          status="good"
        />
        <MetricCard
          label="Error Rate"
          value={`${systemHealth.performance.errorRate}%`}
          status={systemHealth.performance.errorRate < 1 ? 'good' : 'warning'}
        />
        <MetricCard
          label="Uptime"
          value={`${systemHealth.performance.uptime}%`}
          status="good"
        />
        <MetricCard
          label="Active Connections"
          value={systemHealth.performance.activeConnections.toLocaleString()}
          status="good"
        />
      </div>

      {/* Services Status */}
      <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Service Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {Object.entries(systemHealth.services).map(([service, status]) => (
            <ServiceCard key={service} service={service} status={status} />
          ))}
        </div>
      </div>

      {/* Active Alerts */}
      {systemHealth.alerts.filter(a => !a.resolved).length > 0 && (
        <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.25rem' }}>
                    <div style={{ fontWeight: '600' }}>{alert.service.toUpperCase()}</div>
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>
                      {new Date(alert.timestamp as any).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#999' }}>{alert.message}</div>
                </div>
                <button
                  style={{
                    padding: '0.375rem 0.75rem',
                    backgroundColor: 'transparent',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.375rem',
                    color: '#fff',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, status }: { label: string; value: string; status: 'good' | 'warning' | 'critical' }) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem'
    }}>
      <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>{value}</div>
      <div style={{
        width: '100%',
        height: '4px',
        backgroundColor: '#0a0a0a',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: status === 'good' ? '100%' : status === 'warning' ? '70%' : '30%',
          height: '100%',
          backgroundColor: status === 'good' ? '#10b981' : status === 'warning' ? '#f59e0b' : '#ef4444',
          transition: 'width 0.3s'
        }} />
      </div>
    </div>
  );
}

function ServiceCard({ service, status }: { service: string; status: any }) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: '#0a0a0a',
      border: `1px solid ${borderColor}`,
      borderRadius: '0.5rem'
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
          Response: {status.responseTime}ms
        </div>
      )}
      {status.message && (
        <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.25rem' }}>
          {status.message}
        </div>
      )}
      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
        Last checked: {new Date(status.lastChecked as any).toLocaleTimeString()}
      </div>
    </div>
  );
}















