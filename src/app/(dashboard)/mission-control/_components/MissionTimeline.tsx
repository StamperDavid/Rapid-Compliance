'use client';

/**
 * MissionTimeline — Plan View showing each step as an interactive card.
 *
 * Redesigned from simple timeline to a comprehensive plan view where each step shows:
 * - Step number and formatted name
 * - Agent avatar and delegation target
 * - Progress bar (pending=0%, running=indeterminate animated, complete=100%, failed=red)
 * - Live duration timer when running, final when complete
 * - Summary text
 * - Dashboard link to the relevant page
 * - Expand/collapse for detailed output
 *
 * The overall progress header at the top shows:
 * - Mission title and prompt
 * - Total progress bar (X of Y steps)
 * - Elapsed time
 * - Status badge
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import AgentAvatar from './AgentAvatar';
import { getDashboardLink, formatToolName } from './dashboard-links';
import type { Mission, MissionStep, MissionStepStatus } from '@/lib/orchestrator/mission-persistence';

interface MissionTimelineProps {
  mission: Mission;
  onStepSelect?: (stepId: string) => void;
  selectedStepId?: string | null;
}

// ============================================================================
// PROGRESS HELPERS
// ============================================================================

function computeMissionProgress(mission: Mission): {
  completed: number;
  total: number;
  percentage: number;
} {
  const total = mission.steps.length;
  if (total === 0) { return { completed: 0, total: 0, percentage: 0 }; }
  const completed = mission.steps.filter((s) => s.status === 'COMPLETED').length;
  return { completed, total, percentage: Math.round((completed / total) * 100) };
}

function getStepProgressPercent(status: MissionStepStatus): number {
  switch (status) {
    case 'PENDING': return 0;
    case 'RUNNING': return -1; // -1 signals indeterminate
    case 'COMPLETED': return 100;
    case 'FAILED': return 100;
    case 'AWAITING_APPROVAL': return 75;
    default: return 0;
  }
}

function getStepProgressColor(status: MissionStepStatus): string {
  switch (status) {
    case 'PENDING': return 'var(--color-text-disabled)';
    case 'RUNNING': return 'var(--color-primary)';
    case 'COMPLETED': return 'var(--color-success)';
    case 'FAILED': return 'var(--color-error)';
    case 'AWAITING_APPROVAL': return 'var(--color-warning)';
    default: return 'var(--color-text-disabled)';
  }
}

function getStatusLabel(status: MissionStepStatus): string {
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
// ELAPSED TIMER
// ============================================================================

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const update = () => setElapsed(Date.now() - start);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) { return <span>{seconds}s</span>; }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return <span>{minutes}m {remainingSeconds}s</span>;
}

function MissionElapsedTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const update = () => setElapsed(Date.now() - start);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) { return <span>{seconds}s elapsed</span>; }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) { return <span>{minutes}m {remainingSeconds}s elapsed</span>; }
  const hours = Math.floor(minutes / 60);
  return <span>{hours}h {minutes % 60}m elapsed</span>;
}

function formatFinalDuration(mission: Mission): string {
  if (!mission.completedAt) { return ''; }
  const ms = new Date(mission.completedAt).getTime() - new Date(mission.createdAt).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) { return `${seconds}s total`; }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) { return `${minutes}m ${seconds % 60}s total`; }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m total`;
}

// ============================================================================
// STATUS BADGE
// ============================================================================

function MissionStatusBadge({ status }: { status: Mission['status'] }) {
  const configs: Record<Mission['status'], { label: string; color: string; bg: string }> = {
    PENDING: { label: 'Queued', color: 'var(--color-text-secondary)', bg: 'rgba(158,158,158,0.15)' },
    IN_PROGRESS: { label: 'In Progress', color: 'var(--color-success)', bg: 'rgba(76,175,80,0.15)' },
    AWAITING_APPROVAL: { label: 'Needs Approval', color: 'var(--color-warning)', bg: 'rgba(255,152,0,0.15)' },
    COMPLETED: { label: 'Completed', color: 'var(--color-primary)', bg: 'rgba(99,102,241,0.15)' },
    FAILED: { label: 'Failed', color: 'var(--color-error)', bg: 'rgba(244,67,54,0.15)' },
  };

  const cfg = configs[status];

  return (
    <span style={{
      fontSize: '0.6875rem',
      fontWeight: 600,
      color: cfg.color,
      backgroundColor: cfg.bg,
      padding: '0.1875rem 0.625rem',
      borderRadius: '9999px',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

// ============================================================================
// STEP PROGRESS BAR
// ============================================================================

function StepProgressBar({ status }: { status: MissionStepStatus }) {
  const percent = getStepProgressPercent(status);
  const color = getStepProgressColor(status);
  const isIndeterminate = percent === -1;

  return (
    <div style={{
      width: '100%',
      height: 4,
      backgroundColor: 'rgba(var(--color-text-disabled-rgb, 158,158,158), 0.2)',
      borderRadius: 2,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {isIndeterminate ? (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '40%',
          height: '100%',
          backgroundColor: color,
          borderRadius: 2,
          animation: 'step-indeterminate 1.4s ease-in-out infinite',
        }} />
      ) : (
        <div style={{
          width: `${percent}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      )}
    </div>
  );
}

// ============================================================================
// STEP CARD
// ============================================================================

function StepCard({
  step,
  stepNumber,
  isSelected,
  onSelect,
}: {
  step: MissionStep;
  stepNumber: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dashboardLink = getDashboardLink(step.toolName);

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const statusColor = getStepProgressColor(step.status);
  const isActive = step.status === 'RUNNING';
  const isFailed = step.status === 'FAILED';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        padding: '0.875rem 1rem',
        borderRadius: '0.625rem',
        border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
        backgroundColor: isSelected
          ? 'rgba(var(--color-primary-rgb, 99,102,241), 0.04)'
          : 'var(--color-bg-paper)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        animation: 'step-fade-in 0.3s ease forwards',
        ...(isActive ? {
          borderColor: 'var(--color-primary)',
          boxShadow: '0 0 0 1px rgba(var(--color-primary-rgb, 99,102,241), 0.15)',
        } : {}),
      }}
    >
      {/* Top row: step number, name, agent, duration */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        marginBottom: '0.5rem',
      }}>
        {/* Step number circle */}
        <div style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: statusColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          opacity: step.status === 'PENDING' ? 0.5 : 1,
        }}>
          <span style={{
            color: '#fff',
            fontSize: '0.6875rem',
            fontWeight: 700,
            lineHeight: 1,
          }}>
            {stepNumber}
          </span>
        </div>

        {/* Agent avatar */}
        <AgentAvatar delegatedTo={step.delegatedTo} size={24} />

        {/* Step name + agent label */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {formatToolName(step.toolName)}
          </div>
          <div style={{
            fontSize: '0.6875rem',
            color: 'var(--color-text-secondary)',
          }}>
            {step.delegatedTo.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </div>
        </div>

        {/* Status label + Duration */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '0.125rem',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '0.625rem',
            fontWeight: 600,
            color: statusColor,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}>
            {getStatusLabel(step.status)}
          </span>
          <span style={{
            fontSize: '0.6875rem',
            color: 'var(--color-text-disabled)',
          }}>
            {step.status === 'RUNNING' ? (
              <ElapsedTimer startedAt={step.startedAt} />
            ) : step.durationMs !== undefined ? (
              `${(step.durationMs / 1000).toFixed(1)}s`
            ) : null}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <StepProgressBar status={step.status} />

      {/* Summary text */}
      {step.summary && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.5,
          marginTop: '0.5rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: expanded ? 999 : 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {step.summary}
        </div>
      )}

      {/* Error message */}
      {isFailed && step.error && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--color-error)',
          lineHeight: 1.4,
          marginTop: '0.375rem',
          padding: '0.375rem 0.5rem',
          backgroundColor: 'rgba(244,67,54,0.08)',
          borderRadius: '0.375rem',
        }}>
          {step.error}
        </div>
      )}

      {/* Bottom row: dashboard link + expand toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '0.5rem',
        gap: '0.5rem',
      }}>
        {/* Dashboard link */}
        {dashboardLink && step.status === 'COMPLETED' ? (
          <a
            href={dashboardLink.route}
            onClick={handleLinkClick}
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--color-primary)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            View in {dashboardLink.label} &rarr;
          </a>
        ) : (
          <span />
        )}

        {/* Expand/collapse toggle */}
        {(Boolean(step.summary) || Boolean(step.toolResult) || (step.toolArgs != null && Object.keys(step.toolArgs).length > 0)) && (
          <button
            type="button"
            onClick={handleToggleExpand}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.6875rem',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              transition: 'color 0.15s',
            }}
          >
            {expanded ? 'Collapse' : 'Details'}
          </button>
        )}
      </div>

      {/* Expanded detail section */}
      {expanded && (
        <div style={{
          marginTop: '0.625rem',
          paddingTop: '0.625rem',
          borderTop: '1px solid var(--color-border-light)',
        }}>
          {step.toolArgs && Object.keys(step.toolArgs).length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{
                fontSize: '0.625rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-disabled)',
                marginBottom: '0.25rem',
              }}>
                Input
              </div>
              <div style={{
                padding: '0.5rem',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: '0.375rem',
                fontSize: '0.6875rem',
                fontFamily: 'monospace',
                color: 'var(--color-text-primary)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '160px',
                overflowY: 'auto',
              }}>
                {JSON.stringify(step.toolArgs, null, 2)}
              </div>
            </div>
          )}

          {step.toolResult && (
            <div>
              <div style={{
                fontSize: '0.625rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-disabled)',
                marginBottom: '0.25rem',
              }}>
                Output
              </div>
              <div style={{
                padding: '0.5rem',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: '0.375rem',
                fontSize: '0.6875rem',
                fontFamily: 'monospace',
                color: 'var(--color-text-primary)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '200px',
                overflowY: 'auto',
              }}>
                {step.toolResult}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MissionTimeline({ mission, onStepSelect, selectedStepId }: MissionTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const { completed, total, percentage } = computeMissionProgress(mission);
  const isTerminal = mission.status === 'COMPLETED' || mission.status === 'FAILED';

  // Auto-scroll to latest step
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [mission.steps.length]);

  return (
    <div style={{ padding: '1.25rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Inline keyframes */}
      <style>{`
        @keyframes step-indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes step-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ═══ Overall Progress Header ═══ */}
      <div style={{
        marginBottom: '1.25rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--color-border-light)',
      }}>
        {/* Title row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '0.375rem',
        }}>
          <h2 style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {mission.title}
          </h2>
          <MissionStatusBadge status={mission.status} />
        </div>

        {/* Prompt (truncated) */}
        {mission.userPrompt && (
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.4,
            marginBottom: '0.75rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {mission.userPrompt}
          </div>
        )}

        {/* Progress stats row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '0.5rem',
        }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}>
            {total > 0 ? `${completed} of ${total} steps complete` : 'No steps yet'}
          </span>

          {total > 0 && (
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--color-primary)',
            }}>
              {percentage}%
            </span>
          )}

          <span style={{
            fontSize: '0.6875rem',
            color: 'var(--color-text-disabled)',
            marginLeft: 'auto',
          }}>
            {isTerminal ? (
              formatFinalDuration(mission)
            ) : (
              <MissionElapsedTimer createdAt={mission.createdAt} />
            )}
          </span>
        </div>

        {/* Overall progress bar */}
        {total > 0 && (
          <div style={{
            width: '100%',
            height: 6,
            backgroundColor: 'rgba(var(--color-text-disabled-rgb, 158,158,158), 0.2)',
            borderRadius: 3,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${percentage}%`,
              height: '100%',
              backgroundColor: mission.status === 'FAILED'
                ? 'var(--color-error)'
                : mission.status === 'COMPLETED'
                  ? 'var(--color-success)'
                  : 'var(--color-primary)',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
        )}
      </div>

      {/* ═══ Step Cards ═══ */}
      {mission.steps.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-disabled)',
          fontSize: '0.8125rem',
        }}>
          {mission.status === 'PENDING'
            ? 'Waiting for Jasper to begin planning...'
            : 'No steps recorded yet.'}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
          flex: 1,
          overflowY: 'auto',
        }}>
          {mission.steps.map((step, index) => (
            <StepCard
              key={step.stepId}
              step={step}
              stepNumber={index + 1}
              isSelected={selectedStepId === step.stepId}
              onSelect={() => onStepSelect?.(step.stepId)}
            />
          ))}

          {/* Auto-scroll anchor */}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
