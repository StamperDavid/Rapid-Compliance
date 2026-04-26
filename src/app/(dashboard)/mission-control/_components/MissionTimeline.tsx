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
import Image from 'next/image';
import AgentAvatar from './AgentAvatar';
import { getDashboardLink, getStepReviewLink, formatToolName } from './dashboard-links';
import type { Mission, MissionStep, MissionStepStatus } from '@/lib/orchestrator/mission-persistence';
import { SendDmReplyButton } from './SendDmReplyButton';

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
    case 'PROPOSED': return 0;
    case 'RUNNING': return -1; // -1 signals indeterminate
    case 'COMPLETED': return 100;
    case 'FAILED': return 100;
    default: return 0;
  }
}

function getStepProgressColor(status: MissionStepStatus): string {
  switch (status) {
    case 'PENDING': return 'var(--color-text-disabled)';
    case 'PROPOSED': return 'var(--color-text-secondary)';
    case 'RUNNING': return 'var(--color-primary)';
    case 'COMPLETED': return 'var(--color-success)';
    case 'FAILED': return 'var(--color-error)';
    default: return 'var(--color-text-disabled)';
  }
}

function getStatusLabel(status: MissionStepStatus): string {
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
    PENDING: { label: 'Queued', color: 'var(--color-text-secondary)', bg: 'rgba(var(--color-text-disabled-rgb), 0.15)' },
    PLAN_PENDING_APPROVAL: { label: 'Plan Needs Review', color: 'var(--color-warning)', bg: 'rgba(var(--color-warning-rgb), 0.15)' },
    IN_PROGRESS: { label: 'In Progress', color: 'var(--color-success)', bg: 'rgba(var(--color-success-rgb), 0.15)' },
    AWAITING_APPROVAL: { label: 'Needs Approval', color: 'var(--color-warning)', bg: 'rgba(var(--color-warning-rgb), 0.15)' },
    COMPLETED: { label: 'Completed', color: 'var(--color-primary)', bg: 'rgba(var(--color-primary-rgb), 0.15)' },
    FAILED: { label: 'Failed', color: 'var(--color-error)', bg: 'rgba(var(--color-error-rgb), 0.15)' },
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
      backgroundColor: 'rgba(var(--color-text-disabled-rgb), 0.2)',
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
// STEP OUTPUT HELPERS
// ============================================================================

interface ParsedStepOutput {
  type: 'research' | 'strategy' | 'cinematic' | 'thumbnails' | 'draft' | 'unknown';
  raw: string;
  data: Record<string, unknown>;
}

function parseStepOutput(toolResult: string | undefined): ParsedStepOutput | null {
  if (!toolResult) { return null; }

  try {
    const data = JSON.parse(toolResult) as Record<string, unknown>;
    const type = (data.type as string) ?? (data.status === 'draft' ? 'draft' : undefined);

    if (type === 'research' || type === 'strategy' || type === 'cinematic'
        || type === 'thumbnails' || type === 'draft') {
      return { type, raw: toolResult, data };
    }

    return { type: 'unknown', raw: toolResult, data };
  } catch {
    return { type: 'unknown', raw: toolResult, data: {} };
  }
}

/**
 * Compact inline preview of step output — shown in the card body.
 */
function StepOutputPreview({ output }: { output: ParsedStepOutput }) {
  const chipStyle: React.CSSProperties = {
    display: 'inline-block',
    fontSize: '0.625rem',
    fontWeight: 600,
    padding: '0.125rem 0.5rem',
    borderRadius: '9999px',
    marginRight: '0.25rem',
    marginTop: '0.25rem',
  };

  switch (output.type) {
    case 'research': {
      const insights = output.data.keyInsights as string[] | undefined;
      if (!insights || insights.length === 0) { return null; }
      return (
        <div style={{ marginTop: '0.375rem', display: 'flex', flexWrap: 'wrap', gap: '0.125rem' }}>
          {insights.slice(0, 3).map((insight, i) => (
            <span key={i} style={{
              ...chipStyle,
              color: 'var(--color-secondary)',
              backgroundColor: 'rgba(var(--color-secondary-rgb), 0.1)',
            }}>
              {insight.length > 50 ? `${insight.slice(0, 50)}...` : insight}
            </span>
          ))}
          {insights.length > 3 && (
            <span style={{ ...chipStyle, color: 'var(--color-text-disabled)', backgroundColor: 'transparent' }}>
              +{insights.length - 3} more
            </span>
          )}
        </div>
      );
    }

    case 'strategy': {
      const messages = output.data.keyMessages as string[] | undefined;
      const angle = output.data.narrativeAngle as string | undefined;
      return (
        <div style={{ marginTop: '0.375rem' }}>
          {angle && (
            <div style={{
              fontSize: '0.6875rem',
              color: 'var(--color-text-primary)',
              fontWeight: 500,
              fontStyle: 'italic',
              marginBottom: '0.25rem',
            }}>
              Angle: {angle}
            </div>
          )}
          {messages && messages.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.125rem' }}>
              {messages.slice(0, 3).map((msg, i) => (
                <span key={i} style={{
                  ...chipStyle,
                  color: 'var(--color-info)',
                  backgroundColor: 'rgba(var(--color-info-rgb), 0.1)',
                }}>
                  {msg.length > 40 ? `${msg.slice(0, 40)}...` : msg}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'thumbnails': {
      const thumbnails = output.data.thumbnails as Array<{ url: string }> | undefined;
      if (!thumbnails || thumbnails.length === 0) { return null; }
      return (
        <div style={{
          marginTop: '0.375rem',
          display: 'flex',
          gap: '0.375rem',
          overflowX: 'auto',
        }}>
          {thumbnails.slice(0, 4).map((thumb, i) => (
            <Image
              key={i}
              src={thumb.url}
              alt={`Scene ${i + 1} thumbnail`}
              width={56}
              height={32}
              unoptimized
              style={{
                borderRadius: '0.25rem',
                objectFit: 'cover',
                border: '1px solid var(--color-border-light)',
                flexShrink: 0,
              }}
            />
          ))}
          {thumbnails.length > 4 && (
            <div style={{
              width: 56,
              height: 32,
              borderRadius: '0.25rem',
              backgroundColor: 'var(--color-bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.625rem',
              color: 'var(--color-text-secondary)',
              flexShrink: 0,
            }}>
              +{thumbnails.length - 4}
            </div>
          )}
        </div>
      );
    }

    case 'draft': {
      const sceneCount = output.data.sceneCount as number | undefined;
      return (
        <div style={{ marginTop: '0.375rem', display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          {sceneCount !== undefined && (
            <span style={{
              ...chipStyle,
              color: 'var(--color-success)',
              backgroundColor: 'rgba(var(--color-success-rgb), 0.1)',
            }}>
              {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
            </span>
          )}
          <span style={{
            ...chipStyle,
            color: 'var(--color-primary)',
            backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)',
          }}>
            Ready for review
          </span>
        </div>
      );
    }

    case 'cinematic': {
      const count = output.data.scenesConfigured as number | undefined;
      const style = output.data.globalStyle as string | undefined;
      return (
        <div style={{ marginTop: '0.375rem', display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {style && (
            <span style={{
              ...chipStyle,
              color: 'var(--color-accent)',
              backgroundColor: 'rgba(var(--color-accent-rgb), 0.1)',
            }}>
              {style}
            </span>
          )}
          {count !== undefined && (
            <span style={{
              ...chipStyle,
              color: 'var(--color-text-secondary)',
              backgroundColor: 'var(--color-bg-elevated)',
            }}>
              {count} scene{count !== 1 ? 's' : ''} configured
            </span>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

// ============================================================================
// STEP CARD
// ============================================================================

function StepCard({
  step,
  stepNumber,
  isSelected,
  onSelect,
  missionId,
  sourceEvent,
}: {
  step: MissionStep;
  stepNumber: number;
  isSelected: boolean;
  onSelect: () => void;
  missionId: string;
  sourceEvent?: Mission['sourceEvent'];
}) {
  const [expanded, setExpanded] = useState(false);
  const dashboardLink = getDashboardLink(step.toolName, step.toolResult);
  const reviewLink = getStepReviewLink(missionId, step.stepId);
  const parsedOutput = parseStepOutput(step.toolResult);

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
        border: `1px solid ${(isSelected || isActive) ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
        backgroundColor: isSelected
          ? 'rgba(var(--color-primary-rgb), 0.04)'
          : 'var(--color-bg-paper)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        animation: 'step-fade-in 0.3s ease forwards',
        ...(isActive ? {
          boxShadow: '0 0 0 1px rgba(var(--color-primary-rgb), 0.15)',
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
            color: 'var(--color-primary-contrast)',
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

      {/* Rich output preview (inline chips/thumbnails) */}
      {parsedOutput && step.status === 'COMPLETED' && (
        <StepOutputPreview output={parsedOutput} />
      )}

      {/* Error message */}
      {isFailed && step.error && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--color-error)',
          lineHeight: 1.4,
          marginTop: '0.375rem',
          padding: '0.375rem 0.5rem',
          backgroundColor: 'rgba(var(--color-error-rgb), 0.08)',
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
        {/* Dashboard link + Review link */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {dashboardLink && step.status === 'COMPLETED' && (
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
          )}
          {reviewLink && step.status === 'COMPLETED' && step.toolResult && (
            <a
              href={reviewLink.route}
              onClick={handleLinkClick}
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              Review Details &rarr;
            </a>
          )}
          {step.status !== 'COMPLETED' && <span />}
        </div>

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
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: '0.375rem',
                fontSize: '0.6875rem',
                color: 'var(--color-text-primary)',
                lineHeight: 1.6,
                maxHeight: '160px',
                overflowY: 'auto',
              }}>
                {Object.entries(step.toolArgs ?? {}).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', gap: '0.5rem', paddingBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--color-text-disabled)', fontWeight: 600, minWidth: '80px', flexShrink: 0 }}>{key}:</span>
                    <span style={{ color: 'var(--color-text-primary)', wordBreak: 'break-word' }}>
                      {typeof value === 'string' ? (value.length > 200 ? `${value.slice(0, 200)}...` : value) : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step.toolResult && (
            <ExpandedOutputRenderer raw={step.toolResult} parsed={parsedOutput} />
          )}

          {(() => {
            const isInboundDm = sourceEvent?.kind?.startsWith('inbound_') === true && sourceEvent.kind.endsWith('_dm');
            if (!isInboundDm) { return null; }
            if (step.status !== 'COMPLETED') { return null; }
            // Render whenever the step has a composedReply attached.
            // Direct-orchestration path uses toolName=compose_dm_reply;
            // legacy path used delegate_to_marketing — both fine.
            const composed = extractComposedReplyText(step.toolResult);
            if (!composed) { return null; }
            return (
              <SendDmReplyButton
                missionId={missionId}
                composedReply={composed}
                senderHandle={sourceEvent.senderHandle}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}

/**
 * Extract the X Expert's composed reply text from a delegate_to_marketing
 * step's toolResult. Returns null when the step result does not contain
 * a `composedReply.replyText` (e.g., when the step was a normal campaign
 * delegation rather than the inbound-DM fast-path).
 */
function extractComposedReplyText(toolResult: string | undefined): string | null {
  if (!toolResult) { return null; }
  try {
    const parsed = JSON.parse(toolResult) as Record<string, unknown>;
    // delegate_to_marketing wraps the manager result in `data`.
    const dataField = parsed.data;
    if (dataField && typeof dataField === 'object') {
      const data = dataField as Record<string, unknown>;
      if (data.composedReply && typeof data.composedReply === 'object') {
        const composedReply = data.composedReply as Record<string, unknown>;
        if (typeof composedReply.replyText === 'string' && composedReply.replyText.length > 0) {
          return composedReply.replyText;
        }
      }
    }
    // Some result shapes set composedReply at the top level.
    if (parsed.composedReply && typeof parsed.composedReply === 'object') {
      const composedReply = parsed.composedReply as Record<string, unknown>;
      if (typeof composedReply.replyText === 'string' && composedReply.replyText.length > 0) {
        return composedReply.replyText;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Renders the expanded output section with type-specific formatting.
 */
function ExpandedOutputRenderer({ raw, parsed }: { raw: string; parsed: ParsedStepOutput | null }) {
  const labelStyle: React.CSSProperties = {
    fontSize: '0.625rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-disabled)',
    marginBottom: '0.25rem',
  };

  const containerStyle: React.CSSProperties = {
    padding: '0.5rem',
    backgroundColor: 'var(--color-bg-elevated)',
    borderRadius: '0.375rem',
    fontSize: '0.6875rem',
    color: 'var(--color-text-primary)',
    lineHeight: 1.5,
    maxHeight: '280px',
    overflowY: 'auto',
  };

  if (!parsed || parsed.type === 'unknown') {
    return (
      <div>
        <div style={labelStyle}>Output</div>
        <div style={{ ...containerStyle, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {raw}
        </div>
      </div>
    );
  }

  switch (parsed.type) {
    case 'research': {
      const methodology = parsed.data.methodology as string | undefined;
      const areasResearched = parsed.data.areasResearched as Array<{ area: string; findings: string }> | undefined;
      const findings = parsed.data.findings as string | undefined;
      const insights = parsed.data.keyInsights as string[] | undefined;
      const competitorAngles = parsed.data.competitorAngles as Array<{ competitor: string; angle: string } | string> | undefined;
      const contentGaps = parsed.data.contentGaps as string[] | undefined;
      const sources = parsed.data.sources as string[] | undefined;
      return (
        <div>
          {methodology && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={labelStyle}>Research Methodology</div>
              <div style={{ ...containerStyle, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                {methodology}
              </div>
            </div>
          )}
          {areasResearched && areasResearched.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={labelStyle}>Areas Researched</div>
              {areasResearched.map((area, i) => (
                <div key={i} style={{ ...containerStyle, marginBottom: '0.375rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.25rem', color: 'var(--color-secondary)' }}>
                    {area.area}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{area.findings}</div>
                </div>
              ))}
            </div>
          )}
          {findings && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={labelStyle}>Target Audience</div>
              <div style={{ ...containerStyle, whiteSpace: 'pre-wrap' }}>
                {findings}
              </div>
            </div>
          )}
          {insights && insights.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={labelStyle}>Key Insights</div>
              <ul style={{ ...containerStyle, margin: 0, paddingLeft: '1.25rem' }}>
                {insights.map((insight, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>{insight}</li>
                ))}
              </ul>
            </div>
          )}
          {competitorAngles && competitorAngles.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={labelStyle}>Competitor Landscape</div>
              <ul style={{ ...containerStyle, margin: 0, paddingLeft: '1.25rem' }}>
                {competitorAngles.map((c, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>
                    {typeof c === 'string' ? c : <><strong>{c.competitor}:</strong> {c.angle}</>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {contentGaps && contentGaps.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={labelStyle}>Content Gaps & Opportunities</div>
              <ul style={{ ...containerStyle, margin: 0, paddingLeft: '1.25rem' }}>
                {contentGaps.map((gap, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
          {sources && sources.length > 0 && (
            <div>
              <div style={labelStyle}>Sources & Data</div>
              <div style={{ ...containerStyle, display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                {sources.map((src, i) => (
                  <span key={i} style={{
                    display: 'inline-block', fontSize: '0.6875rem', fontWeight: 500,
                    padding: '0.125rem 0.5rem', borderRadius: '9999px',
                    color: 'var(--color-text-secondary)',
                    backgroundColor: 'rgba(var(--color-text-secondary-rgb, 128, 128, 128), 0.1)',
                    border: '1px solid rgba(var(--color-text-secondary-rgb, 128, 128, 128), 0.2)',
                  }}>
                    {src}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    case 'strategy': {
      const angle = parsed.data.narrativeAngle as string | undefined;
      const audience = parsed.data.targetAudience as string | undefined;
      const messages = parsed.data.keyMessages as string[] | undefined;
      const tone = parsed.data.tone as string | undefined;
      const cta = parsed.data.callToAction as string | undefined;
      return (
        <div>
          <div style={labelStyle}>Messaging Strategy</div>
          <div style={containerStyle}>
            {angle && <div style={{ marginBottom: '0.375rem' }}><strong>Narrative Angle:</strong> {angle}</div>}
            {audience && <div style={{ marginBottom: '0.375rem' }}><strong>Audience:</strong> {audience}</div>}
            {tone && <div style={{ marginBottom: '0.375rem' }}><strong>Tone:</strong> {tone}</div>}
            {cta && <div style={{ marginBottom: '0.375rem' }}><strong>CTA:</strong> {cta}</div>}
            {messages && messages.length > 0 && (
              <div style={{ marginTop: '0.25rem' }}>
                <strong>Key Messages:</strong>
                <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1rem' }}>
                  {messages.map((msg, i) => <li key={i}>{msg}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'cinematic': {
      const configs = parsed.data.configs as Array<Record<string, unknown>> | undefined;
      return (
        <div>
          <div style={labelStyle}>Cinematic Configuration</div>
          <div style={containerStyle}>
            {configs?.map((cfg, i) => (
              <div key={i} style={{
                padding: '0.375rem',
                borderBottom: i < configs.length - 1 ? '1px solid var(--color-border-light)' : undefined,
              }}>
                <div style={{ fontWeight: 600, marginBottom: '0.125rem' }}>
                  Scene {cfg.sceneNumber as number}
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--color-text-secondary)' }}>
                  {[cfg.shotType, cfg.lighting, cfg.camera, cfg.artStyle, cfg.filmStock]
                    .filter((v): v is string => typeof v === 'string')
                    .join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'thumbnails': {
      const thumbnails = parsed.data.thumbnails as Array<{ sceneNumber: number; url: string }> | undefined;
      return (
        <div>
          <div style={labelStyle}>Scene Thumbnails</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: '0.5rem',
            padding: '0.5rem',
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '0.375rem',
          }}>
            {thumbnails?.map((thumb, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <Image
                  src={thumb.url}
                  alt={`Scene ${thumb.sceneNumber}`}
                  width={200}
                  height={112}
                  unoptimized
                  style={{
                    width: '100%',
                    height: 'auto',
                    aspectRatio: '16/9',
                    objectFit: 'cover',
                    borderRadius: '0.25rem',
                    border: '1px solid var(--color-border-light)',
                  }}
                />
                <div style={{ fontSize: '0.5625rem', color: 'var(--color-text-disabled)', marginTop: '0.125rem' }}>
                  Scene {thumb.sceneNumber}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'draft': {
      const title = parsed.data.title as string | undefined;
      const sceneCount = parsed.data.sceneCount as number | undefined;
      const reviewLink = parsed.data.reviewLink as string | undefined;
      return (
        <div>
          <div style={labelStyle}>Storyboard Ready</div>
          <div style={containerStyle}>
            {title && <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{title}</div>}
            {sceneCount !== undefined && <div>{sceneCount} scene{sceneCount !== 1 ? 's' : ''} with scripts, cinematic settings, and thumbnails</div>}
            {reviewLink && (
              <a
                href={reviewLink}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  marginTop: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-primary-contrast)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Open Storyboard &rarr;
              </a>
            )}
          </div>
        </div>
      );
    }

    default:
      return (
        <div>
          <div style={labelStyle}>Output</div>
          <div style={{ ...containerStyle, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {raw}
          </div>
        </div>
      );
  }
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
            backgroundColor: 'rgba(var(--color-text-disabled-rgb), 0.2)',
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
              missionId={mission.missionId}
              sourceEvent={mission.sourceEvent}
            />
          ))}

          {/* Auto-scroll anchor */}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
