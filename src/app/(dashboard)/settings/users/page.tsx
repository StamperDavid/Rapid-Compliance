'use client';

/**
 * Team Members Management Page
 * Manage users, roles, and permissions for the organization
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { usePagination } from '@/hooks/usePagination';
import { ROLE_PERMISSIONS, type RolePermissions, type UserRole } from '@/types/permissions';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';
import { orderBy as firestoreOrderBy, type QueryConstraint, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { auth } from '@/lib/firebase/config';

interface FirestoreUser {
  email?: string;
  displayName?: string;
  role?: UserRole;
  title?: string;
  department?: string;
  status?: 'active' | 'invited' | 'suspended' | 'removed';
  createdAt?: { seconds: number } | string;
  customPermissions?: Partial<RolePermissions>;
}

interface TeamMember {
  id: string;
  firestoreId: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  department: string;
  status: 'active' | 'invited' | 'suspended' | 'removed';
  joinedDate: string;
  customPermissions?: Partial<RolePermissions>;
}

export default function TeamMembersPage() {
  const { user: currentUser } = useAuth();
  const { theme } = useOrgTheme();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inviteRole, setInviteRole] = useState<UserRole>('member');
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [activePermissionTab, setActivePermissionTab] = useState<'preset' | 'custom'>('preset');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch function with pagination
  const fetchUsers = useCallback(async (lastDoc?: QueryDocumentSnapshot<DocumentData, DocumentData>) => {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

    const constraints: QueryConstraint[] = [
      firestoreOrderBy('createdAt', 'desc')
    ];

    return FirestoreService.getAllPaginated(
      COLLECTIONS.USERS,
      constraints,
      50,
      lastDoc
    );
  }, []);

  const {
    data: users,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination({ fetchFn: fetchUsers });

  // Convert Firestore users to TeamMember format
  useEffect(() => {
    const members: TeamMember[] = (users ?? []).map((u: FirestoreUser, index: number) => {
      const emailUsername = u.email?.split('@')[0];
      const userName = u.displayName ?? (emailUsername ?? 'Unknown');
      const createdAt = u.createdAt;
      let joinedDate = 'Unknown';
      if (createdAt) {
        if (typeof createdAt === 'object' && 'seconds' in createdAt) {
          joinedDate = new Date(createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } else if (typeof createdAt === 'string') {
          joinedDate = new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }
      return {
        id: String(index + 1),
        firestoreId: (u as Record<string, unknown>).id as string ?? String(index),
        name: userName,
        email: u.email ?? '',
        role: u.role ?? 'member',
        title: u.title ?? '',
        department: u.department ?? '',
        status: u.status ?? 'active',
        joinedDate,
        customPermissions: u.customPermissions,
      };
    });

    setTeamMembers(members);
  }, [users]);

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  const roles: { value: UserRole; label: string; description: string }[] = [
    { value: 'owner', label: 'Owner', description: 'Master key — full system access, can delete org' },
    { value: 'admin', label: 'Admin', description: 'Full access minus destructive org ops and impersonation' },
    { value: 'manager', label: 'Manager', description: 'Team lead — CRM, marketing, sales, limited management' },
    { value: 'member', label: 'Member', description: 'Individual contributor — own records, limited read' },
  ];

  const permissionGroups = [
    {
      name: 'Organization Management',
      permissions: [
        { key: 'canManageOrganization' as keyof RolePermissions, label: 'Manage Organization', description: 'Edit org settings and details' },
        { key: 'canManageBilling' as keyof RolePermissions, label: 'Manage Billing', description: 'Access billing and subscription' },
        { key: 'canManageAPIKeys' as keyof RolePermissions, label: 'Manage API Keys', description: 'Configure API integrations' },
        { key: 'canManageTheme' as keyof RolePermissions, label: 'Manage Theme', description: 'Customize branding and theme' },
        { key: 'canDeleteOrganization' as keyof RolePermissions, label: 'Delete Organization', description: 'Permanently delete org (owner only)' }
      ]
    },
    {
      name: 'User Management',
      permissions: [
        { key: 'canInviteUsers' as keyof RolePermissions, label: 'Invite Users', description: 'Send team invitations' },
        { key: 'canRemoveUsers' as keyof RolePermissions, label: 'Remove Users', description: 'Remove team members' },
        { key: 'canChangeUserRoles' as keyof RolePermissions, label: 'Change User Roles', description: 'Modify user roles and permissions' },
        { key: 'canViewAllUsers' as keyof RolePermissions, label: 'View All Users', description: 'See all team members' }
      ]
    },
    {
      name: 'CRM Operations',
      permissions: [
        { key: 'canCreateRecords' as keyof RolePermissions, label: 'Create Records', description: 'Add new contacts, deals, etc.' },
        { key: 'canEditRecords' as keyof RolePermissions, label: 'Edit Records', description: 'Modify existing records' },
        { key: 'canDeleteRecords' as keyof RolePermissions, label: 'Delete Records', description: 'Remove records' },
        { key: 'canAssignRecords' as keyof RolePermissions, label: 'Assign Records', description: 'Assign records to team members' },
        { key: 'canViewOwnRecordsOnly' as keyof RolePermissions, label: 'View Own Records Only', description: 'Restricted to assigned records' }
      ]
    },
    {
      name: 'Automation & AI',
      permissions: [
        { key: 'canCreateWorkflows' as keyof RolePermissions, label: 'Create Workflows', description: 'Build automation workflows' },
        { key: 'canTrainAIAgents' as keyof RolePermissions, label: 'Train AI Agents', description: 'Train and configure AI assistants' },
        { key: 'canDeployAIAgents' as keyof RolePermissions, label: 'Deploy AI Agents', description: 'Deploy AI agents to production' },
      ]
    },
    {
      name: 'Reports & Analytics',
      permissions: [
        { key: 'canViewReports' as keyof RolePermissions, label: 'View Reports', description: 'Access reports and dashboards' },
        { key: 'canCreateReports' as keyof RolePermissions, label: 'Create Reports', description: 'Build custom reports' },
        { key: 'canExportReports' as keyof RolePermissions, label: 'Export Reports', description: 'Export report data' }
      ]
    },
  ];

  // ============================================================================
  // API HELPERS
  // ============================================================================

  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const token = await auth?.currentUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // ============================================================================
  // ROLE CHANGE
  // ============================================================================

  const handleRoleChange = async (member: TeamMember, newRole: UserRole) => {
    try {
      setSaving(true);
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ userId: member.firestoreId, role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error ?? 'Failed to update role');
      }

      // Update local state
      setTeamMembers(prev => prev.map(m =>
        m.firestoreId === member.firestoreId ? { ...m, role: newRole } : m
      ));
      setNotification({ message: `${member.name}'s role updated to ${newRole}`, type: 'success' });
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Failed to update role', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // REMOVE USER
  // ============================================================================

  const handleRemoveUser = async (member: TeamMember) => {
    try {
      setSaving(true);
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/admin/users?userId=${encodeURIComponent(member.firestoreId)}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error ?? 'Failed to remove user');
      }

      // Remove from local state
      setTeamMembers(prev => prev.filter(m => m.firestoreId !== member.firestoreId));
      setConfirmRemove(null);
      setNotification({ message: `${member.name} has been removed`, type: 'success' });
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Failed to remove user', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // EDIT MODAL
  // ============================================================================

  const openEditModal = (member: TeamMember) => {
    setEditingMember({
      ...member,
      customPermissions: member.customPermissions ?? {},
    });
    setActivePermissionTab('preset');
    setShowEditModal(true);
  };

  const getEffectivePermissions = (member: TeamMember): RolePermissions => {
    const basePermissions = ROLE_PERMISSIONS[member.role];
    if (!member.customPermissions) {
      return basePermissions;
    }
    return { ...basePermissions, ...member.customPermissions };
  };

  const updateMemberPermission = (key: keyof RolePermissions, value: boolean) => {
    if (!editingMember) {
      return;
    }
    setEditingMember({
      ...editingMember,
      customPermissions: {
        ...editingMember.customPermissions,
        [key]: value,
      },
    });
  };

  const saveMemberChanges = async () => {
    if (!editingMember) {
      return;
    }

    try {
      setSaving(true);
      const headers = await getAuthHeaders();

      // Save role and custom permissions
      const updates: Record<string, unknown> = {
        userId: editingMember.firestoreId,
        role: editingMember.role,
      };

      // Only include name if changed
      const originalMember = teamMembers.find(m => m.firestoreId === editingMember.firestoreId);
      if (originalMember && originalMember.name !== editingMember.name) {
        updates.name = editingMember.name;
      }

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error ?? 'Failed to save changes');
      }

      // Save custom permissions separately if changed
      if (editingMember.customPermissions && Object.keys(editingMember.customPermissions).length > 0) {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        await FirestoreService.update(COLLECTIONS.USERS, editingMember.firestoreId, {
          customPermissions: editingMember.customPermissions,
        });
      }

      // Update local state
      setTeamMembers(prev => prev.map(m =>
        m.firestoreId === editingMember.firestoreId ? editingMember : m
      ));
      setShowEditModal(false);
      setEditingMember(null);
      setNotification({ message: 'User settings saved', type: 'success' });
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Failed to save changes', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // INVITE USER
  // ============================================================================

  const handleInvite = async () => {
    if (!inviteEmail) {
      return;
    }

    try {
      setSaving(true);
      const headers = await getAuthHeaders();
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      // Create a pending user record in Firestore
      const inviteId = `invite-${Date.now()}`;
      await FirestoreService.set(COLLECTIONS.USERS, inviteId, {
        id: inviteId,
        email: inviteEmail,
        role: inviteRole,
        status: 'invited',
        invitedBy: currentUser?.id ?? 'unknown',
        createdAt: new Date(),
      }, false);

      // Send invite email via API
      try {
        await fetch('/api/email/send', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: inviteEmail,
            subject: 'You\'ve been invited to SalesVelocity.ai',
            body: `You've been invited to join the team as a ${inviteRole}. Sign up at ${window.location.origin}/signup`,
          }),
        });
      } catch {
        // Email sending is best-effort
      }

      setNotification({ message: `Invitation sent to ${inviteEmail}`, type: 'success' });
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('member');
      void refresh();
    } catch (err) {
      setNotification({ message: err instanceof Error ? err.message : 'Failed to send invite', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Sidebar */}
        <div style={{
          width: sidebarOpen ? '260px' : '70px',
          backgroundColor: 'var(--color-bg-main)',
          borderRight: '1px solid var(--color-bg-elevated)',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            <Link
              href="/crm"
              style={{
                width: '100%', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                backgroundColor: 'transparent', color: 'var(--color-text-secondary)', borderLeft: '3px solid transparent',
                fontSize: '0.875rem', fontWeight: '400', textDecoration: 'none'
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
                  width: '100%', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                  backgroundColor: 'transparent', color: 'var(--color-text-secondary)', borderLeft: '3px solid transparent',
                  fontSize: '0.875rem', fontWeight: '400', textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
                {sidebarOpen && <span>{schema.pluralName}</span>}
              </Link>
            ))}
          </nav>

          <div style={{ padding: '1rem', borderTop: '1px solid var(--color-bg-elevated)' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                width: '100%', padding: '0.5rem', backgroundColor: 'var(--color-bg-elevated)',
                color: 'var(--color-text-secondary)', border: 'none', borderRadius: '0.375rem',
                cursor: 'pointer', fontSize: '0.875rem'
              }}
            >
              {sidebarOpen ? '← Collapse' : '→'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <div>
            {/* Header */}
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <Link href="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                  ← Back to Settings
                </Link>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>Team Members</h1>
                <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
                  Invite users and manage roles and permissions
                </p>
              </div>
              <button
                onClick={() => setShowInviteModal(true)}
                style={{
                  padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)',
                  border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600'
                }}
              >
                + Invite User
              </button>
            </div>

            {/* Notification */}
            {notification && (
              <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: notification.type === 'success' ? 'var(--color-success-dark)' : 'var(--color-error-dark)', border: `1px solid ${notification.type === 'success' ? 'var(--color-success-light)' : 'var(--color-error-dark)'}`, borderRadius: '0.5rem', color: notification.type === 'success' ? 'var(--color-success-light)' : 'var(--color-error-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{notification.message}</span>
                <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.25rem', opacity: 0.7 }}>&times;</button>
              </div>
            )}

            {error && (
              <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--color-error-dark)', border: '1px solid var(--color-error-dark)', borderRadius: '0.5rem', color: 'var(--color-error-light)' }}>
                {error}
              </div>
            )}

            {/* Team Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-strong)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Total Members</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{teamMembers.length}</div>
              </div>
              <div style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-strong)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Active</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-success-light)' }}>
                  {teamMembers.filter(m => m.status === 'active').length}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-strong)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Pending Invites</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-warning-light)' }}>
                  {teamMembers.filter(m => m.status === 'invited').length}
                </div>
              </div>
            </div>

            {/* Members Table */}
            <div style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '2rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-strong)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>User</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Role</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Joined</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map(member => (
                    <tr key={member.firestoreId} style={{ borderBottom: '1px solid var(--color-bg-elevated)' }}>
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{member.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <select
                          value={member.role}
                          onChange={(e) => void handleRoleChange(member, e.target.value as UserRole)}
                          disabled={saving}
                          style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', color: 'var(--color-text-primary)', fontSize: '0.875rem', cursor: 'pointer' }}
                        >
                          {roles.map(role => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', padding: '0.25rem 0.75rem',
                          backgroundColor: member.status === 'active' ? 'var(--color-success-dark)' : member.status === 'invited' ? 'var(--color-warning-dark)' : 'var(--color-error-dark)',
                          color: member.status === 'active' ? 'var(--color-success-light)' : member.status === 'invited' ? 'var(--color-warning-light)' : 'var(--color-error-light)',
                          borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', textTransform: 'capitalize'
                        }}>
                          {member.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{member.joinedDate}</td>
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => openEditModal(member)}
                            style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmRemove(member)}
                            disabled={saving}
                            style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-error-light)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {(hasMore || loading) && (
                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <button
                    onClick={() => void loadMore()}
                    disabled={loading || !hasMore}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: loading || !hasMore ? 'var(--color-bg-elevated)' : 'var(--color-border-strong)',
                      color: loading || !hasMore ? 'var(--color-text-disabled)' : 'var(--color-text-primary)',
                      border: 'none', borderRadius: '0.5rem',
                      cursor: loading || !hasMore ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem', fontWeight: '500'
                    }}
                  >
                    {loading ? 'Loading...' : hasMore ? `Load More (Showing ${teamMembers.length})` : 'All loaded'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '2rem', width: '90%', maxWidth: '500px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>Invite Team Member</h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                Email Address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
              >
                {roles.map(role => (
                  <option key={role.value} value={role.value}>{role.label} - {role.description}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleInvite()}
                disabled={!inviteEmail || saving}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.5rem', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: '600', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      {confirmRemove && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '2rem', width: '90%', maxWidth: '450px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Remove Team Member</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Are you sure you want to remove <strong style={{ color: 'var(--color-text-primary)' }}>{confirmRemove.name}</strong> ({confirmRemove.email})?
              Their account will be disabled and they will lose access.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={() => setConfirmRemove(null)}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRemoveUser(confirmRemove)}
                disabled={saving}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-error)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: '600', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Removing...' : 'Remove User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingMember && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '2rem', width: '90%', maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
              Edit User — {editingMember.name}
            </h2>

            {/* Role Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>Role</label>
              <select
                value={editingMember.role}
                onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value as UserRole })}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
              >
                {roles.map(role => (
                  <option key={role.value} value={role.value}>{role.label} — {role.description}</option>
                ))}
              </select>
            </div>

            {/* Permission Tabs */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  onClick={() => setActivePermissionTab('preset')}
                  style={{
                    padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500',
                    backgroundColor: activePermissionTab === 'preset' ? primaryColor : 'var(--color-bg-elevated)',
                    color: activePermissionTab === 'preset' ? 'white' : 'var(--color-text-secondary)',
                  }}
                >
                  Role Permissions
                </button>
                <button
                  onClick={() => setActivePermissionTab('custom')}
                  style={{
                    padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500',
                    backgroundColor: activePermissionTab === 'custom' ? primaryColor : 'var(--color-bg-elevated)',
                    color: activePermissionTab === 'custom' ? 'white' : 'var(--color-text-secondary)',
                  }}
                >
                  Custom Overrides
                </button>
              </div>

              {activePermissionTab === 'preset' ? (
                <div style={{ backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem', padding: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '1rem' }}>
                    These are the default permissions for the <strong>{editingMember.role}</strong> role. Switch to &quot;Custom Overrides&quot; to modify individual permissions.
                  </p>
                  {permissionGroups.map(group => (
                    <div key={group.name} style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{group.name}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.25rem' }}>
                        {group.permissions.map(perm => {
                          const effective = getEffectivePermissions(editingMember);
                          const isEnabled = effective[perm.key];
                          return (
                            <div key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isEnabled ? 'var(--color-success)' : 'var(--color-error)', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{perm.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem', padding: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '1rem' }}>
                    Toggle individual permissions to override the <strong>{editingMember.role}</strong> role defaults.
                  </p>
                  {permissionGroups.map(group => (
                    <div key={group.name} style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{group.name}</h4>
                      {group.permissions.map(perm => {
                        const baseValue = ROLE_PERMISSIONS[editingMember.role][perm.key];
                        const customValue = editingMember.customPermissions?.[perm.key];
                        const effectiveValue = customValue ?? baseValue;
                        const isOverridden = customValue !== undefined;

                        return (
                          <div key={perm.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-bg-main)' }}>
                            <div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)', fontWeight: isOverridden ? '600' : '400' }}>
                                {perm.label}
                                {isOverridden && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--color-warning)', fontWeight: '600' }}>CUSTOM</span>}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-disabled)' }}>{perm.description}</div>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={effectiveValue}
                                onChange={(e) => updateMemberPermission(perm.key, e.target.checked)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                              />
                              <span style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: effectiveValue ? 'var(--color-success)' : 'var(--color-bg-main)',
                                borderRadius: '12px', transition: 'background-color 0.2s',
                                border: '1px solid var(--color-border-strong)',
                              }}>
                                <span style={{
                                  position: 'absolute', top: '2px', left: effectiveValue ? '22px' : '2px',
                                  width: '18px', height: '18px', borderRadius: '50%',
                                  backgroundColor: 'white', transition: 'left 0.2s',
                                }} />
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => { setShowEditModal(false); setEditingMember(null); }}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <button
                onClick={() => void saveMemberChanges()}
                disabled={saving}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.5rem', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: '600', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
