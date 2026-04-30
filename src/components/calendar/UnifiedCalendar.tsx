'use client';

/**
 * UnifiedCalendar
 *
 * react-big-calendar instance for the dashboard's unified view across
 * meetings, demos, Google Calendar, scheduled social posts, and CRM
 * activities. Color-codes events by source, supports month/week/day
 * views, and bubbles event clicks up to the parent for detail-panel
 * rendering.
 *
 * Pattern mirrors `src/components/social/SocialCalendar.tsx` so the
 * dark-theme overrides at `src/styles/social-calendar.css` apply here
 * too without further CSS work.
 */

import React, { useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, type View, type Event, type Components } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/styles/social-calendar.css';
import type {
  CalendarEventSource,
  UnifiedCalendarEvent,
} from '@/lib/calendar/event-aggregator';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

export type { CalendarEventSource, UnifiedCalendarEvent };

interface CalendarRenderEvent extends Event {
  resource: UnifiedCalendarEvent;
}

const SOURCE_COLORS: Record<CalendarEventSource, { bg: string; text: string }> = {
  meeting:     { bg: '#6366f1', text: '#ffffff' }, // indigo  — operator meetings
  booking:     { bg: '#a855f7', text: '#ffffff' }, // purple  — public demos
  gcal:        { bg: '#3b82f6', text: '#ffffff' }, // blue    — Google Calendar
  social_post: { bg: '#10b981', text: '#ffffff' }, // green   — scheduled posts
  activity:    { bg: '#6b7280', text: '#ffffff' }, // gray    — CRM activities
};

interface UnifiedCalendarProps {
  events: UnifiedCalendarEvent[];
  onSelectEvent: (event: UnifiedCalendarEvent) => void;
  enabledSources: Set<CalendarEventSource>;
  /**
   * Optional react-big-calendar `components` overrides. Used by the
   * dashboard section to inject a per-day "Hours" button into the
   * month-view date headers without forking the calendar wrapper.
   */
  components?: Components<CalendarRenderEvent>;
}

export default function UnifiedCalendar({
  events,
  onSelectEvent,
  enabledSources,
  components,
}: UnifiedCalendarProps) {
  const [currentView, setCurrentView] = React.useState<View>('month');
  const [currentDate, setCurrentDate] = React.useState(new Date());

  const renderEvents: CalendarRenderEvent[] = useMemo(() => {
    return events
      .filter((e) => enabledSources.has(e.source))
      .map((e) => ({
        title: e.title,
        start: new Date(e.start),
        end: new Date(e.end || e.start),
        allDay: e.isAllDay,
        resource: e,
      }));
  }, [events, enabledSources]);

  const eventPropGetter = useCallback((event: CalendarRenderEvent) => {
    const colors = SOURCE_COLORS[event.resource.source] ?? { bg: '#666', text: '#fff' };
    return {
      style: {
        backgroundColor: colors.bg,
        color: colors.text,
        borderRadius: '0.25rem',
        border: 'none',
        fontSize: '0.6875rem',
        padding: '2px 4px',
      },
    };
  }, []);

  const handleSelectEvent = useCallback(
    (event: CalendarRenderEvent) => {
      onSelectEvent(event.resource);
    },
    [onSelectEvent],
  );

  return (
    <div className="bg-card border border-border-strong rounded-2xl p-4">
      <Calendar
        localizer={localizer}
        events={renderEvents}
        startAccessor="start"
        endAccessor="end"
        view={currentView}
        onView={setCurrentView}
        date={currentDate}
        onNavigate={setCurrentDate}
        views={['month', 'week', 'day', 'agenda']}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventPropGetter}
        components={components}
        style={{ height: 720 }}
        popup
      />
    </div>
  );
}
