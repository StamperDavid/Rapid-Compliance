/**
 * Interventions Card Component
 * 
 * Displays AI-generated intervention recommendations to mitigate risk
 */

'use client';

import React, { useState } from 'react';
import type { Intervention } from '@/lib/risk/types';

interface InterventionsCardProps {
  interventions: Intervention[];
  loading?: boolean;
  onStartIntervention?: (interventionId: string) => void;
}

/**
 * Interventions Card Component
 */
export function InterventionsCard({ 
  interventions, 
  loading = false,
  onStartIntervention 
}: InterventionsCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Get priority icon
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '📋';
      case 'low':
        return '💡';
      default:
        return '📝';
    }
  };

  // Get intervention type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'executive_engagement':
        return '👔';
      case 'accelerate_timeline':
        return '⚡';
      case 'address_competition':
        return '⚔️';
      case 'demonstrate_value':
        return '✨';
      case 'stakeholder_mapping':
        return '👥';
      case 'budget_justification':
        return '💰';
      case 'risk_mitigation':
        return '🛡️';
      case 'relationship_building':
        return '🤝';
      case 'multi_threading':
        return '🔗';
      case 'negotiate_terms':
        return '📝';
      default:
        return '🎯';
    }
  };

  // Get ROI color
  const getROIColor = (score: number) => {
    if (score >= 15) return 'text-green-600';
    if (score >= 10) return 'text-blue-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-gray-600';
  };

  // Sort interventions by ROI score
  const sortedInterventions = [...interventions].sort((a, b) => b.roiScore - a.roiScore);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          AI-Recommended Interventions
        </h3>
        <p className="text-sm text-gray-500">
          {interventions.length} action{interventions.length !== 1 ? 's' : ''} to reduce risk
        </p>
      </div>

      {/* Interventions List */}
      <div className="space-y-4">
        {sortedInterventions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-sm">No interventions needed - deal is healthy</p>
          </div>
        ) : (
          sortedInterventions.map((intervention, index) => {
            const isExpanded = expandedId === intervention.id;
            
            return (
              <div
                key={intervention.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Header - Always Visible */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : intervention.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    {/* Title and Priority */}
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="text-2xl mr-2">{getTypeIcon(intervention.type)}</span>
                        <h4 className="text-base font-semibold text-gray-900">
                          {intervention.title}
                        </h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(intervention.priority)}`}>
                          {getPriorityIcon(intervention.priority)} {intervention.priority.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          Due in {intervention.deadlineDays} days
                        </span>
                      </div>
                    </div>

                    {/* Expand/Collapse Icon */}
                    <button className="text-gray-400 hover:text-gray-600 ml-4">
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center bg-gray-50 rounded p-2">
                      <div className="text-xs text-gray-500 mb-1">Impact</div>
                      <div className="text-lg font-bold text-green-600">
                        {intervention.expectedImpact}%
                      </div>
                    </div>
                    <div className="text-center bg-gray-50 rounded p-2">
                      <div className="text-xs text-gray-500 mb-1">Effort</div>
                      <div className="text-lg font-bold text-gray-700">
                        {intervention.estimatedEffort}h
                      </div>
                    </div>
                    <div className="text-center bg-gray-50 rounded p-2">
                      <div className="text-xs text-gray-500 mb-1">ROI</div>
                      <div className={`text-lg font-bold ${getROIColor(intervention.roiScore)}`}>
                        {intervention.roiScore.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4">
                    {/* Description */}
                    <div className="mb-4">
                      <h5 className="text-sm font-semibold text-gray-900 mb-2">Description</h5>
                      <p className="text-sm text-gray-700">{intervention.description}</p>
                    </div>

                    {/* Action Steps */}
                    <div className="mb-4">
                      <h5 className="text-sm font-semibold text-gray-900 mb-2">Action Steps</h5>
                      <ol className="list-decimal list-inside space-y-1">
                        {intervention.actionSteps.map((step, idx) => (
                          <li key={idx} className="text-sm text-gray-700">{step}</li>
                        ))}
                      </ol>
                    </div>

                    {/* Success Metrics */}
                    <div className="mb-4">
                      <h5 className="text-sm font-semibold text-gray-900 mb-2">Success Metrics</h5>
                      <ul className="space-y-1">
                        {intervention.successMetrics.map((metric, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-center">
                            <span className="text-green-600 mr-2">✓</span>
                            {metric}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Owner and Reasoning */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900 mb-1">Suggested Owner</h5>
                        <p className="text-sm text-gray-700">{intervention.suggestedOwner}</p>
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900 mb-1">Type</h5>
                        <p className="text-sm text-gray-700 capitalize">
                          {intervention.type.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>

                    {/* AI Reasoning */}
                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-3">
                      <h5 className="text-sm font-semibold text-blue-900 mb-1 flex items-center">
                        <span className="mr-1">🤖</span> AI Reasoning
                      </h5>
                      <p className="text-sm text-blue-800">{intervention.reasoning}</p>
                    </div>

                    {/* Action Button */}
                    {onStartIntervention && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartIntervention(intervention.id);
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Start This Intervention
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary Footer */}
      {interventions.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500 mb-1">Total Impact</div>
              <div className="text-lg font-bold text-green-600">
                {interventions.reduce((sum, i) => sum + i.expectedImpact, 0).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Total Effort</div>
              <div className="text-lg font-bold text-gray-700">
                {interventions.reduce((sum, i) => sum + i.estimatedEffort, 0).toFixed(1)}h
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Avg ROI</div>
              <div className="text-lg font-bold text-blue-600">
                {(interventions.reduce((sum, i) => sum + i.roiScore, 0) / interventions.length).toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
