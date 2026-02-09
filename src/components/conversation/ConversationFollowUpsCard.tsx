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
import { useToast } from '@/hooks/useToast';

interface ConversationFollowUpsCardProps {
  analysis: ConversationAnalysis;
  className?: string;
}

export function ConversationFollowUpsCard({ analysis, className = '' }: ConversationFollowUpsCardProps) {
  const { followUpActions, positiveSignals } = analysis;
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const toast = useToast();
  
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
    <div className={`bg-surface-main rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)]">Follow-Up Actions</h2>
      
      {/* Positive Signals */}
      {positiveSignals.length > 0 && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
            <span>⭐</span>
            Positive Signals ({positiveSignals.length})
          </h3>
          
          <div className="space-y-2">
            {positiveSignals.map((signal, index) => (
              <div key={index} className="bg-surface-main p-3 rounded border border-green-300">
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium text-[var(--color-text-primary)] capitalize">
                    {signal.type.replace(/_/g, ' ')}
                  </span>
                  {getSignalStrengthBadge(signal.strength)}
                </div>

                <p className="text-sm text-[var(--color-text-secondary)] mb-1">{signal.description}</p>

                {signal.quote && (
                  <p className="text-xs text-[var(--color-text-disabled)] italic mb-2">
                    {'"'}{signal.quote.substring(0, 120)}{signal.quote.length > 120 ? '...' : ''}{'"'}
                  </p>
                )}

                <div className="pt-2 border-t border-border-light">
                  <div className="text-xs text-[var(--color-text-disabled)]">
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
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
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
                    'border-primary bg-blue-50'
                  }`}
                  onClick={() => toggleAction(action.id)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xl">{getActionTypeIcon(action.type)}</span>
                      <div className="flex-1">
                        <div className="font-medium text-[var(--color-text-primary)]">{action.title}</div>
                        <div className="text-xs text-[var(--color-text-disabled)] mt-0.5">
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
                      <button className="text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]">
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-disabled)] mb-2">
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
                      <div className="p-3 bg-surface-main rounded border border-border-light">
                        <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                          💡 Why This Matters:
                        </div>
                        <p className="text-xs text-[var(--color-text-disabled)]">{action.reasoning}</p>
                      </div>

                      {/* Assignee */}
                      {action.assignee && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[var(--color-text-disabled)]">Suggested Owner:</span>
                          <span className="font-medium text-[var(--color-text-secondary)]">{action.assignee}</span>
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="flex gap-2">
                        <button
                          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-primary/90 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.success('Task creation coming soon!');
                          }}
                        >
                          Create Task
                        </button>
                        <button
                          className="px-4 py-2 bg-surface-elevated text-[var(--color-text-secondary)] text-sm font-medium rounded hover:bg-surface-elevated/80 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.success('Mark done coming soon!');
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
          <div className="mt-6 p-4 bg-surface-elevated border border-border-light rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-[var(--color-text-secondary)]">Total Actions:</span>
                <span className="ml-2 text-[var(--color-text-primary)]">{followUpActions.length}</span>
              </div>
              <div>
                <span className="font-medium text-[var(--color-text-secondary)]">Est. Total Effort:</span>
                <span className="ml-2 text-[var(--color-text-primary)]">
                  {followUpActions.reduce((sum, action) => sum + action.estimatedEffort, 0).toFixed(1)}h
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-text-disabled)]">
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
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                Low: {followUpActions.filter(a => a.priority === 'low').length}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <span className="text-4xl mb-2 block">✅</span>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            No Immediate Actions Required
          </p>
          <p className="text-xs text-[var(--color-text-disabled)]">
            The conversation went well. Continue nurturing the relationship.
          </p>
        </div>
      )}
    </div>
  );
}
