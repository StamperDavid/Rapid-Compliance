'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import type { AdminAuditLog } from '@/types/admin';

export default function AuditLogsPage() {
  useAdminAuth();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterAdmin, setFilterAdmin] = useState<string>('all');

  useEffect(() => {
    setTimeout(() => {
      const mockLogs: AdminAuditLog[] = [
        {
          id: 'log-1',
          adminId: 'admin-1',
          adminEmail: 'admin@platform.com',
          action: 'organization.suspended',
          resourceType: 'organization',
          resourceId: 'org-3',
          details: { reason: 'Payment failed' },
          timestamp: { seconds: new Date('2024-03-20T10:30:00').getTime() / 1000, nanoseconds: 0 } as import('firebase/firestore').Timestamp,
        },
        {
          id: 'log-2',
          adminId: 'admin-1',
          adminEmail: 'admin@platform.com',
          action: 'user.impersonated',
          resourceType: 'user',
          resourceId: 'user-1',
          details: { reason: 'Support ticket #1234' },
          timestamp: { seconds: new Date('2024-03-20T09:15:00').getTime() / 1000, nanoseconds: 0 } as import('firebase/firestore').Timestamp,
        },
        {
          id: 'log-3',
          adminId: 'admin-1',
          adminEmail: 'admin@platform.com',
          action: 'subscription.updated',
          resourceType: 'subscription',
          resourceId: 'sub-1',
          details: { plan: 'enterprise', previousPlan: 'pro' },
          timestamp: { seconds: new Date('2024-03-19T14:20:00').getTime() / 1000, nanoseconds: 0 } as import('firebase/firestore').Timestamp,
        },
      ];
      setLogs(mockLogs);
      setLoading(false);
    }, 500);
  }, []);

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));
  const uniqueAdmins = Array.from(new Set(logs.map(l => l.adminEmail)));

  const filteredLogs = logs.filter(log => {
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesAdmin = filterAdmin === 'all' || log.adminEmail === filterAdmin;
    return matchesAction && matchesAdmin;
  });

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Audit Logs
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Track all admin actions across the platform
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          style={{
            padding: '0.625rem 1rem',
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem'
          }}
        >
          <option value="all">All Actions</option>
          {uniqueActions.map(action => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>
        <select
          value={filterAdmin}
          onChange={(e) => setFilterAdmin(e.target.value)}
          style={{
            padding: '0.625rem 1rem',
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem'
          }}
        >
          <option value="all">All Admins</option>
          {uniqueAdmins.map(admin => (
            <option key={admin} value={admin}>{admin}</option>
          ))}
        </select>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          Loading audit logs...
        </div>
      ) : (
        <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Timestamp</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Admin</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Action</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Resource</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#999' }}>
                    {log.timestamp && typeof log.timestamp === 'object' && 'seconds' in log.timestamp
                      ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                      : new Date().toLocaleString()}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{log.adminEmail}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: '#1a1a1a',
                      color: '#fff'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#999' }}>
                    {log.resourceType}: {log.resourceId}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#666' }}>
                    {log.details ? JSON.stringify(log.details, null, 2) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLogs.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
              No audit logs found
            </div>
          )}
        </div>
      )}
    </div>
  );
}























