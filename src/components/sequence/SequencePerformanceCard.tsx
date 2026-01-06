/**
 * Sequence Performance Card Component
 * 
 * Displays detailed performance metrics for each email sequence step.
 * 
 * @module components/sequence/SequencePerformanceCard
 */

'use client';

import React from 'react';
import type { SequenceAnalysis } from '@/lib/sequence';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Mail, MousePointerClick, MessageSquare, TrendingUp } from 'lucide-react';

interface SequencePerformanceCardProps {
  analysis: SequenceAnalysis;
}

export function SequencePerformanceCard({ analysis }: SequencePerformanceCardProps) {
  const { metrics } = analysis;
  
  // Prepare chart data
  const chartData = metrics.flatMap(seq => 
    seq.stepMetrics.map(step => ({
      name: `${seq.sequenceName} - Step ${step.stepNumber}`,
      sequence: seq.sequenceName,
      step: step.stepNumber,
      openRate: step.openRate,
      clickRate: step.clickRate,
      replyRate: step.replyRate,
    }))
  );
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Sequence Performance</h2>
        <p className="text-sm text-gray-600 mt-1">
          Step-by-step engagement metrics
        </p>
      </div>
      
      {/* Performance Chart */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45} 
              textAnchor="end" 
              height={100}
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip />
            <Legend />
            <Bar dataKey="openRate" fill="#3b82f6" name="Open Rate" />
            <Bar dataKey="clickRate" fill="#10b981" name="Click Rate" />
            <Bar dataKey="replyRate" fill="#8b5cf6" name="Reply Rate" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Sequence Details */}
      <div className="space-y-4">
        {metrics.map((seq, index) => (
          <SequenceDetails key={index} metrics={seq} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface SequenceDetailsProps {
  metrics: SequenceAnalysis['metrics'][0];
}

function SequenceDetails({ metrics }: SequenceDetailsProps) {
  const [expanded, setExpanded] = React.useState(false);
  
  return (
    <div className="border rounded-lg p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center space-x-3">
          <Mail className="w-5 h-5 text-gray-500" />
          <div className="text-left">
            <div className="font-medium text-gray-900">{metrics.sequenceName}</div>
            <div className="text-sm text-gray-600">
              {metrics.totalRecipients} recipients • {metrics.stepMetrics.length} steps
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <MetricBadge 
            icon={Mail}
            value={`${metrics.overallOpenRate.toFixed(1)}%`}
            label="Open"
          />
          <MetricBadge 
            icon={MousePointerClick}
            value={`${metrics.overallClickRate.toFixed(1)}%`}
            label="Click"
          />
          <MetricBadge 
            icon={MessageSquare}
            value={`${metrics.overallReplyRate.toFixed(1)}%`}
            label="Reply"
          />
          <TrendingUp className={`w-4 h-4 ${expanded ? 'rotate-180' : ''} transition-transform`} />
        </div>
      </button>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.stepMetrics.map((step, index) => (
              <StepMetric key={index} step={step} />
            ))}
          </div>
          
          {/* Conversion Metrics */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Conversion Metrics</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {metrics.conversationStarted}
                </div>
                <div className="text-xs text-gray-600 mt-1">Conversations</div>
                <div className="text-xs text-gray-500">
                  {metrics.conversationRate.toFixed(1)}% rate
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {metrics.meetingBooked}
                </div>
                <div className="text-xs text-gray-600 mt-1">Meetings</div>
                <div className="text-xs text-gray-500">
                  {metrics.meetingRate.toFixed(1)}% rate
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {metrics.opportunityCreated}
                </div>
                <div className="text-xs text-gray-600 mt-1">Opportunities</div>
                <div className="text-xs text-gray-500">
                  {metrics.opportunityRate.toFixed(1)}% rate
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricBadgeProps {
  icon: React.ElementType;
  value: string;
  label: string;
}

function MetricBadge({ icon: Icon, value, label }: MetricBadgeProps) {
  return (
    <div className="flex items-center space-x-1">
      <Icon className="w-3 h-3 text-gray-400" />
      <div className="text-xs">
        <span className="font-medium text-gray-900">{value}</span>
        <span className="text-gray-500 ml-1">{label}</span>
      </div>
    </div>
  );
}

interface StepMetricProps {
  step: SequenceAnalysis['metrics'][0]['stepMetrics'][0];
}

function StepMetric({ step }: StepMetricProps) {
  return (
    <div className="bg-gray-50 rounded p-3">
      <div className="text-xs font-medium text-gray-500 mb-2">
        Step {step.stepNumber} • {step.stepType.replace('_', ' ')}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-600">Sent:</span>
          <span className="font-medium">{step.sent}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-600">Delivered:</span>
          <span className="font-medium">{step.deliveryRate.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-600">Opened:</span>
          <span className="font-medium text-blue-600">{step.openRate.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-600">Clicked:</span>
          <span className="font-medium text-green-600">{step.clickRate.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-600">Replied:</span>
          <span className="font-medium text-purple-600">{step.replyRate.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
