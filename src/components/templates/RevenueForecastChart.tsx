/**
 * Revenue Forecast Chart Component
 * 
 * Displays revenue forecast with:
 * - Best case / Most likely / Worst case scenarios
 * - Pipeline coverage gauge
 * - Quota tracking
 * - Revenue by stage breakdown
 * - Trend indicators
 */

'use client';

import { ErrorBoundary, InlineErrorFallback } from '@/components/common/ErrorBoundary';
import type { RevenueForecast, StageRevenue } from '@/lib/templates';

interface RevenueForecastChartProps {
  forecast: RevenueForecast;
  showStageBreakdown?: boolean;
  showQuotaTracking?: boolean;
}

function RevenueForecastChartInner({
  forecast,
  showStageBreakdown = true,
  showQuotaTracking = true
}: RevenueForecastChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const trendColors = {
    improving: 'text-success bg-success/20 border-success',
    stable: 'text-primary bg-primary/20 border-primary',
    declining: 'text-error bg-error/20 border-error'
  };

  const trendIcons = {
    improving: '📈',
    stable: '➡️',
    declining: '📉'
  };

  return (
    <div className="bg-surface-paper border border-border-light rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-secondary p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">
              Revenue Forecast
            </h3>
            <p className="text-[var(--color-text-secondary)] text-sm">
              {forecast.period.replace('-', ' ')} • {forecast.dealsAnalyzed} deals analyzed
            </p>
          </div>
          <div className={`px-4 py-2 rounded-lg border ${trendColors[forecast.trend]}`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{trendIcons[forecast.trend]}</span>
              <div>
                <div className="text-xs opacity-75">Trend</div>
                <div className="font-bold">
                  {forecast.trend.charAt(0).toUpperCase() + forecast.trend.slice(1)}
                  {forecast.trendPercentage !== 0 && (
                    <span className="ml-1">
                      ({forecast.trendPercentage > 0 ? '+' : ''}{forecast.trendPercentage}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Forecast */}
        <div className="grid grid-cols-3 gap-4">
          {/* Best Case */}
          <div className="bg-surface-elevated backdrop-blur-sm rounded-lg p-4 border border-border-strong">
            <div className="text-[var(--color-text-secondary)] text-sm mb-1">Best Case</div>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(forecast.bestCase)}
            </div>
            <div className="text-xs text-[var(--color-text-disabled)] mt-1">90th percentile</div>
          </div>

          {/* Most Likely */}
          <div className="bg-surface-elevated backdrop-blur-sm rounded-lg p-4 border-2 border-border-strong">
            <div className="text-[var(--color-text-secondary)] text-sm mb-1">Most Likely</div>
            <div className="text-3xl font-bold text-white">
              {formatCurrency(forecast.forecast)}
            </div>
            <div className="text-xs text-[var(--color-text-disabled)] mt-1">Expected revenue</div>
          </div>

          {/* Worst Case */}
          <div className="bg-surface-elevated backdrop-blur-sm rounded-lg p-4 border border-border-strong">
            <div className="text-[var(--color-text-secondary)] text-sm mb-1">Worst Case</div>
            <div className="text-2xl font-bold text-warning">
              {formatCurrency(forecast.worstCase)}
            </div>
            <div className="text-xs text-[var(--color-text-disabled)] mt-1">10th percentile</div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Quota Tracking */}
        {showQuotaTracking && forecast.quota && (
          <div>
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>🎯</span> Quota Tracking
            </h4>
            <div className="bg-surface-elevated rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--color-text-secondary)]">Quota Attainment</span>
                <span className={`text-2xl font-bold ${
                  forecast.quotaAttainment >= 100 ? 'text-success' :
                  forecast.quotaAttainment >= 70 ? 'text-warning' :
                  'text-error'
                }`}>
                  {forecast.quotaAttainment}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="bg-surface-paper rounded-full h-4 mb-3 overflow-hidden">
                <div
                  className={`h-4 transition-all rounded-full ${
                    forecast.quotaAttainment >= 100 ? 'bg-success' :
                    forecast.quotaAttainment >= 70 ? 'bg-warning' :
                    'bg-error'
                  }`}
                  style={{ width: `${Math.min(100, forecast.quotaAttainment)}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-[var(--color-text-secondary)] mb-1">Quota</div>
                  <div className="text-white font-semibold">
                    {formatCurrency(forecast.quota)}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--color-text-secondary)] mb-1">Forecast</div>
                  <div className="text-white font-semibold">
                    {formatCurrency(forecast.forecast)}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--color-text-secondary)] mb-1">Gap</div>
                  <div className={`font-semibold ${
                    forecast.quotaGap <= 0 ? 'text-success' : 'text-error'
                  }`}>
                    {forecast.quotaGap <= 0
                      ? `+${formatCurrency(Math.abs(forecast.quotaGap))}`
                      : `-${formatCurrency(forecast.quotaGap)}`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline Metrics */}
        <div>
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>📊</span> Pipeline Metrics
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface-elevated rounded-lg p-4">
              <div className="text-[var(--color-text-secondary)] text-sm mb-1">Weighted Pipeline</div>
              <div className="text-xl font-bold text-primary">
                {formatCurrency(forecast.weightedPipeline)}
              </div>
            </div>
            <div className="bg-surface-elevated rounded-lg p-4">
              <div className="text-[var(--color-text-secondary)] text-sm mb-1">Commit Revenue</div>
              <div className="text-xl font-bold text-secondary">
                {formatCurrency(forecast.commitRevenue)}
              </div>
            </div>
            <div className="bg-surface-elevated rounded-lg p-4">
              <div className="text-[var(--color-text-secondary)] text-sm mb-1">Pipeline Coverage</div>
              <div className={`text-xl font-bold ${
                forecast.pipelineCoverage >= 3 ? 'text-success' :
                forecast.pipelineCoverage >= 2 ? 'text-warning' :
                'text-error'
              }`}>
                {forecast.pipelineCoverage.toFixed(1)}x
              </div>
            </div>
          </div>
        </div>

        {/* Revenue by Stage */}
        {showStageBreakdown && forecast.byStage && (
          <div>
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>📍</span> Revenue by Stage
            </h4>
            <div className="space-y-3">
              {Array.from(forecast.byStage.entries()).map(([stageName, stage]: [string, StageRevenue]) => (
                <div key={stageName} className="bg-surface-elevated rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-white font-medium mb-1">
                        {stage.stageName.charAt(0).toUpperCase() + stage.stageName.slice(1)}
                      </div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        {stage.dealCount} deal{stage.dealCount !== 1 ? 's' : ''} • {stage.probability}% probability
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">
                        {formatCurrency(stage.weightedValue)}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        of {formatCurrency(stage.totalValue)}
                      </div>
                    </div>
                  </div>

                  {/* Stage Progress Bar */}
                  <div className="bg-surface-paper rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all"
                      style={{ width: `${stage.probability}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-4 border-t border-border-light text-sm text-[var(--color-text-secondary)]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">Forecast Date:</span>{' '}
              {new Date(forecast.forecastDate).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium">Confidence:</span>{' '}
              <span className={`font-bold ${
                forecast.confidence >= 80 ? 'text-success' :
                forecast.confidence >= 60 ? 'text-warning' :
                'text-error'
              }`}>
                {forecast.confidence}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export with error boundary
export default function RevenueForecastChart(props: RevenueForecastChartProps) {
  return (
    <ErrorBoundary
      componentName="RevenueForecastChart"
      fallback={<InlineErrorFallback message="Failed to load revenue forecast" />}
    >
      <RevenueForecastChartInner {...props} />
    </ErrorBoundary>
  );
}
