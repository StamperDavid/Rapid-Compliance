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
        return '#ef4444';
      case 'Medium':
        return '#f59e0b';
      case 'Low':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#f59e0b';
      case 'medium':
        return '#6366f1';
      case 'low':
        return '#10b981';
      default:
        return '#6b7280';
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
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '0.5rem',
            border: '1px solid #1a1a1a',
            fontSize: '0.75rem',
            color: '#666',
            textAlign: 'center',
          }}
        >
          No recommendations available
        </div>
      );
    }

    return (
      <div
        style={{
          padding: '0.75rem',
          backgroundColor: '#0a0a0a',
          borderRadius: '0.5rem',
          border: `1px solid ${getPriorityColor(topAction.priority)}`,
          cursor: onActionClick ? 'pointer' : 'default',
        }}
        onClick={() => onActionClick?.(topAction)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{getActionIcon(topAction.type)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#fff' }}>
              {topAction.title}
            </div>
            <div style={{ fontSize: '0.625rem', color: '#999', marginTop: '0.125rem' }}>
              {topAction.suggestedTimeline}
            </div>
          </div>
          <div
            style={{
              fontSize: '0.625rem',
              fontWeight: '600',
              color: getPriorityColor(topAction.priority),
              textTransform: 'uppercase',
            }}
          >
            {topAction.priority}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#0a0a0a',
        border: `1px solid ${getUrgencyColor(recommendations.urgency)}`,
        borderRadius: '0.75rem',
        padding: '1.5rem',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#fff', margin: 0 }}>
              Next Best Actions
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#999', marginTop: '0.25rem', margin: 0 }}>
              {recommendations.dealName}
            </p>
          </div>
          <div
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: `${getUrgencyColor(recommendations.urgency)}20`,
              color: getUrgencyColor(recommendations.urgency),
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: '600',
              textTransform: 'uppercase',
            }}
          >
            {recommendations.urgency} urgency
          </div>
        </div>
      </div>

      {/* Actions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {recommendations.actions.map((action, idx) => (
          <div
            key={action.id}
            style={{
              backgroundColor: '#111',
              borderRadius: '0.5rem',
              padding: '1rem',
              border: `1px solid ${getPriorityColor(action.priority)}20`,
              cursor: onActionClick ? 'pointer' : 'default',
              transition: 'all 0.2s',
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
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{getActionIcon(action.type)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#fff', margin: 0 }}>
                    {action.title}
                  </h4>
                  <span style={{ fontSize: '0.625rem' }}>{getImpactIcon(action.estimatedImpact)}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#999', margin: 0 }}>
                  {action.description}
                </p>
              </div>
              <div
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: `${getPriorityColor(action.priority)}20`,
                  color: getPriorityColor(action.priority),
                  borderRadius: '0.25rem',
                  fontSize: '0.625rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                }}
              >
                {action.priority}
              </div>
            </div>

            {/* Reasoning */}
            {action.reasoning.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.625rem', color: '#666', marginBottom: '0.25rem' }}>
                  Reasoning:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.6875rem', color: '#999' }}>
                  {action.reasoning.map((reason, ridx) => (
                    <li key={ridx} style={{ marginBottom: '0.125rem' }}>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Timeline & Confidence */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '0.625rem', color: '#666' }}>
                  Timeline: <span style={{ color: '#fff', fontWeight: '600' }}>{action.suggestedTimeline}</span>
                </div>
                <div style={{ fontSize: '0.625rem', color: '#666' }}>
                  Impact: <span style={{ color: '#fff', fontWeight: '600' }}>{action.estimatedImpact}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {action.automatable && (
                  <span
                    style={{
                      padding: '0.125rem 0.375rem',
                      backgroundColor: '#065f46',
                      color: '#6ee7b7',
                      borderRadius: '0.25rem',
                      fontSize: '0.625rem',
                      fontWeight: '600',
                    }}
                  >
                    Auto
                  </span>
                )}
                <div
                  style={{
                    fontSize: '0.625rem',
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
      <div
        style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#111',
          borderRadius: '0.5rem',
          fontSize: '0.75rem',
          color: '#666',
          textAlign: 'center',
        }}
      >
        Generated {new Date(recommendations.generatedAt).toLocaleString()} • Overall confidence:{' '}
        {Math.round(recommendations.confidence * 100)}%
      </div>
    </div>
  );
}
