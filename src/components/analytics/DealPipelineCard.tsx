/**
 * Deal Pipeline Card Component
 * 
 * Displays deal pipeline metrics with visualizations
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
import type { DealOverviewMetrics } from '@/lib/analytics/dashboard/types';

interface DealPipelineCardProps {
  data: DealOverviewMetrics;
  loading?: boolean;
}

const TIER_COLORS: Record<string, string> = {
  hot: 'var(--color-error)',
  warm: 'var(--color-warning)',
  cold: 'var(--color-info)',
  'at-risk': 'var(--color-secondary)',
};

/**
 * Deal Pipeline Card Component
 */
export function DealPipelineCard({ data, loading = false }: DealPipelineCardProps) {
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
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Deal Pipeline</h3>
        <p className="text-sm text-gray-500">Active deals and pipeline health</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <MetricCard label="Active Deals" value={data.totalActiveDeals} trend={data.dealsTrend} />
        <MetricCard label="Pipeline Value" value={formatCurrency(data.totalValue)} trend={null} />
        <MetricCard label="Avg Deal Size" value={formatCurrency(data.averageValue)} trend={null} />
        <MetricCard
          label="Hot Deals"
          value={data.hotDeals}
          trend={null}
          valueColor="text-red-600"
        />
        <MetricCard
          label="At-Risk"
          value={data.atRiskDeals}
          trend={null}
          valueColor="text-purple-600"
        />
      </div>

      {/* Pipeline by Stage */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Pipeline by Stage</h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.byStage} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
            <XAxis type="number" stroke="var(--color-text-disabled)" fontSize={12} />
            <YAxis
              type="category"
              dataKey="stage"
              stroke="var(--color-text-disabled)"
              fontSize={12}
              width={120}
              tickFormatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'count') {return [value, 'Deals'];}
                if (name === 'value') {return [formatCurrency(value), 'Value'];}
                return [value, name];
              }}
              labelFormatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}
            />
            <Bar dataKey="count" fill="var(--color-info)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Deal Tiers */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Deals by Tier</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.byTier.map((tier) => (
            <div key={tier.tier} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: TIER_COLORS[tier.tier] || 'var(--color-text-disabled)' }}
                ></div>
                <span className="text-sm font-medium text-gray-700 capitalize">{tier.tier}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{tier.count}</div>
              <div className="text-xs text-gray-500">{formatCurrency(tier.value)}</div>
              <div className="text-xs text-gray-600 mt-1">
                Avg Score: {tier.averageScore.toFixed(0)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Average Velocity */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Average Deal Velocity</span>
          <span className="text-lg font-semibold text-gray-900">
            {data.averageVelocity.toFixed(0)} days
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
