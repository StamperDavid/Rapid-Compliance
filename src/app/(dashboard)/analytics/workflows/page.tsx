'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { PageTitle, SectionDescription } from '@/components/ui/typography';

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
  const authFetch = useAuthFetch();
  const [analytics, setAnalytics] = useState<WorkflowAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(`/api/analytics/workflows?orgId=${PLATFORM_ID}`);
      const data = await response.json() as WorkflowAnalyticsApiResponse;
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error: unknown) {
      logger.error('Failed to load analytics:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : 'var(--color-primary)';
  const formatPercent = (num: number) => `${num.toFixed(1)}%`;

  return (
    <div className="p-8 space-y-6">
      <div className="mb-8">
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 text-sm font-medium no-underline mb-6"
          style={{ color: primaryColor }}
        >
          ← Back to Analytics
        </Link>
        <PageTitle className="mb-1">Workflow Analytics</PageTitle>
        <SectionDescription>Monitor automation execution, success rates, and errors</SectionDescription>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground">Loading analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-card border border-border-light rounded-2xl p-6">
              <div className="text-xs text-muted-foreground mb-2 uppercase">Total Executions</div>
              <div className="text-4xl font-bold text-foreground">
                {analytics?.totalExecutions ?? 0}
              </div>
            </div>

            <div className="bg-card border border-border-light rounded-2xl p-6">
              <div className="text-xs text-muted-foreground mb-2 uppercase">Success Rate</div>
              <div className="text-4xl font-bold text-foreground">
                {analytics?.successRate ? formatPercent(analytics.successRate) : '0%'}
              </div>
            </div>

            <div className="bg-card border border-border-light rounded-2xl p-6">
              <div className="text-xs text-muted-foreground mb-2 uppercase">Avg Duration</div>
              <div className="text-4xl font-bold text-foreground">
                {analytics?.avgDuration ? `${analytics.avgDuration.toFixed(1)}s` : '0s'}
              </div>
            </div>

            <div className="bg-card border border-border-light rounded-2xl p-6">
              <div className="text-xs text-muted-foreground mb-2 uppercase">Active Workflows</div>
              <div className="text-4xl font-bold text-foreground">
                {analytics?.activeWorkflows ?? 0}
              </div>
            </div>
          </div>

          {analytics?.topWorkflows && analytics.topWorkflows.length > 0 && (
            <div className="bg-card border border-border-light rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-foreground mb-6">
                Top Workflows
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th className="p-3 text-left text-xs text-muted-foreground uppercase">Workflow</th>
                      <th className="p-3 text-right text-xs text-muted-foreground uppercase">Executions</th>
                      <th className="p-3 text-right text-xs text-muted-foreground uppercase">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topWorkflows.map((workflow: WorkflowAnalyticsData, index: number) => (
                      <tr key={index} className="border-b border-border-light">
                        <td className="p-3 text-sm text-foreground">{workflow.name}</td>
                        <td className="p-3 text-right text-sm text-muted-foreground">{workflow.executions}</td>
                        <td className="p-3 text-right text-sm font-semibold text-foreground">
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
  );
}
