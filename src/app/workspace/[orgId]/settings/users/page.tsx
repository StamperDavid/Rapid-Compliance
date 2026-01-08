'use client';

/**
 * Team Members Management Page
 * Manage users, roles, and permissions for the organization
 * NOTE: This is a complex page with inline styles - pagination added to Firestore query
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { usePagination } from '@/hooks/usePagination';
import AdminBar from '@/components/AdminBar';
import type { RolePermissions, UserRole } from '@/types/permissions';
import { ROLE_PERMISSIONS } from '@/types/permissions';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';
import type { QueryConstraint } from 'firebase/firestore';
import { where, orderBy as firestoreOrderBy } from 'firebase/firestore';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  department?: string;
  status: 'active' | 'invited' | 'suspended';
  joinedDate: string;
  customPermissions?: Partial<RolePermissions>;
}

export default function TeamMembersPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const { theme } = useOrgTheme();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inviteRole, setInviteRole] = useState('member');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [activePermissionTab, setActivePermissionTab] = useState<'preset' | 'custom'>('preset');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'employee' as UserRole,
    title: '',
    department: ''
  });

  // Fetch function with pagination
  const fetchUsers = useCallback(async (lastDoc?: any) => {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    
    const constraints: QueryConstraint[] = [
      where('organizationId', '==', orgId),
      firestoreOrderBy('createdAt', 'desc')
    ];

    return FirestoreService.getAllPaginated(
      COLLECTIONS.USERS,
      constraints,
      50,
      lastDoc
    );
  }, [orgId]);

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
    const members: TeamMember[] = (users || []).map((u: any, index: number) => {
      const emailUsername = u.email?.split('@')[0];
      const userName = u.displayName || ((emailUsername !== '' && emailUsername != null) ? emailUsername : 'Unknown');
      return {
        id: index + 1,
        name: userName,
        email: u.email ?? '',
        role: (u.role !== '' && u.role != null) ? u.role : 'employee',
        title: u.title ?? '',
        department: u.department ?? '',
        status: (u.status !== '' && u.status != null) ? u.status : 'active',
        joinedDate: u.createdAt ? new Date(u.createdAt.seconds ? u.createdAt.seconds * 1000 : u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown',
        customPermissions: u.customPermissions,
      };
    });
    
    setTeamMembers(members);
  }, [users]);

  // Initial load
  useEffect(() => {
    if (orgId) {
      refresh();
    }
  }, [orgId, refresh]);

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const roles: { value: UserRole; label: string; description: string }[] = [
    { value: 'owner', label: 'Owner', description: 'Full system access and billing control' },
    { value: 'admin', label: 'Admin', description: 'Full access except billing and org deletion' },
    { value: 'manager', label: 'Manager', description: 'Can manage team and view all records' },
    { value: 'employee', label: 'Employee', description: 'Can only view and edit assigned records' }
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
      name: 'Data Management',
      permissions: [
        { key: 'canCreateSchemas' as keyof RolePermissions, label: 'Create Schemas', description: 'Create new entity types' },
        { key: 'canEditSchemas' as keyof RolePermissions, label: 'Edit Schemas', description: 'Modify entity structures' },
        { key: 'canDeleteSchemas' as keyof RolePermissions, label: 'Delete Schemas', description: 'Remove entity types' },
        { key: 'canExportData' as keyof RolePermissions, label: 'Export Data', description: 'Export records to CSV/Excel' },
        { key: 'canImportData' as keyof RolePermissions, label: 'Import Data', description: 'Import records from files' },
        { key: 'canDeleteData' as keyof RolePermissions, label: 'Delete Data', description: 'Permanently delete records' },
        { key: 'canViewAllRecords' as keyof RolePermissions, label: 'View All Records', description: 'See all records (not just assigned)' }
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
        { key: 'canEditWorkflows' as keyof RolePermissions, label: 'Edit Workflows', description: 'Modify existing workflows' },
        { key: 'canDeleteWorkflows' as keyof RolePermissions, label: 'Delete Workflows', description: 'Remove workflows' },
        { key: 'canTrainAIAgents' as keyof RolePermissions, label: 'Train AI Agents', description: 'Train and configure AI assistants' },
        { key: 'canDeployAIAgents' as keyof RolePermissions, label: 'Deploy AI Agents', description: 'Deploy AI agents to production' },
        { key: 'canManageAIAgents' as keyof RolePermissions, label: 'Manage AI Agents', description: 'Full AI agent management' }
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
    {
      name: 'Integrations & E-Commerce',
      permissions: [
        { key: 'canAccessSettings' as keyof RolePermissions, label: 'Access Settings', description: 'View settings pages' },
        { key: 'canManageIntegrations' as keyof RolePermissions, label: 'Manage Integrations', description: 'Configure third-party apps' },
        { key: 'canManageEcommerce' as keyof RolePermissions, label: 'Manage E-Commerce', description: 'Configure online store' },
        { key: 'canProcessOrders' as keyof RolePermissions, label: 'Process Orders', description: 'Fulfill and manage orders' },
        { key: 'canManageProducts' as keyof RolePermissions, label: 'Manage Products', description: 'Add/edit products and services' }
      ]
    }
  ];

  const openEditModal = (member: TeamMember) => {
    setEditingMember({
      ...member,
      customPermissions:member.customPermissions ?? {}
    });
    setShowEditModal(true);
  };

  const getEffectivePermissions = (member: TeamMember): RolePermissions => {
    const basePermissions = ROLE_PERMISSIONS[member.role];
    if (!member.customPermissions) {return basePermissions;}
    return { ...basePermissions, ...member.customPermissions };
  };

  const updateMemberPermission = (key: keyof RolePermissions, value: boolean) => {
    if (!editingMember) {return;}
    setEditingMember({
      ...editingMember,
      customPermissions: {
        ...editingMember.customPermissions,
        [key]: value
      }
    });
  };

  const saveMemberChanges = () => {
    if (!editingMember) {return;}
    setTeamMembers(teamMembers.map(m => m.id === editingMember.id ? editingMember : m));
    setShowEditModal(false);
    setEditingMember(null);
  };

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
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <Link href={`/workspace/${orgId}/settings`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                  ← Back to Settings
                </Link>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Team Members</h1>
                <p style={{ color: '#666', fontSize: '0.875rem' }}>
                  Invite users and manage roles and permissions
                </p>
              </div>
              <button
                onClick={() => setShowInviteModal(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: primaryColor,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
              >
                + Invite User
              </button>
            </div>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#2a0a0a', border: '1px solid #4a0a0a', borderRadius: '0.5rem', color: '#ff6b6b' }}>
                {error}
              </div>
            )}

            {/* Team Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Total Members</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>{teamMembers.length}</div>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Active</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4ade80' }}>
                  {teamMembers.filter(m => m.status === 'active').length}
                </div>
              </div>
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Pending Invites</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fbbf24' }}>
                  {teamMembers.filter(m => m.status === 'invited').length}
                </div>
              </div>
            </div>

            {/* Members Table */}
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #333' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>User</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Role</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Joined</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map(member => (
                    <tr key={member.id} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '600', color: '#fff' }}>
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>{member.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#999' }}>{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 0.75rem' }}>
                        <select
                          value={member.role}
                          style={{ padding: '0.5rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.375rem', color: '#fff', fontSize: '0.875rem', cursor: 'pointer' }}
                        >
                          {roles.map(role => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.75rem',
                          backgroundColor: member.status === 'active' ? '#0f4c0f' : '#4c3d0f',
                          color: member.status === 'active' ? '#4ade80' : '#fbbf24',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          textTransform: 'capitalize'
                        }}>
                          {member.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#ccc' }}>{member.joinedDate}</td>
                      <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>
                        <button style={{ padding: '0.5rem 1rem', backgroundColor: '#222', color: '#f87171', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {(hasMore || loading) && (
                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <button
                    onClick={loadMore}
                    disabled={loading || !hasMore}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: loading || !hasMore ? '#222' : '#333',
                      color: loading || !hasMore ? '#666' : '#fff',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: loading || !hasMore ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500'
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
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', width: '90%', maxWidth: '500px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Invite Team Member</h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                Email Address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
              >
                {roles.map(role => (
                  <option key={role.value} value={role.value}>{role.label} - {role.description}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert(`Invitation sent to ${inviteEmail}`);
                  setShowInviteModal(false);
                  setInviteEmail('');
                }}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: primaryColor, color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
