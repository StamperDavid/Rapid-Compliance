'use client';

/**
 * Mission Control — Live "air traffic control" view of Jasper delegations
 *
 * 3-panel layout:
 * - Left (260px): Active/recent mission list
 * - Center (flex): MissionTimeline with live steps
 * - Right (300px): Step detail / ApprovalCard
 *
 * Polling: 5s if any active missions, 30s otherwise.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
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

interface MissionDetailResponse {
  success: boolean;
  data?: Mission;
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
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [selectedStep, setSelectedStep] = useState<MissionStep | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine if any missions are active
  const hasActiveMissions = missions.some(
    (m) => m.status === 'IN_PROGRESS' || m.status === 'AWAITING_APPROVAL' || m.status === 'PENDING'
  );

  // ── Fetch mission list ──────────────────────────────────────────────
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

  // ── Fetch selected mission detail ───────────────────────────────────
  const fetchMissionDetail = useCallback(async (missionId: string) => {
    try {
      const res = await authFetch(`/api/orchestrator/missions/${missionId}`);
      if (!res.ok) { return; }
      const data = (await res.json()) as MissionDetailResponse;
      if (data.success && data.data) {
        setSelectedMission(data.data);
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

  // ── Poll selected mission detail ────────────────────────────────────
  useEffect(() => {
    if (!selectedMissionId) {
      setSelectedMission(null);
      return;
    }
    void fetchMissionDetail(selectedMissionId);
  }, [selectedMissionId, fetchMissionDetail]);

  // ── Adaptive polling ────────────────────────────────────────────────
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    const interval = hasActiveMissions ? 5000 : 30000;

    pollingRef.current = setInterval(() => {
      void fetchMissions();
      if (selectedMissionId) {
        void fetchMissionDetail(selectedMissionId);
      }
    }, interval);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [hasActiveMissions, selectedMissionId, fetchMissions, fetchMissionDetail]);

  // ── Step selection handler ──────────────────────────────────────────
  const handleStepSelect = useCallback((stepId: string) => {
    if (!selectedMission) { return; }
    const step = selectedMission.steps.find((s) => s.stepId === stepId);
    setSelectedStep(step ?? null);
  }, [selectedMission]);

  // ── Find approval step if any ──────────────────────────────────────
  const approvalStep = selectedMission?.steps.find(
    (s) => s.status === 'AWAITING_APPROVAL'
  );

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{
        fontSize: '1.5rem',
        fontWeight: 700,
        color: 'var(--color-text-primary)',
        marginBottom: '1rem',
      }}>
        Mission Control
      </h1>

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
                // Refresh after decision
                if (selectedMissionId) {
                  void fetchMissionDetail(selectedMissionId);
                }
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
