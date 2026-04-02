'use client';

/**
 * StepGradeWidget — Compact inline rating widget for individual mission steps.
 *
 * Designed to fit the dense right-panel step detail view. Renders as a single row
 * of small stars plus a "Why?" text button. Clicking "Why?" expands a small textarea
 * for optional context. Submits to the grade API with the stepId included.
 */

import { useState } from 'react';
import StarRating from './StarRating';
import { PromptRevisionPopup } from '@/components/training/PromptRevisionPopup';

interface StepGradeWidgetProps {
  missionId: string;
  stepId: string;
  existingGrade?: { score: number; explanation?: string };
}

type SubmitState = 'idle' | 'submitting' | 'error';

interface RevisionData {
  beforeSection: string;
  afterSection: string;
  clarifyingQuestion?: string;
  changeDescription: string;
  fullRevisedPrompt: string;
}

export default function StepGradeWidget({
  missionId,
  stepId,
  existingGrade,
}: StepGradeWidgetProps) {
  const [score, setScore] = useState<number>(existingGrade?.score ?? 0);
  const [explanation, setExplanation] = useState<string>(existingGrade?.explanation ?? '');
  const [showReason, setShowReason] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(!!existingGrade);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [revisionData, setRevisionData] = useState<RevisionData | null>(null);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  async function handleSubmit(submittedScore: number, withRevision: boolean) {
    if (submittedScore === 0) { return; }

    setSubmitState('submitting');

    try {
      const authToken =
        typeof window !== 'undefined'
          ? (window as Window & { __jasperAuthToken?: string }).__jasperAuthToken
          : undefined;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`/api/orchestrator/missions/${missionId}/grade`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          stepId,
          score: submittedScore,
          explanation: explanation.trim() || undefined,
        }),
      });

      if (!response.ok) {
        setSubmitState('error');
        return;
      }

      setSubmitted(true);
      setShowReason(false);
      setSubmitState('idle');

      // Non-blocking: propose a prompt revision when the user provided an explanation
      // via the "Why?" textarea (withRevision=true) and explanation is non-empty.
      const trimmedExplanation = explanation.trim();
      if (withRevision && trimmedExplanation) {
        try {
          const revRes = await fetch('/api/training/propose-prompt-revision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentType: 'orchestrator',
              correction: trimmedExplanation,
              context: `Mission step grading — user gave ${submittedScore} stars`,
            }),
          });
          const revJson: unknown = await revRes.json();
          const revData = revJson as { success: boolean; data?: RevisionData };
          if (revData.success && revData.data) {
            setRevisionData(revData.data);
          }
        } catch {
          // Non-critical — grade already succeeded
        }
      }
    } catch {
      setSubmitState('error');
    }
  }

  async function handleApproveRevision(fullRevisedPrompt: string, changeDescription: string) {
    setIsApplying(true);
    try {
      await fetch('/api/training/apply-prompt-revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'orchestrator',
          revisedPromptSection: revisionData?.afterSection ?? '',
          fullRevisedPrompt,
          changeDescription,
        }),
      });
    } catch {
      // Non-critical
    } finally {
      setIsApplying(false);
      setRevisionData(null);
    }
  }

  function handleStarChange(newScore: number) {
    setScore(newScore);
    // Auto-submit immediately on star selection without revision — no explanation yet.
    void handleSubmit(newScore, false);
  }

  return (
    <>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
      }}
    >
      {/* Row: stars + "Why?" button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <StarRating
          value={score}
          onChange={handleStarChange}
          size="sm"
          readonly={submitted && !showReason}
        />

        {score > 0 && !showReason && (
          <button
            type="button"
            onClick={() => setShowReason(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '0.6875rem',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              textUnderlineOffset: '2px',
            }}
          >
            Why?
          </button>
        )}

        {submitState === 'error' && (
          <span
            style={{
              fontSize: '0.625rem',
              color: 'var(--color-error)',
            }}
          >
            Failed
          </span>
        )}
      </div>

      {/* Expanded reason textarea */}
      {showReason && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
          }}
        >
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            maxLength={1000}
            placeholder="What could be improved? (optional)"
            rows={2}
            style={{
              width: '100%',
              padding: '0.375rem 0.5rem',
              fontSize: '0.75rem',
              color: 'var(--color-text-primary)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '0.3125rem',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.4,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={submitState === 'submitting'}
              onClick={() => void handleSubmit(score, true)}
              style={{
                padding: '0.25rem 0.625rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: '#fff',
                background:
                  submitState === 'submitting'
                    ? 'var(--color-text-disabled)'
                    : 'var(--color-primary)',
                border: 'none',
                borderRadius: '0.3125rem',
                cursor: submitState === 'submitting' ? 'not-allowed' : 'pointer',
              }}
            >
              {submitState === 'submitting' ? 'Saving…' : 'Save'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowReason(false);
                setExplanation(existingGrade?.explanation ?? '');
              }}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.6875rem',
                color: 'var(--color-text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
    {revisionData !== null && (
      <PromptRevisionPopup
        isOpen
        onClose={() => setRevisionData(null)}
        onApprove={(fullRevisedPrompt, changeDescription) => {
          void handleApproveRevision(fullRevisedPrompt, changeDescription);
        }}
        onReject={() => setRevisionData(null)}
        agentType="orchestrator"
        beforeSection={revisionData.beforeSection}
        afterSection={revisionData.afterSection}
        clarifyingQuestion={revisionData.clarifyingQuestion}
        changeDescription={revisionData.changeDescription}
        fullRevisedPrompt={revisionData.fullRevisedPrompt}
        isApplying={isApplying}
      />
    )}
    </>
  );
}
