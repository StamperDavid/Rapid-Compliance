'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { logger } from '@/lib/logger/logger';
import type { StageMetrics, PipelineInsight } from '@/lib/crm/sales-velocity';

/**
 * CRM Analytics — unified Sales Velocity + Pipeline page
 * Previously two separate pages with overlapping metrics (win rate, avg deal size, etc.)
 */

type ActiveTab = 'velocity' | 'pipeline';

// ── Sales Velocity types ────────────────────────────────────────────────────

interface SerializedSalesMetrics {
  velocity: number;
  avgDealSize: number;
  avgSalesCycle: number;
  winRate: number;
  stageMetrics: Record<string, StageMetrics>;
  conversionRates: Record<string, number>;
  forecastedRevenue: number;
  confidenceLevel: number;
  trends: {
    velocity30Days: number;
    velocity90Days: number;
    winRate30Days: number;
    winRate90Days: number;
  };
}

interface SalesAnalyticsApiResponse {
  success: boolean;
  data: {
    metrics: SerializedSalesMetrics;
    insights: PipelineInsight[];
  };
}

// ── Pipeline types ──────────────────────────────────────────────────────────

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
  if (typeof data !== 'object' || data === null) { return false; }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.totalValue === 'number' &&
    typeof obj.dealsCount === 'number' &&
    typeof obj.winRate === 'number' &&
    typeof obj.avgDealSize === 'number' &&
    Array.isArray(obj.byStage)
  );
}

// ── Shared ──────────────────────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);

const formatPercent = (num: number) => `${num.toFixed(1)}%`;

export default function CRMAnalyticsPage() {
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const { theme } = useOrgTheme();
  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  const [tab, setTab] = useState<ActiveTab>('velocity');

  // Sales velocity state
  const [salesMetrics, setSalesMetrics] = useState<SerializedSalesMetrics | null>(null);
  const [insights, setInsights] = useState<PipelineInsight[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Pipeline state
  const [pipelineData, setPipelineData] = useState<PipelineAnalytics | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(true);

  const loadSalesAnalytics = useCallback(async () => {
    try {
      setSalesError(null);
      const response = await authFetch('/api/crm/analytics/velocity');
      if (!response.ok) { throw new Error(`API error: ${response.status}`); }
      const data = await response.json() as SalesAnalyticsApiResponse;
      if (data.success) {
        setSalesMetrics(data.data.metrics);
        setInsights(data.data.insights ?? []);
      } else {
        setSalesError('Failed to load sales analytics');
      }
    } catch (err) {
      setSalesError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setSalesLoading(false);
    }
  }, [authFetch]);

  const loadPipelineAnalytics = useCallback(async () => {
    setPipelineLoading(true);
    try {
      const response = await authFetch('/api/analytics/pipeline');
      const data = await response.json() as { success?: boolean; analytics?: unknown };
      if (data.success && isPipelineAnalytics(data.analytics)) {
        setPipelineData(data.analytics);
      }
    } catch (error: unknown) {
      logger.error('Failed to load pipeline analytics:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setPipelineLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) { return; }
    void loadSalesAnalytics();
    void loadPipelineAnalytics();
  }, [loadSalesAnalytics, loadPipelineAnalytics, authLoading]);

  const isLoading = tab === 'velocity' ? salesLoading : pipelineLoading;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">CRM Analytics</h1>
      <p className="text-[var(--color-text-secondary)] text-sm mb-6">Sales velocity, pipeline health, and conversion metrics</p>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-8">
        {([
          { key: 'velocity' as const, label: 'Sales Velocity' },
          { key: 'pipeline' as const, label: 'Pipeline' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === key
                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/25'
                : 'bg-surface-elevated border border-border-light text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading || authLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : tab === 'velocity' ? (
        /* ── Sales Velocity Tab ──────────────────────────────────────── */
        <>
          {salesError ? (
            <div className="bg-surface-paper rounded-lg p-6 text-center">
              <p className="text-error mb-4">{salesError}</p>
              <button
                onClick={() => { setSalesLoading(true); void loadSalesAnalytics(); }}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
              >
                Retry
              </button>
            </div>
          ) : salesMetrics ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                <div className="bg-surface-paper rounded-lg p-6">
                  <div className="text-sm text-[var(--color-text-secondary)] mb-2">Sales Velocity</div>
                  <div className="text-3xl font-bold text-success">{formatCurrency(salesMetrics.velocity)}/day</div>
                  <div className="text-xs text-[var(--color-text-disabled)] mt-2">
                    30d: {formatCurrency(salesMetrics.trends.velocity30Days)}/day
                  </div>
                </div>
                <div className="bg-surface-paper rounded-lg p-6">
                  <div className="text-sm text-[var(--color-text-secondary)] mb-2">Win Rate</div>
                  <div className="text-3xl font-bold">{salesMetrics.winRate.toFixed(1)}%</div>
                  <div className="text-xs text-[var(--color-text-disabled)] mt-2">
                    30d: {salesMetrics.trends.winRate30Days.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-surface-paper rounded-lg p-6">
                  <div className="text-sm text-[var(--color-text-secondary)] mb-2">Avg Deal Size</div>
                  <div className="text-3xl font-bold">{formatCurrency(salesMetrics.avgDealSize)}</div>
                </div>
                <div className="bg-surface-paper rounded-lg p-6">
                  <div className="text-sm text-[var(--color-text-secondary)] mb-2">Avg Sales Cycle</div>
                  <div className="text-3xl font-bold">{salesMetrics.avgSalesCycle} days</div>
                </div>
              </div>

              {/* Pipeline Insights */}
              {insights.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Pipeline Insights</h2>
                  <div className="space-y-3">
                    {insights.map((insight, idx) => {
                      const bgStyle =
                        insight.type === 'warning' ? { backgroundColor: 'rgba(var(--color-warning-rgb), 0.2)', borderColor: 'var(--color-warning)' } :
                        insight.type === 'success' ? { backgroundColor: 'rgba(var(--color-success-rgb), 0.2)', borderColor: 'var(--color-success)' } :
                        { backgroundColor: 'rgba(var(--color-info-rgb), 0.2)', borderColor: 'var(--color-info)' };
                      const icon = insight.type === 'warning' ? '⚠️' : insight.type === 'success' ? '✅' : '💡';

                      return (
                        <div key={idx} className="border-2 rounded-lg p-4" style={bgStyle}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl">{icon}</span>
                                <span className="font-bold">{insight.message}</span>
                                <span
                                  className="px-2 py-1 rounded text-xs font-medium"
                                  style={
                                    insight.priority === 'high' ? { backgroundColor: 'rgba(var(--color-error-rgb), 0.2)', color: 'var(--color-error)' } :
                                    insight.priority === 'medium' ? { backgroundColor: 'rgba(var(--color-warning-rgb), 0.2)', color: 'var(--color-warning)' } :
                                    { backgroundColor: 'rgba(var(--color-info-rgb), 0.2)', color: 'var(--color-info)' }
                                  }
                                >
                                  {insight.priority.toUpperCase()}
                                </span>
                              </div>
                              {insight.recommendation && (
                                <div className="text-sm opacity-90 ml-7">{insight.recommendation}</div>
                              )}
                              {insight.affectedDeals && (
                                <div className="text-xs opacity-75 ml-7 mt-1">Affects {insight.affectedDeals} deals</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Forecast */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-surface-paper rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Revenue Forecast</h2>
                  <div className="text-4xl font-bold text-success mb-2">
                    {formatCurrency(salesMetrics.forecastedRevenue)}
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    Confidence: {salesMetrics.confidenceLevel}%
                  </div>
                  <div className="mt-4 w-full bg-surface-elevated rounded-full h-3">
                    <div className="bg-success h-3 rounded-full" style={{ width: `${salesMetrics.confidenceLevel}%` }} />
                  </div>
                </div>
                <div className="bg-surface-paper rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Velocity Trend</h2>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--color-text-secondary)]">Last 30 Days</span>
                        <span className="font-medium">{formatCurrency(salesMetrics.trends.velocity30Days)}/day</span>
                      </div>
                      <div className="w-full bg-surface-elevated rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${salesMetrics.trends.velocity90Days > 0 ? (salesMetrics.trends.velocity30Days / salesMetrics.trends.velocity90Days) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--color-text-secondary)]">Last 90 Days</span>
                        <span className="font-medium">{formatCurrency(salesMetrics.trends.velocity90Days)}/day</span>
                      </div>
                      <div className="w-full bg-surface-elevated rounded-full h-2">
                        <div className="bg-success h-2 rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>
                  </div>
                  {salesMetrics.trends.velocity90Days > 0 && salesMetrics.trends.velocity30Days < salesMetrics.trends.velocity90Days * 0.8 && (
                    <div className="mt-4 text-sm" style={{ color: 'var(--color-warning)' }}>
                      ⚠️ Velocity declining - 30-day avg is {((1 - salesMetrics.trends.velocity30Days / salesMetrics.trends.velocity90Days) * 100).toFixed(0)}% below 90-day avg
                    </div>
                  )}
                </div>
              </div>

              {/* Pipeline by Stage (detailed) */}
              <div className="bg-surface-paper rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-6">Pipeline by Stage</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-light">
                        <th className="text-left py-3 px-4">Stage</th>
                        <th className="text-right py-3 px-4">Deals</th>
                        <th className="text-right py-3 px-4">Total Value</th>
                        <th className="text-right py-3 px-4">Avg Deal Size</th>
                        <th className="text-right py-3 px-4">Avg Time in Stage</th>
                        <th className="text-right py-3 px-4">Conversion Rate</th>
                        <th className="text-right py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(salesMetrics.stageMetrics).map(([stage, data]) => {
                        const isBottleneck = data.bottleneckScore > 120;
                        return (
                          <tr key={stage} className={`border-b border-border-light ${isBottleneck ? 'bg-surface-elevated' : ''}`}>
                            <td className="py-4 px-4 font-medium capitalize">{stage.replace('_', ' ')}</td>
                            <td className="py-4 px-4 text-right">{data.totalDeals}</td>
                            <td className="py-4 px-4 text-right">{formatCurrency(data.totalValue)}</td>
                            <td className="py-4 px-4 text-right">{formatCurrency(data.avgDealSize)}</td>
                            <td className="py-4 px-4 text-right">{data.avgTimeInStage} days</td>
                            <td className="py-4 px-4 text-right">{data.conversionRate.toFixed(1)}%</td>
                            <td className="py-4 px-4 text-right">
                              {isBottleneck ? (
                                <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: 'var(--color-warning)', color: 'var(--color-bg-main)' }}>
                                  ⚠️ Bottleneck
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: 'var(--color-success)', color: 'var(--color-bg-main)' }}>
                                  ✅ On Track
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Conversion Rates */}
              <div className="bg-surface-paper rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-6">Stage Conversion Rates</h2>
                <div className="space-y-4">
                  {Object.entries(salesMetrics.conversionRates).map(([transition, rate]) => (
                    <div key={transition}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-[var(--color-text-secondary)] capitalize">{transition.replace('->', ' → ').replace(/_/g, ' ')}</span>
                        <span className="font-medium">{rate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-surface-elevated rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            rate >= 60 ? 'bg-success' : rate >= 40 ? 'bg-[var(--color-warning)]' : 'bg-error'
                          }`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8">No sales data available</div>
          )}
        </>
      ) : (
        /* ── Pipeline Tab ────────────────────────────────────────────── */
        <>
          {/* Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Total Pipeline Value</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                {pipelineData?.totalValue ? formatCurrency(pipelineData.totalValue) : '$0'}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Deals in Pipeline</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                {pipelineData?.dealsCount ?? 0}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Win Rate</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                {pipelineData?.winRate ? formatPercent(pipelineData.winRate) : '0%'}
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Avg Deal Size</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                {pipelineData?.avgDealSize ? formatCurrency(pipelineData.avgDealSize) : '$0'}
              </div>
            </div>
          </div>

          {/* Pipeline by Stage */}
          {pipelineData?.byStage && pipelineData.byStage.length > 0 && (
            <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                Pipeline by Stage
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pipelineData.byStage.map((stage: PipelineStage, index: number) => (
                  <div key={index}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{stage.stage}</span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        {formatCurrency(stage.value)} ({stage.count} deals)
                      </span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: 'var(--color-bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pipelineData.totalValue > 0 ? (stage.value / pipelineData.totalValue) * 100 : 0}%`,
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

          {!pipelineData && !pipelineLoading && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No pipeline data available
            </div>
          )}
        </>
      )}
    </div>
  );
}
