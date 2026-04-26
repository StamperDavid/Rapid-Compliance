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
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useMissionStream } from '@/hooks/useMissionStream';
import MissionSidebar from './_components/MissionSidebar';
import MissionTimeline from './_components/MissionTimeline';
import PlanReviewPanel from './_components/PlanReviewPanel';
// Note: ApprovalCard was deleted from _components in M3.9. The legacy
// approval card was orphaned (its approve button called a route that
// had nothing to do with mission steps). The mission-halt fallback is
// now a simple inline alert — see StepDetailPanel below.
import AgentAvatar from './_components/AgentAvatar';
import CampaignReview from './_components/CampaignReview';
import MissionGradeCard from './_components/MissionGradeCard';
import StepGradeWidget from './_components/StepGradeWidget';
import { SendDmReplyButton } from './_components/SendDmReplyButton';
import SpecialistVersionHistory from './_components/SpecialistVersionHistory';
import ScheduleMissionDialog from './_components/ScheduleMissionDialog';
import { getDashboardLink, getStepReviewLink, formatToolName } from './_components/dashboard-links';
import { PageTitle } from '@/components/ui/typography';
import type { Mission, MissionStep } from '@/lib/orchestrator/mission-persistence';

// ============================================================================
// TYPES
// ============================================================================

interface MissionListResponse {
  success: boolean;
  data?: { missions: Mission[]; hasMore: boolean };
}

interface GradeEntry {
  score: number;
  explanation?: string;
}

interface GradeApiGrade {
  stepId?: string;
  score: number;
  explanation?: string;
}

interface GradeApiResponse {
  success: boolean;
  data?: { grades: GradeApiGrade[] };
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

// ============================================================================
// INTELLIGENCE BRIEF RENDERER
// ============================================================================

function IntelligenceBriefRenderer({
  data,
  sectionLabel,
  contentBox,
}: {
  data: Record<string, unknown>;
  sectionLabel: React.CSSProperties;
  contentBox: React.CSSProperties;
}) {
  const [showRaw, setShowRaw] = useState(false);

  if (showRaw) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={sectionLabel}>Intelligence Brief (Raw)</div>
          <button
            type="button"
            onClick={() => setShowRaw(false)}
            style={{
              background: 'none', border: '1px solid var(--color-border-light)',
              borderRadius: '0.375rem', padding: '0.25rem 0.625rem',
              fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
              color: 'var(--color-text-secondary)', font: 'inherit',
            }}
          >
            Formatted View
          </button>
        </div>
        <div style={{
          ...contentBox,
          fontFamily: 'monospace', fontSize: '0.6875rem',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '500px',
        }}>
          {JSON.stringify(data, null, 2)}
        </div>
      </div>
    );
  }

  const synthesis = data.synthesis as Record<string, unknown> | null;
  const competitors = (data.competitorAnalysis as Record<string, unknown>)
    ?.competitors as Array<Record<string, unknown>> | undefined;
  const marketInsights = (data.competitorAnalysis as Record<string, unknown>)
    ?.marketInsights as Record<string, unknown> | undefined;
  const trendSignals = (data.trendAnalysis as Record<string, unknown>)
    ?.signals as Array<Record<string, unknown>> | undefined;
  const execution = data.execution as Record<string, unknown> | null;
  const errors = data.errors as string[] | undefined;
  const request = data.request as Record<string, unknown> | null;

  const pillStyle = (color: string, bg: string): React.CSSProperties => ({
    display: 'inline-block', fontSize: '0.625rem', fontWeight: 700,
    padding: '0.125rem 0.5rem', borderRadius: '9999px',
    color, backgroundColor: bg, letterSpacing: '0.02em',
  });

  const cardStyle: React.CSSProperties = {
    padding: '0.625rem 0.75rem', backgroundColor: 'var(--color-bg-elevated)',
    borderRadius: '0.5rem', border: '1px solid var(--color-border-light)',
  };

  const urgencyColor = (u: string) => {
    switch (u) {
      case 'HIGH': return { color: '#dc2626', bg: 'rgba(220,38,38,0.1)' };
      case 'MEDIUM': return { color: '#d97706', bg: 'rgba(217,119,6,0.1)' };
      default: return { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
    }
  };

  const signalTypeIcon = (t: string) => {
    switch (t) {
      case 'TREND_EMERGING': return '\u2197';    // ↗
      case 'TREND_DECLINING': return '\u2198';    // ↘
      case 'INDUSTRY_SHIFT': return '\u21C4';     // ⇄
      case 'OPPORTUNITY': return '\u2605';        // ★
      default: return '\u2022';                   // •
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header with toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={sectionLabel}>Intelligence Brief</div>
          {synthesis?.overallConfidence != null && (
            <span style={pillStyle(
              Number(synthesis.overallConfidence) >= 0.7 ? '#059669' : '#d97706',
              Number(synthesis.overallConfidence) >= 0.7 ? 'rgba(5,150,105,0.1)' : 'rgba(217,119,6,0.1)',
            )}>
              {Math.round(Number(synthesis.overallConfidence) * 100)}% confidence
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowRaw(true)}
          style={{
            background: 'none', border: '1px solid var(--color-border-light)',
            borderRadius: '0.375rem', padding: '0.25rem 0.625rem',
            fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
            color: 'var(--color-text-secondary)', font: 'inherit',
          }}
        >
          Raw JSON
        </button>
      </div>

      {/* Research context */}
      {request ? (
        <div style={{
          ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
          alignItems: 'center', fontSize: '0.75rem',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            {String(request.intent ?? '').replace(/_/g, ' ')}
          </span>
          {request.niche ? (
            <span style={pillStyle('#7c3aed', 'rgba(124,58,237,0.1)')}>
              {String(request.niche)}
            </span>
          ) : null}
          {request.brandName ? (
            <span style={{ color: 'var(--color-text-disabled)' }}>
              for &quot;{String(request.brandName)}&quot;
            </span>
          ) : null}
          {Array.isArray(request.keywords) && request.keywords.length > 0 && (
            <span style={{ color: 'var(--color-text-disabled)' }}>
              &middot; {(request.keywords as string[]).join(', ')}
            </span>
          )}
        </div>
      ) : null}

      {/* Execution status bar */}
      {execution ? (
        <div style={{
          display: 'flex', gap: '0.75rem', fontSize: '0.6875rem',
          color: 'var(--color-text-secondary)',
        }}>
          <span>
            <span style={{ fontWeight: 700, color: '#059669' }}>
              {String(execution.successfulSpecialists)}
            </span> / {String(execution.totalSpecialists)} specialists succeeded
          </span>
          {Number(execution.failedSpecialists) > 0 && (
            <span style={{ color: '#dc2626' }}>
              {String(execution.failedSpecialists)} failed
            </span>
          )}
          {execution.totalExecutionTimeMs != null && (
            <span>
              {(Number(execution.totalExecutionTimeMs) / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      ) : null}

      {/* Executive Summary */}
      {synthesis?.executiveSummary ? (
        <div>
          <div style={sectionLabel}>Executive Summary</div>
          <div style={{ ...contentBox, fontWeight: 500, lineHeight: 1.7 }}>
            {String(synthesis.executiveSummary)}
          </div>
        </div>
      ) : null}

      {/* Key Findings */}
      {Array.isArray(synthesis?.keyFindings) && (synthesis.keyFindings as string[]).length > 0 ? (
        <div>
          <div style={sectionLabel}>Key Findings</div>
          <div style={{ ...contentBox, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {(synthesis.keyFindings as string[]).map((finding, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: 'rgba(59,130,246,0.12)', color: '#3b82f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.625rem', fontWeight: 700,
                }}>
                  {i + 1}
                </span>
                <span>{finding}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Opportunities & Threats side by side */}
      {(Array.isArray(synthesis?.opportunities) || Array.isArray(synthesis?.threats)) ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {Array.isArray(synthesis?.opportunities) && (synthesis.opportunities as string[]).length > 0 ? (
            <div>
              <div style={sectionLabel}>Opportunities</div>
              <div style={{ ...contentBox, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {(synthesis.opportunities as string[]).map((opp, i) => (
                  <div key={i} style={{
                    padding: '0.375rem 0.625rem', borderRadius: '0.375rem',
                    backgroundColor: 'rgba(5,150,105,0.06)',
                    borderLeft: '3px solid #059669', fontSize: '0.8125rem',
                  }}>
                    {opp}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {Array.isArray(synthesis?.threats) && (synthesis.threats as string[]).length > 0 ? (
            <div>
              <div style={sectionLabel}>Threats</div>
              <div style={{ ...contentBox, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {(synthesis.threats as string[]).map((threat, i) => (
                  <div key={i} style={{
                    padding: '0.375rem 0.625rem', borderRadius: '0.375rem',
                    backgroundColor: 'rgba(220,38,38,0.06)',
                    borderLeft: '3px solid #dc2626', fontSize: '0.8125rem',
                  }}>
                    {threat}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Competitor Analysis */}
      {competitors && competitors.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <div style={sectionLabel}>Competitor Analysis</div>
            <span style={pillStyle('#3b82f6', 'rgba(59,130,246,0.1)')}>
              {competitors.length} found
            </span>
            {marketInsights?.avgDomainAuthority != null && (
              <span style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)' }}>
                Avg DA: {String(marketInsights.avgDomainAuthority)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {competitors.map((comp, i) => {
              const seo = comp.seoMetrics as Record<string, unknown> | undefined;
              const pos = comp.positioning as Record<string, unknown> | undefined;
              const strengths = comp.strengths as string[] | undefined;
              const weaknesses = comp.weaknesses as string[] | undefined;
              return (
                <div key={i} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        #{String(comp.rank)} {String(comp.name)}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                        {String(comp.domain)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      {seo?.domainAuthority != null ? (
                        <span style={pillStyle('#7c3aed', 'rgba(124,58,237,0.1)')}>
                          DA {String(seo.domainAuthority)}
                        </span>
                      ) : null}
                      {seo?.estimatedTraffic ? (
                        <span style={pillStyle(
                          seo.estimatedTraffic === 'high' ? '#059669' : '#d97706',
                          seo.estimatedTraffic === 'high' ? 'rgba(5,150,105,0.1)' : 'rgba(217,119,6,0.1)',
                        )}>
                          {String(seo.estimatedTraffic)} traffic
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {pos?.targetAudience ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                      Target: {String(pos.targetAudience)}
                      {pos.pricePoint && pos.pricePoint !== 'unknown' ? ` \u00B7 ${String(pos.pricePoint)}` : null}
                    </div>
                  ) : null}
                  {pos?.tagline ? (
                    <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
                      &ldquo;{String(pos.tagline)}&rdquo;
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.6875rem' }}>
                    {strengths && strengths.length > 0 && (
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, color: '#059669' }}>Strengths: </span>
                        {strengths.join(', ')}
                      </div>
                    )}
                    {weaknesses && weaknesses.length > 0 && (
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, color: '#dc2626' }}>Gaps: </span>
                        {weaknesses.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Market Insights */}
          {marketInsights?.recommendations && Array.isArray(marketInsights.recommendations) ? (
            <div style={{ marginTop: '0.5rem', ...cardStyle, borderLeft: '3px solid #3b82f6' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#3b82f6', marginBottom: '0.25rem' }}>
                Market Recommendations
              </div>
              {(marketInsights.recommendations as string[]).map((rec, i) => (
                <div key={i} style={{ fontSize: '0.8125rem', marginBottom: '0.125rem' }}>
                  {rec}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Trend Signals */}
      {trendSignals && trendSignals.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <div style={sectionLabel}>Trend Signals</div>
            <span style={pillStyle('#3b82f6', 'rgba(59,130,246,0.1)')}>
              {trendSignals.length} detected
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {trendSignals.map((sig, i) => {
              const uc = urgencyColor(String(sig.urgency ?? 'LOW'));
              return (
                <div key={i} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.875rem' }}>
                        {signalTypeIcon(String(sig.type))}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                        {String(sig.title ?? '')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                      <span style={pillStyle(uc.color, uc.bg)}>
                        {String(sig.urgency)}
                      </span>
                      <span style={pillStyle('#6b7280', 'rgba(107,114,128,0.1)')}>
                        {String(sig.type ?? '').replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  {sig.description ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {String(sig.description)}
                    </div>
                  ) : null}
                  {sig.source ? (
                    <div style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)', marginTop: '0.25rem' }}>
                      Source: {String(sig.source)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommended Actions */}
      {Array.isArray(synthesis?.recommendedActions) && (synthesis.recommendedActions as string[]).length > 0 && (
        <div>
          <div style={sectionLabel}>Recommended Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {(synthesis.recommendedActions as string[]).map((action, i) => (
              <div key={i} style={{
                ...cardStyle, display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)', flexShrink: 0,
                }} />
                <span style={{ fontSize: '0.8125rem' }}>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {errors && errors.length > 0 && (
        <div>
          <div style={sectionLabel}>Errors</div>
          <div style={{
            ...contentBox, backgroundColor: 'rgba(220,38,38,0.05)',
            border: '1px solid rgba(220,38,38,0.15)',
          }}>
            {errors.map((err, i) => (
              <div key={i} style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: '0.25rem' }}>
                {err}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timestamp footer */}
      {(data.requestedAt || data.completedAt) ? (
        <div style={{
          fontSize: '0.625rem', color: 'var(--color-text-disabled)',
          display: 'flex', gap: '1rem',
        }}>
          {data.requestedAt ? <span>Requested: {new Date(String(data.requestedAt)).toLocaleString()}</span> : null}
          {data.completedAt ? <span>Completed: {new Date(String(data.completedAt)).toLocaleString()}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// DETAIL PANEL OUTPUT RENDERER
// ============================================================================

function DetailOutputRenderer({ toolResult }: { toolResult: string }) {
  const sectionLabel: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-disabled)',
    marginBottom: '0.375rem',
  };

  const contentBox: React.CSSProperties = {
    padding: '0.75rem',
    backgroundColor: 'var(--color-bg-elevated)',
    borderRadius: '0.5rem',
    fontSize: '0.8125rem',
    color: 'var(--color-text-primary)',
    lineHeight: 1.6,
    maxHeight: '400px',
    overflowY: 'auto',
  };

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(toolResult) as Record<string, unknown>;
  } catch {
    // Not JSON
  }

  if (!parsed) {
    return (
      <CollapsibleSection title="Output (Result)">
        {toolResult}
      </CollapsibleSection>
    );
  }

  const outputType = (parsed.type as string)
    ?? (parsed.mode === 'INBOUND_DM_REPLY' && parsed.composedReply ? 'inbound-dm-reply' : null)
    ?? (parsed.status === 'draft' ? 'draft' : null)
    ?? (parsed.briefId && (parsed.synthesis || parsed.competitorAnalysis) ? 'intelligence-brief' : null)
    ?? (parsed.detectedIntent && (parsed.blogContent || parsed.videoContent || parsed.musicContent || parsed.podcastContent || parsed.specialistOutputs) ? 'content-package' : null);

  switch (outputType) {
    case 'inbound-dm-reply': {
      const platform = String(parsed.platform ?? '');
      const senderHandle = String(parsed.senderHandle ?? '');
      const senderId = String(parsed.senderId ?? '');
      const inboundText = String(parsed.inboundText ?? '');
      const composed = parsed.composedReply as Record<string, unknown> | undefined;
      const replyText = String(composed?.replyText ?? '');
      const reasoning = String(composed?.reasoning ?? '');
      const confidence = String(composed?.confidence ?? 'unknown');
      const escalation = composed?.suggestEscalation === true;
      const platformLabel = platform === 'bluesky' ? 'Bluesky' : platform === 'x' ? 'X (Twitter)' : platform;
      const senderLabel = senderHandle || senderId.slice(0, 14);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <div style={sectionLabel}>From</div>
            <div style={{ ...contentBox, padding: '0.5rem 0.75rem' }}>
              <span style={{ fontWeight: 600 }}>{senderLabel}</span>
              <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                via {platformLabel}
              </span>
            </div>
          </div>
          <div>
            <div style={sectionLabel}>Customer&apos;s message</div>
            <div style={{ ...contentBox, whiteSpace: 'pre-wrap' }}>{inboundText}</div>
          </div>
          <div>
            <div style={sectionLabel}>Composed reply</div>
            <div style={{ ...contentBox, whiteSpace: 'pre-wrap', borderLeft: '3px solid var(--color-primary)' }}>
              {replyText}
            </div>
            <div style={{
              marginTop: '0.375rem',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              fontSize: '0.6875rem',
              color: 'var(--color-text-disabled)',
            }}>
              <span>{replyText.length} chars</span>
              <span>•</span>
              <span>Confidence: <strong style={{ color: 'var(--color-text-primary)' }}>{confidence}</strong></span>
              {escalation && (
                <>
                  <span>•</span>
                  <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Specialist suggests human escalation</span>
                </>
              )}
            </div>
          </div>
          {reasoning && (
            <CollapsibleSection title="Why the agent wrote this">
              {reasoning}
            </CollapsibleSection>
          )}
        </div>
      );
    }
    case 'research': {
      const findings = parsed.findings as string | undefined;
      const insights = parsed.keyInsights as string[] | undefined;
      const topic = parsed.topic as string | undefined;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {topic && (
            <div>
              <div style={sectionLabel}>Topic</div>
              <div style={{ ...contentBox, padding: '0.5rem 0.75rem', fontWeight: 500 }}>{topic}</div>
            </div>
          )}
          {findings && (
            <div>
              <div style={sectionLabel}>Research Findings</div>
              <div style={{ ...contentBox, whiteSpace: 'pre-wrap' }}>{findings}</div>
            </div>
          )}
          {insights && insights.length > 0 && (
            <div>
              <div style={sectionLabel}>Key Insights ({insights.length})</div>
              <div style={contentBox}>
                {insights.map((insight, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'flex-start',
                    marginBottom: i < insights.length - 1 ? '0.5rem' : 0,
                  }}>
                    <span style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(124,58,237,0.15)',
                      color: '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    case 'strategy': {
      const angle = parsed.narrativeAngle as string | undefined;
      const audience = parsed.targetAudience as string | undefined;
      const messages = parsed.keyMessages as string[] | undefined;
      const tone = parsed.tone as string | undefined;
      const cta = parsed.callToAction as string | undefined;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={sectionLabel}>Messaging Strategy</div>
          <div style={contentBox}>
            {angle && (
              <div style={{ marginBottom: '0.625rem' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', fontWeight: 600 }}>Narrative Angle</div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{angle}</div>
              </div>
            )}
            {audience && (
              <div style={{ marginBottom: '0.625rem' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', fontWeight: 600 }}>Target Audience</div>
                <div>{audience}</div>
              </div>
            )}
            {tone && (
              <div style={{ marginBottom: '0.625rem' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', fontWeight: 600 }}>Tone</div>
                <div style={{ textTransform: 'capitalize' }}>{tone}</div>
              </div>
            )}
            {messages && messages.length > 0 && (
              <div style={{ marginBottom: '0.625rem' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Key Messages
                </div>
                {messages.map((msg, i) => (
                  <div key={i} style={{
                    padding: '0.375rem 0.625rem',
                    backgroundColor: 'rgba(14,165,233,0.08)',
                    borderRadius: '0.375rem',
                    marginBottom: '0.25rem',
                    fontSize: '0.8125rem',
                  }}>
                    {msg}
                  </div>
                ))}
              </div>
            )}
            {cta && (
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', fontWeight: 600 }}>Call to Action</div>
                <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{cta}</div>
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'cinematic': {
      const configs = parsed.configs as Array<Record<string, unknown>> | undefined;
      const globalStyle = parsed.globalStyle as string | undefined;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={sectionLabel}>Cinematic Design</div>
          {globalStyle && (
            <div style={{
              ...contentBox,
              padding: '0.5rem 0.75rem',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}>
              Overall Style: {globalStyle}
            </div>
          )}
          {configs?.map((cfg, i) => (
            <div key={i} style={{
              ...contentBox,
              padding: '0.625rem 0.75rem',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.375rem' }}>
                Scene {cfg.sceneNumber as number}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                {typeof cfg.shotType === 'string' && <><span style={{ color: 'var(--color-text-disabled)' }}>Shot</span><span>{cfg.shotType}</span></>}
                {typeof cfg.lighting === 'string' && <><span style={{ color: 'var(--color-text-disabled)' }}>Lighting</span><span>{cfg.lighting}</span></>}
                {typeof cfg.camera === 'string' && <><span style={{ color: 'var(--color-text-disabled)' }}>Camera</span><span>{cfg.camera}</span></>}
                {typeof cfg.artStyle === 'string' && <><span style={{ color: 'var(--color-text-disabled)' }}>Style</span><span>{cfg.artStyle}</span></>}
                {typeof cfg.filmStock === 'string' && <><span style={{ color: 'var(--color-text-disabled)' }}>Film Stock</span><span>{cfg.filmStock}</span></>}
                {typeof cfg.focalLength === 'string' && <><span style={{ color: 'var(--color-text-disabled)' }}>Focal</span><span>{cfg.focalLength}</span></>}
              </div>
            </div>
          ))}
        </div>
      );
    }

    case 'thumbnails': {
      const thumbnails = parsed.thumbnails as Array<{ sceneNumber: number; url: string }> | undefined;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={sectionLabel}>Scene Thumbnails ({thumbnails?.length ?? 0})</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '0.625rem',
          }}>
            {thumbnails?.map((thumb, i) => (
              <div key={i} style={{
                borderRadius: '0.5rem',
                overflow: 'hidden',
                border: '1px solid var(--color-border-light)',
              }}>
                <Image
                  src={thumb.url}
                  alt={`Scene ${thumb.sceneNumber}`}
                  width={260}
                  height={146}
                  unoptimized
                  style={{
                    width: '100%',
                    height: 'auto',
                    aspectRatio: '16/9',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  textAlign: 'center',
                }}>
                  Scene {thumb.sceneNumber}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'draft': {
      const title = parsed.title as string | undefined;
      const sceneCount = parsed.sceneCount as number | undefined;
      const reviewLink = parsed.reviewLink as string | undefined;
      const characterAssignments = parsed.characterAssignments as number | undefined;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={sectionLabel}>Storyboard Complete</div>
          <div style={contentBox}>
            {title && <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>{title}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {sceneCount !== undefined && (
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '0.1875rem 0.625rem',
                  borderRadius: '9999px',
                  color: '#059669',
                  backgroundColor: 'rgba(5,150,105,0.1)',
                }}>
                  {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
                </span>
              )}
              {characterAssignments !== undefined && characterAssignments > 0 && (
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '0.1875rem 0.625rem',
                  borderRadius: '9999px',
                  color: '#7c3aed',
                  backgroundColor: 'rgba(124,58,237,0.1)',
                }}>
                  {characterAssignments} character{characterAssignments !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {reviewLink && (
              <a
                href={reviewLink}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.625rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: '0.8125rem',
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

    case 'intelligence-brief':
      return <IntelligenceBriefRenderer data={parsed} sectionLabel={sectionLabel} contentBox={contentBox} />;

    case 'content-package':
      return <ContentPackageBriefRenderer data={parsed} sectionLabel={sectionLabel} contentBox={contentBox} />;

    default:
      return (
        <CollapsibleSection title="Output (Result)">
          {JSON.stringify(parsed, null, 2)}
        </CollapsibleSection>
      );
  }
}

// ============================================================================
// CONTENT PACKAGE RENDERER (inline, right-panel compact version)
// ============================================================================

function ContentPackageBriefRenderer({
  data,
  sectionLabel,
  contentBox,
}: {
  data: Record<string, unknown>;
  sectionLabel: React.CSSProperties;
  contentBox: React.CSSProperties;
}) {
  const [showRaw, setShowRaw] = useState(false);

  if (showRaw) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={sectionLabel}>Content Package (Raw)</div>
          <button
            type="button"
            onClick={() => setShowRaw(false)}
            style={{
              background: 'none', border: '1px solid var(--color-border-light)',
              borderRadius: '0.375rem', padding: '0.25rem 0.625rem',
              fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
              color: 'var(--color-text-secondary)', font: 'inherit',
            }}
          >
            Formatted View
          </button>
        </div>
        <div style={{
          ...contentBox,
          fontFamily: 'monospace', fontSize: '0.6875rem',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '500px',
        }}>
          {JSON.stringify(data, null, 2)}
        </div>
      </div>
    );
  }

  const detectedIntent = data.detectedIntent as string | undefined;
  const blogContent = data.blogContent as Record<string, unknown> | null | undefined;
  const videoContent = data.videoContent as Record<string, unknown> | null | undefined;
  const musicContent = data.musicContent as Record<string, unknown> | null | undefined;
  const podcastContent = data.podcastContent as Record<string, unknown> | null | undefined;
  const validation = data.validation as { passed?: boolean; seoScore?: number; toneConsistency?: number } | undefined;
  const execution = data.execution as { totalSpecialists?: number; successfulSpecialists?: number; failedSpecialists?: number } | undefined;

  const pillStyle = (color: string, bg: string): React.CSSProperties => ({
    display: 'inline-block', fontSize: '0.625rem', fontWeight: 700,
    padding: '0.125rem 0.5rem', borderRadius: '9999px',
    color, backgroundColor: bg, letterSpacing: '0.02em',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header with toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={sectionLabel}>Content Package</div>
          {detectedIntent && (
            <span style={pillStyle('#0369a1', 'rgba(3,105,161,0.1)')}>
              {detectedIntent.replace(/_/g, ' ')}
            </span>
          )}
          {validation?.passed != null && (
            <span style={pillStyle(
              validation.passed ? '#059669' : '#dc2626',
              validation.passed ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)',
            )}>
              {validation.passed ? 'Validated' : 'Validation failed'}
            </span>
          )}
          {execution && typeof execution.successfulSpecialists === 'number' && (
            <span style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)' }}>
              {execution.successfulSpecialists}/{execution.totalSpecialists} specialists
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowRaw(true)}
          style={{
            background: 'none', border: '1px solid var(--color-border-light)',
            borderRadius: '0.375rem', padding: '0.25rem 0.625rem',
            fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
            color: 'var(--color-text-secondary)', font: 'inherit',
          }}
        >
          Raw JSON
        </button>
      </div>

      {/* Blog post */}
      {blogContent && (() => {
        const title = blogContent.title as string | undefined;
        const metaDescription = blogContent.metaDescription as string | undefined;
        const slug = blogContent.slug as string | undefined;
        const estimatedReadTime = blogContent.estimatedReadTime as string | undefined;
        const sections = blogContent.sections as Array<{ headingLevel?: string; heading?: string; body?: string; keyTakeaway?: string }> | undefined;
        const cta = blogContent.cta as { text?: string; placement?: string } | undefined;
        const blogPostId = blogContent.blogPostId as string | undefined;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div style={{ ...contentBox, padding: '0.75rem' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                {title ?? 'Untitled blog post'}
              </div>
              {metaDescription && (
                <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {metaDescription}
                </div>
              )}
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', fontSize: '0.625rem', color: 'var(--color-text-disabled)', alignItems: 'center', flexWrap: 'wrap' }}>
                {slug && <span>/{slug}</span>}
                {estimatedReadTime && <span>{estimatedReadTime}</span>}
                {Array.isArray(sections) && <span>{sections.length} sections</span>}
                {blogPostId && (
                  <a
                    href={`/website/blog/editor?postId=${blogPostId}`}
                    style={{
                      marginLeft: 'auto',
                      padding: '0.25rem 0.625rem',
                      backgroundColor: 'var(--color-primary)',
                      color: '#fff',
                      borderRadius: '0.25rem',
                      textDecoration: 'none',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                    }}
                  >
                    Open in Editor →
                  </a>
                )}
              </div>
            </div>

            {Array.isArray(sections) && sections.length > 0 && (
              <div style={contentBox}>
                {sections.map((s, i) => (
                  <div key={i} style={{ marginBottom: i < sections.length - 1 ? '0.75rem' : 0 }}>
                    <div style={{ fontSize: s.headingLevel === 'h3' ? '0.75rem' : '0.8125rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                      {s.heading ?? 'Untitled section'}
                    </div>
                    {s.body && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {s.body}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {cta?.text && (
              <div style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: '0.375rem',
                borderLeft: '3px solid var(--color-primary)',
                fontSize: '0.75rem',
                color: 'var(--color-text-primary)',
                fontWeight: 600,
              }}>
                CTA: {cta.text}
              </div>
            )}
          </div>
        );
      })()}

      {/* Non-blog content fallbacks (video/music/podcast) — compact summary only */}
      {videoContent && (
        <div style={contentBox}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Video output attached</div>
        </div>
      )}
      {musicContent && (
        <div style={contentBox}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Soundtrack plan attached</div>
        </div>
      )}
      {podcastContent && (
        <div style={contentBox}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Podcast episode plan attached</div>
        </div>
      )}

      {/* Nothing populated — show the agent activity instead of a blank panel */}
      {!blogContent && !videoContent && !musicContent && !podcastContent && (
        <div style={contentBox}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
            No content fields populated on this package. Check specialistOutputs for partial results.
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STEP DETAIL PANEL (RIGHT)
// ============================================================================

function UpstreamChangedBanner({
  missionId,
  stepId,
}: {
  missionId: string;
  stepId: string;
}) {
  const authFetch = useAuthFetch();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleStillGood = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(
        `/api/orchestrator/missions/${missionId}/steps/${stepId}/clear-upstream-flag`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
      );
      if (res.ok) {
        // Optimistic — hide the banner. The next refetch will sync the real state.
        setDismissed(true);
      }
    } finally {
      setBusy(false);
    }
  }, [authFetch, missionId, stepId]);

  if (dismissed) { return null; }

  return (
    <div style={{
      padding: '0.75rem 1rem',
      marginBottom: '0.75rem',
      backgroundColor: 'rgba(var(--color-warning-rgb), 0.1)',
      border: '1px solid var(--color-warning)',
      borderRadius: '0.5rem',
    }}>
      <div style={{
        fontSize: '0.6875rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--color-warning)',
        marginBottom: '0.25rem',
      }}>
        Upstream changed — re-review?
      </div>
      <div style={{
        fontSize: '0.75rem',
        color: 'var(--color-text-primary)',
        lineHeight: 1.5,
        marginBottom: '0.5rem',
      }}>
        An earlier step was rerun. This step&apos;s output may be stale. Decide:
        keep this output as-is, or rerun this step with the updated upstream.
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => void handleStillGood()}
          disabled={busy}
          style={{
            padding: '0.375rem 0.75rem',
            backgroundColor: 'var(--color-bg-paper)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? 'Working...' : 'Still good — keep this output'}
        </button>
      </div>
      <div style={{
        fontSize: '0.6875rem',
        color: 'var(--color-text-secondary)',
        marginTop: '0.375rem',
      }}>
        To rerun this step instead, use the rerun button below.
      </div>
    </div>
  );
}

function ManualEditOutputBox({
  missionId,
  stepId,
  currentResult,
  isManuallyEdited,
}: {
  missionId: string;
  stepId: string;
  currentResult: string;
  isManuallyEdited: boolean;
}) {
  const authFetch = useAuthFetch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(() => {
    setDraft(currentResult);
    setEditing(true);
    setError(null);
  }, [currentResult]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setDraft('');
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (draft.trim().length === 0) {
      setError('Output cannot be empty.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/orchestrator/missions/${missionId}/steps/${stepId}/edit-output`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newToolResult: draft }),
        },
      );
      const body = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !body.success) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }, [authFetch, draft, missionId, stepId]);

  return (
    <div style={{
      marginTop: '0.75rem',
      paddingTop: '0.75rem',
      borderTop: '1px solid var(--color-border-light)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
        marginBottom: '0.5rem',
      }}>
        <div style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-text-disabled)',
        }}>
          Manual edit {isManuallyEdited && <span style={{ color: 'var(--color-warning)' }}>· edited</span>}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={handleStart}
            style={{
              padding: '0.25rem 0.625rem',
              backgroundColor: 'var(--color-bg-paper)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: '0.375rem',
              fontSize: '0.6875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Edit output directly
          </button>
        )}
      </div>

      {editing && (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            rows={10}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '0.75rem',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              backgroundColor: 'var(--color-bg-elevated)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: '0.375rem',
              resize: 'vertical',
            }}
          />
          {error && (
            <div style={{
              marginTop: '0.375rem',
              fontSize: '0.6875rem',
              color: 'var(--color-error)',
            }}>
              {error}
            </div>
          )}
          <div style={{
            display: 'flex',
            gap: '0.375rem',
            marginTop: '0.5rem',
          }}>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy}
              style={{
                padding: '0.375rem 0.875rem',
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1,
              }}
            >
              {busy ? 'Saving...' : 'Save edit'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              style={{
                padding: '0.375rem 0.875rem',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
          </div>
          <div style={{
            fontSize: '0.6875rem',
            color: 'var(--color-text-disabled)',
            marginTop: '0.5rem',
            lineHeight: 1.4,
          }}>
            Saving overwrites the agent&apos;s output with your text. The
            agent&apos;s instructions are NOT changed — this is for small
            tweaks. To train the agent on a pattern, use the rate-this-step
            section instead.
          </div>
        </>
      )}
    </div>
  );
}

function StepDetailPanel({
  step,
  approvalStep,
  missionId,
  stepGrades,
  onScrapMission,
}: {
  step: MissionStep | null;
  approvalStep: MissionStep | null;
  missionId: string | undefined;
  stepGrades: Record<string, GradeEntry>;
  onScrapMission: () => void;
}) {
  // If the selected step is the approval step, show the approval card prominently
  const showingApproval = approvalStep && (!step || step.stepId === approvalStep.stepId);
  const displayStep = showingApproval ? approvalStep : step;

  // M2d — which specialist's version history is currently open (null = none)
  const [historyForSpecialist, setHistoryForSpecialist] = useState<string | null>(null);

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

  const dashboardLink = displayStep ? getDashboardLink(displayStep.toolName, displayStep.toolResult) : null;
  const reviewLink = displayStep ? getStepReviewLink(missionId, displayStep.stepId) : null;
  const statusColor = displayStep ? getStepStatusColor(displayStep.status) : 'var(--color-text-disabled)';

  // M3.9: simple inline alert for the mission-halt case. Replaces the
  // orphaned ApprovalCard component (which called a route unrelated to
  // mission steps). Operator reruns the failed step from the step
  // detail panel below — the alert just makes the halt visible.

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {approvalStep && (
        <div
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'rgba(var(--color-warning-rgb), 0.1)',
            border: '1px solid var(--color-warning)',
            borderRadius: '0.5rem',
          }}
        >
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-warning)',
            marginBottom: '0.25rem',
          }}>
            Mission halted — needs your attention
          </div>
          <div style={{
            fontSize: '0.8125rem',
            color: 'var(--color-text-primary)',
            lineHeight: 1.5,
            marginBottom: '0.625rem',
          }}>
            {formatToolName(approvalStep.toolName)} failed twice and the runner stopped.
            Review the step below and choose: rerun (with edited args if you want), or
            scrap the mission.
          </div>
          <button
            type="button"
            onClick={onScrapMission}
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: 'transparent',
              color: 'var(--color-error)',
              border: '1px solid var(--color-error)',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Scrap this mission
          </button>
        </div>
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

          {/* M5: upstream-changed flag — operator chose to rerun an
              earlier step, so this step's output may now be stale. */}
          {displayStep.upstreamChanged === true && missionId && (
            <UpstreamChangedBanner
              missionId={missionId}
              stepId={displayStep.stepId}
            />
          )}

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

          {/* Dashboard link + Review link */}
          {displayStep.status === 'COMPLETED' && (dashboardLink ?? reviewLink) && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {dashboardLink && (
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
                  }}
                >
                  View in {dashboardLink.label} &rarr;
                </a>
              )}
              {reviewLink && displayStep.toolResult && (
                <a
                  href={reviewLink.route}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.5rem 0.875rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-light)',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'opacity 0.15s',
                  }}
                >
                  Review Details &rarr;
                </a>
              )}
            </div>
          )}

          {/* Rich output rendering */}
          {displayStep.toolResult && (
            <DetailOutputRenderer toolResult={displayStep.toolResult} />
          )}

          {/* Send Reply affordance for inbound DM mission steps */}
          {displayStep.status === 'COMPLETED' && missionId && displayStep.toolResult && (() => {
            try {
              const parsed = JSON.parse(displayStep.toolResult) as Record<string, unknown>;
              if (parsed.mode !== 'INBOUND_DM_REPLY') { return null; }
              const composed = parsed.composedReply as Record<string, unknown> | undefined;
              const replyText = typeof composed?.replyText === 'string' ? composed.replyText : '';
              if (!replyText) { return null; }
              const senderHandle = typeof parsed.senderHandle === 'string' ? parsed.senderHandle : undefined;
              return (
                <div style={{ marginTop: '0.75rem' }}>
                  <SendDmReplyButton
                    missionId={missionId}
                    composedReply={replyText}
                    senderHandle={senderHandle}
                  />
                </div>
              );
            } catch {
              return null;
            }
          })()}

          {/* M6 — quick manual edit path */}
          {(displayStep.status === 'COMPLETED' || displayStep.status === 'FAILED') && missionId && (
            <ManualEditOutputBox
              missionId={missionId}
              stepId={displayStep.stepId}
              currentResult={displayStep.toolResult ?? ''}
              isManuallyEdited={displayStep.manuallyEdited === true}
            />
          )}

          {/* Step grade widget — shown for completed steps */}
          {displayStep.status === 'COMPLETED' && missionId && (
            <div style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--color-border-light)',
            }}>
              <div style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-disabled)',
                marginBottom: '0.375rem',
              }}>
                Rate this step
              </div>
              <StepGradeWidget
                missionId={missionId}
                stepId={displayStep.stepId}
                specialistsUsed={displayStep.specialistsUsed}
                existingGrade={stepGrades[displayStep.stepId]}
              />

              {/* M2d — version history + rollback entry points (one per specialist used) */}
              {displayStep.specialistsUsed && displayStep.specialistsUsed.length > 0 && (
                <div style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}>
                  <div style={{
                    fontSize: '0.625rem',
                    color: 'var(--color-text-disabled)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    Specialists used
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {displayStep.specialistsUsed.map((sid) => (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => setHistoryForSpecialist(historyForSpecialist === sid ? null : sid)}
                        style={{
                          fontSize: '0.6875rem',
                          padding: '0.1875rem 0.5rem',
                          color: historyForSpecialist === sid
                            ? 'var(--color-primary)'
                            : 'var(--color-text-secondary)',
                          background: 'var(--color-surface)',
                          border: `1px solid ${historyForSpecialist === sid ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                        }}
                      >
                        {sid} — history
                      </button>
                    ))}
                  </div>
                  {historyForSpecialist && (
                    <SpecialistVersionHistory
                      specialistId={historyForSpecialist}
                      onClose={() => setHistoryForSpecialist(null)}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Collapsible input */}
          {displayStep.toolArgs && Object.keys(displayStep.toolArgs).length > 0 && (
            <CollapsibleSection title="Input (Tool Args)">
              {JSON.stringify(displayStep.toolArgs, null, 2)}
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
    case 'PROPOSED': return 'var(--color-text-secondary)';
    case 'RUNNING': return 'var(--color-primary)';
    case 'COMPLETED': return 'var(--color-success)';
    case 'FAILED': return 'var(--color-error)';
    default: return 'var(--color-text-disabled)';
  }
}

function getStepStatusLabel(status: MissionStep['status']): string {
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
// PAGE
// ============================================================================

function MissionControlView({ deepLinkedMission }: { deepLinkedMission: string | null }) {
  const authFetch = useAuthFetch();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(deepLinkedMission);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Grade state: keyed by stepId for per-step grades; undefined key holds overall mission grade
  const [missionGrades, setMissionGrades] = useState<Record<string, GradeEntry>>({});

  // SSE stream for the selected mission
  const { mission: streamedMission, isStreaming } = useMissionStream(selectedMissionId);

  // Determine if any missions are active (for sidebar polling rate)
  const hasActiveMissions = missions.some(
    (m) => m.status === 'IN_PROGRESS' || m.status === 'AWAITING_APPROVAL' || m.status === 'PENDING'
  );

  // The displayed mission: prefer streamed data, fall back to list data
  // For plan-review missions, prefer the fetched data over the SSE
  // stream. The stream creates a skeleton with empty steps — but plan
  // steps are written all at once in createMissionWithPlan, so the
  // stream never receives step_added events for them. The list fetch
  // returns the full mission including all plan steps.
  const fetchedMission = missions.find((m) => m.missionId === selectedMissionId) ?? null;
  const selectedMission = fetchedMission?.status === 'PLAN_PENDING_APPROVAL'
    ? fetchedMission
    : (streamedMission ?? fetchedMission);

  // Selected step from the mission
  const selectedStep = selectedMission?.steps.find((s) => s.stepId === selectedStepId) ?? null;

  // ── Fetch mission list (sidebar) ────────────────────────────────────
  const fetchMissions = useCallback(async () => {
    try {
      const res = await authFetch('/api/orchestrator/missions?limit=30');
      if (!res.ok) { return; }
      const data = (await res.json()) as MissionListResponse;
      if (data.success && data.data) {
        // Live tab: show active missions + recently completed (last 10 minutes)
        // Always include deep-linked mission so review links work
        const tenMinAgo = Date.now() - 10 * 60 * 1000;
        const liveMissions = data.data.missions.filter((m) => {
          const isActive = m.status === 'IN_PROGRESS' || m.status === 'AWAITING_APPROVAL' || m.status === 'PENDING' || m.status === 'PLAN_PENDING_APPROVAL';
          const isRecentlyCompleted = (m.status === 'COMPLETED' || m.status === 'FAILED') &&
            m.completedAt && new Date(m.completedAt).getTime() > tenMinAgo;
          const isDeepLinked = deepLinkedMission != null && m.missionId === deepLinkedMission;
          return Boolean(isActive) || Boolean(isRecentlyCompleted) || isDeepLinked;
        });
        setMissions(liveMissions);
      }
    } catch {
      // Silent fail on polling
    }
  }, [authFetch, deepLinkedMission]);

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

  // ── Fetch grades when a terminal mission is selected ─────────────────
  const selectedMissionIdForGrades = selectedMission?.missionId;
  const selectedMissionStatus = selectedMission?.status;

  useEffect(() => {
    if (
      !selectedMissionIdForGrades ||
      (selectedMissionStatus !== 'COMPLETED' && selectedMissionStatus !== 'FAILED')
    ) {
      setMissionGrades({});
      return;
    }

    void (async () => {
      try {
        const res = await authFetch(`/api/orchestrator/missions/${selectedMissionIdForGrades}/grade`);
        if (!res.ok) { return; }
        const body = (await res.json()) as GradeApiResponse;
        if (!body.success || !body.data) { return; }

        const gradeMap: Record<string, GradeEntry> = {};
        for (const g of body.data.grades) {
          // Overall mission grade stored under the sentinel key 'overall'
          const key = g.stepId ?? 'overall';
          // Keep the most recent grade per key (API returns newest-first)
          if (!(key in gradeMap)) {
            gradeMap[key] = { score: g.score, explanation: g.explanation };
          }
        }
        setMissionGrades(gradeMap);
      } catch {
        // Silent fail — grades are non-critical UI
      }
    })();
  }, [selectedMissionIdForGrades, selectedMissionStatus, authFetch]);

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
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

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

  // ── Delete mission handler ──────────────────────────────────────────
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteRequest = useCallback(() => {
    if (!selectedMissionId || deleting) { return; }
    setShowDeleteConfirm(true);
  }, [selectedMissionId, deleting]);

  const handleDeleteConfirm = useCallback(async () => {
    setShowDeleteConfirm(false);
    if (!selectedMissionId || deleting) { return; }

    setDeleting(true);
    setActionError(null);
    try {
      const res = await authFetch(`/api/orchestrator/missions/${selectedMissionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSelectedMissionId(null);
        setSelectedStepId(null);
        void fetchMissions();
      } else {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
        setActionError(`Delete failed: ${body.error ?? res.statusText}`);
      }
    } catch (err: unknown) {
      setActionError(`Delete failed: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setDeleting(false);
    }
  }, [selectedMissionId, deleting, authFetch, fetchMissions]);

  // ── Clear all completed/failed missions ──────────────────────────────
  const handleClearAll = useCallback(async () => {
    if (clearingAll) { return; }

    setClearingAll(true);
    setActionError(null);
    try {
      const res = await authFetch('/api/orchestrator/missions', {
        method: 'DELETE',
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: { deleted?: number } };
        const count = body.data?.deleted ?? 0;
        setShowDeleteConfirm(false);
        if (count > 0) {
          setSelectedMissionId(null);
          setSelectedStepId(null);
        }
        void fetchMissions();
      } else {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
        setActionError(`Clear failed: ${body.error ?? res.statusText}`);
      }
    } catch (err: unknown) {
      setActionError(`Clear failed: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setClearingAll(false);
    }
  }, [clearingAll, authFetch, fetchMissions]);

  // ── Find approval step if any ──────────────────────────────────────
  // Note: post-M3.6, individual steps no longer use AWAITING_APPROVAL.
  // Mission-level AWAITING_APPROVAL means the mission halted at a
  // failed step; the failed step itself is in FAILED status. We surface
  // the FAILED step as the "needs your attention" focal point so the
  // operator can rerun it from the step detail panel.
  const approvalStep = selectedMission?.status === 'AWAITING_APPROVAL'
    ? selectedMission.steps.find((s) => s.status === 'FAILED') ?? null
    : null;

  // Is mission active (cancellable)?
  const isMissionActive = selectedMission?.status === 'IN_PROGRESS'
    || selectedMission?.status === 'AWAITING_APPROVAL'
    || selectedMission?.status === 'PENDING';

  // Is mission terminal (deletable)?
  const isMissionTerminal = selectedMission?.status === 'COMPLETED'
    || selectedMission?.status === 'FAILED';

  return (
    <div className="p-5">
      {/* Header with title + streaming indicator */}
      <div className="flex items-center gap-3 mb-3.5">
        <PageTitle className="text-2xl">Mission Control</PageTitle>
        {isStreaming && <LiveBadge />}
      </div>

      {/* Error banner */}
      {actionError && (
        <div style={{
          padding: '0.5rem 1rem',
          marginBottom: '0.5rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8125rem',
          color: '#ef4444',
        }}>
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '0 0.25rem',
            }}
          >
            &times;
          </button>
        </div>
      )}

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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-disabled)',
            }}>
              Missions ({missions.length})
            </span>
            {missions.some((m) => m.status === 'COMPLETED' || m.status === 'FAILED') && (
              <button
                type="button"
                onClick={() => void handleClearAll()}
                disabled={clearingAll}
                style={{
                  padding: '0.125rem 0.5rem',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: clearingAll ? '#9ca3af' : '#ef4444',
                  backgroundColor: 'transparent',
                  border: '1px solid',
                  borderColor: clearingAll ? '#d1d5db' : '#fca5a5',
                  borderRadius: '0.375rem',
                  cursor: clearingAll ? 'not-allowed' : 'pointer',
                }}
              >
                {clearingAll ? 'Clearing...' : 'Clear All'}
              </button>
            )}
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

          {/* Delete bar when mission is terminal (completed/failed) */}
          {selectedMission && isMissionTerminal && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '0.375rem 1rem',
              borderBottom: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-bg-elevated)',
              flexShrink: 0,
            }}>
              {showDeleteConfirm ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Permanently delete this mission?
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteConfirm()}
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
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
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
                  onClick={handleDeleteRequest}
                  disabled={deleting}
                  style={{
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: deleting ? '#9ca3af' : '#dc2626',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {deleting ? 'Deleting...' : 'Delete Mission'}
                </button>
              )}
            </div>
          )}

          {/* Plan content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {selectedMission ? (
              <div>
                {selectedMission.status === 'PLAN_PENDING_APPROVAL' ? (
                  <PlanReviewPanel
                    mission={selectedMission}
                    onPlanChanged={() => { void fetchMissions(); }}
                  />
                ) : (
                  <MissionTimeline
                    mission={selectedMission}
                    onStepSelect={handleStepSelect}
                    selectedStepId={selectedStepId}
                  />
                )}
                {(selectedMission.status === 'COMPLETED' || selectedMission.status === 'FAILED') && (
                  <div style={{ padding: '0 1rem 1rem' }}>
                    <MissionGradeCard
                      missionId={selectedMission.missionId}
                      existingGrade={missionGrades['overall']}
                    />
                  </div>
                )}
                {selectedMission.status === 'COMPLETED' && (
                  <div style={{ padding: '0 1rem 1rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowScheduleDialog(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.375rem',
                        padding: '0.5rem 1rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        font: 'inherit',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1d4ed8'; }}
                      onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb'; }}
                    >
                      &#128197; Schedule this mission
                    </button>
                  </div>
                )}
                {showScheduleDialog && selectedMission && (
                  <ScheduleMissionDialog
                    missionId={selectedMission.missionId}
                    missionTitle={selectedMission.title}
                    missionPrompt={selectedMission.userPrompt}
                    onClose={() => setShowScheduleDialog(false)}
                    onScheduled={() => setShowScheduleDialog(false)}
                  />
                )}
              </div>
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
              missionId={selectedMission.missionId}
              stepGrades={missionGrades}
              onScrapMission={handleCancelRequest}
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
