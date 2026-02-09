'use client';

/**
 * Owner Impersonation Tool
 * Tier 3.1 — Allows the platform owner to view the application
 * exactly as another user sees it, without logging out.
 *
 * Security:
 * - Owner-only (canImpersonateUsers permission)
 * - All sessions logged with reason
 * - Cannot impersonate self or other owners
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Eye,
  Users,
  AlertTriangle,
  Search,
  Shield,
  Clock,
  XCircle,
  CheckCircle,
  Loader2,
  UserCheck,
} from 'lucide-react';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import {
  setActiveImpersonation,
  getActiveImpersonation,
  clearActiveImpersonation,
} from '@/components/admin/ImpersonationBanner';

// ============================================================================
// TYPES
// ============================================================================

interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface ImpersonationSession {
  sessionId: string;
  ownerId: string;
  ownerEmail: string;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName: string;
  targetUserRole: string;
  reason: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getAuthToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase/config');
    if (!auth?.currentUser) {
      return null;
    }
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

function formatTimestamp(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'owner': return 'var(--color-error)';
    case 'admin': return 'var(--color-warning)';
    case 'manager': return 'var(--color-primary)';
    default: return 'var(--color-text-secondary)';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ImpersonatePage(): React.ReactElement {
  const { user, hasPermission, loading: authLoading } = useUnifiedAuth();

  // State
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [sessions, setSessions] = useState<ImpersonationSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [reason, setReason] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ReturnType<typeof getActiveImpersonation>>(null);

  // Check for active impersonation
  useEffect(() => {
    setActiveSession(getActiveImpersonation());
  }, []);

  // Load users
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch('/api/admin/users?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errData = (await response.json()) as { error?: string };
        throw new Error(errData.error ?? 'Failed to load users');
      }

      const data = (await response.json()) as { users: UserListItem[] };
      setUsers(data.users ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Load sessions
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }

      const response = await fetch('/api/admin/impersonate?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = (await response.json()) as { sessions: ImpersonationSession[] };
        setSessions(data.sessions ?? []);
      }
    } catch {
      // Silent failure for session list
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    if (user && hasPermission('canImpersonateUsers')) {
      void loadUsers();
      void loadSessions();
    }
  }, [user, hasPermission, loadUsers, loadSessions]);

  // Start impersonation
  const handleStartImpersonation = useCallback(async () => {
    if (!selectedUser || !reason.trim() || starting) {
      return;
    }

    setStarting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          reason: reason.trim(),
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        session?: {
          sessionId: string;
          targetUserId: string;
          targetUserEmail: string;
          targetUserName: string;
          targetUserRole: string;
          reason: string;
        };
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to start impersonation');
      }

      if (data.session) {
        setActiveImpersonation({
          sessionId: data.session.sessionId,
          targetUserId: data.session.targetUserId,
          targetUserEmail: data.session.targetUserEmail,
          targetUserName: data.session.targetUserName,
          targetUserRole: data.session.targetUserRole,
          reason: data.session.reason,
        });
        setActiveSession({
          sessionId: data.session.sessionId,
          targetUserId: data.session.targetUserId,
          targetUserEmail: data.session.targetUserEmail,
          targetUserName: data.session.targetUserName,
          targetUserRole: data.session.targetUserRole,
          reason: data.session.reason,
        });
      }

      setSuccessMsg(`Now impersonating ${selectedUser.name} (${selectedUser.email})`);
      setSelectedUser(null);
      setReason('');
      void loadSessions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start impersonation');
    } finally {
      setStarting(false);
    }
  }, [selectedUser, reason, starting, loadSessions]);

  // End impersonation
  const handleEndSession = useCallback(async (sessionId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return;
      }

      const response = await fetch('/api/admin/impersonate', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        clearActiveImpersonation();
        setActiveSession(null);
        setSuccessMsg('Impersonation session ended');
        void loadSessions();
      }
    } catch {
      setError('Failed to end session');
    }
  }, [loadSessions]);

  // Filter users by search
  const filteredUsers = users.filter(u => {
    if (!searchQuery.trim()) {
      return true;
    }
    const q = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  // Access control
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!user || !hasPermission('canImpersonateUsers')) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-[var(--color-error)]" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
          Access Denied
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          Only the platform owner can access the impersonation tool.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Eye className="w-7 h-7 text-[var(--color-warning)]" />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            User Impersonation
          </h1>
        </div>
        <p className="text-[var(--color-text-secondary)]">
          View the platform exactly as another user sees it. All sessions are logged for compliance.
        </p>
      </div>

      {/* Security Notice */}
      <div
        className="flex items-start gap-3 p-4 rounded-lg border"
        style={{
          backgroundColor: 'var(--color-warning)',
          borderColor: 'var(--color-warning)',
          color: 'var(--color-bg-main)',
          opacity: 0.9,
        }}
      >
        <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong>Owner-Only Tool</strong> &mdash; All impersonation sessions are recorded with
          timestamps, target user details, and your stated reason. This data is retained for
          audit compliance.
        </div>
      </div>

      {/* Active Session Alert */}
      {activeSession && (
        <div
          className="flex items-center justify-between p-4 rounded-lg border"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
            borderColor: 'var(--color-warning)',
          }}
        >
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-[var(--color-warning)]" />
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">
                Active Session: Impersonating {activeSession.targetUserName}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {activeSession.targetUserEmail} &mdash; {activeSession.reason}
              </p>
            </div>
          </div>
          <button
            onClick={() => void handleEndSession(activeSession.sessionId)}
            className="px-4 py-2 rounded-md text-sm font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--color-error)',
              color: 'var(--color-text-primary)',
            }}
          >
            End Session
          </button>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg border"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
            borderColor: 'var(--color-error)',
          }}
        >
          <XCircle className="w-5 h-5 text-[var(--color-error)] flex-shrink-0" />
          <p className="text-sm text-[var(--color-text-primary)]">{error}</p>
        </div>
      )}

      {successMsg && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg border"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
            borderColor: 'var(--color-success)',
          }}
        >
          <CheckCircle className="w-5 h-5 text-[var(--color-success)] flex-shrink-0" />
          <p className="text-sm text-[var(--color-text-primary)]">{successMsg}</p>
        </div>
      )}

      {/* Start Impersonation Form */}
      <div
        className="rounded-lg border p-6"
        style={{
          backgroundColor: 'var(--color-bg-elevated)',
          borderColor: 'var(--color-border-light)',
        }}
      >
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-[var(--color-primary)]" />
          Start Impersonation
        </h2>

        {/* User Search */}
        <div className="mb-4">
          <label
            htmlFor="user-search"
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
          >
            Search Users
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-disabled)]"
              aria-hidden="true"
            />
            <input
              id="user-search"
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--color-bg-main)',
                borderColor: 'var(--color-border-light)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
        </div>

        {/* User List */}
        <div
          className="rounded-lg border overflow-hidden mb-4"
          style={{ borderColor: 'var(--color-border-light)' }}
        >
          <div
            className="max-h-64 overflow-y-auto"
            role="listbox"
            aria-label="Select a user to impersonate"
          >
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                <span className="ml-2 text-sm text-[var(--color-text-secondary)]">
                  Loading users...
                </span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--color-text-disabled)]">
                {searchQuery ? 'No users match your search' : 'No users available'}
              </div>
            ) : (
              filteredUsers
                .filter(u => u.id !== user?.id && u.role !== 'owner')
                .map(u => (
                  <button
                    key={u.id}
                    role="option"
                    aria-selected={selectedUser?.id === u.id}
                    onClick={() => setSelectedUser(selectedUser?.id === u.id ? null : u)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{
                      backgroundColor:
                        selectedUser?.id === u.id
                          ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
                          : 'transparent',
                      borderBottom: '1px solid var(--color-border-light)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {u.name}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)] truncate">
                        {u.email}
                      </p>
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color: getRoleBadgeColor(u.role),
                        backgroundColor: `color-mix(in srgb, ${getRoleBadgeColor(u.role)} 15%, transparent)`,
                      }}
                    >
                      {u.role}
                    </span>
                    {selectedUser?.id === u.id && (
                      <CheckCircle className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" />
                    )}
                  </button>
                ))
            )}
          </div>
        </div>

        {/* Selected User + Reason */}
        {selectedUser && (
          <div className="space-y-4">
            <div
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
              }}
            >
              <Users className="w-4 h-4 text-[var(--color-primary)]" />
              <span className="text-sm text-[var(--color-text-primary)]">
                Selected: <strong>{selectedUser.name}</strong> ({selectedUser.email})
              </span>
            </div>

            <div>
              <label
                htmlFor="impersonation-reason"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
              >
                Reason for Impersonation <span className="text-[var(--color-error)]">*</span>
              </label>
              <textarea
                id="impersonation-reason"
                placeholder="e.g., Debugging workflow issue, Customer support request #1234..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full px-4 py-2.5 rounded-lg border text-sm resize-none"
                style={{
                  backgroundColor: 'var(--color-bg-main)',
                  borderColor: 'var(--color-border-light)',
                  color: 'var(--color-text-primary)',
                }}
              />
              <p className="text-xs text-[var(--color-text-disabled)] mt-1">
                {reason.length}/500 characters &mdash; Required for audit compliance
              </p>
            </div>

            <button
              onClick={() => void handleStartImpersonation()}
              disabled={!reason.trim() || starting || !!activeSession}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor:
                  !reason.trim() || starting || !!activeSession
                    ? 'var(--color-text-disabled)'
                    : 'var(--color-primary)',
                color: 'var(--color-text-primary)',
                cursor:
                  !reason.trim() || starting || !!activeSession ? 'not-allowed' : 'pointer',
                opacity: !reason.trim() || starting || !!activeSession ? 0.6 : 1,
              }}
            >
              {starting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              {starting ? 'Starting Session...' : 'Start Impersonation'}
            </button>

            {activeSession && (
              <p className="text-xs text-[var(--color-warning)]">
                End the current session before starting a new one.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Session History */}
      <div
        className="rounded-lg border"
        style={{
          backgroundColor: 'var(--color-bg-elevated)',
          borderColor: 'var(--color-border-light)',
        }}
      >
        <div className="p-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--color-border-light)' }}
        >
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <Clock className="w-5 h-5 text-[var(--color-secondary)]" />
            Session History
          </h2>
          <button
            onClick={() => void loadSessions()}
            className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-main)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-light)',
            }}
          >
            Refresh
          </button>
        </div>

        {loadingSessions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--color-text-disabled)]">
            No impersonation sessions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">
                    Target User
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">
                    Reason
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">
                    Started
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-[var(--color-text-secondary)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr
                    key={s.sessionId}
                    style={{ borderBottom: '1px solid var(--color-border-light)' }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {s.targetUserName}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {s.targetUserEmail}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: getRoleBadgeColor(s.targetUserRole),
                          backgroundColor: `color-mix(in srgb, ${getRoleBadgeColor(s.targetUserRole)} 15%, transparent)`,
                        }}
                      >
                        {s.targetUserRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[200px] truncate">
                      {s.reason}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                      {formatTimestamp(s.startedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {s.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-warning)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-text-disabled)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-disabled)]" />
                          Ended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status === 'active' && (
                        <button
                          onClick={() => void handleEndSession(s.sessionId)}
                          className="text-xs px-3 py-1 rounded-md font-semibold transition-colors"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--color-error) 15%, transparent)',
                            color: 'var(--color-error)',
                          }}
                        >
                          End
                        </button>
                      )}
                      {s.status === 'ended' && s.endedAt && (
                        <span className="text-xs text-[var(--color-text-disabled)]">
                          {formatTimestamp(s.endedAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
