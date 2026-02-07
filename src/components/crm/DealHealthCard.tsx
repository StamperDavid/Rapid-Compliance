/**
 * Deal Health Card Component
 * 
 * Displays deal health score with visual indicators and warnings.
 * Part of the CRM "Living Ledger" dashboard.
 */

'use client';

import React from 'react';
import type { DealHealthScore } from '@/lib/crm/deal-health';

interface DealHealthCardProps {
  health: DealHealthScore;
  dealName?: string;
  compact?: boolean;
}

export function DealHealthCard({
  health,
  dealName,
  compact = false,
}: DealHealthCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'var(--color-success)'; // green
      case 'at-risk':
        return 'var(--color-warning)'; // yellow
      case 'critical':
        return 'var(--color-error)'; // red
      default:
        return 'var(--color-neutral-500)'; // gray
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'var(--color-success-dark)'; // dark green
      case 'at-risk':
        return 'var(--color-warning-dark)'; // dark yellow
      case 'critical':
        return 'var(--color-error-dark)'; // dark red
      default:
        return 'var(--color-neutral-800)'; // dark gray
    }
  };

  const getScoreRing = (score: number) => {
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (score / 100) * circumference;
    return { circumference, offset };
  };

  const { circumference, offset } = getScoreRing(health.overall);

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-surface-paper rounded-lg" style={{ border: `1px solid ${getStatusColor(health.status)}` }}>
        {/* Score Circle */}
        <div className="relative w-10 h-10">
          <svg width="40" height="40" className="-rotate-90">
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="var(--color-bg-elevated)"
              strokeWidth="3"
            />
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke={getStatusColor(health.status)}
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-500 ease-in-out"
            />
          </svg>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: getStatusColor(health.status) }}>
            {health.overall}
          </div>
        </div>

        {/* Status */}
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase" style={{ color: getStatusColor(health.status) }}>
            {health.status}
          </div>
          {dealName && (
            <div className="text-[0.625rem] text-text-secondary mt-0.5">
              {dealName}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-main rounded-xl p-6" style={{ border: `1px solid ${getStatusColor(health.status)}` }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-text-primary m-0">
              Deal Health
            </h3>
            {dealName && (
              <p className="text-sm text-text-secondary mt-1 m-0">
                {dealName}
              </p>
            )}
          </div>
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold uppercase" style={{ backgroundColor: getStatusBg(health.status), color: getStatusColor(health.status) }}>
            {health.status}
          </div>
        </div>
      </div>

      {/* Score Circle */}
      <div className="flex justify-center mb-6">
        <div className="relative w-[120px] h-[120px]">
          <svg width="120" height="120" className="-rotate-90">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="var(--color-bg-elevated)"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={getStatusColor(health.status)}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-in-out"
            />
          </svg>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="text-3xl font-extrabold" style={{ color: getStatusColor(health.status) }}>
              {health.overall}
            </div>
            <div className="text-xs text-text-secondary">out of 100</div>
          </div>
        </div>
      </div>

      {/* Health Factors */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-neutral-300 mb-3 m-0">
          Health Factors
        </h4>
        <div className="flex flex-col gap-2">
          {health.factors.map((factor, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-text-primary">{factor.name}</span>
                  <span className={`text-[0.625rem] ${factor.impact === 'positive' ? 'text-success' : factor.impact === 'negative' ? 'text-error' : 'text-text-secondary'}`}>
                    {factor.impact === 'positive' ? '↑' : factor.impact === 'negative' ? '↓' : '→'}
                  </span>
                </div>
                <div className="text-[0.625rem] text-text-secondary">{factor.description}</div>
              </div>
              <div className="text-sm font-bold" style={{ color: getStatusColor(health.status) }}>
                {factor.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {health.warnings.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-neutral-300)', marginBottom: '0.75rem', margin: 0 }}>
            ⚠️ Warnings
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {health.warnings.map((warning, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  borderLeft: '3px solid var(--color-warning)',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  color: 'var(--color-warning-light)',
                }}
              >
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {health.recommendations.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-neutral-300)', marginBottom: '0.75rem', margin: 0 }}>
            💡 Recommendations
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {health.recommendations.map((rec, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  borderLeft: '3px solid var(--color-primary)',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  color: 'var(--color-primary-light)',
                }}
              >
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
