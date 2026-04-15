'use client';

/**
 * MissionSidebar — Left panel listing missions with progress bars and status indicators.
 *
 * Each mission card shows:
 * - Title
 * - Status badge with color-coded pulse animation
 * - Overall progress bar (completed steps / total steps)
 * - Step count (e.g., "3/7 steps complete")
 * - Relative timestamp
 */

import type { Mission, MissionStatus } from '@/lib/orchestrator/mission-persistence';

interface MissionSidebarProps {
  missions: Mission[];
  selectedMissionId: string | null;
  onSelect: (missionId: string) => void;
}

const STATUS_CONFIG: Record<MissionStatus, {
  label: string;
  color: string;
  bg: string;
  pulseColor: string | null;
}> = {
  PENDING: {
    label: 'Queued',
    color: 'var(--color-text-secondary)',
    bg: 'rgba(158,158,158,0.15)',
    pulseColor: null,
  },
  PLAN_PENDING_APPROVAL: {
    label: 'Plan Needs Review',
    color: 'var(--color-warning)',
    bg: 'rgba(255,152,0,0.15)',
    pulseColor: '#f59e0b',
  },
  IN_PROGRESS: {
    label: 'Active',
    color: 'var(--color-success)',
    bg: 'rgba(76,175,80,0.15)',
    pulseColor: '#22c55e',
  },
  AWAITING_APPROVAL: {
    label: 'Needs Approval',
    color: 'var(--color-warning)',
    bg: 'rgba(255,152,0,0.15)',
    pulseColor: '#f59e0b',
  },
  COMPLETED: {
    label: 'Complete',
    color: 'var(--color-primary)',
    bg: 'rgba(99,102,241,0.15)',
    pulseColor: null,
  },
  FAILED: {
    label: 'Failed',
    color: 'var(--color-error)',
    bg: 'rgba(244,67,54,0.15)',
    pulseColor: null,
  },
};

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) { return 'Just now'; }
  if (minutes < 60) { return `${minutes}m ago`; }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) { return `${hours}h ago`; }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function computeProgress(mission: Mission): { completed: number; total: number; percentage: number } {
  const total = mission.steps.length;
  if (total === 0) { return { completed: 0, total: 0, percentage: 0 }; }
  const completed = mission.steps.filter((s) => s.status === 'COMPLETED').length;
  const percentage = Math.round((completed / total) * 100);
  return { completed, total, percentage };
}

function getProgressBarColor(status: MissionStatus): string {
  switch (status) {
    case 'IN_PROGRESS': return 'var(--color-success)';
    case 'AWAITING_APPROVAL': return 'var(--color-warning)';
    case 'COMPLETED': return 'var(--color-primary)';
    case 'FAILED': return 'var(--color-error)';
    default: return 'var(--color-text-disabled)';
  }
}

export default function MissionSidebar({ missions, selectedMissionId, onSelect }: MissionSidebarProps) {
  if (missions.length === 0) {
    return (
      <div style={{
        padding: '2rem 1rem',
        textAlign: 'center',
        color: 'var(--color-text-disabled)',
        fontSize: '0.8125rem',
        lineHeight: 1.6,
      }}>
        No missions yet. Ask Jasper to build, market, or research something to get started.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes sidebar-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .mission-sidebar-item:hover {
          background-color: rgba(var(--color-primary-rgb, 99,102,241), 0.04) !important;
        }
      `}</style>

      {missions.map((mission) => {
        const isSelected = mission.missionId === selectedMissionId;
        const config = STATUS_CONFIG[mission.status];
        const { completed, total, percentage } = computeProgress(mission);

        return (
          <button
            key={mission.missionId}
            type="button"
            className="mission-sidebar-item"
            onClick={() => onSelect(mission.missionId)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              textAlign: 'left',
              background: isSelected
                ? 'rgba(var(--color-primary-rgb, 99,102,241), 0.08)'
                : 'transparent',
              borderLeft: isSelected
                ? '3px solid var(--color-primary)'
                : '3px solid transparent',
              borderTop: 'none',
              borderRight: 'none',
              borderBottom: '1px solid var(--color-border-light)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              width: '100%',
              font: 'inherit',
              color: 'inherit',
            }}
          >
            {/* Row 1: Title + Time */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}>
              <div style={{
                fontSize: '0.8125rem',
                fontWeight: isSelected ? 600 : 500,
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}>
                {mission.title}
              </div>
              <span style={{
                fontSize: '0.625rem',
                color: 'var(--color-text-disabled)',
                flexShrink: 0,
              }}>
                {formatRelativeTime(mission.updatedAt || mission.createdAt)}
              </span>
            </div>

            {/* Row 2: Status badge with optional pulse dot + graded indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              {config.pulseColor && (
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: config.pulseColor,
                  animation: 'sidebar-pulse 1.5s ease-in-out infinite',
                  flexShrink: 0,
                }} />
              )}
              <span style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: config.color,
                backgroundColor: config.bg,
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
              }}>
                {config.label}
              </span>
              {mission.graded && (
                <span
                  title="Graded"
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    color: '#f59e0b',
                    letterSpacing: '0.02em',
                    flexShrink: 0,
                  }}
                >
                  &#9733;
                </span>
              )}
            </div>

            {/* Row 3: Progress bar + step count */}
            {total > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {/* Progress bar track */}
                <div style={{
                  width: '100%',
                  height: 4,
                  backgroundColor: 'rgba(var(--color-text-disabled-rgb, 158,158,158), 0.2)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    backgroundColor: getProgressBarColor(mission.status),
                    borderRadius: 2,
                    transition: 'width 0.4s ease',
                  }} />
                </div>

                {/* Step count text */}
                <div style={{
                  fontSize: '0.625rem',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 500,
                }}>
                  {completed}/{total} steps complete
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
