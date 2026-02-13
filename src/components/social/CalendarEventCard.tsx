'use client';

/**
 * CalendarEventCard
 * Custom event component for react-big-calendar cells.
 * Shows platform icon, content preview, and status indicator.
 */

import React from 'react';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  platform: string;
  status: string;
  content: string;
  postId?: string;
  mediaUrls?: string[];
  accountId?: string;
}

const STATUS_DOT_COLORS: Record<string, string> = {
  published: '#4CAF50',
  scheduled: '#FFC107',
  draft: '#9E9E9E',
  failed: '#F44336',
  queued: '#2196F3',
  cancelled: '#757575',
};

interface CalendarEventCardProps {
  event: CalendarEvent;
}

export default function CalendarEventCard({ event }: CalendarEventCardProps) {
  const dotColor = STATUS_DOT_COLORS[event.status] ?? '#9E9E9E';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        overflow: 'hidden',
        lineHeight: 1.3,
      }}
    >
      {/* Status dot */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: dotColor,
          flexShrink: 0,
        }}
      />
      {/* Content preview */}
      <span style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: '0.6875rem',
      }}>
        {event.title}
      </span>
    </div>
  );
}
