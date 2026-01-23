/**
 * Workflow Metrics Card Component
 * 
 * Displays workflow automation performance metrics with charts
 */

'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { WorkflowOverviewMetrics, ActionTypeMetrics as _ActionTypeMetrics } from '@/lib/analytics/dashboard/types';

interface PieChartData extends Record<string, unknown> {
  actionType: string;
  count: number;
  percentage: number;
  successRate: number;
  averageTime: number;
}

interface WorkflowMetricsCardProps {
  data: WorkflowOverviewMetrics;
  loading?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

/**
 * Workflow Metrics Card Component
 */
export function WorkflowMetricsCard({ data, loading = false }: WorkflowMetricsCardProps) {
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
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Workflow Automation</h3>
        <p className="text-sm text-gray-500">Performance metrics for automated workflows</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Active Workflows"
          value={data.totalActiveWorkflows}
          trend={null}
        />
        <MetricCard
          label="Executions"
          value={data.totalExecutions}
          trend={data.executionsTrend}
        />
        <MetricCard
          label="Success Rate"
          value={`${data.successRate.toFixed(1)}%`}
          trend={null}
          valueColor={data.successRate >= 95 ? 'text-green-600' : data.successRate >= 80 ? 'text-yellow-600' : 'text-red-600'}
        />
        <MetricCard
          label="Avg Time"
          value={`${(data.averageExecutionTime / 1000).toFixed(1)}s`}
          trend={null}
        />
      </div>

      {/* Executions Trend Chart */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Execution Trend</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.executionsByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={(date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              labelFormatter={(date: string) => new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              formatter={(value: number) => [value, 'Executions']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Action Breakdown */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Action Type Distribution</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pie Chart */}
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.actionBreakdown.slice(0, 5) as PieChartData[]}
                dataKey="count"
                nameKey="actionType"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={(entry: unknown) => {
                  const chartData = entry as PieChartData;
                  return `${chartData.actionType}: ${chartData.percentage.toFixed(0)}%`;
                }}
                labelLine={false}
              >
                {data.actionBreakdown.slice(0, 5).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [value, 'Count']} />
            </PieChart>
          </ResponsiveContainer>

          {/* Action List */}
          <div className="space-y-2">
            {data.actionBreakdown.slice(0, 5).map((action, index) => (
              <div key={action.actionType} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="text-gray-700 capitalize">{action.actionType.replace(/_/g, ' ')}</span>
                </div>
                <div className="text-gray-500">
                  {action.count} ({action.percentage.toFixed(0)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Workflows */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Top Workflows</h4>
        <div className="space-y-3">
          {data.topWorkflows.slice(0, 5).map((workflow) => (
            <div key={workflow.workflowId} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-sm font-medium text-gray-900">{workflow.name}</h5>
                <span className="text-xs text-gray-500">{workflow.executions} executions</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <span>Success: {workflow.successRate.toFixed(1)}%</span>
                <span>Avg: {(workflow.averageTime / 1000).toFixed(1)}s</span>
                <span className="text-green-600 font-medium">⏱️ Saved: {workflow.timeSaved.toFixed(1)}h</span>
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
