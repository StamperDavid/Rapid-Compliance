/**
 * Analytics Dashboard Page
 * 
 * Enterprise-grade analytics dashboard showing comprehensive metrics
 * across all platform features
 */

'use client';

import React, { useState, useEffect } from 'react';
import { WorkflowMetricsCard } from '@/components/analytics/WorkflowMetricsCard';
import { EmailMetricsCard } from '@/components/analytics/EmailMetricsCard';
import { DealPipelineCard } from '@/components/analytics/DealPipelineCard';
import { RevenueMetricsCard } from '@/components/analytics/RevenueMetricsCard';
import { TeamPerformanceCard } from '@/components/analytics/TeamPerformanceCard';
import type {
  DashboardOverview,
  TimePeriod,
  AnalyticsResponse,
  AnalyticsErrorResponse,
} from '@/lib/analytics/dashboard/types';

/**
 * Time period options
 */
const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
];

/**
 * Analytics Dashboard Page Component
 */
export default function AnalyticsDashboardPage() {
  // State
  const [period, setPeriod] = useState<TimePeriod>('30d');
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // TODO: Get from auth context
  const organizationId = 'org_default';
  const workspaceId = 'workspace_default';

  /**
   * Fetch analytics data
   */
  const fetchAnalytics = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams({
        organizationId,
        workspaceId,
        period,
      });

      const response = await fetch(`/api/analytics/dashboard?${params}`);
      const json: AnalyticsResponse | AnalyticsErrorResponse = await response.json();

      if (!json.success) {
        throw new Error((json as AnalyticsErrorResponse).error);
      }

      setData((json).data);
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError((err.message !== '' && err.message != null) ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Load analytics on mount and when period changes
   */
  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  /**
   * Handle refresh
   */
  const handleRefresh = () => {
    fetchAnalytics(true);
  };

  /**
   * Loading state
   */
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>

          {/* Cards Skeleton */}
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
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
  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Analytics</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => fetchAnalytics()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Comprehensive insights across all platform features
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
        <div className="space-y-6">
          {/* Workflow Metrics */}
          <WorkflowMetricsCard data={data.workflows} loading={refreshing} />

          {/* Email Metrics */}
          <EmailMetricsCard data={data.emails} loading={refreshing} />

          {/* Deal Pipeline */}
          <DealPipelineCard data={data.deals} loading={refreshing} />

          {/* Revenue Metrics */}
          <RevenueMetricsCard data={data.revenue} loading={refreshing} />

          {/* Team Performance */}
          <TeamPerformanceCard data={data.team} loading={refreshing} />
        </div>

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
            <div>
              Period: {data.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
              {data.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
