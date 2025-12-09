'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';
import type { Organization } from '@/types/organization';

// This is the same mock data
const getMockOrganizations = (): Organization[] => [
  {
    id: 'org-1',
    name: 'Acme Corporation',
    slug: 'acme-corp',
    plan: 'enterprise',
    planLimits: {
      maxWorkspaces: 10,
      maxUsersPerWorkspace: 100,
      maxRecordsPerWorkspace: 1000000,
      maxAICallsPerMonth: 100000,
      maxStorageGB: 1000,
      maxSchemas: 50,
      maxWorkflows: 100,
      allowCustomDomain: true,
      allowWhiteLabel: true,
      allowAPIAccess: true,
    },
    billingEmail: 'billing@acme.com',
    branding: {},
    settings: {
      defaultTimezone: 'America/New_York',
      defaultCurrency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    createdAt: new Date('2023-01-15') as any,
    updatedAt: new Date() as any,
    createdBy: 'user-1',
    status: 'active',
  },
  {
    id: 'org-2',
    name: 'TechStart Inc',
    slug: 'techstart',
    plan: 'pro',
    planLimits: {
      maxWorkspaces: 3,
      maxUsersPerWorkspace: 25,
      maxRecordsPerWorkspace: 100000,
      maxAICallsPerMonth: 10000,
      maxStorageGB: 100,
      maxSchemas: 20,
      maxWorkflows: 50,
      allowCustomDomain: false,
      allowWhiteLabel: false,
      allowAPIAccess: true,
    },
    billingEmail: 'admin@techstart.com',
    branding: {},
    settings: {
      defaultTimezone: 'America/Los_Angeles',
      defaultCurrency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    createdAt: new Date('2024-02-01') as any,
    updatedAt: new Date() as any,
    createdBy: 'user-2',
    status: 'trial',
    trialEndsAt: new Date('2024-04-01') as any,
  },
  {
    id: 'org-3',
    name: 'Global Services',
    slug: 'global-services',
    plan: 'free',
    planLimits: {
      maxWorkspaces: 1,
      maxUsersPerWorkspace: 5,
      maxRecordsPerWorkspace: 1000,
      maxAICallsPerMonth: 100,
      maxStorageGB: 1,
      maxSchemas: 5,
      maxWorkflows: 10,
      allowCustomDomain: false,
      allowWhiteLabel: false,
      allowAPIAccess: false,
    },
    billingEmail: 'contact@globalservices.com',
    branding: {},
    settings: {
      defaultTimezone: 'UTC',
      defaultCurrency: 'USD',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
    },
    createdAt: new Date('2024-03-10') as any,
    updatedAt: new Date() as any,
    createdBy: 'user-3',
    status: 'suspended',
  },
];

export default function EditOrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const { adminUser, hasPermission } = useAdminAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    plan: 'free' as 'free' | 'pro' | 'enterprise',
    status: 'active' as 'active' | 'trial' | 'suspended',
    billingEmail: '',
    defaultTimezone: 'UTC',
    defaultCurrency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h' as '12h' | '24h',
  });

  const orgId = params.id as string;

  useEffect(() => {
    // Check permissions
    if (!hasPermission('canEditOrganizations')) {
      router.push('/admin/organizations');
      return;
    }

    // Simulate API call
    setTimeout(() => {
      const orgs = getMockOrganizations();
      const org = orgs.find(o => o.id === orgId);
      if (org) {
        setOrganization(org);
        setFormData({
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          status: org.status,
          billingEmail: org.billingEmail,
          defaultTimezone: org.settings.defaultTimezone,
          defaultCurrency: org.settings.defaultCurrency,
          dateFormat: org.settings.dateFormat,
          timeFormat: org.settings.timeFormat,
        });
      }
      setLoading(false);
    }, 300);
  }, [orgId, hasPermission, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Simulate API call
    setTimeout(() => {
      setSaving(false);
      // In production, this would make an API call
      alert('Organization updated successfully!\n\n(This is mock data - no actual changes were saved)');
      router.push(`/admin/organizations/${orgId}`);
    }, 1000);
  };

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
            The organization you're looking for doesn't exist.
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
            href={`/admin/organizations/${orgId}`}
            style={{
              color: '#666',
              textDecoration: 'none',
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            ← Back to Organization Details
          </Link>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Edit Organization
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Update organization settings and plan
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gap: '2rem', maxWidth: '800px' }}>
          {/* Basic Information */}
          <section style={{
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.75rem',
            padding: '1.5rem'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
              Basic Information
            </h2>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              <FormField
                label="Organization Name"
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                required
              />
              
              <FormField
                label="Slug"
                value={formData.slug}
                onChange={(value) => setFormData({ ...formData, slug: value })}
                required
                help="Used in URLs (e.g., /workspace/slug)"
              />
              
              <FormField
                label="Billing Email"
                type="email"
                value={formData.billingEmail}
                onChange={(value) => setFormData({ ...formData, billingEmail: value })}
                required
              />
            </div>
          </section>

          {/* Plan & Status */}
          <section style={{
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.75rem',
            padding: '1.5rem'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
              Plan & Status
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormSelect
                label="Plan"
                value={formData.plan}
                onChange={(value) => setFormData({ ...formData, plan: value as any })}
                options={[
                  { value: 'free', label: 'Free' },
                  { value: 'pro', label: 'Pro ($99/month)' },
                  { value: 'enterprise', label: 'Enterprise ($499/month)' },
                ]}
              />
              
              <FormSelect
                label="Status"
                value={formData.status}
                onChange={(value) => setFormData({ ...formData, status: value as any })}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'trial', label: 'Trial' },
                  { value: 'suspended', label: 'Suspended' },
                ]}
              />
            </div>
          </section>

          {/* Default Settings */}
          <section style={{
            backgroundColor: bgPaper,
            border: `1px solid ${borderColor}`,
            borderRadius: '0.75rem',
            padding: '1.5rem'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
              Default Settings
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormField
                label="Default Timezone"
                value={formData.defaultTimezone}
                onChange={(value) => setFormData({ ...formData, defaultTimezone: value })}
              />
              
              <FormField
                label="Default Currency"
                value={formData.defaultCurrency}
                onChange={(value) => setFormData({ ...formData, defaultCurrency: value })}
              />
              
              <FormField
                label="Date Format"
                value={formData.dateFormat}
                onChange={(value) => setFormData({ ...formData, dateFormat: value })}
              />
              
              <FormSelect
                label="Time Format"
                value={formData.timeFormat}
                onChange={(value) => setFormData({ ...formData, timeFormat: value as any })}
                options={[
                  { value: '12h', label: '12-hour' },
                  { value: '24h', label: '24-hour' },
                ]}
              />
            </div>
          </section>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Link
              href={`/admin/organizations/${orgId}`}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: '500'
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: saving ? '#4338ca' : primaryColor,
                border: 'none',
                borderRadius: '0.5rem',
                color: '#fff',
                fontWeight: '500',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* Warning */}
          <div style={{
            backgroundColor: '#7f1d1d',
            border: '1px solid #991b1b',
            borderRadius: '0.75rem',
            padding: '1rem',
            fontSize: '0.875rem',
            color: '#fecaca'
          }}>
            <strong>Note:</strong> This is currently using mock data. Changes will not be persisted.
            API integration is required for actual data persistence.
          </div>
        </div>
      </form>
    </div>
  );
}

function FormField({ 
  label, 
  value, 
  onChange, 
  type = 'text',
  required = false,
  help 
}: { 
  label: string; 
  value: string; 
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  help?: string;
}) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{
          width: '100%',
          padding: '0.625rem 1rem',
          backgroundColor: bgPaper,
          border: `1px solid ${borderColor}`,
          borderRadius: '0.5rem',
          color: '#fff',
          fontSize: '0.875rem'
        }}
      />
      {help && (
        <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#666' }}>
          {help}
        </div>
      )}
    </div>
  );
}

function FormSelect({ 
  label, 
  value, 
  onChange, 
  options 
}: { 
  label: string; 
  value: string; 
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '0.625rem 1rem',
          backgroundColor: bgPaper,
          border: `1px solid ${borderColor}`,
          borderRadius: '0.5rem',
          color: '#fff',
          fontSize: '0.875rem'
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}






