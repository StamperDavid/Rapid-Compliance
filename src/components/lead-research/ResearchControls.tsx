'use client';

import { useState } from 'react';
import { Play, Clock, Zap, Loader2 } from 'lucide-react';
import type { ResearchSchedule, ScheduleFrequency } from '@/types/lead-research';

interface ResearchControlsProps {
  schedule: ResearchSchedule | null;
  scheduleLoading: boolean;
  onRunNow: () => Promise<void>;
  onUpdateSchedule: (updates: Partial<ResearchSchedule>) => Promise<void>;
}

const FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function ResearchControls({
  schedule,
  scheduleLoading,
  onRunNow,
  onUpdateSchedule,
}: ResearchControlsProps) {
  const [running, setRunning] = useState(false);

  const handleRunNow = async () => {
    setRunning(true);
    try {
      await onRunNow();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="border-t border-[var(--color-border-light)] p-3 space-y-3">
      <button
        onClick={() => void handleRunNow()}
        disabled={running}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-medium hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 transition-all"
      >
        {running ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        {running ? 'Starting...' : 'Start Research Now'}
      </button>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <Clock className="w-3.5 h-3.5" />
            Schedule
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={schedule?.enabled ?? false}
              onChange={e => void onUpdateSchedule({ enabled: e.target.checked })}
              disabled={scheduleLoading}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-[var(--color-bg-main)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 border border-[var(--color-border-light)]" />
          </label>
        </div>

        {schedule?.enabled && (
          <select
            value={schedule.frequency}
            onChange={e => void onUpdateSchedule({ frequency: e.target.value as ScheduleFrequency })}
            className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
          >
            {FREQUENCIES.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <Zap className="w-3.5 h-3.5" />
            Auto-approve above
          </div>
          <input
            type="number"
            min={0}
            max={100}
            value={schedule?.autoApproveThreshold ?? 80}
            onChange={e => void onUpdateSchedule({ autoApproveThreshold: Number(e.target.value) })}
            className="w-14 bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded px-2 py-1 text-xs text-[var(--color-text-primary)] text-center focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
