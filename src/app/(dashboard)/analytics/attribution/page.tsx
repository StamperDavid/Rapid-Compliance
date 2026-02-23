'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// Types
// ============================================================================

interface SourceBreakdown {
  source: string;
  revenue: number;
  orders: number;
  deals: number;
  leads: number;
}

interface CampaignBreakdown {
  campaign: string;
  revenue: number;
  leads: number;
  deals: number;
  orders: number;
  conversionRate: number;
}

interface MediumBreakdown {
  medium: string;
  revenue: number;
  leads: number;
  deals: number;
  orders: number;
}

interface FunnelMetrics {
  formSubmissions: number;
  leadsCreated: number;
  dealsCreated: number;
  ordersCompleted: number;
  formToLeadRate: number;
  leadToDealRate: number;
  dealToOrderRate: number;
  overallConversionRate: number;
}

interface AttributionAnalytics {
  totalAttributedRevenue: number;
  totalUnattributedRevenue: number;
  funnel: FunnelMetrics;
  bySource: SourceBreakdown[];
  byCampaign: CampaignBreakdown[];
  byMedium: MediumBreakdown[];
  topPerformingSource: string;
  topPerformingCampaign: string;
}

function isAttributionAnalytics(data: unknown): data is AttributionAnalytics {
  if (typeof data !== 'object' || data === null) { return false; }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.totalAttributedRevenue === 'number' &&
    typeof obj.totalUnattributedRevenue === 'number' &&
    typeof obj.funnel === 'object' &&
    Array.isArray(obj.bySource) &&
    Array.isArray(obj.byCampaign) &&
    Array.isArray(obj.byMedium)
  );
}

// ============================================================================
// Component
// ============================================================================

export default function AttributionDashboardPage() {
  const { theme } = useOrgTheme();
  const authFetch = useAuthFetch();
  const [analytics, setAnalytics] = useState<AttributionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(`/api/analytics/attribution?period=${period}`);
      const data = await response.json() as Record<string, unknown>;
      if (data.success && isAttributionAnalytics(data)) {
        setAnalytics(data);
      }
    } catch (error: unknown) {
      logger.error('Failed to load attribution analytics:', error instanceof Error ? error : new Error(String(error)), { file: 'attribution/page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [period, authFetch]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : 'var(--color-primary)';

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const formatPercent = (num: number) => `${num.toFixed(1)}%`;

  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

  const totalRevenue = (analytics?.totalAttributedRevenue ?? 0) + (analytics?.totalUnattributedRevenue ?? 0);
  const attributionRate = totalRevenue > 0
    ? ((analytics?.totalAttributedRevenue ?? 0) / totalRevenue) * 100
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link href="/analytics" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              &larr; Back to Analytics
            </Link>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                  Revenue Attribution
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                  Track revenue from source to conversion across the full funnel
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
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading attribution data...</div>
          ) : (
            <>
              {/* Overview Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Attributed Revenue</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {formatCurrency(analytics?.totalAttributedRevenue ?? 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: '0.25rem' }}>
                    {formatPercent(attributionRate)} of total
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Unattributed Revenue</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                    {formatCurrency(analytics?.totalUnattributedRevenue ?? 0)}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Top Source</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: primaryColor, textTransform: 'capitalize' }}>
                    {analytics?.topPerformingSource ?? 'none'}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Top Campaign</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: primaryColor, textTransform: 'capitalize' }}>
                    {analytics?.topPerformingCampaign ?? 'none'}
                  </div>
                </div>
              </div>

              {/* Funnel Visualization */}
              <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                  Conversion Funnel
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {[
                    { label: 'Form Submissions', value: analytics?.funnel.formSubmissions ?? 0, rate: null },
                    { label: 'Leads Created', value: analytics?.funnel.leadsCreated ?? 0, rate: analytics?.funnel.formToLeadRate },
                    { label: 'Deals Created', value: analytics?.funnel.dealsCreated ?? 0, rate: analytics?.funnel.leadToDealRate },
                    { label: 'Orders Completed', value: analytics?.funnel.ordersCompleted ?? 0, rate: analytics?.funnel.dealToOrderRate },
                  ].map((step, idx) => (
                    <div key={idx} style={{ textAlign: 'center', position: 'relative' }}>
                      <div style={{
                        backgroundColor: `color-mix(in srgb, ${primaryColor} ${100 - idx * 20}%, transparent)`,
                        borderRadius: '1rem',
                        padding: '1.5rem 1rem',
                        minHeight: `${120 - idx * 10}px`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                          {formatNumber(step.value)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                          {step.label}
                        </div>
                      </div>
                      {step.rate != null && (
                        <div style={{
                          position: 'absolute',
                          top: '-0.75rem',
                          left: '-1rem',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          color: step.rate > 50 ? 'var(--color-success)' : step.rate > 20 ? 'var(--color-warning)' : 'var(--color-error)',
                          backgroundColor: 'var(--color-bg-paper)',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '0.5rem',
                          padding: '0.15rem 0.4rem',
                        }}>
                          {formatPercent(step.rate)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue by Source */}
              {analytics?.bySource && analytics.bySource.length > 0 && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                    Revenue by Source
                  </h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Source</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Revenue</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Leads</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Deals</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Orders</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>% of Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.bySource.map((row, idx) => {
                          const pct = analytics.totalAttributedRevenue > 0 ? (row.revenue / analytics.totalAttributedRevenue) * 100 : 0;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                              <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', textTransform: 'capitalize', fontWeight: '500' }}>{row.source}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{formatCurrency(row.revenue)}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{row.leads}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{row.deals}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{row.orders}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{formatPercent(pct)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Revenue by Campaign */}
              {analytics?.byCampaign && analytics.byCampaign.length > 0 && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                    Revenue by Campaign
                  </h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Campaign</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Revenue</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Leads</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Orders</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Conv. Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.byCampaign.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', fontWeight: '500' }}>{row.campaign}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{formatCurrency(row.revenue)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{row.leads}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{row.orders}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', color: row.conversionRate > 30 ? 'var(--color-success)' : 'var(--color-text-secondary)', fontWeight: '500' }}>
                              {formatPercent(row.conversionRate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Revenue by Medium */}
              {analytics?.byMedium && analytics.byMedium.length > 0 && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                    Revenue by Medium
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {analytics.byMedium.map((row, idx) => {
                      const pct = analytics.totalAttributedRevenue > 0 ? (row.revenue / analytics.totalAttributedRevenue) * 100 : 0;
                      return (
                        <div key={idx}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>{row.medium}</span>
                            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                              {formatCurrency(row.revenue)} ({formatPercent(pct)})
                            </span>
                          </div>
                          <div style={{ height: '8px', backgroundColor: 'var(--color-bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: primaryColor, transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {analytics?.bySource.length === 0 && analytics?.byCampaign.length === 0 && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>No Attribution Data Yet</h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', maxWidth: '400px', margin: '0 auto' }}>
                    Attribution data will appear here as leads, deals, and orders are created with UTM parameters and source tracking.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
