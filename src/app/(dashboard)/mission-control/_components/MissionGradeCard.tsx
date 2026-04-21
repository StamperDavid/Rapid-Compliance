'use client';

/**
 * MissionGradeCard — Overall mission rating widget shown below the timeline.
 *
 * Shown for COMPLETED and FAILED missions only. Collapses to a single line
 * when ungraded, expands on click to reveal the star picker and text area.
 * Once submitted (or if already graded) it renders a compact read-only view
 * with an "Edit" toggle that re-opens the form.
 */

import { useState } from 'react';
import StarRating from './StarRating';
import { PromptRevisionPopup } from '@/components/training/PromptRevisionPopup';
import { useAuthFetch } from '@/hooks/useAuthFetch';

interface MissionGradeCardProps {
  missionId: string;
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

export default function MissionGradeCard({ missionId, existingGrade }: MissionGradeCardProps) {
  const authFetch = useAuthFetch();
  const [expanded, setExpanded] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [score, setScore] = useState<number>(existingGrade?.score ?? 0);
  const [explanation, setExplanation] = useState<string>(existingGrade?.explanation ?? '');
  const [submitted, setSubmitted] = useState<boolean>(!!existingGrade);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [revisionData, setRevisionData] = useState<RevisionData | null>(null);
  const [isProposing, setIsProposing] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  async function handleSubmit() {
    if (score === 0) { return; }

    setSubmitState('submitting');
    setErrorMsg('');

    try {
      const response = await authFetch(`/api/orchestrator/missions/${missionId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          explanation: explanation.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data: unknown = await response.json();
        const errorData = data as { error?: string };
        setErrorMsg(errorData?.error ?? 'Submission failed. Please try again.');
        setSubmitState('error');
        return;
      }

      setSubmitted(true);
      setEditing(false);
      setExpanded(false);
      setSubmitState('idle');

      // Non-blocking: propose a prompt revision when the user provided an explanation.
      const trimmedExplanation = explanation.trim();
      if (trimmedExplanation) {
        setIsProposing(true);
        try {
          const revRes = await authFetch('/api/training/propose-prompt-revision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentType: 'orchestrator',
              correction: trimmedExplanation,
              context: `Mission grading — user gave ${score} stars`,
            }),
          });
          const revJson: unknown = await revRes.json();
          const revData = revJson as { success: boolean; data?: RevisionData };
          if (revData.success && revData.data) {
            setRevisionData(revData.data);
          }
        } catch {
          // Non-critical — grade already succeeded
        } finally {
          setIsProposing(false);
        }
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setSubmitState('error');
    }
  }

  async function handleApproveRevision(fullRevisedPrompt: string, changeDescription: string) {
    setIsApplying(true);
    try {
      await authFetch('/api/training/apply-prompt-revision', {
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

  // Shared popup rendered on every branch — portal-style overlay outside all card states
  const revisionPopup = revisionData !== null ? (
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
  ) : null;

  // Read-only display when already graded and not editing
  if (submitted && !editing) {
    return (
      <>
        <div
          style={{
            marginTop: '1.25rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border-light)',
            background: 'rgba(var(--color-primary-rgb, 99,102,241), 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
              fontWeight: 500,
            }}
          >
            Your rating
          </span>

          <StarRating value={score} onChange={() => undefined} readonly />

          {explanation && (
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--color-text-secondary)',
                fontStyle: 'italic',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {explanation}
            </span>
          )}

          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.25rem 0.5rem',
              fontSize: '0.6875rem',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Edit
          </button>
        </div>
        {revisionPopup}
      </>
    );
  }

  // Collapsed prompt
  if (!expanded && !editing) {
    return (
      <>
        <div style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              textUnderlineOffset: '3px',
            }}
          >
            Rate this mission
          </button>
        </div>
        {revisionPopup}
      </>
    );
  }

  // Expanded form
  return (
    <>
    <div
      style={{
        marginTop: '1.25rem',
        padding: '1rem',
        borderRadius: '0.5rem',
        border: '1px solid var(--color-border-light)',
        background: 'rgba(var(--color-primary-rgb, 99,102,241), 0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}
        >
          How did Jasper do?
        </span>

        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setEditing(false);
            if (!existingGrade) {
              setScore(0);
              setExplanation('');
            } else {
              setScore(existingGrade.score);
              setExplanation(existingGrade.explanation ?? '');
            }
            setSubmitState('idle');
            setErrorMsg('');
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.125rem 0.25rem',
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>

      <StarRating value={score} onChange={setScore} />

      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        maxLength={1000}
        placeholder="What went well or could be improved? (optional)"
        rows={3}
        style={{
          width: '100%',
          padding: '0.5rem 0.625rem',
          fontSize: '0.8125rem',
          color: 'var(--color-text-primary)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '0.375rem',
          resize: 'vertical',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {errorMsg && (
        <p
          style={{
            margin: 0,
            fontSize: '0.75rem',
            color: 'var(--color-error)',
          }}
        >
          {errorMsg}
        </p>
      )}

      <button
        type="button"
        disabled={score === 0 || submitState === 'submitting'}
        onClick={() => { void handleSubmit(); }}
        style={{
          alignSelf: 'flex-start',
          padding: '0.375rem 0.875rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: '#fff',
          background:
            score === 0 || submitState === 'submitting'
              ? 'var(--color-text-disabled)'
              : 'var(--color-primary)',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: score === 0 || submitState === 'submitting' ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s ease',
        }}
      >
        {submitState === 'submitting' ? 'Submitting…' : isProposing ? 'Proposing revision…' : 'Submit'}
      </button>
    </div>
    {revisionPopup}
    </>
  );
}
