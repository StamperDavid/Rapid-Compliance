/**
 * PlanReviewPanel — Mission Control panel for reviewing a draft mission plan
 *
 * Renders when a Mission is in PLAN_PENDING_APPROVAL status (M4). Lets the
 * operator edit each step's summary and tool args, reorder the steps,
 * delete a step, approve the whole plan to start execution, or reject
 * the plan to scrap the mission entirely.
 *
 * Calls these endpoints:
 *   POST /api/orchestrator/missions/{missionId}/plan/edit-step
 *   POST /api/orchestrator/missions/{missionId}/plan/reorder
 *   POST /api/orchestrator/missions/{missionId}/plan/delete-step
 *   POST /api/orchestrator/missions/{missionId}/plan/approve
 *   POST /api/orchestrator/missions/{missionId}/plan/reject
 *
 * After any successful mutation, calls onPlanChanged() so the parent
 * page can refetch the mission and re-render.
 */

'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import type { Mission, MissionStep } from '@/lib/orchestrator/mission-persistence';

interface PlanReviewPanelProps {
  mission: Mission;
  onPlanChanged: () => void;
}

function formatToolName(toolName: string): string {
  return toolName
    .replace(/^delegate_to_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PlanReviewPanel({ mission, onPlanChanged }: PlanReviewPanelProps) {
  const authFetch = useAuthFetch();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editSummary, setEditSummary] = useState('');
  const [editToolArgs, setEditToolArgs] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmDeleteStepId, setConfirmDeleteStepId] = useState<string | null>(null);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);

  const handleEditClick = useCallback((step: MissionStep) => {
    setEditingStepId(step.stepId);
    setEditSummary(step.summary ?? '');
    setEditToolArgs(JSON.stringify(step.toolArgs ?? {}, null, 2));
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditingStepId(null);
    setEditSummary('');
    setEditToolArgs('');
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingStepId) { return; }
    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = JSON.parse(editToolArgs) as Record<string, unknown>;
    } catch {
      toast.error('Tool arguments must be valid JSON');
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(`/api/orchestrator/missions/${mission.missionId}/plan/edit-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: editingStepId,
          updates: { summary: editSummary, toolArgs: parsedArgs },
        }),
      });
      const body = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !body.success) {
        toast.error(body.error ?? `Edit failed: HTTP ${res.status}`);
        return;
      }
      toast.success('Step updated');
      handleEditCancel();
      onPlanChanged();
    } finally {
      setBusy(false);
    }
  }, [authFetch, editingStepId, editSummary, editToolArgs, mission.missionId, toast, handleEditCancel, onPlanChanged]);

  const handleMove = useCallback(async (stepId: string, direction: 'up' | 'down') => {
    const ids = mission.steps.map((s) => s.stepId);
    const idx = ids.indexOf(stepId);
    if (idx === -1) { return; }
    if (direction === 'up' && idx === 0) { return; }
    if (direction === 'down' && idx === ids.length - 1) { return; }
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];

    setBusy(true);
    try {
      const res = await authFetch(`/api/orchestrator/missions/${mission.missionId}/plan/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOrder: ids }),
      });
      const body = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !body.success) {
        toast.error(body.error ?? `Reorder failed: HTTP ${res.status}`);
        return;
      }
      onPlanChanged();
    } finally {
      setBusy(false);
    }
  }, [authFetch, mission.missionId, mission.steps, toast, onPlanChanged]);

  const handleDeleteRequest = useCallback((stepId: string) => {
    if (mission.steps.length <= 1) {
      toast.error('Cannot delete the last step. Reject the whole plan instead.');
      return;
    }
    setConfirmDeleteStepId(stepId);
  }, [mission.steps.length, toast]);

  const handleDeleteConfirmed = useCallback(async () => {
    const stepId = confirmDeleteStepId;
    if (!stepId) { return; }
    setBusy(true);
    try {
      const res = await authFetch(`/api/orchestrator/missions/${mission.missionId}/plan/delete-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId }),
      });
      const body = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !body.success) {
        toast.error(body.error ?? `Delete failed: HTTP ${res.status}`);
        return;
      }
      toast.success('Step deleted');
      setConfirmDeleteStepId(null);
      onPlanChanged();
    } finally {
      setBusy(false);
    }
  }, [authFetch, confirmDeleteStepId, mission.missionId, toast, onPlanChanged]);

  const handleApprove = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/orchestrator/missions/${mission.missionId}/plan/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as { success: boolean; error?: string; status?: string };
      if (!res.ok || !body.success) {
        toast.error(body.error ?? `Approve failed: HTTP ${res.status}`);
        return;
      }
      toast.success(`Plan approved — mission ${body.status?.toLowerCase() ?? 'finished'}`);
      setConfirmApproveOpen(false);
      onPlanChanged();
    } finally {
      setBusy(false);
    }
  }, [authFetch, mission.missionId, toast, onPlanChanged]);

  const handleReject = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/orchestrator/missions/${mission.missionId}/plan/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rejectReason ? { reason: rejectReason } : {}),
      });
      const body = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !body.success) {
        toast.error(body.error ?? `Reject failed: HTTP ${res.status}`);
        return;
      }
      toast.success('Plan rejected — mission scrapped');
      setShowRejectBox(false);
      setRejectReason('');
      onPlanChanged();
    } finally {
      setBusy(false);
    }
  }, [authFetch, mission.missionId, rejectReason, toast, onPlanChanged]);

  return (
    <div className="p-4 space-y-4">
      <Card className="border-warning border-2">
        <CardHeader>
          <CardTitle className="text-lg">Draft Plan — Needs Your Review</CardTitle>
          <CardDescription>
            Jasper has drafted {mission.steps.length} step{mission.steps.length === 1 ? '' : 's'} for this mission.
            Review each step, edit anything you want changed, reorder if needed, then approve to start execution.
            Nothing has run yet.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {mission.steps.map((step, idx) => {
          const isEditing = editingStepId === step.stepId;
          return (
            <Card key={step.stepId} className="border-border-strong">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{formatToolName(step.toolName)}</div>
                      <div className="text-xs text-muted-foreground">
                        {step.delegatedTo.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy || idx === 0}
                      onClick={() => void handleMove(step.stepId, 'up')}
                      title="Move up"
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy || idx === mission.steps.length - 1}
                      onClick={() => void handleMove(step.stepId, 'down')}
                      title="Move down"
                    >
                      ↓
                    </Button>
                    {!isEditing && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleEditClick(step)}
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy || mission.steps.length <= 1}
                      onClick={() => handleDeleteRequest(step.stepId)}
                      title={mission.steps.length <= 1 ? 'Cannot delete the last step' : 'Delete this step'}
                      className="text-destructive hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-3 space-y-2">
                {isEditing ? (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground" htmlFor={`summary-${step.stepId}`}>
                        Summary
                      </label>
                      <Textarea
                        id={`summary-${step.stepId}`}
                        value={editSummary}
                        onChange={(e) => setEditSummary(e.target.value)}
                        rows={2}
                        disabled={busy}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground" htmlFor={`args-${step.stepId}`}>
                        Tool Arguments (JSON)
                      </label>
                      <Textarea
                        id={`args-${step.stepId}`}
                        value={editToolArgs}
                        onChange={(e) => setEditToolArgs(e.target.value)}
                        rows={6}
                        disabled={busy}
                        className="mt-1 font-mono text-xs"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button type="button" size="sm" disabled={busy} onClick={() => void handleEditSave()}>
                        Save changes
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={handleEditCancel}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-foreground">
                      {step.summary ?? <span className="italic text-muted-foreground">No summary</span>}
                    </div>
                    {step.specialistsUsed && step.specialistsUsed.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Specialists: {step.specialistsUsed.join(', ')}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border-strong">
        <CardContent className="pt-4 pb-4">
          {!showRejectBox ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setShowRejectBox(true)}
                className="text-destructive hover:text-destructive"
              >
                Scrap this mission
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => setConfirmApproveOpen(true)}
              >
                Approve plan and run all {mission.steps.length} step{mission.steps.length === 1 ? '' : 's'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">Why are you scrapping this mission?</div>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Optional — your reason will be saved with the mission for your own reference."
                rows={3}
                disabled={busy}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => { setShowRejectBox(false); setRejectReason(''); }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleReject()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Confirm scrap
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDeleteStepId !== null}
        onClose={() => setConfirmDeleteStepId(null)}
        onConfirm={handleDeleteConfirmed}
        title="Delete this step?"
        description="The step will be removed from the plan. You can still scrap the whole mission later if you change your mind."
        confirmLabel="Delete step"
        variant="destructive"
        loading={busy}
      />

      <ConfirmDialog
        open={confirmApproveOpen}
        onClose={() => setConfirmApproveOpen(false)}
        onConfirm={handleApprove}
        title="Approve plan and run all steps?"
        description={
          `${mission.steps.length} step${mission.steps.length === 1 ? '' : 's'} will run sequentially as soon as you confirm. ` +
          'You can scrap the mission from Mission Control if it goes wrong.'
        }
        confirmLabel="Approve and run"
        variant="default"
        loading={busy}
      />
    </div>
  );
}
