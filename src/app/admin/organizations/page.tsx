'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';
import Tooltip from '@/components/Tooltip';
import type { Organization } from '@/types/organization';

export default function OrganizationsPage() {
  const { adminUser, hasPermission } = useAdminAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'trial' | 'suspended'>('all');
  const [filterPlan, setFilterPlan] = useState<'all' | 'free' | 'pro' | 'enterprise'>('all');

  useEffect(() => {
    async function loadOrganizations() {
      try {
        setLoading(true);
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        
        // Load all organizations from Firestore
        const orgs = await FirestoreService.getAll(COLLECTIONS.ORGANIZATIONS);
        
        // Convert Firestore data to Organization type
        const organizations = orgs.map((org: any) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          planLimits: org.planLimits,
          billingEmail: org.billingEmail,
          branding: org.branding || {},
          settings: org.settings,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          createdBy: org.createdBy,
          status: org.status,
          trialEndsAt: org.trialEndsAt,
        }));
        
        setOrganizations(organizations);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load organizations:', error);
        setOrganizations([]);
        setLoading(false);
      }
    }
    
    loadOrganizations();
  }, []);

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.billingEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || org.status === filterStatus;
    const matchesPlan = filterPlan === 'all' || org.plan === filterPlan;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Organizations
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Manage all customer organizations
        </p>
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
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
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
        <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
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
                <tr key={org.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{org.name}</div>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrgs.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
              No organizations found
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

