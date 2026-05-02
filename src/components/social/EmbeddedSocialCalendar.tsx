'use client';

/**
 * EmbeddedSocialCalendar — self-contained social calendar for hub embeds.
 *
 * Fetches /api/social/calendar and renders the full SocialCalendar with its
 * own toolbar. Used by the /social hub (no platform lock) and per-platform
 * dashboards (locked to a single platform).
 *
 * Sticking to the same data shape /social/calendar uses so an event clicked
 * here behaves the same way as on the full calendar page.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { View } from 'react-big-calendar';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { CalendarEvent } from '@/components/social/CalendarEventCard';

const SocialCalendar = dynamic(() => import('@/components/social/SocialCalendar'), {
  ssr: false,
  loading: () => (
    <div className="py-12 text-center text-muted-foreground">Loading calendar...</div>
  ),
});

interface CalendarEventFromAPI {
  id: string;
  title: string;
  start: string;
  end: string;
  platform: string;
  status: string;
  content: string;
  postId: string;
  source: string;
  mediaUrls?: string[];
  accountId?: string;
}

interface EmbeddedSocialCalendarProps {
  /**
   * If set, only events for this platform are rendered. The toolbar's
   * platform dropdown is locked to this value.
   */
  lockedPlatform?: SocialPlatform;
  /**
   * Optional wrapper className. Use Tailwind utilities for outer styling
   * (margins, etc) — calendar height is controlled by the `height` prop.
   */
  className?: string;
  /**
   * Calendar height in pixels. Default 600. The calendar container is
   * sized explicitly because react-big-calendar requires a numeric height
   * for its layout to work.
   */
  height?: number;
  /**
   * Initial calendar view. Use 'agenda' for narrow embeds where a month
   * grid would be cramped (per-platform dashboards in 1/3 width columns).
   */
  defaultView?: View;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  published: { label: 'Published', color: '#4CAF50' },
  scheduled: { label: 'Scheduled', color: '#FFC107' },
  draft: { label: 'Draft', color: '#9E9E9E' },
  queued: { label: 'Queued', color: '#2196F3' },
  failed: { label: 'Failed', color: '#F44336' },
};

export default function EmbeddedSocialCalendar({
  lockedPlatform,
  className,
  height = 600,
  defaultView,
}: EmbeddedSocialCalendarProps) {
  const authFetch = useAuthFetch();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>(lockedPlatform ?? 'all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchEvents = useCallback(async () => {
    try {
      const response = await authFetch('/api/social/calendar');
      const data = (await response.json()) as { success: boolean; events?: CalendarEventFromAPI[] };
      if (data.success && data.events) {
        const parsed: CalendarEvent[] = data.events.map((e) => ({
          ...e,
          start: new Date(e.start),
          end: new Date(e.end),
        }));
        setEvents(parsed);
      }
    } catch (error) {
      logger.error(
        'Failed to fetch calendar events',
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleSelectSlot = useCallback((_slotInfo: { start: Date; end: Date }) => {
    // future: open create-post modal
  }, []);

  // Pre-filter events by lockedPlatform so the locked variant only ever
  // sees the events for that platform — even if the toolbar control is
  // somehow changed.
  const scopedEvents = useMemo(() => {
    if (!lockedPlatform) { return events; }
    return events.filter((e) => e.platform === lockedPlatform);
  }, [events, lockedPlatform]);

  const handlePlatformFilter = useCallback(
    (value: string) => {
      // When locked, ignore changes — keep the dropdown anchored.
      if (lockedPlatform) {
        setPlatformFilter(lockedPlatform);
        return;
      }
      setPlatformFilter(value);
    },
    [lockedPlatform],
  );

  const PLATFORM_COLORS: Record<string, string> = useMemo(
    () =>
      Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, PLATFORM_META[p].color])),
    [],
  );

  const closeModal = useCallback(() => setSelectedEvent(null), []);

  return (
    <div className={className}>
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">
          Loading calendar events...
        </div>
      ) : (
        <SocialCalendar
          events={scopedEvents}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          platformFilter={platformFilter}
          statusFilter={statusFilter}
          onPlatformFilter={handlePlatformFilter}
          onStatusFilter={setStatusFilter}
          height={height}
          minHeight={Math.min(height, 400)}
          defaultView={defaultView}
          hidePlatformFilter={Boolean(lockedPlatform)}
        />
      )}

      {selectedEvent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={closeModal}
        >
          <div
            className="bg-surface-elevated rounded-xl border border-border-light p-6 max-w-[500px] w-[90%] max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <span
                className="px-2 py-0.5 rounded text-xs font-semibold text-white uppercase"
                style={{ backgroundColor: PLATFORM_COLORS[selectedEvent.platform] ?? '#666' }}
              >
                {selectedEvent.platform}
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold bg-card"
                style={{ color: STATUS_LABELS[selectedEvent.status]?.color ?? '#9E9E9E' }}
              >
                {STATUS_LABELS[selectedEvent.status]?.label ?? selectedEvent.status}
              </span>
            </div>

            <div className="text-sm text-foreground whitespace-pre-wrap mb-4 leading-relaxed">
              {selectedEvent.content}
            </div>

            <div className="text-xs text-muted-foreground mb-4">
              <div>Date: {selectedEvent.start.toLocaleString()}</div>
              {selectedEvent.mediaUrls && selectedEvent.mediaUrls.length > 0 && (
                <div>Media: {selectedEvent.mediaUrls.length} file(s)</div>
              )}
            </div>

            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 rounded-md border border-border-light bg-card text-muted-foreground text-sm cursor-pointer hover:bg-surface-elevated transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
