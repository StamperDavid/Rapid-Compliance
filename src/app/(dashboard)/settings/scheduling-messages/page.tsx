'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, Save, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { SchedulingMessages } from '@/lib/meetings/scheduling-messages-service';

type EditableField = keyof Omit<SchedulingMessages, 'updatedAt' | 'updatedBy'>;

interface FieldDef {
  key: EditableField;
  label: string;
  helper: string;
  multiline?: boolean;
  rows?: number;
}

const FIELDS: { sectionLabel: string; description: string; fields: FieldDef[] }[] = [
  {
    sectionLabel: 'Early-access success page',
    description: 'Shown when a prospect submits the early-access form on the public site.',
    fields: [
      { key: 'earlyAccessSuccessTitle', label: 'Headline', helper: 'Top of the success card.' },
      { key: 'earlyAccessSuccessBody', label: 'Body', helper: 'Sub-text under the headline.', multiline: true, rows: 3 },
    ],
  },
  {
    sectionLabel: 'Demo confirmation email',
    description: 'Sent automatically when a prospect books a demo via /early-access.',
    fields: [
      { key: 'demoConfirmationEmailSubject', label: 'Subject', helper: 'Variables: {firstName} {fullName} {meetingDate} {meetingTime} {duration}.' },
      { key: 'demoConfirmationEmailBody', label: 'Body (HTML)', helper: 'You can use HTML. Variables: {firstName} {fullName} {meetingDate} {meetingTime} {duration} {zoomLink} {orgName}.', multiline: true, rows: 10 },
    ],
  },
  {
    sectionLabel: 'Zoom meeting metadata',
    description: 'How the booked meeting appears in Zoom itself.',
    fields: [
      { key: 'zoomMeetingTopic', label: 'Meeting topic', helper: 'Shown as the Zoom meeting name. Variables: {firstName} {fullName} {orgName}.' },
      { key: 'zoomMeetingAgenda', label: 'Agenda / description', helper: 'Internal description on the Zoom side.', multiline: true, rows: 3 },
    ],
  },
  {
    sectionLabel: 'Reminder — 24 hours before',
    description: 'Sent automatically by the reminder cron one day before the meeting.',
    fields: [
      { key: 'reminder24hSubject', label: 'Subject', helper: 'Variables: {firstName} {meetingDate} {meetingTime}.' },
      { key: 'reminder24hBody', label: 'Body', helper: 'Plain text. Variables: {firstName} {meetingDate} {meetingTime} {zoomLink}.', multiline: true, rows: 6 },
    ],
  },
  {
    sectionLabel: 'Reminder — 1 hour before',
    description: 'Sent automatically by the reminder cron one hour before the meeting.',
    fields: [
      { key: 'reminder1hSubject', label: 'Subject', helper: 'Variables: {firstName} {meetingTime}.' },
      { key: 'reminder1hBody', label: 'Body', helper: 'Plain text. Variables: {firstName} {meetingTime} {zoomLink}.', multiline: true, rows: 6 },
    ],
  },
];

export default function SchedulingMessagesPage() {
  const authFetch = useAuthFetch();
  const [messages, setMessages] = useState<SchedulingMessages | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await authFetch('/api/settings/scheduling-messages');
        if (res.ok) {
          const data = (await res.json()) as { success: boolean; messages: SchedulingMessages };
          if (data.success && data.messages) {
            setMessages(data.messages);
          }
        }
      } catch {
        // Defaults will be returned by the API when no doc exists; if the
        // call itself fails we render an error rather than a blank form.
        setError('Could not load messages. Refresh to try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch]);

  const updateField = (key: EditableField, value: string): void => {
    setMessages((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    if (!messages) { return; }
    setSaving(true);
    setSaved(false);
    setError(null);

    const body: Record<string, string> = {};
    for (const section of FIELDS) {
      for (const field of section.fields) {
        body[field.key] = messages[field.key];
      }
    }

    try {
      const res = await authFetch('/api/settings/scheduling-messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { success: boolean; error?: string; messages?: SchedulingMessages };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to save');
      }
      if (data.messages) { setMessages(data.messages); }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [authFetch, messages]);

  if (loading || !messages) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading messages…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-7 h-7 text-primary" />
            <PageTitle>Scheduling Messages</PageTitle>
          </div>
          <SectionDescription>
            Edit every operator-facing message tied to scheduling — the
            early-access success copy, the demo confirmation email, Zoom
            meeting metadata, and the 24h + 1h reminder emails. Use{' '}
            <code className="text-xs px-1 py-0.5 rounded bg-surface-elevated">{'{variableName}'}</code>{' '}
            for substitution. Changes apply to the next send.
          </SectionDescription>
        </div>
        <Button onClick={() => { void handleSave(); }} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : saved ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Saved
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save changes
            </>
          )}
        </Button>
      </div>

      {error ? (
        <div className="p-4 rounded-md border border-destructive/50 bg-destructive/10 text-destructive-foreground text-sm">
          {error}
        </div>
      ) : null}

      {FIELDS.map((section) => (
        <Card key={section.sectionLabel}>
          <CardHeader>
            <CardTitle>{section.sectionLabel}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {section.fields.map((field) => (
              <div key={field.key}>
                <label htmlFor={field.key} className="block text-sm font-medium text-foreground mb-1">
                  {field.label}
                </label>
                <Caption className="block mb-2">{field.helper}</Caption>
                {field.multiline ? (
                  <textarea
                    id={field.key}
                    rows={field.rows ?? 4}
                    value={messages[field.key]}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                ) : (
                  <Input
                    id={field.key}
                    value={messages[field.key]}
                    onChange={(e) => updateField(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
