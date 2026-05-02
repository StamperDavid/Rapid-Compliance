'use client';

/**
 * Mission Control — Command center for Jasper delegations with per-step progress tracking.
 *
 * 3-panel layout:
 * - Left (280px): Mission list with progress bars, step counts, color-coded status
 * - Center (flex-1): Plan view with step cards, progress bars, dashboard links
 * - Right (340px): Step detail panel with full output, approval UI, dashboard links
 *
 * Uses SSE streaming for the selected mission and adaptive polling for the sidebar list.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useMissionStream } from '@/hooks/useMissionStream';
import MissionSidebar from './_components/MissionSidebar';
import MissionTimeline from './_components/MissionTimeline';
import PlanReviewPanel from './_components/PlanReviewPanel';
// Note: ApprovalCard was deleted from _components in M3.9. The legacy
// approval card was orphaned (its approve button called a route that
// had nothing to do with mission steps). The mission-halt fallback is
// now a simple inline alert — see StepDetailPanel below.
import AgentAvatar from './_components/AgentAvatar';
import CampaignReview from './_components/CampaignReview';
import MissionGradeCard from './_components/MissionGradeCard';
import StepGradeWidget from './_components/StepGradeWidget';
import { SendDmReplyButton } from './_components/SendDmReplyButton';
import SpecialistVersionHistory from './_components/SpecialistVersionHistory';
import ScheduleMissionDialog from './_components/ScheduleMissionDialog';
import { getDashboardLink, getStepReviewLink, formatToolName } from './_components/dashboard-links';
import { PageTitle } from '@/components/ui/typography';
import type { Mission, MissionStep } from '@/lib/orchestrator/mission-persistence';
import { DetailOutputRenderer } from '@/components/mission-control/DetailOutputRenderer';
import { UpstreamChangedBanner } from '@/components/mission-control/UpstreamChangedBanner';
import { ManualEditOutputBox } from '@/components/mission-control/ManualEditOutputBox';

// ============================================================================
// TYPES
// ============================================================================

interface MissionListResponse {
  success: boolean;
  data?: { missions: Mission[]; hasMore: boolean };
}

interface GradeEntry {
  score: number;
  explanation?: string;
}

interface GradeApiGrade {
  stepId?: string;
  score: number;
  explanation?: string;
}

interface GradeApiResponse {
  success: boolean;
  data?: { grades: GradeApiGrade[] };
}

// ============================================================================
// COLLAPSIBLE SECTION
// ============================================================================

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: '0.75rem' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: 'var(--color-text-secondary)',
          padding: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          font: 'inherit',
        }}
      >
        <span style={{
          display: 'inline-block',
          transition: 'transform 0.15s',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          fontSize: '0.625rem',
        }}>
          &#9654;
        </span>
        {title}
      </button>
      {open && (
        <div style={{
          marginTop: '0.375rem',
          padding: '0.625rem',
          backgroundColor: 'var(--color-bg-elevated)',
          borderRadius: '0.375rem',
          fontSize: '0.6875rem',
          fontFamily: 'monospace',
          color: 'var(--color-text-primary)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '240px',
          overflowY: 'auto',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LIVE BADGE
// ============================================================================

function LiveBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
      fontSize: '0.6875rem',
      fontWeight: 700,
      color: '#ef4444',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: '#ef4444',
        animation: 'mc-pulse-dot 1.5s ease-in-out infinite',
      }} />
      LIVE
      <style>{`
        @keyframes mc-pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </span>
  );
}

// ============================================================================
// STEP DETAIL PANEL (RIGHT)
// Note: IntelligenceBriefRenderer, ContentPackageBriefRenderer, and
// DetailOutputRenderer are now in src/components/mission-control/DetailOutputRenderer.tsx
// ============================================================================

function StepDetailPanel({
  step,
  approvalStep,
  missionId,
  stepGrades,
  onScrapMission,
}: {
  step: MissionStep | null;
  approvalStep: MissionStep | null;
  missionId: string | undefined;
  stepGrades: Record<string, GradeEntry>;
  onScrapMission: () => void;
}) {
  // If the selected step is the approval step, show the approval card prominently
  const showingApproval = approvalStep && (!step || step.stepId === approvalStep.stepId);
  const displayStep = showingApproval ? approvalStep : step;

  // M2d — which specialist's version history is currently open (null = none)
  const [historyForSpecialist, setHistoryForSpecialist] = useState<string | null>(null);

  if (!displayStep && !approvalStep) {
    return (
      <div style={{
        color: 'var(--color-text-disabled)',
        fontSize: '0.8125rem',
        textAlign: 'center',
        paddingTop: '3rem',
        lineHeight: 1.6,
      }}>
        Click a step in the plan to view its details
      </div>
    );
  }

  const dashboardLink = displayStep ? getDashboardLink(displayStep.toolName, displayStep.toolResult, displayStep.toolArgs) : null;
  const reviewLink = displayStep ? getStepReviewLink(missionId, displayStep.stepId) : null;
  const statusColor = displayStep ? getStepStatusColor(displayStep.status) : 'var(--color-text-disabled)';

  // M3.9: simple inline alert for the mission-halt case. Replaces the
  // orphaned ApprovalCard component (which called a route unrelated to
  // mission steps). Operator reruns the failed step from the step
  // detail panel below — the alert just makes the halt visible.

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {approvalStep && (
        <div
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'rgba(var(--color-warning-rgb), 0.1)',
            border: '1px solid var(--color-warning)',
            borderRadius: '0.5rem',
          }}
        >
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-warning)',
            marginBottom: '0.25rem',
          }}>
            Mission halted — needs your attention
          </div>
          <div style={{
            fontSize: '0.8125rem',
            color: 'var(--color-text-primary)',
            lineHeight: 1.5,
            marginBottom: '0.625rem',
          }}>
            {formatToolName(approvalStep.toolName)} failed twice and the runner stopped.
            Review the step below and choose: rerun (with edited args if you want), or
            scrap the mission.
          </div>
          <button
            type="button"
            onClick={onScrapMission}
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: 'transparent',
              color: 'var(--color-error)',
              border: '1px solid var(--color-error)',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Scrap this mission
          </button>
        </div>
      )}

      {/* Step detail content */}
      {displayStep && (
        <div>
          {/* Step header */}
          <div style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-disabled)',
            marginBottom: '0.75rem',
          }}>
            Step Detail
          </div>

          {/* Agent + name row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            marginBottom: '0.75rem',
          }}>
            <AgentAvatar delegatedTo={displayStep.delegatedTo} size={32} />
            <div>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}>
                {formatToolName(displayStep.toolName)}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
              }}>
                {displayStep.delegatedTo.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
            </div>
          </div>

          {/* Status + duration */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '0.75rem',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: statusColor,
              }} />
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: statusColor,
              }}>
                {getStepStatusLabel(displayStep.status)}
              </span>
            </div>

            {displayStep.durationMs !== undefined && (
              <span style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
              }}>
                {(displayStep.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          {/* M5: upstream-changed flag — operator chose to rerun an
              earlier step, so this step's output may now be stale. */}
          {displayStep.upstreamChanged === true && missionId && (
            <UpstreamChangedBanner
              missionId={missionId}
              stepId={displayStep.stepId}
            />
          )}

          {/* Summary */}
          {displayStep.summary && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              color: 'var(--color-text-primary)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              marginBottom: '0.75rem',
            }}>
              {displayStep.summary}
            </div>
          )}

          {/* Error */}
          {displayStep.error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(244,67,54,0.08)',
              border: '1px solid rgba(244,67,54,0.2)',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              color: 'var(--color-error)',
              lineHeight: 1.5,
              marginBottom: '0.75rem',
            }}>
              {displayStep.error}
            </div>
          )}

          {/* Dashboard link + Review link */}
          {displayStep.status === 'COMPLETED' && (dashboardLink ?? reviewLink) && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {dashboardLink && (
                <a
                  href={dashboardLink.route}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.5rem 0.875rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'opacity 0.15s',
                  }}
                >
                  View in {dashboardLink.label} &rarr;
                </a>
              )}
              {reviewLink && displayStep.toolResult && (
                <a
                  href={reviewLink.route}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.5rem 0.875rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-light)',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'opacity 0.15s',
                  }}
                >
                  Review Details &rarr;
                </a>
              )}
            </div>
          )}

          {/* Rich output rendering */}
          {displayStep.toolResult && (
            <DetailOutputRenderer toolResult={displayStep.toolResult} />
          )}

          {/* Send Reply affordance for inbound DM mission steps */}
          {displayStep.status === 'COMPLETED' && missionId && displayStep.toolResult && (() => {
            try {
              const parsed = JSON.parse(displayStep.toolResult) as Record<string, unknown>;
              if (parsed.mode !== 'INBOUND_DM_REPLY') { return null; }
              const composed = parsed.composedReply as Record<string, unknown> | undefined;
              const replyText = typeof composed?.replyText === 'string' ? composed.replyText : '';
              if (!replyText) { return null; }
              const senderHandle = typeof parsed.senderHandle === 'string' ? parsed.senderHandle : undefined;
              return (
                <div style={{ marginTop: '0.75rem' }}>
                  <SendDmReplyButton
                    missionId={missionId}
                    composedReply={replyText}
                    senderHandle={senderHandle}
                  />
                </div>
              );
            } catch {
              return null;
            }
          })()}

          {/* M6 — quick manual edit path */}
          {(displayStep.status === 'COMPLETED' || displayStep.status === 'FAILED') && missionId && (
            <ManualEditOutputBox
              missionId={missionId}
              stepId={displayStep.stepId}
              currentResult={displayStep.toolResult ?? ''}
              isManuallyEdited={displayStep.manuallyEdited === true}
            />
          )}

          {/* Step grade widget — shown for completed steps */}
          {displayStep.status === 'COMPLETED' && missionId && (
            <div style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--color-border-light)',
            }}>
              <div style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-disabled)',
                marginBottom: '0.375rem',
              }}>
                Rate this step
              </div>
              <StepGradeWidget
                missionId={missionId}
                stepId={displayStep.stepId}
                specialistsUsed={displayStep.specialistsUsed}
                existingGrade={stepGrades[displayStep.stepId]}
              />

              {/* M2d — version history + rollback entry points (one per specialist used) */}
              {displayStep.specialistsUsed && displayStep.specialistsUsed.length > 0 && (
                <div style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}>
                  <div style={{
                    fontSize: '0.625rem',
                    color: 'var(--color-text-disabled)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    Specialists used
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {displayStep.specialistsUsed.map((sid) => (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => setHistoryForSpecialist(historyForSpecialist === sid ? null : sid)}
                        style={{
                          fontSize: '0.6875rem',
                          padding: '0.1875rem 0.5rem',
                          color: historyForSpecialist === sid
                            ? 'var(--color-primary)'
                            : 'var(--color-text-secondary)',
                          background: 'var(--color-surface)',
                          border: `1px solid ${historyForSpecialist === sid ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                        }}
                      >
                        {sid} — history
                      </button>
                    ))}
                  </div>
                  {historyForSpecialist && (
                    <SpecialistVersionHistory
                      specialistId={historyForSpecialist}
                      onClose={() => setHistoryForSpecialist(null)}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Collapsible input */}
          {displayStep.toolArgs && Object.keys(displayStep.toolArgs).length > 0 && (
            <CollapsibleSection title="Input (Tool Args)">
              {JSON.stringify(displayStep.toolArgs, null, 2)}
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getStepStatusColor(status: MissionStep['status']): string {
  switch (status) {
    case 'PENDING': return 'var(--color-text-disabled)';
    case 'PROPOSED': return 'var(--color-text-secondary)';
    case 'RUNNING': return 'var(--color-primary)';
    case 'COMPLETED': return 'var(--color-success)';
    case 'FAILED': return 'var(--color-error)';
    default: return 'var(--color-text-disabled)';
  }
}

function getStepStatusLabel(status: MissionStep['status']): string {
  switch (status) {
    case 'PENDING': return 'Pending';
    case 'PROPOSED': return 'Proposed';
    case 'RUNNING': return 'Running';
    case 'COMPLETED': return 'Complete';
    case 'FAILED': return 'Failed';
    default: return status;
  }
}

// ============================================================================
// PAGE
// ============================================================================

function MissionControlView({ deepLinkedMission }: { deepLinkedMission: string | null }) {
  const authFetch = useAuthFetch();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(deepLinkedMission);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Grade state: keyed by stepId for per-step grades; undefined key holds overall mission grade
  const [missionGrades, setMissionGrades] = useState<Record<string, GradeEntry>>({});

  // SSE stream for the selected mission
  const { mission: streamedMission, isStreaming } = useMissionStream(selectedMissionId);

  // Determine if any missions are active (for sidebar polling rate)
  const hasActiveMissions = missions.some(
    (m) => m.status === 'IN_PROGRESS' || m.status === 'AWAITING_APPROVAL' || m.status === 'PENDING'
  );

  // The displayed mission: prefer streamed data, fall back to list data
  // For plan-review missions, prefer the fetched data over the SSE
  // stream. The stream creates a skeleton with empty steps — but plan
  // steps are written all at once in createMissionWithPlan, so the
  // stream never receives step_added events for them. The list fetch
  // returns the full mission including all plan steps.
  const fetchedMission = missions.find((m) => m.missionId === selectedMissionId) ?? null;
  const selectedMission = fetchedMission?.status === 'PLAN_PENDING_APPROVAL'
    ? fetchedMission
    : (streamedMission ?? fetchedMission);

  // Selected step from the mission
  const selectedStep = selectedMission?.steps.find((s) => s.stepId === selectedStepId) ?? null;

  // ── Fetch mission list (sidebar) ────────────────────────────────────
  const fetchMissions = useCallback(async () => {
    try {
      const res = await authFetch('/api/orchestrator/missions?limit=30');
      if (!res.ok) { return; }
      const data = (await res.json()) as MissionListResponse;
      if (data.success && data.data) {
        // Live tab: show active missions + recently completed (last 10 minutes)
        // Always include deep-linked mission so review links work
        const tenMinAgo = Date.now() - 10 * 60 * 1000;
        const liveMissions = data.data.missions.filter((m) => {
          const isActive = m.status === 'IN_PROGRESS' || m.status === 'AWAITING_APPROVAL' || m.status === 'PENDING' || m.status === 'PLAN_PENDING_APPROVAL';
          const isRecentlyCompleted = (m.status === 'COMPLETED' || m.status === 'FAILED') &&
            m.completedAt && new Date(m.completedAt).getTime() > tenMinAgo;
          const isDeepLinked = deepLinkedMission != null && m.missionId === deepLinkedMission;
          return Boolean(isActive) || Boolean(isRecentlyCompleted) || isDeepLinked;
        });
        setMissions(liveMissions);
      }
    } catch {
      // Silent fail on polling
    }
  }, [authFetch, deepLinkedMission]);

  // ── Initial load ────────────────────────────────────────────────────
  useEffect(() => {
    void fetchMissions();
  }, [fetchMissions]);

  // ── Auto-select deep-linked mission ─────────────────────────────────
  useEffect(() => {
    if (deepLinkedMission && !selectedMissionId) {
      setSelectedMissionId(deepLinkedMission);
    }
  }, [deepLinkedMission, selectedMissionId]);

  // ── Fetch grades when a terminal mission is selected ─────────────────
  const selectedMissionIdForGrades = selectedMission?.missionId;
  const selectedMissionStatus = selectedMission?.status;

  useEffect(() => {
    if (
      !selectedMissionIdForGrades ||
      (selectedMissionStatus !== 'COMPLETED' && selectedMissionStatus !== 'FAILED')
    ) {
      setMissionGrades({});
      return;
    }

    void (async () => {
      try {
        const res = await authFetch(`/api/orchestrator/missions/${selectedMissionIdForGrades}/grade`);
        if (!res.ok) { return; }
        const body = (await res.json()) as GradeApiResponse;
        if (!body.success || !body.data) { return; }

        const gradeMap: Record<string, GradeEntry> = {};
        for (const g of body.data.grades) {
          // Overall mission grade stored under the sentinel key 'overall'
          const key = g.stepId ?? 'overall';
          // Keep the most recent grade per key (API returns newest-first)
          if (!(key in gradeMap)) {
            gradeMap[key] = { score: g.score, explanation: g.explanation };
          }
        }
        setMissionGrades(gradeMap);
      } catch {
        // Silent fail — grades are non-critical UI
      }
    })();
  }, [selectedMissionIdForGrades, selectedMissionStatus, authFetch]);

  // ── Adaptive polling for sidebar list only ──────────────────────────
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    const interval = hasActiveMissions ? 5000 : 30000;

    pollingRef.current = setInterval(() => {
      void fetchMissions();
    }, interval);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [hasActiveMissions, fetchMissions]);

  // ── Step selection handler ──────────────────────────────────────────
  const handleStepSelect = useCallback((stepId: string) => {
    setSelectedStepId((prev) => prev === stepId ? null : stepId);
  }, []);

  // ── Mission selection handler ───────────────────────────────────────
  const handleMissionSelect = useCallback((missionId: string) => {
    setSelectedMissionId(missionId);
    setSelectedStepId(null);
  }, []);

  // ── Cancel mission handler ──────────────────────────────────────────
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  const handleCancelRequest = useCallback(() => {
    if (!selectedMissionId || cancelling) { return; }
    setShowCancelConfirm(true);
  }, [selectedMissionId, cancelling]);

  const handleCancelConfirm = useCallback(async () => {
    setShowCancelConfirm(false);
    if (!selectedMissionId || cancelling) { return; }

    setCancelling(true);
    try {
      const res = await authFetch(`/api/orchestrator/missions/${selectedMissionId}/cancel`, {
        method: 'POST',
      });
      if (res.ok) {
        void fetchMissions();
      }
    } catch {
      // Silent fail
    } finally {
      setCancelling(false);
    }
  }, [selectedMissionId, cancelling, authFetch, fetchMissions]);

  // ── Delete mission handler ──────────────────────────────────────────
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteRequest = useCallback(() => {
    if (!selectedMissionId || deleting) { return; }
    setShowDeleteConfirm(true);
  }, [selectedMissionId, deleting]);

  const handleDeleteConfirm = useCallback(async () => {
    setShowDeleteConfirm(false);
    if (!selectedMissionId || deleting) { return; }

    setDeleting(true);
    setActionError(null);
    try {
      const res = await authFetch(`/api/orchestrator/missions/${selectedMissionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSelectedMissionId(null);
        setSelectedStepId(null);
        void fetchMissions();
      } else {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
        setActionError(`Delete failed: ${body.error ?? res.statusText}`);
      }
    } catch (err: unknown) {
      setActionError(`Delete failed: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setDeleting(false);
    }
  }, [selectedMissionId, deleting, authFetch, fetchMissions]);

  // ── Clear all completed/failed missions ──────────────────────────────
  const handleClearAll = useCallback(async () => {
    if (clearingAll) { return; }

    setClearingAll(true);
    setActionError(null);
    try {
      const res = await authFetch('/api/orchestrator/missions', {
        method: 'DELETE',
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: { deleted?: number } };
        const count = body.data?.deleted ?? 0;
        setShowDeleteConfirm(false);
        if (count > 0) {
          setSelectedMissionId(null);
          setSelectedStepId(null);
        }
        void fetchMissions();
      } else {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
        setActionError(`Clear failed: ${body.error ?? res.statusText}`);
      }
    } catch (err: unknown) {
      setActionError(`Clear failed: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setClearingAll(false);
    }
  }, [clearingAll, authFetch, fetchMissions]);

  // ── Find approval step if any ──────────────────────────────────────
  // Note: post-M3.6, individual steps no longer use AWAITING_APPROVAL.
  // Mission-level AWAITING_APPROVAL means the mission halted at a
  // failed step; the failed step itself is in FAILED status. We surface
  // the FAILED step as the "needs your attention" focal point so the
  // operator can rerun it from the step detail panel.
  const approvalStep = selectedMission?.status === 'AWAITING_APPROVAL'
    ? selectedMission.steps.find((s) => s.status === 'FAILED') ?? null
    : null;

  // Is mission active (cancellable)?
  const isMissionActive = selectedMission?.status === 'IN_PROGRESS'
    || selectedMission?.status === 'AWAITING_APPROVAL'
    || selectedMission?.status === 'PENDING';

  // Is mission terminal (deletable)?
  const isMissionTerminal = selectedMission?.status === 'COMPLETED'
    || selectedMission?.status === 'FAILED';

  return (
    <div className="p-5">
      {/* Header with title + streaming indicator */}
      <div className="flex items-center gap-3 mb-3.5">
        <PageTitle className="text-2xl">Mission Control</PageTitle>
        {isStreaming && <LiveBadge />}
      </div>

      {/* Error banner */}
      {actionError && (
        <div style={{
          padding: '0.5rem 1rem',
          marginBottom: '0.5rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8125rem',
          color: '#ef4444',
        }}>
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '0 0.25rem',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* 3-Panel Layout */}
      <div style={{
        display: 'flex',
        gap: '0.875rem',
        height: 'calc(100vh - 200px)',
      }}>
        {/* ═══ LEFT — Mission List (280px) ═══ */}
        <div style={{
          width: 280,
          flexShrink: 0,
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-disabled)',
            }}>
              Missions ({missions.length})
            </span>
            {missions.some((m) => m.status === 'COMPLETED' || m.status === 'FAILED') && (
              <button
                type="button"
                onClick={() => void handleClearAll()}
                disabled={clearingAll}
                style={{
                  padding: '0.125rem 0.5rem',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: clearingAll ? '#9ca3af' : '#ef4444',
                  backgroundColor: 'transparent',
                  border: '1px solid',
                  borderColor: clearingAll ? '#d1d5db' : '#fca5a5',
                  borderRadius: '0.375rem',
                  cursor: clearingAll ? 'not-allowed' : 'pointer',
                }}
              >
                {clearingAll ? 'Clearing...' : 'Clear All'}
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <MissionSidebar
              missions={missions}
              selectedMissionId={selectedMissionId}
              onSelect={handleMissionSelect}
            />
          </div>
        </div>

        {/* ═══ CENTER — Plan View (flex-1) ═══ */}
        <div style={{
          flex: 1,
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}>
          {/* Cancel bar when mission is active */}
          {selectedMission && isMissionActive && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '0.375rem 1rem',
              borderBottom: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-bg-elevated)',
              flexShrink: 0,
            }}>
              {showCancelConfirm ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Cancel this mission?
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCancelConfirm()}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#fff',
                      backgroundColor: '#ef4444',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                    }}
                  >
                    Yes, Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                    }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelRequest}
                  disabled={cancelling}
                  style={{
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: cancelling ? '#9ca3af' : '#ef4444',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: cancelling ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Mission'}
                </button>
              )}
            </div>
          )}

          {/* Delete bar when mission is terminal (completed/failed) */}
          {selectedMission && isMissionTerminal && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '0.375rem 1rem',
              borderBottom: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-bg-elevated)',
              flexShrink: 0,
            }}>
              {showDeleteConfirm ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Permanently delete this mission?
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteConfirm()}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#fff',
                      backgroundColor: '#ef4444',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                    }}
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                    }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDeleteRequest}
                  disabled={deleting}
                  style={{
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: deleting ? '#9ca3af' : '#dc2626',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {deleting ? 'Deleting...' : 'Delete Mission'}
                </button>
              )}
            </div>
          )}

          {/* Plan content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {selectedMission ? (
              <div>
                {selectedMission.status === 'PLAN_PENDING_APPROVAL' ? (
                  <PlanReviewPanel
                    mission={selectedMission}
                    onPlanChanged={() => { void fetchMissions(); }}
                  />
                ) : (
                  <MissionTimeline
                    mission={selectedMission}
                    onStepSelect={handleStepSelect}
                    selectedStepId={selectedStepId}
                  />
                )}
                {(selectedMission.status === 'COMPLETED' || selectedMission.status === 'FAILED') && (
                  <div style={{ padding: '0 1rem 1rem' }}>
                    <MissionGradeCard
                      missionId={selectedMission.missionId}
                      existingGrade={missionGrades['overall']}
                    />
                  </div>
                )}
                {selectedMission.status === 'COMPLETED' && (
                  <div style={{ padding: '0 1rem 1rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowScheduleDialog(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.375rem',
                        padding: '0.5rem 1rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        font: 'inherit',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1d4ed8'; }}
                      onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb'; }}
                    >
                      &#128197; Schedule this mission
                    </button>
                  </div>
                )}
                {showScheduleDialog && selectedMission && (
                  <ScheduleMissionDialog
                    missionId={selectedMission.missionId}
                    missionTitle={selectedMission.title}
                    missionPrompt={selectedMission.userPrompt}
                    onClose={() => setShowScheduleDialog(false)}
                    onScheduled={() => setShowScheduleDialog(false)}
                  />
                )}
              </div>
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-disabled)',
                fontSize: '0.875rem',
                padding: '3rem 2rem',
                textAlign: 'center',
                height: '100%',
                lineHeight: 1.6,
              }}>
                {missions.length > 0 ? (
                  <>
                    <div style={{
                      fontSize: '2rem',
                      marginBottom: '0.75rem',
                      opacity: 0.5,
                    }}>
                      &#9776;
                    </div>
                    <div>Select a mission from the left panel to view its plan</div>
                  </>
                ) : (
                  <>
                    <div style={{
                      fontSize: '2rem',
                      marginBottom: '0.75rem',
                      opacity: 0.5,
                    }}>
                      &#128640;
                    </div>
                    <div>No missions yet.</div>
                    <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                      Ask Jasper to build, market, or research something to launch your first mission.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT — Step Detail / Approval (340px) ═══ */}
        <div style={{
          width: 340,
          flexShrink: 0,
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          overflowY: 'auto',
          padding: '1rem',
        }}>
          {selectedMission ? (
            <StepDetailPanel
              step={selectedStep}
              approvalStep={approvalStep}
              missionId={selectedMission.missionId}
              stepGrades={missionGrades}
              onScrapMission={handleCancelRequest}
            />
          ) : (
            <div style={{
              color: 'var(--color-text-disabled)',
              fontSize: '0.8125rem',
              textAlign: 'center',
              paddingTop: '3rem',
            }}>
              Select a mission to get started
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MissionControlPage() {
  const searchParams = useSearchParams();
  const deepLinkedMission = searchParams.get('mission');
  const campaignParam = searchParams.get('campaign');

  if (campaignParam) {
    return <CampaignReview campaignId={campaignParam} />;
  }

  return <MissionControlView deepLinkedMission={deepLinkedMission} />;
}
