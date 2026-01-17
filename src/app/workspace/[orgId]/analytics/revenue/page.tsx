'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { logger } from '@/lib/logger/logger';;

export default function RevenueAnalyticsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  
  const { theme } = useOrgTheme();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/revenue?orgId=${orgId}&period=${period}`);
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
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link href={`/workspace/${orgId}/analytics`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to Analytics
            </Link>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Revenue Analytics
                </h1>
                <p style={{ color: '#999', fontSize: '0.875rem' }}>
                  Track revenue by source, product, rep, and time
                </p>
              </div>

              {/* Period Selector */}
              <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem', padding: '0.25rem' }}>
                {(['7d', '30d', '90d', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: period === p ? primaryColor : 'transparent',
                      color: period === p ? '#fff' : '#999',
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
            <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>Loading analytics...</div>
          ) : (
            <>
              {/* Overview Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Total Revenue</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.totalRevenue ? formatCurrency(analytics.totalRevenue) : '$0'}
                  </div>
                  {analytics?.growth && (
                    <div style={{ fontSize: '0.75rem', color: analytics.growth > 0 ? '#10b981' : '#ef4444', marginTop: '0.5rem' }}>
                      {analytics.growth > 0 ? '↑' : '↓'} {formatPercent(Math.abs(analytics.growth))} vs previous period
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Avg Deal Size</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.avgDealSize ? formatCurrency(analytics.avgDealSize) : '$0'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Deals Closed</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.dealsCount ?? 0}
                  </div>
                </div>

                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>MRR</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {analytics?.mrr ? formatCurrency(analytics.mrr) : '$0'}
                  </div>
                </div>
              </div>

              {/* Revenue by Source */}
              {analytics?.bySource && analytics.bySource.length > 0 && (
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '1.5rem' }}>
                    Revenue by Source
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {analytics.bySource.map((source: any, index: number) => {
                      const percentage = analytics.totalRevenue > 0 ? (source.revenue / analytics.totalRevenue) * 100 : 0;
                      return (
                        <div key={index}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', color: '#fff', textTransform: 'capitalize' }}>{source.source}</span>
                            <span style={{ fontSize: '0.875rem', color: '#999' }}>
                              {formatCurrency(source.revenue)} ({formatPercent(percentage)})
                            </span>
                          </div>
                          <div style={{ height: '8px', backgroundColor: '#0a0a0a', borderRadius: '4px', overflow: 'hidden' }}>
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
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '1.5rem' }}>
                    Revenue by Product
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {analytics.byProduct.map((product: any, index: number) => {
                      const percentage = analytics.totalRevenue > 0 ? (product.revenue / analytics.totalRevenue) * 100 : 0;
                      return (
                        <div key={index}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', color: '#fff' }}>{product.product}</span>
                            <span style={{ fontSize: '0.875rem', color: '#999' }}>
                              {formatCurrency(product.revenue)} ({formatPercent(percentage)})
                            </span>
                          </div>
                          <div style={{ height: '8px', backgroundColor: '#0a0a0a', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${percentage}%`,
                              height: '100%',
                              backgroundColor: '#10b981',
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
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '1.5rem' }}>
                    Revenue by Sales Rep
                  </h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #333' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Rep</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Revenue</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Deals</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Avg Deal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.byRep.map((rep: any, index: number) => (
                          <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#fff' }}>{rep.rep}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#fff', fontWeight: '600' }}>
                              {formatCurrency(rep.revenue)}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#999' }}>{rep.deals}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: '#999' }}>
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





















