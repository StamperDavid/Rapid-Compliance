/**
 * Revenue Metrics Card Component
 * 
 * Displays revenue and forecasting metrics
 */

'use client';

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { RevenueOverviewMetrics } from '@/lib/analytics/dashboard/types';

interface RevenueMetricsCardProps {
  data: RevenueOverviewMetrics;
  loading?: boolean;
}

/**
 * Revenue Metrics Card Component
 */
export function RevenueMetricsCard({ data, loading = false }: RevenueMetricsCardProps) {
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

  // Forecast data for chart
  const forecastData = [
    { scenario: 'Pessimistic', value: data.forecastPessimistic },
    { scenario: 'Realistic', value: data.forecastRealistic },
    { scenario: 'Optimistic', value: data.forecastOptimistic },
    { scenario: 'Quota', value: data.quota },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Revenue & Forecasting</h3>
        <p className="text-sm text-gray-500">Revenue performance and predictions</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Revenue"
          value={formatCurrency(data.totalRevenue)}
          trend={data.revenueTrend}
        />
        <MetricCard
          label="Quota"
          value={formatCurrency(data.quota)}
          trend={null}
        />
        <MetricCard
          label="Attainment"
          value={`${data.quotaAttainment.toFixed(1)}%`}
          trend={null}
          valueColor={
            data.quotaAttainment >= 100
              ? 'text-green-600'
              : data.quotaAttainment >= 75
              ? 'text-yellow-600'
              : 'text-red-600'
          }
        />
        <MetricCard
          label="Win Rate"
          value={`${data.winRate.toFixed(1)}%`}
          trend={null}
        />
      </div>

      {/* Quota Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">Quota Progress</span>
          <span className="font-medium text-gray-900">{data.quotaAttainment.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              data.quotaAttainment >= 100
                ? 'bg-green-500'
                : data.quotaAttainment >= 75
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(data.quotaAttainment, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Revenue Trend</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.revenueByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={(date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              labelFormatter={(date: string) => new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              formatter={(value: number) => [formatCurrency(value), 'Revenue']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Forecast Scenarios */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Revenue Forecast</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="scenario" stroke="#6b7280" fontSize={12} />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {forecastData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.scenario === 'Quota'
                      ? '#6b7280'
                      : entry.scenario === 'Optimistic'
                      ? '#10b981'
                      : entry.scenario === 'Realistic'
                      ? '#3b82f6'
                      : '#ef4444'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
        <div>
          <div className="text-sm text-gray-600 mb-1">Average Deal Size</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(data.averageDealSize)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600 mb-1">Realistic Forecast</div>
          <div className="text-xl font-bold text-blue-600">{formatCurrency(data.forecastRealistic)}</div>
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
  value: string;
  trend: number | null;
  valueColor?: string;
}

function MetricCard({ label, value, trend, valueColor = 'text-gray-900' }: MetricCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${valueColor}`}>{value}</div>
      {trend !== null && (
        <div className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
