/**
 * Website Settings Page
 * Configure domain, SEO, and analytics for organization's website
 * CRITICAL: Org-scoped - user can only edit their own org's settings
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import AdminBar from '@/components/AdminBar';

export default function WebsiteSettingsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const { theme } = useOrgTheme();

  const [settings, setSettings] = useState({
    subdomain: '',
    customDomain: '',
    customDomainVerified: false,
    sslEnabled: false,
    status: 'draft' as 'draft' | 'published',
    seo: {
      title: '',
      description: '',
      keywords: [] as string[],
      robotsIndex: true,
      robotsFollow: true,
      favicon: '',
    },
    analytics: {
      googleAnalyticsId: '',
      googleTagManagerId: '',
      facebookPixelId: '',
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, [orgId]);

  async function loadSettings() {
    try {
      setLoading(true);
      const response = await fetch(`/api/website/settings?organizationId=${orgId}`);

      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const data = await response.json();
      if (data.settings) {
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch (error: any) {
      console.error('[Website Settings] Load error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch('/api/website/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          settings,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error: any) {
      console.error('[Website Settings] Save error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  const primaryColor = theme?.colors?.primary?.main || '#3b82f6';
  const bgPaper = theme?.colors?.background?.paper || '#1a1a1a';
  const textPrimary = theme?.colors?.text?.primary || '#ffffff';
  const textSecondary = theme?.colors?.text?.secondary || '#9ca3af';

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui', color: textPrimary }}>
        <div>Loading settings...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: 'transparent' }}>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem', color: '#111' }}>
            Website Settings
          </h1>
          <p style={{ margin: 0, color: '#666' }}>
            Configure your public website domain, SEO, and analytics
          </p>
        </div>

        {message && (
          <div style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            background: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24',
            border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '4px',
          }}>
            {message.text}
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 1.5rem', color: '#111' }}>
            Domain Configuration
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: '#333' }}>
              Subdomain
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="text"
                value={settings.subdomain}
                onChange={(e) => setSettings({ ...settings, subdomain: e.target.value.toLowerCase() })}
                placeholder="acme"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
              <span style={{ color: '#666' }}>.yourplatform.com</span>
            </div>
            <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
              Your site will be accessible at {settings.subdomain || 'your-subdomain'}.yourplatform.com
            </small>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: '#333' }}>
              Custom Domain
            </label>
            <input
              type="text"
              value={settings.customDomain}
              onChange={(e) => setSettings({ ...settings, customDomain: e.target.value.toLowerCase() })}
              placeholder="www.acme.com"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '1rem',
              background: '#0a0a0a',
              color: textPrimary,
            }}
            />
            <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
              {settings.customDomainVerified ? (
                <span style={{ color: '#28a745' }}>✓ Verified and active</span>
              ) : settings.customDomain ? (
                <span style={{ color: '#dc3545' }}>Not verified - DNS configuration required</span>
              ) : (
                'Optional: Use your own domain name'
              )}
            </small>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.sslEnabled}
                onChange={(e) => setSettings({ ...settings, sslEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '500', color: '#333' }}>Enable SSL (HTTPS)</span>
            </label>
            <small style={{ color: '#666', marginLeft: '1.75rem', display: 'block' }}>
              Automatically provision SSL certificates for secure connections
            </small>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 1.5rem', color: '#111' }}>
            SEO Settings
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: '#333' }}>
              Site Title
            </label>
            <input
              type="text"
              value={settings.seo.title}
              onChange={(e) => setSettings({
                ...settings,
                seo: { ...settings.seo, title: e.target.value }
              })}
              placeholder="My Awesome Website"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '1rem',
              background: '#0a0a0a',
              color: textPrimary,
            }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: '#333' }}>
              Site Description
            </label>
            <textarea
              value={settings.seo.description}
              onChange={(e) => setSettings({
                ...settings,
                seo: { ...settings.seo, description: e.target.value }
              })}
              placeholder="A brief description of your website"
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.seo.robotsIndex}
                onChange={(e) => setSettings({
                  ...settings,
                  seo: { ...settings.seo, robotsIndex: e.target.checked }
                })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ color: '#333' }}>Allow search indexing</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.seo.robotsFollow}
                onChange={(e) => setSettings({
                  ...settings,
                  seo: { ...settings.seo, robotsFollow: e.target.checked }
                })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ color: '#333' }}>Allow link following</span>
            </label>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 1.5rem', color: '#111' }}>
            Analytics
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: '#333' }}>
              Google Analytics ID
            </label>
            <input
              type="text"
              value={settings.analytics.googleAnalyticsId}
              onChange={(e) => setSettings({
                ...settings,
                analytics: { ...settings.analytics, googleAnalyticsId: e.target.value }
              })}
              placeholder="G-XXXXXXXXXX"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '1rem',
              background: '#0a0a0a',
              color: textPrimary,
            }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: '#333' }}>
              Google Tag Manager ID
            </label>
            <input
              type="text"
              value={settings.analytics.googleTagManagerId}
              onChange={(e) => setSettings({
                ...settings,
                analytics: { ...settings.analytics, googleTagManagerId: e.target.value }
              })}
              placeholder="GTM-XXXXXXX"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '1rem',
              background: '#0a0a0a',
              color: textPrimary,
            }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: '#333' }}>
              Facebook Pixel ID
            </label>
            <input
              type="text"
              value={settings.analytics.facebookPixelId}
              onChange={(e) => setSettings({
                ...settings,
                analytics: { ...settings.analytics, facebookPixelId: e.target.value }
              })}
              placeholder="XXXXXXXXXXXXXXX"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '1rem',
              background: '#0a0a0a',
              color: textPrimary,
            }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={loadSettings}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            Reset
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              background: theme?.primaryColor || '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

