/**
 * Audit Log Viewer
 * View all website builder events (publish, unpublish, domain changes, etc.)
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import React, { useState } from 'react';

interface AuditLogEntry {
  id: string;
  type: string;
  pageId?: string;
  pageTitle?: string;
  performedBy: string;
  performedAt: { toDate?: () => Date; seconds?: number } | Date | string;
  organizationId: string;
  version?: number;
  scheduledFor?: string;
  domain?: string;
  details?: Record<string, unknown>;
}

export default function AuditLogPage() {
  const orgId = DEFAULT_ORG_ID;

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const loadAuditLog = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/website/audit-log?organizationId=${orgId}`);

      if (!response.ok) {
        throw new Error('Failed to load audit log');
      }

      const data = await response.json() as { entries?: AuditLogEntry[] };
      setEntries(data.entries ?? []);
    } catch (err) {
      const error = err as Error;
      console.error('[Audit Log] Error:', error);
      setError(error.message ?? 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

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
      return '#27ae60';
    }
    if (type.includes('unpublished')) {
      return '#e67e22';
    }
    if (type.includes('scheduled')) {
      return '#3498db';
    }
    if (type.includes('deleted') || type.includes('removed')) {
      return '#e74c3c';
    }
    if (type.includes('created') || type.includes('added')) {
      return '#2ecc71';
    }
    if (type.includes('verified')) {
      return '#9b59b6';
    }
    return '#95a5a6';
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
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '2rem' }}>
            Website Audit Log
          </h1>
          <p style={{ color: '#6b7280' }}>Loading audit log...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '2rem' }}>
            Website Audit Log
          </h1>
          <div style={{
            padding: '1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#991b1b',
          }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', background: '#f9fafb', minHeight: '100vh' }}>
      
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Website Audit Log
          </h1>
          <p style={{ color: '#6b7280' }}>
            Track all changes and events in your website builder
          </p>
        </div>

        {/* Filter Bar */}
        <div style={{
          background: 'white',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <label style={{ fontWeight: '500', color: '#374151' }}>
            Filter:
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            {eventTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <div style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '0.875rem' }}>
            {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>

        {/* Audit Log Entries */}
        {filteredEntries.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '3rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            textAlign: 'center',
          }}>
            <p style={{ color: '#6b7280', fontSize: '1rem' }}>
              No audit log entries found.
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Events will appear here as you publish pages, add domains, and make changes.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  background: 'white',
                  padding: '1.25rem',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
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
                  <div style={{ fontWeight: '500', color: '#111827', marginBottom: '0.25rem' }}>
                    {entry.pageTitle ?? entry.domain ?? 'Event'}
                  </div>
                  
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {entry.pageId && <span>Page ID: {entry.pageId}</span>}
                    {entry.version && <span> • Version {entry.version}</span>}
                    {entry.scheduledFor && (
                      <span> • Scheduled for {formatDate(entry.scheduledFor)}</span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
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

