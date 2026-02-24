'use client';

/**
 * ApprovalCard — Inline approval gate rendered when a step has AWAITING_APPROVAL status.
 *
 * Calls existing POST /api/orchestrator/approvals to process the decision.
 * After decision, triggers optimistic UI update and next poll reflects the change.
 */

import { useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';

interface ApprovalCardProps {
  approvalId: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  requestedBy: string;
  onDecision: () => void;
}

const URGENCY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: 'var(--color-text-secondary)', bg: 'rgba(158,158,158,0.15)', label: 'Low' },
  medium: { color: 'var(--color-warning)', bg: 'rgba(255,152,0,0.15)', label: 'Medium' },
  high: { color: 'var(--color-error)', bg: 'rgba(244,67,54,0.15)', label: 'High' },
  critical: { color: '#dc2626', bg: 'rgba(220,38,38,0.15)', label: 'Critical' },
};

export default function ApprovalCard({
  approvalId,
  description,
  urgency,
  requestedBy,
  onDecision,
}: ApprovalCardProps) {
  const authFetch = useAuthFetch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decided, setDecided] = useState<'APPROVED' | 'REJECTED' | null>(null);

  const urgencyStyle = URGENCY_STYLES[urgency] ?? URGENCY_STYLES.medium;

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (isSubmitting) { return; }
    setIsSubmitting(true);

    // Optimistic update
    setDecided(decision);

    try {
      await authFetch('/api/orchestrator/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId,
          decision,
        }),
      });
    } catch {
      // Revert optimistic update on failure
      setDecided(null);
    } finally {
      setIsSubmitting(false);
      onDecision();
    }
  };

  if (decided) {
    return (
      <div style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        backgroundColor: decided === 'APPROVED'
          ? 'rgba(76,175,80,0.1)'
          : 'rgba(244,67,54,0.1)',
        border: `1px solid ${decided === 'APPROVED' ? 'var(--color-success)' : 'var(--color-error)'}`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: decided === 'APPROVED' ? 'var(--color-success)' : 'var(--color-error)',
        }}>
          {decided === 'APPROVED' ? 'Approved' : 'Rejected'}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '1.25rem',
      borderRadius: '0.75rem',
      backgroundColor: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-border-light)',
    }}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--color-text-disabled)',
        marginBottom: '0.75rem',
      }}>
        Approval Required
      </div>

      {/* Urgency badge */}
      <div style={{ marginBottom: '0.75rem' }}>
        <span style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: urgencyStyle.color,
          backgroundColor: urgencyStyle.bg,
          padding: '0.125rem 0.5rem',
          borderRadius: '9999px',
        }}>
          {urgencyStyle.label} Priority
        </span>
      </div>

      {/* Description */}
      <div style={{
        fontSize: '0.8125rem',
        color: 'var(--color-text-primary)',
        lineHeight: 1.5,
        marginBottom: '0.5rem',
      }}>
        {description}
      </div>

      {/* Requested by */}
      <div style={{
        fontSize: '0.75rem',
        color: 'var(--color-text-secondary)',
        marginBottom: '1rem',
      }}>
        Requested by: {requestedBy}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleDecision('APPROVED')}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: 'var(--color-success)',
            color: '#fff',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleDecision('REJECTED')}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-error)',
            backgroundColor: 'transparent',
            color: 'var(--color-error)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
