'use client';

/**
 * Activities Page
 * Global activity timeline — all CRM interactions in chronological order.
 * Route: /activities
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Mail,
  Phone,
  Calendar,
  FileText,
  CheckSquare,
  Handshake,
  Users,
  ClipboardList,
  Globe,
  BookOpen,
  GitBranch,
  Zap,
  MessageSquare,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import type { Activity as ActivityRecord, ActivityType } from '@/types/activity';

// ============================================================================
// TYPES
// ============================================================================

interface ActivitiesApiResponse {
  success: boolean;
  data: ActivityRecord[];
  hasMore: boolean;
  count: number;
}

type FilterTab =
  | 'all'
  | 'emails'
  | 'calls'
  | 'meetings'
  | 'notes'
  | 'tasks'
  | 'system';

// ============================================================================
// CONSTANTS
// ============================================================================

const EMAIL_TYPES: ActivityType[] = [
  'email_sent',
  'email_received',
  'email_opened',
  'email_clicked',
];

const CALL_TYPES: ActivityType[] = ['call_made', 'call_received'];

const MEETING_TYPES: ActivityType[] = [
  'meeting_scheduled',
  'meeting_completed',
  'meeting_no_show',
];

const NOTE_TYPES: ActivityType[] = ['note_added'];

const TASK_TYPES: ActivityType[] = ['task_created', 'task_completed'];

const SYSTEM_TYPES: ActivityType[] = [
  'form_submitted',
  'website_visit',
  'document_viewed',
  'deal_stage_changed',
  'lead_status_changed',
  'field_updated',
  'enrichment_completed',
  'sequence_enrolled',
  'sequence_unenrolled',
  'workflow_triggered',
  'ai_chat',
  'sms_sent',
  'sms_received',
];

const FILTER_TABS: { key: FilterTab; label: string; types: ActivityType[] | null }[] = [
  { key: 'all', label: 'All', types: null },
  { key: 'emails', label: 'Emails', types: EMAIL_TYPES },
  { key: 'calls', label: 'Calls', types: CALL_TYPES },
  { key: 'meetings', label: 'Meetings', types: MEETING_TYPES },
  { key: 'notes', label: 'Notes', types: NOTE_TYPES },
  { key: 'tasks', label: 'Tasks', types: TASK_TYPES },
  { key: 'system', label: 'System', types: SYSTEM_TYPES },
];

const PAGE_SIZE = 50;

// ============================================================================
// HELPERS
// ============================================================================

function getTimeAgo(timestamp: { seconds: number } | string | undefined): string {
  if (!timestamp) { return ''; }

  const ms =
    typeof timestamp === 'string'
      ? new Date(timestamp).getTime()
      : timestamp.seconds * 1000;

  if (isNaN(ms)) { return ''; }

  const diffMs = Date.now() - ms;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) { return 'Just now'; }
  if (diffMins < 60) { return `${diffMins}m ago`; }
  if (diffHours < 24) { return `${diffHours}h ago`; }
  if (diffDays < 7) { return `${diffDays}d ago`; }
  return new Date(ms).toLocaleDateString();
}

interface ActivityMeta {
  icon: React.ReactNode;
  label: string;
  badgeClass: string;
}

function getActivityMeta(type: ActivityType): ActivityMeta {
  switch (type) {
    case 'email_sent':
      return { icon: <Mail size={15} />, label: 'Email Sent', badgeClass: 'bg-blue-500/15 text-blue-400' };
    case 'email_received':
      return { icon: <Mail size={15} />, label: 'Email Received', badgeClass: 'bg-blue-500/15 text-blue-400' };
    case 'email_opened':
      return { icon: <Mail size={15} />, label: 'Email Opened', badgeClass: 'bg-sky-500/15 text-sky-400' };
    case 'email_clicked':
      return { icon: <Mail size={15} />, label: 'Email Clicked', badgeClass: 'bg-sky-500/15 text-sky-400' };
    case 'call_made':
      return { icon: <Phone size={15} />, label: 'Call Made', badgeClass: 'bg-green-500/15 text-green-400' };
    case 'call_received':
      return { icon: <Phone size={15} />, label: 'Call Received', badgeClass: 'bg-green-500/15 text-green-400' };
    case 'meeting_scheduled':
      return { icon: <Calendar size={15} />, label: 'Meeting Scheduled', badgeClass: 'bg-purple-500/15 text-purple-400' };
    case 'meeting_completed':
      return { icon: <Calendar size={15} />, label: 'Meeting Completed', badgeClass: 'bg-purple-500/15 text-purple-400' };
    case 'meeting_no_show':
      return { icon: <Calendar size={15} />, label: 'No Show', badgeClass: 'bg-red-500/15 text-red-400' };
    case 'note_added':
      return { icon: <FileText size={15} />, label: 'Note Added', badgeClass: 'bg-amber-500/15 text-amber-400' };
    case 'task_created':
      return { icon: <CheckSquare size={15} />, label: 'Task Created', badgeClass: 'bg-orange-500/15 text-orange-400' };
    case 'task_completed':
      return { icon: <CheckSquare size={15} />, label: 'Task Completed', badgeClass: 'bg-orange-500/15 text-orange-400' };
    case 'deal_stage_changed':
      return { icon: <Handshake size={15} />, label: 'Deal Updated', badgeClass: 'bg-emerald-500/15 text-emerald-400' };
    case 'lead_status_changed':
      return { icon: <Users size={15} />, label: 'Lead Updated', badgeClass: 'bg-teal-500/15 text-teal-400' };
    case 'form_submitted':
      return { icon: <ClipboardList size={15} />, label: 'Form Submitted', badgeClass: 'bg-cyan-500/15 text-cyan-400' };
    case 'website_visit':
      return { icon: <Globe size={15} />, label: 'Website Visit', badgeClass: 'bg-indigo-500/15 text-indigo-400' };
    case 'document_viewed':
      return { icon: <BookOpen size={15} />, label: 'Document Viewed', badgeClass: 'bg-violet-500/15 text-violet-400' };
    case 'field_updated':
      return { icon: <FileText size={15} />, label: 'Field Updated', badgeClass: 'bg-zinc-500/15 text-zinc-400' };
    case 'enrichment_completed':
      return { icon: <Zap size={15} />, label: 'Enriched', badgeClass: 'bg-yellow-500/15 text-yellow-400' };
    case 'sequence_enrolled':
      return { icon: <GitBranch size={15} />, label: 'Sequence Started', badgeClass: 'bg-pink-500/15 text-pink-400' };
    case 'sequence_unenrolled':
      return { icon: <GitBranch size={15} />, label: 'Sequence Ended', badgeClass: 'bg-pink-500/15 text-pink-400' };
    case 'workflow_triggered':
      return { icon: <Zap size={15} />, label: 'Workflow', badgeClass: 'bg-rose-500/15 text-rose-400' };
    case 'ai_chat':
      return { icon: <MessageSquare size={15} />, label: 'AI Chat', badgeClass: 'bg-fuchsia-500/15 text-fuchsia-400' };
    case 'sms_sent':
      return { icon: <MessageSquare size={15} />, label: 'SMS Sent', badgeClass: 'bg-lime-500/15 text-lime-400' };
    case 'sms_received':
      return { icon: <MessageSquare size={15} />, label: 'SMS Received', badgeClass: 'bg-lime-500/15 text-lime-400' };
    default:
      return { icon: <Activity size={15} />, label: 'Activity', badgeClass: 'bg-muted text-muted-foreground' };
  }
}

function entityHref(entityType: string, entityId: string): string {
  switch (entityType) {
    case 'lead':
      return `/entities/leads/${entityId}`;
    case 'contact':
      return `/entities/contacts/${entityId}`;
    case 'company':
      return `/entities/companies/${entityId}`;
    case 'deal':
      return `/deals/${entityId}`;
    case 'opportunity':
      return `/deals/${entityId}`;
    default:
      return '#';
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function SkeletonRow() {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-border-strong last:border-0">
      <div className="mt-0.5 w-8 h-8 rounded-full bg-surface-elevated shrink-0 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-24 rounded bg-surface-elevated animate-pulse" />
          <div className="h-4 w-40 rounded bg-surface-elevated animate-pulse" />
        </div>
        <div className="h-3 w-56 rounded bg-surface-elevated animate-pulse" />
      </div>
      <div className="h-3 w-12 rounded bg-surface-elevated animate-pulse shrink-0" />
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivityRecord }) {
  const meta = getActivityMeta(activity.type);

  const primaryRelation = activity.relatedTo[0];
  const subject =
    activity.subject ??
    activity.summary ??
    meta.label;

  // The API serializes Firestore Timestamps as { seconds, nanoseconds } objects.
  // We accept both that shape and ISO strings.
  const rawTs = activity.occurredAt as unknown as { seconds: number } | string | undefined;
  const timeAgo = getTimeAgo(rawTs ?? (activity.createdAt as unknown as { seconds: number } | string | undefined));

  return (
    <div className="flex items-start gap-4 py-4 border-b border-border-strong last:border-0">
      {/* Icon bubble */}
      <div className="mt-0.5 w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-muted-foreground shrink-0">
        {meta.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          {/* Type badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.68rem] font-medium ${meta.badgeClass}`}>
            {meta.label}
          </span>
          {/* Subject */}
          <span className="text-sm font-medium text-foreground truncate">
            {subject}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {/* Related entity */}
          {primaryRelation && (
            <Link
              href={entityHref(primaryRelation.entityType, primaryRelation.entityId)}
              className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              {primaryRelation.entityName ?? primaryRelation.entityId}
            </Link>
          )}

          {/* Who performed it */}
          {activity.createdByName && (
            <span className="text-muted-foreground">
              by {activity.createdByName}
            </span>
          )}
        </div>
      </div>

      {/* Timestamp */}
      {timeAgo && (
        <span className="text-[0.7rem] text-muted-foreground shrink-0 pt-0.5">
          {timeAgo}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(
    async (filter: FilterTab, append: boolean) => {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        setError('Not authenticated.');
        setLoading(false);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const tab = FILTER_TABS.find((t) => t.key === filter);
        const typesParam =
          tab?.types != null ? `&types=${tab.types.join(',')}` : '';

        const url = `/api/crm/activities?pageSize=${PAGE_SIZE}${typesParam}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const body = await res.json() as { error?: string };
          throw new Error(body.error ?? `Request failed: ${res.status}`);
        }

        const json = await res.json() as ActivitiesApiResponse;

        if (!json.success) {
          throw new Error('API returned success: false');
        }

        setActivities((prev) => (append ? [...prev, ...json.data] : json.data));
        setHasMore(json.hasMore);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load activities.';
        setError(message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  // Load on mount and whenever filter changes.
  useEffect(() => {
    void fetchActivities(activeFilter, false);
  }, [activeFilter, fetchActivities]);

  function handleFilterChange(tab: FilterTab) {
    if (tab === activeFilter) { return; }
    setActiveFilter(tab);
  }

  function handleLoadMore() {
    void fetchActivities(activeFilter, true);
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <PageTitle>Activities</PageTitle>
        <SectionDescription className="mt-1">
          A complete timeline of all CRM interactions across leads, contacts, and deals.
        </SectionDescription>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border-strong pb-0">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleFilterChange(tab.key)}
            className={[
              'px-4 py-2 text-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px',
              activeFilter === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="bg-card border border-border-strong rounded-2xl px-6 py-2">
        {loading ? (
          // Skeleton
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : error ? (
          // Error state
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <RefreshCw size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => void fetchActivities(activeFilter, false)}
              className="text-xs text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : activities.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Activity size={32} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No activities recorded yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Activity will appear here as you interact with leads, contacts, and deals.
            </p>
          </div>
        ) : (
          // Timeline
          <div>
            {activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="py-4 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  className="px-5 py-2 text-sm font-medium bg-surface-elevated text-foreground rounded-lg border border-border-strong hover:bg-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
