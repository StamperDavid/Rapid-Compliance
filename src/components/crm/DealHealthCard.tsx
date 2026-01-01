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
        return '#10b981'; // green
      case 'at-risk':
        return '#f59e0b'; // yellow
      case 'critical':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
        return '#065f46'; // dark green
      case 'at-risk':
        return '#78350f'; // dark yellow
      case 'critical':
        return '#7f1d1d'; // dark red
      default:
        return '#1f2937'; // dark gray
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem',
          backgroundColor: '#0a0a0a',
          borderRadius: '0.5rem',
          border: `1px solid ${getStatusColor(health.status)}`,
        }}
      >
        {/* Score Circle */}
        <div style={{ position: 'relative', width: '40px', height: '40px' }}>
          <svg width="40" height="40" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="#1a1a1a"
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
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '0.75rem',
              fontWeight: '700',
              color: getStatusColor(health.status),
            }}
          >
            {health.overall}
          </div>
        </div>

        {/* Status */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: getStatusColor(health.status),
              textTransform: 'uppercase',
            }}
          >
            {health.status}
          </div>
          {dealName && (
            <div style={{ fontSize: '0.625rem', color: '#999', marginTop: '0.125rem' }}>
              {dealName}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#0a0a0a',
        border: `1px solid ${getStatusColor(health.status)}`,
        borderRadius: '0.75rem',
        padding: '1.5rem',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#fff', margin: 0 }}>
              Deal Health
            </h3>
            {dealName && (
              <p style={{ fontSize: '0.875rem', color: '#999', marginTop: '0.25rem', margin: 0 }}>
                {dealName}
              </p>
            )}
          </div>
          <div
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: getStatusBg(health.status),
              color: getStatusColor(health.status),
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: '600',
              textTransform: 'uppercase',
            }}
          >
            {health.status}
          </div>
        </div>
      </div>

      {/* Score Circle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', width: '120px', height: '120px' }}>
          <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#1a1a1a"
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
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '2rem',
                fontWeight: '800',
                color: getStatusColor(health.status),
              }}
            >
              {health.overall}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#999' }}>out of 100</div>
          </div>
        </div>
      </div>

      {/* Health Factors */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem', margin: 0 }}>
          Health Factors
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {health.factors.map((factor, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#fff' }}>{factor.name}</span>
                  <span style={{ fontSize: '0.625rem', color: factor.impact === 'positive' ? '#10b981' : factor.impact === 'negative' ? '#ef4444' : '#999' }}>
                    {factor.impact === 'positive' ? '↑' : factor.impact === 'negative' ? '↓' : '→'}
                  </span>
                </div>
                <div style={{ fontSize: '0.625rem', color: '#666' }}>{factor.description}</div>
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: '700', color: getStatusColor(health.status) }}>
                {factor.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {health.warnings.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem', margin: 0 }}>
            ⚠️ Warnings
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {health.warnings.map((warning, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#1a1a1a',
                  borderLeft: '3px solid #f59e0b',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  color: '#fbbf24',
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
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem', margin: 0 }}>
            💡 Recommendations
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {health.recommendations.map((rec, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#1a1a1a',
                  borderLeft: '3px solid #6366f1',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  color: '#a5b4fc',
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
