'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';
import { logger } from '@/lib/logger/logger';

export default function NewOrganizationPage() {
  const router = useRouter();
  const { adminUser, isSuperAdmin } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    billingEmail: '',
    plan: 'free' as 'free' | 'pro' | 'enterprise',
    status: 'active' as 'active' | 'trial' | 'suspended',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { auth } = await import('@/lib/firebase/config');
      
      if (!auth || !auth.currentUser) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }
      
      const token = await auth.currentUser.getIdToken();

      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        logger.info('Organization created', { orgId: result.id, file: 'page.tsx' });
        router.push('/admin/organizations');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create organization');
        setLoading(false);
      }
    } catch (err) {
      logger.error('Failed to create organization', err, { file: 'page.tsx' });
      setError('An error occurred while creating the organization');
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Auto-generate slug from name
    if (name === 'name') {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  };

  if (!isSuperAdmin()) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⛔</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Access Denied</h1>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            You need super admin privileges to create organizations.
          </p>
          <Link href="/admin/organizations" style={{
            display: 'inline-block',
            padding: '0.75rem 2rem',
            backgroundColor: '#6366f1',
            color: '#fff',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: '600'
          }}>
            Back to Organizations
          </Link>
        </div>
      </div>
    );
  }

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{ padding: '2rem', color: '#fff', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/admin/organizations" style={{ color: '#6366f1', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1rem', display: 'inline-block' }}>
          ← Back to Organizations
        </Link>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Create New Organization
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Add a new customer organization to the platform
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: '#7f1d1d',
          border: '1px solid #991b1b',
          borderRadius: '0.5rem',
          color: '#fca5a5'
        }}>
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div style={{
          backgroundColor: bgPaper,
          border: `1px solid ${borderColor}`,
          borderRadius: '0.75rem',
          padding: '2rem'
        }}>
          {/* Organization Name */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Organization Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Acme Corporation"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem'
              }}
            />
          </div>

          {/* Slug */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Slug *
            </label>
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              required
              placeholder="e.g., acme-corporation"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem'
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
              Auto-generated from name, but you can customize it
            </p>
          </div>

          {/* Billing Email */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Billing Email *
            </label>
            <input
              type="email"
              name="billingEmail"
              value={formData.billingEmail}
              onChange={handleChange}
              required
              placeholder="billing@acme.com"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem'
              }}
            />
          </div>

          {/* Plan */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Plan *
            </label>
            <select
              name="plan"
              value={formData.plan}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem'
              }}
            >
              <option value="free">Free</option>
              <option value="pro">Pro ($99/month)</option>
              <option value="enterprise">Enterprise ($499/month)</option>
            </select>
          </div>

          {/* Status */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Status *
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem'
              }}
            >
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: loading ? '#4b5563' : '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              {loading ? 'Creating...' : 'Create Organization'}
            </button>
            <Link
              href="/admin/organizations"
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: 'transparent',
                color: '#fff',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                textDecoration: 'none',
                textAlign: 'center',
                display: 'block'
              }}
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
