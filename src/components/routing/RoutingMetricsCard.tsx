/**
 * Routing Metrics Card Component
 * 
 * Displays key routing performance metrics
 */

'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import type { RoutingMetrics } from '@/lib/routing/types';

interface RoutingMetricsCardProps {
  metrics: RoutingMetrics;
  loading?: boolean;
}

export function RoutingMetricsCard({ metrics, loading }: RoutingMetricsCardProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Routing Performance</h3>
        <p className="text-sm text-gray-500">
          {formatPeriod(metrics.period.startDate, metrics.period.endDate)}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricBox
          label="Total Routed"
          value={metrics.volume.totalLeadsRouted}
          color="blue"
        />
        <MetricBox
          label="Success Rate"
          value={`${Math.round(metrics.efficiency.routingSuccessRate * 100)}%`}
          color="green"
        />
        <MetricBox
          label="Avg Match Score"
          value={Math.round(metrics.quality.averageMatchScore)}
          color="purple"
        />
        <MetricBox
          label="Conversion Rate"
          value={`${Math.round(metrics.quality.conversionRate * 100)}%`}
          color="orange"
        />
      </div>

      <div className="space-y-4">
        {/* Volume Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Volume Breakdown</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Automatic:</span>
              <span className="font-medium text-gray-900">{metrics.volume.automaticAssignments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Manual:</span>
              <span className="font-medium text-gray-900">{metrics.volume.manualAssignments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Reassignments:</span>
              <span className="font-medium text-gray-900">{metrics.volume.reassignments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Queued:</span>
              <span className="font-medium text-gray-900">{metrics.volume.queuedLeads}</span>
            </div>
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Efficiency</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Routing Time:</span>
              <span className="font-medium text-gray-900">{metrics.efficiency.averageRoutingTimeMs}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time to Accept:</span>
              <span className="font-medium text-gray-900">{formatHours(metrics.efficiency.averageTimeToAcceptance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time to Contact:</span>
              <span className="font-medium text-gray-900">{formatHours(metrics.efficiency.averageTimeToFirstContact)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Rejection Rate:</span>
              <span className="font-medium text-gray-900">{Math.round(metrics.quality.rejectionRate * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Strategy Performance */}
        {metrics.strategyPerformance.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Strategy Performance</h4>
            <div className="space-y-2">
              {metrics.strategyPerformance.map(strategy => (
                <div key={strategy.strategy} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 capitalize">
                    {strategy.strategy.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">{strategy.usageCount} uses</span>
                    <span className="font-medium text-green-600">
                      {Math.round(strategy.conversionRate * 100)}% conv
                    </span>
                    <span className="font-medium text-blue-600">
                      {Math.round(strategy.averageMatchScore)} score
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Performers */}
        {metrics.topPerformers.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Top Performers</h4>
            <div className="space-y-2">
              {metrics.topPerformers.slice(0, 5).map((performer, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </div>
                    <span className="font-medium text-gray-900">{performer.repName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 capitalize">{performer.metric.replace('_', ' ')}</span>
                    <span className="font-medium text-gray-900">{formatMetricValue(performer.value, performer.metric)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-75">{label}</div>
    </div>
  );
}

function formatPeriod(startDate: Date, endDate: Date): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function formatHours(hours: number): string {
  if (hours < 1) {return `${Math.round(hours * 60)}m`;}
  if (hours < 24) {return `${Math.round(hours)}h`;}
  return `${Math.round(hours / 24)}d`;
}

function formatMetricValue(value: number, metric: string): string {
  if (metric.includes('rate') || metric.includes('percentage')) {
    return `${Math.round(value * 100)}%`;
  }
  if (metric.includes('score')) {
    return Math.round(value).toString();
  }
  return value.toLocaleString();
}
