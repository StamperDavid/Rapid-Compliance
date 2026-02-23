'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import SubpageNav from '@/components/ui/SubpageNav';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';;

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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <SubpageNav items={[
              { label: 'Overview', href: '/analytics' },
              { label: 'Revenue', href: '/analytics/revenue' },
              { label: 'Pipeline', href: '/analytics/pipeline' },
              { label: 'Sales Performance', href: '/analytics/sales' },
              { label: 'Sequences', href: '/sequences/analytics' },
            ]} />
            <Link href={`/analytics`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to Analytics
            </Link>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                  Revenue Analytics
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                  Track revenue by source, product, rep, and time
                </p>
              </div>

              {/* Period Selector */}
              <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem', padding: '0.25rem' }}>
                {(['7d', '30d', '90d', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: period === p ? primaryColor : 'transparent',
                      color: period === p ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    {p === 'all' ? 'All Time' : p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading analytics...</div>
          ) : (
            <>
              {/* Overview Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Total Revenue</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {analytics?.totalRevenue ? formatCurrency(analytics.totalRevenue) : '$0'}
                  </div>
                  {analytics?.growth && (
                    <div style={{ fontSize: '0.75rem', color: analytics.growth > 0 ? 'var(--color-success)' : 'var(--color-error)', marginTop: '0.5rem' }}>
                      {analytics.growth > 0 ? '↑' : '↓'} {formatPercent(Math.abs(analytics.growth))} vs previous period
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Avg Deal Size</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {analytics?.avgDealSize ? formatCurrency(analytics.avgDealSize) : '$0'}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Deals Closed</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {analytics?.dealsCount ?? 0}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>MRR</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {analytics?.mrr ? formatCurrency(analytics.mrr) : '$0'}
                  </div>
                </div>
              </div>

              {/* Revenue by Source */}
              {analytics?.bySource && analytics.bySource.length > 0 && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                    Revenue by Source
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {analytics.bySource.map((source: RevenueBySource, index: number) => {
                      const percentage = analytics.totalRevenue > 0 ? (source.revenue / analytics.totalRevenue) * 100 : 0;
                      return (
                        <div key={index}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>{source.source}</span>
                            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                              {formatCurrency(source.revenue)} ({formatPercent(percentage)})
                            </span>
                          </div>
                          <div style={{ height: '8px', backgroundColor: 'var(--color-bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${percentage}%`,
                              height: '100%',
                              backgroundColor: primaryColor,
                              transition: 'width 0.3s',
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Revenue by Product */}
              {analytics?.byProduct && analytics.byProduct.length > 0 && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                    Revenue by Product
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {analytics.byProduct.map((product: RevenueByProduct, index: number) => {
                      const percentage = analytics.totalRevenue > 0 ? (product.revenue / analytics.totalRevenue) * 100 : 0;
                      return (
                        <div key={index}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{product.product}</span>
                            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                              {formatCurrency(product.revenue)} ({formatPercent(percentage)})
                            </span>
                          </div>
                          <div style={{ height: '8px', backgroundColor: 'var(--color-bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${percentage}%`,
                              height: '100%',
                              backgroundColor: 'var(--color-success)',
                              transition: 'width 0.3s',
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Revenue by Rep */}
              {analytics?.byRep && analytics.byRep.length > 0 && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                    Revenue by Sales Rep
                  </h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Rep</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Revenue</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Deals</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Avg Deal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.byRep.map((rep: RevenueByRep, index: number) => (
                          <tr key={index} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{rep.rep}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>
                              {formatCurrency(rep.revenue)}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{rep.deals}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
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
      </div>
    </div>
  );
}





















