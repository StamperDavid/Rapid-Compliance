'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { logger } from '@/lib/logger/logger';;

interface PipelineStage {
  stage: string;
  value: number;
  count: number;
}

interface PipelineAnalytics {
  totalValue: number;
  dealsCount: number;
  winRate: number;
  avgDealSize: number;
  byStage: PipelineStage[];
}

function isPipelineAnalytics(data: unknown): data is PipelineAnalytics {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.totalValue === 'number' &&
    typeof obj.dealsCount === 'number' &&
    typeof obj.winRate === 'number' &&
    typeof obj.avgDealSize === 'number' &&
    Array.isArray(obj.byStage)
  );
}

export default function PipelineAnalyticsPage() {
  const { theme } = useOrgTheme();
  const [analytics, setAnalytics] = useState<PipelineAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analytics/pipeline');
      const data = await response.json() as { success?: boolean; analytics?: unknown };
      if (data.success && isPipelineAnalytics(data.analytics)) {
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <Link href={`/analytics`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to Analytics
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
              Pipeline Analytics
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Track pipeline stages, velocity, and conversion rates
            </p>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading analytics...</div>
          ) : (
            <>
              {/* Overview Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Total Pipeline Value</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {analytics?.totalValue ? formatCurrency(analytics.totalValue) : '$0'}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Deals in Pipeline</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {analytics?.dealsCount ?? 0}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Win Rate</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {analytics?.winRate ? formatPercent(analytics.winRate) : '0%'}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Avg Deal Size</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {analytics?.avgDealSize ? formatCurrency(analytics.avgDealSize) : '$0'}
                  </div>
                </div>
              </div>

              {/* Pipeline by Stage */}
              {analytics?.byStage && analytics.byStage.length > 0 && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                    Pipeline by Stage
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {analytics.byStage.map((stage: PipelineStage, index: number) => (
                      <div key={index}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{stage.stage}</span>
                          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                            {formatCurrency(stage.value)} ({stage.count} deals)
                          </span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: 'var(--color-bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${analytics.totalValue > 0 ? (stage.value / analytics.totalValue) * 100 : 0}%`,
                            height: '100%',
                            backgroundColor: primaryColor,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                      </div>
                    ))}
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





















