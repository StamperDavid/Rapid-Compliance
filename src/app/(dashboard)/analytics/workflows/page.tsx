'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { logger } from '@/lib/logger/logger';

interface WorkflowAnalyticsData {
  name: string;
  executions: number;
  successRate: number;
}

interface WorkflowAnalytics {
  totalExecutions: number;
  successRate: number;
  avgDuration: number;
  activeWorkflows: number;
  topWorkflows: WorkflowAnalyticsData[];
}

interface WorkflowAnalyticsApiResponse {
  success: boolean;
  analytics: WorkflowAnalytics;
}

export default function WorkflowAnalyticsPage() {
  const { theme } = useOrgTheme();
  const [analytics, setAnalytics] = useState<WorkflowAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/workflows?orgId=${DEFAULT_ORG_ID}`);
      const data = await response.json() as WorkflowAnalyticsApiResponse;
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error: unknown) {
      logger.error('Failed to load analytics:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : '#6366f1';
  const formatPercent = (num: number) => `${num.toFixed(1)}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <Link href={`/analytics`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to Analytics
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
              Workflow Analytics
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Monitor automation execution, success rates, and errors
            </p>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading analytics...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Total Executions</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {analytics?.totalExecutions ?? 0}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Success Rate</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {analytics?.successRate ? formatPercent(analytics.successRate) : '0%'}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Avg Duration</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {analytics?.avgDuration ? `${analytics.avgDuration.toFixed(1)}s` : '0s'}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Active Workflows</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {analytics?.activeWorkflows ?? 0}
                  </div>
                </div>
              </div>

              {analytics?.topWorkflows && analytics.topWorkflows.length > 0 && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                    Top Workflows
                  </h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #333' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Workflow</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Executions</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Success Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.topWorkflows.map((workflow: WorkflowAnalyticsData, index: number) => (
                          <tr key={index} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{workflow.name}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{workflow.executions}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>
                              {formatPercent(workflow.successRate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}





