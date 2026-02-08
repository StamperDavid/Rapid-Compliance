'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
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
    : '#6366f1';

  const fetchBriefing = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [briefingRes, commandsRes] = await Promise.all([
        fetch('/api/orchestrator/executive-briefing'),
        fetch('/api/orchestrator/command?limit=20'),
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
      const res = await fetch('/api/orchestrator/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#1a1a1a', animation: 'pulse 2s infinite' }} />
            <div>
              <div style={{ width: '250px', height: '28px', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', marginBottom: '0.5rem' }} />
              <div style={{ width: '180px', height: '16px', backgroundColor: '#111', borderRadius: '0.25rem' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: '120px', backgroundColor: '#1a1a1a', borderRadius: '1rem', border: '1px solid #333' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                Executive Briefing
              </h1>
              <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.875rem' }}>
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
                color: '#fff',
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
          <div style={{ padding: '1rem', backgroundColor: '#7f1d1d', border: '1px solid #991b1b', borderRadius: '0.75rem', marginBottom: '1.5rem', color: '#fca5a5', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {briefing && (
          <>
            {/* Briefing Summary Card */}
            <section style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'start' }}>
                <div style={{ fontSize: '2rem', flexShrink: 0 }}>
                  <JasperAvatar />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', margin: '0 0 0.75rem 0' }}>
                    Jasper&apos;s Briefing
                  </h2>
                  <p style={{ color: '#ccc', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
                    {briefing.summary}
                  </p>
                </div>
              </div>
            </section>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <MetricCard label="Op Cycles" value={briefing.metrics.totalOperationalCycles} color="#6366f1" />
              <MetricCard label="Actions Executed" value={briefing.metrics.totalActionsExecuted} color="#8b5cf6" />
              <MetricCard label="Success Rate" value={`${Math.round(briefing.metrics.successRate * 100)}%`} color="#10b981" />
              <MetricCard label="Replies Processed" value={briefing.metrics.inboundRepliesProcessed} color="#3b82f6" />
              <MetricCard label="Leads Advanced" value={briefing.metrics.leadsAdvanced} color="#f59e0b" />
              <MetricCard label="Content Produced" value={briefing.metrics.contentProduced} color="#ec4899" />
              <MetricCard label="Reviews Responded" value={briefing.metrics.reviewsResponded} color="#14b8a6" />
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '1.5rem' }} className="lg:grid-cols-2">
              {/* Highlights */}
              <section style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>Highlights</h2>
                {briefing.highlights.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '0.875rem' }}>No highlights for this period.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {briefing.highlights.map((h, i) => (
                      <HighlightCard key={i} highlight={h} />
                    ))}
                  </div>
                )}
              </section>

              {/* Department Status */}
              <section style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>Department Status</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {briefing.departmentSummaries.map((dept) => (
                    <DepartmentRow key={dept.managerId} dept={dept} />
                  ))}
                </div>
              </section>
            </div>

            {/* Pending Approvals */}
            {briefing.pendingApprovals.length > 0 && (
              <section style={{ backgroundColor: '#1a1a1a', border: `1px solid ${primaryColor}44`, borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
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
            <section style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                  Command History
                </h2>
                <Link href="/dashboard" style={{ color: primaryColor, fontSize: '0.875rem', textDecoration: 'none' }}>
                  Back to Dashboard
                </Link>
              </div>
              {commands.length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.875rem' }}>No commands issued yet.</p>
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
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.25rem',
      fontWeight: 'bold',
      color: '#fff',
    }}>
      J
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '0.75rem',
      padding: '1.25rem',
      borderLeft: `3px solid ${color}`,
    }}>
      <p style={{ fontSize: '0.75rem', color: '#999', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
        {value}
      </p>
    </div>
  );
}

function HighlightCard({ highlight }: { highlight: BriefingHighlight }) {
  const typeStyles: Record<string, { bg: string; border: string; icon: string }> = {
    SUCCESS: { bg: '#052e16', border: '#166534', icon: 'check_circle' },
    WARNING: { bg: '#431407', border: '#9a3412', icon: 'warning' },
    ACTION_REQUIRED: { bg: '#4c0519', border: '#be123c', icon: 'error' },
    INFO: { bg: '#0c1929', border: '#1e40af', icon: 'info' },
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
        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#fff' }}>{highlight.title}</span>
        <span style={{
          fontSize: '0.65rem',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: highlight.impact === 'HIGH' ? '#7f1d1d' : highlight.impact === 'MEDIUM' ? '#78350f' : '#1e3a5f',
          color: highlight.impact === 'HIGH' ? '#fca5a5' : highlight.impact === 'MEDIUM' ? '#fde68a' : '#93c5fd',
        }}>
          {highlight.impact}
        </span>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#aaa', margin: 0 }}>{highlight.description}</p>
    </div>
  );
}

function DepartmentRow({ dept }: { dept: DepartmentSummary }) {
  const statusColors: Record<string, string> = {
    HEALTHY: '#10b981',
    NEEDS_ATTENTION: '#f59e0b',
    CRITICAL: '#ef4444',
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
      backgroundColor: '#0a0a0a',
      border: '1px solid #222',
      borderRadius: '0.5rem',
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: statusColors[dept.status] || '#666',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>{dept.department}</div>
        <div style={{ fontSize: '0.75rem', color: '#666' }}>
          {dept.actionsCompleted} completed, {dept.actionsPending} pending
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '0.8rem', color: '#ccc' }}>
          {dept.keyMetricValue} {trendIcon[dept.trend]}
        </div>
        <div style={{ fontSize: '0.65rem', color: '#666' }}>{dept.keyMetric}</div>
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
    CRITICAL: { bg: '#7f1d1d', text: '#fca5a5' },
    HIGH: { bg: '#7c2d12', text: '#fdba74' },
    NORMAL: { bg: '#1e3a5f', text: '#93c5fd' },
    LOW: { bg: '#374151', text: '#9ca3af' },
  };

  const urgStyle = urgencyColors[approval.urgency] || urgencyColors.NORMAL;

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: '#0a0a0a',
      border: '1px solid #333',
      borderRadius: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#fff' }}>{approval.type.replace(/_/g, ' ')}</span>
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
        <span style={{ fontSize: '0.7rem', color: '#666' }}>
          {new Date(approval.createdAt).toLocaleString()}
        </span>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 0.75rem 0' }}>{approval.description}</p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onApprove}
          disabled={processing}
          style={{
            padding: '0.375rem 1rem',
            backgroundColor: primaryColor,
            color: '#fff',
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
            color: '#ef4444',
            border: '1px solid #ef4444',
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
    CRITICAL: '#ef4444',
    HIGH: '#f59e0b',
    NORMAL: '#6366f1',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.625rem 0.75rem',
      backgroundColor: '#0a0a0a',
      border: '1px solid #222',
      borderRadius: '0.375rem',
      fontSize: '0.8rem',
    }}>
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: priorityColors[command.priority] || '#666',
        flexShrink: 0,
      }} />
      <span style={{ color: '#fff', fontWeight: '500', minWidth: '120px' }}>{command.targetManager.replace(/_/g, ' ')}</span>
      <span style={{ color: '#999', flex: 1 }}>{command.command}</span>
      <span style={{ color: '#666', fontSize: '0.7rem', flexShrink: 0 }}>
        {new Date(command.issuedAt).toLocaleTimeString()}
      </span>
    </div>
  );
}
