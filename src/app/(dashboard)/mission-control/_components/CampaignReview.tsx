'use client';

/**
 * CampaignReview — Unified deliverable review view for Campaign Orchestration Pipeline.
 *
 * Shows all deliverables as cards with inline preview + approve/reject/feedback buttons.
 * Supports "Approve All" for batch approval.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { CampaignDeliverable, Campaign, DeliverableStatus } from '@/types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface CampaignResponse {
  success: boolean;
  data?: Campaign & { deliverableItems: CampaignDeliverable[] };
}

interface CampaignReviewProps {
  campaignId: string;
}

// ============================================================================
// STATUS HELPERS
// ============================================================================

function getStatusColor(status: DeliverableStatus): string {
  switch (status) {
    case 'drafting': return '#6b7280';
    case 'pending_review': return '#f59e0b';
    case 'approved': return '#10b981';
    case 'rejected': return '#ef4444';
    case 'revision_requested': return '#f97316';
    case 'published': return '#6366f1';
    default: return '#6b7280';
  }
}

function getStatusLabel(status: DeliverableStatus): string {
  switch (status) {
    case 'drafting': return 'Drafting';
    case 'pending_review': return 'Pending Review';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'revision_requested': return 'Revision Requested';
    case 'published': return 'Published';
    default: return status;
  }
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'video': return '\u{1F3AC}';
    case 'blog': return '\u{1F4DD}';
    case 'social_post': return '\u{1F4F1}';
    case 'image': return '\u{1F5BC}';
    case 'email': return '\u{2709}';
    case 'research': return '\u{1F50D}';
    case 'strategy': return '\u{1F4CA}';
    default: return '\u{1F4C4}';
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'video': return 'Video';
    case 'blog': return 'Blog Post';
    case 'social_post': return 'Social Post';
    case 'image': return 'Image';
    case 'email': return 'Email';
    case 'research': return 'Research';
    case 'strategy': return 'Strategy';
    default: return type;
  }
}

// ============================================================================
// DELIVERABLE CARD
// ============================================================================

function DeliverableCard({
  deliverable,
  onAction,
  isUpdating,
}: {
  deliverable: CampaignDeliverable;
  onAction: (deliverableId: string, status: DeliverableStatus, feedback?: string) => void;
  isUpdating: boolean;
}) {
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const statusColor = getStatusColor(deliverable.status);
  const previewData = deliverable.previewData;

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-paper)',
      border: '1px solid var(--color-border-light)',
      borderRadius: '0.75rem',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{getTypeIcon(deliverable.type)}</span>
          <div>
            <div style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}>
              {deliverable.title}
            </div>
            <div style={{
              fontSize: '0.6875rem',
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}>
              {getTypeLabel(deliverable.type)}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.25rem 0.5rem',
          borderRadius: '9999px',
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: statusColor,
          backgroundColor: `${statusColor}14`,
          border: `1px solid ${statusColor}33`,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: statusColor,
          }} />
          {getStatusLabel(deliverable.status)}
        </span>
      </div>

      {/* Preview content */}
      <div style={{
        padding: '0.625rem',
        backgroundColor: 'var(--color-bg-elevated)',
        borderRadius: '0.5rem',
        fontSize: '0.8125rem',
        color: 'var(--color-text-secondary)',
        lineHeight: 1.5,
      }}>
        {deliverable.type === 'video' && (
          <>
            {previewData.sceneCount && (
              <div>{previewData.sceneCount as number} scene(s)</div>
            )}
            {previewData.projectId && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                Project: {previewData.projectId as string}
              </div>
            )}
          </>
        )}
        {deliverable.type === 'blog' && (
          <>
            {previewData.excerpt && (
              <div>{previewData.excerpt as string}</div>
            )}
            {previewData.wordCount && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.25rem' }}>
                {previewData.wordCount as number} words &middot; {previewData.readTime as number} min read
              </div>
            )}
          </>
        )}
        {deliverable.type === 'social_post' && (
          <>
            {previewData.platform && (
              <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                {(previewData.platform as string).charAt(0).toUpperCase() + (previewData.platform as string).slice(1)}
              </div>
            )}
            {previewData.copy && (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {(previewData.copy as string).slice(0, 280)}
                {(previewData.copy as string).length > 280 ? '...' : ''}
              </div>
            )}
          </>
        )}
        {deliverable.type === 'image' && (
          <div>Image deliverable</div>
        )}
        {deliverable.type === 'email' && (
          <div>Email deliverable</div>
        )}
        {(deliverable.type === 'research' || deliverable.type === 'strategy') && (
          <div>{getTypeLabel(deliverable.type)} deliverable</div>
        )}
      </div>

      {/* Review link */}
      <a
        href={deliverable.reviewLink}
        style={{
          fontSize: '0.75rem',
          color: 'var(--color-primary)',
          textDecoration: 'none',
          fontWeight: 500,
        }}
      >
        Open in editor &rarr;
      </a>

      {/* Feedback display */}
      {deliverable.feedback && (
        <div style={{
          padding: '0.5rem 0.625rem',
          backgroundColor: 'rgba(244,67,54,0.06)',
          border: '1px solid rgba(244,67,54,0.15)',
          borderRadius: '0.375rem',
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
        }}>
          <strong>Feedback:</strong> {deliverable.feedback}
        </div>
      )}

      {/* Action buttons */}
      {(deliverable.status === 'pending_review' || deliverable.status === 'revision_requested') && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onAction(deliverable.id, 'approved')}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#fff',
              backgroundColor: isUpdating ? '#9ca3af' : '#10b981',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: isUpdating ? 'not-allowed' : 'pointer',
            }}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onAction(deliverable.id, 'rejected')}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#ef4444',
              backgroundColor: 'transparent',
              border: '1px solid #ef4444',
              borderRadius: '0.375rem',
              cursor: isUpdating ? 'not-allowed' : 'pointer',
            }}
          >
            Reject
          </button>
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => setShowFeedback(!showFeedback)}
            style={{
              padding: '0.375rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border-light)',
              borderRadius: '0.375rem',
              cursor: isUpdating ? 'not-allowed' : 'pointer',
            }}
          >
            Request Revision
          </button>
        </div>
      )}

      {/* Feedback input */}
      {showFeedback && (
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <input
            type="text"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Describe what needs to change..."
            style={{
              flex: 1,
              padding: '0.375rem 0.5rem',
              fontSize: '0.75rem',
              border: '1px solid var(--color-border-light)',
              borderRadius: '0.375rem',
              backgroundColor: 'var(--color-bg-elevated)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            disabled={isUpdating || !feedbackText.trim()}
            onClick={() => {
              onAction(deliverable.id, 'revision_requested', feedbackText.trim());
              setFeedbackText('');
              setShowFeedback(false);
            }}
            style={{
              padding: '0.375rem 0.625rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#fff',
              backgroundColor: (!feedbackText.trim() || isUpdating) ? '#9ca3af' : '#f97316',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: (!feedbackText.trim() || isUpdating) ? 'not-allowed' : 'pointer',
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CAMPAIGN REVIEW COMPONENT
// ============================================================================

export default function CampaignReview({ campaignId }: CampaignReviewProps) {
  const authFetch = useAuthFetch();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [deliverables, setDeliverables] = useState<CampaignDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await authFetch(`/api/campaigns/${campaignId}`);
      if (!res.ok) { return; }
      const data = (await res.json()) as CampaignResponse;
      if (data.success && data.data) {
        const { deliverableItems, ...campaignData } = data.data;
        setCampaign(campaignData);
        setDeliverables(deliverableItems);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [authFetch, campaignId]);

  useEffect(() => {
    void fetchCampaign();
  }, [fetchCampaign]);

  // Poll for updates
  useEffect(() => {
    const hasPending = deliverables.some(
      (d) => d.status === 'drafting' || d.status === 'pending_review'
    );
    const interval = hasPending ? 5000 : 30000;

    const timer = setInterval(() => {
      void fetchCampaign();
    }, interval);

    return () => clearInterval(timer);
  }, [deliverables, fetchCampaign]);

  const handleAction = useCallback(async (
    deliverableId: string,
    status: DeliverableStatus,
    feedback?: string
  ) => {
    setUpdatingId(deliverableId);
    try {
      const body: Record<string, string> = { status };
      if (feedback) { body.feedback = feedback; }

      const res = await authFetch(
        `/api/campaigns/${campaignId}/deliverables/${deliverableId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        void fetchCampaign();
      }
    } catch {
      // Silent fail
    } finally {
      setUpdatingId(null);
    }
  }, [authFetch, campaignId, fetchCampaign]);

  const handleApproveAll = useCallback(async () => {
    const pendingIds = deliverables
      .filter((d) => d.status === 'pending_review' || d.status === 'revision_requested')
      .map((d) => d.id);

    for (const id of pendingIds) {
      await handleAction(id, 'approved');
    }
  }, [deliverables, handleAction]);

  if (loading) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--color-text-disabled)',
        fontSize: '0.875rem',
      }}>
        Loading campaign...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--color-text-disabled)',
        fontSize: '0.875rem',
      }}>
        Campaign not found
      </div>
    );
  }

  const pendingCount = deliverables.filter(
    (d) => d.status === 'pending_review' || d.status === 'revision_requested'
  ).length;
  const approvedCount = deliverables.filter((d) => d.status === 'approved' || d.status === 'published').length;
  const totalCount = deliverables.length;

  return (
    <div style={{ padding: '1.25rem 1.5rem' }}>
      {/* Campaign header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
      }}>
        <div>
          <h1 style={{
            fontSize: '1.375rem',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}>
            Campaign Review
          </h1>
          <div style={{
            fontSize: '0.8125rem',
            color: 'var(--color-text-secondary)',
            marginTop: '0.25rem',
            maxWidth: 600,
          }}>
            {campaign.brief}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {totalCount}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase' }}>
              Deliverables
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
              {approvedCount}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase' }}>
              Approved
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>
              {pendingCount}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', textTransform: 'uppercase' }}>
              Pending
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div style={{
          height: 4,
          backgroundColor: 'var(--color-bg-elevated)',
          borderRadius: 2,
          marginBottom: '1rem',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${(approvedCount / totalCount) * 100}%`,
            backgroundColor: '#10b981',
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {/* Approve All button */}
      {pendingCount > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => void handleApproveAll()}
            disabled={updatingId !== null}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#fff',
              backgroundColor: updatingId ? '#9ca3af' : '#10b981',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: updatingId ? 'not-allowed' : 'pointer',
            }}
          >
            Approve All ({pendingCount})
          </button>
        </div>
      )}

      {/* Deliverable cards grid */}
      {deliverables.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '0.875rem',
        }}>
          {deliverables.map((d) => (
            <DeliverableCard
              key={d.id}
              deliverable={d}
              onAction={(id, status, feedback) => void handleAction(id, status, feedback)}
              isUpdating={updatingId === d.id}
            />
          ))}
        </div>
      ) : (
        <div style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          color: 'var(--color-text-disabled)',
          fontSize: '0.875rem',
        }}>
          No deliverables yet. Jasper is still working on the campaign.
        </div>
      )}
    </div>
  );
}
