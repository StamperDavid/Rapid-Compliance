'use client';

/**
 * CalendarToolbar
 * Custom toolbar for react-big-calendar that matches the dark UI.
 * Includes view toggle, navigation, and filter dropdowns.
 */

import React from 'react';
import type { ToolbarProps, View } from 'react-big-calendar';
import type { CalendarEvent } from './CalendarEventCard';

const VIEW_OPTIONS: { key: View; label: string }[] = [
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
  { key: 'day', label: 'Day' },
  { key: 'agenda', label: 'Agenda' },
];

interface CalendarToolbarProps extends ToolbarProps<CalendarEvent, object> {
  platformFilter: string;
  statusFilter: string;
  onPlatformFilter: (value: string) => void;
  onStatusFilter: (value: string) => void;
}

export default function CalendarToolbar(props: CalendarToolbarProps) {
  const { label, onNavigate, onView, view, platformFilter, statusFilter, onPlatformFilter, onStatusFilter } = props;

  const selectStyle: React.CSSProperties = {
    padding: '0.375rem 0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-border-light)',
    backgroundColor: 'var(--color-bg-paper)',
    color: 'var(--color-text-secondary)',
    fontSize: '0.8125rem',
    cursor: 'pointer',
  };

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.375rem 0.75rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-border-light)',
    backgroundColor: active ? 'var(--color-primary)' : 'var(--color-bg-paper)',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    fontSize: '0.8125rem',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
  });

  const navButtonStyle: React.CSSProperties = {
    padding: '0.375rem 0.75rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-border-light)',
    backgroundColor: 'var(--color-bg-paper)',
    color: 'var(--color-text-secondary)',
    fontSize: '0.8125rem',
    cursor: 'pointer',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '1rem',
      flexWrap: 'wrap',
      gap: '0.5rem',
    }}>
      {/* Left: Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        <button type="button" onClick={() => onNavigate('TODAY')} style={navButtonStyle}>
          Today
        </button>
        <button type="button" onClick={() => onNavigate('PREV')} style={navButtonStyle}>
          &lt;
        </button>
        <button type="button" onClick={() => onNavigate('NEXT')} style={navButtonStyle}>
          &gt;
        </button>
        <span style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginLeft: '0.5rem',
        }}>
          {label}
        </span>
      </div>

      {/* Center: Filters */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <select
          value={platformFilter}
          onChange={(e) => onPlatformFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Platforms</option>
          <option value="twitter">Twitter</option>
          <option value="linkedin">LinkedIn</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Statuses</option>
          <option value="published">Published</option>
          <option value="scheduled">Scheduled</option>
          <option value="draft">Draft</option>
          <option value="queued">Queued</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Right: View Toggle */}
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onView(opt.key)}
            style={buttonStyle(view === opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
