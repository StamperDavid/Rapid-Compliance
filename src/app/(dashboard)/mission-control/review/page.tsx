'use client';

/**
 * Mission Step Review — Full-page view of an orchestration step's output.
 *
 * Route: /mission-control/review?mission=xxx&step=yyy
 *
 * Renders type-specific content:
 * - Research: findings document, key insights, topic
 * - Strategy: narrative angle, key messages, audience, tone, CTA
 * - Cinematic: per-scene cinematography settings
 * - Thumbnails: gallery grid of generated previews
 * - Draft: storyboard summary with link to Video Studio
 * - Unknown: formatted JSON fallback
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { Mission } from '@/lib/orchestrator/mission-persistence';
import { formatToolName } from '../_components/dashboard-links';
import AgentAvatar from '../_components/AgentAvatar';

// ============================================================================
// TYPES
// ============================================================================

interface ParsedOutput {
  type: string;
  [key: string]: unknown;
}

// ============================================================================
// OUTPUT RENDERERS
// ============================================================================

function ResearchReview({ data }: { data: ParsedOutput }) {
  const topic = data.topic as string | undefined;
  const findings = data.findings as string | undefined;
  const insights = data.keyInsights as string[] | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {topic && (
        <section>
          <h3 style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-disabled)',
            marginBottom: '0.5rem',
          }}>
            Research Topic
          </h3>
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '0.625rem',
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}>
            {topic}
          </div>
        </section>
      )}

      {insights && insights.length > 0 && (
        <section>
          <h3 style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-disabled)',
            marginBottom: '0.5rem',
          }}>
            Key Insights ({insights.length})
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}>
            {insights.map((insight, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
                padding: '0.875rem 1rem',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border-light)',
              }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(124,58,237,0.15)',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.6,
                }}>
                  {insight}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {findings && (
        <section>
          <h3 style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-disabled)',
            marginBottom: '0.5rem',
          }}>
            Full Research Findings
          </h3>
          <div style={{
            padding: '1.25rem',
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '0.625rem',
            fontSize: '0.875rem',
            color: 'var(--color-text-primary)',
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
          }}>
            {findings}
          </div>
        </section>
      )}
    </div>
  );
}

function StrategyReview({ data }: { data: ParsedOutput }) {
  const angle = data.narrativeAngle as string | undefined;
  const audience = data.targetAudience as string | undefined;
  const messages = data.keyMessages as string[] | undefined;
  const tone = data.tone as string | undefined;
  const cta = data.callToAction as string | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {angle && (
        <section>
          <h3 style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-disabled)',
            marginBottom: '0.5rem',
          }}>
            Narrative Angle
          </h3>
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(14,165,233,0.08)',
            borderRadius: '0.625rem',
            border: '1px solid rgba(14,165,233,0.2)',
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}>
            {angle}
          </div>
        </section>
      )}

      {audience && (
        <section>
          <h3 style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-disabled)',
            marginBottom: '0.5rem',
          }}>
            Target Audience
          </h3>
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '0.625rem',
            fontSize: '0.875rem',
            color: 'var(--color-text-primary)',
            lineHeight: 1.6,
          }}>
            {audience}
          </div>
        </section>
      )}

      {messages && messages.length > 0 && (
        <section>
          <h3 style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-disabled)',
            marginBottom: '0.5rem',
          }}>
            Key Messages ({messages.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(14,165,233,0.06)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(14,165,233,0.12)',
                fontSize: '0.875rem',
                color: 'var(--color-text-primary)',
                lineHeight: 1.5,
                display: 'flex',
                gap: '0.625rem',
                alignItems: 'center',
              }}>
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: '#0ea5e9',
                  flexShrink: 0,
                }}>
                  {i + 1}.
                </span>
                {msg}
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {tone && (
          <section>
            <h3 style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-disabled)',
              marginBottom: '0.5rem',
            }}>
              Tone
            </h3>
            <div style={{
              padding: '0.875rem 1rem',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              color: 'var(--color-text-primary)',
              textTransform: 'capitalize',
            }}>
              {tone}
            </div>
          </section>
        )}

        {cta && (
          <section>
            <h3 style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-disabled)',
              marginBottom: '0.5rem',
            }}>
              Call to Action
            </h3>
            <div style={{
              padding: '0.875rem 1rem',
              backgroundColor: 'rgba(99,102,241,0.08)',
              borderRadius: '0.5rem',
              border: '1px solid rgba(99,102,241,0.2)',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-primary)',
            }}>
              {cta}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CinematicReview({ data }: { data: ParsedOutput }) {
  const globalStyle = data.globalStyle as string | undefined;
  const configs = data.configs as Array<Record<string, unknown>> | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {globalStyle && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(225,29,72,0.08)',
          borderRadius: '0.625rem',
          border: '1px solid rgba(225,29,72,0.2)',
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}>
          Overall Style: {globalStyle}
        </div>
      )}

      {configs?.map((cfg, i) => (
        <div key={i} style={{
          padding: '1rem',
          backgroundColor: 'var(--color-bg-elevated)',
          borderRadius: '0.625rem',
          border: '1px solid var(--color-border-light)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9375rem' }}>
            Scene {cfg.sceneNumber as number}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem 1rem', fontSize: '0.8125rem' }}>
            {typeof cfg.shotType === 'string' && (
              <div>
                <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.6875rem', display: 'block' }}>Shot Type</span>
                <span style={{ textTransform: 'capitalize' }}>{cfg.shotType}</span>
              </div>
            )}
            {typeof cfg.lighting === 'string' && (
              <div>
                <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.6875rem', display: 'block' }}>Lighting</span>
                <span style={{ textTransform: 'capitalize' }}>{cfg.lighting}</span>
              </div>
            )}
            {typeof cfg.camera === 'string' && (
              <div>
                <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.6875rem', display: 'block' }}>Camera</span>
                <span>{cfg.camera}</span>
              </div>
            )}
            {typeof cfg.artStyle === 'string' && (
              <div>
                <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.6875rem', display: 'block' }}>Art Style</span>
                <span style={{ textTransform: 'capitalize' }}>{cfg.artStyle}</span>
              </div>
            )}
            {typeof cfg.filmStock === 'string' && (
              <div>
                <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.6875rem', display: 'block' }}>Film Stock</span>
                <span>{cfg.filmStock}</span>
              </div>
            )}
            {typeof cfg.focalLength === 'string' && (
              <div>
                <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.6875rem', display: 'block' }}>Focal Length</span>
                <span>{cfg.focalLength}</span>
              </div>
            )}
            {typeof cfg.composition === 'string' && (
              <div>
                <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.6875rem', display: 'block' }}>Composition</span>
                <span style={{ textTransform: 'capitalize' }}>{cfg.composition}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ThumbnailsReview({ data }: { data: ParsedOutput }) {
  const thumbnails = data.thumbnails as Array<{ sceneNumber: number; url: string }> | undefined;
  const generated = data.generated as number | undefined;

  return (
    <div>
      <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
        {generated ?? 0} thumbnail{generated !== 1 ? 's' : ''} generated
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '1rem',
      }}>
        {thumbnails?.map((thumb, i) => (
          <div key={i} style={{
            borderRadius: '0.625rem',
            overflow: 'hidden',
            border: '1px solid var(--color-border-light)',
          }}>
            <Image
              src={thumb.url}
              alt={`Scene ${thumb.sceneNumber}`}
              width={440}
              height={248}
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
              padding: '0.5rem 0.75rem',
              fontSize: '0.75rem',
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

function DraftReview({ data }: { data: ParsedOutput }) {
  const title = data.title as string | undefined;
  const sceneCount = data.sceneCount as number | undefined;
  const videoStudioPath = data.videoStudioPath as string | undefined;
  const thumbnailCount = data.thumbnailCount as number | undefined;

  return (
    <div style={{
      padding: '1.5rem',
      backgroundColor: 'var(--color-bg-elevated)',
      borderRadius: '0.625rem',
      border: '1px solid var(--color-border-light)',
    }}>
      {title && <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem' }}>{title}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {sceneCount !== undefined && (
          <span style={{
            fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem',
            borderRadius: '9999px', color: '#059669', backgroundColor: 'rgba(5,150,105,0.1)',
          }}>
            {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
          </span>
        )}
        {thumbnailCount !== undefined && thumbnailCount > 0 && (
          <span style={{
            fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.75rem',
            borderRadius: '9999px', color: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.1)',
          }}>
            {thumbnailCount} thumbnail{thumbnailCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {videoStudioPath && (
        <a
          href={videoStudioPath}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.75rem 1.25rem', borderRadius: '0.5rem',
            backgroundColor: 'var(--color-primary)', color: '#fff',
            fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
          }}
        >
          Open Storyboard &rarr;
        </a>
      )}
    </div>
  );
}

function FallbackReview({ raw }: { raw: string }) {
  return (
    <div style={{
      padding: '1.25rem',
      backgroundColor: 'var(--color-bg-elevated)',
      borderRadius: '0.625rem',
      fontFamily: 'monospace',
      fontSize: '0.8125rem',
      color: 'var(--color-text-primary)',
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      maxHeight: '600px',
      overflowY: 'auto',
    }}>
      {raw}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

function StepReviewContent({ missionId, stepId }: { missionId: string; stepId: string }) {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMission = useCallback(async () => {
    try {
      const res = await authFetch(`/api/orchestrator/missions/${missionId}`);
      if (!res.ok) {
        setError('Mission not found');
        return;
      }
      const data = await res.json() as { success: boolean; data?: Mission };
      if (data.success && data.data) {
        setMission(data.data);
      } else {
        setError('Failed to load mission');
      }
    } catch {
      setError('Failed to fetch mission');
    } finally {
      setLoading(false);
    }
  }, [authFetch, missionId]);

  useEffect(() => {
    void fetchMission();
  }, [fetchMission]);

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-disabled)' }}>
        Loading step details...
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-error)' }}>
        {error ?? 'Mission not found'}
      </div>
    );
  }

  const step = mission.steps.find((s) => s.stepId === stepId);
  if (!step) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-error)' }}>
        Step not found in this mission
      </div>
    );
  }

  // Parse the output
  let parsed: ParsedOutput | null = null;
  if (step.toolResult) {
    try {
      parsed = JSON.parse(step.toolResult) as ParsedOutput;
    } catch {
      // Not JSON
    }
  }

  const outputType = parsed?.type as string
    ?? (parsed?.status === 'draft' ? 'draft' : null)
    ?? 'unknown';

  const statusColor = step.status === 'COMPLETED' ? 'var(--color-success)'
    : step.status === 'FAILED' ? 'var(--color-error)'
    : step.status === 'RUNNING' ? 'var(--color-primary)'
    : 'var(--color-text-disabled)';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>
      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push(`/mission-control?mission=${missionId}`)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.8125rem', color: 'var(--color-primary)',
          padding: 0, marginBottom: '1.25rem', display: 'flex',
          alignItems: 'center', gap: '0.375rem', font: 'inherit',
        }}
      >
        &larr; Back to Mission Control
      </button>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        marginBottom: '0.5rem',
      }}>
        <AgentAvatar delegatedTo={step.delegatedTo} size={36} />
        <div>
          <h1 style={{
            fontSize: '1.25rem', fontWeight: 700,
            color: 'var(--color-text-primary)', margin: 0,
          }}>
            {formatToolName(step.toolName)}
          </h1>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            {step.delegatedTo.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </div>
        </div>
      </div>

      {/* Status + duration */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        marginBottom: '1.5rem', fontSize: '0.8125rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor }} />
          <span style={{ fontWeight: 600, color: statusColor }}>
            {step.status === 'COMPLETED' ? 'Complete' : step.status === 'FAILED' ? 'Failed' : step.status}
          </span>
        </div>
        {step.durationMs !== undefined && (
          <span style={{ color: 'var(--color-text-disabled)' }}>
            {(step.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Summary */}
      {step.summary && (
        <div style={{
          padding: '0.875rem 1rem',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.5rem',
          border: '1px solid var(--color-border-light)',
          fontSize: '0.875rem',
          color: 'var(--color-text-secondary)',
          marginBottom: '1.5rem',
          lineHeight: 1.6,
        }}>
          {step.summary}
        </div>
      )}

      {/* Error */}
      {step.error && (
        <div style={{
          padding: '0.875rem 1rem',
          backgroundColor: 'rgba(244,67,54,0.08)',
          border: '1px solid rgba(244,67,54,0.2)',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          color: 'var(--color-error)',
          marginBottom: '1.5rem',
        }}>
          {step.error}
        </div>
      )}

      {/* Content */}
      {parsed ? (
        <>
          {outputType === 'research' && <ResearchReview data={parsed} />}
          {outputType === 'strategy' && <StrategyReview data={parsed} />}
          {outputType === 'cinematic' && <CinematicReview data={parsed} />}
          {outputType === 'thumbnails' && <ThumbnailsReview data={parsed} />}
          {outputType === 'draft' && <DraftReview data={parsed} />}
          {outputType === 'unknown' && <FallbackReview raw={step.toolResult ?? ''} />}
        </>
      ) : step.toolResult ? (
        <FallbackReview raw={step.toolResult} />
      ) : (
        <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
          No output data available for this step.
        </div>
      )}

      {/* Mission context */}
      <div style={{
        marginTop: '2rem', paddingTop: '1rem',
        borderTop: '1px solid var(--color-border-light)',
        fontSize: '0.75rem', color: 'var(--color-text-disabled)',
      }}>
        Mission: {mission.title} &middot; {mission.steps.length} steps total
      </div>
    </div>
  );
}

export default function StepReviewPage() {
  const searchParams = useSearchParams();
  const missionId = searchParams.get('mission');
  const stepId = searchParams.get('step');

  if (!missionId || !stepId) {
    return (
      <div style={{
        padding: '3rem', textAlign: 'center',
        color: 'var(--color-text-disabled)', fontSize: '0.875rem',
      }}>
        Missing mission or step ID. Go back to{' '}
        <a href="/mission-control" style={{ color: 'var(--color-primary)' }}>Mission Control</a>.
      </div>
    );
  }

  return <StepReviewContent missionId={missionId} stepId={stepId} />;
}
