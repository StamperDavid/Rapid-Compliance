'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { type Contact } from '@/types/contact';
import { PageTitle, SectionTitle } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { LogActivityModal } from '@/components/crm/LogActivityModal';
import ContactNextBestAction from '@/components/crm/ContactNextBestAction';
import { ContactActivitySummary } from '@/components/crm/ContactActivitySummary';
import { ContactDraftEmail } from '@/components/crm/ContactDraftEmail';

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

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const contactId = params.id as string;
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  const loadContact = useCallback(async () => {
    try {
      const res = await authFetch(`/api/contacts/${contactId}`);
      const json = (await res.json()) as { success?: boolean; contact?: Contact };
      if (json.success && json.contact) {
        setContact(json.contact);
      }
    } catch (error: unknown) {
      logger.error('Error loading contact:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [authFetch, contactId]);

  const loadActivities = useCallback(async () => {
    try {
      const res = await authFetch(`/api/crm/activities?entityType=contact&entityId=${contactId}&pageSize=25`);
      const json = (await res.json()) as { success?: boolean; data?: TimelineActivity[] };
      if (json.success && Array.isArray(json.data)) {
        setActivities(json.data);
      }
    } catch (error: unknown) {
      logger.error('Error loading activities:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  }, [authFetch, contactId]);

  useEffect(() => {
    void loadContact();
    void loadActivities();
  }, [loadContact, loadActivities]);

  if (loading || !contact) {return <div className="p-8">Loading...</div>;}

  const displayName = (contact.name ?? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()) || 'Unknown';
  const displayInitial = (contact.name ?? contact.firstName ?? 'U').charAt(0).toUpperCase();
  const displayPhone = contact.phone ?? contact.phoneNumber ?? '';

  return (
    <div className="p-8 space-y-6">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-primary hover:opacity-80 mb-4">← Back to Contacts</button>
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-3xl font-bold">{displayInitial}</div>
          <div className="flex-1">
            <PageTitle className="mb-2">{displayName}</PageTitle>
            {contact.title && <p className="text-lg text-muted-foreground mb-1">{contact.title}</p>}
            {contact.company && <p className="text-muted-foreground">{contact.company}</p>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-card rounded-lg p-6">
            <SectionTitle className="mb-4">Contact Details</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-sm text-muted-foreground mb-1">Email</div><div>{contact.email ?? '-'}</div></div>
              <div><div className="text-sm text-muted-foreground mb-1">Phone</div><div>{displayPhone || '-'}</div></div>
              <div><div className="text-sm text-muted-foreground mb-1">Mobile</div><div>{contact.mobile ?? '-'}</div></div>
              <div><div className="text-sm text-muted-foreground mb-1">LinkedIn</div><div>{contact.linkedIn ? <a href={contact.linkedIn} className="text-primary hover:opacity-80">View Profile</a> : '-'}</div></div>
            </div>
          </div>
          <div className="bg-card rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Activity Timeline</SectionTitle>
              <Button size="sm" onClick={() => setLogOpen(true)}>Log activity</Button>
            </div>
            <div className="mb-4">
              <ContactActivitySummary contactId={contactId} />
            </div>
            <div className="space-y-3">
              {activities.length === 0 ? (
                <div className="text-muted-foreground text-sm">No activity yet — log a call, meeting, or note to start the history.</div>
              ) : (
                activities.map((a) => {
                  const when = toActivityDate(a.occurredAt);
                  return (
                    <div key={a.id} className="bg-surface-elevated rounded p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{typeLabel(a.type)}</span>
                        {when && <span className="text-xs text-muted-foreground">{when.toLocaleString()}</span>}
                      </div>
                      {a.subject && <div className="mt-1.5 text-sm font-medium text-foreground">{a.subject}</div>}
                      {(a.body ?? a.summary) && <div className="mt-0.5 text-sm text-muted-foreground whitespace-pre-wrap">{a.body ?? a.summary}</div>}
                      {a.createdByName && <div className="mt-1 text-xs text-muted-foreground">by {a.createdByName}</div>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <ContactNextBestAction contactId={contactId} />
          <div className="bg-card rounded-lg p-6">
            <SectionTitle className="mb-4">Actions</SectionTitle>
            <div className="space-y-2">
              <Button className="w-full justify-start" onClick={() => setLogOpen(true)}>📝 Log activity</Button>
              <ContactDraftEmail contactId={contactId} contactEmail={contact.email} contactName={displayName} />
              <button
                onClick={() => {
                  const subject = `Getting in touch`;
                  window.location.href = `mailto:${contact.email ?? ''}?subject=${encodeURIComponent(subject)}`;
                }}
                className="w-full px-4 py-2 bg-surface-elevated text-muted-foreground rounded-lg hover:bg-border-light text-left"
              >
                ✉️ Send Email
              </button>
              <button
                onClick={() => router.push(`/calls/make?phone=${encodeURIComponent(displayPhone)}&contactId=${contactId}`)}
                className="w-full px-4 py-2 bg-surface-elevated text-muted-foreground rounded-lg hover:bg-border-light text-left"
              >
                📞 Make Call
              </button>
              <button
                onClick={() => router.push(`/contacts/${contactId}/edit`)}
                className="w-full px-4 py-2 bg-surface-elevated text-muted-foreground rounded-lg hover:bg-border-light text-left"
              >
                ✏️ Edit Contact
              </button>
            </div>
          </div>
        </div>
      </div>

      <LogActivityModal
        open={logOpen}
        onOpenChange={setLogOpen}
        relatedTo={{ entityType: 'contact', entityId: contactId, entityName: displayName }}
        onLogged={() => { void loadActivities(); }}
      />
    </div>
  );
}
