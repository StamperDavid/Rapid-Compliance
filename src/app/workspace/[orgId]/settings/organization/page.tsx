'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

export default function OrganizationSettingsPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    companyName: 'Demo Organization',
    businessType: 'technology',
    industry: 'software',
    website: 'https://example.com',
    phone: '+1 (555) 123-4567',
    email: 'contact@example.com',
    address: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94105',
    country: 'United States',
    taxId: '',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    fiscalYearStart: '01-01'
  });

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    }
  }, []);

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const handleSave = async () => {
    setSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Organization settings saved successfully!');
    } catch (error) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
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
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <Link href="/workspace/demo-org/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                ← Back to Settings
              </Link>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Organization Settings</h1>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>
                Manage your organization's basic information and configuration
              </p>
            </div>

            {/* Form */}
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
              {/* Company Information */}
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>Company Information</h2>
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        Business Type
                      </label>
                      <select
                        value={formData.businessType}
                        onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                      >
                        <option value="technology">Technology</option>
                        <option value="retail">Retail</option>
                        <option value="services">Services</option>
                        <option value="manufacturing">Manufacturing</option>
                        <option value="healthcare">Healthcare</option>
                        <option value="finance">Finance</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        Industry
                      </label>
                      <input
                        type="text"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div style={{ marginBottom: '2rem', paddingTop: '2rem', borderTop: '1px solid #333' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>Contact Information</h2>
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        Website
                      </label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div style={{ marginBottom: '2rem', paddingTop: '2rem', borderTop: '1px solid #333' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>Address</h2>
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        City
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        State/Province
                      </label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        ZIP/Postal
                      </label>
                      <input
                        type="text"
                        value={formData.zipCode}
                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Business Settings */}
              <div style={{ marginBottom: '2rem', paddingTop: '2rem', borderTop: '1px solid #333' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>Business Settings</h2>
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        Tax ID/EIN
                      </label>
                      <input
                        type="text"
                        value={formData.taxId}
                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                        placeholder="XX-XXXXXXX"
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        Fiscal Year Start
                      </label>
                      <input
                        type="text"
                        value={formData.fiscalYearStart}
                        onChange={(e) => setFormData({ ...formData, fiscalYearStart: e.target.value })}
                        placeholder="MM-DD"
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        Timezone
                      </label>
                      <select
                        value={formData.timezone}
                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                      >
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="Europe/London">London (GMT)</option>
                        <option value="Europe/Paris">Paris (CET)</option>
                        <option value="Asia/Tokyo">Tokyo (JST)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#ccc', marginBottom: '0.5rem' }}>
                        Currency
                      </label>
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem' }}
                      >
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="CAD">CAD - Canadian Dollar</option>
                        <option value="AUD">AUD - Australian Dollar</option>
                        <option value="JPY">JPY - Japanese Yen</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '2rem', borderTop: '1px solid #333' }}>
                <Link
                  href="/workspace/demo-org/settings"
                  style={{ padding: '0.75rem 1.5rem', backgroundColor: '#222', color: '#fff', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500', border: '1px solid #333' }}
                >
                  Cancel
                </Link>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: primaryColor,
                    color: '#fff',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    opacity: saving ? 0.6 : 1
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


