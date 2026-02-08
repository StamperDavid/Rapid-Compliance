/**
 * Performance Analytics Dashboard
 * 
 * Team-wide performance analytics dashboard showing metrics,
 * benchmarks, top performers, and trends.
 * 
 * @module app/dashboard/performance
 */

'use client';

import React, { useState, useEffect } from 'react';
import { PerformanceOverviewCard } from '@/components/performance/PerformanceOverviewCard';
import { BenchmarksCard } from '@/components/performance/BenchmarksCard';
import { TopPerformersCard } from '@/components/performance/TopPerformersCard';
import { TrendsCard } from '@/components/performance/TrendsCard';
import type { TeamPerformanceAnalytics } from '@/lib/performance';

export default function PerformanceDashboardPage() {
  const [analytics, setAnalytics] = useState<TeamPerformanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  // Load performance analytics
  useEffect(() => {
    void loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/performance/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          periodType: selectedPeriod,
          includeTrends: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error((errorData.message !== '' && errorData.message != null) ? errorData.message : 'Failed to load analytics');
      }

      const data = await response.json() as { data: TeamPerformanceAnalytics };
      setAnalytics(data.data);
    } catch (err) {
      console.error('Failed to load performance analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    void loadAnalytics();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Performance Analytics</h1>
              <p className="text-sm text-gray-500 mt-1">
                Team-wide conversation performance and benchmarking
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Period Selector */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                {(['week', 'month', 'quarter'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      selectedPeriod === period
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className={`-ml-1 mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-400 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading analytics</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="mt-2 text-sm font-medium text-red-600 hover:text-red-500"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceOverviewCard
                metrics={null as unknown as TeamPerformanceAnalytics['teamMetrics']}
                loading={true}
              />
              <BenchmarksCard
                benchmarks={null as unknown as TeamPerformanceAnalytics['benchmarks']}
                individualMetrics={[]}
                loading={true}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopPerformersCard
                topPerformers={[]}
                loading={true}
              />
              <TrendsCard
                trendAnalysis={null as unknown as TeamPerformanceAnalytics['trendAnalysis']}
                loading={true}
              />
            </div>
          </div>
        )}

        {/* Analytics Content */}
        {!loading && analytics && (
          <>
            {/* Period Info */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-blue-400 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    Analyzing <strong>{analytics.conversationsAnalyzed} conversations</strong> from{' '}
                    <strong>{analytics.repsIncluded} reps</strong> over the past{' '}
                    <strong>{selectedPeriod}</strong>
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Generated {new Date(analytics.generatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Grid */}
            <div className="space-y-6">
              {/* Row 1: Overview and Benchmarks */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PerformanceOverviewCard
                  metrics={analytics.teamMetrics}
                  loading={false}
                />
                <BenchmarksCard
                  benchmarks={analytics.benchmarks}
                  individualMetrics={analytics.individualMetrics}
                  loading={false}
                />
              </div>

              {/* Row 2: Top Performers and Trends */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TopPerformersCard
                  topPerformers={analytics.topPerformers}
                  loading={false}
                />
                <TrendsCard
                  trendAnalysis={analytics.trendAnalysis}
                  loading={false}
                />
              </div>

              {/* Improvement Opportunities */}
              {analytics.improvementOpportunities.length > 0 && (
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Improvement Opportunities</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Reps who would benefit most from coaching
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {analytics.improvementOpportunities.slice(0, 5).map((opportunity) => (
                        <div key={opportunity.repId} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">{opportunity.repName}</h4>
                            <span className="text-sm text-gray-600">
                              Current: <span className="font-semibold">{opportunity.currentScore.toFixed(1)}</span>
                              {' → '}
                              Target: <span className="font-semibold text-green-600">{opportunity.targetScore.toFixed(1)}</span>
                            </span>
                          </div>
                          <div className="space-y-1">
                            {opportunity.recommendedActions.slice(0, 3).map((action, idx) => (
                              <p key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                                {action}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Coaching Priorities */}
              {analytics.coachingPriorities.length > 0 && (
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Team Coaching Priorities</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Focus areas that would benefit the most reps
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analytics.coachingPriorities.map((priority) => (
                        <div key={priority.category} className="p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">
                              {priority.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              priority.priority === 'critical' ? 'bg-red-100 text-red-800' :
                              priority.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              priority.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {priority.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{priority.recommendation}</p>
                          <p className="text-xs text-gray-600">
                            Affects {priority.repsAffected} reps · {priority.estimatedROI} ROI
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && !analytics && !error && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Available</h3>
            <p className="text-sm text-gray-500 mb-6">
              Complete some conversation analyses to see performance analytics
            </p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Check Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
