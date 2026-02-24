'use client';

/**
 * MissionTimeline — Vertical timeline of steps within a mission.
 *
 * Each step shows:
 * - Agent avatar
 * - Tool name / delegation target
 * - Status icon (pending, running spinner, completed, failed, awaiting approval)
 * - Duration (live elapsed for running steps)
 * - Summary text (first ~200 chars)
 * - Auto-scrolls to latest step
 */

import { useEffect, useRef, useState } from 'react';
import AgentAvatar from './AgentAvatar';
import type { Mission, MissionStepStatus } from '@/lib/orchestrator/mission-persistence';

interface MissionTimelineProps {
  mission: Mission;
  onStepSelect?: (stepId: string) => void;
}

// ============================================================================
// STATUS DISPLAY
// ============================================================================

function StatusIcon({ status }: { status: MissionStepStatus }) {
  switch (status) {
    case 'PENDING':
      return <span style={{ color: 'var(--color-text-disabled)', fontSize: '1rem' }}>&#9675;</span>;
    case 'RUNNING':
      return (
        <span style={{
          display: 'inline-block',
          width: 16,
          height: 16,
          border: '2px solid var(--color-primary)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'mission-spin 0.8s linear infinite',
        }} />
      );
    case 'COMPLETED':
      return <span style={{ color: 'var(--color-success)', fontSize: '1rem', fontWeight: 700 }}>&#10003;</span>;
    case 'FAILED':
      return <span style={{ color: 'var(--color-error)', fontSize: '1rem', fontWeight: 700 }}>&#10007;</span>;
    case 'AWAITING_APPROVAL':
      return <span style={{ color: 'var(--color-warning)', fontSize: '1rem' }}>&#9873;</span>;
    default:
      return <span>&#9675;</span>;
  }
}

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

function formatToolName(toolName: string): string {
  return toolName
    .replace('delegate_to_', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function MissionTimeline({ mission, onStepSelect }: MissionTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest step
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [mission.steps.length]);

  return (
    <div style={{ padding: '1rem 1.5rem', flex: 1 }}>
      {/* Inline keyframes for spinner */}
      <style>{`
        @keyframes mission-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes mission-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Mission header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: '0.25rem',
        }}>
          {mission.title}
        </div>
        <div style={{
          fontSize: '0.8125rem',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.4,
        }}>
          {mission.userPrompt.length > 200
            ? `${mission.userPrompt.slice(0, 200)}...`
            : mission.userPrompt}
        </div>
      </div>

      {/* Timeline */}
      {mission.steps.length === 0 ? (
        <div style={{
          color: 'var(--color-text-disabled)',
          fontSize: '0.8125rem',
          textAlign: 'center',
          paddingTop: '2rem',
        }}>
          {mission.status === 'PENDING'
            ? 'Waiting for Jasper to begin...'
            : 'No steps recorded yet.'}
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute',
            left: 15,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: 'var(--color-border-light)',
          }} />

          {mission.steps.map((step, index) => (
            <div
              key={step.stepId}
              role="button"
              tabIndex={0}
              onClick={() => onStepSelect?.(step.stepId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onStepSelect?.(step.stepId);
                }
              }}
              style={{
                position: 'relative',
                paddingBottom: index < mission.steps.length - 1 ? '1.25rem' : 0,
                paddingLeft: '1.5rem',
                cursor: onStepSelect ? 'pointer' : 'default',
                animation: 'mission-fade-in 0.3s ease forwards',
                animationDelay: `${index * 100}ms`,
              }}
            >
              {/* Timeline dot */}
              <div style={{
                position: 'absolute',
                left: -8,
                top: 4,
                width: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--color-bg-paper)',
                zIndex: 1,
              }}>
                <StatusIcon status={step.status} />
              </div>

              {/* Step content */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.625rem 0.75rem',
                borderRadius: '0.5rem',
                transition: 'background-color 0.15s ease',
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--color-primary-rgb), 0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <AgentAvatar delegatedTo={step.delegatedTo} size={28} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    marginBottom: '0.25rem',
                  }}>
                    <span style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                    }}>
                      {formatToolName(step.toolName)}
                    </span>
                    <span style={{
                      fontSize: '0.6875rem',
                      color: 'var(--color-text-disabled)',
                      flexShrink: 0,
                    }}>
                      {step.status === 'RUNNING' ? (
                        <ElapsedTimer startedAt={step.startedAt} />
                      ) : step.durationMs !== undefined ? (
                        `${(step.durationMs / 1000).toFixed(1)}s`
                      ) : null}
                    </span>
                  </div>

                  {step.summary && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-secondary)',
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {step.summary.slice(0, 200)}
                    </div>
                  )}

                  {step.error && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-error)',
                      marginTop: '0.25rem',
                    }}>
                      {step.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Auto-scroll anchor */}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
