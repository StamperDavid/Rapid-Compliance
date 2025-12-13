'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [ipWhitelistEnabled, setIpWhitelistEnabled] = useState(false);
  const [auditLogRetention, setAuditLogRetention] = useState('90');

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    }
  }, []);

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const auditLogs = [
    { id: 1, action: 'User Login', user: 'john@example.com', ip: '192.168.1.1', timestamp: '2025-11-25 09:30:15', status: 'success' },
    { id: 2, action: 'Settings Updated', user: 'jane@example.com', ip: '192.168.1.45', timestamp: '2025-11-25 08:15:22', status: 'success' },
    { id: 3, action: 'Failed Login Attempt', user: 'unknown@example.com', ip: '45.33.21.10', timestamp: '2025-11-25 07:45:33', status: 'failed' },
    { id: 4, action: 'API Key Created', user: 'john@example.com', ip: '192.168.1.1', timestamp: '2025-11-24 16:20:10', status: 'success' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Sidebar */}
        <div style={{ 
          width: sidebarOpen ? '260px' : '70px',
          backgroundColor: '#0a0a0a',
          borderRight: '1px solid #1a1a1a',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            <Link
              href="/crm"
              style={{
                width: '100%',
                padding: '0.875rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'transparent',
                color: '#999',
                borderLeft: '3px solid transparent',
                fontSize: '0.875rem',
                fontWeight: '400',
                textDecoration: 'none'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🏠</span>
              {sidebarOpen && <span>Back to CRM</span>}
            </Link>

            {Object.entries(STANDARD_SCHEMAS).map(([key, schema]) => (
              <Link
                key={key}
                href={`/crm?view=${key}`}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: 'transparent',
                  color: '#999',
                  borderLeft: '3px solid transparent',
                  fontSize: '0.875rem',
                  fontWeight: '400',
                  textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
                {sidebarOpen && <span>{schema.pluralName}</span>}
              </Link>
            ))}
          </nav>

          <div style={{ padding: '1rem', borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#1a1a1a',
                color: '#999',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              {sidebarOpen ? '← Collapse' : '→'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <Link href="/workspace/demo-org/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                ← Back to Settings
              </Link>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Security Settings</h1>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>
                Configure two-factor authentication, IP restrictions, and view audit logs
              </p>
            </div>

            {/* Two-Factor Authentication */}
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Two-Factor Authentication</h2>
                  <p style={{ fontSize: '0.875rem', color: '#999' }}>
                    Add an extra layer of security to your account
                  </p>
                </div>
                <button
                  onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: twoFactorEnabled ? '#f87171' : primaryColor,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}
                >
                  {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </button>
              </div>
              {twoFactorEnabled && (
                <div style={{ padding: '1rem', backgroundColor: '#0f4c0f', border: '1px solid #4ade80', borderRadius: '0.5rem', marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#4ade80', fontWeight: '600' }}>✓ Two-factor authentication is enabled</div>
                  <div style={{ fontSize: '0.75rem', color: '#86efac', marginTop: '0.25rem' }}>Your account is protected with TOTP authentication</div>
                </div>
              )}
            </div>

            {/* IP Whitelist */}
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>IP Restrictions</h2>
                  <p style={{ fontSize: '0.875rem', color: '#999' }}>
                    Limit access to your organization from specific IP addresses
                  </p>
                </div>
                <button
                  onClick={() => setIpWhitelistEnabled(!ipWhitelistEnabled)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: ipWhitelistEnabled ? '#f87171' : '#222',
                    color: '#fff',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}
                >
                  {ipWhitelistEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>
              {ipWhitelistEnabled && (
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                    Allowed IP Addresses (one per line)
                  </label>
                  <textarea
                    placeholder="192.168.1.0/24&#10;10.0.0.1"
                    rows={6}
                    style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem', fontFamily: 'monospace' }}
                  />
                </div>
              )}
            </div>

            {/* Session Settings */}
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Session Settings</h2>
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                    Session Timeout (minutes)
                  </label>
                  <select style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}>
                    <option value="15">15 minutes</option>
                    <option value="30" selected>30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="480">8 hours</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                    Audit Log Retention (days)
                  </label>
                  <select
                    value={auditLogRetention}
                    onChange={(e) => setAuditLogRetention(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
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
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Recent Audit Logs</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Action</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>User</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>IP Address</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Timestamp</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #222' }}>
                        <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>{log.action}</td>
                        <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#ccc' }}>{log.user}</td>
                        <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#999', fontFamily: 'monospace' }}>{log.ip}</td>
                        <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#999' }}>{log.timestamp}</td>
                        <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            backgroundColor: log.status === 'success' ? '#0f4c0f' : '#4c0f0f',
                            color: log.status === 'success' ? '#4ade80' : '#f87171',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            textTransform: 'capitalize'
                          }}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                <button style={{ padding: '0.5rem 1rem', backgroundColor: '#222', color: primaryColor, border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  Export All Logs
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

















