'use client';

/**
 * Unified Calendar Dashboard Page
 *
 * One timeline across:
 *   - Meetings (operator-driven)
 *   - Demos (public booking form)
 *   - Google Calendar (synced events)
 *   - Scheduled social posts
 *   - CRM activities
 *
 * Filter chips per source, click an event for a side detail panel.
 */

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Calendar as CalendarIcon, ExternalLink, Video, Loader2 } from 'lucide-react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
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
  dot: string;       // tailwind bg color class for the legend dot
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

export default function CalendarDashboardPage() {
  const authFetch = useAuthFetch();
  const [events, setEvents] = useState<UnifiedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UnifiedCalendarEvent | null>(null);
  const [enabledSources, setEnabledSources] = useState<Set<CalendarEventSource>>(
    new Set<CalendarEventSource>(['meeting', 'booking', 'gcal', 'social_post', 'activity']),
  );

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Default window: 60 days back through 90 days forward — gives operators
      // a useful look at recent past + booked future without paginating.
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

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CalendarIcon className="w-7 h-7 text-primary" />
            <PageTitle>Calendar</PageTitle>
          </div>
          <SectionDescription>
            Everything in one place — meetings, demos, scheduled posts, CRM
            activity, and your Google Calendar. Filter by source, drill in for
            detail.
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

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
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
      </div>

      {/* Calendar + side detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <UnifiedCalendar
          events={events}
          enabledSources={enabledSources}
          onSelectEvent={setSelected}
        />

        <aside className="bg-card border border-border-strong rounded-2xl p-6 self-start">
          {selected ? (
            <EventDetail event={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              Click an event to see details.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

interface EventDetailProps {
  event: UnifiedCalendarEvent;
  onClose: () => void;
}

function EventDetail({ event, onClose }: EventDetailProps) {
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

  return (
    <div className="space-y-4">
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
    </div>
  );
}
