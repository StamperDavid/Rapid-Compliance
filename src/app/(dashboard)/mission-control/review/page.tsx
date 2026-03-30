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
import Link from 'next/link';
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
  const methodology = data.methodology as string | undefined;
  const areasResearched = data.areasResearched as Array<{ area: string; findings: string }> | undefined;
  const findings = data.findings as string | undefined;
  const insights = data.keyInsights as string[] | undefined;
  const competitorAngles = data.competitorAngles as Array<{ competitor: string; angle: string } | string> | undefined;
  const contentGaps = data.contentGaps as string[] | undefined;
  const sources = data.sources as string[] | undefined;

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-disabled)',
    marginBottom: '0.5rem',
  };

  const cardStyle = {
    padding: '1rem',
    backgroundColor: 'var(--color-bg-elevated)',
    borderRadius: '0.625rem',
    fontSize: '0.875rem',
    color: 'var(--color-text-primary)',
    lineHeight: 1.7,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {methodology && (
        <section>
          <h3 style={sectionHeaderStyle}>Research Methodology</h3>
          <div style={{ ...cardStyle, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
            {methodology}
          </div>
        </section>
      )}

      {areasResearched && areasResearched.length > 0 && (
        <section>
          <h3 style={sectionHeaderStyle}>Areas Researched ({areasResearched.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {areasResearched.map((area, i) => (
              <div key={i} style={{ ...cardStyle, border: '1px solid var(--color-border-light)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.5rem', color: 'var(--color-secondary)' }}>
                  {area.area}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{area.findings}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {insights && insights.length > 0 && (
        <section>
          <h3 style={sectionHeaderStyle}>Key Insights ({insights.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {insights.map((insight, i) => (
              <div key={i} style={{
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                padding: '0.875rem 1rem', backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: '0.5rem', border: '1px solid var(--color-border-light)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  backgroundColor: 'rgba(124,58,237,0.15)', color: '#7c3aed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
                  {insight}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {competitorAngles && competitorAngles.length > 0 && (
        <section>
          <h3 style={sectionHeaderStyle}>Competitor Landscape ({competitorAngles.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {competitorAngles.map((c, i) => (
              <div key={i} style={{ ...cardStyle, border: '1px solid var(--color-border-light)' }}>
                {typeof c === 'string' ? c : (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{c.competitor}</div>
                    <div style={{ color: 'var(--color-text-secondary)' }}>{c.angle}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {contentGaps && contentGaps.length > 0 && (
        <section>
          <h3 style={sectionHeaderStyle}>Content Gaps &amp; Opportunities</h3>
          <ul style={{ ...cardStyle, margin: 0, paddingLeft: '1.25rem' }}>
            {contentGaps.map((gap, i) => (
              <li key={i} style={{ marginBottom: '0.375rem' }}>{gap}</li>
            ))}
          </ul>
        </section>
      )}

      {findings && (
        <section>
          <h3 style={sectionHeaderStyle}>Target Audience</h3>
          <div style={{ ...cardStyle, whiteSpace: 'pre-wrap' }}>{findings}</div>
        </section>
      )}

      {sources && sources.length > 0 && (
        <section>
          <h3 style={sectionHeaderStyle}>Sources &amp; Data</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {sources.map((src, i) => (
              <span key={i} style={{
                display: 'inline-block', fontSize: '0.75rem', fontWeight: 500,
                padding: '0.25rem 0.625rem', borderRadius: '9999px',
                backgroundColor: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-light)',
                color: 'var(--color-text-secondary)',
              }}>
                {src}
              </span>
            ))}
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

// ============================================================================
// SMART TYPE DETECTION
// ============================================================================

function detectOutputType(data: ParsedOutput, toolName?: string): string {
  // Explicit type field
  if (typeof data.type === 'string' && data.type !== '') { return data.type; }

  // Blog draft — has draftId + slug + title
  if ('draftId' in data && 'slug' in data) { return 'blog_draft'; }

  // Intelligence brief — has competitorAnalysis or synthesis
  if ('competitorAnalysis' in data || 'synthesis' in data || 'briefId' in data) { return 'intelligence'; }

  // Social post result — has platform + postContent or posts
  if ('platform' in data && ('postContent' in data || 'posts' in data)) { return 'social_post'; }

  // Campaign orchestration — has campaignId + deliverableCount
  if ('campaignId' in data && 'deliverableCount' in data) { return 'campaign_result'; }

  // Lead scan — has leads array
  if (Array.isArray(data.leads) || 'leadCount' in data) { return 'lead_scan'; }

  // Trending research — has seedTopics array
  if (Array.isArray(data.seedTopics) && data.seedTopics.length > 0 && typeof data.seedTopics[0] === 'object') { return 'trending_research'; }

  // SEO config — has seo object with keywords
  if ('seo' in data && typeof data.seo === 'object' && data.source === 'firestore') { return 'seo_config'; }

  // Generic delegation — has status + message
  if ('status' in data && 'message' in data) { return 'delegation_result'; }

  // Video draft
  if (data.status === 'draft') { return 'draft'; }

  // Tool name hints — delegation tools that return agent metadata
  if (toolName?.startsWith('delegate_to_')) { return 'delegation_result'; }
  if (toolName === 'research_trending_topics') { return 'trending_research'; }
  if (toolName === 'get_seo_config') { return 'seo_config'; }
  if (toolName?.includes('blog') || toolName?.includes('save_blog')) { return 'blog_draft'; }
  if (toolName?.includes('intelligence')) { return 'intelligence'; }
  if (toolName?.includes('social')) { return 'social_post'; }
  if (toolName?.includes('campaign')) { return 'campaign_result'; }

  return 'unknown';
}

// ============================================================================
// BLOG DRAFT RENDERER
// ============================================================================

function BlogDraftReview({ data }: { data: ParsedOutput }) {
  const title = (data.title as string) ?? (data.draftId as string) ?? 'Untitled';
  const slug = data.slug as string | undefined;
  const draftId = data.draftId as string | undefined;
  const content = data.content as string | undefined;
  const excerpt = data.excerpt as string | undefined;
  const wordCount = data.wordCount as number | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <section style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.625rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>{title}</h3>
        {slug && <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>/{slug}</div>}
        {excerpt && <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>{excerpt}</p>}
        {wordCount && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.5rem' }}>{wordCount} words</div>}
      </section>
      {content && (
        <section>
          <SectionLabel>Content Preview</SectionLabel>
          <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.625rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto' }}>
            {content}
          </div>
        </section>
      )}
      {draftId && (
        <a href={`/website/blog/editor?postId=${draftId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', backgroundColor: 'var(--color-primary)', color: '#fff', borderRadius: '0.375rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, width: 'fit-content' }}>
          Open in Editor
        </a>
      )}
    </div>
  );
}

// ============================================================================
// INTELLIGENCE REPORT RENDERER
// ============================================================================

function IntelligenceReview({ data }: { data: ParsedOutput }) {
  const synthesis = data.synthesis as Record<string, unknown> | undefined;
  const competitors = (data.competitorAnalysis as Record<string, unknown>)?.competitors as Array<Record<string, unknown>> | undefined;
  const execution = data.execution as Record<string, unknown> | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Executive Summary */}
      {typeof synthesis?.executiveSummary === 'string' && (
        <section>
          <SectionLabel>Executive Summary</SectionLabel>
          <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.625rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
            {String(synthesis.executiveSummary)}
          </div>
        </section>
      )}

      {/* Key Findings */}
      {Array.isArray(synthesis?.keyFindings) && (synthesis.keyFindings as string[]).length > 0 && (
        <section>
          <SectionLabel>Key Findings</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(synthesis.keyFindings as string[]).map((finding, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.75rem 1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{finding}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Competitors */}
      {competitors && competitors.length > 0 && (
        <section>
          <SectionLabel>Competitors ({competitors.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {competitors.map((comp, i) => (
              <div key={i} style={{ padding: '1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>#{Number(comp.rank) || (i + 1)} {String(comp.name ?? 'Unknown')}</div>
                  {typeof comp.domain === 'string' && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>{comp.domain}</span>}
                </div>
                {typeof comp.url === 'string' && <a href={comp.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none' }}>{comp.url}</a>}
                {Array.isArray(comp.strengths) && (comp.strengths as string[]).length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {(comp.strengths as string[]).map((s, j) => (
                      <span key={j} style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem', backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: '9999px' }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommended Actions */}
      {Array.isArray(synthesis?.recommendedActions) && (synthesis.recommendedActions as string[]).length > 0 && (
        <section>
          <SectionLabel>Recommended Actions</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {(synthesis.recommendedActions as string[]).map((action, i) => (
              <li key={i} style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{action}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Execution Stats */}
      {execution && (
        <section>
          <SectionLabel>Execution</SectionLabel>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {execution.totalSpecialists != null && <StatCard label="Specialists" value={String(execution.totalSpecialists)} />}
            {execution.successfulSpecialists != null && <StatCard label="Successful" value={String(execution.successfulSpecialists)} color="var(--color-success)" />}
            {execution.failedSpecialists != null && Number(execution.failedSpecialists) > 0 && <StatCard label="Failed" value={String(execution.failedSpecialists)} color="var(--color-error)" />}
            {execution.totalExecutionTimeMs != null && <StatCard label="Duration" value={`${(Number(execution.totalExecutionTimeMs) / 1000).toFixed(1)}s`} />}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================================
// DELEGATION RESULT RENDERER (generic status + message)
// ============================================================================

function DelegationResultReview({ data }: { data: ParsedOutput }) {
  const status = data.status as string | undefined;
  const message = data.message as string | undefined;
  const reviewLink = data.reviewLink as string | undefined;
  const campaignId = data.campaignId as string | undefined;

  // Build a readable summary from agent metadata when no message exists
  const summaryParts: string[] = [];
  if (!message) {
    // Delegation execution summary
    const execution = data.execution as { totalSpecialists?: number; successfulSpecialists?: number; failedSpecialists?: number } | undefined;
    if (execution) {
      summaryParts.push(`${execution.successfulSpecialists ?? 0} of ${execution.totalSpecialists ?? 0} specialists completed successfully`);
    }

    // Show delegation results
    const delegations = data.delegations as Array<{ specialist?: string; brief?: string; status?: string }> | undefined;
    if (Array.isArray(delegations) && delegations.length > 0) {
      summaryParts.push('');
      summaryParts.push('Agent Activity:');
      for (const d of delegations) {
        const name = (d.specialist ?? 'Unknown').replace(/_/g, ' ');
        const icon = d.status === 'COMPLETED' ? '✓' : '✗';
        summaryParts.push(`  ${icon} ${name} — ${d.status ?? 'unknown'}`);
        if (d.brief) { summaryParts.push(`    ${d.brief}`); }
      }
    }

    // Detected intent
    if (typeof data.detectedIntent === 'string') {
      summaryParts.push('');
      summaryParts.push(`Intent: ${data.detectedIntent.replace(/_/g, ' ')}`);
    }

    // Validation
    const validation = data.validation as { passed?: boolean; seoScore?: number; toneConsistency?: number } | undefined;
    if (validation) {
      summaryParts.push('');
      summaryParts.push(`Validation: ${validation.passed ? 'Passed' : 'Failed'} · SEO: ${validation.seoScore ?? '-'}% · Tone: ${validation.toneConsistency ?? '-'}%`);
    }

    // Confidence
    if (typeof data.confidence === 'number') {
      summaryParts.push(`Confidence: ${Math.round(data.confidence * 100)}%`);
    }
  }

  const displayMessage = message ?? (summaryParts.length > 0 ? summaryParts.join('\n') : 'Delegation completed successfully.');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
            backgroundColor: status === 'success' ? 'rgba(34,197,94,0.15)' : status === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
            color: status === 'success' ? '#22c55e' : status === 'error' ? '#ef4444' : '#6366f1',
          }}>
            {status}
          </span>
        </div>
      )}
      <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.625rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {displayMessage}
      </div>
      {reviewLink && (
        <Link href={reviewLink} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', backgroundColor: 'var(--color-primary)', color: '#fff', borderRadius: '0.375rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, width: 'fit-content' }}>
          Review Output
        </Link>
      )}
      {campaignId && !reviewLink && (
        <Link href={`/mission-control?campaign=${campaignId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', backgroundColor: 'var(--color-primary)', color: '#fff', borderRadius: '0.375rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, width: 'fit-content' }}>
          View Campaign
        </Link>
      )}
    </div>
  );
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

// ============================================================================
// TRENDING RESEARCH RENDERER
// ============================================================================

function TrendingResearchReview({ data }: { data: ParsedOutput }) {
  const seedTopics = data.seedTopics as Array<{
    keyword: string;
    relatedQueries: string[];
    searchVolume?: number;
    competition?: string;
    topResults: Array<{ title: string; link: string; snippet: string }>;
  }> | undefined;
  const relatedTrending = data.relatedTrending as string[] | undefined;
  const totalFound = data.totalResultsFound as number | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {totalFound != null && (
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          {seedTopics?.length ?? 0} seed topics researched, {relatedTrending?.length ?? 0} related trends discovered
        </div>
      )}

      {seedTopics?.map((topic, i) => (
        <div key={i} style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.625rem', border: '1px solid var(--color-border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{topic.keyword}</h4>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
              {topic.searchVolume != null && <span style={{ color: 'var(--color-info)' }}>Vol: {topic.searchVolume.toLocaleString()}</span>}
              {topic.competition && <span style={{ color: topic.competition === 'HIGH' ? 'var(--color-error)' : topic.competition === 'MEDIUM' ? 'var(--color-warning)' : 'var(--color-success)' }}>Competition: {topic.competition}</span>}
            </div>
          </div>

          {topic.topResults.length > 0 && (
            <>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>Top Results</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {topic.topResults.map((result, j) => (
                  <div key={j} style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.375rem' }}>
                    <a href={result.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>{result.title}</a>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.25rem' }}>{result.link}</div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0', lineHeight: 1.5 }}>{result.snippet}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {topic.relatedQueries.length > 0 && (
            <>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-disabled)', marginBottom: '0.375rem' }}>Related Queries</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {topic.relatedQueries.map((q, k) => (
                  <span key={k} style={{ padding: '0.25rem 0.625rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '9999px', fontSize: '0.75rem', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>{q}</span>
                ))}
              </div>
            </>
          )}
        </div>
      ))}

      {relatedTrending && relatedTrending.length > 0 && (
        <div>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>All Related Trending Topics</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {relatedTrending.map((topic, i) => (
              <span key={i} style={{ padding: '0.25rem 0.625rem', backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: '9999px', fontSize: '0.75rem', color: 'var(--color-primary)', border: '1px solid rgba(99,102,241,0.2)' }}>{topic}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SEO CONFIG RENDERER
// ============================================================================

function SEOConfigReview({ data }: { data: ParsedOutput }) {
  const seo = data.seo as { title?: string; description?: string; keywords?: string[]; robotsIndex?: boolean; robotsFollow?: boolean; ogImage?: string; aiBotAccess?: unknown } | undefined;
  const source = data.source as string | undefined;
  const message = data.message as string | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {source && (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
          Source: {source === 'firestore' ? 'Platform settings' : 'Defaults'}
        </div>
      )}

      {seo && (
        <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.625rem' }}>
          {seo.title && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>Page Title</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{seo.title}</div>
            </div>
          )}
          {seo.description && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>Meta Description</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{seo.description}</div>
            </div>
          )}
          {seo.keywords && seo.keywords.length > 0 && (
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-disabled)', marginBottom: '0.375rem' }}>Keywords ({seo.keywords.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {seo.keywords.map((kw, i) => (
                  <span key={i} style={{ padding: '0.25rem 0.625rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '9999px', fontSize: '0.75rem', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}>{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {message && (
        <div style={{ padding: '0.875rem 1rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          {message}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>
      {children}
    </h3>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)', minWidth: '80px' }}>
      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: color ?? 'var(--color-text-primary)' }}>{value}</div>
    </div>
  );
}

// ============================================================================
// FALLBACK
// ============================================================================

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

  const outputType = parsed ? detectOutputType(parsed, step.toolName) : 'unknown';

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
          {outputType === 'trending_research' && <TrendingResearchReview data={parsed} />}
          {outputType === 'seo_config' && <SEOConfigReview data={parsed} />}
          {outputType === 'strategy' && <StrategyReview data={parsed} />}
          {outputType === 'cinematic' && <CinematicReview data={parsed} />}
          {outputType === 'thumbnails' && <ThumbnailsReview data={parsed} />}
          {outputType === 'draft' && <DraftReview data={parsed} />}
          {outputType === 'blog_draft' && <BlogDraftReview data={parsed} />}
          {outputType === 'intelligence' && <IntelligenceReview data={parsed} />}
          {(outputType === 'delegation_result' || outputType === 'campaign_result' || outputType === 'social_post' || outputType === 'lead_scan') && <DelegationResultReview data={parsed} />}
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
        <Link href="/mission-control" style={{ color: 'var(--color-primary)' }}>Mission Control</Link>.
      </div>
    );
  }

  return <StepReviewContent missionId={missionId} stepId={stepId} />;
}
