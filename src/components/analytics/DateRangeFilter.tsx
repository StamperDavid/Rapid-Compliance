'use client';

/**
 * Date Range Filter Component
 *
 * Provides date range selection for analytics with preset options:
 * - Last 7 days
 * - Last 30 days
 * - Last 90 days
 * - Custom range
 *
 * Hunter-Closer compliant - native component, no third-party date pickers.
 */

import React, { useState } from 'react';
import { useToast } from '@/hooks/useToast';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  preset?: '7d' | '30d' | '90d' | 'custom';
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export function DateRangeFilter({ value, onChange, className = '' }: DateRangeFilterProps) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState(formatDateForInput(value.startDate));
  const [customEnd, setCustomEnd] = useState(formatDateForInput(value.endDate));
  const { error } = useToast();

  const presets = [
    { label: 'Last 7 Days', value: '7d' as const, days: 7 },
    { label: 'Last 30 Days', value: '30d' as const, days: 30 },
    { label: 'Last 90 Days', value: '90d' as const, days: 90 },
    { label: 'Custom Range', value: 'custom' as const, days: 0 },
  ];

  const handlePresetClick = (preset: typeof presets[0]) => {
    if (preset.value === 'custom') {
      setShowCustomPicker(true);
      return;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - preset.days);

    onChange({
      startDate,
      endDate,
      preset: preset.value,
    });
    setShowCustomPicker(false);
  };

  const handleCustomApply = () => {
    const startDate = new Date(customStart);
    const endDate = new Date(customEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      error('Please enter valid dates');
      return;
    }

    if (startDate > endDate) {
      error('Start date must be before end date');
      return;
    }

    onChange({
      startDate,
      endDate,
      preset: 'custom',
    });
    setShowCustomPicker(false);
  };

  return (
    <div className={className} style={{ position: 'relative' }}>
      {/* Preset Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: value.preset === preset.value ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
              color: value.preset === preset.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              border: `1px solid ${value.preset === preset.value ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (value.preset !== preset.value) {
                e.currentTarget.style.backgroundColor = 'var(--color-neutral-800)';
                e.currentTarget.style.borderColor = 'var(--color-border-strong)';
              }
            }}
            onMouseLeave={(e) => {
              if (value.preset !== preset.value) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                e.currentTarget.style.borderColor = 'var(--color-border-light)';
              }
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Current Range Display */}
      <div style={{
        marginTop: '0.75rem',
        padding: '0.75rem 1rem',
        backgroundColor: 'var(--color-bg-paper)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        color: 'var(--color-text-secondary)',
      }}>
        <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>Selected Range:</span>
        {' '}
        {formatDateDisplay(value.startDate)} - {formatDateDisplay(value.endDate)}
        {' '}
        <span style={{ color: 'var(--color-text-disabled)' }}>
          ({getDaysDifference(value.startDate, value.endDate)} days)
        </span>
      </div>

      {/* Custom Date Picker Modal */}
      {showCustomPicker && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg-paper)',
            borderRadius: '1rem',
            border: '1px solid var(--color-border-light)',
            padding: '1.5rem',
            maxWidth: '28rem',
            width: '100%',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
              Select Custom Date Range
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setShowCustomPicker(false)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomApply}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-primary)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                  }}
                >
                  Apply Range
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDaysDifference(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
