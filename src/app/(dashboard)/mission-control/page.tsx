'use client';

/**
 * Mission Control — Live "air traffic control" view of Jasper delegations
 *
 * 3-panel layout:
 * - Left (260px): Active/recent mission list (polled)
 * - Center (flex): MissionTimeline with live SSE-streamed steps
 * - Right (300px): Step detail with tool args/results + ApprovalCard
 *
 * Sprint 23: Upgraded from 5s polling to SSE streaming for selected mission.
 * Sidebar list still uses adaptive polling (5s active / 30s idle).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useMissionStream } from '@/hooks/useMissionStream';
import SubpageNav from '@/components/ui/SubpageNav';
import MissionSidebar from './_components/MissionSidebar';
import MissionTimeline from './_components/MissionTimeline';
import ApprovalCard from './_components/ApprovalCard';
import type { Mission, MissionStep } from '@/lib/orchestrator/mission-persistence';

// ============================================================================
// TYPES
// ============================================================================

interface MissionListResponse {
  success: boolean;
  data?: { missions: Mission[]; hasMore: boolean };
}

// ============================================================================
// COLLAPSIBLE JSON VIEWER
// ============================================================================

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: '0.75rem' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          padding: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        <span style={{
          display: 'inline-block',
          transition: 'transform 0.15s',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
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
          fontSize: '0.75rem',
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
        animation: 'pulse-dot 1.5s ease-in-out infinite',
      }} />
      LIVE
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </span>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function MissionControlPage() {
  const authFetch = useAuthFetch();
  const searchParams = useSearchParams();
  const deepLinkedMission = searchParams.get('mission');

  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(deepLinkedMission);
  const [selectedStep, setSelectedStep] = useState<MissionStep | null>(null);
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
    if (!selectedMission) { return; }
    const step = selectedMission.steps.find((s) => s.stepId === stepId);
    setSelectedStep(step ?? null);
  }, [selectedMission]);

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
  );

  // Is mission active (cancellable)?
  const isMissionActive = selectedMission?.status === 'IN_PROGRESS'
    || selectedMission?.status === 'AWAITING_APPROVAL'
    || selectedMission?.status === 'PENDING';

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header with title + streaming indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1rem',
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          margin: 0,
        }}>
          Mission Control
        </h1>
        {isStreaming && <LiveBadge />}
      </div>

      <SubpageNav items={[
        { label: 'Live', href: '/mission-control' },
        { label: 'History', href: '/mission-control/history' },
      ]} />

      {/* 3-Panel Layout */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        height: 'calc(100vh - 200px)',
      }}>
        {/* LEFT — Mission List */}
        <div style={{
          width: 260,
          flexShrink: 0,
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          overflowY: 'auto',
        }}>
          <div style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-border-light)',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-disabled)',
          }}>
            Missions ({missions.length})
          </div>
          <MissionSidebar
            missions={missions}
            selectedMissionId={selectedMissionId}
            onSelect={setSelectedMissionId}
          />
        </div>

        {/* CENTER — Timeline */}
        <div style={{
          flex: 1,
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Cancel bar when mission is active */}
          {selectedMission && isMissionActive && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 1rem',
              borderBottom: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-bg-elevated)',
            }}>
              <span style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}>
                {selectedMission.title || 'Active Mission'}
              </span>
              {showCancelConfirm ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Cancel this mission?
                  </span>
                  <button
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

          {selectedMission ? (
            <MissionTimeline
              mission={selectedMission}
              onStepSelect={handleStepSelect}
            />
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-disabled)',
              fontSize: '0.875rem',
            }}>
              {missions.length > 0
                ? 'Select a mission to view its timeline'
                : 'No missions yet. Ask Jasper to build, market, or research something.'}
            </div>
          )}
        </div>

        {/* RIGHT — Step Detail / Approval */}
        <div style={{
          width: 300,
          flexShrink: 0,
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          overflowY: 'auto',
          padding: '1rem',
        }}>
          {approvalStep ? (
            <ApprovalCard
              approvalId={selectedMission?.approvalId ?? approvalStep.stepId}
              description={`${approvalStep.toolName} requires approval`}
              urgency="medium"
              requestedBy={approvalStep.delegatedTo}
              onDecision={() => {
                void fetchMissions();
              }}
            />
          ) : selectedStep ? (
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-disabled)',
                marginBottom: '0.75rem',
              }}>
                Step Detail
              </div>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                marginBottom: '0.5rem',
              }}>
                {selectedStep.toolName}
              </div>
              <div style={{
                fontSize: '0.8125rem',
                color: 'var(--color-text-secondary)',
                marginBottom: '0.5rem',
              }}>
                Delegated to: {selectedStep.delegatedTo}
              </div>
              <div style={{
                fontSize: '0.8125rem',
                color: 'var(--color-text-secondary)',
                marginBottom: '0.5rem',
              }}>
                Status: {selectedStep.status}
              </div>
              {selectedStep.durationMs !== undefined && (
                <div style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.5rem',
                }}>
                  Duration: {(selectedStep.durationMs / 1000).toFixed(1)}s
                </div>
              )}
              {selectedStep.summary && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}>
                  {selectedStep.summary}
                </div>
              )}
              {selectedStep.error && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(var(--color-error-rgb, 244,67,54), 0.1)',
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  color: 'var(--color-error)',
                  lineHeight: 1.5,
                }}>
                  {selectedStep.error}
                </div>
              )}

              {/* Tool Args (Input) */}
              {selectedStep.toolArgs && Object.keys(selectedStep.toolArgs).length > 0 && (
                <CollapsibleSection title="Input (Tool Args)">
                  {JSON.stringify(selectedStep.toolArgs, null, 2)}
                </CollapsibleSection>
              )}

              {/* Tool Result (Output) */}
              {selectedStep.toolResult && (
                <CollapsibleSection title="Output (Result)">
                  {selectedStep.toolResult}
                </CollapsibleSection>
              )}
            </div>
          ) : (
            <div style={{
              color: 'var(--color-text-disabled)',
              fontSize: '0.8125rem',
              textAlign: 'center',
              paddingTop: '2rem',
            }}>
              {selectedMission
                ? 'Click a step in the timeline for details'
                : 'Select a mission to get started'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
