'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';
import type { User } from '@/types/user';

export default function UsersPage() {
  const { adminUser, hasPermission } = useAdminAuth();
  const [users, setUsers] = useState<(User & { organizationId: string; organizationName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState<string>('all');

  useEffect(() => {
    // Load users
    setTimeout(() => {
      const mockUsers: (User & { organizationId: string; organizationName: string })[] = [
        {
          id: 'user-1',
          email: 'john@acme.com',
          profile: {
            firstName: 'John',
            lastName: 'Doe',
            displayName: 'John Doe',
            timezone: 'America/New_York',
          },
          preferences: {
            theme: 'dark',
            language: 'en',
            notifications: { email: true, push: true, slack: false },
          },
          createdAt: new Date('2023-01-20') as any,
          updatedAt: new Date() as any,
          lastLoginAt: new Date() as any,
          status: 'active',
          emailVerified: true,
          organizationId: 'org-1',
          organizationName: 'Acme Corporation',
        },
        {
          id: 'user-2',
          email: 'jane@techstart.com',
          profile: {
            firstName: 'Jane',
            lastName: 'Smith',
            displayName: 'Jane Smith',
            timezone: 'America/Los_Angeles',
          },
          preferences: {
            theme: 'light',
            language: 'en',
            notifications: { email: true, push: false, slack: true },
          },
          createdAt: new Date('2024-02-05') as any,
          updatedAt: new Date() as any,
          lastLoginAt: new Date() as any,
          status: 'active',
          emailVerified: true,
          organizationId: 'org-2',
          organizationName: 'TechStart Inc',
        },
        {
          id: 'user-3',
          email: 'bob@globalservices.com',
          profile: {
            firstName: 'Bob',
            lastName: 'Johnson',
            displayName: 'Bob Johnson',
            timezone: 'UTC',
          },
          preferences: {
            theme: 'dark',
            language: 'en',
            notifications: { email: false, push: false, slack: false },
          },
          createdAt: new Date('2024-03-12') as any,
          updatedAt: new Date() as any,
          lastLoginAt: new Date('2024-03-15') as any,
          status: 'suspended',
          emailVerified: true,
          organizationId: 'org-3',
          organizationName: 'Global Services',
        },
      ];
      setUsers(mockUsers);
      setLoading(false);
    }, 500);
  }, []);

  const uniqueOrgs = Array.from(new Set(users.map(u => u.organizationId)));
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.profile.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrg = filterOrg === 'all' || user.organizationId === filterOrg;
    return matchesSearch && matchesOrg;
  });

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Users
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Manage all users across all organizations
          </p>
        </div>
        {hasPermission('canCreateUsers') && (
          <Link
            href="/admin/users/new"
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: primaryColor,
              color: '#fff',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}
          >
            + Create User
          </Link>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            padding: '0.625rem 1rem',
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem'
          }}
        />
        <select
          value={filterOrg}
          onChange={(e) => setFilterOrg(e.target.value)}
          style={{
            padding: '0.625rem 1rem',
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem'
          }}
        >
          <option value="all">All Organizations</option>
          {uniqueOrgs.map(orgId => {
            const org = users.find(u => u.organizationId === orgId);
            return (
              <option key={orgId} value={orgId}>
                {org?.organizationName || orgId}
              </option>
            );
          })}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Total Users" value={users.length} />
        <StatCard label="Active" value={users.filter(u => u.status === 'active').length} />
        <StatCard label="Suspended" value={users.filter(u => u.status === 'suspended').length} />
        <StatCard label="Verified" value={users.filter(u => u.emailVerified).length} />
      </div>

      {/* Users Table */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          Loading users...
        </div>
      ) : (
        <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>User</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Organization</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Last Login</th>
                <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{user.profile.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>{user.email}</div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#999' }}>
                    {user.organizationName}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: user.status === 'active' ? '#065f46' : '#7f1d1d',
                        color: user.status === 'active' ? '#10b981' : '#ef4444',
                        textTransform: 'uppercase'
                      }}>
                        {user.status}
                      </span>
                      {user.emailVerified && (
                        <span style={{ fontSize: '0.75rem', color: '#10b981' }}>✓ Verified</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#999' }}>
                    {user.lastLoginAt ? new Date(user.lastLoginAt as any).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <Link
                        href={`/admin/users/${user.id}`}
                        style={{
                          padding: '0.375rem 0.75rem',
                          backgroundColor: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: '0.375rem',
                          color: '#fff',
                          textDecoration: 'none',
                          fontSize: '0.75rem'
                        }}
                      >
                        View
                      </Link>
                      {hasPermission('canImpersonateUsers') && (
                        <Link
                          href={`/admin/support/impersonate?userId=${user.id}`}
                          style={{
                            padding: '0.375rem 0.75rem',
                            backgroundColor: 'transparent',
                            border: `1px solid ${borderColor}`,
                            borderRadius: '0.375rem',
                            color: '#6366f1',
                            textDecoration: 'none',
                            fontSize: '0.75rem'
                          }}
                        >
                          Impersonate
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
              No users found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.5rem',
      padding: '1rem',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#666' }}>{label}</div>
    </div>
  );
}


