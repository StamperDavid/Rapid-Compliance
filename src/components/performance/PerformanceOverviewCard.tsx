/**
 * Performance Overview Card
 * 
 * Displays team-wide performance metrics and summary statistics.
 * Shows key metrics like average scores, sentiment, and conversation quality.
 * 
 * @module components/performance
 */

'use client';

import React from 'react';
import type { TeamMetrics } from '@/lib/performance';

interface PerformanceOverviewCardProps {
  metrics: TeamMetrics;
  loading?: boolean;
}

export function PerformanceOverviewCard({
  metrics,
  loading = false,
}: PerformanceOverviewCardProps) {
  if (loading) {
    return (
      <div className="bg-surface-main rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-surface-elevated rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-surface-elevated rounded"></div>
            <div className="h-4 bg-surface-elevated rounded w-5/6"></div>
            <div className="h-4 bg-surface-elevated rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatScore = (value: number) => value.toFixed(1);

  const getScoreColor = (score: number): string => {
    if (score >= 80) {return 'text-green-600';}
    if (score >= 70) {return 'text-yellow-600';}
    if (score >= 60) {return 'text-orange-600';}
    return 'text-red-600';
  };

  const getSentimentColor = (sentiment: number): string => {
    if (sentiment >= 0.5) {return 'text-green-600';}
    if (sentiment >= 0) {return 'text-yellow-600';}
    if (sentiment >= -0.5) {return 'text-orange-600';}
    return 'text-red-600';
  };

  const formatSentiment = (sentiment: number): string => {
    if (sentiment >= 0.5) {return 'Very Positive';}
    if (sentiment >= 0.2) {return 'Positive';}
    if (sentiment >= -0.2) {return 'Neutral';}
    if (sentiment >= -0.5) {return 'Negative';}
    return 'Very Negative';
  };

  return (
    <div className="bg-surface-main rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-light">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Team Performance Overview</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {metrics.totalConversations} conversations across the team
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Overall Score */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Overall Team Score</span>
            <span className={`text-2xl font-bold ${getScoreColor(metrics.avgOverallScore)}`}>
              {formatScore(metrics.avgOverallScore)}
            </span>
          </div>
          <div className="w-full bg-surface-elevated rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${metrics.avgOverallScore}%` }}
            ></div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="space-y-3 mb-6">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Skill Scores</h4>
          
          {[
            { label: 'Discovery', value: metrics.avgDiscoveryScore },
            { label: 'Value Articulation', value: metrics.avgValueArticulationScore },
            { label: 'Objection Handling', value: metrics.avgObjectionHandlingScore },
            { label: 'Closing', value: metrics.avgClosingScore },
            { label: 'Rapport', value: metrics.avgRapportScore },
            { label: 'Engagement', value: metrics.avgEngagementScore },
          ].map((skill) => (
            <div key={skill.label} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{skill.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-surface-elevated rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${skill.value}%` }}
                  ></div>
                </div>
                <span className={`text-sm font-medium ${getScoreColor(skill.value)} w-10 text-right`}>
                  {formatScore(skill.value)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Sentiment Analysis */}
        <div className="mb-6 p-4 bg-surface-elevated rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Team Sentiment</span>
            <span className={`text-sm font-semibold ${getSentimentColor(metrics.avgSentiment)}`}>
              {formatSentiment(metrics.avgSentiment)}
            </span>
          </div>
          
          {/* Sentiment Distribution */}
          <div className="flex h-2 rounded-full overflow-hidden">
            <div
              className="bg-green-500"
              style={{ width: `${metrics.sentimentDistribution.veryPositive}%` }}
              title={`Very Positive: ${formatPercentage(metrics.sentimentDistribution.veryPositive)}`}
            ></div>
            <div
              className="bg-green-400"
              style={{ width: `${metrics.sentimentDistribution.positive}%` }}
              title={`Positive: ${formatPercentage(metrics.sentimentDistribution.positive)}`}
            ></div>
            <div
              className="bg-gray-300"
              style={{ width: `${metrics.sentimentDistribution.neutral}%` }}
              title={`Neutral: ${formatPercentage(metrics.sentimentDistribution.neutral)}`}
            ></div>
            <div
              className="bg-orange-400"
              style={{ width: `${metrics.sentimentDistribution.negative}%` }}
              title={`Negative: ${formatPercentage(metrics.sentimentDistribution.negative)}`}
            ></div>
            <div
              className="bg-red-500"
              style={{ width: `${metrics.sentimentDistribution.veryNegative}%` }}
              title={`Very Negative: ${formatPercentage(metrics.sentimentDistribution.veryNegative)}`}
            ></div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <MetricBox
            label="Ideal Talk Ratio"
            value={formatPercentage(metrics.idealTalkRatioPercentage)}
            description="Conversations with optimal ratio"
            color={metrics.idealTalkRatioPercentage >= 70 ? 'green' : metrics.idealTalkRatioPercentage >= 50 ? 'yellow' : 'red'}
          />
          
          <MetricBox
            label="Quality Score"
            value={formatScore(metrics.avgQualityScore)}
            description="Average conversation quality"
            color={metrics.avgQualityScore >= 80 ? 'green' : metrics.avgQualityScore >= 70 ? 'yellow' : 'red'}
          />
          
          <MetricBox
            label="Objection Handling"
            value={formatPercentage(metrics.objectionHandlingRate)}
            description="Objections addressed well"
            color={metrics.objectionHandlingRate >= 80 ? 'green' : metrics.objectionHandlingRate >= 60 ? 'yellow' : 'red'}
          />
          
          <MetricBox
            label="Topic Coverage"
            value={formatScore(metrics.topicCoverageScore)}
            description="Key topics discussed"
            color={metrics.topicCoverageScore >= 80 ? 'green' : metrics.topicCoverageScore >= 70 ? 'yellow' : 'red'}
          />
        </div>

        {/* Stats */}
        <div className="mt-6 pt-6 border-t border-border-light">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {formatScore(metrics.avgConversationsPerRep)}
              </div>
              <div className="text-xs text-[var(--color-text-disabled)]">Conversations/Rep</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {formatScore(metrics.avgCoachingInsights)}
              </div>
              <div className="text-xs text-[var(--color-text-disabled)]">Avg Coaching Insights</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {formatScore(metrics.avgFollowUpActions)}
              </div>
              <div className="text-xs text-[var(--color-text-disabled)]">Avg Follow-up Actions</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricBoxProps {
  label: string;
  value: string;
  description: string;
  color: 'green' | 'yellow' | 'red';
}

function MetricBox({ label, value, description, color }: MetricBoxProps) {
  const colorClasses = {
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    red: 'text-red-600 bg-red-50',
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <div className="text-xs font-medium mb-1">{label}</div>
      <div className={`text-xl font-bold ${color === 'green' ? 'text-green-700' : color === 'yellow' ? 'text-yellow-700' : 'text-red-700'}`}>
        {value}
      </div>
      <div className="text-xs opacity-75 mt-1">{description}</div>
    </div>
  );
}
