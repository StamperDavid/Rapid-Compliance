/**
 * Coaching Dashboard Page
 *
 * AI-powered coaching insights and recommendations for sales reps
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PerformanceScoreCard,
  CoachingRecommendationsCard,
  StrengthsWeaknessesCard,
  SkillsRadarCard,
} from '@/components/coaching';
import type {
  GenerateCoachingResponse,
  TimePeriod,
  RepPerformanceMetrics,
  CoachingInsights,
} from '@/lib/coaching/types';
import {
  COACHING_MODELS,
  DEFAULT_COACHING_MODEL,
} from '@/lib/coaching/coaching-models';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import Link from 'next/link';
import { PageTitle } from '@/components/ui/typography';

type CoachingViewMode = 'human' | 'ai';

/**
 * Time period options
 */
const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
];

/**
 * Coaching Dashboard Page Component
 */
export default function CoachingDashboardPage() {
  const { user } = useAuth();
  const authFetch = useAuthFetch();

  // View mode: human reps vs AI agents
  const [viewMode, setViewMode] = useState<CoachingViewMode>('human');

  // State
  const [period, setPeriod] = useState<TimePeriod>('last_30_days');
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_COACHING_MODEL);
  const [performance, setPerformance] = useState<RepPerformanceMetrics | null>(null);
  const [insights, setInsights] = useState<CoachingInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const prefsLoaded = useRef(false);

  const currentUserId = user?.id ?? null;

  // Load saved model preference on mount
  useEffect(() => {
    if (prefsLoaded.current) {
      return;
    }
    prefsLoaded.current = true;
    void (async () => {
      try {
        const res = await authFetch('/api/coaching/preferences');
        const data = await res.json() as { success: boolean; selectedModel?: string };
        if (data.success && data.selectedModel) {
          setSelectedModel(data.selectedModel);
        }
      } catch {
        // Use default — non-critical
      }
    })();
  }, [authFetch]);

  /**
   * Fetch coaching insights
   */
  const fetchCoachingInsights = useCallback(async (showRefreshing = false) => {
    // Guard: don't fire until we have a real Firebase UID (not a placeholder)
    if (!currentUserId || currentUserId.length < 10 || currentUserId === 'user_default') {
      setError('You must be signed in to view coaching insights.');
      setLoading(false);
      return;
    }

    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const requestBody = {
        repId: currentUserId,
        period,
        includeDetailed: true,
        includeTraining: true,
        includeActionItems: true,
        modelOverride: selectedModel,
      };

      const response = await authFetch('/api/coaching/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const json = await response.json() as GenerateCoachingResponse;

      if (!json.success) {
        throw new Error(json.error ?? 'Failed to generate coaching insights');
      }

      setPerformance(json.performance);
      setInsights(json.insights);
    } catch (err: unknown) {
      logger.error('Failed to fetch coaching insights', err instanceof Error ? err : new Error(String(err)));
      const errorMessage = err instanceof Error && err.message ? err.message : 'Failed to load coaching insights';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId, period, selectedModel, authFetch]);

  /**
   * Load insights on mount and when period changes
   */
  useEffect(() => {
    void fetchCoachingInsights();
  }, [fetchCoachingInsights]);

  /**
   * Handle refresh
   */
  const handleRefresh = () => {
    void fetchCoachingInsights(true);
  };

  const handleModelChange = (newModel: string) => {
    setSelectedModel(newModel);
    // Persist preference (fire-and-forget)
    void authFetch('/api/coaching/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedModel: newModel }),
    });
  };

  /**
   * Handle recommendation accept
   */
  const handleAcceptRecommendation = (recommendationId: string) => {
    // Tracking: best-effort analytics (endpoint not yet available)
    void recommendationId;
  };

  /**
   * Handle recommendation dismiss
   */
  const handleDismissRecommendation = (recommendationId: string, reason?: string) => {
    // Tracking: best-effort analytics (endpoint not yet available)
    void recommendationId;
    void reason;
  };

  /**
   * Loading state
   */
  if (loading && !performance) {
    return (
      <div className="p-6">
        <div>
          {/* Header Skeleton */}
          <div className="mb-8 animate-pulse">
            <div className="h-8 bg-border rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-border rounded w-1/2"></div>
          </div>

          {/* Cards Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-card rounded-lg shadow-sm p-6 animate-pulse">
              <div className="h-6 bg-border rounded w-1/2 mb-4"></div>
              <div className="h-40 bg-border rounded"></div>
            </div>
            <div className="lg:col-span-2 bg-card rounded-lg shadow-sm p-6 animate-pulse">
              <div className="h-6 bg-border rounded w-1/2 mb-4"></div>
              <div className="h-40 bg-border rounded"></div>
            </div>
          </div>

          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-border rounded w-1/4 mb-4"></div>
                <div className="h-32 bg-border rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /**
   * Error state
   */
  if (error && !performance) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="bg-card rounded-lg shadow-sm p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Failed to Load Coaching Insights</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => void fetchCoachingInsights()}
              className="px-6 py-2 bg-[var(--color-primary)] text-foreground rounded-lg hover:bg-[var(--color-primary-dark)] transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!performance || !insights) {
    return null;
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <PageTitle>Coaching &amp; Insights</PageTitle>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered performance analysis and personalized recommendations
          </p>
              {/* Human / AI Agent Toggle */}
              <div className="flex gap-1 mt-2 bg-surface-main rounded-lg p-0.5 w-fit">
                <button
                  onClick={() => setViewMode('human')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    viewMode === 'human'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Human Reps
                </button>
                <button
                  onClick={() => setViewMode('ai')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    viewMode === 'ai'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  AI Agents
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Period Selector */}
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as TimePeriod)}
                className="px-4 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                disabled={refreshing}
              >
                {TIME_PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>

              {/* Model Selector */}
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                disabled={refreshing}
              >
                {Object.entries(COACHING_MODELS).map(([id, info]) => (
                  <option key={id} value={id}>
                    {info.name} ({info.costTier})
                  </option>
                ))}
              </select>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-[var(--color-primary)] text-foreground rounded-lg hover:bg-[var(--color-primary-dark)] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {refreshing ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Refresh
                  </>
                )}
              </button>
            </div>
      </div>

      {/* AI Agents View */}
      {viewMode === 'ai' && (
        <AIAgentsCoachingView authFetch={authFetch} />
      )}

      {/* Human Rep Main Content */}
      {viewMode === 'human' && (
      <div>
        {/* Top Row: Performance Score + Skills */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <PerformanceScoreCard performance={performance} loading={refreshing} />
          <div className="lg:col-span-2">
            <SkillsRadarCard skills={performance.skills} loading={refreshing} />
          </div>
        </div>

        {/* Performance Summary */}
        {insights.performanceSummary && (
          <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-3">Performance Summary</h3>
            <p className="text-muted-foreground mb-4">{insights.performanceSummary.assessment}</p>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Trend:</span>
                <span className={`text-sm font-medium ${
                  insights.performanceSummary.trend === 'improving' ? 'text-[var(--color-success)]' :
                  insights.performanceSummary.trend === 'declining' ? 'text-[var(--color-error)]' :
                  'text-muted-foreground'
                }`}>
                  {insights.performanceSummary.trend === 'improving' && '↗ '}
                  {insights.performanceSummary.trend === 'declining' && '↘ '}
                  {insights.performanceSummary.trend === 'stable' && '→ '}
                  {insights.performanceSummary.trend.charAt(0).toUpperCase() + insights.performanceSummary.trend.slice(1)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Focus Areas:</span>
                <div className="flex flex-wrap gap-2">
                  {insights.performanceSummary.focusAreas.map((area, idx) => (
                    <span key={idx} className="text-xs bg-primary/70 text-foreground px-2 py-1 rounded">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Strengths & Weaknesses */}
        <div className="mb-6">
          <StrengthsWeaknessesCard
            strengths={insights.strengths}
            weaknesses={insights.weaknesses}
            loading={refreshing}
          />
        </div>

        {/* Coaching Recommendations */}
        <div className="mb-6">
          <CoachingRecommendationsCard
            recommendations={insights.recommendations}
            loading={refreshing}
            onAccept={handleAcceptRecommendation}
            onDismiss={handleDismissRecommendation}
          />
        </div>

        {/* Opportunities */}
        {insights.opportunities.length > 0 && (
          <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Improvement Opportunities</h3>
            <div className="space-y-3">
              {insights.opportunities.map((opp, idx) => (
                <div key={idx} className="border border-border-light rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-foreground">{opp.title}</h4>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      opp.priority === 'critical' ? 'text-foreground' :
                      opp.priority === 'high' ? 'text-foreground' :
                      opp.priority === 'medium' ? 'text-foreground' :
                      'text-foreground'
                    }`}>
                      {opp.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{opp.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Difficulty: {opp.difficulty}</span>
                    <span>•</span>
                    <span>Impact: {opp.timeToImpact.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risks */}
        {insights.risks.length > 0 && (
          <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Performance Risks</h3>
            <div className="space-y-3">
              {insights.risks.map((risk, idx) => (
                <div key={idx} className="border border-border-light rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-foreground">{risk.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        risk.severity === 'critical' ? 'text-foreground' :
                        risk.severity === 'high' ? 'text-foreground' :
                        'text-foreground'
                      }`}>
                        {risk.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {risk.likelihood.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{risk.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Last updated: {new Date().toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
            <div className="flex items-center gap-2">
              <span>AI Confidence:</span>
              <span className="font-semibold text-foreground">
                {(insights.confidenceScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// ============================================================================
// AI AGENTS COACHING VIEW — Summary + Link to Training Center
// ============================================================================

function AIAgentsCoachingView({ authFetch }: { authFetch: (url: string, options?: RequestInit) => Promise<Response> }) {
  const [agentCount, setAgentCount] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await authFetch('/api/agent-performance');
        const data = await res.json() as {
          success: boolean;
          agents?: Array<{ flaggedSessionCount: number }>;
          totalFlagged?: number;
        };
        if (data.success && data.agents) {
          setAgentCount(data.agents.length);
          setFlaggedCount(data.totalFlagged ?? 0);
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg shadow-sm p-4">
          <p className="text-sm text-muted-foreground">AI Agent Profiles</p>
          <p className="text-2xl font-bold text-foreground mt-1">{agentCount}</p>
        </div>
        <div className="bg-card rounded-lg shadow-sm p-4">
          <p className="text-sm text-muted-foreground">Flagged Sessions</p>
          <p className="text-2xl font-bold text-foreground mt-1">{flaggedCount}</p>
          {flaggedCount > 0 && (
            <p className="text-xs text-[var(--color-warning)] mt-1">Needs review</p>
          )}
        </div>
        <div className="bg-card rounded-lg shadow-sm p-4">
          <p className="text-sm text-muted-foreground">Quick Links</p>
          <div className="flex flex-col gap-1 mt-2">
            <Link href="/workforce/performance" className="text-xs text-[var(--color-primary)] hover:underline">Swarm Performance</Link>
          </div>
        </div>
      </div>

      {/* CTA: Open Training Center */}
      <div className="bg-card rounded-lg shadow-sm p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          AI Agent Training Center
        </h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          View performance insights, review coaching recommendations, approve improvement requests, and train your agents — all in one place.
        </p>
        <Link
          href="/settings/ai-agents/training"
          className="inline-block px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 font-semibold text-sm transition"
        >
          Open Training Center
        </Link>
      </div>
    </div>
  );
}
