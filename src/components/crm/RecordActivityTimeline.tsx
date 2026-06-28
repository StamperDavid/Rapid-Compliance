'use client';

/**
 * RecordActivityTimeline — the reusable CRM activity timeline + "Log activity" action for any
 * record detail page (contact, lead, deal, company). It fetches that record's activities from the
 * real Admin-SDK API (GET /api/crm/activities), renders them newest-first, and opens
 * LogActivityModal pre-targeted at the record (no entity picker), refreshing the timeline on log.
 *
 * This is the single home for the timeline logic that previously lived inline on the contact page —
 * deal and company pages reuse it instead of duplicating the fetch/date/label/render code.
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { SectionTitle } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { LogActivityModal, type LogActivityRelatedTo } from '@/components/crm/LogActivityModal';

/** Minimal shape of an activity row as the GET /api/crm/activities endpoint returns it. */
interface TimelineActivity {
  id: string;
  type: string;
  subject?: string;
  body?: string;
  summary?: string;
  occurredAt?: unknown;
  createdByName?: string;
}

/** Friendly label for an activity type (falls back to the prettified raw type). */
const TYPE_LABELS: Record<string, string> = {
  note_added: 'Note',
  call_made: 'Call',
  call_received: 'Call',
  meeting_completed: 'Meeting',
  meeting_scheduled: 'Meeting',
  meeting_no_show: 'Meeting',
  email_sent: 'Email',
  email_received: 'Email',
  task_created: 'Task',
  task_completed: 'Task',
  sms_sent: 'SMS',
  sms_received: 'SMS',
  ai_chat: 'AI Chat',
  form_submitted: 'Form',
};
function typeLabel(t: string): string {
  return TYPE_LABELS[t] ?? t.replace(/_/g, ' ');
}

/** Defensively coerce the serialized occurredAt (ISO string / number / Firestore Timestamp) to a Date. */
function toActivityDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const secs =
      typeof obj._seconds === 'number'
        ? obj._seconds
        : typeof obj.seconds === 'number'
          ? obj.seconds
          : null;
    if (secs !== null) {
      return new Date(secs * 1000);
    }
  }
  return null;
}

interface RecordActivityTimelineProps {
  /** The kind of record this timeline belongs to. */
  entityType: 'deal' | 'company' | 'contact' | 'lead';
  /** The record's id. */
  entityId: string;
  /** Optional display name, shown in the Log activity modal header. */
  entityName?: string;
  /** Optional content rendered between the header and the activity list (e.g. an AI summary). */
  topSlot?: React.ReactNode;
}

export function RecordActivityTimeline({
  entityType,
  entityId,
  entityName,
  topSlot,
}: RecordActivityTimelineProps): React.JSX.Element {
  const authFetch = useAuthFetch();
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const loadActivities = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch(
        `/api/crm/activities?entityType=${entityType}&entityId=${entityId}&pageSize=25`,
      );
      const json = (await res.json()) as { success?: boolean; data?: TimelineActivity[]; error?: string };
      if (json.success && Array.isArray(json.data)) {
        setActivities(json.data);
      } else {
        throw new Error(json.error ?? 'Could not load activity.');
      }
    } catch (e) {
      logger.error(
        'Error loading activities:',
        e instanceof Error ? e : new Error(String(e)),
        { file: 'RecordActivityTimeline.tsx' },
      );
      setError("We couldn't load the activity history. Please refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, entityType, entityId]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const relatedTo: LogActivityRelatedTo = { entityType, entityId, entityName };

  return (
    <div className="bg-card rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>Activity Timeline</SectionTitle>
        <Button size="sm" onClick={() => setLogOpen(true)}>Log activity</Button>
      </div>

      {topSlot && <div className="mb-4">{topSlot}</div>}

      <div className="space-y-3">
        {loading ? (
          <div className="text-muted-foreground text-sm">Loading activity…</div>
        ) : error ? (
          <div className="text-destructive text-sm">{error}</div>
        ) : activities.length === 0 ? (
          <div className="text-muted-foreground text-sm">
            No activity yet — log a call, meeting, or note to start the history.
          </div>
        ) : (
          activities.map((a) => {
            const when = toActivityDate(a.occurredAt);
            return (
              <div key={a.id} className="bg-surface-elevated rounded p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {typeLabel(a.type)}
                  </span>
                  {when && <span className="text-xs text-muted-foreground">{when.toLocaleString()}</span>}
                </div>
                {a.subject && <div className="mt-1.5 text-sm font-medium text-foreground">{a.subject}</div>}
                {(a.body ?? a.summary) && (
                  <div className="mt-0.5 text-sm text-muted-foreground whitespace-pre-wrap">{a.body ?? a.summary}</div>
                )}
                {a.createdByName && <div className="mt-1 text-xs text-muted-foreground">by {a.createdByName}</div>}
              </div>
            );
          })
        )}
      </div>

      <LogActivityModal
        open={logOpen}
        onOpenChange={setLogOpen}
        relatedTo={relatedTo}
        onLogged={() => { void loadActivities(); }}
      />
    </div>
  );
}
