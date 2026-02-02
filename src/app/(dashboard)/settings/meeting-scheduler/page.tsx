'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useState } from 'react';
import type { MeetingSchedulerConfig } from '@/lib/meetings/scheduler-engine';

export default function MeetingSchedulerConfigPage() {
  const _orgId = DEFAULT_ORG_ID as string;
  const [_configs, _setConfigs] = useState<MeetingSchedulerConfig[]>([]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Meeting Scheduler</h1>
          <p className="text-gray-400">Configure automated meeting booking</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + New Scheduler
        </button>
      </div>

      <div className="space-y-6">
        {/* Demo Scheduler */}
        <div className="bg-gray-900 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Product Demo</h3>
              <p className="text-sm text-gray-400">30-minute demo calls with round-robin assignment</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-400 mb-1">Duration</div>
              <div className="font-medium">30 minutes</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Buffer</div>
              <div className="font-medium">15 min before/after</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Assignment</div>
              <div className="font-medium">Round Robin</div>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Zoom Integration:</span>
              <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-xs">✓ Enabled</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Automated Reminders:</span>
              <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-xs">✓ Enabled (24h, 1h before)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Assigned to:</span>
              <span>5 team members</span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700">
              Edit
            </button>
            <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700">
              Get Booking Link
            </button>
          </div>
        </div>

        {/* Discovery Call Scheduler */}
        <div className="bg-gray-900 rounded-lg p-6 opacity-50">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Discovery Call</h3>
              <p className="text-sm text-gray-400">15-minute qualification calls</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="text-sm text-gray-400">
            Duration: 15 min • Buffer: 10 min • Assignment: Load Balance
          </div>
        </div>
      </div>

      <div className="mt-8 bg-blue-900/20 border border-blue-600 rounded-lg p-6">
        <h3 className="font-bold mb-2">📅 Meeting Scheduler Features</h3>
        <div className="text-sm text-gray-300 space-y-1">
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

