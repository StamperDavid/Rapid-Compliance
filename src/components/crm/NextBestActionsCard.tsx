/**
 * Next Best Actions Card Component
 * 
 * Displays AI-powered action recommendations for a deal.
 * Part of the CRM "Living Ledger" dashboard.
 */

'use client';

import React from 'react';
import type { ActionRecommendations, NextBestAction } from '@/lib/crm/next-best-action-engine';

interface NextBestActionsCardProps {
  recommendations: ActionRecommendations;
  onActionClick?: (action: NextBestAction) => void;
  compact?: boolean;
}

export function NextBestActionsCard({
  recommendations,
  onActionClick,
  compact = false,
}: NextBestActionsCardProps) {
  const getActionIcon = (type: string): string => {
    switch (type) {
      case 'call':
        return '📞';
      case 'email':
        return '📧';
      case 'meeting':
        return '📅';
      case 'proposal':
        return '📄';
      case 'followup':
        return '🔄';
      case 'discount':
        return '💰';
      case 'escalate':
        return '⬆️';
      case 'nurture':
        return '🌱';
      case 'close':
        return '🎯';
      case 'reassess':
        return '🔍';
      case 'research':
        return '📊';
      default:
        return '✨';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'var(--color-error)';
      case 'Medium':
        return 'var(--color-warning)';
      case 'Low':
        return 'var(--color-neutral-500)';
      default:
        return 'var(--color-neutral-500)';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'var(--color-error-dark)';
      case 'high':
        return 'var(--color-warning)';
      case 'medium':
        return 'var(--color-primary)';
      case 'low':
        return 'var(--color-success)';
      default:
        return 'var(--color-neutral-500)';
    }
  };

  const getImpactIcon = (impact: string): string => {
    switch (impact) {
      case 'High':
        return '🔥';
      case 'Medium':
        return '⚡';
      case 'Low':
        return '💡';
      default:
        return '•';
    }
  };

  if (compact) {
    const topAction = recommendations.actions[0];
    if (!topAction) {
      return (
        <div className="p-3 bg-surface-paper rounded-lg border border-border-main text-xs text-text-disabled text-center">
          No recommendations available
        </div>
      );
    }

    return (
      <div
        className="p-3 bg-neutral-950 rounded-lg"
        style={{
          border: `1px solid ${getPriorityColor(topAction.priority)}`,
          cursor: onActionClick ? 'pointer' : 'default',
        }}
        onClick={() => onActionClick?.(topAction)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{getActionIcon(topAction.type)}</span>
          <div className="flex-1">
            <div className="text-xs font-semibold text-text-primary">
              {topAction.title}
            </div>
            <div className="text-[0.625rem] text-text-secondary mt-0.5">
              {topAction.suggestedTimeline}
            </div>
          </div>
          <div
            className="text-[0.625rem] font-semibold uppercase"
            style={{ color: getPriorityColor(topAction.priority) }}
          >
            {topAction.priority}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-surface-paper rounded-xl p-6"
      style={{ border: `1px solid ${getUrgencyColor(recommendations.urgency)}` }}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-text-primary m-0">
              Next Best Actions
            </h3>
            <p className="text-sm text-text-secondary mt-1 m-0">
              {recommendations.dealName}
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-full text-xs font-semibold uppercase"
            style={{
              backgroundColor: `${getUrgencyColor(recommendations.urgency)}20`,
              color: getUrgencyColor(recommendations.urgency),
            }}
          >
            {recommendations.urgency} urgency
          </div>
        </div>
      </div>

      {/* Actions List */}
      <div className="flex flex-col gap-3">
        {recommendations.actions.map((action, _idx) => (
          <div
            key={action.id}
            className="bg-neutral-900 rounded-lg p-4 transition-all duration-200"
            style={{
              border: `1px solid ${getPriorityColor(action.priority)}20`,
              cursor: onActionClick ? 'pointer' : 'default',
            }}
            onClick={() => onActionClick?.(action)}
            onMouseEnter={(e) => {
              if (onActionClick) {
                e.currentTarget.style.backgroundColor = '#1a1a1a';
                e.currentTarget.style.borderColor = getPriorityColor(action.priority);
              }
            }}
            onMouseLeave={(e) => {
              if (onActionClick) {
                e.currentTarget.style.backgroundColor = '#111';
                e.currentTarget.style.borderColor = `${getPriorityColor(action.priority)}20`;
              }
            }}
          >
            {/* Action Header */}
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">{getActionIcon(action.type)}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold text-text-primary m-0">
                    {action.title}
                  </h4>
                  <span className="text-[0.625rem]">{getImpactIcon(action.estimatedImpact)}</span>
                </div>
                <p className="text-xs text-text-secondary m-0">
                  {action.description}
                </p>
              </div>
              <div
                className="px-2 py-1 rounded text-[0.625rem] font-semibold uppercase"
                style={{
                  backgroundColor: `${getPriorityColor(action.priority)}20`,
                  color: getPriorityColor(action.priority),
                }}
              >
                {action.priority}
              </div>
            </div>

            {/* Reasoning */}
            {action.reasoning.length > 0 && (
              <div className="mb-3">
                <div className="text-[0.625rem] text-neutral-600 mb-1">
                  Reasoning:
                </div>
                <ul className="m-0 pl-5 text-[0.6875rem] text-text-secondary">
                  {action.reasoning.map((reason, ridx) => (
                    <li key={ridx} className="mb-0.5">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Timeline & Confidence */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="text-[0.625rem] text-neutral-600">
                  Timeline: <span className="text-text-primary font-semibold">{action.suggestedTimeline}</span>
                </div>
                <div className="text-[0.625rem] text-neutral-600">
                  Impact: <span className="text-text-primary font-semibold">{action.estimatedImpact}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {action.automatable && (
                  <span className="px-1.5 py-0.5 bg-emerald-900 text-emerald-300 rounded text-[0.625rem] font-semibold">
                    Auto
                  </span>
                )}
                <div
                  className="text-[0.625rem]"
                  style={{
                    color: action.confidence >= 0.8 ? '#10b981' : action.confidence >= 0.6 ? '#f59e0b' : '#6b7280',
                  }}
                >
                  {Math.round(action.confidence * 100)}% confident
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 p-3 bg-neutral-900 rounded-lg text-xs text-neutral-600 text-center">
        Generated {new Date(recommendations.generatedAt).toLocaleString()} • Overall confidence:{' '}
        {Math.round(recommendations.confidence * 100)}%
      </div>
    </div>
  );
}
