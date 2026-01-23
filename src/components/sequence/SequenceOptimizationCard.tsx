/**
 * Sequence Optimization Card Component
 * 
 * Displays AI-generated optimization recommendations with actionable steps.
 * 
 * @module components/sequence/SequenceOptimizationCard
 */

'use client';

import React from 'react';
import type { SequenceAnalysis, OptimizationRecommendation } from '@/lib/sequence';
import { Zap, Clock, Target, CheckCircle, ArrowRight } from 'lucide-react';

interface SequenceOptimizationCardProps {
  analysis: SequenceAnalysis;
}

export function SequenceOptimizationCard({ analysis }: SequenceOptimizationCardProps) {
  const { optimizations } = analysis;
  
  if (!optimizations || optimizations.total === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Optimization Recommendations</h2>
          <p className="text-sm text-gray-600 mt-1">
            AI-powered sequence improvements
          </p>
        </div>
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <p className="text-gray-500">No optimizations needed. Sequences performing well!</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Optimization Recommendations</h2>
        <p className="text-sm text-gray-600 mt-1">
          {optimizations.total} recommendation{optimizations.total !== 1 ? 's' : ''} • 
          {' '}{optimizations.critical + optimizations.high} high priority
        </p>
      </div>
      
      {/* Priority Summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="text-center p-3 bg-red-50 rounded">
          <div className="text-2xl font-bold text-red-600">{optimizations.critical}</div>
          <div className="text-xs text-gray-600 mt-1">Critical</div>
        </div>
        <div className="text-center p-3 bg-orange-50 rounded">
          <div className="text-2xl font-bold text-orange-600">{optimizations.high}</div>
          <div className="text-xs text-gray-600 mt-1">High</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 rounded">
          <div className="text-2xl font-bold text-yellow-600">{optimizations.medium}</div>
          <div className="text-xs text-gray-600 mt-1">Medium</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded">
          <div className="text-2xl font-bold text-gray-600">{optimizations.low}</div>
          <div className="text-xs text-gray-600 mt-1">Low</div>
        </div>
      </div>
      
      {/* Quick Wins */}
      {optimizations.quickWins.length > 0 && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center space-x-2 mb-3">
            <Zap className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-900">Quick Wins</h3>
            <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs rounded">
              {optimizations.quickWins.length}
            </span>
          </div>
          <p className="text-sm text-green-800 mb-3">
            Low effort, high impact optimizations you can implement today
          </p>
          <div className="space-y-2">
            {optimizations.quickWins.map((rec, index) => (
              <QuickWinItem key={index} recommendation={rec} />
            ))}
          </div>
        </div>
      )}
      
      {/* Top Priority */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Top Priority</h3>
        {optimizations.topPriority.map((rec, index) => (
          <OptimizationCard key={index} recommendation={rec} />
        ))}
      </div>
      
      {/* All Recommendations Link */}
      {optimizations.total > optimizations.topPriority.length && (
        <div className="mt-4 pt-4 border-t text-center">
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all {optimizations.total} recommendations →
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface QuickWinItemProps {
  recommendation: OptimizationRecommendation;
}

function QuickWinItem({ recommendation }: QuickWinItemProps) {
  return (
    <div className="flex items-start justify-between p-3 bg-white rounded border border-green-100">
      <div className="flex-1">
        <div className="font-medium text-gray-900 text-sm">{recommendation.title}</div>
        <div className="text-xs text-gray-600 mt-1">{recommendation.solution}</div>
      </div>
      <div className="ml-3 text-right">
        <div className="text-xs font-medium text-green-600">
          +{recommendation.expectedLift.toFixed(1)}% lift
        </div>
      </div>
    </div>
  );
}

interface OptimizationCardProps {
  recommendation: OptimizationRecommendation;
}

function OptimizationCard({ recommendation }: OptimizationCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  
  const priorityColors = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-700',
  };
  
  const areaIcons: Record<string, React.ElementType> = {
    timing: Clock,
    subject_lines: Target,
    content: Target,
    call_to_action: Target,
    sequence_length: Target,
    step_delays: Clock,
    personalization: Target,
    targeting: Target,
  };
  
  const Icon = areaIcons[recommendation.area] || Target;
  
  return (
    <div className="border rounded-lg p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <Icon className="w-5 h-5 text-gray-500 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${priorityColors[recommendation.priority]}`}>
                  {recommendation.priority}
                </span>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                  {recommendation.area.replace('_', ' ')}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900">{recommendation.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{recommendation.description}</p>
            </div>
          </div>
          <ArrowRight className={`w-4 h-4 ml-4 ${expanded ? 'rotate-90' : ''} transition-transform`} />
        </div>
        
        <div className="grid grid-cols-3 gap-3 mt-3 ml-8">
          <MetricChange
            label="Current"
            value={recommendation.currentMetric.value}
            unit={recommendation.currentMetric.unit}
          />
          <MetricChange
            label="Projected"
            value={recommendation.projectedMetric.value}
            unit={recommendation.projectedMetric.unit}
            positive
          />
          <MetricChange
            label="Expected Lift"
            value={recommendation.expectedLift}
            unit="%"
            positive
          />
        </div>
      </button>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t ml-8">
          {/* Issue & Solution */}
          <div className="space-y-3 mb-4">
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-1">Issue</h5>
              <p className="text-sm text-gray-600">{recommendation.issue}</p>
            </div>
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-1">Solution</h5>
              <p className="text-sm text-gray-600">{recommendation.solution}</p>
            </div>
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-1">Rationale</h5>
              <p className="text-sm text-gray-600">{recommendation.rationale}</p>
            </div>
          </div>
          
          {/* Action Items */}
          <div className="mb-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Implementation Steps</h5>
            <div className="space-y-2">
              {recommendation.actionItems.map((item, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
                    {item.step}
                  </span>
                  <div className="flex-1">
                    <div className="text-gray-900">{item.action}</div>
                    {item.details && (
                      <div className="text-xs text-gray-500 mt-0.5">{item.details}</div>
                    )}
                    {item.estimatedTime && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        ~{item.estimatedTime} minutes
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Effort & Impact */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-xs text-gray-600 mb-1">Effort</div>
              <div className={`text-sm font-medium ${
                recommendation.estimatedEffort === 'low' ? 'text-green-600' :
                recommendation.estimatedEffort === 'medium' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {recommendation.estimatedEffort}
              </div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-xs text-gray-600 mb-1">Impact</div>
              <div className={`text-sm font-medium ${
                recommendation.estimatedImpact === 'high' ? 'text-green-600' :
                recommendation.estimatedImpact === 'medium' ? 'text-yellow-600' : 'text-gray-600'
              }`}>
                {recommendation.estimatedImpact}
              </div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-xs text-gray-600 mb-1">Confidence</div>
              <div className={`text-sm font-medium ${
                recommendation.confidence === 'high' ? 'text-green-600' :
                recommendation.confidence === 'medium' ? 'text-yellow-600' : 'text-gray-600'
              }`}>
                {recommendation.confidence}
              </div>
            </div>
          </div>
          
          {/* A/B Test Suggestion */}
          {recommendation.suggestedTest && (
            <div className="bg-purple-50 rounded p-3">
              <h5 className="text-sm font-medium text-purple-900 mb-2">
                Suggested A/B Test
              </h5>
              <div className="space-y-1 text-xs text-purple-800">
                <div><strong>Control:</strong> {recommendation.suggestedTest.control}</div>
                <div><strong>Variant:</strong> {recommendation.suggestedTest.variant}</div>
                <div><strong>Success Metric:</strong> {recommendation.suggestedTest.successMetric}</div>
                <div><strong>Sample Size:</strong> {recommendation.suggestedTest.minimumSampleSize} per variant</div>
                <div><strong>Duration:</strong> {recommendation.suggestedTest.expectedDuration} days</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MetricChangeProps {
  label: string;
  value: number;
  unit: string;
  positive?: boolean;
}

function MetricChange({ label, value, unit, positive }: MetricChangeProps) {
  return (
    <div className="text-center p-2 bg-gray-50 rounded">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className={`text-sm font-bold ${positive ? 'text-green-600' : 'text-gray-900'}`}>
        {positive && value > 0 ? '+' : ''}{value}{unit}
      </div>
    </div>
  );
}
