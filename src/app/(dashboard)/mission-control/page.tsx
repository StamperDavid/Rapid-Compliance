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
import ApprovalCard from './_components/ApprovalCard';
import AgentAvatar from './_components/AgentAvatar';
import CampaignReview from './_components/CampaignReview';
import { getDashboardLink, formatToolName } from './_components/dashboard-links';
import type { Mission, MissionStep } from '@/lib/orchestrator/mission-persistence';

// ============================================================================
// TYPES
// ============================================================================

interface MissionListResponse {
  success: boolean;
  data?: { missions: Mission[]; hasMore: boolean };
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
// ============================================================================

function StepDetailPanel({
  step,
  approvalStep,
  approvalId,
  onApprovalDecision,
}: {
  step: MissionStep | null;
  approvalStep: MissionStep | null;
  approvalId: string | undefined;
  onApprovalDecision: () => void;
}) {
  // If the selected step is the approval step, show the approval card prominently
  const showingApproval = approvalStep && (!step || step.stepId === approvalStep.stepId);
  const displayStep = showingApproval ? approvalStep : step;

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

  const dashboardLink = displayStep ? getDashboardLink(displayStep.toolName) : null;
  const statusColor = displayStep ? getStepStatusColor(displayStep.status) : 'var(--color-text-disabled)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Approval card at top if there's an approval-waiting step */}
      {approvalStep && (
        <ApprovalCard
          approvalId={approvalId ?? approvalStep.stepId}
          description={`${formatToolName(approvalStep.toolName)} requires your approval before proceeding`}
          urgency="medium"
          requestedBy={approvalStep.delegatedTo}
          onDecision={onApprovalDecision}
        />
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

          {/* Dashboard link button */}
          {dashboardLink && displayStep.status === 'COMPLETED' && (
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
                marginBottom: '0.75rem',
              }}
            >
              View in {dashboardLink.label} &rarr;
            </a>
          )}

          {/* Collapsible input/output */}
          {displayStep.toolArgs && Object.keys(displayStep.toolArgs).length > 0 && (
            <CollapsibleSection title="Input (Tool Args)">
              {JSON.stringify(displayStep.toolArgs, null, 2)}
            </CollapsibleSection>
          )}

          {displayStep.toolResult && (
            <CollapsibleSection title="Output (Result)">
              {displayStep.toolResult}
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
    case 'RUNNING': return 'var(--color-primary)';
    case 'COMPLETED': return 'var(--color-success)';
    case 'FAILED': return 'var(--color-error)';
    case 'AWAITING_APPROVAL': return 'var(--color-warning)';
    default: return 'var(--color-text-disabled)';
  }
}

function getStepStatusLabel(status: MissionStep['status']): string {
  switch (status) {
    case 'PENDING': return 'Pending';
    case 'RUNNING': return 'Running';
    case 'COMPLETED': return 'Complete';
    case 'FAILED': return 'Failed';
    case 'AWAITING_APPROVAL': return 'Awaiting Approval';
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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // SSE stream for the selected mission
  const { mission: streamedMission, isStreaming } = useMissionStream(selectedMissionId);

  // Determine if any missions are active (for sidebar polling rate)
  const hasActiveMissions = missions.some(
    (m) => m.status === 'IN_PROGRESS' || m.status === 'AWAITING_APPROVAL' || m.status === 'PENDING'
  );

  // The displayed mission: prefer streamed data, fall back to list data
  const selectedMission = streamedMission ?? missions.find((m) => m.missionId === selectedMissionId) ?? null;

  // Selected step from the mission
  const selectedStep = selectedMission?.steps.find((s) => s.stepId === selectedStepId) ?? null;

  // ── Fetch mission list (sidebar) ────────────────────────────────────
  const fetchMissions = useCallback(async () => {
    try {
      const res = await authFetch('/api/orchestrator/missions?limit=30');
      if (!res.ok) { return; }
      const data = (await res.json()) as MissionListResponse;
      if (data.success && data.data) {
        setMissions(data.data.missions);
      }
    } catch {
      // Silent fail on polling
    }
  }, [authFetch]);

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

  // ── Find approval step if any ──────────────────────────────────────
  const approvalStep = selectedMission?.steps.find(
    (s) => s.status === 'AWAITING_APPROVAL'
  ) ?? null;

  // Is mission active (cancellable)?
  const isMissionActive = selectedMission?.status === 'IN_PROGRESS'
    || selectedMission?.status === 'AWAITING_APPROVAL'
    || selectedMission?.status === 'PENDING';

  return (
    <div style={{ padding: '1.25rem 1.5rem' }}>
      {/* Header with title + streaming indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '0.875rem',
      }}>
        <h1 style={{
          fontSize: '1.375rem',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          margin: 0,
        }}>
          Mission Control
        </h1>
        {isStreaming && <LiveBadge />}
      </div>

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
            fontSize: '0.6875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-disabled)',
            flexShrink: 0,
          }}>
            Missions ({missions.length})
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

          {/* Plan content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {selectedMission ? (
              <MissionTimeline
                mission={selectedMission}
                onStepSelect={handleStepSelect}
                selectedStepId={selectedStepId}
              />
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
              approvalId={selectedMission.approvalId}
              onApprovalDecision={() => {
                void fetchMissions();
              }}
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
