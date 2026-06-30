'use client';

import React from 'react';
import type {
  DomainAnalysisResult,
  SeoPriority,
  SeoImpact,
  SeoEffort,
} from '@/types/seo-analysis';
import {
  Globe,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  Flag,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface CompetitorAnalysisCardProps {
  result: DomainAnalysisResult;
  domain: string;
  analyzedAt: string | null;
  onEnrich: () => void;
  onRerun: () => void;
  isEnriching: boolean;
}

function getScoreBadgeColor(score: number): string {
  if (score >= 70) { return 'bg-green-500/20 text-green-400 border-green-500/30'; }
  if (score >= 40) { return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'; }
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

const PRIORITY_COLORS: Record<SeoPriority, string> = {
  high: 'bg-red-500/20 text-red-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-green-500/20 text-green-400',
};

const IMPACT_COLORS: Record<SeoImpact, string> = {
  high: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-surface-elevated text-[var(--color-text-secondary)]',
};

const EFFORT_COLORS: Record<SeoEffort, string> = {
  low: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-red-500/20 text-red-400',
};

export default function CompetitorAnalysisCard({
  result,
  domain,
  analyzedAt,
  onEnrich,
  onRerun,
  isEnriching,
}: CompetitorAnalysisCardProps) {
  const actionRequired = result.summary.trimStart().startsWith('[ACTION REQUIRED]');
  const summaryText = actionRequired
    ? result.summary.replace(/^\s*\[ACTION REQUIRED\]\s*/, '')
    : result.summary;

  return (
    <div className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{domain}</h3>
            {analyzedAt && (
              <p className="text-xs text-[var(--color-text-disabled)]">
                Analyzed {new Date(analyzedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold ${getScoreBadgeColor(result.technicalHealth.score)}`}>
          <Gauge className="w-4 h-4" />
          {result.technicalHealth.score}/100
        </div>
      </div>

      {/* Action Required banner */}
      {actionRequired && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-400">
            Action required — critical issues found that need immediate attention.
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-xl bg-surface-elevated border border-border-light p-4">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Summary</h4>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">{summaryText}</p>
      </div>

      {/* Technical Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {result.technicalHealth.issues.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Technical Issues
            </h4>
            <ul className="space-y-2">
              {result.technicalHealth.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.technicalHealth.strengths.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" /> Technical Strengths
            </h4>
            <ul className="space-y-2">
              {result.technicalHealth.strengths.map((strength, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Content Gaps */}
      {result.contentGaps.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" /> Content Gaps
          </h4>
          <div className="space-y-2">
            {result.contentGaps.map((gap, i) => (
              <div key={i} className="rounded-xl bg-surface-elevated border border-border-light p-3">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{gap.topic}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${PRIORITY_COLORS[gap.priority]}`}>
                    {gap.priority} priority
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{gap.opportunity}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-indigo-400" /> Recommendations
          </h4>
          <div className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <div key={i} className="rounded-xl bg-surface-elevated border border-border-light p-3">
                <p className="text-sm text-[var(--color-text-primary)] mb-2">{rec.action}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${IMPACT_COLORS[rec.impact]}`}>
                    {rec.impact} impact
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${EFFORT_COLORS[rec.effort]}`}>
                    {rec.effort} effort
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-paper border border-border-light text-[var(--color-text-disabled)]">
                    {rec.timeframe}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitive Position */}
      {result.competitivePosition && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Flag className="w-4 h-4 text-purple-400" /> Competitive Position
          </h4>
          <div className="rounded-xl bg-surface-elevated border border-border-light p-4">
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">{result.competitivePosition}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onEnrich}
          disabled={isEnriching}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-semibold transition-all"
        >
          <Sparkles className="w-4 h-4" />
          {isEnriching ? 'Analyzing...' : 'Deeper analysis (more content gaps)'}
        </button>
        <button
          onClick={onRerun}
          disabled={isEnriching}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border-light hover:bg-surface-elevated text-[var(--color-text-secondary)] text-sm font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Re-run
        </button>
      </div>
    </div>
  );
}
