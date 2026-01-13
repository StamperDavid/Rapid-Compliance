'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';
import Tooltip from '@/components/Tooltip';
import type { Organization } from '@/types/organization'
import { logger } from '@/lib/logger/logger';

export default function OrganizationsPage() {
  const { hasPermission } = useAdminAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<'NOT_LOGGED_IN' | 'NOT_SUPER_ADMIN' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'trial' | 'suspended'>('all');
  const [filterPlan, setFilterPlan] = useState<'all' | 'free' | 'pro' | 'enterprise'>('all');
  const [showTestOrgs, setShowTestOrgs] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  const loadOrganizations = async (cursor: string | null = null, append: boolean = false) => {
    try {
      setLoading(true);
      logger.info('🔍 Loading organizations...', { cursor, page: currentPage, file: 'page.tsx' });
      const { auth } = await import('@/lib/firebase/config');
      
      if (!auth) {
        logger.error('Firebase auth not initialized', { file: 'page.tsx' });
        setAuthError('NOT_LOGGED_IN');
        setLoading(false);
        return;
      }

      const currentUser = auth.currentUser;
      let orgs: any[] = [];
      
      if (!currentUser) {
        logger.warn('🔍 No authenticated user', { file: 'page.tsx' });
        setAuthError('NOT_LOGGED_IN');
        setLoading(false);
        return;
      }
      
      // Use API route to fetch data (bypasses Firestore rules)
      const token = await currentUser.getIdToken();
      
      // Build URL with pagination params
      const params = new URLSearchParams({
        limit: pageSize.toString(),
      });
      if (cursor) {
        params.append('startAfter', cursor);
      }
      
      const response = await fetch(`/api/admin/organizations?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        orgs = data.organizations ?? [];
        setHasMore(data.pagination?.hasMore ?? false);
        setNextCursor(data.pagination?.nextCursor ?? null);
        logger.info('🔍 Organizations loaded via API', { 
          count: orgs.length, 
          hasMore: data.pagination?.hasMore,
          file: 'page.tsx' 
        });
      } else if (response.status === 403) {
        logger.error('🔍 Not authorized as super_admin', new Error('🔍 Not authorized as super_admin'), { file: 'page.tsx' });
        setAuthError('NOT_SUPER_ADMIN');
        setLoading(false);
        return;
      } else {
        const errorText = await response.text();
        logger.error('🔍 API error', new Error(errorText), { status: response.status, file: 'page.tsx' });
      }
      
      // Convert to Organization type
      const organizations = orgs.map((org: any) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        planLimits: org.planLimits,
        billingEmail: org.billingEmail,
        branding: org.branding ?? {},
        settings: org.settings,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        createdBy: org.createdBy,
        status: org.status,
        trialEndsAt: org.trialEndsAt,
        isTest: org.isTest ?? false,
      }));
      
      if (append) {
        setOrganizations(prev => [...prev, ...organizations]);
      } else {
        setOrganizations(organizations);
      }
      setLoading(false);
    } catch (error) {
      logger.error('Failed to load organizations:', error, { file: 'page.tsx' });
      setOrganizations([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = (org.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (org.slug || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (org.billingEmail || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || org.status === filterStatus;
    const matchesPlan = filterPlan === 'all' || org.plan === filterPlan;
    const matchesTestFilter = showTestOrgs || !(org as any).isTest;
    return matchesSearch && matchesStatus && matchesPlan && matchesTestFilter;
  });

  const handleNextPage = () => {
    if (hasMore && nextCursor) {
      setCurrentPage(prev => prev + 1);
      loadOrganizations(nextCursor);
    }
  };

  const handlePrevPage = () => {
    // For previous page, we need to reload from the start
    // This is a limitation of cursor-based pagination
    // A more sophisticated solution would cache previous cursors
    if (currentPage > 1) {
      setCurrentPage(1);
      loadOrganizations();
    }
  };

  const handleDeleteOrganization = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to DELETE "${orgName}"?\n\nThis will permanently delete:\n- The organization\n- All its workspaces\n- All its data\n- All its users\n\nThis action CANNOT be undone!`)) {
      return;
    }

    try {
      const { auth } = await import('@/lib/firebase/config');
      
      if (!auth) {
        alert('Firebase auth not initialized');
        return;
      }

      const token = await auth.currentUser?.getIdToken();
      
      if (!token) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (response.ok) {
        alert(`Successfully deleted "${orgName}"`);
        // Reload organizations
        loadOrganizations();
      } else {
        const error = await response.json();
        alert(`Failed to delete organization: ${(error.error !== '' && error.error != null) ? error.error : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Delete organization error:', error);
      alert('Error deleting organization');
    }
  };

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  // Show auth error screen
  if (authError) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
            {authError === 'NOT_LOGGED_IN' ? '🔐' : '⛔'}
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            {authError === 'NOT_LOGGED_IN' ? 'Login Required' : 'Access Denied'}
          </h1>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            {authError === 'NOT_LOGGED_IN' 
              ? 'You need to login as a super admin to view organizations.'
              : 'Your account does not have super_admin privileges.'}
          </p>
          <Link
            href="/admin-login"
            style={{
              display: 'inline-block',
              padding: '0.75rem 2rem',
              backgroundColor: '#6366f1',
              color: '#fff',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            Go to Login
          </Link>
          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', border: '1px solid #333' }}>
            <p style={{ fontSize: '0.875rem', color: '#999' }}>
              Use your platform super admin credentials to login.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Organizations
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Manage all customer organizations
          </p>
        </div>
        <Link
          href="/admin/organizations/new"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#6366f1',
            color: '#fff',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>+</span>
          Add Organization
        </Link>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap'
      }}>
        <Tooltip content="Search organizations by name, slug, or billing email">
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '0.625rem 1rem',
              backgroundColor: bgPaper,
              border: `1px solid ${borderColor}`,
              borderRadius: '0.5rem',
              color: '#fff',
              fontSize: '0.875rem'
            }}
          />
        </Tooltip>
        <Tooltip content="Filter organizations by their current status: Active (paid), Trial (free trial period), or Suspended">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: bgPaper,
              border: `1px solid ${borderColor}`,
              borderRadius: '0.5rem',
              color: '#fff',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
          </select>
        </Tooltip>
        <Tooltip content="Filter organizations by their subscription plan: Free, Pro ($99/month), or Enterprise ($499/month)">
          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value as any)}
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: bgPaper,
              border: `1px solid ${borderColor}`,
              borderRadius: '0.5rem',
              color: '#fff',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </Tooltip>
        <Tooltip content="Show or hide test organizations created by automated tests">
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.5rem',
            color: '#fff',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={showTestOrgs}
              onChange={(e) => setShowTestOrgs(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Show Test Orgs
          </label>
        </Tooltip>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <Tooltip content="Total number of organizations on the platform">
          <div><StatCard label="Total" value={organizations.length} /></div>
        </Tooltip>
        <Tooltip content="Organizations with active paid subscriptions">
          <div><StatCard label="Active" value={organizations.filter(o => o.status === 'active').length} /></div>
        </Tooltip>
        <Tooltip content="Organizations currently in their free trial period">
          <div><StatCard label="Trial" value={organizations.filter(o => o.status === 'trial').length} /></div>
        </Tooltip>
        <Tooltip content="Organizations that have been suspended (payment issues or policy violations)">
          <div><StatCard label="Suspended" value={organizations.filter(o => o.status === 'suspended').length} /></div>
        </Tooltip>
      </div>

      {/* Organizations Table */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          Loading organizations...
        </div>
      ) : (
        <>
          <div style={{
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.75rem',
            overflow: 'hidden',
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: bgPaper, zIndex: 10 }}>
                <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Organization</th>
                  <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Plan</th>
                  <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Created</th>
                  <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Billing Email</th>
                  <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((org) => (
                  <tr key={org.id} style={{ 
                    borderBottom: `1px solid ${borderColor}`,
                    backgroundColor: (org as any).isTest ? 'rgba(251, 191, 36, 0.05)' : 'transparent'
                  }}>
                    <td style={{ padding: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {org.name}
                          {(org as any).isTest && (
                            <span style={{
                              fontSize: '0.625rem',
                              padding: '0.125rem 0.375rem',
                              backgroundColor: '#fbbf24',
                              color: '#000',
                              borderRadius: '0.25rem',
                              fontWeight: '700'
                            }}>
                              TEST
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>{org.slug}</div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: org.plan === 'enterprise' ? '#7c3aed' : org.plan === 'pro' ? '#6366f1' : '#6b7280',
                        color: '#fff',
                        textTransform: 'uppercase'
                      }}>
                        {org.plan}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: org.status === 'active' ? '#065f46' : org.status === 'trial' ? '#78350f' : '#7f1d1d',
                        color: org.status === 'active' ? '#10b981' : org.status === 'trial' ? '#f59e0b' : '#ef4444',
                        textTransform: 'uppercase'
                      }}>
                        {org.status}
                      </span>
                      {org.trialEndsAt && (
                        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                          Trial ends: {new Date(org.trialEndsAt as any).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#999' }}>
                      {new Date(org.createdAt as any).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#999' }}>
                      {org.billingEmail}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <Tooltip content={`View details for ${org.name}: users, workspaces, usage, billing, and settings`}>
                          <Link
                            href={`/admin/organizations/${org.id}`}
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
                        </Tooltip>
                        {hasPermission('canEditOrganizations') && (
                          <Tooltip content={`Edit ${org.name}: change plan, update settings, modify limits, or suspend/activate`}>
                            <Link
                              href={`/admin/organizations/${org.id}/edit`}
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
                              Edit
                            </Link>
                          </Tooltip>
                        )}
                        {hasPermission('canDeleteOrganizations') && (
                          <Tooltip content={`Delete ${org.name} permanently. This cannot be undone!`}>
                            <button
                              onClick={() => handleDeleteOrganization(org.id, org.name)}
                              style={{
                                padding: '0.375rem 0.75rem',
                                backgroundColor: 'transparent',
                                border: '1px solid #7f1d1d',
                                borderRadius: '0.375rem',
                                color: '#ef4444',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              Delete
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {filteredOrgs.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
                No organizations found
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          <div style={{
            marginTop: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              Page {currentPage} • Showing {filteredOrgs.length} organization{filteredOrgs.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Tooltip content="Go to first page">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: currentPage === 1 ? '#1a1a1a' : primaryColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.375rem',
                    color: currentPage === 1 ? '#666' : '#fff',
                    fontSize: '0.875rem',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  ← First Page
                </button>
              </Tooltip>
              <Tooltip content={hasMore ? "Load next page" : "No more organizations"}>
                <button
                  onClick={handleNextPage}
                  disabled={!hasMore}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: !hasMore ? '#1a1a1a' : primaryColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.375rem',
                    color: !hasMore ? '#666' : '#fff',
                    fontSize: '0.875rem',
                    cursor: !hasMore ? 'not-allowed' : 'pointer',
                    opacity: !hasMore ? 0.5 : 1
                  }}
                >
                  Next Page →
                </button>
              </Tooltip>
            </div>
          </div>
        </>
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

