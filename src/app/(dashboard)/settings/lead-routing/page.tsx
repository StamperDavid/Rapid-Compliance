'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import { useEffect, useState } from 'react';
import type { RoutingRule } from '@/lib/crm/lead-routing';

export default function LeadRoutingPage() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRules = () => {
      try {
        // Load routing rules from API
        setLoading(false);
      } catch (error) {
        console.error('Error loading routing rules:', error);
        setLoading(false);
      }
    };
    loadRules();
  }, []);

  const _toggleRule = (ruleId: string, enabled: boolean) => {
    // Update rule status
    setRules(rules.map(r => r.id === ruleId ? { ...r, enabled } : r));
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Lead Routing</h1>
          <p className="text-gray-400">Automatically assign leads to the right team members</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + New Routing Rule
        </button>
      </div>

      <div className="grid gap-6">
        {/* Round Robin Rule */}
        <div className="bg-gray-900 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Round Robin - All Leads</h3>
              <p className="text-sm text-gray-400">Distribute leads evenly across all sales reps</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Type:</span>
              <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded">Round Robin</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Assigned Users:</span>
              <span>All sales reps (5)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Priority:</span>
              <span>100 (Highest)</span>
            </div>
          </div>
        </div>

        {/* Territory Rule Example */}
        <div className="bg-gray-900 rounded-lg p-6 opacity-50">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Territory - West Coast</h3>
              <p className="text-sm text-gray-400">Route CA, OR, WA leads to Sarah Johnson</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Type:</span>
              <span className="px-2 py-1 bg-purple-900 text-purple-300 rounded">Territory</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">States:</span>
              <span>CA, OR, WA</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Priority:</span>
              <span>90</span>
            </div>
          </div>
        </div>

        {/* Load Balance Rule Example */}
        <div className="bg-gray-900 rounded-lg p-6 opacity-50">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Load Balance - Enterprise Leads</h3>
              <p className="text-sm text-gray-400">Distribute based on current workload (max 20/week)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Type:</span>
              <span className="px-2 py-1 bg-green-900 text-green-300 rounded">Load Balance</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Max per user:</span>
              <span>20 leads/week</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Priority:</span>
              <span>80</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-blue-900/20 border border-blue-600 rounded-lg p-6">
        <h3 className="font-bold mb-2">💡 How Lead Routing Works</h3>
        <div className="text-sm text-gray-300 space-y-1">
          <p>• Rules are evaluated in priority order (highest first)</p>
          <p>• First matching rule assigns the lead</p>
          <p>• If no rules match, falls back to round-robin</p>
          <p>• Routing happens automatically when leads are created</p>
        </div>
      </div>
    </div>
  );
}

