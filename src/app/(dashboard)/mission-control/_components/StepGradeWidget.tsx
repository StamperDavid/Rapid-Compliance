'use client';

/**
 * StepGradeWidget — Compact inline rating widget for individual mission steps.
 *
 * Renders in the right-panel step detail view. A row of small stars + a "Why?"
 * button that opens an explanation textarea. When the operator types a reason
 * and submits, the grade is written to the missionGrades collection AND a
 * prompt-revision proposal is kicked off against the SPECIALIST that produced
 * the step's output (not the manager, not Jasper).
 *
 * M2b (April 15, 2026) — routes corrections to the specialist that produced
 * the work, per Standing Rule #2. Uses the step's `specialistsUsed` array
 * (populated by BaseManager's M2a accumulator) to target the right agent:
 *
 *   - One specialist in the list → route directly to it
 *   - Multiple specialists → show a small picker, operator chooses
 *   - Empty or missing → no prompt-edit proposal fires (the grade still gets
 *     recorded for historical tracking but there's no specialist target)
 *
 * Before M2b, this widget hardcoded `agentType: 'orchestrator'` and edited
 * Jasper's Golden Master regardless of which step was graded. That was wrong
 * — it meant the specialist that produced the bad output never learned,
 * because the correction was absorbed by Jasper's top-level orchestrator
 * prompt instead.
 */

import { useState } from 'react';
import StarRating from './StarRating';
import {
  PromptRevisionPopup,
  type PromptRevisionPopupProps,
} from '@/components/training/PromptRevisionPopup';

interface StepGradeWidgetProps {
  missionId: string;
  stepId: string;
  /**
   * The specialist IDs the step's manager delegated to during execution.
   * Populated on the step record by BaseManager's M2a accumulator. Empty
   * array means no specialists were used (direct tool call, pure manager
   * work, or a legacy step from before M2a was deployed). Undefined also
   * means no specialists — treated the same as empty.
   */
  specialistsUsed?: string[];
  existingGrade?: { score: number; explanation?: string };
}

type SubmitState = 'idle' | 'submitting' | 'error';

/**
 * The PromptRevisionPopup expects props in its legacy shape (beforeSection /
 * afterSection / changeDescription / fullRevisedPrompt). My Phase 3 backend
 * returns a richer EditProposedResult object. This adapter type holds both
 * — the full backend object for approve-time round-tripping, plus the
 * flattened strings the popup consumes for display.
 */
interface AdapterProposal {
  feedbackId: string;
  targetSpecialistId: string;
  // Full EditProposedResult from my Phase 3 backend
  rawEdit: {
    status: 'EDIT_PROPOSED';
    targetSection: { headingOrLocation: string; reasoning: string };
    currentText: string;
    proposedText: string;
    rationale: string;
    confidence: number;
    conflictsWithOtherSections: string[];
    preservesBrandDna: true;
  };
  // Flattened strings for the popup
  beforeSection: string;
  afterSection: string;
  changeDescription: string;
  fullRevisedPrompt: string;
}

export default function StepGradeWidget({
  missionId,
  stepId,
  specialistsUsed,
  existingGrade,
}: StepGradeWidgetProps) {
  const [score, setScore] = useState<number>(existingGrade?.score ?? 0);
  const [explanation, setExplanation] = useState<string>(existingGrade?.explanation ?? '');
  const [showReason, setShowReason] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(!!existingGrade);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [proposal, setProposal] = useState<AdapterProposal | null>(null);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // Narrowed-non-null specialist list used by every downstream branch.
  // Defaulting to an empty array keeps the optional-chain checks below
  // from needing `!` assertions.
  const specialists: string[] = specialistsUsed ?? [];

  // Multi-specialist picker — when the step used more than one specialist
  // and the operator adds an explanation, they pick which specialist to
  // target before the Prompt Engineer runs.
  const [chosenSpecialist, setChosenSpecialist] = useState<string>(
    specialists.length === 1 ? specialists[0] : '',
  );

  const hasTargetSpecialist = specialists.length > 0;
  const isMultiSpecialist = specialists.length > 1;

  // ──────────────────────────────────────────────────────────────────────────
  // Submit the grade to missionGrades (always fires, with or without edit flow)
  // ──────────────────────────────────────────────────────────────────────────

  async function submitGradeToFirestore(submittedScore: number): Promise<boolean> {
    setSubmitState('submitting');

    try {
      const authToken =
        typeof window !== 'undefined'
          ? (window as Window & { __jasperAuthToken?: string }).__jasperAuthToken
          : undefined;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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
        return false;
      }

      setSubmitted(true);
      setShowReason(false);
      setSubmitState('idle');
      return true;
    } catch {
      setSubmitState('error');
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Run the Prompt Engineer against the target specialist
  // ──────────────────────────────────────────────────────────────────────────

  async function runPromptEngineer(submittedScore: number, targetSpecialistId: string): Promise<void> {
    const trimmedExplanation = explanation.trim();
    if (!trimmedExplanation) { return; }

    try {
      // targetSpecialistName is the pretty version for display. The backend
      // normalizes on targetSpecialistId anyway, so a best-effort humanized
      // fallback is fine.
      const targetSpecialistName = targetSpecialistId
        .split('_')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');

      // We don't have the step's raw output text here — the detail panel
      // renders displayStep.toolResult but doesn't pass it to this widget.
      // Use a best-effort excerpt: the explanation plus a note that the
      // reviewer is grading the output from THIS specific step.
      // TODO (future): pass toolResult down as a prop so the Prompt Engineer
      // has the exact specialist output to reference.
      const sourceReportExcerpt = `[Step ${stepId} output — graded ${submittedScore}/5]\n\nOperator correction: ${trimmedExplanation}`;

      const gradeRes = await fetch('/api/training/grade-specialist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetSpecialistId,
          targetSpecialistName,
          sourceReportTaskId: stepId,
          sourceReportExcerpt,
          grade: submittedScore <= 2 ? 'reject' : 'request_revision',
          explanation: trimmedExplanation,
        }),
      });

      if (!gradeRes.ok) {
        return;
      }

      const gradeJson = await gradeRes.json() as {
        success: boolean;
        result?: {
          status: 'EDIT_PROPOSED' | 'CLARIFICATION_NEEDED';
          feedbackId: string;
          proposedEdit?: AdapterProposal['rawEdit'];
          targetSpecialistCurrentPrompt?: string;
        };
      };

      if (!gradeJson.success || gradeJson.result?.status !== 'EDIT_PROPOSED') {
        // CLARIFICATION_NEEDED path: we could show the questions inline, but
        // for M2b we just silently skip the popup. The feedback record is
        // still created and marked clarification_needed on the backend.
        return;
      }

      const result = gradeJson.result;
      const edit = result.proposedEdit;
      if (!edit) { return; }
      const currentPrompt = result.targetSpecialistCurrentPrompt ?? '';

      // Construct fullRevisedPrompt by substituting proposedText into the
      // current full prompt. The popup's approve path uses this for
      // display + substitution, but we route our own approve logic through
      // the backend's approvedEdit path anyway.
      const fullRevisedPrompt = currentPrompt.includes(edit.currentText)
        ? currentPrompt.replace(edit.currentText, edit.proposedText)
        : `${currentPrompt}\n\n[Proposed rewrite at ${edit.targetSection.headingOrLocation}]\n${edit.proposedText}`;

      setProposal({
        feedbackId: result.feedbackId,
        targetSpecialistId,
        rawEdit: edit,
        beforeSection: edit.currentText,
        afterSection: edit.proposedText,
        changeDescription: edit.rationale,
        fullRevisedPrompt,
      });
    } catch {
      // Non-critical — grade already succeeded
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Approve / Reject the Prompt Engineer's proposal
  // ──────────────────────────────────────────────────────────────────────────

  const handleApproveProposal: PromptRevisionPopupProps['onApprove'] = (
    _fullRevisedPrompt,
    _changeDescription,
    source,
    newProposedText,
  ) => {
    void (async () => {
      if (!proposal) { return; }
      setIsApplying(true);

      try {
        const authToken =
          typeof window !== 'undefined'
            ? (window as Window & { __jasperAuthToken?: string }).__jasperAuthToken
            : undefined;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Build the approvedEdit body for the Phase 3 backend. The popup tells
        // us whether the operator picked the agent's suggestion or wrote their
        // own, and `newProposedText` is the resolved new section text either
        // way. We use the stored rawEdit as the base and override proposedText.
        const approvedEdit = {
          ...proposal.rawEdit,
          proposedText: newProposedText ?? proposal.rawEdit.proposedText,
        };

        await fetch(`/api/training/feedback/${proposal.feedbackId}/approve`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ approvedEdit }),
        });
        // Source telemetry (agent vs user rewrite) is captured in the
        // backend TrainingFeedback record via the approvedEdit.proposedText
        // diff. No client-side log needed.
        void source;
      } finally {
        setIsApplying(false);
        setProposal(null);
      }
    })();
  };

  const handleRejectProposal: PromptRevisionPopupProps['onReject'] = () => {
    void (async () => {
      if (!proposal) { return; }
      try {
        const authToken =
          typeof window !== 'undefined'
            ? (window as Window & { __jasperAuthToken?: string }).__jasperAuthToken
            : undefined;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        await fetch(`/api/training/feedback/${proposal.feedbackId}/reject`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            reason: 'Operator chose to keep current prompt via 3-box popup.',
          }),
        });
      } finally {
        setProposal(null);
      }
    })();
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Star click: quick submit without explanation (no Prompt Engineer)
  // ──────────────────────────────────────────────────────────────────────────

  function handleStarChange(newScore: number): void {
    setScore(newScore);
    // Auto-submit the rating only. No explanation means no Prompt Engineer
    // fires. The operator can still click "Why?" afterward to add a reason.
    void submitGradeToFirestore(newScore);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Save button inside the expanded reason form: submit grade + run Prompt Engineer
  // ──────────────────────────────────────────────────────────────────────────

  function handleSaveWithReason(): void {
    void (async () => {
      if (score === 0) { return; }

      const ok = await submitGradeToFirestore(score);
      if (!ok) { return; }

      const trimmed = explanation.trim();
      if (!trimmed) { return; }

      const target = hasTargetSpecialist
        ? (isMultiSpecialist ? chosenSpecialist : specialists[0])
        : null;

      if (target) {
        await runPromptEngineer(score, target);
      }
      // If no target (legacy step, empty specialistsUsed), the grade is
      // recorded to missionGrades but no Prompt Engineer fires. Honest
      // behavior: not every step has a prompt-editable target.
    })();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

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

            {/* Multi-specialist picker — only when the step used more than one */}
            {isMultiSpecialist && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label
                  htmlFor={`step-grade-target-${stepId}`}
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Apply correction to:
                </label>
                <select
                  id={`step-grade-target-${stepId}`}
                  value={chosenSpecialist}
                  onChange={(e) => setChosenSpecialist(e.target.value)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    color: 'var(--color-text-primary)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '0.3125rem',
                  }}
                >
                  <option value="">— pick specialist —</option>
                  {specialists.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            {!hasTargetSpecialist && (
              <p
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                }}
              >
                This step has no specialist target — the grade will be recorded
                but no prompt edit will be proposed.
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={submitState === 'submitting' || (isMultiSpecialist && !chosenSpecialist)}
                onClick={handleSaveWithReason}
                style={{
                  padding: '0.25rem 0.625rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: '#fff',
                  background:
                    submitState === 'submitting' || (isMultiSpecialist && !chosenSpecialist)
                      ? 'var(--color-text-disabled)'
                      : 'var(--color-primary)',
                  border: 'none',
                  borderRadius: '0.3125rem',
                  cursor:
                    submitState === 'submitting' || (isMultiSpecialist && !chosenSpecialist)
                      ? 'not-allowed'
                      : 'pointer',
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

      {proposal !== null && (
        <PromptRevisionPopup
          isOpen
          onClose={() => setProposal(null)}
          onApprove={handleApproveProposal}
          onReject={handleRejectProposal}
          agentType={proposal.targetSpecialistId}
          beforeSection={proposal.beforeSection}
          afterSection={proposal.afterSection}
          changeDescription={proposal.changeDescription}
          fullRevisedPrompt={proposal.fullRevisedPrompt}
          isApplying={isApplying}
        />
      )}
    </>
  );
}
