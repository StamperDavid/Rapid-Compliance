/**
 * Lead Score Card Component
 * 
 * Displays individual lead score with breakdown and insights
 */

'use client';

import React from 'react';
import type { LeadScore } from '@/types/lead-scoring';

interface LeadScoreCardProps {
  score: LeadScore;
  compact?: boolean;
}

export function LeadScoreCard({ score, compact = false }: LeadScoreCardProps) {
  const gradeColors = {
    A: 'bg-green-500',
    B: 'bg-blue-500',
    C: 'bg-yellow-500',
    D: 'bg-orange-500',
    F: 'bg-red-500',
  };

  const priorityColors = {
    hot: 'bg-red-100 text-red-800 border-red-300',
    warm: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    cold: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const priorityIcons = {
    hot: '🔥',
    warm: '☀️',
    cold: '❄️',
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Score badge */}
        <div className={`w-16 h-16 rounded-full ${gradeColors[score.grade]} flex items-center justify-center`}>
          <div className="text-center">
            <div className="text-xl font-bold text-white">{score.totalScore}</div>
            <div className="text-xs text-white opacity-90">{score.grade}</div>
          </div>
        </div>

        {/* Priority badge */}
        <div className={`px-3 py-1 rounded-full border ${priorityColors[score.priority]}`}>
          <span className="mr-1">{priorityIcons[score.priority]}</span>
          <span className="font-medium capitalize">{score.priority}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-paper border border-border-light rounded-lg p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Score circle */}
          <div className={`w-24 h-24 rounded-full ${gradeColors[score.grade]} flex items-center justify-center shadow-lg`}>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{score.totalScore}</div>
              <div className="text-sm text-white opacity-90">Grade {score.grade}</div>
            </div>
          </div>

          {/* Priority & confidence */}
          <div>
            <div className={`inline-block px-4 py-2 rounded-full border ${priorityColors[score.priority]} mb-2`}>
              <span className="mr-2">{priorityIcons[score.priority]}</span>
              <span className="font-semibold capitalize">{score.priority} Lead</span>
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">
              Confidence: {Math.round(score.metadata.confidence * 100)}%
            </div>
          </div>
        </div>

        {/* Expiry info */}
        <div className="text-right text-sm text-[var(--color-text-disabled)]">
          <div>Scored {new Date(score.metadata.scoredAt).toLocaleDateString()}</div>
          <div>Expires {new Date(score.metadata.expiresAt).toLocaleDateString()}</div>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Score Breakdown</h3>
        <div className="space-y-3">
          {/* Company Fit */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[var(--color-text-secondary)]">Company Fit</span>
              <span className="font-semibold">{score.breakdown.companyFit}/40</span>
            </div>
            <div className="w-full bg-surface-elevated rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(score.breakdown.companyFit / 40) * 100}%` }}
              />
            </div>
          </div>

          {/* Person Fit */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[var(--color-text-secondary)]">Person Fit</span>
              <span className="font-semibold">{score.breakdown.personFit}/30</span>
            </div>
            <div className="w-full bg-surface-elevated rounded-full h-2">
              <div
                className="bg-success h-2 rounded-full transition-all"
                style={{ width: `${(score.breakdown.personFit / 30) * 100}%` }}
              />
            </div>
          </div>

          {/* Intent Signals */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[var(--color-text-secondary)]">Intent Signals</span>
              <span className="font-semibold">{score.breakdown.intentSignals}/20</span>
            </div>
            <div className="w-full bg-surface-elevated rounded-full h-2">
              <div
                className="bg-secondary h-2 rounded-full transition-all"
                style={{ width: `${(score.breakdown.intentSignals / 20) * 100}%` }}
              />
            </div>
          </div>

          {/* Engagement */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[var(--color-text-secondary)]">Engagement</span>
              <span className="font-semibold">{score.breakdown.engagement}/10</span>
            </div>
            <div className="w-full bg-surface-elevated rounded-full h-2">
              <div
                className="bg-warning h-2 rounded-full transition-all"
                style={{ width: `${(score.breakdown.engagement / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Intent signals */}
      {score.detectedSignals.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            Intent Signals Detected ({score.detectedSignals.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {score.detectedSignals.map((signal, i) => (
              <div
                key={i}
                className="px-3 py-1 bg-secondary/10 border border-secondary/30 rounded-full text-xs"
                title={signal.description}
              >
                <span className="font-medium text-secondary">
                  {signal.type.replace(/_/g, ' ')}
                </span>
                <span className="text-secondary/80 ml-1">+{signal.points}pt</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top reasons */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Key Scoring Factors</h3>
        <div className="space-y-2">
          {score.reasons
            .filter((r) => r.impact === 'high' || r.points > 5)
            .slice(0, 5)
            .map((reason, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm p-2 bg-surface-elevated rounded"
              >
                <div
                  className={`mt-0.5 w-1.5 h-1.5 rounded-full ${
                    reason.points > 0 ? 'bg-success' : 'bg-error'
                  }`}
                />
                <div className="flex-1">
                  <div className="font-medium text-[var(--color-text-primary)]">{reason.factor}</div>
                  <div className="text-[var(--color-text-secondary)] text-xs">{reason.explanation}</div>
                </div>
                <div
                  className={`font-semibold ${
                    reason.points > 0 ? 'text-success' : 'text-error'
                  }`}
                >
                  {reason.points > 0 ? '+' : ''}
                  {reason.points}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
