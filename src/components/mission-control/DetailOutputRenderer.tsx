'use client';

/**
 * DetailOutputRenderer — type-dispatch rich output display for mission steps.
 *
 * Extracted from mission-control/page.tsx (lines 590-961) so it can be
 * imported by both Mission Control and the embeddable <InlineReviewCard>.
 *
 * Pure presentational — the only hook is useState (for collapsible sections
 * and raw-view toggles). No network calls.
 */

import Image from 'next/image';
import { useState } from 'react';

// ─── Collapsible section ──────────────────────────────────────────────────────

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

// ─── IntelligenceBriefRenderer ────────────────────────────────────────────────

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
  const _execution = data.execution as Record<string, unknown> | null;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header with raw toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={sectionLabel}>Intelligence Brief</div>
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

      {/* Query */}
      {request?.query != null && (
        <div style={{ ...contentBox, padding: '0.5rem 0.75rem', fontWeight: 500 }}>
          {String(request.query)}
        </div>
      )}

      {/* Synthesis */}
      {synthesis != null && (
        <div style={cardStyle}>
          {synthesis.executiveSummary != null && (
            <div style={{ marginBottom: '0.5rem', fontSize: '0.8125rem', lineHeight: 1.6 }}>
              {String(synthesis.executiveSummary)}
            </div>
          )}
          {synthesis.keyOpportunities != null && Array.isArray(synthesis.keyOpportunities) && (
            <div>
              <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Opportunities
              </div>
              {(synthesis.keyOpportunities as string[]).map((o, i) => (
                <div key={i} style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)', marginBottom: '0.125rem' }}>• {o}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trend signals */}
      {trendSignals && trendSignals.length > 0 && (
        <div>
          <div style={sectionLabel}>Trend Signals ({trendSignals.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {trendSignals.slice(0, 5).map((sig, i) => {
              const u = String(sig.urgency ?? 'LOW');
              const uc = urgencyColor(u);
              return (
                <div key={i} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {String(sig.title ?? '')}
                    </div>
                    <span style={pillStyle(uc.color, uc.bg)}>{u}</span>
                  </div>
                  {sig.description != null && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>
                      {String(sig.description)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Competitors */}
      {competitors && competitors.length > 0 && (
        <div>
          <div style={sectionLabel}>Competitor Landscape ({competitors.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {competitors.slice(0, 4).map((comp, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {String(comp.name ?? '')}
                </div>
                {comp.positioning != null && (
                  <div style={{ marginTop: '0.125rem', fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>
                    {String(comp.positioning)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market insights */}
      {marketInsights?.summary != null && (
        <div style={{ ...contentBox, fontSize: '0.75rem' }}>
          {String(marketInsights.summary)}
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
      {(data.requestedAt != null || data.completedAt != null) && (
        <div style={{
          fontSize: '0.625rem', color: 'var(--color-text-disabled)',
          display: 'flex', gap: '1rem',
        }}>
          {data.requestedAt != null ? <span>Requested: {new Date(String(data.requestedAt)).toLocaleString()}</span> : null}
          {data.completedAt != null ? <span>Completed: {new Date(String(data.completedAt)).toLocaleString()}</span> : null}
        </div>
      )}
    </div>
  );
}

// ─── ContentPackageBriefRenderer ─────────────────────────────────────────────

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

      {/* Non-blog content fallbacks */}
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

// ─── Main export ──────────────────────────────────────────────────────────────

export function DetailOutputRenderer({ toolResult }: { toolResult: string }) {
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
    ?? (parsed.briefId && (parsed.synthesis ?? parsed.competitorAnalysis) ? 'intelligence-brief' : null)
    ?? (parsed.detectedIntent && (parsed.blogContent ?? parsed.videoContent ?? parsed.musicContent ?? parsed.podcastContent ?? parsed.specialistOutputs) ? 'content-package' : null);

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

export default DetailOutputRenderer;
