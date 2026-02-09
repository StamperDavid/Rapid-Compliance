/**
 * Deal Score Card Component
 * 
 * Displays deal score with:
 * - Score gauge (0-100)
 * - Tier badge (hot/warm/cold/at-risk)
 * - Close probability
 * - Scoring factors breakdown
 * - Risk factors
 * - Recommendations
 */

'use client';

import { ErrorBoundary, InlineErrorFallback } from '@/components/common/ErrorBoundary';
import type { DealScore, ScoringFactor, RiskFactor } from '@/lib/templates';

interface DealScoreCardProps {
  dealId: string;
  dealName: string;
  score: DealScore;
  showDetails?: boolean;
}

function DealScoreCardInner({
  dealId,
  dealName,
  score,
  showDetails = true
}: DealScoreCardProps) {
  // Tier colors
  const tierColors = {
    hot: 'from-green-500 to-emerald-600',
    warm: 'from-yellow-500 to-orange-500',
    cold: 'from-blue-500 to-cyan-500',
    'at-risk': 'from-red-500 to-rose-600'
  };

  const _tierTextColors = {
    hot: 'text-green-400',
    warm: 'text-yellow-400',
    cold: 'text-blue-400',
    'at-risk': 'text-red-400'
  };

  const tierBgColors = {
    hot: 'bg-green-500/20',
    warm: 'bg-yellow-500/20',
    cold: 'bg-blue-500/20',
    'at-risk': 'bg-red-500/20'
  };

  const severityColors = {
    critical: 'bg-red-500/20 text-red-400 border-red-500',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500'
  };

  return (
    <div className="bg-surface-paper border border-border-light rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-r ${tierColors[score.tier]} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white">{dealName}</h3>
            <p className="text-white/80 text-sm">Deal ID: {dealId}</p>
          </div>
          <div className={`px-4 py-2 rounded-full ${tierBgColors[score.tier]} border-2 border-white/30`}>
            <span className="text-white font-bold uppercase tracking-wide">
              {score.tier}
            </span>
          </div>
        </div>

        {/* Score Gauge */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="8"
                fill="none"
              />
              {/* Score circle */}
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="white"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${score.score * 3.52} 352`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-white">{score.score}</div>
                <div className="text-xs text-white/80">SCORE</div>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <div className="text-white/80 text-sm mb-1">Close Probability</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white h-2 rounded-full transition-all"
                    style={{ width: `${score.closeProbability}%` }}
                  />
                </div>
                <span className="text-white font-bold text-lg">
                  {score.closeProbability}%
                </span>
              </div>
            </div>
            
            <div>
              <div className="text-white/80 text-sm mb-1">Confidence</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white h-2 rounded-full transition-all"
                    style={{ width: `${score.confidence}%` }}
                  />
                </div>
                <span className="text-white font-bold text-lg">
                  {score.confidence}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="p-6 space-y-6">
          {/* Scoring Factors */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span>📊</span> Scoring Factors
            </h4>
            <div className="space-y-2">
              {score.factors.map((factor: ScoringFactor) => (
                <div key={factor.id} className="bg-surface-elevated rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{factor.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${
                        factor.impact === 'positive' ? 'text-success' :
                        factor.impact === 'negative' ? 'text-error' :
                        'text-[var(--color-text-secondary)]'
                      }`}>
                        {factor.score}/100
                      </span>
                      <span className="text-[var(--color-text-secondary)] text-sm">
                        ({Math.round(factor.weight * 100)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 bg-surface-paper rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        factor.impact === 'positive' ? 'bg-success' :
                        factor.impact === 'negative' ? 'bg-error' :
                        'bg-[var(--color-text-secondary)]'
                      }`}
                      style={{ width: `${factor.score}%` }}
                    />
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">{factor.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Factors */}
          {score.riskFactors.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span>⚠️</span> Risk Factors
              </h4>
              <div className="space-y-2">
                {score.riskFactors.map((risk: RiskFactor) => (
                  <div
                    key={risk.id}
                    className={`border rounded-lg p-3 ${severityColors[risk.severity]}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold uppercase text-xs">
                            {risk.severity}
                          </span>
                          <span className="text-xs opacity-75">
                            {risk.category}
                          </span>
                        </div>
                        <p className="font-medium">{risk.description}</p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-current opacity-50">
                      <p className="text-xs">
                        <strong>Mitigation:</strong> {risk.mitigation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {score.recommendations.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span>💡</span> Recommendations
              </h4>
              <div className="space-y-2">
                {score.recommendations.map((rec, index) => (
                  <div key={index} className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                    <p className="text-[var(--color-text-secondary)] text-sm flex items-start gap-2">
                      <span className="text-primary font-bold">{index + 1}.</span>
                      {rec}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Predictions */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-light">
            <div>
              <div className="text-[var(--color-text-secondary)] text-sm mb-1">Predicted Close Date</div>
              <div className="text-white font-semibold">
                {score.predictedCloseDate
                  ? new Date(score.predictedCloseDate).toLocaleDateString()
                  : 'Unknown'}
              </div>
            </div>
            <div>
              <div className="text-[var(--color-text-secondary)] text-sm mb-1">Predicted Value</div>
              <div className="text-white font-semibold">
                ${score.predictedValue?.toLocaleString() || '0'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export with error boundary
export default function DealScoreCard(props: DealScoreCardProps) {
  return (
    <ErrorBoundary
      componentName="DealScoreCard"
      fallback={<InlineErrorFallback message="Failed to load deal score" />}
    >
      <DealScoreCardInner {...props} />
    </ErrorBoundary>
  );
}
