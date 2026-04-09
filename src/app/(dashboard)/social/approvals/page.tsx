'use client';

/**
 * Social Media Approval Queue (Upgraded)
 * Batch review table, bulk approve, "Why" badge highlighting,
 * correction capture (stores diff when user edits a draft for training).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { SOCIAL_PLATFORMS, type ApprovalItem, type ApprovalStatus } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { logger } from '@/lib/logger/logger';
import { PageTitle, SectionDescription } from '@/components/ui/typography';

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

const PLATFORM_COLORS: Record<string, string> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p, PLATFORM_META[p].color])
);

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
  const authFetch = useAuthFetch();
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
        authFetch(`/api/social/approvals?${statusParam}`),
        authFetch('/api/social/approvals?counts=true'),
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
      logger.error('Failed to fetch approvals', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, [activeTab, authFetch]);

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

      const response = await authFetch('/api/social/approvals', {
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
      logger.error('Failed to update approval', error instanceof Error ? error : new Error(String(error)));
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
        authFetch('/api/social/approvals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvalId: id, status: 'approved' }),
        })
      );
      await Promise.all(promises);
      setSelectedIds(new Set());
      await fetchApprovals();
    } catch (error) {
      logger.error('Failed to bulk approve', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) { return; }
    setBulkLoading(true);
    try {
      const promises = Array.from(selectedIds).map((id) =>
        authFetch('/api/social/approvals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvalId: id, status: 'rejected' }),
        })
      );
      await Promise.all(promises);
      setSelectedIds(new Set());
      await fetchApprovals();
    } catch (error) {
      logger.error('Failed to bulk reject', error instanceof Error ? error : new Error(String(error)));
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
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <PageTitle>Approval Queue</PageTitle>
        <SectionDescription className="mt-1">Review flagged content before it goes live — edit drafts to train the AI</SectionDescription>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: counts.pending_review, color: '#FFC107' },
          { label: 'Approved', value: counts.approved, color: '#4CAF50' },
          { label: 'Rejected', value: counts.rejected, color: '#F44336' },
          { label: 'Revision Needed', value: counts.revision_requested, color: '#FF9800' },
        ].map((stat) => (
          <div key={stat.label} className="p-4 bg-card rounded-lg border border-border-light">
            <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
            <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs + Bulk Actions */}
      <div className="flex items-center justify-between border-b border-border-light pb-2">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()); }}
              className={`px-4 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-white font-semibold'
                  : 'bg-transparent text-muted-foreground font-normal hover:bg-surface-elevated'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Bulk action buttons */}
        {selectedIds.size > 0 && (
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => { void handleBulkApprove(); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold text-white cursor-pointer transition-opacity ${bulkLoading ? 'opacity-50' : ''}`}
              style={{ backgroundColor: '#4CAF50' }}
            >
              Approve All
            </button>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => { void handleBulkReject(); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold text-white cursor-pointer transition-opacity ${bulkLoading ? 'opacity-50' : ''}`}
              style={{ backgroundColor: '#F44336' }}
            >
              Reject All
            </button>
          </div>
        )}
      </div>

      {/* Approvals List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No items in queue</div>
      ) : (
        <>
          {/* Select All Header (for pending items) */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 mb-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={allPendingSelected}
                onChange={toggleSelectAll}
                className="cursor-pointer w-4 h-4"
              />
              <span>Select all pending ({pendingCount})</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {approvals.map((item) => {
              const statusInfo = STATUS_COLORS[item.status];
              const isExpanded = expandedId === item.id;
              const isSelected = selectedIds.has(item.id);
              const isPending = item.status === 'pending_review';

              return (
                <div
                  key={item.id}
                  className={`bg-card rounded-lg overflow-hidden border ${isSelected ? 'border-primary' : 'border-border-light'}`}
                >
                  {/* Row */}
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                    {/* Checkbox */}
                    {isPending && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer w-4 h-4 shrink-0"
                      />
                    )}
                    {!isPending && <div className="w-4 shrink-0" />}

                    {/* Clickable area */}
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      {/* Platform badge */}
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white uppercase shrink-0"
                        style={{ backgroundColor: PLATFORM_COLORS[item.platform] ?? '#666' }}
                      >
                        {item.platform}
                      </span>

                      {/* Content preview */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground truncate">{item.content}</div>
                      </div>

                      {/* "Why" badge */}
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 max-w-[180px] truncate"
                        style={{ backgroundColor: 'rgba(255,152,0,0.12)', color: '#FF9800' }}
                        title={item.flagReason}
                      >
                        WHY: {item.flagReason}
                      </span>

                      {/* Status badge */}
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                      >
                        {statusInfo.label}
                      </span>

                      {/* Timestamp */}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(item.flaggedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border-light">
                      {/* Editable content (correction capture) */}
                      <div className="py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-muted-foreground">
                            Content {isPending ? '(editable — corrections train the AI)' : ''}
                          </span>
                          {editingContent[item.id] && editingContent[item.id] !== item.content && (
                            <span className="text-[10px] font-semibold" style={{ color: '#FF9800' }}>
                              Modified — correction will be captured
                            </span>
                          )}
                        </div>
                        {isPending ? (
                          <textarea
                            value={editingContent[item.id] ?? item.content}
                            onChange={(e) => setEditingContent((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            rows={4}
                            className="w-full px-2.5 py-2 rounded-md border border-border-light bg-surface-main text-foreground text-sm font-[inherit] resize-y leading-relaxed"
                          />
                        ) : (
                          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                            {highlightFlagReason(item.content, item.flagReason)}
                          </div>
                        )}
                      </div>

                      {/* Flag reason detail */}
                      <div
                        className="px-3 py-2 mb-3 rounded-md text-xs border"
                        style={{ backgroundColor: 'rgba(255,152,0,0.06)', borderColor: 'rgba(255,152,0,0.15)', color: '#FF9800' }}
                      >
                        <strong>Flagged:</strong> {item.flagReason}
                        {item.flaggedBy === 'autonomous-agent' && (
                          <span className="ml-2 text-muted-foreground">(by AI agent)</span>
                        )}
                      </div>

                      {/* Comments thread */}
                      {item.comments.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-muted-foreground mb-1.5">Comments</div>
                          {item.comments.map((comment) => (
                            <div key={comment.id} className="p-2 mb-1 bg-surface-main rounded text-sm">
                              <span className="font-semibold text-foreground">{comment.authorName}: </span>
                              <span className="text-muted-foreground">{comment.text}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comment input + action buttons */}
                      {isPending && (
                        <>
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              value={expandedId === item.id ? commentText : ''}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="Add a comment (optional)..."
                              className="flex-1 px-3 py-2 rounded-md border border-border-light bg-surface-main text-foreground text-sm"
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={actionLoading === item.id}
                              onClick={() => { void handleAction(item.id, 'approved'); }}
                              className={`px-4 py-2 rounded-md text-sm font-semibold text-white cursor-pointer transition-opacity ${actionLoading === item.id ? 'opacity-50' : ''}`}
                              style={{ backgroundColor: '#4CAF50' }}
                            >
                              {editingContent[item.id] && editingContent[item.id] !== item.content ? 'Approve with Edits' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading === item.id}
                              onClick={() => { void handleAction(item.id, 'rejected'); }}
                              className={`px-4 py-2 rounded-md text-sm font-semibold text-white cursor-pointer transition-opacity ${actionLoading === item.id ? 'opacity-50' : ''}`}
                              style={{ backgroundColor: '#F44336' }}
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading === item.id}
                              onClick={() => { void handleAction(item.id, 'revision_requested'); }}
                              className={`px-4 py-2 rounded-md text-sm font-semibold text-white cursor-pointer transition-opacity ${actionLoading === item.id ? 'opacity-50' : ''}`}
                              style={{ backgroundColor: '#FF9800' }}
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
