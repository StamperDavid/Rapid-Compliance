'use client';

import React, { useState } from 'react';
import type { ThirtyDayStrategy, DomainAnalysisResult } from '@/types/seo-analysis';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Sparkles, Loader2, Calendar, Target, TrendingUp } from 'lucide-react';
import { logger } from '@/lib/logger/logger';

interface StrategyGeneratorProps {
  competitorDomain: string;
  competitorResult: DomainAnalysisResult;
}

const EFFORT_COLORS: Record<string, string> = {
  low: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-red-500/20 text-red-400',
};

const TASK_TYPE_COLORS: Record<string, string> = {
  technical: 'bg-blue-500/20 text-blue-400',
  content: 'bg-purple-500/20 text-purple-400',
  outreach: 'bg-orange-500/20 text-orange-400',
  analysis: 'bg-cyan-500/20 text-cyan-400',
};

export default function StrategyGenerator({
  competitorDomain,
  competitorResult,
}: StrategyGeneratorProps) {
  const authFetch = useAuthFetch();
  const [strategy, setStrategy] = useState<ThirtyDayStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateStrategy = async () => {
    setLoading(true);
    setError(null);

    try {
      const currentRankings = competitorResult.topKeywords.slice(0, 10).map(kw => ({
        keyword: kw.keyword,
        position: kw.position,
      }));

      const response = await authFetch('/api/seo/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: competitorDomain,
          currentRankings,
          businessGoals: [
            `Outrank ${competitorDomain} on top keywords`,
            'Increase organic traffic by 30%',
            'Build domain authority',
          ],
        }),
      });

      const data = await response.json() as { success: boolean; data?: ThirtyDayStrategy; error?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to generate strategy');
      }

      setStrategy(data.data ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Strategy generation failed';
      setError(message);
      logger.warn('Strategy generation failed', { error: message });
    } finally {
      setLoading(false);
    }
  };

  if (!strategy) {
    return (
      <div className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto">
          <Calendar className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">30-Day SEO Strategy</h3>
          <p className="text-sm text-[var(--color-text-disabled)] mt-1">
            Generate a week-by-week action plan to outrank {competitorDomain}
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        <button
          onClick={() => void generateStrategy()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-white font-semibold transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Strategy...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Plan
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">30-Day SEO Strategy</h3>
            <p className="text-xs text-[var(--color-text-disabled)]">
              Generated {new Date(strategy.generatedDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <button
          onClick={() => void generateStrategy()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-light hover:bg-surface-elevated text-[var(--color-text-secondary)] text-xs transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Regenerate
        </button>
      </div>

      {/* Expected Results */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-surface-elevated border border-border-light p-3 text-center">
          <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
          <div className="text-sm font-bold text-[var(--color-text-primary)]">{strategy.expectedResults.trafficIncrease}</div>
          <div className="text-xs text-[var(--color-text-disabled)]">Traffic Increase</div>
        </div>
        <div className="rounded-xl bg-surface-elevated border border-border-light p-3 text-center">
          <Target className="w-4 h-4 text-blue-400 mx-auto mb-1" />
          <div className="text-sm font-bold text-[var(--color-text-primary)]">{strategy.expectedResults.rankingImprovements}</div>
          <div className="text-xs text-[var(--color-text-disabled)]">Rankings Improved</div>
        </div>
        <div className="rounded-xl bg-surface-elevated border border-border-light p-3 text-center">
          <Sparkles className="w-4 h-4 text-purple-400 mx-auto mb-1" />
          <div className="text-sm font-bold text-[var(--color-text-primary)]">{strategy.expectedResults.technicalScore}</div>
          <div className="text-xs text-[var(--color-text-disabled)]">Technical Score</div>
        </div>
      </div>

      {/* Weekly Plan */}
      {strategy.weeks.map((week) => (
        <div key={week.weekNumber} className="space-y-3">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold">
              {week.weekNumber}
            </span>
            Week {week.weekNumber}: {week.theme}
          </h4>
          <div className="space-y-2 ml-8">
            {week.tasks.map((task, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-surface-elevated border border-border-light p-3">
                <div className="flex-shrink-0 text-xs text-[var(--color-text-disabled)] w-8">D{task.day}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text-primary)]">{task.task}</p>
                  <p className="text-xs text-[var(--color-text-disabled)] mt-1">{task.expectedOutcome}</p>
                </div>
                <div className="flex-shrink-0 flex gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TASK_TYPE_COLORS[task.taskType] ?? ''}`}>
                    {task.taskType}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${EFFORT_COLORS[task.effort] ?? ''}`}>
                    {task.effort}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
