/**
 * Audit Log Viewer
 * View all website builder events (publish, unpublish, domain changes, etc.)
 */

'use client';

import React, { useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';

interface AuditLogEntry {
  id: string;
  type: string;
  pageId?: string;
  pageTitle?: string;
  performedBy: string;
  performedAt: { toDate?: () => Date; seconds?: number } | Date | string;
  version?: number;
  scheduledFor?: string;
  domain?: string;
  details?: Record<string, unknown>;
}

export default function AuditLogPage() {
  const authFetch = useAuthFetch();

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const loadAuditLog = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await authFetch('/api/website/audit-log');

      if (!response.ok) {
        throw new Error('Failed to load audit log');
      }

      const data = await response.json() as { entries?: AuditLogEntry[] };
      setEntries(data.entries ?? []);
    } catch (err) {
      const error = err as Error;
      logger.error('[Audit Log] Error', err instanceof Error ? err : new Error(String(err)));
      setError(error.message ?? 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  React.useEffect(() => {
    void loadAuditLog();
  }, [loadAuditLog]);

  const filteredEntries = entries.filter(entry => {
    if (filter === 'all') {
      return true;
    }
    return entry.type === filter;
  });

  const eventTypes = [
    { value: 'all', label: 'All Events' },
    { value: 'page_published', label: 'Page Published' },
    { value: 'page_unpublished', label: 'Page Unpublished' },
    { value: 'page_scheduled', label: 'Page Scheduled' },
    { value: 'page_created', label: 'Page Created' },
    { value: 'page_updated', label: 'Page Updated' },
    { value: 'page_deleted', label: 'Page Deleted' },
    { value: 'domain_added', label: 'Domain Added' },
    { value: 'domain_verified', label: 'Domain Verified' },
    { value: 'domain_removed', label: 'Domain Removed' },
  ];

  function formatEventType(type: string): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function getEventColor(type: string): string {
    if (type.includes('published')) {
      return 'var(--color-success)';
    }
    if (type.includes('unpublished')) {
      return 'var(--color-warning)';
    }
    if (type.includes('scheduled')) {
      return 'var(--color-info)';
    }
    if (type.includes('deleted') || type.includes('removed')) {
      return 'var(--color-error)';
    }
    if (type.includes('created') || type.includes('added')) {
      return 'var(--color-success)';
    }
    if (type.includes('verified')) {
      return 'var(--color-secondary)';
    }
    return 'var(--color-text-disabled)';
  }

  function formatDate(timestamp: AuditLogEntry['performedAt']): string {
    if (!timestamp) {
      return 'Unknown';
    }

    let date: Date;
    if (typeof timestamp === 'object' && 'toDate' in timestamp && timestamp.toDate) {
      date = timestamp.toDate();
    } else if (typeof timestamp === 'object' && 'seconds' in timestamp && timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp as string | Date);
    }

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '2rem' }}>
            Website Audit Log
          </h1>
          <p style={{ color: 'var(--color-text-disabled)' }}>Loading audit log...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '2rem' }}>
            Website Audit Log
          </h1>
          <div style={{
            padding: '1rem',
            background: 'var(--color-error-light)',
            border: '1px solid var(--color-error-light)',
            borderRadius: '8px',
            color: 'var(--color-error-dark)',
          }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', background: 'var(--color-bg-elevated)', minHeight: '100vh' }}>

      <div>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Website Audit Log
          </h1>
          <p style={{ color: 'var(--color-text-disabled)' }}>
            Track all changes and events in your website builder
          </p>
        </div>

        {/* Filter Bar */}
        <div style={{
          background: 'var(--color-bg-paper)',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid var(--color-border-light)',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <label style={{ fontWeight: '500', color: 'var(--color-text-secondary)' }}>
            Filter:
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--color-border-light)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              background: 'var(--color-bg-paper)',
              cursor: 'pointer',
            }}
          >
            {eventTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <div style={{ marginLeft: 'auto', color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
            {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>

        {/* Audit Log Entries */}
        {filteredEntries.length === 0 ? (
          <div style={{
            background: 'var(--color-bg-paper)',
            padding: '3rem',
            borderRadius: '8px',
            border: '1px solid var(--color-border-light)',
            textAlign: 'center',
          }}>
            <p style={{ color: 'var(--color-text-disabled)', fontSize: '1rem' }}>
              No audit log entries found.
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Events will appear here as you publish pages, add domains, and make changes.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  background: 'var(--color-bg-paper)',
                  padding: '1.25rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border-light)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                }}
              >
                {/* Event Type Badge */}
                <div
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: getEventColor(entry.type),
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    minWidth: '140px',
                    textAlign: 'center',
                  }}
                >
                  {formatEventType(entry.type)}
                </div>

                {/* Event Details */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                    {entry.pageTitle ?? entry.domain ?? 'Event'}
                  </div>
                  
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)', marginBottom: '0.5rem' }}>
                    {entry.pageId && <span>Page ID: {entry.pageId}</span>}
                    {entry.version && <span> • Version {entry.version}</span>}
                    {entry.scheduledFor && (
                      <span> • Scheduled for {formatDate(entry.scheduledFor)}</span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    {formatDate(entry.performedAt)} • By {entry.performedBy}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

