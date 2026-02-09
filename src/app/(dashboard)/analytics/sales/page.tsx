'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useEffect, useState, useCallback } from 'react';
import type { SalesVelocityMetrics, PipelineInsight } from '@/lib/crm/sales-velocity';

interface SalesAnalyticsApiResponse {
  success: boolean;
  data: {
    metrics: SalesVelocityMetrics;
    insights: PipelineInsight[];
  };
}

export default function SalesAnalyticsPage() {
  const _orgId = DEFAULT_ORG_ID as string;
  const [metrics, setMetrics] = useState<SalesVelocityMetrics | null>(null);
  const [insights, setInsights] = useState<PipelineInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`/api/crm/analytics/velocity?workspaceId=default`);
      const data = await response.json() as SalesAnalyticsApiResponse;
      if (data.success) {
        setMetrics(data.data.metrics);
        setInsights(data.data.insights ?? []);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!metrics) {
    return <div className="p-8">No data available</div>;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  };

  const stagesArray = Array.from(metrics.stageMetrics.entries());

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Sales Analytics</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-surface-paper rounded-lg p-6">
          <div className="text-sm text-[var(--color-text-secondary)] mb-2">Sales Velocity</div>
          <div className="text-3xl font-bold text-success">{formatCurrency(metrics.velocity)}/day</div>
          <div className="text-xs text-[var(--color-text-disabled)] mt-2">
            30d: {formatCurrency(metrics.trends.velocity30Days)}/day
          </div>
        </div>

        <div className="bg-surface-paper rounded-lg p-6">
          <div className="text-sm text-[var(--color-text-secondary)] mb-2">Win Rate</div>
          <div className="text-3xl font-bold">{metrics.winRate.toFixed(1)}%</div>
          <div className="text-xs text-[var(--color-text-disabled)] mt-2">
            30d: {metrics.trends.winRate30Days.toFixed(1)}%
          </div>
        </div>

        <div className="bg-surface-paper rounded-lg p-6">
          <div className="text-sm text-[var(--color-text-secondary)] mb-2">Avg Deal Size</div>
          <div className="text-3xl font-bold">{formatCurrency(metrics.avgDealSize)}</div>
        </div>

        <div className="bg-surface-paper rounded-lg p-6">
          <div className="text-sm text-[var(--color-text-secondary)] mb-2">Avg Sales Cycle</div>
          <div className="text-3xl font-bold">{metrics.avgSalesCycle} days</div>
        </div>
      </div>

      {/* Pipeline Insights */}
      {insights.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Pipeline Insights</h2>
          <div className="space-y-3">
            {insights.map((insight, idx) => {
              const bgColor = 
                insight.type === 'warning' ? 'bg-yellow-900/20 border-yellow-600' :
                insight.type === 'success' ? 'bg-green-900/20 border-green-600' :
                'bg-blue-900/20 border-blue-600';
              
              const icon = 
                insight.type === 'warning' ? '⚠️' :
                insight.type === 'success' ? '✅' :
                '💡';

              return (
                <div key={idx} className={`border-2 rounded-lg p-4 ${bgColor}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{icon}</span>
                        <span className="font-bold">{insight.message}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          insight.priority === 'high' ? 'bg-red-900 text-red-300' :
                          insight.priority === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                          'bg-blue-900 text-blue-300'
                        }`}>
                          {insight.priority.toUpperCase()}
                        </span>
                      </div>
                      {insight.recommendation && (
                        <div className="text-sm opacity-90 ml-7">
                          {insight.recommendation}
                        </div>
                      )}
                      {insight.affectedDeals && (
                        <div className="text-xs opacity-75 ml-7 mt-1">
                          Affects {insight.affectedDeals} deals
                        </div>
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
            {formatCurrency(metrics.forecastedRevenue)}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">
            Confidence: {metrics.confidenceLevel}%
          </div>
          <div className="mt-4 w-full bg-surface-elevated rounded-full h-3">
            <div
              className="bg-success h-3 rounded-full"
              style={{ width: `${metrics.confidenceLevel}%` }}
            />
          </div>
        </div>

        <div className="bg-surface-paper rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Velocity Trend</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-text-secondary)]">Last 30 Days</span>
                <span className="font-medium">{formatCurrency(metrics.trends.velocity30Days)}/day</span>
              </div>
              <div className="w-full bg-surface-elevated rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${(metrics.trends.velocity30Days / metrics.trends.velocity90Days) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-text-secondary)]">Last 90 Days</span>
                <span className="font-medium">{formatCurrency(metrics.trends.velocity90Days)}/day</span>
              </div>
              <div className="w-full bg-surface-elevated rounded-full h-2">
                <div className="bg-success h-2 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
          {metrics.trends.velocity30Days < metrics.trends.velocity90Days * 0.8 && (
            <div className="mt-4 text-sm" style={{ color: 'var(--color-warning)' }}>
              ⚠️ Velocity declining - 30-day avg is {((1 - metrics.trends.velocity30Days / metrics.trends.velocity90Days) * 100).toFixed(0)}% below 90-day avg
            </div>
          )}
        </div>
      </div>

      {/* Pipeline by Stage */}
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
              {stagesArray.map(([stage, data]) => {
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
          {Array.from(metrics.conversionRates.entries()).map(([transition, rate]) => (
            <div key={transition}>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[var(--color-text-secondary)] capitalize">{transition.replace('->', ' → ').replace(/_/g, ' ')}</span>
                <span className="font-medium">{rate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-surface-elevated rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    rate >= 60 ? 'bg-success' :
                    rate >= 40 ? 'bg-[var(--color-warning)]' :
                    'bg-error'
                  }`}
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

