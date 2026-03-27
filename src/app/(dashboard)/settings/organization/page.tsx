'use client';

/**
 * Organization Profile Page
 *
 * Company-level settings: business name, address, phone, website, industry,
 * tax ID, social media. Stored in organizations/{PLATFORM_ID}.companyProfile.
 * This is the COMPANY profile, not the individual user profile (/settings/account).
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

interface Address {
  street: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface SocialMedia {
  linkedin: string;
  twitter: string;
  facebook: string;
  instagram: string;
}

interface CompanyProfile {
  companyName: string;
  legalName: string;
  industry: string;
  companySize: string;
  website: string;
  phone: string;
  email: string;
  taxId: string;
  address: Address;
  socialMedia: SocialMedia;
}

const EMPTY_PROFILE: CompanyProfile = {
  companyName: '', legalName: '', industry: '', companySize: '',
  website: '', phone: '', email: '', taxId: '',
  address: { street: '', street2: '', city: '', state: '', zip: '', country: '' },
  socialMedia: { linkedin: '', twitter: '', facebook: '', instagram: '' },
};

const COMPANY_SIZES = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+',
];

const INDUSTRIES = [
  'Technology', 'SaaS', 'E-Commerce', 'Healthcare', 'Financial Services',
  'Real Estate', 'Legal', 'Manufacturing', 'Construction', 'Education',
  'Marketing & Advertising', 'Consulting', 'Retail', 'Hospitality',
  'Transportation & Logistics', 'Insurance', 'Nonprofit', 'Government', 'Other',
];

// ============================================================================
// PAGE
// ============================================================================

export default function OrganizationProfilePage() {
  useAuth();
  const authFetch = useAuthFetch();
  const toast = useToast();

  const [profile, setProfile] = useState<CompanyProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/organization/profile');
      if (!res.ok) { return; }
      const body = await res.json() as { profile?: CompanyProfile };
      if (body.profile) {
        setProfile({
          ...EMPTY_PROFILE,
          ...body.profile,
          address: { ...EMPTY_PROFILE.address, ...body.profile.address },
          socialMedia: { ...EMPTY_PROFILE.socialMedia, ...body.profile.socialMedia },
        });
      }
    } catch (err: unknown) {
      logger.error('[OrgProfile] Load failed', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  // ── Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch('/api/organization/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed' })) as { error?: string };
        throw new Error(body.error ?? 'Failed to save');
      }
      toast.success('Organization profile saved');
      setDirty(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Field updaters ──────────────────────────────────────────────────
  const updateField = (field: keyof CompanyProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const updateAddress = (field: keyof Address, value: string) => {
    setProfile(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));
    setDirty(true);
  };

  const updateSocial = (field: keyof SocialMedia, value: string) => {
    setProfile(prev => ({ ...prev, socialMedia: { ...prev.socialMedia, [field]: value } }));
    setDirty(true);
  };

  // ── Styles ──────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-bg-elevated)',
    borderRadius: '0.75rem', padding: '1.5rem',
  };
  const input: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.75rem', backgroundColor: 'var(--color-bg-main)',
    border: '1px solid var(--color-bg-elevated)', borderRadius: '0.375rem',
    color: 'var(--color-text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' as const,
  };
  const label: React.CSSProperties = {
    display: 'block', fontSize: '0.8125rem', fontWeight: 600,
    color: 'var(--color-text-secondary)', marginBottom: '0.375rem',
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-disabled)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem',
  };
  const row: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem',
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--color-text-disabled)' }}>Loading organization profile...</div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--color-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/settings" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>Settings</Link>
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Organization Profile</h1>
        </div>
        {dirty && (
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              padding: '0.625rem 1.5rem', backgroundColor: 'var(--color-primary)', color: '#fff',
              border: 'none', borderRadius: '0.375rem', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem', fontWeight: 600, opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── Company Information ──────────────────────────────────── */}
          <div style={card}>
            <div style={sectionTitle}>Company Information</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={row}>
                <div>
                  <label style={label}>Company Name</label>
                  <input value={profile.companyName} onChange={(e) => updateField('companyName', e.target.value)} placeholder="SalesVelocity.ai" style={input} />
                </div>
                <div>
                  <label style={label}>Legal Name</label>
                  <input value={profile.legalName} onChange={(e) => updateField('legalName', e.target.value)} placeholder="SalesVelocity Inc." style={input} />
                </div>
              </div>
              <div style={row}>
                <div>
                  <label style={label}>Industry</label>
                  <select value={profile.industry} onChange={(e) => updateField('industry', e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Company Size</label>
                  <select value={profile.companySize} onChange={(e) => updateField('companySize', e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                    <option value="">Select size</option>
                    {COMPANY_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={label}>Website</label>
                <input value={profile.website} onChange={(e) => updateField('website', e.target.value)} placeholder="https://salesvelocity.ai" type="url" style={input} />
              </div>
              <div style={row}>
                <div>
                  <label style={label}>Business Phone</label>
                  <input value={profile.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+1 (555) 000-0000" type="tel" style={input} />
                </div>
                <div>
                  <label style={label}>Business Email</label>
                  <input value={profile.email} onChange={(e) => updateField('email', e.target.value)} placeholder="hello@salesvelocity.ai" type="email" style={input} />
                </div>
              </div>
              <div>
                <label style={label}>Tax ID / EIN</label>
                <input value={profile.taxId} onChange={(e) => updateField('taxId', e.target.value)} placeholder="XX-XXXXXXX" style={input} />
              </div>
            </div>
          </div>

          {/* ── Business Address ─────────────────────────────────────── */}
          <div style={card}>
            <div style={sectionTitle}>Business Address</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-disabled)', margin: '0 0 1rem 0' }}>
              Required for invoices, CAN-SPAM email compliance, and legal documents.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={label}>Street Address</label>
                <input value={profile.address.street} onChange={(e) => updateAddress('street', e.target.value)} placeholder="123 Main Street" style={input} />
              </div>
              <div>
                <label style={label}>Suite / Unit</label>
                <input value={profile.address.street2} onChange={(e) => updateAddress('street2', e.target.value)} placeholder="Suite 100" style={input} />
              </div>
              <div style={row}>
                <div>
                  <label style={label}>City</label>
                  <input value={profile.address.city} onChange={(e) => updateAddress('city', e.target.value)} placeholder="San Francisco" style={input} />
                </div>
                <div>
                  <label style={label}>State / Province</label>
                  <input value={profile.address.state} onChange={(e) => updateAddress('state', e.target.value)} placeholder="CA" style={input} />
                </div>
              </div>
              <div style={row}>
                <div>
                  <label style={label}>ZIP / Postal Code</label>
                  <input value={profile.address.zip} onChange={(e) => updateAddress('zip', e.target.value)} placeholder="94105" style={input} />
                </div>
                <div>
                  <label style={label}>Country</label>
                  <input value={profile.address.country} onChange={(e) => updateAddress('country', e.target.value)} placeholder="United States" style={input} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Social Media ─────────────────────────────────────────── */}
          <div style={card}>
            <div style={sectionTitle}>Social Media Profiles</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={row}>
                <div>
                  <label style={label}>LinkedIn</label>
                  <input value={profile.socialMedia.linkedin} onChange={(e) => updateSocial('linkedin', e.target.value)} placeholder="https://linkedin.com/company/..." style={input} />
                </div>
                <div>
                  <label style={label}>Twitter / X</label>
                  <input value={profile.socialMedia.twitter} onChange={(e) => updateSocial('twitter', e.target.value)} placeholder="https://x.com/..." style={input} />
                </div>
              </div>
              <div style={row}>
                <div>
                  <label style={label}>Facebook</label>
                  <input value={profile.socialMedia.facebook} onChange={(e) => updateSocial('facebook', e.target.value)} placeholder="https://facebook.com/..." style={input} />
                </div>
                <div>
                  <label style={label}>Instagram</label>
                  <input value={profile.socialMedia.instagram} onChange={(e) => updateSocial('instagram', e.target.value)} placeholder="https://instagram.com/..." style={input} />
                </div>
              </div>
            </div>
          </div>

          {/* Save bar (sticky at bottom when dirty) */}
          {dirty && (
            <div style={{
              position: 'sticky', bottom: '1rem', backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-primary)', borderRadius: '0.75rem',
              padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 -4px 12px rgba(0,0,0,0.2)',
            }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>You have unsaved changes</span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => { setProfile(EMPTY_PROFILE); setDirty(false); void loadProfile(); }} style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-bg-elevated)', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                  Discard
                </button>
                <button onClick={() => void handleSave()} disabled={saving} style={{ padding: '0.5rem 1.25rem', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600, opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
