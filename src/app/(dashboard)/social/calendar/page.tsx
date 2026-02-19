'use client';

/**
 * Content Calendar Page
 * Visual calendar showing all scheduled, published, and draft posts.
 * Supports month/week/day/agenda views, filtering, and click-to-view details.
 */

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { CalendarEvent } from '@/components/social/CalendarEventCard';
import SubpageNav from '@/components/ui/SubpageNav';
import { logger } from '@/lib/logger/logger';

const SOCIAL_NAV_ITEMS = [
  { label: 'Command Center', href: '/social/command-center' },
  { label: 'Campaigns', href: '/social/campaigns' },
  { label: 'Calendar', href: '/social/calendar' },
  { label: 'Approvals', href: '/social/approvals' },
  { label: 'Listening', href: '/social/listening' },
  { label: 'Activity', href: '/social/activity' },
  { label: 'Agent Rules', href: '/social/agent-rules' },
  { label: 'Playbook', href: '/social/playbook' },
];

// Dynamic import to avoid SSR issues with react-big-calendar
const SocialCalendar = dynamic(() => import('@/components/social/SocialCalendar'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
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

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/social/calendar');
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
  }, []);

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
        await fetch('/api/social/posts', {
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
  }, []);

  const closeModal = useCallback(() => setSelectedEvent(null), []);

  const PLATFORM_COLORS: Record<string, string> = {
    twitter: '#000',
    linkedin: '#0A66C2',
    facebook: '#1877F2',
    instagram: '#E1306C',
  };

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    published: { label: 'Published', color: '#4CAF50' },
    scheduled: { label: 'Scheduled', color: '#FFC107' },
    draft: { label: 'Draft', color: '#9E9E9E' },
    queued: { label: 'Queued', color: '#2196F3' },
    failed: { label: 'Failed', color: '#F44336' },
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
        Content Calendar
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        All scheduled, published, and draft posts across platforms
      </p>

      <SubpageNav items={SOCIAL_NAV_ITEMS} />

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
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
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
          onClick={closeModal}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: '0.75rem',
              border: '1px solid var(--color-border-light)',
              padding: '1.5rem',
              maxWidth: 500,
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: '#fff',
                backgroundColor: PLATFORM_COLORS[selectedEvent.platform] ?? '#666',
                textTransform: 'uppercase',
              }}>
                {selectedEvent.platform}
              </span>
              <span style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '1rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: STATUS_LABELS[selectedEvent.status]?.color ?? '#9E9E9E',
                backgroundColor: 'var(--color-bg-paper)',
              }}>
                {STATUS_LABELS[selectedEvent.status]?.label ?? selectedEvent.status}
              </span>
            </div>

            {/* Content */}
            <div style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre-wrap',
              marginBottom: '1rem',
              lineHeight: 1.6,
            }}>
              {selectedEvent.content}
            </div>

            {/* Metadata */}
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '1rem' }}>
              <div>Date: {selectedEvent.start.toLocaleString()}</div>
              {selectedEvent.mediaUrls && selectedEvent.mediaUrls.length > 0 && (
                <div>Media: {selectedEvent.mediaUrls.length} file(s)</div>
              )}
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={closeModal}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--color-border-light)',
                backgroundColor: 'var(--color-bg-paper)',
                color: 'var(--color-text-secondary)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
