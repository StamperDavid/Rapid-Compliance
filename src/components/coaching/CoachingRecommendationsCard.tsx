/**
 * Coaching Recommendations Card Component
 * 
 * Displays AI-generated coaching recommendations with actions
 */

'use client';

import React, { useState } from 'react';
import type { CoachingRecommendation } from '@/lib/coaching/types';

interface CoachingRecommendationsCardProps {
  recommendations: CoachingRecommendation[];
  loading?: boolean;
  onAccept?: (recommendationId: string) => void;
  onDismiss?: (recommendationId: string, reason?: string) => void;
}

/**
 * Coaching Recommendations Card Component
 */
export function CoachingRecommendationsCard({
  recommendations,
  loading = false,
  onAccept,
  onDismiss
}: CoachingRecommendationsCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Coaching Recommendations</h3>
        <p className="text-sm text-gray-500">No recommendations available</p>
      </div>
    );
  }

  // Sort by priority
  const sortedRecommendations = [...recommendations].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Coaching Recommendations</h3>
        <p className="text-sm text-gray-500">AI-powered suggestions for improvement</p>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {sortedRecommendations.map((rec) => (
          <RecommendationItem
            key={rec.id}
            recommendation={rec}
            expanded={expandedId === rec.id}
            onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
            onAccept={onAccept}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual Recommendation Item
 */
interface RecommendationItemProps {
  recommendation: CoachingRecommendation;
  expanded: boolean;
  onToggle: () => void;
  onAccept?: (recommendationId: string) => void;
  onDismiss?: (recommendationId: string, reason?: string) => void;
}

function RecommendationItem({
  recommendation,
  expanded,
  onToggle,
  onAccept,
  onDismiss
}: RecommendationItemProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEffortBadge = (effort: string) => {
    switch (effort) {
      case 'high':
        return 'bg-purple-100 text-purple-800';
      case 'medium':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-gray-50 transition"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-medium px-2 py-1 rounded border ${getPriorityColor(recommendation.priority)}`}>
                {recommendation.priority.toUpperCase()}
              </span>
              <span className={`text-xs font-medium px-2 py-1 rounded ${getEffortBadge(recommendation.effort)}`}>
                {recommendation.effort} effort
              </span>
              <span className="text-xs text-gray-500">
                {(recommendation.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <h4 className="text-base font-semibold text-gray-900">{recommendation.title}</h4>
            <p className="text-sm text-gray-600 mt-1">{recommendation.category.replace('_', ' ')}</p>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Recommendation Text */}
          <div className="mb-4 pt-4">
            <p className="text-sm text-gray-700 whitespace-pre-line">{recommendation.recommendation}</p>
          </div>

          {/* Rationale */}
          <div className="mb-4">
            <h5 className="text-sm font-medium text-gray-900 mb-2">Why This Matters</h5>
            <p className="text-sm text-gray-600">{recommendation.rationale}</p>
          </div>

          {/* Actions */}
          {recommendation.actions.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-900 mb-2">Action Steps</h5>
              <ul className="space-y-2">
                {recommendation.actions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <span className="text-gray-700">{action.action}</span>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>Timeline: {action.timeline}</span>
                        <span>·</span>
                        <span>Owner: {action.owner}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Expected Outcomes */}
          {recommendation.expectedOutcomes.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-900 mb-2">Expected Outcomes</h5>
              <div className="space-y-2">
                {recommendation.expectedOutcomes.map((outcome, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">{outcome.metric}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{outcome.baseline}</span>
                      <span className="text-sm text-gray-400">→</span>
                      <span className="text-sm font-semibold text-green-600">{outcome.target}</span>
                      <span className="text-xs text-gray-500">({outcome.timeframe})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {(onAccept || onDismiss) && (
            <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
              {onAccept && (
                <button
                  onClick={() => onAccept(recommendation.id)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  Accept & Track
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={() => onDismiss(recommendation.id)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
