'use client';

/**
 * InlineReviewCard — embeddable mission-step review card.
 *
 * Renders a single AWAITING_APPROVAL mission step inline inside a platform
 * dashboard so the operator can review (and act on) Jasper's pending work
 * without navigating away to Mission Control.
 *
 * Props:
 *   step        — the FAILED MissionStep that halted the mission
 *   missionId   — the parent mission's ID (for API calls)
 *   platform    — the social platform the mission is targeting
 *   onOpenFullMode  — callback to navigate to the full Mission Control view
 *   stepGrades  — pre-fetched grade entries keyed by stepId
 *   onGradeSubmitted — callback after the operator submits a grade
 *
 * Layout:
 *   AgentAvatar + tool name header
 *   → "Open in Mission Control" link
 *   → step.summary
 *   → DetailOutputRenderer (if toolResult present)
 *   → ManualEditOutputBox (COMPLETED/FAILED steps)
 *   → StepGradeWidget (COMPLETED steps)
 *   → SpecialistVersionHistory (one button per specialist used)
 *
 * Standing Rule #2 is upheld: grading flows through the existing
 * StepGradeWidget which routes to the correct specialist via the
 * grade-specialist API — no direct GM modification here.
 */

import { useState } from 'react';
import AgentAvatar from '@/app/(dashboard)/mission-control/_components/AgentAvatar';
import StepGradeWidget from '@/app/(dashboard)/mission-control/_components/StepGradeWidget';
import SpecialistVersionHistory from '@/app/(dashboard)/mission-control/_components/SpecialistVersionHistory';
import { formatToolName } from '@/app/(dashboard)/mission-control/_components/dashboard-links';
import { DetailOutputRenderer } from '@/components/mission-control/DetailOutputRenderer';
import { ManualEditOutputBox } from '@/components/mission-control/ManualEditOutputBox';
import type { MissionStep } from '@/lib/orchestrator/mission-persistence';
import type { SocialPlatform } from '@/types/social';

// ============================================================================
// TYPES
// ============================================================================

interface GradeEntry {
  score: number;
  explanation?: string;
}

interface InlineReviewCardProps {
  step: MissionStep;
  missionId: string;
  platform: SocialPlatform;
  onOpenFullMode?: () => void;
  stepGrades?: Record<string, GradeEntry>;
  onGradeSubmitted?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function InlineReviewCard({
  step,
  missionId,
  platform: _platform,
  onOpenFullMode,
  stepGrades = {},
  onGradeSubmitted: _onGradeSubmitted,
}: InlineReviewCardProps) {
  // Specialist version history — which specialist's history panel is open
  const [historyForSpecialist, setHistoryForSpecialist] = useState<string | null>(null);

  const isCompleted = step.status === 'COMPLETED';
  const isFailed = step.status === 'FAILED';
  const existingGrade = stepGrades[step.stepId];

  // Border accent: warning-colored border when the step needs attention
  const borderClass = isFailed
    ? 'border-warning border-2'
    : 'border-border-light';

  return (
    <div className={`rounded-2xl border bg-card p-4 ${borderClass}`}>
      {/* ── Header: avatar + tool name + MC link ───────────────────────── */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AgentAvatar delegatedTo={step.delegatedTo} size={28} />
          <div>
            <div className="text-sm font-semibold text-foreground">
              {formatToolName(step.toolName)}
            </div>
            <div className="text-xs text-muted-foreground">
              {step.delegatedTo.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </div>
          </div>
        </div>

        {onOpenFullMode && (
          <button
            type="button"
            onClick={onOpenFullMode}
            className="shrink-0 rounded border border-border-strong bg-transparent px-2.5 py-1 text-[0.6875rem] font-semibold text-muted-foreground hover:text-foreground"
          >
            Open in Mission Control &rarr;
          </button>
        )}
      </div>

      {/* ── Needs-attention badge (FAILED step) ────────────────────────── */}
      {isFailed && (
        <div className="mb-3 rounded-lg border border-warning bg-warning/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-warning">
          Needs your review
        </div>
      )}

      {/* ── Summary ────────────────────────────────────────────────────── */}
      {step.summary && (
        <div className="mb-3 rounded-lg bg-surface-elevated px-3 py-2 text-[0.8125rem] leading-relaxed text-foreground">
          {step.summary}
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {step.error && (
        <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[0.8125rem] leading-relaxed text-destructive">
          {step.error}
        </div>
      )}

      {/* ── Rich output ────────────────────────────────────────────────── */}
      {step.toolResult && (
        <div className="mb-3">
          <DetailOutputRenderer toolResult={step.toolResult} />
        </div>
      )}

      {/* ── Manual edit (COMPLETED or FAILED steps) ────────────────────── */}
      {(isCompleted || isFailed) && (
        <ManualEditOutputBox
          missionId={missionId}
          stepId={step.stepId}
          currentResult={step.toolResult ?? ''}
          isManuallyEdited={step.manuallyEdited === true}
        />
      )}

      {/* ── Grade widget (COMPLETED steps only) ────────────────────────── */}
      {isCompleted && (
        <div className="mt-3 border-t border-border-light pt-3">
          <div className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
            Rate this step
          </div>
          <StepGradeWidget
            missionId={missionId}
            stepId={step.stepId}
            specialistsUsed={step.specialistsUsed}
            existingGrade={existingGrade}
          />
        </div>
      )}

      {/* ── Specialist version history ──────────────────────────────────── */}
      {isCompleted && step.specialistsUsed && step.specialistsUsed.length > 0 && (
        <div className="mt-3 border-t border-border-light pt-3">
          <div className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
            Specialists used
          </div>
          <div className="flex flex-wrap gap-1.5">
            {step.specialistsUsed.map((sid) => (
              <button
                key={sid}
                type="button"
                onClick={() => setHistoryForSpecialist(historyForSpecialist === sid ? null : sid)}
                className={[
                  'rounded border px-2 py-0.5 text-[0.6875rem] font-medium',
                  historyForSpecialist === sid
                    ? 'border-primary text-primary'
                    : 'border-border-light text-muted-foreground',
                ].join(' ')}
              >
                {sid} — history
              </button>
            ))}
          </div>
          {historyForSpecialist && (
            <div className="mt-2">
              <SpecialistVersionHistory
                specialistId={historyForSpecialist}
                onClose={() => setHistoryForSpecialist(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InlineReviewCard;
