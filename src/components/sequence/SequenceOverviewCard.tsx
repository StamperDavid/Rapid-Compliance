/**
 * Sequence Overview Card Component
 * 
 * Displays high-level sequence performance metrics and summary insights.
 * 
 * @module components/sequence/SequenceOverviewCard
 */

'use client';

import React from 'react';
import type { SequenceAnalysis } from '@/lib/sequence';
import { TrendingUp, TrendingDown, Mail, Users, Calendar, Target } from 'lucide-react';

interface SequenceOverviewCardProps {
  analysis: SequenceAnalysis;
}

export function SequenceOverviewCard({ analysis }: SequenceOverviewCardProps) {
  const { summary, metrics: _metrics, patterns, optimizations } = analysis;
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Sequence Overview</h2>
        <p className="text-sm text-gray-600 mt-1">
          Analysis of {summary.totalSequences} email sequence{summary.totalSequences !== 1 ? 's' : ''}
        </p>
      </div>
      
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          icon={Mail}
          label="Total Emails"
          value={summary.totalEmails.toLocaleString()}
          trend={null}
        />
        <MetricCard
          icon={Users}
          label="Total Recipients"
          value={summary.totalRecipients.toLocaleString()}
          trend={null}
        />
        <MetricCard
          icon={Target}
          label="Avg Reply Rate"
          value={`${summary.avgReplyRate.toFixed(1)}%`}
          trend={summary.avgReplyRate >= 8 ? 'up' : 'down'}
          trendLabel={summary.avgReplyRate >= 8 ? 'Above target' : 'Below target'}
        />
        <MetricCard
          icon={Calendar}
          label="Avg Meeting Rate"
          value={`${summary.avgMeetingRate.toFixed(1)}%`}
          trend={summary.avgMeetingRate >= 5 ? 'up' : 'down'}
          trendLabel={summary.avgMeetingRate >= 5 ? 'Above target' : 'Below target'}
        />
      </div>
      
      {/* Performance Summary */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h3>
        <div className="space-y-3">
          <SummaryItem
            label="Top Performing Sequence"
            value={summary.topPerformingSequence.name}
            metric={`${summary.topPerformingSequence.replyRate.toFixed(1)}% reply rate`}
            positive
          />
          <SummaryItem
            label="Lowest Performing Sequence"
            value={summary.lowestPerformingSequence.name}
            metric={`${summary.lowestPerformingSequence.replyRate.toFixed(1)}% reply rate`}
            positive={false}
          />
          {patterns && patterns.total > 0 && (
            <SummaryItem
              label="High-Performing Patterns"
              value={`${patterns.highConfidence} high confidence patterns found`}
              metric={`${patterns.total} total patterns`}
              positive
            />
          )}
          {optimizations && optimizations.total > 0 && (
            <SummaryItem
              label="Optimization Opportunities"
              value={`${optimizations.critical + optimizations.high} priority recommendations`}
              metric={`${optimizations.total} total recommendations`}
              positive={false}
            />
          )}
        </div>
      </div>
      
      {/* AI Insights */}
      {analysis.aiInsights && (
        <div className="border-t mt-6 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Insights</h3>
          
          {analysis.aiInsights.keyFindings.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Key Findings</h4>
              <ul className="space-y-1">
                {analysis.aiInsights.keyFindings.map((finding, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    {finding}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {analysis.aiInsights.concerns.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Concerns</h4>
              <ul className="space-y-1">
                {analysis.aiInsights.concerns.map((concern, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start">
                    <span className="text-yellow-500 mr-2">⚠</span>
                    {concern}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {analysis.aiInsights.opportunities.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Opportunities</h4>
              <ul className="space-y-1">
                {analysis.aiInsights.opportunities.map((opp, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start">
                    <span className="text-blue-500 mr-2">→</span>
                    {opp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  trend?: 'up' | 'down' | null;
  trendLabel?: string;
}

function MetricCard({ icon: Icon, label, value, trend, trendLabel }: MetricCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5 text-gray-500" />
        {trend && (
          <div className={`flex items-center text-xs ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            {trendLabel}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-600 mt-1">{label}</div>
    </div>
  );
}

interface SummaryItemProps {
  label: string;
  value: string;
  metric: string;
  positive: boolean;
}

function SummaryItem({ label, value, metric, positive }: SummaryItemProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        <div className="text-sm text-gray-900 mt-1">{value}</div>
      </div>
      <div className={`text-xs px-2 py-1 rounded ${positive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
        {metric}
      </div>
    </div>
  );
}
