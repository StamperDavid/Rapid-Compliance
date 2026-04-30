'use client';

/**
 * AvailabilityPopout
 *
 * A dialog scoped to a single day that lets the operator edit that day's
 * working hours (on/off + start/end) plus the global timezone for the
 * booking config. Triggered from the day-header "Hours" button on the
 * unified calendar's month view.
 *
 * Hits the same PUT /api/settings/meeting-scheduler endpoint the old
 * dedicated Settings page used. The dialog loads the current config when
 * opened, mutates only the targeted day plus (optionally) the timezone,
 * and writes the full workingHours map back so the API's cross-field
 * validation stays happy.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type {
  AvailabilityConfig,
  DayHours,
  DayOfWeek,
} from '@/lib/meetings/availability-config-service';

const DAY_KEYS: DayOfWeek[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

const TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/Denver',     label: 'Mountain Time — Denver (MT)' },
  { value: 'America/Phoenix',    label: 'Mountain Time — Phoenix (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time — Los Angeles (PT)' },
  { value: 'America/Chicago',    label: 'Central Time — Chicago (CT)' },
  { value: 'America/New_York',   label: 'Eastern Time — New York (ET)' },
  { value: 'America/Anchorage',  label: 'Alaska Time — Anchorage' },
  { value: 'Pacific/Honolulu',   label: 'Hawaii Time — Honolulu' },
];

const DEFAULT_HOURS: DayHours = { enabled: true, start: '09:00', end: '17:00' };
const DEFAULT_OFF: DayHours = { enabled: false, start: '09:00', end: '17:00' };

const DEFAULT_CONFIG: AvailabilityConfig = {
  timezone: 'America/Denver',
  defaultMeetingDuration: 30,
  workingHours: {
    sunday: DEFAULT_OFF,
    monday: DEFAULT_HOURS,
    tuesday: DEFAULT_HOURS,
    wednesday: DEFAULT_HOURS,
    thursday: DEFAULT_HOURS,
    friday: DEFAULT_HOURS,
    saturday: DEFAULT_OFF,
  },
};

interface ConfigGetResponse {
  success: boolean;
  config?: AvailabilityConfig;
}

interface ConfigPutResponse {
  success: boolean;
  config?: AvailabilityConfig;
  error?: string;
}

function dayKeyForDate(date: Date): DayOfWeek {
  return DAY_KEYS[date.getDay()];
}

interface AvailabilityPopoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
}

export default function AvailabilityPopout({ open, onOpenChange, date }: AvailabilityPopoutProps) {
  const authFetch = useAuthFetch();
  const [config, setConfig] = useState<AvailabilityConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reload the config every time the popout opens. Cheap, and avoids
  // showing stale state if hours were changed in another tab.
  useEffect(() => {
    if (!open) { return; }
    setSaved(false);
    setError(null);
    setLoading(true);

    void (async () => {
      try {
        const res = await authFetch('/api/settings/meeting-scheduler');
        if (res.ok) {
          const data = (await res.json()) as ConfigGetResponse;
          if (data.success && data.config) {
            setConfig(data.config);
          }
        }
      } catch {
        // Defaults already populated; surface no error on initial load.
      } finally {
        setLoading(false);
      }
    })();
  }, [open, authFetch]);

  const dayKey: DayOfWeek | null = date ? dayKeyForDate(date) : null;
  const hours: DayHours | null = dayKey ? config.workingHours[dayKey] : null;
  const dateLabel = date
    ? date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const updateDay = (patch: Partial<DayHours>): void => {
    if (!dayKey) { return; }
    setConfig((prev) => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [dayKey]: { ...prev.workingHours[dayKey], ...patch },
      },
    }));
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    if (!dayKey) { return; }
    setSaving(true);
    setSaved(false);
    setError(null);

    const dayHours = config.workingHours[dayKey];
    if (dayHours.enabled && dayHours.start >= dayHours.end) {
      setError(`${DAY_LABELS[dayKey]}: end time must be later than start time.`);
      setSaving(false);
      return;
    }

    try {
      const res = await authFetch('/api/settings/meeting-scheduler', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone: config.timezone,
          defaultMeetingDuration: config.defaultMeetingDuration,
          workingHours: config.workingHours,
        }),
      });
      const data = (await res.json()) as ConfigPutResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to save');
      }
      if (data.config) { setConfig(data.config); }
      setSaved(true);
      // Brief success flash, then close. Save isn't destructive — no
      // two-step confirmation needed.
      window.setTimeout(() => { onOpenChange(false); }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [authFetch, config, dayKey, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            Hours for {dateLabel}
          </DialogTitle>
          <DialogDescription>
            Adjust the booking window for this day of the week. Saves apply
            to every {dayKey ? DAY_LABELS[dayKey] : 'day'} going forward.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading availability…</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="popout-timezone" className="block text-sm font-medium text-foreground mb-2">
                Timezone (applies to all days)
              </label>
              <select
                id="popout-timezone"
                value={config.timezone}
                onChange={(e) => {
                  setConfig((prev) => ({ ...prev, timezone: e.target.value }));
                  setSaved(false);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {TIMEZONES.find((t) => t.value === config.timezone) ? null : (
                  <option value={config.timezone}>{config.timezone}</option>
                )}
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {hours && dayKey ? (
              <div className="space-y-3 p-4 rounded-md border border-border-light">
                <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hours.enabled}
                    onChange={(e) => updateDay({ enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-input"
                  />
                  <span className="font-medium">
                    {hours.enabled ? `Available on ${DAY_LABELS[dayKey]}s` : `Off on ${DAY_LABELS[dayKey]}s`}
                  </span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div>
                    <label htmlFor="popout-start" className="block text-xs text-muted-foreground mb-1">
                      Start
                    </label>
                    <Input
                      id="popout-start"
                      type="time"
                      value={hours.start}
                      disabled={!hours.enabled}
                      onChange={(e) => updateDay({ start: e.target.value })}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground text-center pt-5">to</span>
                  <div>
                    <label htmlFor="popout-end" className="block text-xs text-muted-foreground mb-1">
                      End
                    </label>
                    <Input
                      id="popout-end"
                      type="time"
                      value={hours.end}
                      disabled={!hours.enabled}
                      onChange={(e) => updateDay({ end: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="p-3 rounded-md border border-destructive/50 bg-destructive/10 text-destructive-foreground text-sm">
                {error}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => { void handleSave(); }} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : saved ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
