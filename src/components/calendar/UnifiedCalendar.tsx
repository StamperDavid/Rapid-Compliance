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
import { Calendar, dateFnsLocalizer, type View, type Event, type Components, type ToolbarProps } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
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
   * Optional callback for when the user clicks a day cell (empty space)
   * in month or week view. Used by the dashboard to open a "day details"
   * panel listing all events on that date before drilling into one.
   */
  onSelectDay?: (date: Date) => void;
  /**
   * Optional react-big-calendar `components` overrides. Used by the
   * dashboard section to inject a per-day "Hours" button into the
   * month-view date headers without forking the calendar wrapper.
   */
  components?: Components<CalendarRenderEvent>;
  /**
   * Fired whenever the operator navigates to a new date (Prev / Next /
   * Today / drill-down). Lets the parent expand its event-fetch window
   * when the operator scrolls beyond the cached range.
   */
  onNavigate?: (date: Date) => void;
}

// ============================================================================
// CustomToolbar — replaces react-big-calendar's default toolbar with a
// prominent set of buttons (Prev / Today / Next on the left, view switcher
// on the right, current month label centered). Visibility was the main
// complaint with the default toolbar — operators didn't realize the small
// inline links were buttons.
// ============================================================================

function CustomToolbar({ label, onNavigate, onView, view, views }: ToolbarProps<CalendarRenderEvent>) {
  const viewList = (Array.isArray(views) ? views : Object.keys(views as object)) as View[];
  return (
    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <div className="inline-flex items-center gap-1 bg-card border border-border-strong rounded-lg p-1">
        <button
          type="button"
          onClick={() => { onNavigate('PREV'); }}
          className="inline-flex items-center justify-center w-9 h-9 rounded-md text-foreground hover:bg-surface-elevated transition-colors"
          aria-label="Previous"
          title="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => { onNavigate('TODAY'); }}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium text-foreground hover:bg-surface-elevated transition-colors"
          title="Jump to today"
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Today
        </button>
        <button
          type="button"
          onClick={() => { onNavigate('NEXT'); }}
          className="inline-flex items-center justify-center w-9 h-9 rounded-md text-foreground hover:bg-surface-elevated transition-colors"
          aria-label="Next"
          title="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <h3 className="text-base font-semibold text-foreground flex-1 text-center">{label}</h3>

      <div className="inline-flex items-center gap-0.5 bg-card border border-border-strong rounded-lg p-1">
        {viewList.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => { onView(v); }}
            className={`px-3 h-9 rounded-md text-sm font-medium capitalize transition-colors ${
              view === v
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function UnifiedCalendar({
  events,
  onSelectEvent,
  onSelectDay,
  enabledSources,
  components,
  onNavigate,
}: UnifiedCalendarProps) {
  const [currentView, setCurrentView] = React.useState<View>('month');
  const [currentDate, setCurrentDate] = React.useState(new Date());

  const handleNavigate = useCallback(
    (date: Date) => {
      setCurrentDate(date);
      if (onNavigate) {
        onNavigate(date);
      }
    },
    [onNavigate],
  );

  const mergedComponents: Components<CalendarRenderEvent> = useMemo(
    () => ({
      ...(components ?? {}),
      toolbar: CustomToolbar,
    }),
    [components],
  );

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

  // Day-click handlers: drill down (clicking the date number in month
  // view) AND select-slot (clicking empty space inside a day cell).
  // Both bubble the same date to the parent.
  const handleDrillDown = useCallback(
    (date: Date) => {
      if (onSelectDay) {
        onSelectDay(date);
      } else {
        // Default behavior — drill into day view.
        setCurrentDate(date);
        setCurrentView('day');
      }
    },
    [onSelectDay],
  );

  const handleSelectSlot = useCallback(
    (slot: { start: Date }) => {
      if (onSelectDay) {
        onSelectDay(slot.start);
      }
    },
    [onSelectDay],
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
        onNavigate={handleNavigate}
        views={['month', 'week', 'day', 'agenda']}
        onSelectEvent={handleSelectEvent}
        onDrillDown={handleDrillDown}
        onSelectSlot={handleSelectSlot}
        selectable={!!onSelectDay}
        eventPropGetter={eventPropGetter}
        components={mergedComponents}
        style={{ height: 720 }}
        popup
      />
    </div>
  );
}
