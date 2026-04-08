'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getSubCollection } from '@/lib/firebase/collections';
import { FirestoreService } from '@/lib/db/firestore-service';
import { orderBy, limit } from 'firebase/firestore';
import { PageTitle } from '@/components/ui/typography';

interface SecuritySettings {
  twoFactorEnabled: boolean;
  ipWhitelistEnabled: boolean;
  ipWhitelist: string;
  sessionTimeout: string;
  auditLogRetention: string;
  updatedAt?: string;
  updatedBy?: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  user: string;
  ip: string;
  timestamp: string;
  status: 'success' | 'failed';
  details?: string;
}

const DEFAULT_SETTINGS: SecuritySettings = {
  twoFactorEnabled: false,
  ipWhitelistEnabled: false,
  ipWhitelist: '',
  sessionTimeout: '30',
  auditLogRetention: '90',
};

const settingsPath = getSubCollection('securitySettings');
const auditLogsPath = getSubCollection('auditLogs');

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load security settings (single doc keyed 'config')
      const saved = await FirestoreService.get<SecuritySettings>(settingsPath, 'config');
      if (saved) {
        setSettings(saved);
      }

      // Load recent audit logs
      const logs = await FirestoreService.getAll<AuditLogEntry>(
        auditLogsPath,
        [orderBy('timestamp', 'desc'), limit(50)]
      );
      setAuditLogs(logs);
    } catch {
      toast.error('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [user, loadData]);

  const updateField = <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user) { return; }
    setSaving(true);
    try {
      await FirestoreService.set(settingsPath, 'config', {
        ...settings,
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
      }, true);
      setHasChanges(false);
      toast.success('Security settings saved');
    } catch {
      toast.error('Failed to save security settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-6 text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-muted-foreground no-underline text-sm">
            Settings
          </Link>
          <span className="text-muted-foreground">/</span>
          <PageTitle as="h1" className="text-xl font-semibold m-0">Security Settings</PageTitle>
        </div>
        {hasChanges && (
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className={`px-5 py-2 bg-primary text-white border-none rounded text-sm font-medium ${saving ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="max-w-4xl">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading security settings...
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Two-Factor Authentication */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-semibold mb-1">Two-Factor Authentication</h3>
                  <p className="text-sm text-muted-foreground m-0">
                    Require TOTP-based 2FA for all users
                  </p>
                </div>
                <button
                  onClick={() => updateField('twoFactorEnabled', !settings.twoFactorEnabled)}
                  className="border-none cursor-pointer relative transition-colors duration-200 flex-shrink-0"
                  style={{
                    width: '48px',
                    height: '26px',
                    borderRadius: '13px',
                    backgroundColor: settings.twoFactorEnabled ? 'var(--color-success)' : 'var(--color-bg-elevated)',
                  }}
                >
                  <span
                    className="absolute top-[3px] w-5 h-5 rounded-full bg-white transition-[left] duration-200"
                    style={{ left: settings.twoFactorEnabled ? '25px' : '3px' }}
                  />
                </button>
              </div>
              {settings.twoFactorEnabled && (
                <div className="mt-4 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-[var(--color-success)]">
                  2FA is enabled. All users will be required to set up an authenticator app.
                </div>
              )}
            </div>

            {/* IP Restrictions */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className={`flex justify-between items-start ${settings.ipWhitelistEnabled ? 'mb-4' : ''}`}>
                <div>
                  <h3 className="text-base font-semibold mb-1">IP Restrictions</h3>
                  <p className="text-sm text-muted-foreground m-0">
                    Limit access to specific IP addresses or CIDR ranges
                  </p>
                </div>
                <button
                  onClick={() => updateField('ipWhitelistEnabled', !settings.ipWhitelistEnabled)}
                  className="border-none cursor-pointer relative transition-colors duration-200 flex-shrink-0"
                  style={{
                    width: '48px',
                    height: '26px',
                    borderRadius: '13px',
                    backgroundColor: settings.ipWhitelistEnabled ? 'var(--color-success)' : 'var(--color-bg-elevated)',
                  }}
                >
                  <span
                    className="absolute top-[3px] w-5 h-5 rounded-full bg-white transition-[left] duration-200"
                    style={{ left: settings.ipWhitelistEnabled ? '25px' : '3px' }}
                  />
                </button>
              </div>
              {settings.ipWhitelistEnabled && (
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Allowed IP Addresses (one per line)
                  </label>
                  <textarea
                    value={settings.ipWhitelist}
                    onChange={(e) => updateField('ipWhitelist', e.target.value)}
                    placeholder={'192.168.1.0/24\n10.0.0.1'}
                    rows={5}
                    className="w-full p-3 bg-background border border-border rounded-lg text-foreground text-sm font-mono resize-y"
                  />
                </div>
              )}
            </div>

            {/* Session Settings */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold mb-4">Session &amp; Retention</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Session Timeout
                  </label>
                  <select
                    value={settings.sessionTimeout}
                    onChange={(e) => updateField('sessionTimeout', e.target.value)}
                    className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="480">8 hours</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Audit Log Retention
                  </label>
                  <select
                    value={settings.auditLogRetention}
                    onChange={(e) => updateField('auditLogRetention', e.target.value)}
                    className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm"
                  >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">1 year</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Audit Logs */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-border flex justify-between items-center">
                <h3 className="m-0 text-base font-semibold">Recent Audit Logs</h3>
                <span className="text-xs text-muted-foreground">
                  {auditLogs.length} entries
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No audit log entries yet. Activity will be recorded here automatically.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-6 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">IP</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-border">
                          <td className="px-6 py-3 text-sm font-medium">{log.action}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{log.user}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{log.ip}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-semibold capitalize ${log.status === 'success' ? 'bg-green-500/15 text-[var(--color-success)]' : 'bg-red-500/15 text-[var(--color-error)]'}`}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
