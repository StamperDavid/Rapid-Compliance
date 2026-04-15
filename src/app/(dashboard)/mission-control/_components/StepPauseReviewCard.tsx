/**
 * StepPauseReviewCard — inline review card for a paused mission step (M3)
 *
 * Renders when a mission step is in AWAITING_APPROVAL status as part of
 * a plan-based mission (M4 → M3). Shows the operator the step's result
 * and lets them either approve and continue (which runs the next step)
 * or rerun the same step, optionally with edited tool arguments.
 *
 * Endpoints called:
 *   POST /api/orchestrator/missions/{missionId}/steps/{stepId}/approve
 *   POST /api/orchestrator/missions/{missionId}/steps/{stepId}/rerun
 *
 * After any successful action, calls onChanged() so the parent page
 * can refetch the mission and re-render.
 *
 * NOTE: this component is intentionally separate from the legacy
 * ApprovalCard, which is wired to the dead JasperCommandAuthority
 * approval queue. The dead system never integrated with mission steps,
 * so replacing it for the mission surface is safe. ApprovalCard stays
 * in the codebase pending the post-M3 cleanup pass.
 */

'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import type { MissionStep } from '@/lib/orchestrator/mission-persistence';

interface StepPauseReviewCardProps {
  missionId: string;
  step: MissionStep;
  /** Index of this step in the mission (1-based) for display only */
  stepIndex: number;
  /** Total number of steps in the mission for display only */
  totalSteps: number;
  /** Called after a successful approve or rerun so the page can refetch */
  onChanged: () => void;
}

function tryFormatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export default function StepPauseReviewCard({
  missionId,
  step,
  stepIndex,
  totalSteps,
  onChanged,
}: StepPauseReviewCardProps) {
  const authFetch = useAuthFetch();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [showEditArgs, setShowEditArgs] = useState(false);
  const [editedArgsText, setEditedArgsText] = useState(
    JSON.stringify(step.toolArgs ?? {}, null, 2),
  );
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);

  const isLastStep = stepIndex === totalSteps;
  const hasError = step.error !== undefined && step.error.length > 0;

  const handleApproveConfirmed = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/orchestrator/missions/${missionId}/steps/${step.stepId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as {
        success: boolean;
        error?: string;
        nextStepId?: string | null;
        missionStatus?: string;
      };
      if (!res.ok || !body.success) {
        toast.error(body.error ?? `Approve failed: HTTP ${res.status}`);
        return;
      }
      if (body.nextStepId === null) {
        toast.success(`Mission finished — ${body.missionStatus?.toLowerCase() ?? 'done'}`);
      } else {
        toast.success(`Step approved — running next step`);
      }
      setConfirmApproveOpen(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }, [authFetch, missionId, step.stepId, toast, onChanged]);

  const handleRerun = useCallback(async (withEditedArgs: boolean) => {
    let bodyPayload: Record<string, unknown> = {};
    if (withEditedArgs) {
      try {
        const parsedArgs = JSON.parse(editedArgsText) as Record<string, unknown>;
        bodyPayload = { newToolArgs: parsedArgs };
      } catch {
        toast.error('Tool arguments must be valid JSON');
        return;
      }
    }

    setBusy(true);
    try {
      const res = await authFetch(`/api/orchestrator/missions/${missionId}/steps/${step.stepId}/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const body = (await res.json()) as { success: boolean; error?: string; stepError?: string };
      if (!res.ok || !body.success) {
        toast.error(body.error ?? `Rerun failed: HTTP ${res.status}`);
        return;
      }
      if (body.stepError) {
        toast.error(`Step ran but returned an error: ${body.stepError}`);
      } else {
        toast.success('Step rerun complete');
      }
      setShowEditArgs(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }, [authFetch, missionId, step.stepId, editedArgsText, toast, onChanged]);

  const formattedResult = step.toolResult ? tryFormatJson(step.toolResult) : '';

  return (
    <Card className={`border-2 ${hasError ? 'border-destructive' : 'border-warning'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              Step {stepIndex} of {totalSteps} — Needs Your Review
            </CardTitle>
            <CardDescription className="text-xs">
              {hasError
                ? 'This step finished with an error. Review and decide whether to approve as-is or rerun.'
                : 'This step finished. Review the result, then approve to run the next step or rerun this one.'}
            </CardDescription>
          </div>
          {step.durationMs !== undefined && (
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {(step.durationMs / 1000).toFixed(1)}s
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {hasError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <div className="text-xs font-semibold uppercase text-destructive mb-1">Error</div>
            <div className="text-sm text-foreground whitespace-pre-wrap break-words">{step.error}</div>
          </div>
        )}

        {formattedResult && (
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Result</div>
            <pre className="rounded-md border border-border-strong bg-surface-elevated p-3 text-xs text-foreground whitespace-pre-wrap break-words max-h-96 overflow-y-auto font-mono">
              {formattedResult}
            </pre>
          </div>
        )}

        {showEditArgs && (
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
              Edited Tool Arguments (JSON)
            </div>
            <Textarea
              value={editedArgsText}
              onChange={(e) => setEditedArgsText(e.target.value)}
              rows={6}
              disabled={busy}
              className="font-mono text-xs"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {!showEditArgs ? (
            <>
              <Button
                type="button"
                disabled={busy}
                onClick={() => setConfirmApproveOpen(true)}
              >
                {isLastStep ? 'Approve and finish mission' : 'Approve and run next step'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void handleRerun(false)}
              >
                Rerun this step as-is
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setShowEditArgs(true)}
              >
                Edit arguments and rerun
              </Button>
            </>
          ) : (
            <>
              <Button type="button" disabled={busy} onClick={() => void handleRerun(true)}>
                Save edits and rerun
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setShowEditArgs(false);
                  setEditedArgsText(JSON.stringify(step.toolArgs ?? {}, null, 2));
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmApproveOpen}
        onClose={() => setConfirmApproveOpen(false)}
        onConfirm={handleApproveConfirmed}
        title={isLastStep ? 'Approve and finish mission?' : 'Approve and run next step?'}
        description={
          isLastStep
            ? 'This is the last step. Approving will finalize the mission as completed.'
            : `Approving will mark this step done and immediately run step ${stepIndex + 1} of ${totalSteps}. The next step will pause for review when it finishes.`
        }
        confirmLabel={isLastStep ? 'Finish mission' : 'Approve and run next'}
        variant="default"
        loading={busy}
      />
    </Card>
  );
}
