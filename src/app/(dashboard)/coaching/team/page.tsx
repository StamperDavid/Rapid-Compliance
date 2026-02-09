/**
 * Team Coaching Dashboard Page
 * 
 * Manager view for team-wide coaching insights, skill gaps, and priorities
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TeamOverviewCard,
  SkillGapCard,
  TopPerformersCard,
  DevelopmentPlanCard,
} from '@/components/coaching/team';
import type {
  GenerateTeamCoachingResponse,
  TimePeriod,
  TeamCoachingInsights,
} from '@/lib/coaching/types';
import { useAuth } from '@/hooks/useAuth';

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
 * Team Coaching Dashboard Page Component
 */
export default function TeamCoachingDashboardPage() {
  const { user } = useAuth();

  // State
  const [period, setPeriod] = useState<TimePeriod>('last_30_days');
  const [teamInsights, setTeamInsights] = useState<TeamCoachingInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const currentTeamId = user?.id ? `team_${user.id}` : 'team_default';

  /**
   * Fetch team coaching insights
   */
  const fetchTeamCoachingInsights = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const requestBody = {
        teamId: currentTeamId,
        period,
        includeRepDetails: true,
      };

      const response = await fetch('/api/coaching/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const json = await response.json() as GenerateTeamCoachingResponse;

      if (!json.success) {
        throw new Error(json.error ?? 'Failed to generate team coaching insights');
      }

      setTeamInsights(json.teamInsights);
    } catch (err: unknown) {
      console.error('Failed to fetch team coaching insights:', err);
      const errorMessage = err instanceof Error && err.message ? err.message : 'Failed to load team coaching insights';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentTeamId, period]);

  /**
   * Load insights on mount and when period changes
   */
  useEffect(() => {
    void fetchTeamCoachingInsights();
  }, [fetchTeamCoachingInsights]);

  /**
   * Handle refresh
   */
  const handleRefresh = () => {
    void fetchTeamCoachingInsights(true);
  };

  /**
   * Handle period change
   */
  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setPeriod(newPeriod);
  };

  // Loading state
  if (loading && !teamInsights) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-main)] p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8 animate-pulse">
            <div className="h-8 bg-[var(--color-border-main)] rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-[var(--color-border-main)] rounded w-1/4"></div>
          </div>

          {/* Cards Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-[var(--color-bg-paper)] rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-[var(--color-border-main)] rounded w-1/3 mb-4"></div>
                <div className="h-48 bg-[var(--color-border-main)] rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !teamInsights) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-main)] p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[rgba(var(--color-error-rgb),0.1)] border border-[rgba(var(--color-error-rgb),0.2)] rounded-lg p-6">
            <div className="flex items-start gap-4">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-error)] mb-2">Error Loading Team Insights</h3>
                <p className="text-sm text-[var(--color-error-light)] mb-4">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-[var(--color-error)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-error-dark)] transition-colors text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)]">
      <div className="max-w-7xl mx-auto p-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Team Coaching</h1>
              <p className="text-[var(--color-text-secondary)]">
                {teamInsights ? teamInsights.teamName : 'Loading...'} · Manager Dashboard
              </p>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`px-4 py-2 bg-[var(--color-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors text-sm font-medium flex items-center gap-2 ${
                refreshing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {refreshing ? (
                <>
                  <span className="animate-spin">⟳</span>
                  <span>Refreshing...</span>
                </>
              ) : (
                <>
                  <span>↻</span>
                  <span>Refresh</span>
                </>
              )}
            </button>
          </div>

          {/* Time Period Selector */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {TIME_PERIODS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handlePeriodChange(value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  period === value
                    ? 'bg-[var(--color-primary)] text-[var(--color-text-primary)]'
                    : 'bg-[var(--color-bg-paper)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Team Insights */}
        {teamInsights && (
          <div className="space-y-6">
            {/* Row 1: Team Overview + Skill Gaps */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TeamOverviewCard
                summary={teamInsights.teamSummary}
                teamName={teamInsights.teamName}
                loading={loading}
              />
              <SkillGapCard
                skillGaps={teamInsights.skillGaps}
                totalReps={teamInsights.teamSummary.totalReps}
                loading={loading}
              />
            </div>

            {/* Row 2: Top Performers + Development Plan */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopPerformersCard
                topPerformers={teamInsights.topPerformers}
                loading={loading}
              />
              <DevelopmentPlanCard
                priorities={teamInsights.teamPriorities}
                atRiskReps={teamInsights.needsSupport}
                totalReps={teamInsights.teamSummary.totalReps}
                loading={loading}
              />
            </div>

            {/* Team Strengths & Weaknesses */}
            {(teamInsights.teamStrengths.length > 0 || teamInsights.teamWeaknesses.length > 0) && (
              <div className="bg-[var(--color-bg-paper)] rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Team Analysis</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Strengths */}
                  {teamInsights.teamStrengths.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-success)] mb-3 flex items-center gap-2">
                        <span>💪</span>
                        <span>Team Strengths</span>
                      </h4>
                      <div className="space-y-2">
                        {teamInsights.teamStrengths.map((strength, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-[var(--color-success)] mt-0.5">✓</span>
                            <span className="text-sm text-[var(--color-text-secondary)]">{strength}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Weaknesses */}
                  {teamInsights.teamWeaknesses.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-warning)] mb-3 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>Areas for Improvement</span>
                      </h4>
                      <div className="space-y-2">
                        {teamInsights.teamWeaknesses.map((weakness, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-[var(--color-warning)] mt-0.5">!</span>
                            <span className="text-sm text-[var(--color-text-secondary)]">{weakness}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Best Practices to Share */}
            {teamInsights.bestPracticesToShare.length > 0 && (
              <div className="bg-[var(--color-bg-paper)] rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Best Practices to Share</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  These practices from top performers can help the entire team improve
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teamInsights.bestPracticesToShare.map((practice, idx) => (
                    <div key={idx} className="border border-[var(--color-border-main)] rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{practice.title}</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mb-3">{practice.description}</p>
                      
                      {/* Top Performers */}
                      <div className="mb-3">
                        <div className="text-xs text-[var(--color-text-disabled)] mb-1">Top performers using this:</div>
                        <div className="flex flex-wrap gap-1">
                          {practice.topPerformers.map((performer, pIdx) => (
                            <span
                              key={pIdx}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-[var(--color-text-primary)]"
                            >
                              {performer}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Expected Impact */}
                      <div className="bg-[var(--color-primary)] rounded p-2">
                        <div className="text-xs text-[var(--color-primary)]">
                          <span className="font-semibold">Impact: </span>
                          {practice.expectedImpact}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Footer */}
            <div className="bg-[var(--color-bg-paper)] rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-disabled)]">
                <div>
                  Last updated: {new Date(teamInsights.generatedAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-4">
                  <span>Period: {teamInsights.period}</span>
                  <span>•</span>
                  <span>{teamInsights.teamSummary.totalReps} team members</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
