'use client';

/**
 * MissionSidebar — Left panel listing missions with status badges.
 * Clicking a mission selects it for the center timeline view.
 */

import type { Mission, MissionStatus } from '@/lib/orchestrator/mission-persistence';

interface MissionSidebarProps {
  missions: Mission[];
  selectedMissionId: string | null;
  onSelect: (missionId: string) => void;
}

const STATUS_BADGES: Record<MissionStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'var(--color-text-secondary)', bg: 'rgba(var(--color-text-secondary-rgb, 158,158,158), 0.15)' },
  IN_PROGRESS: { label: 'Live', color: 'var(--color-success)', bg: 'rgba(var(--color-success-rgb, 76,175,80), 0.15)' },
  AWAITING_APPROVAL: { label: 'Approval', color: 'var(--color-warning)', bg: 'rgba(var(--color-warning-rgb, 255,152,0), 0.15)' },
  COMPLETED: { label: 'Done', color: 'var(--color-primary)', bg: 'rgba(var(--color-primary-rgb, 99,102,241), 0.15)' },
  FAILED: { label: 'Failed', color: 'var(--color-error)', bg: 'rgba(var(--color-error-rgb, 244,67,54), 0.15)' },
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

export default function MissionSidebar({ missions, selectedMissionId, onSelect }: MissionSidebarProps) {
  if (missions.length === 0) {
    return (
      <div style={{
        padding: '2rem 1rem',
        textAlign: 'center',
        color: 'var(--color-text-disabled)',
        fontSize: '0.8125rem',
      }}>
        No missions yet. Ask Jasper to do something complex to get started.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {missions.map((mission) => {
        const isSelected = mission.missionId === selectedMissionId;
        const badge = STATUS_BADGES[mission.status];

        return (
          <button
            key={mission.missionId}
            type="button"
            onClick={() => onSelect(mission.missionId)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
              padding: '0.75rem 1rem',
              textAlign: 'left',
              background: isSelected
                ? 'rgba(var(--color-primary-rgb), 0.08)'
                : 'transparent',
              borderLeft: isSelected
                ? '3px solid var(--color-primary)'
                : '3px solid transparent',
              border: 'none',
              borderBottom: '1px solid var(--color-border-light)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              width: '100%',
            }}
          >
            {/* Title */}
            <div style={{
              fontSize: '0.8125rem',
              fontWeight: isSelected ? 600 : 400,
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {mission.title}
            </div>

            {/* Status + Time */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}>
              <span style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: badge.color,
                backgroundColor: badge.bg,
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
              }}>
                {badge.label}
              </span>
              <span style={{
                fontSize: '0.6875rem',
                color: 'var(--color-text-disabled)',
              }}>
                {formatRelativeTime(mission.createdAt)}
              </span>
            </div>

            {/* Step count */}
            <div style={{
              fontSize: '0.6875rem',
              color: 'var(--color-text-secondary)',
            }}>
              {mission.steps.length} step{mission.steps.length !== 1 ? 's' : ''}
            </div>
          </button>
        );
      })}
    </div>
  );
}
