'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';;
import { PageTitle, SectionDescription } from '@/components/ui/typography';

interface RevenueBySource {
  source: string;
  revenue: number;
}

interface RevenueByProduct {
  product: string;
  revenue: number;
}

interface RevenueByRep {
  rep: string;
  revenue: number;
  deals: number;
  avgDeal: number;
}

interface RevenueAnalytics {
  totalRevenue: number;
  growth?: number;
  avgDealSize: number;
  dealsCount: number;
  mrr: number;
  bySource: RevenueBySource[];
  byProduct: RevenueByProduct[];
  byRep: RevenueByRep[];
}

function isRevenueAnalytics(data: unknown): data is RevenueAnalytics {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.totalRevenue === 'number' &&
    typeof obj.avgDealSize === 'number' &&
    typeof obj.dealsCount === 'number' &&
    typeof obj.mrr === 'number' &&
    Array.isArray(obj.bySource) &&
    Array.isArray(obj.byProduct) &&
    Array.isArray(obj.byRep)
  );
}

export default function RevenueAnalyticsPage() {
  const { theme } = useOrgTheme();
  const authFetch = useAuthFetch();
  const [analytics, setAnalytics] = useState<RevenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(`/api/analytics/revenue?PLATFORM_ID=${PLATFORM_ID}&period=${period}`);
      const data = await response.json() as { success?: boolean; analytics?: unknown };
      if (data.success && isRevenueAnalytics(data.analytics)) {
        setAnalytics(data.analytics);
      }
    } catch (error: unknown) {
      logger.error('Failed to load analytics:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [period, authFetch]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : 'var(--color-primary)';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 text-sm font-medium no-underline mb-6"
          style={{ color: primaryColor }}
        >
          ← Back to Analytics
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <PageTitle className="mb-1">Revenue Analytics</PageTitle>
            <SectionDescription>Track revenue by source, product, rep, and time</SectionDescription>
          </div>

          {/* Period Selector */}
          <div className="flex gap-1 bg-card border border-border-light rounded-lg p-1">
            {(['7d', '30d', '90d', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-4 py-2 rounded-md text-sm font-semibold border-none cursor-pointer transition-colors"
                style={{
                  backgroundColor: period === p ? primaryColor : 'transparent',
                  color: period === p ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {p === 'all' ? 'All Time' : p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground">Loading analytics...</div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-card border border-border-light rounded-2xl p-6">
              <div className="text-xs text-muted-foreground mb-2 uppercase">Total Revenue</div>
              <div className="text-4xl font-bold text-foreground">
                {analytics?.totalRevenue ? formatCurrency(analytics.totalRevenue) : '$0'}
              </div>
              {analytics?.growth && (
                <div
                  className="text-xs mt-2"
                  style={{ color: analytics.growth > 0 ? 'var(--color-success)' : 'var(--color-error)' }}
                >
                  {analytics.growth > 0 ? '↑' : '↓'} {formatPercent(Math.abs(analytics.growth))} vs previous period
                </div>
              )}
            </div>

            <div className="bg-card border border-border-light rounded-2xl p-6">
              <div className="text-xs text-muted-foreground mb-2 uppercase">Avg Deal Size</div>
              <div className="text-4xl font-bold text-foreground">
                {analytics?.avgDealSize ? formatCurrency(analytics.avgDealSize) : '$0'}
              </div>
            </div>

            <div className="bg-card border border-border-light rounded-2xl p-6">
              <div className="text-xs text-muted-foreground mb-2 uppercase">Deals Closed</div>
              <div className="text-4xl font-bold text-foreground">
                {analytics?.dealsCount ?? 0}
              </div>
            </div>

            <div className="bg-card border border-border-light rounded-2xl p-6">
              <div className="text-xs text-muted-foreground mb-2 uppercase">MRR</div>
              <div className="text-4xl font-bold text-foreground">
                {analytics?.mrr ? formatCurrency(analytics.mrr) : '$0'}
              </div>
            </div>
          </div>

          {/* Revenue by Source */}
          {analytics?.bySource && analytics.bySource.length > 0 && (
            <div className="bg-card border border-border-light rounded-2xl p-8 mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">
                Revenue by Source
              </h2>
              <div className="flex flex-col gap-4">
                {analytics.bySource.map((source: RevenueBySource, index: number) => {
                  const percentage = analytics.totalRevenue > 0 ? (source.revenue / analytics.totalRevenue) * 100 : 0;
                  return (
                    <div key={index}>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-foreground capitalize">{source.source}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(source.revenue)} ({formatPercent(percentage)})
                        </span>
                      </div>
                      <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%`, backgroundColor: primaryColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Revenue by Product */}
          {analytics?.byProduct && analytics.byProduct.length > 0 && (
            <div className="bg-card border border-border-light rounded-2xl p-8 mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">
                Revenue by Product
              </h2>
              <div className="flex flex-col gap-4">
                {analytics.byProduct.map((product: RevenueByProduct, index: number) => {
                  const percentage = analytics.totalRevenue > 0 ? (product.revenue / analytics.totalRevenue) * 100 : 0;
                  return (
                    <div key={index}>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-foreground">{product.product}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(product.revenue)} ({formatPercent(percentage)})
                        </span>
                      </div>
                      <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300 bg-success"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Revenue by Rep */}
          {analytics?.byRep && analytics.byRep.length > 0 && (
            <div className="bg-card border border-border-light rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-foreground mb-6">
                Revenue by Sales Rep
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th className="p-3 text-left text-xs text-muted-foreground uppercase">Rep</th>
                      <th className="p-3 text-right text-xs text-muted-foreground uppercase">Revenue</th>
                      <th className="p-3 text-right text-xs text-muted-foreground uppercase">Deals</th>
                      <th className="p-3 text-right text-xs text-muted-foreground uppercase">Avg Deal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.byRep.map((rep: RevenueByRep, index: number) => (
                      <tr key={index} className="border-b border-border-light">
                        <td className="p-3 text-sm text-foreground">{rep.rep}</td>
                        <td className="p-3 text-right text-sm font-semibold text-foreground">
                          {formatCurrency(rep.revenue)}
                        </td>
                        <td className="p-3 text-right text-sm text-muted-foreground">{rep.deals}</td>
                        <td className="p-3 text-right text-sm text-muted-foreground">
                          {formatCurrency(rep.avgDeal)}
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
