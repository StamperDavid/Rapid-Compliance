'use client';

/**
 * ScheduleMissionDialog — Modal for saving a completed mission as a reusable schedule.
 *
 * The user picks:
 * - A display name for the schedule (defaults to the mission title)
 * - How often it should auto-run (daily / weekly / biweekly / monthly / custom)
 * - An optional end date after which the schedule expires
 *
 * On submit, POSTs to /api/orchestrator/missions/schedules then calls onScheduled().
 */

import { useState, useId } from 'react';
import type { ScheduleFrequency } from '@/types/mission-schedule';

// ============================================================================
// PROPS
// ============================================================================

interface ScheduleMissionDialogProps {
  missionId: string;
  missionTitle: string;
  missionPrompt: string;
  onClose: () => void;
  onScheduled: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FREQUENCY_OPTIONS: { value: ScheduleFrequency; label: string; description: string }[] = [
  { value: 'daily',    label: 'Daily',      description: 'Every 24 hours' },
  { value: 'weekly',   label: 'Weekly',     description: 'Every 7 days' },
  { value: 'biweekly', label: 'Bi-weekly',  description: 'Every 14 days' },
  { value: 'monthly',  label: 'Monthly',    description: 'Every 30 days' },
  { value: 'custom',   label: 'Custom',     description: 'Set your own interval' },
];

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

// ============================================================================
// COMPONENT
// ============================================================================

export default function ScheduleMissionDialog({
  missionId,
  missionTitle,
  onClose,
  onScheduled,
}: ScheduleMissionDialogProps) {
  const formId = useId();

  const [name, setName] = useState<string>(missionTitle);
  const [frequency, setFrequency] = useState<ScheduleFrequency>('weekly');
  const [customHours, setCustomHours] = useState<string>('24');
  const [expiresEnabled, setExpiresEnabled] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Retrieve the auth token set by the Jasper orchestrator on the window object
  function getAuthToken(): string | undefined {
    if (typeof window === 'undefined') { return undefined; }
    return (window as Window & { __jasperAuthToken?: string }).__jasperAuthToken;
  }

  async function handleSubmit() {
    if (!name.trim()) { return; }
    if (frequency === 'custom') {
      const hours = parseInt(customHours, 10);
      if (isNaN(hours) || hours < 1) {
        setErrorMsg('Custom interval must be at least 1 hour.');
        return;
      }
    }
    if (expiresEnabled && !expiresAt) {
      setErrorMsg('Please choose an expiry date or select "Run indefinitely".');
      return;
    }

    setSubmitState('submitting');
    setErrorMsg('');

    try {
      const authToken = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const body: {
        sourceMissionId: string;
        name: string;
        frequency: ScheduleFrequency;
        customIntervalHours?: number;
        expiresAt?: string;
      } = {
        sourceMissionId: missionId,
        name: name.trim(),
        frequency,
      };

      if (frequency === 'custom') {
        body.customIntervalHours = parseInt(customHours, 10);
      }

      if (expiresEnabled && expiresAt) {
        // Convert local date string (YYYY-MM-DD) to ISO 8601 UTC
        body.expiresAt = new Date(expiresAt).toISOString();
      }

      const response = await fetch('/api/orchestrator/missions/schedules', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data: unknown = await response.json();
        const errData = data as { error?: string };
        setErrorMsg(errData?.error ?? 'Failed to create schedule. Please try again.');
        setSubmitState('error');
        return;
      }

      setSubmitState('success');

      // Brief pause so the user sees the success state before the dialog closes
      setTimeout(() => {
        onScheduled();
        onClose();
      }, 800);
    } catch {
      setErrorMsg('Network error. Please try again.');
      setSubmitState('error');
    }
  }

  const isSubmitting = submitState === 'submitting';
  const isSuccess = submitState === 'success';
  const canSubmit = name.trim().length > 0 && !isSubmitting && !isSuccess;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '1rem',
      }}
    >
      {/* Dialog panel */}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--color-surface, #1e1e2e)',
          border: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
          borderRadius: '0.75rem',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
          }}
        >
          <h2
            id={`${formId}-title`}
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--color-text-primary, #f1f1f3)',
            }}
          >
            Schedule This Mission
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.25rem',
              cursor: 'pointer',
              color: 'var(--color-text-secondary, #9ca3af)',
              fontSize: '1.25rem',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {/* Schedule name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label
              htmlFor={`${formId}-name`}
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--color-text-primary, #f1f1f3)',
              }}
            >
              Schedule name
            </label>
            <input
              id={`${formId}-name`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="e.g. Weekly lead scan"
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                color: 'var(--color-text-primary, #f1f1f3)',
                background: 'var(--color-bg, #12121a)',
                border: '1px solid var(--color-border-light, rgba(255,255,255,0.12))',
                borderRadius: '0.375rem',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Frequency */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--color-text-primary, #f1f1f3)',
              }}
            >
              Frequency
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {FREQUENCY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: `1px solid ${frequency === opt.value
                      ? 'var(--color-primary, #6366f1)'
                      : 'var(--color-border-light, rgba(255,255,255,0.08))'}`,
                    background: frequency === opt.value
                      ? 'rgba(99,102,241,0.08)'
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    name={`${formId}-frequency`}
                    value={opt.value}
                    checked={frequency === opt.value}
                    onChange={() => setFrequency(opt.value)}
                    style={{ accentColor: 'var(--color-primary, #6366f1)', flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      color: 'var(--color-text-primary, #f1f1f3)',
                      flex: 1,
                    }}
                  >
                    {opt.label}
                  </span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--color-text-secondary, #9ca3af)',
                    }}
                  >
                    {opt.description}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom interval */}
          {frequency === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label
                htmlFor={`${formId}-custom-hours`}
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary, #f1f1f3)',
                }}
              >
                Interval (hours)
              </label>
              <input
                id={`${formId}-custom-hours`}
                type="number"
                min={1}
                step={1}
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary, #f1f1f3)',
                  background: 'var(--color-bg, #12121a)',
                  border: '1px solid var(--color-border-light, rgba(255,255,255,0.12))',
                  borderRadius: '0.375rem',
                  outline: 'none',
                  width: '140px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Expiry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--color-text-primary, #f1f1f3)',
              }}
            >
              End date
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: `1px solid ${!expiresEnabled
                    ? 'var(--color-primary, #6366f1)'
                    : 'var(--color-border-light, rgba(255,255,255,0.08))'}`,
                  background: !expiresEnabled ? 'rgba(99,102,241,0.08)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name={`${formId}-expires`}
                  checked={!expiresEnabled}
                  onChange={() => setExpiresEnabled(false)}
                  style={{ accentColor: 'var(--color-primary, #6366f1)', flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'var(--color-text-primary, #f1f1f3)',
                  }}
                >
                  Run indefinitely
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: `1px solid ${expiresEnabled
                    ? 'var(--color-primary, #6366f1)'
                    : 'var(--color-border-light, rgba(255,255,255,0.08))'}`,
                  background: expiresEnabled ? 'rgba(99,102,241,0.08)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name={`${formId}-expires`}
                  checked={expiresEnabled}
                  onChange={() => setExpiresEnabled(true)}
                  style={{ accentColor: 'var(--color-primary, #6366f1)', flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'var(--color-text-primary, #f1f1f3)',
                    flex: 1,
                  }}
                >
                  Stop after
                </span>
                {expiresEnabled && (
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8125rem',
                      color: 'var(--color-text-primary, #f1f1f3)',
                      background: 'var(--color-bg, #12121a)',
                      border: '1px solid var(--color-border-light, rgba(255,255,255,0.12))',
                      borderRadius: '0.25rem',
                      outline: 'none',
                      colorScheme: 'dark',
                    }}
                  />
                )}
              </label>
            </div>
          </div>

          {/* Error message */}
          {errorMsg && (
            <p
              style={{
                margin: 0,
                fontSize: '0.75rem',
                color: 'var(--color-error, #ef4444)',
              }}
            >
              {errorMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '0.4375rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: 'var(--color-text-secondary, #9ca3af)',
              background: 'none',
              border: '1px solid var(--color-border-light, rgba(255,255,255,0.12))',
              borderRadius: '0.375rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => { void handleSubmit(); }}
            style={{
              padding: '0.4375rem 1.125rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#fff',
              background: canSubmit
                ? 'var(--color-primary, #6366f1)'
                : 'var(--color-text-disabled, #6b7280)',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s ease',
              minWidth: '120px',
            }}
          >
            {isSuccess
              ? 'Scheduled!'
              : isSubmitting
                ? 'Saving...'
                : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
