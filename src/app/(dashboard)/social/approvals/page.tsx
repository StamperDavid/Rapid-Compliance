'use client';

/**
 * Social Media Approval Queue (Upgraded)
 * Batch review table, bulk approve, "Why" badge highlighting,
 * correction capture (stores diff when user edits a draft for training).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import type { ApprovalItem, ApprovalStatus } from '@/types/social';
import SubpageNav from '@/components/ui/SubpageNav';

const SOCIAL_NAV_ITEMS = [
  { label: 'Command Center', href: '/social/command-center' },
  { label: 'Campaigns', href: '/social/campaigns' },
  { label: 'Calendar', href: '/social/calendar' },
  { label: 'Approvals', href: '/social/approvals' },
  { label: 'Listening', href: '/social/listening' },
  { label: 'Activity', href: '/social/activity' },
  { label: 'Agent Rules', href: '/social/agent-rules' },
  { label: 'Playbook', href: '/social/playbook' },
];

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

/**
 * Highlight the flagged phrase within content.
 * Returns JSX with the flagged keyword highlighted in orange.
 */
function highlightFlagReason(content: string, flagReason: string): React.ReactNode {
  // Extract the most likely keyword from the flag reason
  const reasonLower = flagReason.toLowerCase();
  const keywordPatterns = [
    /contains keyword "([^"]+)"/i,
    /language "([^"]+)"/i,
    /detected: ([^.]+)/i,
  ];

  let keyword: string | null = null;
  for (const pattern of keywordPatterns) {
    const match = reasonLower.match(pattern);
    if (match?.[1]) {
      keyword = match[1];
      break;
    }
  }

  if (!keyword) { return content; }

  const idx = content.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) { return content; }

  const before = content.slice(0, idx);
  const matched = content.slice(idx, idx + keyword.length);
  const after = content.slice(idx + keyword.length);

  return (
    <>
      {before}
      <span style={{
        backgroundColor: 'rgba(255,152,0,0.25)',
        borderRadius: '0.125rem',
        padding: '0 0.125rem',
        borderBottom: '2px solid #FF9800',
      }}>
        {matched}
      </span>
      {after}
    </>
  );
}

export default function ApprovalQueuePage() {
  const { user: _user } = useUnifiedAuth();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [counts, setCounts] = useState<ApprovalCounts>({ total: 0, pending_review: 0, approved: 0, rejected: 0, revision_requested: 0 });
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Correction capture (editable content)
  const [editingContent, setEditingContent] = useState<Record<string, string>>({});

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
      // Check if content was edited (correction capture)
      const editedContent = editingContent[approvalId];
      const originalItem = approvals.find((a) => a.id === approvalId);
      const hasCorrection = editedContent && originalItem && editedContent !== originalItem.content;

      const response = await fetch('/api/social/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId,
          status,
          comment: commentText || undefined,
          ...(hasCorrection ? {
            correctedContent: editedContent,
            originalContent: originalItem.content,
          } : {}),
        }),
      });

      const data = await response.json() as { success: boolean };
      if (data.success) {
        setCommentText('');
        setEditingContent((prev) => {
          const next = { ...prev };
          delete next[approvalId];
          return next;
        });
        await fetchApprovals();
      }
    } catch (error) {
      console.error('Failed to update approval:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Batch operations ──────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendingItems = approvals.filter((a) => a.status === 'pending_review');
    if (selectedIds.size === pendingItems.length && pendingItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingItems.map((a) => a.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) { return; }
    setBulkLoading(true);
    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch('/api/social/approvals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvalId: id, status: 'approved' }),
        })
      );
      await Promise.all(promises);
      setSelectedIds(new Set());
      await fetchApprovals();
    } catch (error) {
      console.error('Failed to bulk approve:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) { return; }
    setBulkLoading(true);
    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch('/api/social/approvals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvalId: id, status: 'rejected' }),
        })
      );
      await Promise.all(promises);
      setSelectedIds(new Set());
      await fetchApprovals();
    } catch (error) {
      console.error('Failed to bulk reject:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  const pendingCount = approvals.filter((a) => a.status === 'pending_review').length;
  const allPendingSelected = pendingCount > 0 && selectedIds.size === pendingCount;

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
        Review flagged content before it goes live — edit drafts to train the AI
      </p>

      <SubpageNav items={SOCIAL_NAV_ITEMS} />

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Pending', value: counts.pending_review, color: '#FFC107' },
          { label: 'Approved', value: counts.approved, color: '#4CAF50' },
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

      {/* Filter Tabs + Bulk Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()); }}
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

        {/* Bulk action buttons */}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => { void handleBulkApprove(); }}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: '#4CAF50',
                color: '#fff',
                opacity: bulkLoading ? 0.5 : 1,
              }}
            >
              Approve All
            </button>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => { void handleBulkReject(); }}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: '#F44336',
                color: '#fff',
                opacity: bulkLoading ? 0.5 : 1,
              }}
            >
              Reject All
            </button>
          </div>
        )}
      </div>

      {/* Approvals List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>Loading...</div>
      ) : approvals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
          No items in queue
        </div>
      ) : (
        <>
          {/* Select All Header (for pending items) */}
          {pendingCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              marginBottom: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
            }}>
              <input
                type="checkbox"
                checked={allPendingSelected}
                onChange={toggleSelectAll}
                style={{ cursor: 'pointer', width: 16, height: 16 }}
              />
              <span>Select all pending ({pendingCount})</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {approvals.map((item) => {
              const statusInfo = STATUS_COLORS[item.status];
              const isExpanded = expandedId === item.id;
              const isSelected = selectedIds.has(item.id);
              const isPending = item.status === 'pending_review';

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: 'var(--color-bg-paper)',
                    borderRadius: '0.5rem',
                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border-light)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Checkbox */}
                    {isPending && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
                      />
                    )}
                    {!isPending && <div style={{ width: 16, flexShrink: 0 }} />}

                    {/* Clickable area */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      {/* Platform badge */}
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.625rem',
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
                          fontSize: '0.8125rem',
                          color: 'var(--color-text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {item.content}
                        </div>
                      </div>

                      {/* "Why" badge */}
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.5625rem',
                          fontWeight: 600,
                          backgroundColor: 'rgba(255,152,0,0.12)',
                          color: '#FF9800',
                          flexShrink: 0,
                          maxWidth: 180,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={item.flagReason}
                      >
                        WHY: {item.flagReason}
                      </span>

                      {/* Status badge */}
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '1rem',
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          backgroundColor: statusInfo.bg,
                          color: statusInfo.text,
                          flexShrink: 0,
                        }}
                      >
                        {statusInfo.label}
                      </span>

                      {/* Timestamp */}
                      <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', flexShrink: 0 }}>
                        {new Date(item.flaggedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--color-border-light)' }}>
                      {/* Editable content (correction capture) */}
                      <div style={{ padding: '0.75rem 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            Content {isPending ? '(editable — corrections train the AI)' : ''}
                          </span>
                          {editingContent[item.id] && editingContent[item.id] !== item.content && (
                            <span style={{ fontSize: '0.625rem', color: '#FF9800', fontWeight: 600 }}>
                              Modified — correction will be captured
                            </span>
                          )}
                        </div>
                        {isPending ? (
                          <textarea
                            value={editingContent[item.id] ?? item.content}
                            onChange={(e) => setEditingContent((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            rows={4}
                            style={{
                              width: '100%',
                              padding: '0.625rem',
                              borderRadius: '0.375rem',
                              border: '1px solid var(--color-border-light)',
                              backgroundColor: 'var(--color-bg-main)',
                              color: 'var(--color-text-primary)',
                              fontSize: '0.8125rem',
                              fontFamily: 'inherit',
                              resize: 'vertical',
                              lineHeight: 1.5,
                            }}
                          />
                        ) : (
                          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            {highlightFlagReason(item.content, item.flagReason)}
                          </div>
                        )}
                      </div>

                      {/* Flag reason detail */}
                      <div style={{
                        padding: '0.5rem 0.75rem',
                        marginBottom: '0.75rem',
                        backgroundColor: 'rgba(255,152,0,0.06)',
                        border: '1px solid rgba(255,152,0,0.15)',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        color: '#FF9800',
                      }}>
                        <strong>Flagged:</strong> {item.flagReason}
                        {item.flaggedBy === 'autonomous-agent' && (
                          <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-disabled)' }}>(by AI agent)</span>
                        )}
                      </div>

                      {/* Comments thread */}
                      {item.comments.length > 0 && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
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

                      {/* Comment input + action buttons */}
                      {isPending && (
                        <>
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
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
                              {editingContent[item.id] && editingContent[item.id] !== item.content ? 'Approve with Edits' : 'Approve'}
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
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
