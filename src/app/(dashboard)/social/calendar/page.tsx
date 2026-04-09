'use client';

/**
 * Content Calendar Page
 * Visual calendar showing all scheduled, published, and draft posts.
 * Supports month/week/day/agenda views, filtering, and click-to-view details.
 */

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { CalendarEvent } from '@/components/social/CalendarEventCard';
import { logger } from '@/lib/logger/logger';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { SOCIAL_PLATFORMS } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { PageTitle, SectionDescription } from '@/components/ui/typography';

// Dynamic import to avoid SSR issues with react-big-calendar
const SocialCalendar = dynamic(() => import('@/components/social/SocialCalendar'), {
  ssr: false,
  loading: () => (
    <div className="py-12 text-center text-muted-foreground">
      Loading calendar...
    </div>
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

export default function ContentCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const authFetch = useAuthFetch();

  const fetchEvents = useCallback(async () => {
    try {
      const response = await authFetch('/api/social/calendar');
      const data = await response.json() as { success: boolean; events?: CalendarEventFromAPI[] };

      if (data.success && data.events) {
        const parsed: CalendarEvent[] = data.events.map((e) => ({
          ...e,
          start: new Date(e.start),
          end: new Date(e.end),
        }));
        setEvents(parsed);
      }
    } catch (error) {
      logger.error('Failed to fetch calendar events', error instanceof Error ? error : new Error(String(error)));
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
    // Could open a create-post modal pre-filled with the date
    // For now, just log
  }, []);

  const handleEventDrop = useCallback((data: { event: CalendarEvent; start: Date; end: Date }) => {
    // Reschedule the post via API
    void (async () => {
      try {
        await authFetch('/api/social/posts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId: data.event.id,
            scheduledFor: data.start.toISOString(),
          }),
        });

        // Optimistically update local state
        setEvents((prev) =>
          prev.map((e) =>
            e.id === data.event.id ? { ...e, start: data.start, end: data.end } : e
          )
        );
      } catch (error) {
        logger.error('Failed to reschedule', error instanceof Error ? error : new Error(String(error)));
      }
    })();
  }, [authFetch]);

  const closeModal = useCallback(() => setSelectedEvent(null), []);

  const PLATFORM_COLORS: Record<string, string> = Object.fromEntries(
    SOCIAL_PLATFORMS.map((p) => [p, PLATFORM_META[p].color])
  );

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    published: { label: 'Published', color: '#4CAF50' },
    scheduled: { label: 'Scheduled', color: '#FFC107' },
    draft: { label: 'Draft', color: '#9E9E9E' },
    queued: { label: 'Queued', color: '#2196F3' },
    failed: { label: 'Failed', color: '#F44336' },
  };

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <PageTitle>Content Calendar</PageTitle>
        <SectionDescription className="mt-1">All scheduled, published, and draft posts across platforms</SectionDescription>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">
          Loading calendar events...
        </div>
      ) : (
        <SocialCalendar
          events={events}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          onEventDrop={handleEventDrop}
          platformFilter={platformFilter}
          statusFilter={statusFilter}
          onPlatformFilter={setPlatformFilter}
          onStatusFilter={setStatusFilter}
        />
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={closeModal}
        >
          <div
            className="bg-surface-elevated rounded-xl border border-border-light p-6 max-w-[500px] w-[90%] max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
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

            {/* Content */}
            <div className="text-sm text-foreground whitespace-pre-wrap mb-4 leading-relaxed">
              {selectedEvent.content}
            </div>

            {/* Metadata */}
            <div className="text-xs text-muted-foreground mb-4">
              <div>Date: {selectedEvent.start.toLocaleString()}</div>
              {selectedEvent.mediaUrls && selectedEvent.mediaUrls.length > 0 && (
                <div>Media: {selectedEvent.mediaUrls.length} file(s)</div>
              )}
            </div>

            {/* Close */}
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
