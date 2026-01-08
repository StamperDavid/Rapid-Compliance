/**
 * Coaching Dashboard Page
 * 
 * AI-powered coaching insights and recommendations for sales reps
 */

'use client';

import React, { useState, useEffect } from 'react';
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
  // State
  const [period, setPeriod] = useState<TimePeriod>('last_30_days');
  const [performance, setPerformance] = useState<RepPerformanceMetrics | null>(null);
  const [insights, setInsights] = useState<CoachingInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // TODO: Get from auth context
  const currentUserId = 'user_default';

  /**
   * Fetch coaching insights
   */
  const fetchCoachingInsights = async (showRefreshing = false) => {
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
      };

      const response = await fetch('/api/coaching/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const json: GenerateCoachingResponse = await response.json();

      if (!json.success) {
        throw new Error((json.error !== '' && json.error != null) ? json.error : 'Failed to generate coaching insights');
      }

      setPerformance(json.performance);
      setInsights(json.insights);
    } catch (err: any) {
      console.error('Failed to fetch coaching insights:', err);
      setError((err.message !== '' && err.message != null) ? err.message : 'Failed to load coaching insights');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Load insights on mount and when period changes
   */
  useEffect(() => {
    fetchCoachingInsights();
  }, [period]);

  /**
   * Handle refresh
   */
  const handleRefresh = () => {
    fetchCoachingInsights(true);
  };

  /**
   * Handle recommendation accept
   */
  const handleAcceptRecommendation = (recommendationId: string) => {
    console.log('Accept recommendation:', recommendationId);
    // TODO: Track acceptance in backend
  };

  /**
   * Handle recommendation dismiss
   */
  const handleDismissRecommendation = (recommendationId: string, reason?: string) => {
    console.log('Dismiss recommendation:', recommendationId, reason);
    // TODO: Track dismissal in backend
  };

  /**
   * Loading state
   */
  if (loading && !performance) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>

          {/* Cards Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-40 bg-gray-200 rounded"></div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-40 bg-gray-200 rounded"></div>
            </div>
          </div>

          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Coaching Insights</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => fetchCoachingInsights()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sales Coaching & Insights</h1>
              <p className="text-sm text-gray-500 mt-1">
                AI-powered performance analysis and personalized recommendations
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Period Selector */}
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as TimePeriod)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={refreshing}
              >
                {TIME_PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Top Row: Performance Score + Skills */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <PerformanceScoreCard performance={performance} loading={refreshing} />
          <div className="lg:col-span-2">
            <SkillsRadarCard skills={performance.skills} loading={refreshing} />
          </div>
        </div>

        {/* Performance Summary */}
        {insights.performanceSummary && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Summary</h3>
            <p className="text-gray-700 mb-4">{insights.performanceSummary.assessment}</p>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Trend:</span>
                <span className={`text-sm font-medium ${
                  insights.performanceSummary.trend === 'improving' ? 'text-green-600' :
                  insights.performanceSummary.trend === 'declining' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {insights.performanceSummary.trend === 'improving' && '↗ '}
                  {insights.performanceSummary.trend === 'declining' && '↘ '}
                  {insights.performanceSummary.trend === 'stable' && '→ '}
                  {insights.performanceSummary.trend.charAt(0).toUpperCase() + insights.performanceSummary.trend.slice(1)}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Focus Areas:</span>
                <div className="flex flex-wrap gap-2">
                  {insights.performanceSummary.focusAreas.map((area, idx) => (
                    <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
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
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Improvement Opportunities</h3>
            <div className="space-y-3">
              {insights.opportunities.map((opp, idx) => (
                <div key={idx} className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">{opp.title}</h4>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      opp.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      opp.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      opp.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {opp.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">{opp.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
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
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Risks</h3>
            <div className="space-y-3">
              {insights.risks.map((risk, idx) => (
                <div key={idx} className="border border-red-200 bg-red-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">{risk.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        risk.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        risk.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {risk.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-600">
                        {risk.likelihood.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{risk.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-500">
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
              <span className="font-semibold text-gray-900">
                {(insights.confidenceScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
