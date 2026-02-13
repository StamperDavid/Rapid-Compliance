'use client';

/**
 * Social Media Activity Feed
 * Curated narrative of what the AI agent did and why — decision transparency.
 *
 * Shows published posts, scheduled content, approval triggers, failures, and cancellations.
 * Each event includes reasoning when available, providing full visibility into agent behavior.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActivityEvent {
  id: string;
  type: 'published' | 'scheduled' | 'queued' | 'approval_triggered' | 'failed' | 'cancelled';
  platform: 'twitter' | 'linkedin';
  content: string;
  reason?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ActivityResponse {
  success: boolean;
  events: ActivityEvent[];
  total: number;
}

type FilterType = 'all' | 'published' | 'scheduled' | 'flagged' | 'failed';

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#000000',
  linkedin: '#0A66C2',
};

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  published: { color: '#4CAF50', label: 'Published', icon: '✓' },
  scheduled: { color: '#2196F3', label: 'Scheduled', icon: '◷' },
  queued: { color: '#9C27B0', label: 'Queued', icon: '≡' },
  approval_triggered: { color: '#FF9800', label: 'Flagged', icon: '⚑' },
  failed: { color: '#F44336', label: 'Failed', icon: '✗' },
  cancelled: { color: '#9E9E9E', label: 'Cancelled', icon: '—' },
};

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'failed', label: 'Failed' },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ActivityFeedPage() {
  const { user: _user } = useUnifiedAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/social/activity?limit=30');
      const data = (await response.json()) as ActivityResponse;

      if (data.success) {
        setEvents(data.events);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) {
      return 'just now';
    }
    if (diffMin < 60) {
      return `${diffMin}m ago`;
    }
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) {
      return `${diffHr}h ago`;
    }
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return d.toLocaleDateString();
  };

  const getFilteredEvents = () => {
    if (activeFilter === 'all') {
      return events;
    }
    if (activeFilter === 'flagged') {
      return events.filter((e) => e.type === 'approval_triggered');
    }
    return events.filter((e) => e.type === activeFilter);
  };

  const filteredEvents = getFilteredEvents();

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
          Activity Feed
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
          What the AI social media agent did and why — full decision transparency.
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.5rem' }}>
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          const count = tab.key === 'all' ? total : tab.key === 'flagged' ? events.filter((e) => e.type === 'approval_triggered').length : events.filter((e) => e.type === tab.key).length;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveFilter(tab.key);
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? '#fff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.2s',
              }}
            >
              {tab.label} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)' }}>
          Loading activity...
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredEvents.length === 0 && (
        <div
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            backgroundColor: 'var(--color-bg-paper)',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border-light)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            No activity yet
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            {activeFilter === 'all'
              ? 'The agent will log all actions here as it operates.'
              : `No ${activeFilter} events to display.`}
          </p>
        </div>
      )}

      {/* Event Cards */}
      {!loading && filteredEvents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredEvents.map((event) => {
            const config = EVENT_TYPE_CONFIG[event.type] ?? EVENT_TYPE_CONFIG.cancelled;
            return (
              <div
                key={event.id}
                style={{
                  padding: '1rem 1.25rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border-light)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                }}
              >
                {/* Event Type Badge */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontWeight: 700,
                    backgroundColor: `${config.color}20`,
                    color: config.color,
                    flexShrink: 0,
                  }}
                >
                  {config.icon}
                </div>

                {/* Content Section */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Platform Badge + Event Type */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        color: '#fff',
                        backgroundColor: PLATFORM_COLORS[event.platform] ?? '#666',
                        textTransform: 'uppercase',
                      }}
                    >
                      {event.platform}
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: config.color }}>
                      {config.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginLeft: 'auto' }}>
                      {formatTime(event.timestamp)}
                    </span>
                  </div>

                  {/* Content Preview */}
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-text-primary)',
                      lineHeight: 1.5,
                      marginBottom: event.reason ? '0.5rem' : 0,
                    }}
                  >
                    {event.content}
                  </div>

                  {/* Decision Transparency: Reason */}
                  {event.reason && (
                    <div
                      style={{
                        padding: '0.75rem',
                        backgroundColor: `${config.color}10`,
                        borderLeft: `3px solid ${config.color}`,
                        borderRadius: '0.25rem',
                      }}
                    >
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: config.color, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                        Decision Reason
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>
                        {event.reason}
                      </div>
                    </div>
                  )}

                  {/* Engagement Metadata (for published posts) */}
                  {event.type === 'published' && event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      {event.metadata.likes !== undefined && (
                        <span>
                          ❤️ {event.metadata.likes as number} likes
                        </span>
                      )}
                      {event.metadata.shares !== undefined && (
                        <span>
                          🔁 {event.metadata.shares as number} shares
                        </span>
                      )}
                      {event.metadata.comments !== undefined && (
                        <span>
                          💬 {event.metadata.comments as number} comments
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Footer */}
      {!loading && events.length > 0 && (
        <div
          style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: 'var(--color-bg-paper)',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
          }}
        >
          <span>
            Showing {filteredEvents.length} of {total} total events
          </span>
          <button
            type="button"
            onClick={() => {
              void fetchActivity();
            }}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-bg-paper)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
