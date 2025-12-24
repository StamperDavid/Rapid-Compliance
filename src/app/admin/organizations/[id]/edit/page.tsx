'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';
import type { Organization } from '@/types/organization'
import { logger } from '@/lib/logger/logger';;

// Default settings for organizations missing this data
const DEFAULT_SETTINGS = {
  defaultTimezone: 'UTC',
  defaultCurrency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h' as const,
};

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

    async function loadOrganization() {
      try {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, orgId) as Organization | null;
        
        if (org) {
          // Ensure settings has defaults
          const settings = org.settings || DEFAULT_SETTINGS;
          
          setOrganization(org);
          setFormData({
            name: org.name || '',
            slug: org.slug || '',
            plan: org.plan || 'free',
            status: org.status || 'active',
            billingEmail: org.billingEmail || '',
            defaultTimezone: settings.defaultTimezone || 'UTC',
            defaultCurrency: settings.defaultCurrency || 'USD',
            dateFormat: settings.dateFormat || 'MM/DD/YYYY',
            timeFormat: settings.timeFormat || '12h',
          });
        }
        setLoading(false);
      } catch (error) {
        logger.error('Failed to load organization:', error, { file: 'page.tsx' });
        setLoading(false);
      }
    }
    
    loadOrganization();
  }, [orgId, hasPermission, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      
      // Update organization in Firestore
      await FirestoreService.update(COLLECTIONS.ORGANIZATIONS, orgId, {
        name: formData.name,
        slug: formData.slug,
        plan: formData.plan,
        status: formData.status,
        billingEmail: formData.billingEmail,
        settings: {
          defaultTimezone: formData.defaultTimezone,
          defaultCurrency: formData.defaultCurrency,
          dateFormat: formData.dateFormat,
          timeFormat: formData.timeFormat,
        },
        updatedAt: new Date(),
      });
      
      setSaving(false);
      router.push(`/admin/organizations/${orgId}`);
    } catch (error) {
      logger.error('Failed to save organization:', error, { file: 'page.tsx' });
      setSaving(false);
      alert('Failed to save organization. Please try again.');
    }
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















