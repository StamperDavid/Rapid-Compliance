'use client';

/**
 * Log Activity modal — the manual "log a call / meeting / note / email / task" action that
 * CRM operators expect (Pipedrive/HubSpot/Reevo table-stakes). The backend + 25 activity
 * types already existed; only this UI was missing. Posts to POST /api/crm/activities (the
 * real Admin-SDK path) and calls onLogged so the caller refreshes its timeline.
 *
 * Reusable: pass `relatedTo` (the record this activity is about) — a contact today, a deal
 * tomorrow — so no entity picker is needed when invoked from a record page.
 */

import { useState, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export type LogActivityRelatedTo = {
  entityType: 'lead' | 'contact' | 'company' | 'deal' | 'opportunity';
  entityId: string;
  entityName?: string;
};

interface LogActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatedTo: LogActivityRelatedTo;
  /** Called after a successful log so the caller can refresh its timeline. */
  onLogged?: () => void;
}

/** Friendly label → the activity-service enum type it maps to. */
const ACTIVITY_TYPES = [
  { value: 'note_added', label: 'Note' },
  { value: 'call_made', label: 'Call' },
  { value: 'meeting_completed', label: 'Meeting' },
  { value: 'email_sent', label: 'Email' },
  { value: 'task_created', label: 'Task' },
] as const;

/** Local datetime string (YYYY-MM-DDTHH:mm) for a datetime-local input, defaulting to now. */
function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LogActivityModal({
  open,
  onOpenChange,
  relatedTo,
  onLogged,
}: LogActivityModalProps): React.JSX.Element {
  const authFetch = useAuthFetch();
  const [type, setType] = useState<string>('note_added');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [occurredAt, setOccurredAt] = useState<string>(nowLocalInput());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setType('note_added');
    setSubject('');
    setBody('');
    setOccurredAt(nowLocalInput());
    setError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/api/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          subject: subject.trim() || undefined,
          body: body.trim() || undefined,
          relatedTo: [relatedTo],
          occurredAt: new Date(occurredAt).toISOString(),
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Could not log the activity. Please try again.');
      }
      reset();
      onOpenChange(false);
      onLogged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log the activity. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [authFetch, type, subject, body, occurredAt, relatedTo, onLogged, onOpenChange, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Log activity{relatedTo.entityName ? ` — ${relatedTo.entityName}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1 block">Type</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border border-border-strong bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="mb-1 block">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Intro call"
            />
          </div>

          <div>
            <Label className="mb-1 block">Notes</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="What happened…"
            />
          </div>

          <div>
            <Label className="mb-1 block">When</Label>
            <Input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Logging…' : 'Log activity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
