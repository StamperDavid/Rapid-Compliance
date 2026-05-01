'use client';

/**
 * Meetings Hub — list, cancel, delete bookings (Zoom + scheduled meetings)
 *
 * Top-level nav entry as of Apr 30 2026 (owner-explicit override of the
 * no-sprawl default). Lists bookings from the `bookings` Firestore subcollection.
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CalendarClock, Video, Trash2, X, RefreshCw, Plus, ExternalLink } from 'lucide-react';
import { PageTitle, SectionDescription, Caption } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';

interface Meeting {
  id: string;
  date?: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  status?: string;
  zoomJoinUrl?: string;
  zoomMeetingId?: string;
  meetingProvider?: string;
  createdAt?: string | { toDate?: () => Date };
  cancelledAt?: string;
}

interface ListResponse {
  success: boolean;
  meetings?: Meeting[];
  error?: string;
}

function formatWhen(m: Meeting): string {
  const start = m.startTime ?? `${m.date ?? ''} ${m.time ?? ''}`.trim();
  if (!start) {return 'Time TBD';}
  try {
    const d = new Date(start);
    if (Number.isNaN(d.getTime())) {return start;}
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return start;
  }
}

function statusPill(status: string | undefined): { label: string; className: string } {
  const s = (status ?? 'scheduled').toLowerCase();
  if (s === 'cancelled') {return { label: 'Cancelled', className: 'bg-error/10 text-error border-error/30' };}
  if (s === 'completed') {return { label: 'Completed', className: 'bg-muted text-muted-foreground border-border' };}
  if (s === 'pending') {return { label: 'Pending', className: 'bg-warning/10 text-warning border-warning/30' };}
  return { label: 'Scheduled', className: 'bg-success/10 text-success border-success/30' };
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Two-step destructive confirmation per project rule.
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/meetings/list', { method: 'GET' });
      const data = (await res.json()) as ListResponse;
      if (!data.success) {
        throw new Error(data.error ?? 'Failed to load meetings');
      }
      setMeetings(data.meetings ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-disarm any armed two-step confirmation after 5 seconds.
  useEffect(() => {
    if (!confirmCancel && !confirmDelete) {return;}
    const t = setTimeout(() => {
      setConfirmCancel(null);
      setConfirmDelete(null);
    }, 5000);
    return () => { clearTimeout(t); };
  }, [confirmCancel, confirmDelete]);

  const handleCancel = useCallback(async (id: string) => {
    if (confirmCancel !== id) {
      setConfirmCancel(id);
      setConfirmDelete(null);
      return;
    }
    setPendingId(id);
    try {
      const res = await fetch(`/api/meetings/${id}/cancel`, { method: 'POST' });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!data.success) {throw new Error(data.error ?? 'Cancel failed');}
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setConfirmCancel(null);
      setPendingId(null);
    }
  }, [confirmCancel, load]);

  const handleDelete = useCallback(async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setConfirmCancel(null);
      return;
    }
    setPendingId(id);
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!data.success) {throw new Error(data.error ?? 'Delete failed');}
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setConfirmDelete(null);
      setPendingId(null);
    }
  }, [confirmDelete, load]);

  const upcoming = meetings.filter(m => (m.status ?? 'scheduled').toLowerCase() === 'scheduled');
  const other = meetings.filter(m => (m.status ?? 'scheduled').toLowerCase() !== 'scheduled');

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle>Meetings</PageTitle>
          <SectionDescription>
            Manage all your scheduled bookings — Zoom meetings, demos, calls. Cancel or remove any meeting from one place.
          </SectionDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { void load(); }} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition"
            target="_blank"
          >
            <Plus className="w-4 h-4" />
            Schedule Meeting
            <ExternalLink className="w-3 h-3 opacity-70" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-error/10 border border-error/30 rounded-lg text-sm text-error">
          {error}
        </div>
      )}

      {/* Upcoming */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-info" />
          Upcoming ({upcoming.length})
        </h2>
        {loading && upcoming.length === 0 ? (
          <div className="bg-card border border-border-strong rounded-2xl p-8 text-center text-muted-foreground">
            Loading meetings…
          </div>
        ) : upcoming.length === 0 ? (
          <div className="bg-card border border-border-strong rounded-2xl p-8 text-center">
            <Caption>No upcoming meetings. Schedule one above.</Caption>
          </div>
        ) : (
          <div className="bg-card border border-border-strong rounded-2xl divide-y divide-border-strong">
            {upcoming.map(m => (
              <MeetingRow
                key={m.id}
                m={m}
                pendingId={pendingId}
                confirmCancel={confirmCancel}
                confirmDelete={confirmDelete}
                onCancel={(id) => { void handleCancel(id); }}
                onDelete={(id) => { void handleDelete(id); }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Past / Cancelled */}
      {other.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Past & Cancelled ({other.length})
          </h2>
          <div className="bg-card border border-border-strong rounded-2xl divide-y divide-border-strong">
            {other.map(m => (
              <MeetingRow
                key={m.id}
                m={m}
                pendingId={pendingId}
                confirmCancel={confirmCancel}
                confirmDelete={confirmDelete}
                onCancel={(id) => { void handleCancel(id); }}
                onDelete={(id) => { void handleDelete(id); }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface MeetingRowProps {
  m: Meeting;
  pendingId: string | null;
  confirmCancel: string | null;
  confirmDelete: string | null;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

function MeetingRow({ m, pendingId, confirmCancel, confirmDelete, onCancel, onDelete }: MeetingRowProps) {
  const pill = statusPill(m.status);
  const isCancelled = (m.status ?? '').toLowerCase() === 'cancelled';
  const isPending = pendingId === m.id;
  const isCancelArmed = confirmCancel === m.id;
  const isDeleteArmed = confirmDelete === m.id;

  return (
    <div className="p-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="font-semibold text-foreground truncate">{m.name ?? 'Unknown attendee'}</span>
          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${pill.className}`}>
            {pill.label}
          </span>
          {m.zoomJoinUrl && (
            <a
              href={m.zoomJoinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-info hover:underline"
            >
              <Video className="w-3.5 h-3.5" />
              Zoom
            </a>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {formatWhen(m)} {m.duration ? `· ${m.duration} min` : ''} {m.email ? `· ${m.email}` : ''}
        </div>
        {m.notes && (
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {m.notes}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {!isCancelled && (
          isCancelArmed ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { onCancel(m.id); }}
                disabled={isPending}
              >
                {isPending ? 'Cancelling…' : 'Click again to confirm'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { onCancel(''); }}>
                Keep it
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { onCancel(m.id); }}
              disabled={isPending}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          )
        )}
        {isDeleteArmed ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { onDelete(m.id); }}
              disabled={isPending}
            >
              {isPending ? 'Deleting…' : 'Click again to confirm'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { onDelete(''); }}>
              Keep it
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onDelete(m.id); }}
            disabled={isPending}
            className="text-error hover:bg-error/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
