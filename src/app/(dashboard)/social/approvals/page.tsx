'use client';

/**
 * Social Media Approval Queue
 * Review, approve, reject, or request revisions for flagged social media content.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import type { ApprovalItem, ApprovalStatus } from '@/types/social';

type FilterTab = 'all' | ApprovalStatus;

interface ApprovalCounts {
  total: number;
  pending_review: number;
  approved: number;
  rejected: number;
  revision_requested: number;
}

const STATUS_COLORS: Record<ApprovalStatus, { bg: string; text: string; label: string }> = {
  pending_review: { bg: 'rgba(255,193,7,0.15)', text: '#FFC107', label: 'Pending Review' },
  approved: { bg: 'rgba(76,175,80,0.15)', text: '#4CAF50', label: 'Approved' },
  rejected: { bg: 'rgba(244,67,54,0.15)', text: '#F44336', label: 'Rejected' },
  revision_requested: { bg: 'rgba(255,152,0,0.15)', text: '#FF9800', label: 'Revision Needed' },
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#000000',
  linkedin: '#0A66C2',
};

export default function ApprovalQueuePage() {
  const { user: _user } = useUnifiedAuth();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [counts, setCounts] = useState<ApprovalCounts>({ total: 0, pending_review: 0, approved: 0, rejected: 0, revision_requested: 0 });
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const fetchApprovals = useCallback(async () => {
    try {
      const statusParam = activeTab !== 'all' ? `&status=${activeTab}` : '';
      const [approvalsRes, countsRes] = await Promise.all([
        fetch(`/api/social/approvals?${statusParam}`),
        fetch('/api/social/approvals?counts=true'),
      ]);

      const approvalsData = await approvalsRes.json() as { success: boolean; approvals?: ApprovalItem[] };
      const countsData = await countsRes.json() as { success: boolean; counts?: ApprovalCounts };

      if (approvalsData.success && approvalsData.approvals) {
        setApprovals(approvalsData.approvals);
      }
      if (countsData.success && countsData.counts) {
        setCounts(countsData.counts);
      }
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void fetchApprovals();
  }, [fetchApprovals]);

  const handleAction = async (approvalId: string, status: ApprovalStatus) => {
    setActionLoading(approvalId);
    try {
      const response = await fetch('/api/social/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId,
          status,
          comment: commentText || undefined,
        }),
      });

      const data = await response.json() as { success: boolean };
      if (data.success) {
        setCommentText('');
        await fetchApprovals();
      }
    } catch (error) {
      console.error('Failed to update approval:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.total },
    { key: 'pending_review', label: 'Pending', count: counts.pending_review },
    { key: 'approved', label: 'Approved', count: counts.approved },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
    { key: 'revision_requested', label: 'Revision', count: counts.revision_requested },
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
        Approval Queue
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Review flagged content before it goes live
      </p>

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Pending', value: counts.pending_review, color: '#FFC107' },
          { label: 'Approved Today', value: counts.approved, color: '#4CAF50' },
          { label: 'Rejected', value: counts.rejected, color: '#F44336' },
          { label: 'Revision Needed', value: counts.revision_requested, color: '#FF9800' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: '1rem',
              backgroundColor: 'var(--color-bg-paper)',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border-light)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>{stat.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.5rem' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: activeTab === tab.key ? 600 : 400,
              backgroundColor: activeTab === tab.key ? 'var(--color-primary)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Approvals List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : approvals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
          No items in queue
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {approvals.map((item) => {
            const statusInfo = STATUS_COLORS[item.status];
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: 'var(--color-bg-paper)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border-light)',
                  overflow: 'hidden',
                }}
              >
                {/* Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  {/* Platform badge */}
                  <span
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: '#fff',
                      backgroundColor: PLATFORM_COLORS[item.platform] ?? '#666',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    {item.platform}
                  </span>

                  {/* Content preview */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.content}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.125rem' }}>
                      Flagged: {item.flagReason}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '1rem',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      backgroundColor: statusInfo.bg,
                      color: statusInfo.text,
                      flexShrink: 0,
                    }}
                  >
                    {statusInfo.label}
                  </span>

                  {/* Timestamp */}
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', flexShrink: 0 }}>
                    {new Date(item.flaggedAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--color-border-light)' }}>
                    {/* Full content */}
                    <div style={{ padding: '1rem 0', fontSize: '0.875rem', color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                      {item.content}
                    </div>

                    {/* Comments thread */}
                    {item.comments.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                          Comments
                        </div>
                        {item.comments.map((comment) => (
                          <div key={comment.id} style={{
                            padding: '0.5rem',
                            marginBottom: '0.25rem',
                            backgroundColor: 'var(--color-bg-main)',
                            borderRadius: '0.25rem',
                            fontSize: '0.8125rem',
                          }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{comment.authorName}: </span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>{comment.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comment input */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <input
                        type="text"
                        value={expandedId === item.id ? commentText : ''}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment (optional)..."
                        style={{
                          flex: 1,
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.375rem',
                          border: '1px solid var(--color-border-light)',
                          backgroundColor: 'var(--color-bg-main)',
                          color: 'var(--color-text-primary)',
                          fontSize: '0.8125rem',
                        }}
                      />
                    </div>

                    {/* Action buttons */}
                    {item.status === 'pending_review' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          disabled={actionLoading === item.id}
                          onClick={() => { void handleAction(item.id, 'approved'); }}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            backgroundColor: '#4CAF50',
                            color: '#fff',
                            opacity: actionLoading === item.id ? 0.5 : 1,
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading === item.id}
                          onClick={() => { void handleAction(item.id, 'rejected'); }}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            backgroundColor: '#F44336',
                            color: '#fff',
                            opacity: actionLoading === item.id ? 0.5 : 1,
                          }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading === item.id}
                          onClick={() => { void handleAction(item.id, 'revision_requested'); }}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            backgroundColor: '#FF9800',
                            color: '#fff',
                            opacity: actionLoading === item.id ? 0.5 : 1,
                          }}
                        >
                          Request Revision
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
