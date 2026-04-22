/**
 * JasperPlanFeedbackBanner — Mission Control top-of-panel banner
 *
 * Surfaces pending Jasper (Orchestrator) plan-correction proposals produced by
 * the Prompt Engineer in response to operator edits of Jasper's mission plans.
 * Mirrors the Mission Control M1 "3-box picker" pattern: Keep current rejects,
 * Accept Jasper's suggestion approves as-is, My rewrite approves with an
 * operator-authored override.
 *
 * Collapsed by default (1-line summary card). Expands to a stack of mini-cards,
 * each showing the before/after step diff, Jasper's proposed prompt edit, and a
 * 3-box picker with action buttons.
 *
 * Polls /api/training/jasper-plan-feedback every 30 seconds while mounted, same
 * cadence as the mission sidebar.
 *
 * Self-hides when no proposals are pending — returns null, renders nothing.
 *
 * Endpoints consumed:
 *   GET  /api/training/jasper-plan-feedback
 *   POST /api/training/jasper-plan-feedback/[feedbackId]/approve
 *   POST /api/training/jasper-plan-feedback/[feedbackId]/reject
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionTitle, SubsectionTitle, Caption } from '@/components/ui/typography';
import { Textarea } from '@/components/ui/textarea';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// TYPES
// ============================================================================

interface JasperPlanFeedbackProposal {
  changeDescription: string;
  currentText: string;
  proposedText: string;
  rationale: string;
  confidence: number;
  preservesBrandDna: boolean;
}

interface JasperPlanFeedbackStepSnapshot {
  toolName: string;
  summary?: string;
  toolArgs?: Record<string, unknown>;
}

interface JasperPlanFeedbackRecord {
  id: string;
  missionId: string;
  stepId: string;
  targetSpecialistName: string;
  before: JasperPlanFeedbackStepSnapshot;
  after: JasperPlanFeedbackStepSnapshot;
  correction: string;
  proposal: JasperPlanFeedbackProposal;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied';
  createdAt: string;
}

interface ListResponse {
  success: boolean;
  feedback?: JasperPlanFeedbackRecord[];
  error?: string;
}

interface ApproveResponse {
  success: boolean;
  newGMVersion?: number | string;
  newGMDocId?: string;
  error?: string;
}

interface RejectResponse {
  success: boolean;
  error?: string;
}

type PickerChoice = 'keep' | 'agent' | 'user';

interface ProposalUiState {
  choice: PickerChoice;
  overrideText: string;
  rejectReason: string;
  showRejectBox: boolean;
  inFlight: boolean;
  errorMessage: string | null;
}

function defaultUiState(proposedText: string): ProposalUiState {
  return {
    choice: 'agent',
    overrideText: proposedText,
    rejectReason: '',
    showRejectBox: false,
    inFlight: false,
    errorMessage: null,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

const POLL_INTERVAL_MS = 30_000;

function formatRelativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return 'just now';
  }
  const deltaMs = Date.now() - then;
  if (deltaMs < 0) {
    return 'just now';
  }
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function missionShortId(missionId: string): string {
  return missionId.length > 6 ? missionId.slice(-6) : missionId;
}

function formatToolArgs(args: Record<string, unknown> | undefined): string {
  if (!args || Object.keys(args).length === 0) {
    return '(no arguments)';
  }
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return '(unserializable arguments)';
  }
}

// ============================================================================
// STEP SNAPSHOT SUBCOMPONENT
// ============================================================================

function StepSnapshotColumn({
  heading,
  snapshot,
}: {
  heading: string;
  snapshot: JasperPlanFeedbackStepSnapshot;
}) {
  return (
    <div className="rounded-lg border border-border-light bg-surface-elevated p-3 space-y-2">
      <Caption className="uppercase tracking-wide font-semibold">{heading}</Caption>
      <div>
        <div className="text-xs font-semibold text-muted-foreground">Tool</div>
        <div className="text-sm font-mono text-foreground break-all">{snapshot.toolName}</div>
      </div>
      {snapshot.summary && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground">Summary</div>
          <div className="text-sm text-foreground">{snapshot.summary}</div>
        </div>
      )}
      <div>
        <div className="text-xs font-semibold text-muted-foreground">Arguments</div>
        <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground bg-card border border-border-light rounded p-2 max-h-48 overflow-auto">
          {formatToolArgs(snapshot.toolArgs)}
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function JasperPlanFeedbackBanner() {
  const authFetch = useAuthFetch();
  const toast = useToast();

  const [proposals, setProposals] = useState<JasperPlanFeedbackRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [listError, setListError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [uiStateByProposal, setUiStateByProposal] = useState<Record<string, ProposalUiState>>({});

  // --------------------------------------------------------------------------
  // Fetch + poll
  // --------------------------------------------------------------------------

  const fetchProposals = useCallback(async () => {
    try {
      const res = await authFetch('/api/training/jasper-plan-feedback');
      const body = (await res.json()) as ListResponse;
      if (!res.ok || !body.success) {
        const errorMessage = body.error ?? `Failed to load Jasper feedback: HTTP ${res.status}`;
        setListError(errorMessage);
        return;
      }
      setListError(null);
      const next = body.feedback ?? [];
      setProposals(next);
      // Seed UI state for any new proposals. Preserve existing state for
      // proposals still in the list (the operator may have typed in the
      // override textarea and the poll shouldn't wipe it).
      setUiStateByProposal((prev) => {
        const merged: Record<string, ProposalUiState> = {};
        for (const p of next) {
          merged[p.id] = prev[p.id] ?? defaultUiState(p.proposal.proposedText);
        }
        return merged;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setListError(message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchProposals();
    const timer = setInterval(() => {
      void fetchProposals();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchProposals]);

  // --------------------------------------------------------------------------
  // Derived
  // --------------------------------------------------------------------------

  const pending = useMemo(
    () => proposals.filter((p) => p.status === 'pending_review'),
    [proposals],
  );

  // --------------------------------------------------------------------------
  // UI state mutators
  // --------------------------------------------------------------------------

  const patchUiState = useCallback((proposalId: string, patch: Partial<ProposalUiState>) => {
    setUiStateByProposal((prev) => {
      const current = prev[proposalId];
      if (!current) {
        return prev;
      }
      return { ...prev, [proposalId]: { ...current, ...patch } };
    });
  }, []);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const handleApprove = useCallback(
    async (proposal: JasperPlanFeedbackRecord) => {
      const state = uiStateByProposal[proposal.id];
      if (!state) { return; }

      // Determine override payload based on choice.
      let proposedTextOverride: string | undefined;
      if (state.choice === 'user') {
        const trimmed = state.overrideText.trim();
        if (trimmed.length < 10) {
          patchUiState(proposal.id, {
            errorMessage: 'Your rewrite must be at least 10 characters.',
          });
          return;
        }
        proposedTextOverride = trimmed;
      } else {
        proposedTextOverride = undefined;
      }

      patchUiState(proposal.id, { inFlight: true, errorMessage: null });
      try {
        const res = await authFetch(
          `/api/training/jasper-plan-feedback/${proposal.id}/approve`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              proposedTextOverride !== undefined ? { proposedTextOverride } : {},
            ),
          },
        );
        const body = (await res.json()) as ApproveResponse;
        if (!res.ok || !body.success) {
          const errorMessage = body.error ?? `Approve failed: HTTP ${res.status}`;
          patchUiState(proposal.id, { inFlight: false, errorMessage });
          return;
        }
        const versionLabel =
          body.newGMVersion !== undefined ? String(body.newGMVersion) : '(new)';
        toast.success(`New Jasper GM version ${versionLabel} deployed`);
        await fetchProposals();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        patchUiState(proposal.id, { inFlight: false, errorMessage: message });
      }
    },
    [authFetch, fetchProposals, patchUiState, toast, uiStateByProposal],
  );

  const handleReject = useCallback(
    async (proposal: JasperPlanFeedbackRecord) => {
      const state = uiStateByProposal[proposal.id];
      if (!state) { return; }

      patchUiState(proposal.id, { inFlight: true, errorMessage: null });
      try {
        const trimmedReason = state.rejectReason.trim();
        const res = await authFetch(
          `/api/training/jasper-plan-feedback/${proposal.id}/reject`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trimmedReason ? { reason: trimmedReason } : {}),
          },
        );
        const body = (await res.json()) as RejectResponse;
        if (!res.ok || !body.success) {
          const errorMessage = body.error ?? `Reject failed: HTTP ${res.status}`;
          patchUiState(proposal.id, { inFlight: false, errorMessage });
          return;
        }
        toast.success('Jasper proposal rejected. Golden Master unchanged.');
        await fetchProposals();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        patchUiState(proposal.id, { inFlight: false, errorMessage: message });
      }
    },
    [authFetch, fetchProposals, patchUiState, toast, uiStateByProposal],
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  // Loading-on-first-mount: render nothing. The banner is decorative; it
  // should never cause layout shift while the initial GET is in-flight.
  if (loading && proposals.length === 0 && !listError) {
    return null;
  }

  // Error without any cached proposals: show a small inline retry row.
  if (listError && pending.length === 0) {
    return (
      <Card className="border-border-strong">
        <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-destructive">
            Couldn&apos;t load Jasper plan corrections: {listError}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              void fetchProposals();
            }}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty state: render nothing. The operator's plan review panel is clean.
  if (pending.length === 0) {
    return null;
  }

  // Collapsed state.
  if (!expanded) {
    return (
      <Card className="border-primary border-2">
        <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold text-foreground">
            Jasper has {pending.length} pending plan correction
            {pending.length === 1 ? '' : 's'} from prior edits. Review &rarr; Deploy.
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded(true)}
          >
            Expand
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Expanded state.
  return (
    <Card className="border-primary border-2">
      <CardContent className="pt-4 pb-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionTitle className="text-lg">
            Jasper plan corrections ({pending.length})
          </SectionTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded(false)}
          >
            Collapse
          </Button>
        </div>

        {listError && (
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-md border border-border-light bg-surface-elevated p-2">
            <div className="text-xs text-destructive">
              Last refresh failed: {listError}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void fetchProposals();
              }}
            >
              Retry
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {pending.map((proposal) => {
            const state = uiStateByProposal[proposal.id] ?? defaultUiState(proposal.proposal.proposedText);
            const isSubmittable =
              state.choice === 'keep' ||
              state.choice === 'agent' ||
              (state.choice === 'user' && state.overrideText.trim().length >= 10);

            return (
              <Card key={proposal.id} className="border-border-strong">
                <CardContent className="pt-4 pb-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <SubsectionTitle className="text-base">
                        Correction from mission {missionShortId(proposal.missionId)}, step {proposal.stepId}
                      </SubsectionTitle>
                      <Caption>
                        {proposal.targetSpecialistName} &middot; {formatRelativeTime(proposal.createdAt)}
                      </Caption>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Confidence {proposal.proposal.confidence}%
                      {proposal.proposal.preservesBrandDna ? ' · Brand DNA preserved' : ''}
                    </div>
                  </div>

                  {/* Operator correction */}
                  <div className="rounded-lg border border-border-light bg-surface-elevated p-3">
                    <Caption className="uppercase tracking-wide font-semibold">Your correction</Caption>
                    <div className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                      {proposal.correction}
                    </div>
                  </div>

                  {/* Before / After step diff */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StepSnapshotColumn heading="Before (Jasper's draft)" snapshot={proposal.before} />
                    <StepSnapshotColumn heading="After (your edit)" snapshot={proposal.after} />
                  </div>

                  {/* Jasper's prompt change */}
                  <div className="space-y-2">
                    <SubsectionTitle className="text-base">
                      {proposal.proposal.changeDescription}
                    </SubsectionTitle>
                    <div className="text-xs text-muted-foreground">
                      {proposal.proposal.rationale}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-border-light bg-surface-elevated p-3 space-y-1">
                        <Caption className="uppercase tracking-wide font-semibold">Current prompt text</Caption>
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground max-h-64 overflow-auto">
                          {proposal.proposal.currentText}
                        </pre>
                      </div>
                      <div className="rounded-lg border border-border-light bg-surface-elevated p-3 space-y-1">
                        <Caption className="uppercase tracking-wide font-semibold">Proposed replacement</Caption>
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground max-h-64 overflow-auto">
                          {proposal.proposal.proposedText}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {/* 3-box picker */}
                  <fieldset className="space-y-2" disabled={state.inFlight}>
                    <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      What do you want to do?
                    </legend>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Keep current */}
                      <label
                        htmlFor={`jpfb-${proposal.id}-keep`}
                        className={`cursor-pointer rounded-lg border p-3 flex flex-col gap-1 ${
                          state.choice === 'keep'
                            ? 'border-primary ring-2 ring-primary bg-surface-elevated'
                            : 'border-border-light bg-card hover:border-border-strong'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            id={`jpfb-${proposal.id}-keep`}
                            type="radio"
                            name={`jpfb-${proposal.id}-choice`}
                            value="keep"
                            checked={state.choice === 'keep'}
                            onChange={() => patchUiState(proposal.id, { choice: 'keep' })}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-sm font-semibold text-foreground">Keep current</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Reject the edit. Jasper&apos;s Golden Master stays unchanged.
                        </span>
                      </label>

                      {/* Agent's suggestion */}
                      <label
                        htmlFor={`jpfb-${proposal.id}-agent`}
                        className={`cursor-pointer rounded-lg border p-3 flex flex-col gap-1 ${
                          state.choice === 'agent'
                            ? 'border-primary ring-2 ring-primary bg-surface-elevated'
                            : 'border-border-light bg-card hover:border-border-strong'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            id={`jpfb-${proposal.id}-agent`}
                            type="radio"
                            name={`jpfb-${proposal.id}-choice`}
                            value="agent"
                            checked={state.choice === 'agent'}
                            onChange={() => patchUiState(proposal.id, { choice: 'agent' })}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-sm font-semibold text-foreground">
                            Accept Jasper&apos;s suggestion
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Deploy the proposed replacement as a new GM version.
                        </span>
                      </label>

                      {/* My rewrite */}
                      <label
                        htmlFor={`jpfb-${proposal.id}-user`}
                        className={`cursor-pointer rounded-lg border p-3 flex flex-col gap-1 ${
                          state.choice === 'user'
                            ? 'border-primary ring-2 ring-primary bg-surface-elevated'
                            : 'border-border-light bg-card hover:border-border-strong'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            id={`jpfb-${proposal.id}-user`}
                            type="radio"
                            name={`jpfb-${proposal.id}-choice`}
                            value="user"
                            checked={state.choice === 'user'}
                            onChange={() => patchUiState(proposal.id, { choice: 'user' })}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-sm font-semibold text-foreground">My rewrite</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Approve with your own replacement text (editable below).
                        </span>
                      </label>
                    </div>

                    {/* Override textarea — only meaningful for "user", but keep visible and enabled so operators can edit in place then switch. */}
                    {state.choice === 'user' && (
                      <div className="space-y-1">
                        <label
                          htmlFor={`jpfb-${proposal.id}-override`}
                          className="text-xs font-semibold text-muted-foreground"
                        >
                          Your rewrite (will be sent as proposedTextOverride)
                        </label>
                        <Textarea
                          id={`jpfb-${proposal.id}-override`}
                          value={state.overrideText}
                          onChange={(e) =>
                            patchUiState(proposal.id, {
                              overrideText: e.target.value,
                              errorMessage: null,
                            })
                          }
                          rows={8}
                          className="font-mono text-xs"
                          disabled={state.inFlight}
                        />
                        <Caption>
                          {state.overrideText.trim().length} characters (minimum 10)
                        </Caption>
                      </div>
                    )}
                  </fieldset>

                  {/* Optional reject reason */}
                  {state.choice === 'keep' && state.showRejectBox && (
                    <div className="space-y-1">
                      <label
                        htmlFor={`jpfb-${proposal.id}-reject-reason`}
                        className="text-xs font-semibold text-muted-foreground"
                      >
                        Why are you rejecting this? (optional — saved with the feedback record)
                      </label>
                      <Textarea
                        id={`jpfb-${proposal.id}-reject-reason`}
                        value={state.rejectReason}
                        onChange={(e) =>
                          patchUiState(proposal.id, { rejectReason: e.target.value })
                        }
                        rows={3}
                        disabled={state.inFlight}
                      />
                    </div>
                  )}

                  {/* Inline error for this proposal */}
                  {state.errorMessage && (
                    <div className="text-sm text-destructive">{state.errorMessage}</div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {state.choice === 'keep' ? (
                      <>
                        {!state.showRejectBox ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => patchUiState(proposal.id, { showRejectBox: true })}
                            disabled={state.inFlight}
                          >
                            Add a reason (optional)
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              patchUiState(proposal.id, {
                                showRejectBox: false,
                                rejectReason: '',
                              })
                            }
                            disabled={state.inFlight}
                          >
                            Hide reason box
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          disabled={state.inFlight}
                          onClick={() => void handleReject(proposal)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {state.inFlight ? 'Rejecting…' : 'Reject'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={state.inFlight || !isSubmittable}
                        onClick={() => void handleApprove(proposal)}
                      >
                        {state.inFlight ? 'Deploying…' : 'Approve & Deploy'}
                      </Button>
                    )}
                  </div>

                  {/* Loading skeleton overlay row on the in-flight proposal */}
                  {state.inFlight && (
                    <div className="h-1 w-full rounded bg-surface-elevated overflow-hidden">
                      <div className="h-full w-1/3 bg-primary animate-pulse" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
