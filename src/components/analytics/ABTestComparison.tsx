'use client';

/**
 * A/B Test Comparison Component
 * 
 * Provides side-by-side sequence comparison with statistical analysis:
 * - Visual metric comparison
 * - Performance diff indicators
 * - Winner recommendation (when statistically significant)
 * - Detailed step-by-step breakdown
 * 
 * Hunter-Closer compliant - native implementation, no third-party A/B testing tools.
 */

import React from 'react';

interface SequenceData {
  sequenceId: string;
  sequenceName: string;
  isActive: boolean;
  channel: string;
  totalEnrolled: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  createdAt: Date;
}

interface ABTestComparisonProps {
  sequenceA: SequenceData;
  sequenceB: SequenceData;
  onClose: () => void;
}

export function ABTestComparison({ sequenceA, sequenceB, onClose }: ABTestComparisonProps) {
  // Calculate statistical significance (simplified chi-square test approximation)
  const significance = calculateSignificance(sequenceA, sequenceB);
  
  // Determine winner based on reply rate
  const winner = sequenceA.replyRate > sequenceB.replyRate ? 'A' : 
                 sequenceB.replyRate > sequenceA.replyRate ? 'B' : 
                 'tie';

  const metrics = [
    {
      label: 'Enrolled',
      valueA: sequenceA.totalEnrolled,
      valueB: sequenceB.totalEnrolled,
      format: (v: number) => v.toLocaleString(),
    },
    {
      label: 'Sent',
      valueA: sequenceA.totalSent,
      valueB: sequenceB.totalSent,
      format: (v: number) => v.toLocaleString(),
    },
    {
      label: 'Delivery Rate',
      valueA: sequenceA.deliveryRate,
      valueB: sequenceB.deliveryRate,
      format: (v: number) => `${v.toFixed(1)}%`,
      isPercentage: true,
    },
    {
      label: 'Open Rate',
      valueA: sequenceA.openRate,
      valueB: sequenceB.openRate,
      format: (v: number) => `${v.toFixed(1)}%`,
      isPercentage: true,
    },
    {
      label: 'Click Rate',
      valueA: sequenceA.clickRate,
      valueB: sequenceB.clickRate,
      format: (v: number) => `${v.toFixed(1)}%`,
      isPercentage: true,
    },
    {
      label: 'Reply Rate',
      valueA: sequenceA.replyRate,
      valueB: sequenceB.replyRate,
      format: (v: number) => `${v.toFixed(1)}%`,
      isPercentage: true,
      isKey: true,
    },
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      zIndex: 50,
      overflowY: 'auto',
    }}>
      <div style={{
        backgroundColor: '#0a0a0a',
        borderRadius: '1rem',
        border: '1px solid #333',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
              🆚 A/B Test Comparison
            </h2>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
              Compare sequence performance side by side
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              color: '#666',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.5rem',
              padding: '0.5rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Sequence Headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          padding: '1.5rem',
          borderBottom: '1px solid #1a1a1a',
        }}>
          <div style={{
            backgroundColor: winner === 'A' ? '#065f46' : '#111',
            border: `2px solid ${winner === 'A' ? '#10b981' : '#333'}`,
            borderRadius: '0.75rem',
            padding: '1.5rem',
            position: 'relative',
          }}>
            {winner === 'A' && (
              <div style={{
                position: 'absolute',
                top: '-0.75rem',
                right: '1rem',
                backgroundColor: '#10b981',
                color: '#000',
                padding: '0.25rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                fontWeight: '700',
              }}>
                🏆 WINNER
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem' }}>
              VARIANT A
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
              {sequenceA.sequenceName}
            </h3>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              {sequenceA.channel} • Created {sequenceA.createdAt.toLocaleDateString()}
            </div>
          </div>

          <div style={{
            backgroundColor: winner === 'B' ? '#065f46' : '#111',
            border: `2px solid ${winner === 'B' ? '#10b981' : '#333'}`,
            borderRadius: '0.75rem',
            padding: '1.5rem',
            position: 'relative',
          }}>
            {winner === 'B' && (
              <div style={{
                position: 'absolute',
                top: '-0.75rem',
                right: '1rem',
                backgroundColor: '#10b981',
                color: '#000',
                padding: '0.25rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                fontWeight: '700',
              }}>
                🏆 WINNER
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem' }}>
              VARIANT B
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
              {sequenceB.sequenceName}
            </h3>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              {sequenceB.channel} • Created {sequenceB.createdAt.toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Statistical Significance */}
        {significance.isSignificant && (
          <div style={{
            padding: '1rem 1.5rem',
            backgroundColor: '#1a3a1a',
            borderBottom: '1px solid #1a1a1a',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📊</span>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#10b981' }}>
                  Statistically Significant Result
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6ee7b7' }}>
                  {significance.confidence > 0.99 ? '99%+' : `${(significance.confidence * 100).toFixed(0)}%`} confidence • 
                  Sample size sufficient for reliable comparison
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Comparison */}
        <div style={{ padding: '1.5rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '1rem' }}>
            Performance Metrics
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {metrics.map((metric, index) => {
              const diff = metric.valueA - metric.valueB;
              const percentDiff = metric.valueB > 0 ? ((diff / metric.valueB) * 100) : 0;
              const showDiff = metric.isPercentage;

              return (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '200px 1fr auto 1fr',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    backgroundColor: metric.isKey ? '#1a1a2e' : '#111',
                    borderRadius: '0.5rem',
                    border: metric.isKey ? '1px solid #6366f1' : '1px solid #222',
                  }}
                >
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: metric.isKey ? '#6366f1' : '#999' }}>
                    {metric.label}
                  </div>

                  <div style={{
                    textAlign: 'right',
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: metric.isKey && metric.valueA > metric.valueB ? '#10b981' : '#fff',
                  }}>
                    {metric.format(metric.valueA)}
                  </div>

                  <div style={{
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    color: showDiff && diff !== 0 ? (diff > 0 ? '#10b981' : '#ef4444') : '#666',
                    fontWeight: '600',
                    minWidth: '80px',
                  }}>
                    {showDiff && diff !== 0 && (
                      <>
                        {diff > 0 ? '+' : ''}{percentDiff.toFixed(1)}%
                      </>
                    )}
                  </div>

                  <div style={{
                    textAlign: 'left',
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: metric.isKey && metric.valueB > metric.valueA ? '#10b981' : '#fff',
                  }}>
                    {metric.format(metric.valueB)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommendation */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid #1a1a1a',
          backgroundColor: '#111',
        }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '1rem' }}>
            💡 Recommendation
          </h4>
          
          {winner === 'tie' ? (
            <p style={{ color: '#999', fontSize: '0.875rem' }}>
              Both sequences have identical reply rates. Consider other factors like sample size, 
              cost per acquisition, or secondary metrics to make a decision.
            </p>
          ) : (
            <p style={{ color: '#999', fontSize: '0.875rem' }}>
              <strong style={{ color: '#10b981' }}>
                Variant {winner}
              </strong>
              {' '}shows better performance with a{' '}
              {Math.abs(sequenceA.replyRate - sequenceB.replyRate).toFixed(1)}% higher reply rate.
              {significance.isSignificant ? (
                <> This result is statistically significant with {significance.confidence > 0.99 ? '99%+' : `${(significance.confidence * 100).toFixed(0)}%`} confidence.</>
              ) : (
                <> However, more data is needed to reach statistical significance. Continue testing to validate this trend.</>
              )}
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid #1a1a1a',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate statistical significance using simplified z-test for proportions
 */
function calculateSignificance(seqA: SequenceData, seqB: SequenceData): {
  isSignificant: boolean;
  confidence: number;
  pValue: number;
} {
  const n1 = seqA.totalDelivered;
  const n2 = seqB.totalDelivered;
  const p1 = seqA.totalReplied / (n1 || 1);
  const p2 = seqB.totalReplied / (n2 || 1);

  // Need at least 30 samples per variant for valid z-test
  if (n1 < 30 || n2 < 30) {
    return { isSignificant: false, confidence: 0, pValue: 1 };
  }

  // Pooled proportion
  const pPool = (seqA.totalReplied + seqB.totalReplied) / (n1 + n2);
  
  // Standard error
  const se = Math.sqrt(pPool * (1 - pPool) * (1/n1 + 1/n2));
  
  // Z-score
  const z = Math.abs((p1 - p2) / se);
  
  // P-value (two-tailed test, simplified)
  const pValue = 2 * (1 - normalCDF(z));
  
  // Confidence level (1 - p-value)
  const confidence = 1 - pValue;
  
  // Significant if p < 0.05 (95% confidence)
  const isSignificant = pValue < 0.05 && z > 1.96;

  return { isSignificant, confidence, pValue };
}

/**
 * Cumulative distribution function for standard normal distribution
 * (simplified approximation)
 */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}
