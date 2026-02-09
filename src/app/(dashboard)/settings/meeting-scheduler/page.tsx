'use client';

import { useState } from 'react';
import type { MeetingSchedulerConfig } from '@/lib/meetings/scheduler-engine';

export default function MeetingSchedulerConfigPage() {
  const [_configs, _setConfigs] = useState<MeetingSchedulerConfig[]>([]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Meeting Scheduler</h1>
          <p className="text-[var(--color-text-secondary)]">Configure automated meeting booking</p>
        </div>
        <button className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-primary-dark)]">
          + New Scheduler
        </button>
      </div>

      <div className="space-y-6">
        {/* Demo Scheduler */}
        <div className="bg-[var(--color-bg-paper)] rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Product Demo</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">30-minute demo calls with round-robin assignment</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-[var(--color-border-light)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--color-border-light)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-[var(--color-text-secondary)] mb-1">Duration</div>
              <div className="font-medium">30 minutes</div>
            </div>
            <div>
              <div className="text-[var(--color-text-secondary)] mb-1">Buffer</div>
              <div className="font-medium">15 min before/after</div>
            </div>
            <div>
              <div className="text-[var(--color-text-secondary)] mb-1">Assignment</div>
              <div className="font-medium">Round Robin</div>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-secondary)]">Zoom Integration:</span>
              <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: 'var(--color-success)', color: 'var(--color-text-primary)', opacity: 0.7 }}>✓ Enabled</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-secondary)]">Automated Reminders:</span>
              <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: 'var(--color-success)', color: 'var(--color-text-primary)', opacity: 0.7 }}>✓ Enabled (24h, 1h before)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-secondary)]">Assigned to:</span>
              <span>5 team members</span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button className="px-4 py-2 bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] rounded hover:bg-[var(--color-border-light)]">
              Edit
            </button>
            <button className="px-4 py-2 bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] rounded hover:bg-[var(--color-border-light)]">
              Get Booking Link
            </button>
          </div>
        </div>

        {/* Discovery Call Scheduler */}
        <div className="bg-[var(--color-bg-paper)] rounded-lg p-6 opacity-50">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Discovery Call</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">15-minute qualification calls</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-[var(--color-border-light)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--color-border-light)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
            </label>
          </div>
          <div className="text-sm text-[var(--color-text-secondary)]">
            Duration: 15 min • Buffer: 10 min • Assignment: Load Balance
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-lg p-6" style={{ backgroundColor: 'var(--color-primary)', opacity: 0.2, borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-primary)' }}>
        <h3 className="font-bold mb-2">📅 Meeting Scheduler Features</h3>
        <div className="text-sm space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
          <p>✅ Round-robin assignment across team members</p>
          <p>✅ Automated Zoom meeting creation with join links</p>
          <p>✅ Email + SMS reminders (24h and 1h before meeting)</p>
          <p>✅ Buffer times to prevent back-to-back meetings</p>
          <p>✅ Working hours enforcement</p>
          <p>✅ Calendar sync (blocks busy times)</p>
        </div>
      </div>
    </div>
  );
}

