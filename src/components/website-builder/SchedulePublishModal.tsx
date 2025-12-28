/**
 * Schedule Publish Modal
 * Allow users to schedule a page to be published at a future date/time
 */

'use client';

import { useState } from 'react';

interface SchedulePublishModalProps {
  pageTitle: string;
  onSchedule: (scheduledDate: string) => void;
  onCancel: () => void;
}

export default function SchedulePublishModal({
  pageTitle,
  onSchedule,
  onCancel,
}: SchedulePublishModalProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Set default to tomorrow at 9 AM
  useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    
    const dateStr = tomorrow.toISOString().split('T')[0];
    const timeStr = '09:00';
    
    setDate(dateStr);
    setTime(timeStr);
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!date || !time) {
      setError('Please select both date and time');
      return;
    }

    // Combine date and time
    const scheduledDateTime = new Date(`${date}T${time}`);
    
    // Validate it's in the future
    if (scheduledDateTime <= new Date()) {
      setError('Scheduled time must be in the future');
      return;
    }

    // Validate it's not too far in the future (e.g., 1 year)
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    if (scheduledDateTime > oneYearFromNow) {
      setError('Scheduled time cannot be more than 1 year in the future');
      return;
    }

    onSchedule(scheduledDateTime.toISOString());
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: 'system-ui',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
            Schedule Publish
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Choose when to automatically publish <strong>{pageTitle}</strong>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Date Input */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
              }}
            />
          </div>

          {/* Time Input */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
              }}
            />
          </div>

          {/* Timezone Notice */}
          <div
            style={{
              padding: '0.75rem',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              marginBottom: '1.5rem',
            }}
          >
            <p style={{ fontSize: '0.75rem', color: '#1e40af' }}>
              ℹ️ Time is in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
            </p>
          </div>

          {/* Preview */}
          {date && time && (
            <div
              style={{
                padding: '1rem',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                Will publish on:
              </div>
              <div style={{ fontWeight: '600', color: '#111827' }}>
                {new Date(`${date}T${time}`).toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '0.75rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '0.875rem',
                marginBottom: '1.5rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '0.75rem',
                background: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Schedule Publish
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


