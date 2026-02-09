/**
 * Adoption Metrics Card
 * 
 * Displays playbook adoption metrics, effectiveness, and impact.
 * Shows adoption by tier, usage trends, and barriers.
 * 
 * @module components/playbook
 */

'use client';

import React from 'react';
import type { PlaybookAdoptionMetrics } from '@/lib/playbook/types';

interface AdoptionMetricsCardProps {
  metrics: PlaybookAdoptionMetrics;
  className?: string;
}

export function AdoptionMetricsCard({ metrics, className = '' }: AdoptionMetricsCardProps) {
  const {
    overallAdoptionRate,
    repsUsing,
    repsAvailable,
    adoptionByTier,
    avgEffectiveness,
    effectivenessDistribution,
    impactMetrics,
    adoptionBarriers,
    usageOverTime,
  } = metrics;
  
  // Adoption color
  const getAdoptionColor = (rate: number) => {
    if (rate >= 75) {return 'text-success';}
    if (rate >= 50) {return 'text-primary';}
    if (rate >= 25) {return 'text-warning';}
    return 'text-error';
  };

  const getAdoptionBgColor = (rate: number) => {
    if (rate >= 75) {return 'bg-success';}
    if (rate >= 50) {return 'bg-primary';}
    if (rate >= 25) {return 'bg-warning';}
    return 'bg-error';
  };

  // Impact color (for lift metrics)
  const getLiftColor = (lift: number) => {
    if (lift > 0) {return 'text-success';}
    if (lift < 0) {return 'text-error';}
    return 'text-[var(--color-text-secondary)]';
  };

  // Barrier severity
  const getBarrierColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-surface-elevated text-error border-border-light';
      case 'medium': return 'bg-surface-elevated text-warning border-border-light';
      case 'low': return 'bg-surface-elevated text-primary border-border-light';
      default: return 'bg-surface-elevated text-[var(--color-text-secondary)] border-border-light';
    }
  };
  
  return (
    <div className={`bg-surface-main rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]">Adoption & Impact</h2>
      
      {/* Overall Adoption */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">Overall Adoption Rate</span>
          <span className={`text-2xl font-bold ${getAdoptionColor(overallAdoptionRate)}`}>
            {overallAdoptionRate}%
          </span>
        </div>
        <div className="w-full bg-surface-elevated rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${getAdoptionBgColor(overallAdoptionRate)}`}
            style={{ width: `${overallAdoptionRate}%` }}
          />
        </div>
        <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {repsUsing} of {repsAvailable} reps using this playbook
        </div>
      </div>

      {/* Effectiveness Distribution */}
      <div className="mb-6">
        <h3 className="font-semibold text-[var(--color-text-secondary)] mb-3">Effectiveness Distribution</h3>
        <div className="space-y-2">
          {[
            { label: 'Excellent', value: effectivenessDistribution.excellent, color: 'bg-success' },
            { label: 'Good', value: effectivenessDistribution.good, color: 'bg-primary' },
            { label: 'Fair', value: effectivenessDistribution.fair, color: 'bg-warning' },
            { label: 'Poor', value: effectivenessDistribution.poor, color: 'bg-error' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-20 text-sm text-[var(--color-text-secondary)]">{item.label}</div>
              <div className="flex-1 bg-surface-elevated rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${item.color}`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
              <div className="w-12 text-sm text-[var(--color-text-secondary)] text-right">{item.value}%</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-center">
          <span className="text-sm text-[var(--color-text-secondary)]">Average: </span>
          <span className="text-lg font-semibold text-primary">{avgEffectiveness}%</span>
        </div>
      </div>

      {/* Impact Metrics */}
      <div className="mb-6">
        <h3 className="font-semibold text-[var(--color-text-secondary)] mb-3">Impact Metrics (Before → After)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-border-light rounded-lg p-3">
            <div className="text-xs text-[var(--color-text-secondary)] mb-1">Conversion Rate</div>
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {impactMetrics.conversionRateBefore}% → {impactMetrics.conversionRateAfter}%
              </div>
              <div className={`text-sm font-semibold ${getLiftColor(impactMetrics.conversionRateLift)}`}>
                {impactMetrics.conversionRateLift > 0 ? '+' : ''}{impactMetrics.conversionRateLift}%
              </div>
            </div>
          </div>
          
          <div className="border rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Win Rate</div>
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {impactMetrics.winRateBefore}% → {impactMetrics.winRateAfter}%
              </div>
              <div className={`text-sm font-semibold ${getLiftColor(impactMetrics.winRateLift)}`}>
                {impactMetrics.winRateLift > 0 ? '+' : ''}{impactMetrics.winRateLift}%
              </div>
            </div>
          </div>
          
          <div className="border rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Sentiment</div>
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {impactMetrics.sentimentBefore.toFixed(2)} → {impactMetrics.sentimentAfter.toFixed(2)}
              </div>
              <div className={`text-sm font-semibold ${getLiftColor(impactMetrics.sentimentLift)}`}>
                {impactMetrics.sentimentLift > 0 ? '+' : ''}{impactMetrics.sentimentLift.toFixed(2)}
              </div>
            </div>
          </div>
          
          <div className="border rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Overall Score</div>
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {impactMetrics.avgScoreBefore} → {impactMetrics.avgScoreAfter}
              </div>
              <div className={`text-sm font-semibold ${getLiftColor(impactMetrics.scoreLift)}`}>
                {impactMetrics.scoreLift > 0 ? '+' : ''}{impactMetrics.scoreLift}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500 text-center">
          Confidence: {impactMetrics.confidence}%
          {impactMetrics.pValue && ` (p=${impactMetrics.pValue.toFixed(4)})`}
        </div>
      </div>
      
      {/* Adoption by Tier */}
      {Object.keys(adoptionByTier).length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-700 mb-3">Adoption by Performance Tier</h3>
          <div className="space-y-2">
            {Object.entries(adoptionByTier).map(([tier, rate]) => (
              <div key={tier} className="flex items-center gap-3">
                <div className="w-32 text-sm text-gray-700 capitalize">{tier.replace(/_/g, ' ')}</div>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getAdoptionBgColor(rate)}`}
                    style={{ width: `${rate}%` }}
                  />
                </div>
                <div className="w-12 text-sm text-gray-600 text-right">{rate}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Usage Over Time */}
      {usageOverTime.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-700 mb-3">Usage Trend</h3>
          <div className="flex items-end gap-1 h-24">
            {usageOverTime.slice(-7).map((point, index) => {
              const maxUsage = Math.max(...usageOverTime.slice(-7).map(p => p.usageCount));
              const height = maxUsage > 0 ? (point.usageCount / maxUsage) * 100 : 0;
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                    style={{ height: `${height}%` }}
                    title={`${point.usageCount} uses`}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Adoption Barriers */}
      {adoptionBarriers.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">Adoption Barriers</h3>
          <div className="space-y-2">
            {adoptionBarriers.slice(0, 3).map((barrier, index) => (
              <div key={index} className={`border rounded-lg p-3 ${getBarrierColor(barrier.severity)}`}>
                <div className="flex items-start justify-between mb-1">
                  <div className="font-medium text-sm capitalize">{barrier.type.replace(/_/g, ' ')}</div>
                  <div className="text-xs">
                    {barrier.repsAffected} rep{barrier.repsAffected !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="text-sm mb-2">{barrier.description}</div>
                <div className="text-xs">
                  <span className="font-medium">Mitigation: </span>
                  {barrier.mitigation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
