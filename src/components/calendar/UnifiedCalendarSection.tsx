'use client';

/**
 * UnifiedCalendarSection
 *
 * Embeddable dashboard section that renders the unified calendar timeline
 * (meetings + demos + Google Calendar + scheduled posts + CRM activity)
 * along with source filter chips and the side detail panel.
 *
 * This is the chunk previously found at /calendar; we lifted it out so it
 * could be mounted directly on /dashboard per the owner's request that
 * the calendar live ON the dashboard, not on its own top-level page.
 *
 * The month-view day headers each carry an "Hours" link that opens an
 * <AvailabilityPopout> scoped to that day — replaces the deleted
 * /settings/meeting-scheduler page with a contextual edit affordance.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  Video,
  Loader2,
  Plus,
  Copy,
  Mic,
  FileText,
  Users as UsersIcon,
  X as XIcon,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import { SectionTitle, SectionDescription } from '@/components/ui/typography';
import AvailabilityPopout from '@/components/calendar/AvailabilityPopout';
import type {
  UnifiedCalendarEvent,
  CalendarEventSource,
} from '@/components/calendar/UnifiedCalendar';

const UnifiedCalendar = dynamic(() => import('@/components/calendar/UnifiedCalendar'), {
  ssr: false,
  loading: () => (
    <div className="bg-card border border-border-strong rounded-2xl p-12 text-center text-muted-foreground">
      Loading calendar…
    </div>
  ),
});

interface SourceChipDef {
  source: CalendarEventSource;
  label: string;
  dot: string; // tailwind bg color class for the legend dot
}

const SOURCE_CHIPS: SourceChipDef[] = [
  { source: 'meeting',     label: 'Meetings',  dot: 'bg-indigo-500' },
  { source: 'booking',     label: 'Demos',     dot: 'bg-purple-500' },
  { source: 'gcal',        label: 'Calendar',  dot: 'bg-blue-500' },
  { source: 'social_post', label: 'Posts',     dot: 'bg-emerald-500' },
  { source: 'activity',    label: 'Activity',  dot: 'bg-gray-500' },
];

interface EventsApiResponse {
  success: boolean;
  events?: UnifiedCalendarEvent[];
  error?: string;
}

export default function UnifiedCalendarSection() {
  const authFetch = useAuthFetch();
  const [events, setEvents] = useState<UnifiedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UnifiedCalendarEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [keyword, setKeyword] = useState('');
  const [enabledSources, setEnabledSources] = useState<Set<CalendarEventSource>>(
    new Set<CalendarEventSource>(['meeting', 'booking', 'gcal', 'social_post', 'activity']),
  );
  const [popoutDate, setPopoutDate] = useState<Date | null>(null);
  const [popoutOpen, setPopoutOpen] = useState(false);
  const [rescheduleEvent, setRescheduleEvent] = useState<UnifiedCalendarEvent | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 60);
      const to = new Date();
      to.setDate(to.getDate() + 90);
      const res = await authFetch(
        `/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`,
      );
      const data = (await res.json()) as EventsApiResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to load calendar events');
      }
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const toggleSource = (source: CalendarEventSource) => {
    setEnabledSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  const counts = events.reduce<Record<CalendarEventSource, number>>(
    (acc, e) => {
      acc[e.source] = (acc[e.source] ?? 0) + 1;
      return acc;
    },
    { meeting: 0, booking: 0, gcal: 0, social_post: 0, activity: 0 },
  );

  const handleOpenPopoutForDate = useCallback((date: Date) => {
    setPopoutDate(date);
    setPopoutOpen(true);
  }, []);

  // Custom month-view date header — adds the per-day "Hours" link the
  // owner asked for. react-big-calendar passes `{ date, label }` to this
  // component for every day cell in the month grid.
  const calendarComponents = useMemo(() => {
    const DateHeader = ({ date, label }: { date: Date; label: string }) => (
      <div className="flex items-center justify-between gap-1 w-full">
        <span>{label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenPopoutForDate(date);
          }}
          className="inline-flex items-center gap-1 text-[0.6rem] text-muted-foreground hover:text-primary transition-colors"
          title="Edit hours for this day"
          aria-label={`Edit hours for ${date.toDateString()}`}
        >
          <Clock className="w-3 h-3" />
          <span>Hours</span>
        </button>
      </div>
    );
    DateHeader.displayName = 'UnifiedCalendarDateHeader';
    return { month: { dateHeader: DateHeader } };
  }, [handleOpenPopoutForDate]);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <SectionTitle>Calendar</SectionTitle>
          </div>
          <SectionDescription>
            Everything in one place — meetings, demos, scheduled posts, CRM
            activity, and your Google Calendar. Click an event for detail, or
            click <strong>Hours</strong> on any day in the month view to edit
            availability.
          </SectionDescription>
        </div>
        <Button variant="outline" onClick={() => { void fetchEvents(); }} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="p-4 rounded-md border border-destructive/50 bg-destructive/10 text-destructive-foreground text-sm">
          {error}
        </div>
      ) : null}

      {/* Filter row — category chips + keyword search */}
      <div className="flex flex-wrap items-center gap-2">
        {SOURCE_CHIPS.map((chip) => {
          const enabled = enabledSources.has(chip.source);
          return (
            <button
              key={chip.source}
              type="button"
              onClick={() => toggleSource(chip.source)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition ${
                enabled
                  ? 'bg-card border-border-strong text-foreground'
                  : 'bg-transparent border-border-light text-muted-foreground hover:bg-card'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${chip.dot} ${enabled ? '' : 'opacity-40'}`} />
              <span>{chip.label}</span>
              <span className="text-xs text-muted-foreground">{counts[chip.source]}</span>
            </button>
          );
        })}
        <div className="flex-1 min-w-[200px] max-w-md ml-auto relative">
          <input
            type="search"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); }}
            placeholder="Search title, attendee, notes…"
            className="w-full bg-card border border-border-light rounded-full pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
          />
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />
          </svg>
        </div>
      </div>

      {/* Calendar (1/2) + right column (1/2 — event detail + meetings panel stacked) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <UnifiedCalendar
            events={events.filter(e => keyword.trim() === '' || matchesKeyword(e, keyword))}
            enabledSources={enabledSources}
            // Clicking either an event or an empty day cell drops you into
            // the Day Overview in the right panel. From there, click a
            // specific event to drill into its detail.
            onSelectEvent={(ev) => { setSelectedDay(new Date(ev.start)); setSelected(null); }}
            onSelectDay={(d) => { setSelectedDay(d); setSelected(null); }}
            components={calendarComponents}
          />
        </div>

        {/* Right column — pinned to the same rendered height as the
            calendar wrapper (Calendar inner = 720, plus p-4 + border on the
            wrapper). Event detail is a short fixed band on top; meetings
            panel fills the rest. Both panels scroll internally so neither
            grows the page. */}
        <div className="grid grid-rows-[220px_1fr] gap-6 lg:h-[752px]">
          <aside className="bg-card border border-border-strong rounded-2xl p-6 overflow-y-auto">
            {selected ? (
              <EventDetail
                event={selected}
                onClose={() => { setSelected(null); }}
                onBack={selectedDay ? () => { setSelected(null); } : undefined}
                onAfterAction={() => { void fetchEvents(); }}
                onRequestReschedule={(ev) => {
                  setRescheduleEvent(ev);
                  setRescheduleOpen(true);
                }}
              />
            ) : selectedDay ? (
              <DayDetail
                day={selectedDay}
                events={events.filter(e =>
                  enabledSources.has(e.source) &&
                  (keyword.trim() === '' || matchesKeyword(e, keyword)) &&
                  isSameDay(new Date(e.start), selectedDay),
                )}
                onSelectEvent={(ev) => { setSelected(ev); }}
                onClose={() => { setSelectedDay(null); }}
              />
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                Click a day or event to see details.
              </div>
            )}
          </aside>

          <MeetingsPanel />
        </div>
      </div>

      <AvailabilityPopout
        open={popoutOpen}
        onOpenChange={setPopoutOpen}
        date={popoutDate}
      />

      <RescheduleDialog
        event={rescheduleEvent}
        open={rescheduleOpen}
        onOpenChange={(o) => {
          setRescheduleOpen(o);
          if (!o) { setRescheduleEvent(null); }
        }}
        onRescheduled={() => {
          setSelected(null);
          void fetchEvents();
        }}
      />
    </section>
  );
}

// ============================================================================
// Helpers — keyword search + same-day check
// ============================================================================

function matchesKeyword(e: UnifiedCalendarEvent, q: string): boolean {
  const needle = q.toLowerCase().trim();
  if (!needle) {return true;}
  if (e.title?.toLowerCase().includes(needle)) {return true;}
  if (e.badge?.toLowerCase().includes(needle)) {return true;}
  if (e.attendees?.some(a => a.toLowerCase().includes(needle))) {return true;}
  return false;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

// ============================================================================
// DayDetail — list of events on a clicked date
// ============================================================================

interface DayDetailProps {
  day: Date;
  events: UnifiedCalendarEvent[];
  onSelectEvent: (e: UnifiedCalendarEvent) => void;
  onClose: () => void;
}

const DAY_SOURCE_DOT: Record<CalendarEventSource, string> = {
  meeting: 'bg-indigo-500',
  booking: 'bg-purple-500',
  gcal: 'bg-blue-500',
  social_post: 'bg-emerald-500',
  activity: 'bg-gray-500',
};

function DayDetail({ day, events, onSelectEvent, onClose }: DayDetailProps) {
  const dateLabel = day.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Sort by start time within the day
  const sorted = [...events].sort((a, b) => {
    const ta = new Date(a.start).getTime();
    const tb = new Date(b.start).getTime();
    return ta - tb;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Day overview
          </div>
          <h3 className="text-lg font-semibold text-foreground leading-tight">
            {dateLabel}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {sorted.length === 0
              ? 'Nothing on the calendar for this day.'
              : `${sorted.length} ${sorted.length === 1 ? 'event' : 'events'} — pick one for details.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm"
          aria-label="Close day overview"
        >
          ✕
        </button>
      </div>

      {sorted.length > 0 && (
        <ul className="space-y-2">
          {sorted.map((e) => {
            const start = new Date(e.start);
            const end = new Date(e.end || e.start);
            const sameInstant = start.getTime() === end.getTime();
            const timeLabel = sameInstant
              ? start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
              : `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => { onSelectEvent(e); }}
                  className="w-full text-left bg-surface-elevated/40 hover:bg-surface-elevated border border-border-light hover:border-border-strong rounded-lg p-3 transition"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${DAY_SOURCE_DOT[e.source]}`} />
                    {e.badge ? (
                      <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wide rounded bg-surface-elevated text-muted-foreground">
                        {e.badge}
                      </span>
                    ) : null}
                    <span className="text-sm font-medium text-foreground truncate flex-1">
                      {e.title}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{timeLabel}</div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface EventDetailProps {
  event: UnifiedCalendarEvent;
  onClose: () => void;
  onBack?: () => void;
  onAfterAction?: () => void;
  onRequestReschedule?: (event: UnifiedCalendarEvent) => void;
}

function EventDetail({ event, onClose, onBack, onAfterAction, onRequestReschedule }: EventDetailProps) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const sameInstant = start.getTime() === end.getTime();
  const dateLabel = start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeLabel = sameInstant
    ? start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;

  const isManageable = event.source === 'meeting' || event.source === 'booking';
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Auto-disarm cancel confirm after 5s — matches the destructive-actions
  // two-step pattern used elsewhere in the platform.
  useEffect(() => {
    if (!confirmCancel) {return;}
    const t = setTimeout(() => { setConfirmCancel(false); }, 5000);
    return () => { clearTimeout(t); };
  }, [confirmCancel]);

  const handleCancelClick = async () => {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    setPending(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/meetings/${event.sourceId}/cancel`, { method: 'POST' });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!data.success) {throw new Error(data.error ?? 'Cancel failed');}
      setConfirmCancel(false);
      if (onAfterAction) {onAfterAction();}
      onClose();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          ← Back to day overview
        </button>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          {event.badge ? (
            <span className="inline-block px-2 py-0.5 text-xs rounded-md bg-surface-elevated text-muted-foreground mb-2">
              {event.badge}
            </span>
          ) : null}
          <h3 className="text-lg font-semibold text-foreground leading-tight">{event.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm"
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>

      <div className="text-sm text-foreground">
        <div>{dateLabel}</div>
        <div className="text-muted-foreground">{timeLabel}</div>
      </div>

      {event.attendees && event.attendees.length > 0 ? (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Attendees</div>
          <ul className="text-sm text-foreground space-y-1">
            {event.attendees.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      ) : null}

      {event.meetingLink ? (
        <a
          href={event.meetingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Video className="w-4 h-4" />
          Join meeting
        </a>
      ) : null}

      {event.detailHref ? (
        <a
          href={event.detailHref}
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ExternalLink className="w-4 h-4" />
          Open in source
        </a>
      ) : null}

      {isManageable ? (
        <div className="pt-3 border-t border-border-light space-y-2">
          {actionError ? (
            <div className="text-xs text-destructive-foreground bg-destructive/10 border border-destructive/30 rounded px-2 py-1">
              {actionError}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { onRequestReschedule?.(event); }}
              disabled={pending}
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Reschedule
            </Button>
            {confirmCancel ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { void handleCancelClick(); }}
                  disabled={pending}
                >
                  {pending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <XIcon className="w-3.5 h-3.5 mr-1.5" />}
                  {pending ? 'Cancelling…' : 'Click again to confirm'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setConfirmCancel(false); }}
                  disabled={pending}
                >
                  Keep it
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { void handleCancelClick(); }}
                disabled={pending}
              >
                <XIcon className="w-3.5 h-3.5 mr-1.5" />
                Cancel meeting
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// RescheduleDialog — date + time picker for moving an existing meeting.
// Hits PATCH /api/meetings/[id] with the new startTime; the API recreates
// the Zoom meeting at the new time and updates Firestore.
// ============================================================================

interface RescheduleDialogProps {
  event: UnifiedCalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRescheduled: () => void;
}

function toLocalInputValue(d: Date): string {
  // datetime-local needs YYYY-MM-DDTHH:mm in local time, no timezone suffix
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function RescheduleDialog({ event, open, onOpenChange, onRescheduled }: RescheduleDialogProps) {
  const [startValue, setStartValue] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) {return;}
    setStartValue(toLocalInputValue(new Date(event.start)));
    const ms = new Date(event.end).getTime() - new Date(event.start).getTime();
    const mins = Math.max(15, Math.round(ms / 60000));
    setDuration(mins > 0 ? mins : 30);
    setError(null);
  }, [event]);

  const handleSubmit = async () => {
    if (!event) {return;}
    if (!startValue) {
      setError('Pick a new date and time');
      return;
    }
    const newStart = new Date(startValue);
    if (Number.isNaN(newStart.getTime())) {
      setError('Invalid date/time');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${event.sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: newStart.toISOString(), duration }),
      });
      const data = (await res.json()) as { success: boolean; error?: string; zoomWarning?: string | null };
      if (!data.success) {throw new Error(data.error ?? 'Reschedule failed');}
      if (data.zoomWarning) {
        setError(`Saved, but Zoom update failed: ${data.zoomWarning}`);
      } else {
        onRescheduled();
        onOpenChange(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reschedule failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule meeting</DialogTitle>
          <DialogDescription>
            Pick a new date and time. The Zoom meeting will be cancelled and a fresh
            link will be issued for the new slot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {event ? (
            <div className="text-sm text-muted-foreground bg-surface-elevated/40 rounded p-3 border border-border-light">
              <div className="font-medium text-foreground">{event.title}</div>
              <div className="text-xs">
                Currently {new Date(event.start).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          ) : null}

          <div>
            <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
              New date &amp; time
            </label>
            <input
              type="datetime-local"
              value={startValue}
              onChange={(e) => { setStartValue(e.target.value); }}
              className="w-full bg-card border border-border-light rounded-md px-3 py-2 text-sm focus:border-border-strong focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              min={15}
              max={480}
              step={15}
              value={duration}
              onChange={(e) => { setDuration(parseInt(e.target.value, 10) || 30); }}
              className="w-full bg-card border border-border-light rounded-md px-3 py-2 text-sm focus:border-border-strong focus:outline-none"
            />
          </div>

          {error ? (
            <div className="text-xs text-destructive-foreground bg-destructive/10 border border-destructive/30 rounded px-2 py-1">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { onOpenChange(false); }} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={() => { void handleSubmit(); }} disabled={pending}>
              {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {pending ? 'Saving…' : 'Save new time'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MeetingsPanel — embedded under the event-detail aside on the dashboard
// calendar. Lists the org's upcoming bookings with cancel/delete actions
// and a Zoom-join shortcut. Cancel hits both Firestore (status flip) and
// the Zoom API (best effort) via /api/meetings/[id]/cancel. Two-step
// destructive confirmation per project rule, 5s auto-disarm.
// ============================================================================

interface MeetingRecord {
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
  zoomPassword?: string;
  zoomStartUrl?: string;
  meetingProvider?: string;
}

function formatMeetingTime(m: MeetingRecord): string {
  const start = m.startTime ?? `${m.date ?? ''} ${m.time ?? ''}`.trim();
  if (!start) {return 'Time TBD';}
  try {
    const d = new Date(start);
    if (Number.isNaN(d.getTime())) {return start;}
    return d.toLocaleString(undefined, {
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

function MeetingsPanel() {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMeeting, setOpenMeeting] = useState<MeetingRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/meetings/list', { method: 'GET' });
      const data = (await res.json()) as { success: boolean; meetings?: MeetingRecord[]; error?: string };
      if (!data.success) {throw new Error(data.error ?? 'Failed to load');}
      setMeetings(data.meetings ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const upcoming = useMemo(
    () => meetings.filter(m => (m.status ?? 'scheduled').toLowerCase() === 'scheduled'),
    [meetings],
  );

  const metrics = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const epoch = (m: MeetingRecord): number => {
      const s = m.startTime ?? `${m.date ?? ''}T${m.time ?? ''}`;
      const t = Date.parse(s);
      return Number.isNaN(t) ? 0 : t;
    };

    let thisWeek = 0;
    let thisMonth = 0;
    let cancelled = 0;
    let totalDuration = 0;
    let durationCount = 0;
    const recordingsCount = 0;

    for (const m of meetings) {
      const t = epoch(m);
      if (t === 0) {continue;}
      const status = (m.status ?? 'scheduled').toLowerCase();
      if (status === 'cancelled') {cancelled += 1; continue;}
      if (t >= startOfWeek.getTime() && t < endOfWeek.getTime()) {thisWeek += 1;}
      if (t >= startOfMonth.getTime() && t < endOfMonth.getTime()) {thisMonth += 1;}
      if (typeof m.duration === 'number' && m.duration > 0) {
        totalDuration += m.duration;
        durationCount += 1;
      }
    }

    const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

    return { thisWeek, thisMonth, cancelled, avgDuration, recordingsCount };
  }, [meetings]);

  const past = useMemo(
    () => meetings.filter(m => (m.status ?? 'scheduled').toLowerCase() !== 'scheduled'),
    [meetings],
  );

  return (
    <>
      <aside className="bg-card border border-border-strong rounded-2xl overflow-hidden flex flex-col min-h-0">
        {/* Zoom-branded header band — same pattern as the social hub
            adopts each platform's color identity. */}
        <div
          className="px-5 py-4 flex-shrink-0"
          style={{ backgroundColor: ZOOM_BRAND.color, color: ZOOM_BRAND.textOnBrand }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
              >
                <Video className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-bold leading-tight">Zoom Meetings</div>
                <div className="text-xs opacity-80">{upcoming.length} upcoming · {past.length} past</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { void load(); }}
                disabled={loading}
                className="text-xs px-2 py-1 rounded font-medium disabled:opacity-50"
                style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: ZOOM_BRAND.textOnBrand }}
              >
                {loading ? 'Loading…' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => { setCreateOpen(true); }}
                className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded font-semibold"
                style={{ backgroundColor: '#ffffff', color: ZOOM_BRAND.color }}
              >
                <Plus className="w-3.5 h-3.5" />
                Schedule
              </button>
            </div>
          </div>
        </div>

        {/* Metrics strip */}
        <div className="px-5 py-4 border-b border-border-light flex-shrink-0">
          <div className="grid grid-cols-4 gap-2">
            <MetricTile label="This week" value={metrics.thisWeek} />
            <MetricTile label="This month" value={metrics.thisMonth} />
            <MetricTile label="Avg dur." value={metrics.avgDuration > 0 ? `${metrics.avgDuration}m` : '—'} />
            <MetricTile label="Cancelled" value={metrics.cancelled} muted />
          </div>
        </div>

        {/* Tabs — surface the 6 hub capabilities at panel level. The tab
            row stays fixed while the per-tab content scrolls inside. */}
        <MeetingsTabs
          upcoming={upcoming}
          past={past}
          loading={loading}
          error={error}
          onOpenMeeting={(m) => { setOpenMeeting(m); }}
          onSchedule={() => { setCreateOpen(true); }}
        />
      </aside>

      <MeetingDetailDialog
        meeting={openMeeting}
        onClose={() => { setOpenMeeting(null); }}
        onChanged={() => { void load(); }}
      />

      <NewMeetingDialog
        open={createOpen}
        onClose={() => { setCreateOpen(false); }}
      />
    </>
  );
}

// ZOOM_BRAND is defined alongside PROVIDER_BRANDS below to avoid the
// temporal-dead-zone ReferenceError that fires when this const evaluates
// before PROVIDER_BRANDS is initialized.

// ============================================================================
// MeetingsTabs — surfaces the 4 hub views (Upcoming / Past / Recordings /
// Reports) directly on the panel so capabilities aren't buried behind a
// click into a popup. Recordings + Reports are UI shells with realistic
// shape; backend wiring is the next pass.
// ============================================================================

type MeetingsTab = 'availability' | 'defaults' | 'recordings' | 'reports' | 'templates' | 'connection';

interface MeetingsTabsProps {
  upcoming: MeetingRecord[];
  past: MeetingRecord[];
  loading: boolean;
  error: string | null;
  onOpenMeeting: (m: MeetingRecord) => void;
  onSchedule: () => void;
}

function MeetingsTabs({ past, error, onSchedule }: MeetingsTabsProps) {
  const [tab, setTab] = useState<MeetingsTab>('availability');

  const tabs: { id: MeetingsTab; label: string }[] = [
    { id: 'availability', label: 'Availability' },
    { id: 'defaults',     label: 'Defaults' },
    { id: 'recordings',   label: 'Recordings' },
    { id: 'reports',      label: 'Reports' },
    { id: 'templates',    label: 'Templates' },
    { id: 'connection',   label: 'Connection' },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Tab strip — fixed; content scrolls below */}
      <div className="px-5 pt-3 border-b border-border-light flex items-center gap-1 overflow-x-auto flex-shrink-0">
        {tabs.map(t => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); }}
              className={`relative px-3 py-2 text-sm transition whitespace-nowrap ${active ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <span>{t.label}</span>
              {active && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t"
                  style={{ backgroundColor: ZOOM_BRAND.color }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-5 space-y-3 flex-1 overflow-y-auto min-h-0">
        {error && (
          <div className="text-xs text-error bg-error/10 border border-error/30 rounded-lg p-2">
            {error}
          </div>
        )}

        {tab === 'availability' && <AvailabilityTab />}
        {tab === 'defaults' && <DefaultsTab onSchedule={onSchedule} />}
        {tab === 'recordings' && <RecordingsTab past={past} />}
        {tab === 'reports' && <ReportsTab past={past} upcoming={[]} />}
        {tab === 'templates' && <TemplatesTab onSchedule={onSchedule} />}
        {tab === 'connection' && <ConnectionTab />}
      </div>
    </div>
  );
}

// ----- Availability tab — weekly working hours used by the booking page -----

function AvailabilityTab() {
  const days: { key: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'; label: string; defaultOn: boolean }[] = [
    { key: 'sunday',    label: 'Sun', defaultOn: false },
    { key: 'monday',    label: 'Mon', defaultOn: true  },
    { key: 'tuesday',   label: 'Tue', defaultOn: true  },
    { key: 'wednesday', label: 'Wed', defaultOn: true  },
    { key: 'thursday',  label: 'Thu', defaultOn: true  },
    { key: 'friday',    label: 'Fri', defaultOn: true  },
    { key: 'saturday',  label: 'Sat', defaultOn: false },
  ];

  return (
    <div className="space-y-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Hours visitors can book on /book and /early-access · UI preview · save wires next pass
      </div>

      {/* Per-day schedule */}
      <div className="space-y-1">
        {days.map(d => (
          <div key={d.key} className="flex items-center gap-2">
            <label className="flex items-center gap-2 w-20 flex-shrink-0">
              <input type="checkbox" defaultChecked={d.defaultOn} className="flex-shrink-0" />
              <span className="text-sm text-foreground">{d.label}</span>
            </label>
            <input
              type="time"
              defaultValue="09:00"
              className="flex-1 min-w-0 bg-background border border-border-strong rounded px-2 py-1 text-xs"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="time"
              defaultValue="17:00"
              className="flex-1 min-w-0 bg-background border border-border-strong rounded px-2 py-1 text-xs"
            />
          </div>
        ))}
      </div>

      {/* Timezone + buffers */}
      <div className="space-y-2 pt-3 border-t border-border-light">
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Timezone</label>
          <select className="w-full bg-background border border-border-strong rounded-lg px-3 py-1.5 text-sm">
            <option>America/Denver (Mountain)</option>
            <option>America/Los_Angeles (Pacific)</option>
            <option>America/Chicago (Central)</option>
            <option>America/New_York (Eastern)</option>
            <option>UTC</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Buffer before</label>
            <select className="w-full bg-background border border-border-strong rounded px-2 py-1.5 text-sm">
              <option>None</option>
              <option>5 min</option>
              <option>10 min</option>
              <option>15 min</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Buffer after</label>
            <select className="w-full bg-background border border-border-strong rounded px-2 py-1.5 text-sm">
              <option>None</option>
              <option>5 min</option>
              <option>10 min</option>
              <option>15 min</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Default meeting length</label>
          <div className="flex gap-1">
            {['15m', '30m', '45m', '60m'].map(d => (
              <button
                key={d}
                type="button"
                className={`flex-1 text-xs px-2 py-1.5 rounded border ${d === '30m' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                style={d === '30m' ? { borderColor: ZOOM_BRAND.color, backgroundColor: ZOOM_BRAND.bgSubtle } : { borderColor: 'rgba(255,255,255,0.10)' }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border-light">
        <button type="button" disabled className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
          + Add date overrides / blocked days
        </button>
        <button
          type="button"
          disabled
          className="text-sm px-3 py-1.5 rounded font-medium opacity-60 cursor-not-allowed"
          style={{ backgroundColor: ZOOM_BRAND.color, color: ZOOM_BRAND.textOnBrand }}
        >
          Save (coming soon)
        </button>
      </div>
    </div>
  );
}

// ----- Defaults tab — controls applied to every new meeting -----

function DefaultsTab({ onSchedule }: { onSchedule: () => void }) {
  return (
    <div className="space-y-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Settings applied to every new {ZOOM_BRAND.label} meeting · UI preview
      </div>

      <div className="space-y-3">
        <ToggleRow label="Waiting room" desc="Hold attendees in a lobby until you admit them" defaultChecked />
        <ToggleRow label="Auto-record to cloud" desc="Recording starts when the host joins" />
        <ToggleRow label="Mute on entry" desc="Attendees join muted; they unmute themselves" defaultChecked />
        <ToggleRow label="Allow join before host" desc="Attendees can connect before you arrive" />
        <ToggleRow label="Require passcode" desc="Random passcode auto-generated per meeting" defaultChecked />
        <ToggleRow label="Auto-share calendar invite" desc="Send a Google/Outlook invite to attendees" defaultChecked />
      </div>

      <div className="space-y-2 pt-2 border-t border-border-light">
        <div className="text-xs text-muted-foreground">Default meeting length</div>
        <div className="flex gap-1">
          {['15m', '30m', '45m', '60m'].map(d => (
            <button
              key={d}
              type="button"
              className={`text-xs px-3 py-1.5 rounded border ${d === '30m' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              style={d === '30m' ? { borderColor: ZOOM_BRAND.color, backgroundColor: ZOOM_BRAND.bgSubtle } : { borderColor: 'rgba(255,255,255,0.10)' }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={onSchedule}
          className="w-full text-sm px-3 py-2 rounded font-medium"
          style={{ backgroundColor: ZOOM_BRAND.color, color: ZOOM_BRAND.textOnBrand }}
        >
          Schedule with these defaults
        </button>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, defaultChecked }: { label: string; desc: string; defaultChecked?: boolean }) {
  return (
    <label
      className="flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-elevated/40 -mx-2 px-2 py-1 rounded"
      title={desc}
    >
      <span className="text-sm text-foreground truncate">{label}</span>
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="flex-shrink-0"
      />
    </label>
  );
}

// ----- Templates tab — saved meeting recipes -----

function TemplatesTab({ onSchedule }: { onSchedule: () => void }) {
  const templates = [
    { id: 't1', name: 'Discovery Call',   duration: 30, agenda: 'Intro · Pain points · Fit assessment · Next steps' },
    { id: 't2', name: 'Live Demo',        duration: 45, agenda: 'Use case framing · Walkthrough · Q&A · Trial setup' },
    { id: 't3', name: 'Quarterly Review', duration: 60, agenda: 'KPIs · Wins · Blockers · Forward plan' },
    { id: 't4', name: 'Weekly 1:1',       duration: 30, agenda: 'Pipeline · Coaching · Goals' },
  ];

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Pre-built agendas — click any to schedule a meeting with that template · UI preview
      </div>
      <ul className="space-y-2">
        {templates.map(t => (
          <li key={t.id}>
            <button
              type="button"
              onClick={onSchedule}
              className="w-full text-left bg-surface-elevated/40 hover:bg-surface-elevated border border-border-light hover:border-border-strong rounded-lg p-3 transition"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-sm font-medium text-foreground">{t.name}</div>
                <span
                  className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ backgroundColor: ZOOM_BRAND.bgSubtle, color: ZOOM_BRAND.color }}
                >
                  {t.duration}m
                </span>
              </div>
              <div className="text-xs text-muted-foreground">{t.agenda}</div>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled
        className="w-full text-xs px-3 py-2 rounded border border-dashed border-border-light text-muted-foreground cursor-not-allowed"
      >
        + New template (coming soon)
      </button>
    </div>
  );
}

// ----- Connection tab — Zoom integration health + account info -----

function ConnectionTab() {
  return (
    <div className="space-y-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {ZOOM_BRAND.label} integration status · UI preview
      </div>

      <div
        className="rounded-lg p-4"
        style={{ backgroundColor: ZOOM_BRAND.bgSubtle, borderWidth: 1, borderStyle: 'solid', borderColor: ZOOM_BRAND.borderSubtle }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded flex items-center justify-center"
              style={{ backgroundColor: ZOOM_BRAND.color }}
            >
              <Video className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{ZOOM_BRAND.label}</div>
              <div className="text-xs text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Connected
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled
            className="text-xs px-2 py-1 rounded text-muted-foreground border border-border-light cursor-not-allowed"
          >
            Manage in Settings →
          </button>
        </div>

        <div className="space-y-2 text-xs">
          <FieldRowInline label="Account" value="dstamper@rapidcompliance.us" />
          <FieldRowInline label="Plan" value="Pro" />
          <FieldRowInline label="Default host" value="dstamper@rapidcompliance.us" />
          <FieldRowInline label="Cloud storage" value="2.1 GB used / 5 GB" />
          <FieldRowInline label="Webhook" value="Configured ✓" />
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Other meeting providers</div>
        <ul className="space-y-1.5">
          <ProviderRow name="Google Meet" status="Available" />
          <ProviderRow name="Microsoft Teams" status="Available" />
        </ul>
      </div>
    </div>
  );
}

function FieldRowInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function ProviderRow({ name, status }: { name: string; status: string }) {
  return (
    <li className="flex items-center justify-between bg-surface-elevated/40 border border-border-light rounded p-2">
      <span className="text-sm text-foreground">{name}</span>
      <button type="button" disabled className="text-xs px-2 py-1 rounded border border-border-light text-muted-foreground cursor-not-allowed">
        {status}
      </button>
    </li>
  );
}

// ----- Recordings tab (UI shell — backend wiring next pass) -----

function RecordingsTab({ past }: { past: MeetingRecord[] }) {
  // UI shell: when wired, each past meeting checks Zoom Cloud Recordings API
  // and lists its own recordings. For now, show realistic shape against the
  // past-meetings list.
  if (past.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-border-light rounded-lg">
        <Mic className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No past meetings — recordings appear after meetings end</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        UI preview · backend wires to Zoom Cloud Recordings API in next pass
      </div>
      {past.slice(0, 4).map(m => (
        <div key={m.id} className="border border-border-light rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-foreground truncate">{m.name ?? 'Past meeting'}</div>
            <div className="text-xs text-muted-foreground flex-shrink-0">{formatMeetingTime(m)}</div>
          </div>
          <ul className="space-y-1.5">
            {[
              { kind: 'MP4', label: 'Full recording', size: '184 MB', dur: '32:14' },
              { kind: 'M4A', label: 'Audio only',     size: '14 MB',  dur: '32:14' },
              { kind: 'VTT', label: 'AI transcript',  size: '38 KB',  dur: null },
            ].map((r, idx) => (
              <li key={idx} className="flex items-center gap-2 bg-surface-elevated/40 rounded px-2 py-1.5">
                <div
                  className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-[9px] font-bold"
                  style={{ backgroundColor: ZOOM_BRAND.bgSubtle, color: ZOOM_BRAND.color }}
                >
                  {r.kind}
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <div className="text-foreground truncate">{r.label}</div>
                  <div className="text-muted-foreground">{r.dur ? `${r.dur} · ` : ''}{r.size}</div>
                </div>
                <button type="button" disabled className="text-xs px-2 py-1 rounded text-muted-foreground cursor-not-allowed opacity-60">
                  Download
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ----- Reports tab (attendance summary, UI shell) -----

function ReportsTab({ past, upcoming }: { past: MeetingRecord[]; upcoming: MeetingRecord[] }) {
  const totalScheduled = past.length + upcoming.length;
  const completed = past.filter(m => (m.status ?? '').toLowerCase() === 'completed').length;
  const cancelled = past.filter(m => (m.status ?? '').toLowerCase() === 'cancelled').length;

  return (
    <div className="space-y-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        UI preview · backend wires to Zoom Past Meeting Participants API in next pass
      </div>

      {/* Top-line stats */}
      <div className="grid grid-cols-3 gap-2">
        <ReportStat label="Total" value={totalScheduled} />
        <ReportStat label="Completed" value={completed} accent={ZOOM_BRAND.color} />
        <ReportStat label="Cancelled" value={cancelled} muted />
      </div>

      {/* Per-meeting attendance preview */}
      {past.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border-light rounded-lg">
          <p className="text-sm text-muted-foreground">No past meetings yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Attendance reports populate after meetings end.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {past.slice(0, 5).map(m => (
            <div key={m.id} className="border border-border-light rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-foreground truncate flex-1">{m.name ?? 'Past meeting'}</div>
                <div className="text-xs text-muted-foreground flex-shrink-0">{formatMeetingTime(m)}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Attended</div>
                  <div className="font-medium text-foreground">— / —</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Avg time</div>
                  <div className="font-medium text-foreground">—</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wide">No-shows</div>
                  <div className="font-medium text-foreground">—</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportStat({ label, value, accent, muted }: { label: string; value: number; accent?: string; muted?: boolean }) {
  return (
    <div
      className={`border border-border-light rounded-lg p-3 text-center ${muted ? 'opacity-70' : ''}`}
      style={accent ? { borderColor: accent, backgroundColor: `${accent}10` } : undefined}
    >
      <div className="text-xl font-bold text-foreground leading-tight" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

// ============================================================================
// Provider branding — each meeting provider (Zoom, Meet, Teams) gets its own
// brand color + label so the meeting popup adopts that platform's identity,
// matching the pattern social pages use for Twitter/LinkedIn/etc. Add a row
// here when wiring up a new provider.
// ============================================================================

interface ProviderBrand {
  label: string;
  color: string;          // brand hex
  bgSubtle: string;       // semi-transparent brand fill for sections
  borderSubtle: string;   // semi-transparent brand border
  textOnBrand: string;    // foreground when sitting on the brand color
}

const PROVIDER_BRANDS: Record<string, ProviderBrand> = {
  zoom: {
    label: 'Zoom',
    color: '#2D8CFF',
    bgSubtle: 'rgba(45, 140, 255, 0.08)',
    borderSubtle: 'rgba(45, 140, 255, 0.30)',
    textOnBrand: '#ffffff',
  },
  meet: {
    label: 'Google Meet',
    color: '#00897B',
    bgSubtle: 'rgba(0, 137, 123, 0.08)',
    borderSubtle: 'rgba(0, 137, 123, 0.30)',
    textOnBrand: '#ffffff',
  },
  teams: {
    label: 'Microsoft Teams',
    color: '#5059C9',
    bgSubtle: 'rgba(80, 89, 201, 0.08)',
    borderSubtle: 'rgba(80, 89, 201, 0.30)',
    textOnBrand: '#ffffff',
  },
};

const DEFAULT_PROVIDER_BRAND: ProviderBrand = {
  label: 'Meeting',
  color: '#6366f1',
  bgSubtle: 'rgba(99, 102, 241, 0.08)',
  borderSubtle: 'rgba(99, 102, 241, 0.30)',
  textOnBrand: '#ffffff',
};

function brandFor(provider: string | undefined): ProviderBrand {
  if (!provider) {return PROVIDER_BRANDS.zoom ?? DEFAULT_PROVIDER_BRAND;}
  return PROVIDER_BRANDS[provider.toLowerCase()] ?? DEFAULT_PROVIDER_BRAND;
}

const ZOOM_BRAND = PROVIDER_BRANDS.zoom ?? DEFAULT_PROVIDER_BRAND;

// ============================================================================
// MetricTile — compact stat display for the meetings panel header
// ============================================================================

interface MetricTileProps {
  label: string;
  value: number | string;
  muted?: boolean;
}

function MetricTile({ label, value, muted }: MetricTileProps) {
  return (
    <div className={`bg-surface-elevated/40 border border-border-light rounded-lg p-2 text-center ${muted ? 'opacity-70' : ''}`}>
      <div className="text-lg font-bold text-foreground leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

// ============================================================================
// MeetingDetailDialog — popup with full meeting controls
// (UI shell — Cancel + Delete are wired; Edit + Recordings + Reports are
// UI-only previews of the real interface scope.)
// ============================================================================

interface MeetingDetailDialogProps {
  meeting: MeetingRecord | null;
  onClose: () => void;
  onChanged: () => void;
}

function MeetingDetailDialog({ meeting, onClose, onChanged }: MeetingDetailDialogProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset all transient state whenever the dialog target changes
  useEffect(() => {
    setMode('view');
    setConfirmCancel(false);
    setConfirmDelete(false);
    setPending(false);
    setError(null);
    setCopyFlash(null);
  }, [meeting?.id]);

  // Auto-disarm two-step confirmations
  useEffect(() => {
    if (!confirmCancel && !confirmDelete) {return;}
    const t = setTimeout(() => {
      setConfirmCancel(false);
      setConfirmDelete(false);
    }, 5000);
    return () => { clearTimeout(t); };
  }, [confirmCancel, confirmDelete]);

  if (!meeting) {return null;}
  const m = meeting;
  const isCancelled = (m.status ?? '').toLowerCase() === 'cancelled';
  const brand = brandFor(m.meetingProvider ?? (m.zoomMeetingId ? 'zoom' : undefined));

  const copy = (label: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopyFlash(label);
      setTimeout(() => { setCopyFlash(null); }, 1500);
    });
  };

  const handleCancel = async () => {
    if (!confirmCancel) {setConfirmCancel(true); return;}
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${m.id}/cancel`, { method: 'POST' });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!data.success) {throw new Error(data.error ?? 'Cancel failed');}
      onChanged();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setPending(false);
      setConfirmCancel(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {setConfirmDelete(true); return;}
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${m.id}`, { method: 'DELETE' });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!data.success) {throw new Error(data.error ?? 'Delete failed');}
      onChanged();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setPending(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Dialog open={!!meeting} onOpenChange={(open) => { if (!open) {onClose();} }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Brand band — adopts the meeting provider's identity (Zoom blue,
            Meet green, Teams purple) like the social composers do for each
            platform. */}
        <div
          className="px-6 py-4"
          style={{ backgroundColor: brand.color, color: brand.textOnBrand }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
              >
                <Video className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold opacity-90">
                  {brand.label} Meeting
                </div>
                <div className="text-xs opacity-75">
                  {isCancelled ? 'Cancelled' : 'Scheduled'} · {m.meetingProvider ?? 'zoom'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setMode(mode === 'view' ? 'edit' : 'view'); }}
              className="text-xs px-3 py-1.5 rounded font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: brand.textOnBrand }}
            >
              {mode === 'view' ? 'Edit' : 'Cancel edit'}
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          <DialogHeader>
            <DialogTitle>{m.name ?? 'Meeting'}</DialogTitle>
            <DialogDescription>
              {formatMeetingTime(m)}{m.duration ? ` · ${m.duration} minutes` : ''}
            </DialogDescription>
          </DialogHeader>

          {error && (
          <div className="text-sm text-error bg-error/10 border border-error/30 rounded-lg p-3">
            {error}
          </div>
        )}

        {mode === 'edit' ? (
          <div className="space-y-4">
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning">
              Edit interface — UI preview. Save will be wired in the next pass.
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Topic / Attendee Name</label>
              <input type="text" defaultValue={m.name ?? ''} className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Date</label>
                <input type="date" defaultValue={m.date ?? ''} className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Time</label>
                <input type="time" defaultValue={m.time ?? ''} className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Duration (minutes)</label>
              <input type="number" defaultValue={m.duration ?? 30} className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Notes / Agenda</label>
              <textarea defaultValue={m.notes ?? ''} rows={3} className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setMode('view'); }} className="text-sm px-3 py-1.5 rounded text-muted-foreground hover:text-foreground">
                Discard
              </button>
              <button type="button" disabled className="text-sm px-3 py-1.5 rounded bg-primary/40 text-primary-foreground cursor-not-allowed">
                Save changes (coming soon)
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Zoom controls — branded with the provider's color */}
            <section
              className="rounded-lg p-4 space-y-3"
              style={{ backgroundColor: brand.bgSubtle, borderWidth: 1, borderStyle: 'solid', borderColor: brand.borderSubtle }}
            >
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4" style={{ color: brand.color }} />
                <h4 className="text-sm font-semibold text-foreground">{brand.label} Meeting</h4>
              </div>
              {m.zoomJoinUrl ? (
                <>
                  <div className="space-y-2">
                    <FieldRow label="Join URL" value={m.zoomJoinUrl} onCopy={() => { copy('Join URL', m.zoomJoinUrl ?? ''); }} flash={copyFlash === 'Join URL'} link />
                    {m.zoomMeetingId && (
                      <FieldRow label="Meeting ID" value={m.zoomMeetingId} onCopy={() => { copy('Meeting ID', m.zoomMeetingId ?? ''); }} flash={copyFlash === 'Meeting ID'} mono />
                    )}
                    {m.zoomPassword && (
                      <FieldRow label="Passcode" value={m.zoomPassword} onCopy={() => { copy('Passcode', m.zoomPassword ?? ''); }} flash={copyFlash === 'Passcode'} mono />
                    )}
                    {m.zoomStartUrl && (
                      <FieldRow label="Host Start URL" value={m.zoomStartUrl} onCopy={() => { copy('Host URL', m.zoomStartUrl ?? ''); }} flash={copyFlash === 'Host URL'} link />
                    )}
                  </div>
                  <a
                    href={m.zoomJoinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition hover:opacity-90"
                    style={{ backgroundColor: brand.color, color: brand.textOnBrand }}
                  >
                    <Video className="w-4 h-4" />
                    Join {brand.label} Meeting
                  </a>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Zoom link not yet generated. We&apos;ll email it separately within the hour.
                </p>
              )}
            </section>

            {/* Attendees */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <UsersIcon className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-foreground">Attendees</h4>
              </div>
              <ul className="space-y-1 text-sm">
                {m.email ? (
                  <li className="flex items-center justify-between bg-surface-elevated/40 border border-border-light rounded px-3 py-2">
                    <span className="text-foreground">{m.name ?? m.email}</span>
                    <span className="text-xs text-muted-foreground">{m.email}</span>
                  </li>
                ) : (
                  <li className="text-xs text-muted-foreground">No attendees recorded</li>
                )}
                {m.phone && (
                  <li className="text-xs text-muted-foreground px-3 py-1">
                    Phone: {m.phone}
                  </li>
                )}
              </ul>
            </section>

            {/* Notes / agenda */}
            {m.notes && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">Notes</h4>
                </div>
                <p className="text-sm text-foreground bg-surface-elevated/40 border border-border-light rounded p-3 whitespace-pre-wrap">
                  {m.notes}
                </p>
              </section>
            )}

            {/* Recordings — UI shell. Shape is what the real interface
                will look like. Backend wiring to Zoom Cloud Recordings API
                is the next pass. */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">Cloud Recordings</h4>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  UI preview · backend pending
                </span>
              </div>
              {isCancelled ? (
                <div className="text-xs text-muted-foreground bg-surface-elevated/40 border border-dashed border-border-light rounded p-3">
                  Meeting was cancelled — no recording.
                </div>
              ) : (
                <ul className="space-y-2">
                  {/* Each row is what a real recording entry will render as. */}
                  {[
                    { id: 'r1', title: 'Full meeting recording', kind: 'MP4', duration: '32:14', size: '184 MB', date: 'Live after meeting' },
                    { id: 'r2', title: 'Audio only', kind: 'M4A', duration: '32:14', size: '14 MB', date: 'Live after meeting' },
                    { id: 'r3', title: 'AI transcript', kind: 'VTT', duration: '—', size: '38 KB', date: 'Live after meeting' },
                  ].map(r => (
                    <li key={r.id} className="flex items-center gap-3 bg-surface-elevated/40 border border-border-light rounded p-3">
                      <div className="w-9 h-9 rounded bg-info/10 text-info flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                        {r.kind}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground truncate">{r.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.duration !== '—' ? `${r.duration} · ` : ''}{r.size} · {r.date}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-50">
                        <button type="button" disabled className="text-xs px-2 py-1 rounded text-muted-foreground cursor-not-allowed" title="Download (coming soon)">
                          Download
                        </button>
                        <button type="button" disabled className="text-xs px-2 py-1 rounded text-muted-foreground cursor-not-allowed" title="View (coming soon)">
                          View
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Attendance — UI shell with the real row shape. Real data
                comes from Zoom's Past Meetings Participants API. */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">Attendance</h4>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  UI preview · backend pending
                </span>
              </div>
              {isCancelled ? (
                <div className="text-xs text-muted-foreground bg-surface-elevated/40 border border-dashed border-border-light rounded p-3">
                  Meeting was cancelled — no attendance data.
                </div>
              ) : (
                <div className="bg-surface-elevated/40 border border-border-light rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-elevated/60 text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Attendee</th>
                        <th className="text-left px-3 py-2 font-medium">Joined</th>
                        <th className="text-left px-3 py-2 font-medium">Left</th>
                        <th className="text-right px-3 py-2 font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                      <tr>
                        <td className="px-3 py-2 text-foreground">{m.name ?? 'Host'}</td>
                        <td className="px-3 py-2 text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                      </tr>
                      {m.email && (
                        <tr>
                          <td className="px-3 py-2 text-foreground">{m.email}</td>
                          <td className="px-3 py-2 text-muted-foreground">—</td>
                          <td className="px-3 py-2 text-muted-foreground">—</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div className="text-xs text-muted-foreground bg-surface-elevated/60 px-3 py-2 border-t border-border-light">
                    Populates after the meeting ends · pulls from Zoom Past Meeting Participants
                  </div>
                </div>
              )}
            </section>

            {/* Destructive actions */}
            {!isCancelled && (
              <section className="pt-2 border-t border-border-light flex items-center justify-end gap-2">
                {confirmCancel ? (
                  <>
                    <button type="button" onClick={() => { setConfirmCancel(false); }} className="text-sm px-3 py-1.5 rounded text-muted-foreground hover:text-foreground">
                      Keep it
                    </button>
                    <button type="button" onClick={() => { void handleCancel(); }} disabled={pending} className="text-sm px-3 py-1.5 rounded bg-error/15 text-error hover:bg-error/25 disabled:opacity-50">
                      {pending ? 'Cancelling…' : 'Click again to confirm cancel'}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => { void handleCancel(); }} disabled={pending} className="text-sm px-3 py-1.5 rounded bg-surface-elevated text-foreground hover:bg-card-hover border border-border-light">
                    <XIcon className="w-4 h-4 inline mr-1" />
                    Cancel meeting
                  </button>
                )}
                {confirmDelete ? (
                  <button type="button" onClick={() => { void handleDelete(); }} disabled={pending} className="text-sm px-3 py-1.5 rounded bg-error text-primary-foreground hover:bg-error/90 disabled:opacity-50">
                    {pending ? 'Deleting…' : 'Click again to confirm delete'}
                  </button>
                ) : (
                  <button type="button" onClick={() => { void handleDelete(); }} disabled={pending} className="text-sm px-3 py-1.5 rounded text-error hover:bg-error/10">
                    Delete record
                  </button>
                )}
              </section>
            )}
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// FieldRow — read-only key/value with copy-to-clipboard
// ============================================================================

interface FieldRowProps {
  label: string;
  value: string;
  onCopy: () => void;
  flash: boolean;
  mono?: boolean;
  link?: boolean;
}

function FieldRow({ label, value, onCopy, flash, mono, link }: FieldRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <span className={`flex-1 text-xs text-foreground truncate ${mono ? 'font-mono' : ''} ${link ? 'text-info' : ''}`}>
        {value}
      </span>
      <button
        type="button"
        onClick={onCopy}
        className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-elevated flex-shrink-0"
        title={`Copy ${label}`}
      >
        {flash ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

// ============================================================================
// NewMeetingDialog — UI shell for scheduling a new Zoom meeting
// (Save not wired — visual preview only.)
// ============================================================================

interface NewMeetingDialogProps {
  open: boolean;
  onClose: () => void;
}

function NewMeetingDialog({ open, onClose }: NewMeetingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) {onClose();} }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule a new meeting</DialogTitle>
          <DialogDescription>
            Creates a Zoom meeting and sends a calendar invite to your attendees.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning">
          UI preview. Save flow will hit the booking API in the next pass.
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Topic</label>
            <input type="text" placeholder="e.g. Discovery call with Acme" className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Attendees</label>
            <CrmAttendeePicker />
            <p className="text-xs text-muted-foreground mt-1">
              Pulls from your leads, contacts, and deals — per the operator-scheduling rule, attendees must already exist in CRM.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Date</label>
              <input type="date" className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Time</label>
              <input type="time" className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Duration</label>
              <select className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm">
                <option>15 min</option>
                <option>30 min</option>
                <option>45 min</option>
                <option>60 min</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">Agenda / Notes</label>
            <textarea rows={3} className="w-full bg-background border border-border-strong rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-muted-foreground block">Zoom settings</label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked /> Waiting room
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" /> Auto-record to cloud
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" /> Allow join before host
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-light">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button type="button" disabled className="text-sm px-3 py-1.5 rounded bg-primary/40 text-primary-foreground cursor-not-allowed">
            Schedule (coming soon)
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// CrmAttendeePicker — visual shell for the CRM-only attendee picker.
// Shows the search/select shape the real component will use. Backend
// wiring to /api/crm/* search comes in the next pass.
// ============================================================================

interface CrmCandidate {
  id: string;
  name: string;
  email: string;
  source: 'lead' | 'contact' | 'deal';
  company?: string;
}

function CrmAttendeePicker() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CrmCandidate[]>([]);
  const [open, setOpen] = useState(false);

  // UI-shell sample data — real component fetches from /api/crm/search.
  const sampleCandidates: CrmCandidate[] = [
    { id: 'l1', name: 'James from BigBun', email: 'j@bigbun.com', source: 'lead' },
    { id: 'c1', name: 'Sarah Chen', email: 'sarah@acme.io', source: 'contact', company: 'Acme Co.' },
    { id: 'd1', name: 'Marcus Reed', email: 'm.reed@nimbus.dev', source: 'deal', company: 'Nimbus Labs' },
  ];

  const filtered = sampleCandidates
    .filter(c => !selected.some(s => s.id === c.id))
    .filter(c => {
      const q = query.toLowerCase();
      if (!q) {return true;}
      return c.name.toLowerCase().includes(q) ||
             c.email.toLowerCase().includes(q) ||
             (c.company ?? '').toLowerCase().includes(q);
    });

  const sourceColor = (s: CrmCandidate['source']) =>
    s === 'lead' ? 'bg-info/10 text-info' :
    s === 'contact' ? 'bg-success/10 text-success' :
    'bg-warning/10 text-warning';

  return (
    <div className="relative">
      <div className="bg-background border border-border-strong rounded-lg p-2 min-h-[42px] flex flex-wrap gap-1 items-center">
        {selected.map(c => (
          <span key={c.id} className="inline-flex items-center gap-1 bg-surface-elevated text-foreground text-xs px-2 py-1 rounded">
            <span>{c.name}</span>
            <span className="text-muted-foreground">({c.email})</span>
            <button
              type="button"
              onClick={() => { setSelected(selected.filter(s => s.id !== c.id)); }}
              className="ml-1 text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${c.name}`}
            >
              <XIcon className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); }}
          placeholder={selected.length === 0 ? 'Search leads, contacts, or deals…' : 'Add another…'}
          className="flex-1 min-w-[140px] bg-transparent text-sm outline-none px-1"
        />
      </div>

      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-card border border-border-strong rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              No matches. Real picker also offers &quot;Create lead from this email&quot;.
            </div>
          ) : (
            <ul className="py-1">
              {filtered.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected([...selected, c]);
                      setQuery('');
                    }}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-surface-elevated"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                        <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${sourceColor(c.source)}`}>
                          {c.source}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.email}{c.company ? ` · ${c.company}` : ''}
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="px-3 py-2 border-t border-border-light text-[10px] uppercase tracking-wide text-muted-foreground bg-surface-elevated/40">
            UI preview · live search wires to /api/crm in the next pass
          </div>
        </div>
      )}

      {/* Click-outside handler — clicking elsewhere closes the dropdown */}
      {open && (
        <button
          type="button"
          aria-label="Close attendee picker"
          onClick={() => { setOpen(false); }}
          className="fixed inset-0 z-0 cursor-default"
        />
      )}
    </div>
  );
}
