/**
 * Team Performance Card Component
 * 
 * Displays team and individual rep performance metrics
 */

'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TeamOverviewMetrics } from '@/lib/analytics/dashboard/types';

interface TeamPerformanceCardProps {
  data: TeamOverviewMetrics;
  loading?: boolean;
}

/**
 * Team Performance Card Component
 */
export function TeamPerformanceCard({ data, loading = false }: TeamPerformanceCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: value >= 1000000 ? 'compact' : 'standard',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Team Performance</h3>
        <p className="text-sm text-gray-500">Sales team metrics and leaderboard</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Team Size" value={data.totalReps} trend={null} />
        <MetricCard
          label="Avg Deals/Rep"
          value={data.averageDealsPerRep.toFixed(1)}
          trend={null}
        />
        <MetricCard
          label="Avg Quota"
          value={`${data.averageQuotaAttainment.toFixed(1)}%`}
          trend={null}
          valueColor={
            data.averageQuotaAttainment >= 100
              ? 'text-green-600'
              : data.averageQuotaAttainment >= 75
              ? 'text-yellow-600'
              : 'text-red-600'
          }
        />
        <MetricCard
          label="Team Velocity"
          value={`${data.teamVelocity.toFixed(0)} days`}
          trend={null}
        />
      </div>

      {/* Top Performers Chart */}
      {data.topPerformers.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Revenue by Rep</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.topPerformers}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="repName"
                stroke="#6b7280"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Performers Leaderboard */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Leaderboard</h4>
        <div className="space-y-2">
          {data.topPerformers.map((rep, index) => (
            <div
              key={rep.repId}
              className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              {/* Rank */}
              <div
                className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                  index === 0
                    ? 'bg-yellow-100 text-yellow-700'
                    : index === 1
                    ? 'bg-gray-200 text-gray-700'
                    : index === 2
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {index + 1}
              </div>

              {/* Rep Name */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {rep.repName}
                </div>
                <div className="text-xs text-gray-500">{rep.deals} deals</div>
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(rep.revenue)}
                  </div>
                  <div className="text-xs text-gray-500">Revenue</div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-semibold ${
                      rep.quotaAttainment >= 100
                        ? 'text-green-600'
                        : rep.quotaAttainment >= 75
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {rep.quotaAttainment.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-500">Quota</div>
                </div>

                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {rep.winRate.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-500">Win Rate</div>
                </div>

                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(rep.averageDealSize)}
                  </div>
                  <div className="text-xs text-gray-500">Avg Deal</div>
                </div>
              </div>
            </div>
          ))}
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
  valueColor?: string;
}

function MetricCard({ label, value, trend, valueColor = 'text-gray-900' }: MetricCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
      {trend !== null && (
        <div className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
