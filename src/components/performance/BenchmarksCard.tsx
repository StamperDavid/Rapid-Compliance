/**
 * Benchmarks Card
 * 
 * Displays performance benchmarks comparing top performers,
 * team median, and bottom performers across key metrics.
 * 
 * @module components/performance
 */

'use client';

import React from 'react';
import type { PerformanceBenchmarks, RepPerformanceMetrics } from '@/lib/performance';

interface BenchmarksCardProps {
  benchmarks: PerformanceBenchmarks;
  individualMetrics: RepPerformanceMetrics[];
  loading?: boolean;
}

export function BenchmarksCard({
  benchmarks,
  individualMetrics,
  loading = false,
}: BenchmarksCardProps) {
  if (loading) {
    return (
      <div className="bg-surface-main rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-surface-elevated rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-surface-elevated rounded"></div>
            <div className="h-4 bg-surface-elevated rounded w-5/6"></div>
            <div className="h-4 bg-surface-elevated rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  const _formatScore = (value: number) => value.toFixed(1);
  const _formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  // Calculate team average for comparison
  const _teamAvgScore = individualMetrics.reduce((sum, m) => sum + m.scores.overall, 0) / individualMetrics.length;

  return (
    <div className="bg-surface-main rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-light">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Performance Benchmarks</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Compare your position against team standards
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Overall Score Comparison */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Overall Score Benchmarks</h4>
          
          <div className="space-y-4">
            <BenchmarkBar
              label="Top Performers (Top 20%)"
              value={benchmarks.topPerformerAvgScore}
              color="green"
              isHighlight
            />
            
            <BenchmarkBar
              label="Team Median (50th percentile)"
              value={benchmarks.teamMedianScore}
              color="blue"
            />
            
            <BenchmarkBar
              label="Bottom Performers (Bottom 20%)"
              value={benchmarks.bottomPerformerAvgScore}
              color="red"
            />
          </div>
        </div>

        {/* Percentile Thresholds */}
        <div className="mb-6 p-4 bg-surface-elevated rounded-lg">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Percentile Thresholds</h4>

          <div className="space-y-2">
            <PercentileRow
              percentile="90th"
              value={benchmarks.percentiles.p90}
              description="Top 10% threshold"
            />
            <PercentileRow
              percentile="75th"
              value={benchmarks.percentiles.p75}
              description="Top quartile"
            />
            <PercentileRow
              percentile="50th"
              value={benchmarks.percentiles.p50}
              description="Median"
            />
            <PercentileRow
              percentile="25th"
              value={benchmarks.percentiles.p25}
              description="Bottom quartile"
            />
            <PercentileRow
              percentile="10th"
              value={benchmarks.percentiles.p10}
              description="Bottom 10% threshold"
            />
          </div>
        </div>

        {/* Metric Comparisons */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Key Metrics: Top vs Median</h4>
          
          <MetricComparison
            label="Sentiment"
            topValue={benchmarks.topPerformerAvgSentiment}
            medianValue={benchmarks.teamMedianSentiment}
            format="sentiment"
          />
          
          <MetricComparison
            label="Talk Ratio"
            topValue={benchmarks.topPerformerTalkRatio}
            medianValue={benchmarks.teamMedianTalkRatio}
            format="percentage"
          />
          
          <MetricComparison
            label="Quality Score"
            topValue={benchmarks.topPerformerQuality}
            medianValue={benchmarks.teamMedianQuality}
            format="score"
          />
          
          <MetricComparison
            label="Objection Handling"
            topValue={benchmarks.topPerformerObjectionHandling}
            medianValue={benchmarks.teamMedianObjectionHandling}
            format="percentage"
          />
        </div>

        {/* Gap Analysis */}
        <div className="mt-6 p-4 bg-surface-elevated rounded-lg border border-primary">
          <h4 className="text-sm font-semibold text-primary mb-2">Performance Gap</h4>
          <div className="text-sm text-[var(--color-text-secondary)]">
            <p>
              Top performers score <span className="font-bold text-[var(--color-text-primary)]">
                {(benchmarks.topPerformerAvgScore - benchmarks.teamMedianScore).toFixed(1)} points
              </span> higher than the median.
            </p>
            <p className="mt-1">
              Focus on closing the gap by adopting best practices from top performers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BenchmarkBarProps {
  label: string;
  value: number;
  color: 'green' | 'blue' | 'red';
  isHighlight?: boolean;
}

function BenchmarkBar({ label, value, color, isHighlight = false }: BenchmarkBarProps) {
  const colorClasses = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
  };

  const textColorClasses = {
    green: 'text-green-700',
    blue: 'text-blue-700',
    red: 'text-red-700',
  };

  return (
    <div className={`${isHighlight ? 'p-3 bg-surface-elevated rounded-lg' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm ${isHighlight ? 'font-semibold' : 'font-medium'} text-[var(--color-text-primary)]`}>
          {label}
        </span>
        <span className={`text-sm font-bold ${textColorClasses[color]}`}>
          {value.toFixed(1)}
        </span>
      </div>
      <div className="w-full bg-surface-paper rounded-full h-2">
        <div
          className={`${colorClasses[color]} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        ></div>
      </div>
    </div>
  );
}

interface PercentileRowProps {
  percentile: string;
  value: number;
  description: string;
}

function PercentileRow({ percentile, value, description }: PercentileRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{percentile} Percentile</span>
        <span className="text-xs text-[var(--color-text-disabled)] ml-2">({description})</span>
      </div>
      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{value.toFixed(1)}</span>
    </div>
  );
}

interface MetricComparisonProps {
  label: string;
  topValue: number;
  medianValue: number;
  format: 'score' | 'percentage' | 'sentiment';
}

function MetricComparison({ label, topValue, medianValue, format }: MetricComparisonProps) {
  const formatValue = (value: number): string => {
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'sentiment':
        return value >= 0.5 ? 'Very Positive' : value >= 0 ? 'Positive' : value >= -0.5 ? 'Negative' : 'Very Negative';
      case 'score':
      default:
        return value.toFixed(1);
    }
  };

  const gap = topValue - medianValue;
  const _gapPercentage = medianValue !== 0 ? (gap / Math.abs(medianValue)) * 100 : 0;

  return (
    <div className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
      <div className="flex-1">
        <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{label}</div>
        <div className="flex items-center gap-4">
          <div>
            <span className="text-xs text-[var(--color-text-disabled)]">Top:</span>
            <span className="text-sm font-semibold text-success ml-1">
              {formatValue(topValue)}
            </span>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-disabled)]">Median:</span>
            <span className="text-sm font-semibold text-primary ml-1">
              {formatValue(medianValue)}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-[var(--color-text-disabled)]">Gap</div>
        <div className={`text-sm font-bold ${gap > 0 ? 'text-success' : 'text-[var(--color-text-secondary)]'}`}>
          {gap > 0 ? '+' : ''}{format === 'percentage' ? `${gap.toFixed(1)}%` : gap.toFixed(1)}
        </div>
      </div>
    </div>
  );
}
