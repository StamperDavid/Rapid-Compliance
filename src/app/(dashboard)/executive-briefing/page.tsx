'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { auth } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

interface BriefingHighlight {
  department: string;
  type: 'SUCCESS' | 'WARNING' | 'ACTION_REQUIRED' | 'INFO';
  title: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface DepartmentSummary {
  department: string;
  managerId: string;
  status: 'HEALTHY' | 'NEEDS_ATTENTION' | 'CRITICAL';
  actionsCompleted: number;
  actionsPending: number;
  keyMetric: string;
  keyMetricValue: string;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

interface BriefingMetrics {
  totalOperationalCycles: number;
  totalActionsExecuted: number;
  successRate: number;
  inboundRepliesProcessed: number;
  leadsAdvanced: number;
  contentProduced: number;
  reviewsResponded: number;
}

interface PendingApprovalData {
  approvalId: string;
  createdAt: string;
  requestedBy: string;
  type: string;
  description: string;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  context: Record<string, unknown>;
  status: string;
  expiresAt: string | null;
}

interface ExecutiveBriefingData {
  briefingId: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  highlights: BriefingHighlight[];
  pendingApprovals: PendingApprovalData[];
  departmentSummaries: DepartmentSummary[];
  metrics: BriefingMetrics;
}

interface CommandHistoryItem {
  commandId: string;
  issuedAt: string;
  targetManager: string;
  command: string;
  parameters: Record<string, unknown>;
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL';
  requiresConfirmation: boolean;
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ExecutiveBriefingPage() {
  const { theme } = useOrgTheme();
  const { user } = useUnifiedAuth();

  const [briefing, setBriefing] = useState<ExecutiveBriefingData | null>(null);
  const [commands, setCommands] = useState<CommandHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingApproval, setProcessingApproval] = useState<string | null>(null);

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null)
    ? theme.colors.primary.main
    : 'var(--color-primary)';

  const fetchBriefing = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      const [briefingRes, commandsRes] = await Promise.all([
        fetch('/api/orchestrator/executive-briefing', { headers }),
        fetch('/api/orchestrator/command?limit=20', { headers }),
      ]);

      if (briefingRes.ok) {
        const data = await briefingRes.json() as { success: boolean; briefing: ExecutiveBriefingData };
        if (data.success) {
          setBriefing(data.briefing);
        }
      } else {
        setError('Failed to load briefing');
      }

      if (commandsRes.ok) {
        const data = await commandsRes.json() as { success: boolean; commands: CommandHistoryItem[] };
        if (data.success) {
          setCommands(data.commands);
        }
      }
    } catch (err: unknown) {
      logger.error('Failed to fetch briefing', err instanceof Error ? err : undefined);
      setError('Failed to connect to briefing service');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void fetchBriefing();
    }
  }, [user, fetchBriefing]);

  async function handleApproval(approvalId: string, decision: 'APPROVED' | 'REJECTED') {
    setProcessingApproval(approvalId);
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        return;
      }

      const res = await fetch('/api/orchestrator/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ approvalId, decision }),
      });

      if (res.ok) {
        // Refresh briefing to update pending approvals
        await fetchBriefing();
      }
    } catch (err: unknown) {
      logger.error('Approval processing failed', err instanceof Error ? err : undefined);
    } finally {
      setProcessingApproval(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-bg-paper)', animation: 'pulse 2s infinite' }} />
            <div>
              <div style={{ width: '250px', height: '28px', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.5rem', marginBottom: '0.5rem' }} />
              <div style={{ width: '180px', height: '16px', backgroundColor: 'var(--color-bg-main)', borderRadius: '0.25rem' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: '120px', backgroundColor: 'var(--color-bg-paper)', borderRadius: '1rem', border: '1px solid var(--color-border-strong)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>
                Executive Briefing
              </h1>
              <p style={{ color: 'var(--color-text-disabled)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                {briefing
                  ? `Generated ${new Date(briefing.generatedAt).toLocaleString()}`
                  : 'Your autonomous operations summary'}
              </p>
            </div>
            <button
              onClick={() => void fetchBriefing()}
              style={{
                padding: '0.625rem 1.5rem',
                backgroundColor: primaryColor,
                color: 'var(--color-text-primary)',
                borderRadius: '0.5rem',
                border: 'none',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Refresh Briefing
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-error-dark)', border: '1px solid var(--color-error-dark)', borderRadius: '0.75rem', marginBottom: '1.5rem', color: 'var(--color-error-light)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {briefing && (
          <>
            {/* Briefing Summary Card */}
            <section style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'start' }}>
                <div style={{ fontSize: '2rem', flexShrink: 0 }}>
                  <JasperAvatar />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', margin: '0 0 0.75rem 0' }}>
                    Jasper&apos;s Briefing
                  </h2>
                  <p style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
                    {briefing.summary}
                  </p>
                </div>
              </div>
            </section>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <MetricCard label="Op Cycles" value={briefing.metrics.totalOperationalCycles} color="var(--color-primary)" />
              <MetricCard label="Actions Executed" value={briefing.metrics.totalActionsExecuted} color="var(--color-secondary)" />
              <MetricCard label="Success Rate" value={`${Math.round(briefing.metrics.successRate * 100)}%`} color="var(--color-success)" />
              <MetricCard label="Replies Processed" value={briefing.metrics.inboundRepliesProcessed} color="var(--color-info)" />
              <MetricCard label="Leads Advanced" value={briefing.metrics.leadsAdvanced} color="var(--color-warning)" />
              <MetricCard label="Content Produced" value={briefing.metrics.contentProduced} color="var(--color-secondary-light)" />
              <MetricCard label="Reviews Responded" value={briefing.metrics.reviewsResponded} color="var(--color-primary)" />
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '1.5rem' }} className="lg:grid-cols-2">
              {/* Highlights */}
              <section style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Highlights</h2>
                {briefing.highlights.length === 0 ? (
                  <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>No highlights for this period.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {briefing.highlights.map((h, i) => (
                      <HighlightCard key={i} highlight={h} />
                    ))}
                  </div>
                )}
              </section>

              {/* Department Status */}
              <section style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Department Status</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {briefing.departmentSummaries.map((dept) => (
                    <DepartmentRow key={dept.managerId} dept={dept} />
                  ))}
                </div>
              </section>
            </div>

            {/* Pending Approvals */}
            {briefing.pendingApprovals.length > 0 && (
              <section style={{ backgroundColor: 'var(--color-bg-paper)', border: `1px solid ${primaryColor}44`, borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
                  Pending Approvals ({briefing.pendingApprovals.length})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {briefing.pendingApprovals.map(approval => (
                    <ApprovalCard
                      key={approval.approvalId}
                      approval={approval}
                      onApprove={() => void handleApproval(approval.approvalId, 'APPROVED')}
                      onReject={() => void handleApproval(approval.approvalId, 'REJECTED')}
                      processing={processingApproval === approval.approvalId}
                      primaryColor={primaryColor}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Command History */}
            <section style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>
                  Command History
                </h2>
                <Link href="/dashboard" style={{ color: primaryColor, fontSize: '0.875rem', textDecoration: 'none' }}>
                  Back to Dashboard
                </Link>
              </div>
              {commands.length === 0 ? (
                <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>No commands issued yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {commands.map(cmd => (
                    <CommandRow key={cmd.commandId} command={cmd} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function JasperAvatar() {
  return (
    <div style={{
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.25rem',
      fontWeight: 'bold',
      color: 'var(--color-text-primary)',
    }}>
      J
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-bg-paper)',
      border: '1px solid var(--color-border-strong)',
      borderRadius: '0.75rem',
      padding: '1.25rem',
      borderLeft: `3px solid ${color}`,
    }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>
        {value}
      </p>
    </div>
  );
}

function HighlightCard({ highlight }: { highlight: BriefingHighlight }) {
  const typeStyles: Record<string, { bg: string; border: string; icon: string }> = {
    SUCCESS: { bg: 'var(--color-success-dark)', border: 'var(--color-success-dark)', icon: 'check_circle' },
    WARNING: { bg: 'var(--color-warning-dark)', border: 'var(--color-warning-dark)', icon: 'warning' },
    ACTION_REQUIRED: { bg: 'var(--color-error-dark)', border: 'var(--color-error)', icon: 'error' },
    INFO: { bg: 'var(--color-info-dark)', border: 'var(--color-info-dark)', icon: 'info' },
  };

  const style = typeStyles[highlight.type] || typeStyles.INFO;

  return (
    <div style={{
      padding: '0.75rem 1rem',
      backgroundColor: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: '0.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{highlight.title}</span>
        <span style={{
          fontSize: '0.65rem',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: highlight.impact === 'HIGH' ? 'var(--color-error-dark)' : highlight.impact === 'MEDIUM' ? 'var(--color-warning-dark)' : 'var(--color-info-dark)',
          color: highlight.impact === 'HIGH' ? 'var(--color-error-light)' : highlight.impact === 'MEDIUM' ? 'var(--color-warning-light)' : 'var(--color-info-light)',
        }}>
          {highlight.impact}
        </span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>{highlight.description}</p>
    </div>
  );
}

function DepartmentRow({ dept }: { dept: DepartmentSummary }) {
  const statusColors: Record<string, string> = {
    HEALTHY: 'var(--color-success)',
    NEEDS_ATTENTION: 'var(--color-warning)',
    CRITICAL: 'var(--color-error)',
  };

  const trendIcon: Record<string, string> = {
    UP: '\u2191',
    DOWN: '\u2193',
    STABLE: '\u2192',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.75rem',
      backgroundColor: 'var(--color-bg-main)',
      border: '1px solid var(--color-bg-elevated)',
      borderRadius: '0.5rem',
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: statusColors[dept.status] || 'var(--color-text-disabled)',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{dept.department}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
          {dept.actionsCompleted} completed, {dept.actionsPending} pending
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)' }}>
          {dept.keyMetricValue} {trendIcon[dept.trend]}
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-disabled)' }}>{dept.keyMetric}</div>
      </div>
    </div>
  );
}

function ApprovalCard({
  approval,
  onApprove,
  onReject,
  processing,
  primaryColor,
}: {
  approval: PendingApprovalData;
  onApprove: () => void;
  onReject: () => void;
  processing: boolean;
  primaryColor: string;
}) {
  const urgencyColors: Record<string, { bg: string; text: string }> = {
    CRITICAL: { bg: 'var(--color-error-dark)', text: 'var(--color-error-light)' },
    HIGH: { bg: 'var(--color-warning-dark)', text: 'var(--color-warning-light)' },
    NORMAL: { bg: 'var(--color-info-dark)', text: 'var(--color-info-light)' },
    LOW: { bg: 'var(--color-border-strong)', text: 'var(--color-text-secondary)' },
  };

  const urgStyle = urgencyColors[approval.urgency] || urgencyColors.NORMAL;

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: 'var(--color-bg-main)',
      border: '1px solid var(--color-border-strong)',
      borderRadius: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{approval.type.replace(/_/g, ' ')}</span>
          <span style={{
            fontSize: '0.65rem',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: urgStyle.bg,
            color: urgStyle.text,
            marginLeft: '0.5rem',
          }}>
            {approval.urgency}
          </span>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-disabled)' }}>
          {new Date(approval.createdAt).toLocaleString()}
        </span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0 0 0.75rem 0' }}>{approval.description}</p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onApprove}
          disabled={processing}
          style={{
            padding: '0.375rem 1rem',
            backgroundColor: primaryColor,
            color: 'var(--color-text-primary)',
            border: 'none',
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? 0.5 : 1,
          }}
        >
          {processing ? 'Processing...' : 'Approve'}
        </button>
        <button
          onClick={onReject}
          disabled={processing}
          style={{
            padding: '0.375rem 1rem',
            backgroundColor: 'transparent',
            color: 'var(--color-error)',
            border: '1px solid var(--color-error)',
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? 0.5 : 1,
          }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function CommandRow({ command }: { command: CommandHistoryItem }) {
  const priorityColors: Record<string, string> = {
    CRITICAL: 'var(--color-error)',
    HIGH: 'var(--color-warning)',
    NORMAL: 'var(--color-primary)',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.625rem 0.75rem',
      backgroundColor: 'var(--color-bg-main)',
      border: '1px solid var(--color-bg-elevated)',
      borderRadius: '0.375rem',
      fontSize: '0.8rem',
    }}>
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: priorityColors[command.priority] || 'var(--color-text-disabled)',
        flexShrink: 0,
      }} />
      <span style={{ color: 'var(--color-text-primary)', fontWeight: '500', minWidth: '120px' }}>{command.targetManager.replace(/_/g, ' ')}</span>
      <span style={{ color: 'var(--color-text-secondary)', flex: 1 }}>{command.command}</span>
      <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.7rem', flexShrink: 0 }}>
        {new Date(command.issuedAt).toLocaleTimeString()}
      </span>
    </div>
  );
}
