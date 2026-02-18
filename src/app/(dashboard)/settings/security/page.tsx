'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getSubCollection } from '@/lib/firebase/collections';
import { FirestoreService } from '@/lib/db/firestore-service';
import { orderBy, limit } from 'firebase/firestore';

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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem 2rem',
        borderBottom: '1px solid var(--color-bg-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/settings" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
            Settings
          </Link>
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Security Settings</h1>
        </div>
        {hasChanges && (
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            Loading security settings...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Two-Factor Authentication */}
            <div style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-bg-elevated)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>Two-Factor Authentication</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Require TOTP-based 2FA for all users
                  </p>
                </div>
                <button
                  onClick={() => updateField('twoFactorEnabled', !settings.twoFactorEnabled)}
                  style={{
                    width: '48px',
                    height: '26px',
                    borderRadius: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: settings.twoFactorEnabled ? 'var(--color-success)' : 'var(--color-bg-elevated)',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: settings.twoFactorEnabled ? '25px' : '3px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
              {settings.twoFactorEnabled && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--color-success)',
                }}>
                  2FA is enabled. All users will be required to set up an authenticator app.
                </div>
              )}
            </div>

            {/* IP Restrictions */}
            <div style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-bg-elevated)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: settings.ipWhitelistEnabled ? '1rem' : '0' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>IP Restrictions</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Limit access to specific IP addresses or CIDR ranges
                  </p>
                </div>
                <button
                  onClick={() => updateField('ipWhitelistEnabled', !settings.ipWhitelistEnabled)}
                  style={{
                    width: '48px',
                    height: '26px',
                    borderRadius: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: settings.ipWhitelistEnabled ? 'var(--color-success)' : 'var(--color-bg-elevated)',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: settings.ipWhitelistEnabled ? '25px' : '3px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
              {settings.ipWhitelistEnabled && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Allowed IP Addresses (one per line)
                  </label>
                  <textarea
                    value={settings.ipWhitelist}
                    onChange={(e) => updateField('ipWhitelist', e.target.value)}
                    placeholder={'192.168.1.0/24\n10.0.0.1'}
                    rows={5}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: '1px solid var(--color-bg-elevated)',
                      borderRadius: '0.5rem',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                      fontFamily: 'monospace',
                      resize: 'vertical',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Session Settings */}
            <div style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-bg-elevated)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Session & Retention</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Session Timeout
                  </label>
                  <select
                    value={settings.sessionTimeout}
                    onChange={(e) => updateField('sessionTimeout', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: '1px solid var(--color-bg-elevated)',
                      borderRadius: '0.375rem',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="480">8 hours</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Audit Log Retention
                  </label>
                  <select
                    value={settings.auditLogRetention}
                    onChange={(e) => updateField('auditLogRetention', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: '1px solid var(--color-bg-elevated)',
                      borderRadius: '0.375rem',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                    }}
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
            <div style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-bg-elevated)',
              borderRadius: '0.75rem',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--color-bg-elevated)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Recent Audit Logs</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {auditLogs.length} entries
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  No audit log entries yet. Activity will be recorded here automatically.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-bg-elevated)' }}>
                        <th style={{ textAlign: 'left', padding: '0.625rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                        <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User</th>
                        <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>IP</th>
                        <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</th>
                        <th style={{ textAlign: 'center', padding: '0.625rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--color-bg-elevated)' }}>
                          <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.8125rem', fontWeight: 500 }}>{log.action}</td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{log.user}</td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{log.ip}</td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <span style={{
                              padding: '0.125rem 0.5rem',
                              borderRadius: '9999px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              backgroundColor: log.status === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: log.status === 'success' ? 'var(--color-success)' : 'var(--color-error)',
                              textTransform: 'capitalize',
                            }}>
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
