/**
 * Sequence Patterns Card Component
 * 
 * Displays high-performing patterns detected by AI analysis.
 * 
 * @module components/sequence/SequencePatternsCard
 */

'use client';

import React from 'react';
import type { SequenceAnalysis, SequencePattern } from '@/lib/sequence';
import { Lightbulb, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

interface SequencePatternsCardProps {
  analysis: SequenceAnalysis;
}

export function SequencePatternsCard({ analysis }: SequencePatternsCardProps) {
  const { patterns } = analysis;
  
  if (!patterns || patterns.total === 0) {
    return (
      <div className="bg-surface-main rounded-lg shadow p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">High-Performing Patterns</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            AI-detected patterns in top sequences
          </p>
        </div>
        <div className="text-center py-12">
          <Lightbulb className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-3" />
          <p className="text-[var(--color-text-disabled)]">No patterns detected yet. Need more data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-main rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">High-Performing Patterns</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {patterns.total} pattern{patterns.total !== 1 ? 's' : ''} detected •
          {' '}{patterns.highConfidence} high confidence
        </p>
      </div>
      
      {/* Pattern Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-surface-elevated rounded">
          <div className="text-2xl font-bold text-success">{patterns.highConfidence}</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1">High Confidence</div>
        </div>
        <div className="text-center p-3 bg-surface-elevated rounded">
          <div className="text-2xl font-bold text-warning">{patterns.mediumConfidence}</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1">Medium Confidence</div>
        </div>
        <div className="text-center p-3 bg-surface-elevated rounded">
          <div className="text-2xl font-bold text-[var(--color-text-secondary)]">{patterns.lowConfidence}</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1">Low Confidence</div>
        </div>
      </div>

      {/* Top Patterns */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">Top Patterns</h3>
        {patterns.topPatterns.map((pattern, index) => (
          <PatternCard key={index} pattern={pattern} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface PatternCardProps {
  pattern: SequencePattern;
  rank: number;
}

function PatternCard({ pattern, rank }: PatternCardProps) {
  const [expanded, setExpanded] = React.useState(false);

  const confidenceColor = {
    high: 'bg-surface-elevated text-success',
    medium: 'bg-surface-elevated text-warning',
    low: 'bg-surface-elevated text-[var(--color-text-disabled)]',
  }[pattern.confidence];

  return (
    <div className="border border-border-light rounded-lg p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-2 py-1 bg-surface-elevated text-primary text-xs font-medium rounded">
                #{rank}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded ${confidenceColor}`}>
                {pattern.confidence} confidence
              </span>
              <span className="px-2 py-1 bg-surface-elevated text-secondary text-xs font-medium rounded">
                {pattern.type.replace('_', ' ')}
              </span>
            </div>
            <h4 className="font-semibold text-[var(--color-text-primary)]">{pattern.name}</h4>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{pattern.description}</p>
          </div>
          <TrendingUp className={`w-4 h-4 ml-4 ${expanded ? 'rotate-180' : ''} transition-transform`} />
        </div>
        
        <div className="grid grid-cols-3 gap-3 mt-3">
          <LiftBadge label="Reply" value={pattern.replyLift} />
          <LiftBadge label="Meeting" value={pattern.meetingLift} />
          <LiftBadge label="Opportunity" value={pattern.opportunityLift} />
        </div>
      </button>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border-light">
          {/* Characteristics */}
          <div className="mb-4">
            <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Key Characteristics</h5>
            <div className="space-y-2">
              {pattern.characteristics.map((char, index) => (
                <div key={index} className="flex items-start space-x-2">
                  {char.importance === 'critical' ? (
                    <AlertCircle className="w-4 h-4 text-error mt-0.5" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-[var(--color-text-secondary)] mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">
                      {char.attribute}: <span className="text-[var(--color-text-secondary)]">{String(char.value)}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-disabled)]">{char.description}</div>
                  </div>
                  {char.importance === 'critical' && (
                    <span className="px-2 py-0.5 bg-surface-elevated text-error text-xs rounded">
                      Critical
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Evidence */}
          <div className="mb-4">
            <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Evidence</h5>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-[var(--color-text-secondary)]">Sample Size:</span>
                <span className="ml-2 font-medium">{pattern.sampleSize}</span>
              </div>
              <div>
                <span className="text-[var(--color-text-secondary)]">Occurrences:</span>
                <span className="ml-2 font-medium">{pattern.occurrences}</span>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-surface-elevated rounded p-3">
            <h5 className="text-sm font-medium text-primary mb-2">
              <Lightbulb className="w-4 h-4 inline mr-1" />
              Recommendation
            </h5>
            <p className="text-sm text-[var(--color-text-primary)] mb-3">{pattern.recommendation}</p>
            <div className="space-y-1">
              {pattern.implementationSteps.map((step, index) => (
                <div key={index} className="text-xs text-[var(--color-text-secondary)] flex items-start">
                  <span className="mr-2">{index + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface LiftBadgeProps {
  label: string;
  value: number;
}

function LiftBadge({ label, value }: LiftBadgeProps) {
  const isPositive = value > 0;

  return (
    <div className="text-center p-2 bg-surface-elevated rounded">
      <div className={`text-lg font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
        {isPositive ? '+' : ''}{value.toFixed(1)}%
      </div>
      <div className="text-xs text-[var(--color-text-secondary)]">{label} Lift</div>
    </div>
  );
}
