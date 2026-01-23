/**
 * Conversation Coaching Card
 * 
 * Displays AI-generated coaching insights and recommendations.
 * Shows what went well, areas for improvement, and specific actions.
 * 
 * @module components/conversation
 */

'use client';

import React from 'react';
import type { ConversationAnalysis } from '@/lib/conversation/types';

interface ConversationCoachingCardProps {
  analysis: ConversationAnalysis;
  className?: string;
}

export function ConversationCoachingCard({ analysis, className = '' }: ConversationCoachingCardProps) {
  const { coachingInsights, qualityIndicators, redFlags } = analysis;
  
  // Priority badge
  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      critical: { bg: 'bg-red-100', text: 'text-red-700' },
      high: { bg: 'bg-orange-100', text: 'text-orange-700' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
      low: { bg: 'bg-blue-100', text: 'text-blue-700' },
    };
    const style = styles[priority] || styles.low;
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
        {priority}
      </span>
    );
  };
  
  // Category icon
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      discovery: '🔍',
      listening: '👂',
      objection_handling: '🛡️',
      value_articulation: '💎',
      questioning: '❓',
      closing: '🎯',
      rapport_building: '🤝',
      time_management: '⏰',
      technical_knowledge: '📚',
      competitor_positioning: '⚔️',
      next_steps: '➡️',
      other: '📋',
    };
    return icons[category] || '📋';
  };
  
  // Quality status
  const getQualityStatus = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: string }> = {
      excellent: { bg: 'bg-green-100', text: 'text-green-700', icon: '🌟' },
      good: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '👍' },
      needs_improvement: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '⚠️' },
      poor: { bg: 'bg-red-100', text: 'text-red-700', icon: '❌' },
    };
    return styles[status] || styles.good;
  };
  
  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Coaching Insights</h2>
      
      {/* Quality Indicators */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quality Indicators</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {qualityIndicators.map((indicator, index) => {
            const status = getQualityStatus(indicator.status);
            return (
              <div key={index} className={`p-3 rounded-lg border ${status.bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{status.icon}</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {indicator.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${status.text} capitalize`}>
                    {indicator.status.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-sm font-semibold ${status.text}`}>
                    {indicator.score}/100
                  </span>
                </div>
                {indicator.recommendation && (
                  <p className="text-xs text-gray-600 mt-2">
                    {indicator.recommendation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Red Flags */}
      {redFlags.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
            <span>🚩</span>
            Red Flags ({redFlags.length})
          </h3>
          
          <div className="space-y-3">
            {redFlags.map((flag, index) => (
              <div key={index} className="bg-white p-3 rounded border border-red-300">
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium text-gray-900 capitalize">
                    {flag.type.replace(/_/g, ' ')}
                  </span>
                  {getPriorityBadge(flag.severity)}
                </div>
                
                <p className="text-sm text-gray-700 mb-2">{flag.description}</p>
                
                {flag.quote && (
                  <p className="text-sm text-gray-600 italic mb-2">
                    {'"'}{flag.quote}{'"'}
                  </p>
                )}
                
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-1">Recommendation:</div>
                  <p className="text-xs text-gray-600">{flag.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Coaching Insights */}
      {coachingInsights.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Actionable Coaching ({coachingInsights.length})
          </h3>
          
          <div className="space-y-4">
            {coachingInsights.map((insight, index) => (
              <div
                key={index}
                className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50 rounded-r"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{getCategoryIcon(insight.category)}</span>
                    <span className="font-medium text-gray-900 capitalize">
                      {insight.skillArea}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(insight.priority)}
                    <span className="text-xs text-gray-500">
                      Impact: {insight.impact}%
                    </span>
                  </div>
                </div>
                
                {/* Insight */}
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    {insight.insight}
                  </div>
                </div>
                
                {/* What went well */}
                {insight.whatWentWell && (
                  <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded">
                    <div className="text-xs font-medium text-green-800 mb-1">
                      ✓ What Went Well:
                    </div>
                    <p className="text-xs text-green-700">{insight.whatWentWell}</p>
                  </div>
                )}
                
                {/* What to improve */}
                <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="text-xs font-medium text-yellow-800 mb-1">
                    ⚡ What to Improve:
                  </div>
                  <p className="text-xs text-yellow-700">{insight.whatToImprove}</p>
                </div>
                
                {/* Specific example */}
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-700 mb-1">
                    Example from conversation:
                  </div>
                  <p className="text-xs text-gray-600 italic">
                    {'"'}{insight.specificExample}{'"'}
                  </p>
                </div>
                
                {/* Recommended action */}
                <div className="p-3 bg-white rounded border border-blue-200">
                  <div className="text-xs font-medium text-blue-800 mb-1">
                    🎯 Recommended Action:
                  </div>
                  <p className="text-xs text-blue-700">{insight.recommendedAction}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <span className="text-4xl mb-2 block">🎉</span>
          <p className="text-sm font-medium text-gray-700 mb-1">
            Excellent Performance!
          </p>
          <p className="text-xs text-gray-500">
            No critical coaching areas identified. Keep up the great work!
          </p>
        </div>
      )}
    </div>
  );
}
