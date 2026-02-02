'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';

import type { Organization, PlanLimits } from '@/types/organization';
import type { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

// Default plan limits for organizations missing this data
const DEFAULT_PLAN_LIMITS: PlanLimits = {
  maxUsers: 5,
  maxRecords: 1000,
  maxAICallsPerMonth: 100,
  maxStorageGB: 1,
  maxSchemas: 5,
  maxWorkflows: 10,
  allowCustomDomain: false,
  allowWhiteLabel: false,
  allowAPIAccess: false,
};

// Default settings for organizations missing this data
const DEFAULT_SETTINGS = {
  defaultTimezone: 'UTC',
  defaultCurrency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h' as const,
};

// Organization data loaded from Firestore

// Helper function to safely convert Firestore Timestamp to Date
function timestampToDate(timestamp: Timestamp | Date | string | number): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  // Firestore Timestamp has toDate() method
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  return new Date();
}

export default function OrganizationDetailPage() {
  const params = useParams();

  const { hasPermission } = useAdminAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'workspaces' | 'usage' | 'billing'>('overview');

  const orgId = params.id as string;

  useEffect(() => {
    async function loadOrganization() {
      try {
        setLoading(true);
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        
        const org = await FirestoreService.get<Organization>(COLLECTIONS.ORGANIZATIONS, orgId);
        
        // Ensure organization has required nested objects with defaults
        if (org) {
          org.planLimits = org.planLimits || DEFAULT_PLAN_LIMITS;
          org.settings = org.settings || DEFAULT_SETTINGS;
        }
        
        setOrganization(org);
        setLoading(false);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to load organization:', err, { file: 'page.tsx' });
        setOrganization(null);
        setLoading(false);
      }
    }

    void loadOrganization();
  }, [orgId]);

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>
          Loading organization...
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Organization Not Found
          </h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            The organization you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/admin/organizations"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: primaryColor,
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '0.5rem',
              fontWeight: '500'
            }}
          >
            Back to Organizations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <Link
            href="/admin/organizations"
            style={{
              color: '#666',
              textDecoration: 'none',
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            ← Back to Organizations
          </Link>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {organization.name}
            </h1>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ color: '#666', fontSize: '0.875rem' }}>
                {organization.slug}
              </span>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                fontWeight: '600',
                backgroundColor: organization.plan === 'enterprise' ? '#7c3aed' : organization.plan === 'pro' ? '#6366f1' : '#6b7280',
                color: '#fff',
                textTransform: 'uppercase'
              }}>
                {organization.plan}
              </span>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                fontWeight: '600',
                backgroundColor: organization.status === 'active' ? '#065f46' : organization.status === 'trial' ? '#78350f' : '#7f1d1d',
                color: organization.status === 'active' ? '#10b981' : organization.status === 'trial' ? '#f59e0b' : '#ef4444',
                textTransform: 'uppercase'
              }}>
                {organization.status}
              </span>
            </div>
          </div>
          {hasPermission('canEditOrganizations') && (
            <Link
              href={`/admin/organizations/${organization.id}/edit`}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: primaryColor,
                color: '#fff',
                textDecoration: 'none',
                borderRadius: '0.5rem',
                fontWeight: '500'
              }}
            >
              Edit Organization
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        borderBottom: `1px solid ${borderColor}`,
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', gap: '2rem' }}>
          {(['overview', 'users', 'workspaces', 'usage', 'billing'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '1rem 0',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? `2px solid ${primaryColor}` : '2px solid transparent',
                color: activeTab === tab ? primaryColor : '#666',
                fontWeight: activeTab === tab ? '600' : '400',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontSize: '0.875rem'
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>
          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            <StatCard label="Total Users" value="15" limit={organization.planLimits.maxUsers} />
            <StatCard label="Total Records" value="850" limit={organization.planLimits.maxRecords} />
            <StatCard label="AI Calls (Month)" value="2,340" limit={organization.planLimits.maxAICallsPerMonth} />
            <StatCard label="Storage Used" value="23.4 GB" limit={`${organization.planLimits.maxStorageGB} GB`} />
          </div>

          {/* Organization Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
            <InfoCard title="Organization Information">
              <InfoRow label="ID" value={organization.id} />
              <InfoRow label="Slug" value={organization.slug} />
              <InfoRow label="Billing Email" value={organization.billingEmail} />
              <InfoRow label="Created" value={timestampToDate(organization.createdAt).toLocaleString()} />
              <InfoRow label="Last Updated" value={timestampToDate(organization.updatedAt).toLocaleString()} />
              {organization.trialEndsAt && (
                <InfoRow
                  label="Trial Ends"
                  value={timestampToDate(organization.trialEndsAt).toLocaleDateString()}
                />
              )}
            </InfoCard>

            <InfoCard title="Settings">
              <InfoRow label="Timezone" value={organization.settings.defaultTimezone} />
              <InfoRow label="Currency" value={organization.settings.defaultCurrency} />
              <InfoRow label="Date Format" value={organization.settings.dateFormat} />
              <InfoRow label="Time Format" value={organization.settings.timeFormat} />
            </InfoCard>

            <InfoCard title="Plan Limits">
              <InfoRow label="Max Users" value={organization.planLimits.maxUsers.toString()} />
              <InfoRow label="Max Records" value={organization.planLimits.maxRecords.toLocaleString()} />
              <InfoRow label="Max AI Calls/Month" value={organization.planLimits.maxAICallsPerMonth.toLocaleString()} />
              <InfoRow label="Max Storage" value={`${organization.planLimits.maxStorageGB} GB`} />
            </InfoCard>

            <InfoCard title="Features">
              <InfoRow 
                label="Custom Domain" 
                value={organization.planLimits.allowCustomDomain ? '✓ Enabled' : '✗ Disabled'} 
                valueColor={organization.planLimits.allowCustomDomain ? '#10b981' : '#ef4444'}
              />
              <InfoRow 
                label="White Label" 
                value={organization.planLimits.allowWhiteLabel ? '✓ Enabled' : '✗ Disabled'} 
                valueColor={organization.planLimits.allowWhiteLabel ? '#10b981' : '#ef4444'}
              />
              <InfoRow 
                label="API Access" 
                value={organization.planLimits.allowAPIAccess ? '✓ Enabled' : '✗ Disabled'} 
                valueColor={organization.planLimits.allowAPIAccess ? '#10b981' : '#ef4444'}
              />
            </InfoCard>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div style={{
          backgroundColor: bgPaper,
          border: `1px solid ${borderColor}`,
          borderRadius: '0.75rem',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{ color: '#666', marginBottom: '1rem' }}>
            User management coming soon
          </div>
          <div style={{ fontSize: '0.875rem', color: '#999' }}>
            This will show all users across all workspaces in this organization
          </div>
        </div>
      )}

      {activeTab === 'workspaces' && (
        <div style={{
          backgroundColor: bgPaper,
          border: `1px solid ${borderColor}`,
          borderRadius: '0.75rem',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{ color: '#666', marginBottom: '1rem' }}>
            Workspace management coming soon
          </div>
          <div style={{ fontSize: '0.875rem', color: '#999' }}>
            This will show all workspaces owned by this organization
          </div>
        </div>
      )}

      {activeTab === 'usage' && (
        <div style={{
          backgroundColor: bgPaper,
          border: `1px solid ${borderColor}`,
          borderRadius: '0.75rem',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{ color: '#666', marginBottom: '1rem' }}>
            Usage analytics coming soon
          </div>
          <div style={{ fontSize: '0.875rem', color: '#999' }}>
            This will show detailed usage metrics: API calls, storage, active users, etc.
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div style={{
          backgroundColor: bgPaper,
          border: `1px solid ${borderColor}`,
          borderRadius: '0.75rem',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{ color: '#666', marginBottom: '1rem' }}>
            Billing management coming soon
          </div>
          <div style={{ fontSize: '0.875rem', color: '#999' }}>
            This will show billing history, invoices, and payment methods
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, limit }: { label: string; value: string | number; limit?: string | number }) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.5rem',
      padding: '1rem'
    }}>
      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
        {value}
      </div>
      {limit && (
        <div style={{ fontSize: '0.75rem', color: '#999' }}>
          of {limit}
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem'
    }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#fff' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.875rem', color: '#666' }}>{label}</span>
      <span style={{ 
        fontSize: '0.875rem', 
        color: (valueColor !== '' && valueColor != null) ? valueColor : '#fff',
        fontWeight: '500' 
      }}>
        {value}
      </span>
    </div>
  );
}

