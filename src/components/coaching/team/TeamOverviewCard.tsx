/**
 * Team Overview Card Component
 *
 * Displays team performance summary, distribution, and key metrics
 */

'use client';

import React from 'react';
import type { TeamPerformanceSummary } from '@/lib/coaching/types';

interface TeamOverviewCardProps {
  summary: TeamPerformanceSummary;
  teamName: string;
  loading?: boolean;
}

/**
 * Team Overview Card Component
 */
export function TeamOverviewCard({ summary, teamName, loading = false }: TeamOverviewCardProps) {
  if (loading) {
    return (
      <div className="bg-surface-main rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-surface-elevated rounded w-1/3 mb-4"></div>
        <div className="h-48 bg-surface-elevated rounded"></div>
      </div>
    );
  }

  // Get tier color
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'top_performer':
        return 'bg-green-500';
      case 'high_performer':
        return 'bg-blue-500';
      case 'average':
        return 'bg-yellow-500';
      case 'needs_improvement':
        return 'bg-orange-500';
      case 'at_risk':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get tier label
  const getTierLabel = (tier: string) => {
    return tier.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get trend icon
  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
        return '→';
      default:
        return '–';
    }
  };

  // Get trend color
  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'up':
        return 'text-success';
      case 'down':
        return 'text-error';
      case 'stable':
        return 'text-[var(--color-text-secondary)]';
      default:
        return 'text-[var(--color-text-secondary)]';
    }
  };

  return (
    <div className="bg-surface-main rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Team Overview</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{teamName} · {summary.totalReps} reps</p>
      </div>

      {/* Performance Distribution */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Performance Distribution</h4>
        <div className="space-y-3">
          {summary.performanceDistribution.map((dist) => (
            <div key={dist.tier}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--color-text-secondary)]">{getTierLabel(dist.tier)}</span>
                <span className="text-xs font-medium text-[var(--color-text-primary)]">
                  {dist.count} ({dist.percentage.toFixed(0)}%)
                </span>
              </div>
              <div className="w-full bg-surface-elevated rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getTierColor(dist.tier)}`}
                  style={{ width: `${dist.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Averages */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Team Averages</h4>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Overall Score"
            value={summary.teamAverages.overallScore.toFixed(0)}
            showBar={true}
            barPercentage={summary.teamAverages.overallScore}
          />
          <MetricCard
            label="Win Rate"
            value={`${(summary.teamAverages.winRate * 100).toFixed(1)}%`}
            showBar={true}
            barPercentage={summary.teamAverages.winRate * 100}
          />
          <MetricCard
            label="Quota Attainment"
            value={`${(summary.teamAverages.quotaAttainment * 100).toFixed(0)}%`}
            showBar={true}
            barPercentage={summary.teamAverages.quotaAttainment * 100}
          />
          <MetricCard
            label="Deal Velocity"
            value={`${summary.teamAverages.dealVelocity.toFixed(1)}/wk`}
            showBar={false}
          />
        </div>
      </div>

      {/* Trends */}
      {summary.trends.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Trends</h4>
          <div className="space-y-2">
            {summary.trends.map((trend, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">{trend.metric}</span>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${getTrendColor(trend.direction)}`}>
                    {getTrendIcon(trend.direction)} {Math.abs(trend.change).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* At-Risk Alert */}
      {summary.atRiskCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="text-sm font-semibold text-red-900 mb-1">
                {summary.atRiskCount} Rep{summary.atRiskCount > 1 ? 's' : ''} At Risk
              </h4>
              <p className="text-xs text-red-700">
                {summary.atRiskCount > 1 ? 'These reps need' : 'This rep needs'} immediate 1-on-1 coaching to get back on track
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Performer Benchmarks */}
      {summary.topPerformerBenchmarks.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border-light">
          <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Top Performer Benchmarks</h4>
          <div className="grid grid-cols-2 gap-3">
            {summary.topPerformerBenchmarks.slice(0, 4).map((benchmark, idx) => (
              <div key={idx} className="bg-green-50 rounded-lg p-3">
                <div className="text-xs text-success mb-1">{benchmark.metric}</div>
                <div className="text-lg font-semibold text-green-900">
                  {benchmark.metric.includes('Rate') || benchmark.metric.includes('Attainment')
                    ? `${(benchmark.value * 100).toFixed(1)}%`
                    : benchmark.value.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Metric Card Component
 */
interface MetricCardProps {
  label: string;
  value: string;
  showBar?: boolean;
  barPercentage?: number;
}

function MetricCard({ label, value, showBar = false, barPercentage = 0 }: MetricCardProps) {
  return (
    <div className="bg-surface-elevated rounded-lg p-3">
      <div className="text-xs text-[var(--color-text-disabled)] mb-1">{label}</div>
      <div className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{value}</div>
      {showBar && (
        <div className="w-full bg-surface-paper rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, barPercentage)}%` }}
          ></div>
        </div>
      )}
    </div>
  );
}
