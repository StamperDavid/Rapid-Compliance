/**
 * Email Metrics Card Component
 * 
 * Displays email writer performance metrics with charts
 */

'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { EmailOverviewMetrics } from '@/lib/analytics/dashboard/types';

interface EmailMetricsCardProps {
  data: EmailOverviewMetrics;
  loading?: boolean;
}

/**
 * Email Metrics Card Component
 */
export function EmailMetricsCard({ data, loading = false }: EmailMetricsCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">AI Email Writer</h3>
        <p className="text-sm text-gray-500">Email generation and usage analytics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Generated"
          value={data.totalGenerated}
          trend={data.generationTrend}
        />
        <MetricCard
          label="Sent"
          value={data.totalSent}
          trend={null}
        />
        <MetricCard
          label="Send Rate"
          value={`${data.totalGenerated > 0 ? ((data.totalSent / data.totalGenerated) * 100).toFixed(1) : 0}%`}
          trend={null}
        />
        <MetricCard
          label="Avg Time"
          value={`${(data.averageGenerationTime / 1000).toFixed(1)}s`}
          trend={null}
        />
      </div>

      {/* Generation Trend Chart */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Generation Trend</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.emailsByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
            <XAxis
              dataKey="date"
              tickFormatter={(date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              stroke="var(--color-text-disabled)"
              fontSize={12}
            />
            <YAxis stroke="var(--color-text-disabled)" fontSize={12} />
            <Tooltip
              labelFormatter={(date: string) => new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              formatter={(value: number) => [value, 'Emails']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-success)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Email Type Distribution */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Email Types</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.byType}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
            <XAxis
              dataKey="type"
              stroke="var(--color-text-disabled)"
              fontSize={12}
              tickFormatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}
            />
            <YAxis stroke="var(--color-text-disabled)" fontSize={12} />
            <Tooltip
              formatter={(value: number) => [value, 'Count']}
              labelFormatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}
            />
            <Bar dataKey="count" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Deal Tier Distribution */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">By Deal Tier</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.byTier.map((tier) => (
            <div key={tier.tier} className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1 capitalize">{tier.tier}</div>
              <div className="text-xl font-bold text-gray-900">{tier.count}</div>
              <div className="text-xs text-gray-600 mt-1">{tier.percentage.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Most Used Type Badge */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Most Used Type:</span>
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium capitalize">
            {data.mostUsedType}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Metric Card Component
 */
interface MetricCardProps {
  label: string;
  value: string | number;
  trend: number | null;
}

function MetricCard({ label, value, trend }: MetricCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {trend !== null && (
        <div className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
