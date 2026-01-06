/**
 * Notification Settings Component
 * 
 * Allows users to configure notification preferences.
 */

'use client';

import React, { useState, useEffect } from 'react';
import type { NotificationPreferences, NotificationCategory } from '@/lib/notifications/types';

interface NotificationSettingsProps {
  userId: string;
  orgId: string;
  className?: string;
}

export function NotificationSettings({ userId, orgId, className = '' }: NotificationSettingsProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  async function loadPreferences() {
    try {
      setLoading(true);
      
      const response = await fetch('/api/notifications/preferences', {
        headers: {
          'x-user-id': userId,
          'x-org-id': orgId,
        },
      });

      const data = await response.json();

      if (data.success) {
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  }

  async function savePreferences() {
    if (!preferences) {return;}

    try {
      setSaving(true);
      
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-org-id': orgId,
        },
        body: JSON.stringify(preferences),
      });

      const data = await response.json();

      if (data.success) {
        setPreferences(data.preferences);
        alert('Preferences saved successfully!');
      } else {
        alert('Failed to save preferences');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !preferences) {
    return (
      <div className={`bg-white rounded-lg shadow p-8 ${className}`}>
        <div className="text-center text-gray-500">Loading preferences...</div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Notification Settings</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure how and when you receive notifications
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Global Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">Enable Notifications</h3>
            <p className="text-sm text-gray-600">Receive notifications from the platform</p>
          </div>
          <button
            onClick={() => setPreferences({ ...preferences, enabled: !preferences.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              preferences.enabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preferences.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Channel Preferences */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4">Channels</h3>
          <div className="space-y-4">
            {/* Slack */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">Slack</span>
                  {preferences.channels.slack?.enabled && (
                    <span className="px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">Receive notifications in Slack</p>
              </div>
              <button
                onClick={() =>
                  setPreferences({
                    ...preferences,
                    channels: {
                      ...preferences.channels,
                      slack: {
                        ...preferences.channels.slack,
                        enabled: !preferences.channels.slack?.enabled,
                      },
                    },
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.channels.slack?.enabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
                disabled={!preferences.enabled}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.channels.slack?.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* In-App */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">In-App</span>
                  {preferences.channels.inApp?.enabled && (
                    <span className="px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">Receive notifications in the app</p>
              </div>
              <button
                onClick={() =>
                  setPreferences({
                    ...preferences,
                    channels: {
                      ...preferences.channels,
                      inApp: {
                        ...preferences.channels.inApp,
                        enabled: !preferences.channels.inApp?.enabled,
                      },
                    },
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.channels.inApp?.enabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
                disabled={!preferences.enabled}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.channels.inApp?.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Email */}
            <div className="flex items-start justify-between opacity-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">Email</span>
                  <span className="px-2 py-0.5 text-xs font-medium text-gray-700 bg-gray-100 rounded">
                    Coming Soon
                  </span>
                </div>
                <p className="text-sm text-gray-600">Receive notifications via email</p>
              </div>
            </div>
          </div>
        </div>

        {/* Batching Preferences */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4">Smart Batching</h3>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                Group similar notifications together to reduce notification fatigue
              </p>
              <div className="mt-2 text-xs text-gray-500">
                Critical and high priority notifications are always delivered immediately
              </div>
            </div>
            <button
              onClick={() =>
                setPreferences({
                  ...preferences,
                  batching: {
                    ...preferences.batching,
                    enabled: !preferences.batching.enabled,
                  },
                })
              }
              className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.batching.enabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              disabled={!preferences.enabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.batching.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Category Preferences */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4">Notification Categories</h3>
          <div className="space-y-3">
            {Object.entries(preferences.categories).map(([category, prefs]) => (
              <div key={category} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{formatCategory(category)}</span>
                <button
                  onClick={() =>
                    setPreferences({
                      ...preferences,
                      categories: {
                        ...preferences.categories,
                        [category]: {
                          ...prefs,
                          enabled: !prefs.enabled,
                        },
                      },
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs.enabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  disabled={!preferences.enabled}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <button
          onClick={savePreferences}
          disabled={saving || !preferences.enabled}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
