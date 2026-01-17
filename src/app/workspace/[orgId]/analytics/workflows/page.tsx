'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { logger } from '@/lib/logger/logger';

export default function WorkflowAnalyticsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  
  const { theme } = useOrgTheme();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/workflows?orgId=${orgId}`);
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error: unknown) {
      logger.error('Failed to load analytics:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : '#6366f1';
  const formatPercent = (num: number) => `${num.toFixed(1)}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000' }}>
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <Link href={`/workspace/${orgId}/analytics`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to Analytics
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
              Workflow Analytics
            </h1>
            <p style={{ color: '#999', fontSize: '0.875rem' }}>
              Monitor automation execution, success rates, and errors
            </p>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>Loading analytics...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Total Executions</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.totalExecutions ?? 0}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Success Rate</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.successRate ? formatPercent(analytics.successRate) : '0%'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Avg Duration</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.avgDuration ? `${analytics.avgDuration.toFixed(1)}s` : '0s'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Active Workflows</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.activeWorkflows ?? 0}
                  </div>
                </div>
              </div>

              {analytics?.topWorkflows && analytics.topWorkflows.length > 0 && (
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '1.5rem' }}>
                    Top Workflows
                  </h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #333' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Workflow</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Executions</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Success Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.topWorkflows.map((workflow: any, index: number) => (
                          <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#fff' }}>{workflow.name}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#999' }}>{workflow.executions}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#fff', fontWeight: '600' }}>
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





