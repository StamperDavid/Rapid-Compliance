/**
 * Conversation Follow-Ups Card
 * 
 * Displays AI-recommended follow-up actions and next steps.
 * Shows what to do, when to do it, and why it matters.
 * 
 * @module components/conversation
 */

'use client';

import React, { useState } from 'react';
import type { ConversationAnalysis } from '@/lib/conversation/types';

interface ConversationFollowUpsCardProps {
  analysis: ConversationAnalysis;
  className?: string;
}

export function ConversationFollowUpsCard({ analysis, className = '' }: ConversationFollowUpsCardProps) {
  const { followUpActions, positiveSignals } = analysis;
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  
  const toggleAction = (actionId: string) => {
    const newExpanded = new Set(expandedActions);
    if (newExpanded.has(actionId)) {
      newExpanded.delete(actionId);
    } else {
      newExpanded.add(actionId);
    }
    setExpandedActions(newExpanded);
  };
  
  // Priority badge
  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, { bg: string; text: string; icon: string }> = {
      critical: { bg: 'bg-red-100', text: 'text-red-700', icon: '🚨' },
      high: { bg: 'bg-orange-100', text: 'text-orange-700', icon: '⚠️' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '📌' },
      low: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'ℹ️' },
    };
    return styles[priority] || styles.low;
  };
  
  // Action type icon
  const getActionTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      send_follow_up_email: '📧',
      schedule_meeting: '📅',
      send_proposal: '📄',
      share_resources: '📚',
      introduce_stakeholder: '👥',
      address_concern: '🛠️',
      provide_pricing: '💰',
      schedule_demo: '🎬',
      send_case_study: '📊',
      internal_alignment: '🔄',
      other: '📋',
    };
    return icons[type] || '📋';
  };
  
  // Deadline urgency
  const getDeadlineUrgency = (deadline: string) => {
    const lower = deadline.toLowerCase();
    if (lower.includes('24 hours') || lower.includes('immediately')) {
      return { text: deadline, color: 'text-red-600', icon: '🔥' };
    } else if (lower.includes('2 days') || lower.includes('48 hours')) {
      return { text: deadline, color: 'text-orange-600', icon: '⏰' };
    } else if (lower.includes('week')) {
      return { text: deadline, color: 'text-yellow-600', icon: '📆' };
    }
    return { text: deadline, color: 'text-gray-600', icon: '📅' };
  };
  
  // Signal strength badge
  const getSignalStrengthBadge = (strength: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      strong: { bg: 'bg-green-100', text: 'text-green-700' },
      moderate: { bg: 'bg-blue-100', text: 'text-blue-700' },
      weak: { bg: 'bg-gray-100', text: 'text-gray-700' },
    };
    const style = styles[strength] || styles.moderate;
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text} capitalize`}>
        {strength}
      </span>
    );
  };
  
  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Follow-Up Actions</h2>
      
      {/* Positive Signals */}
      {positiveSignals.length > 0 && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
            <span>⭐</span>
            Positive Signals ({positiveSignals.length})
          </h3>
          
          <div className="space-y-2">
            {positiveSignals.map((signal, index) => (
              <div key={index} className="bg-white p-3 rounded border border-green-300">
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium text-gray-900 capitalize">
                    {signal.type.replace(/_/g, ' ')}
                  </span>
                  {getSignalStrengthBadge(signal.strength)}
                </div>
                
                <p className="text-sm text-gray-700 mb-1">{signal.description}</p>
                
                {signal.quote && (
                  <p className="text-xs text-gray-600 italic mb-2">
                    "{signal.quote.substring(0, 120)}{signal.quote.length > 120 ? '...' : ''}"
                  </p>
                )}
                
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    <span className="font-medium">Impact:</span> {signal.impact}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Follow-Up Actions */}
      {followUpActions.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Recommended Actions ({followUpActions.length})
          </h3>
          
          <div className="space-y-3">
            {followUpActions.map((action) => {
              const priorityStyle = getPriorityBadge(action.priority);
              const deadlineInfo = getDeadlineUrgency(action.deadline);
              const isExpanded = expandedActions.has(action.id);
              
              return (
                <div
                  key={action.id}
                  className={`border-l-4 pl-4 py-3 rounded-r cursor-pointer transition-all ${
                    action.priority === 'critical' ? 'border-red-500 bg-red-50' :
                    action.priority === 'high' ? 'border-orange-500 bg-orange-50' :
                    action.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500 bg-blue-50'
                  }`}
                  onClick={() => toggleAction(action.id)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xl">{getActionTypeIcon(action.type)}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{action.title}</div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {action.description.substring(0, isExpanded ? 1000 : 100)}
                          {!isExpanded && action.description.length > 100 && '...'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityStyle.bg} ${priorityStyle.text} flex items-center gap-1`}>
                        <span>{priorityStyle.icon}</span>
                        <span className="capitalize">{action.priority}</span>
                      </span>
                      <button className="text-gray-400 hover:text-gray-600">
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                    <span className={`flex items-center gap-1 ${deadlineInfo.color}`}>
                      <span>{deadlineInfo.icon}</span>
                      <span className="font-medium">{deadlineInfo.text}</span>
                    </span>
                    <span>Est. Effort: {action.estimatedEffort}h</span>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      {/* Reasoning */}
                      <div className="p-3 bg-white rounded border border-gray-200">
                        <div className="text-xs font-medium text-gray-700 mb-1">
                          💡 Why This Matters:
                        </div>
                        <p className="text-xs text-gray-600">{action.reasoning}</p>
                      </div>
                      
                      {/* Assignee */}
                      {action.assignee && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">Suggested Owner:</span>
                          <span className="font-medium text-gray-700">{action.assignee}</span>
                        </div>
                      )}
                      
                      {/* Action Button */}
                      <div className="flex gap-2">
                        <button
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Create task in CRM
                            alert('Task creation coming soon!');
                          }}
                        >
                          Create Task
                        </button>
                        <button
                          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Mark as done
                            alert('Mark done coming soon!');
                          }}
                        >
                          Mark Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Summary */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-gray-700">Total Actions:</span>
                <span className="ml-2 text-gray-900">{followUpActions.length}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Est. Total Effort:</span>
                <span className="ml-2 text-gray-900">
                  {followUpActions.reduce((sum, action) => sum + action.estimatedEffort, 0).toFixed(1)}h
                </span>
              </div>
            </div>
            
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                Critical: {followUpActions.filter(a => a.priority === 'critical').length}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                High: {followUpActions.filter(a => a.priority === 'high').length}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                Medium: {followUpActions.filter(a => a.priority === 'medium').length}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Low: {followUpActions.filter(a => a.priority === 'low').length}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <span className="text-4xl mb-2 block">✅</span>
          <p className="text-sm font-medium text-gray-700 mb-1">
            No Immediate Actions Required
          </p>
          <p className="text-xs text-gray-500">
            The conversation went well. Continue nurturing the relationship.
          </p>
        </div>
      )}
    </div>
  );
}
