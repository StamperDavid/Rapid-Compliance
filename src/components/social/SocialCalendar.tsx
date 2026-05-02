'use client';

/**
 * SocialCalendar
 * Configured react-big-calendar instance with dark theme, custom event rendering,
 * and drag-drop support for rescheduling posts.
 */

import React, { useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, type View, type ToolbarProps } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import CalendarEventCard, { type CalendarEvent } from './CalendarEventCard';
import CalendarToolbar from './CalendarToolbar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/styles/social-calendar.css';
import { SOCIAL_PLATFORMS } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const PLATFORM_EVENT_COLORS: Record<string, { bg: string; text: string }> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p, { bg: PLATFORM_META[p].color, text: '#ffffff' }])
);

interface SocialCalendarProps {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot: (slotInfo: { start: Date; end: Date }) => void;
  onEventDrop?: (data: { event: CalendarEvent; start: Date; end: Date }) => void;
  platformFilter: string;
  statusFilter: string;
  onPlatformFilter: (value: string) => void;
  onStatusFilter: (value: string) => void;
  /**
   * Height for the calendar container. Defaults to a full-page height
   * (`calc(100vh - 220px)`); embeds should pass an explicit pixel value
   * so the calendar fits within a card.
   */
  height?: string | number;
  /** Floor for the calendar container; default 500px. */
  minHeight?: number;
  /** Initial calendar view; defaults to 'month'. Use 'agenda' for narrow embeds. */
  defaultView?: View;
  /** Hide the platform-filter dropdown in the toolbar. Use when the
   *  embed is already pre-filtered to a single platform. */
  hidePlatformFilter?: boolean;
}

export default function SocialCalendar({
  events,
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  platformFilter,
  statusFilter,
  onPlatformFilter,
  onStatusFilter,
  height,
  minHeight,
  defaultView,
  hidePlatformFilter,
}: SocialCalendarProps) {
  const [currentView, setCurrentView] = React.useState<View>(defaultView ?? 'month');
  const [currentDate, setCurrentDate] = React.useState(new Date());

  // Filter events client-side
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (platformFilter !== 'all' && event.platform !== platformFilter) {return false;}
      if (statusFilter !== 'all' && event.status !== statusFilter) {return false;}
      return true;
    });
  }, [events, platformFilter, statusFilter]);

  // Platform-based event styling
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const colors = PLATFORM_EVENT_COLORS[event.platform] ?? { bg: '#666', text: '#fff' };
    return {
      style: {
        backgroundColor: colors.bg,
        color: colors.text,
        borderRadius: '0.25rem',
        border: 'none',
        fontSize: '0.6875rem',
      },
    };
  }, []);

  // Custom toolbar — wraps CalendarToolbar with filter props injected via closure
  const CustomToolbar = useMemo(() => {
    function ToolbarWrapper(toolbarProps: ToolbarProps<CalendarEvent, object>) {
      return (
        <CalendarToolbar
          {...toolbarProps}
          platformFilter={platformFilter}
          statusFilter={statusFilter}
          onPlatformFilter={onPlatformFilter}
          onStatusFilter={onStatusFilter}
          hidePlatformFilter={hidePlatformFilter}
        />
      );
    }
    ToolbarWrapper.displayName = 'CalendarToolbarWrapper';
    return ToolbarWrapper;
  }, [platformFilter, statusFilter, onPlatformFilter, onStatusFilter, hidePlatformFilter]);

  // Custom event component
  const EventComponent = useCallback(
    ({ event }: { event: CalendarEvent }) => <CalendarEventCard event={event} />,
    []
  );

  // Note: onEventDrop is accepted as a prop for future DnD addon integration
  // but is not wired directly to Calendar since it requires withDragAndDrop HOC.
  void onEventDrop;

  const containerHeight = height ?? 'calc(100vh - 220px)';
  const containerMinHeight = minHeight ?? 500;

  return (
    <div style={{ height: containerHeight, minHeight: containerMinHeight }}>
      <Calendar<CalendarEvent>
        localizer={localizer}
        events={filteredEvents}
        startAccessor="start"
        endAccessor="end"
        view={currentView}
        onView={setCurrentView}
        date={currentDate}
        onNavigate={setCurrentDate}
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        selectable
        eventPropGetter={eventPropGetter}
        components={{
          toolbar: CustomToolbar,
          event: EventComponent,
        }}
        onDrillDown={(date) => {
          setCurrentDate(date);
          setCurrentView('day');
        }}
        popup
        views={['month', 'week', 'day', 'agenda']}
        step={30}
        timeslots={2}
      />
    </div>
  );
}
