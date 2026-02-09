/**
 * Performance Score Card Component
 * 
 * Displays overall performance score, tier, and key metrics
 */

'use client';

import React from 'react';
import type { RepPerformanceMetrics } from '@/lib/coaching/types';

interface PerformanceScoreCardProps {
  performance: RepPerformanceMetrics;
  loading?: boolean;
}

/**
 * Performance Score Card Component
 */
export function PerformanceScoreCard({ performance, loading = false }: PerformanceScoreCardProps) {
  if (loading) {
    return (
      <div className="bg-surface-main rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-surface-elevated rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-surface-elevated rounded"></div>
      </div>
    );
  }

  // Get tier color
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'top_performer':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'high_performer':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'average':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'needs_improvement':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'at_risk':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) {return 'text-green-600';}
    if (score >= 60) {return 'text-blue-600';}
    if (score >= 40) {return 'text-yellow-600';}
    if (score >= 20) {return 'text-orange-600';}
    return 'text-red-600';
  };

  // Get score background
  const getScoreBackground = (score: number) => {
    if (score >= 80) {return 'bg-green-50';}
    if (score >= 60) {return 'bg-blue-50';}
    if (score >= 40) {return 'bg-yellow-50';}
    if (score >= 20) {return 'bg-orange-50';}
    return 'bg-red-50';
  };

  const tierLabel = performance.tier.replace('_', ' ').toUpperCase();

  return (
    <div className="bg-surface-main rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Performance Overview</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{performance.repName} · {performance.period}</p>
      </div>

      {/* Score Circle */}
      <div className="flex items-center justify-center mb-6">
        <div className={`relative w-40 h-40 rounded-full ${getScoreBackground(performance.overallScore)} flex items-center justify-center`}>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getScoreColor(performance.overallScore)}`}>
              {performance.overallScore.toFixed(0)}
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">Overall Score</div>
          </div>
        </div>
      </div>

      {/* Tier Badge */}
      <div className="flex justify-center mb-6">
        <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium border ${getTierColor(performance.tier)}`}>
          {tierLabel}
        </span>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          label="Win Rate"
          value={`${(performance.deals.winRate * 100).toFixed(1)}%`}
          delta={performance.vsTeamAverage.winRateDelta * 100}
        />
        <MetricCard
          label="Quota Attainment"
          value={`${(performance.revenue.quotaAttainment * 100).toFixed(1)}%`}
          delta={performance.vsTeamAverage.overallScoreDelta}
        />
        <MetricCard
          label="Deal Velocity"
          value={`${performance.deals.dealVelocity.toFixed(1)}/wk`}
          delta={null}
        />
        <MetricCard
          label="Email Response"
          value={`${(performance.communication.emailResponseRate * 100).toFixed(1)}%`}
          delta={null}
        />
      </div>

      {/* Percentile Rank */}
      <div className="mt-6 pt-6 border-t border-border-light">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-text-secondary)]">Team Percentile</span>
          <span className="text-lg font-semibold text-[var(--color-text-primary)]">
            {performance.vsTeamAverage.percentileRank.toFixed(0)}th
          </span>
        </div>
        <div className="mt-2 w-full bg-surface-elevated rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${performance.vsTeamAverage.percentileRank}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Metric Card Component
 */
interface MetricCardProps {
  label: string;
  value: string;
  delta: number | null;
}

function MetricCard({ label, value, delta }: MetricCardProps) {
  return (
    <div className="bg-surface-elevated rounded-lg p-3">
      <div className="text-xs text-[var(--color-text-disabled)] mb-1">{label}</div>
      <div className="text-xl font-bold text-[var(--color-text-primary)]">{value}</div>
      {delta !== null && (
        <div className={`text-xs mt-1 flex items-center ${delta >= 0 ? 'text-success' : 'text-error'}`}>
          <span className="mr-1">{delta >= 0 ? '↑' : '↓'}</span>
          <span>{Math.abs(delta).toFixed(1)} vs avg</span>
        </div>
      )}
    </div>
  );
}
