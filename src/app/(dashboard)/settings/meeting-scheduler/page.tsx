'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Save, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type {
  AvailabilityConfig,
  DayHours,
  DayOfWeek,
} from '@/lib/meetings/availability-config-service';

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

// Curated US-first list. Anything not here is still accepted by the API
// but won't appear in the dropdown — covers ~99% of expected operators.
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
    monday: DEFAULT_HOURS,
    tuesday: DEFAULT_HOURS,
    wednesday: DEFAULT_HOURS,
    thursday: DEFAULT_HOURS,
    friday: DEFAULT_HOURS,
    saturday: DEFAULT_OFF,
    sunday: DEFAULT_OFF,
  },
};

export default function MeetingSchedulerSettingsPage() {
  const authFetch = useAuthFetch();
  const [config, setConfig] = useState<AvailabilityConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await authFetch('/api/settings/meeting-scheduler');
        if (res.ok) {
          const data = (await res.json()) as { success: boolean; config: AvailabilityConfig };
          if (data.success && data.config) {
            setConfig(data.config);
          }
        }
      } catch {
        // Defaults already populated; surface no error on initial load
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch]);

  const updateDay = (day: DayOfWeek, patch: Partial<DayHours>): void => {
    setConfig((prev) => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: { ...prev.workingHours[day], ...patch },
      },
    }));
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    // Local cross-field guard so the user gets immediate feedback for the
    // common end-before-start typo without round-tripping to the server.
    for (const { key, label } of DAYS) {
      const h = config.workingHours[key];
      if (h.enabled && h.start >= h.end) {
        setError(`${label}: end time must be later than start time.`);
        setSaving(false);
        return;
      }
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
      const data = (await res.json()) as { success: boolean; error?: string; config?: AvailabilityConfig };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to save');
      }
      if (data.config) { setConfig(data.config); }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [authFetch, config]);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading availability…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-7 h-7 text-primary" />
            <PageTitle>Meeting Availability</PageTitle>
          </div>
          <SectionDescription>
            When prospects can book demos with you, and when Jasper can schedule
            internal meetings on your calendar. Changes apply immediately.
          </SectionDescription>
        </div>
        <Button onClick={() => { void handleSave(); }} disabled={saving} size="lg">
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
      </div>

      {error ? (
        <div className="p-4 rounded-md border border-destructive/50 bg-destructive/10 text-destructive-foreground text-sm">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>
            The timezone your hours are written in, and the default length of a
            booked meeting.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-foreground mb-2">
              Timezone
            </label>
            <select
              id="timezone"
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
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-foreground mb-2">
              Default meeting length (minutes)
            </label>
            <Input
              id="duration"
              type="number"
              min={15}
              max={120}
              step={15}
              value={config.defaultMeetingDuration}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n)) {
                  setConfig((prev) => ({ ...prev, defaultMeetingDuration: n }));
                  setSaved(false);
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Working hours</CardTitle>
          <CardDescription>
            Toggle a day off entirely, or set the window when meetings can be
            booked. Times are in the timezone you picked above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const hours = config.workingHours[key];
            return (
              <div
                key={key}
                className="grid grid-cols-1 md:grid-cols-[120px_80px_1fr_auto_1fr] items-center gap-3 p-3 rounded-md border border-border-light"
              >
                <div className="font-medium text-foreground">{label}</div>
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hours.enabled}
                    onChange={(e) => updateDay(key, { enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-input"
                  />
                  <span>{hours.enabled ? 'On' : 'Off'}</span>
                </label>
                <Input
                  type="time"
                  value={hours.start}
                  disabled={!hours.enabled}
                  onChange={(e) => updateDay(key, { start: e.target.value })}
                />
                <span className="text-sm text-muted-foreground text-center">to</span>
                <Input
                  type="time"
                  value={hours.end}
                  disabled={!hours.enabled}
                  onChange={(e) => updateDay(key, { end: e.target.value })}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
