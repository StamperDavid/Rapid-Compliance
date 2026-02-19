/**
 * Website Settings Page
 * Configure domain, SEO, and analytics for organization's website
 * CRITICAL: Org-scoped - user can only edit their own org's settings
 */

'use client';


import { useState, useEffect, useCallback } from 'react';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import SubpageNav from '@/components/ui/SubpageNav';

interface SettingsResponse {
  settings?: {
    subdomain?: string;
    customDomain?: string;
    customDomainVerified?: boolean;
    sslEnabled?: boolean;
    status?: 'draft' | 'published';
    seo?: {
      title: string;
      description: string;
      keywords: string[];
      robotsIndex: boolean;
      robotsFollow: boolean;
      favicon: string;
    };
    analytics?: {
      googleAnalyticsId: string;
      googleTagManagerId: string;
      facebookPixelId: string;
    };
  };
}

export default function WebsiteSettingsPage() {
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

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/website/settings');

      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const data = await response.json() as SettingsResponse;
      if (data.settings) {
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch (error: unknown) {
      console.error('[Website Settings] Load error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load settings';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleSave(): Promise<void> {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch('/api/website/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error: unknown) {
      console.error('[Website Settings] Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  }

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : 'var(--color-info)';
  const textPrimary = (theme?.colors?.text?.primary !== '' && theme?.colors?.text?.primary != null) ? theme.colors.text.primary : 'var(--color-text-primary)';

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui', color: textPrimary }}>
        <div>Loading settings...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: 'transparent' }}>

      <div style={{ padding: '2rem' }}>
        <SubpageNav items={[
          { label: 'SEO', href: '/website/seo' },
          { label: 'Domains', href: '/website/domains' },
          { label: 'Site Settings', href: '/website/settings' },
        ]} />

        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem', color: 'var(--color-text-primary)' }}>
            Website Settings
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-disabled)' }}>
            Configure your public website domain, SEO, and analytics
          </p>
        </div>

        {message && (
          <div style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            background: message.type === 'success' ? 'var(--color-success-light)' : 'var(--color-error-light)',
            color: message.type === 'success' ? 'var(--color-success-dark)' : 'var(--color-error-dark)',
            border: `1px solid ${message.type === 'success' ? 'var(--color-success-light)' : 'var(--color-error-light)'}`,
            borderRadius: '4px',
          }}>
            {message.text}
          </div>
        )}

        <div style={{ background: 'var(--color-bg-paper)', borderRadius: '8px', padding: '2rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 1.5rem', color: 'var(--color-text-primary)' }}>
            Domain Configuration
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>
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
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
              <span style={{ color: 'var(--color-text-disabled)' }}>.yourplatform.com</span>
            </div>
            <small style={{ color: 'var(--color-text-disabled)', marginTop: '0.25rem', display: 'block' }}>
              Your site will be accessible at {(settings.subdomain !== '' && settings.subdomain != null) ? settings.subdomain : 'your-subdomain'}.yourplatform.com
            </small>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>
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
              border: '1px solid var(--color-border-main)',
              borderRadius: '4px',
              fontSize: '1rem',
              background: 'var(--color-bg-main)',
              color: textPrimary,
            }}
            />
            <small style={{ color: 'var(--color-text-disabled)', marginTop: '0.25rem', display: 'block' }}>
              {settings.customDomainVerified ? (
                <span style={{ color: 'var(--color-success)' }}>✓ Verified and active</span>
              ) : settings.customDomain ? (
                <span style={{ color: 'var(--color-error)' }}>Not verified - DNS configuration required</span>
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
              <span style={{ fontWeight: '500', color: 'var(--color-text-secondary)' }}>Enable SSL (HTTPS)</span>
            </label>
            <small style={{ color: 'var(--color-text-disabled)', marginLeft: '1.75rem', display: 'block' }}>
              Automatically provision SSL certificates for secure connections
            </small>
          </div>
        </div>

        <div style={{ background: 'var(--color-bg-paper)', borderRadius: '8px', padding: '2rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 1.5rem', color: 'var(--color-text-primary)' }}>
            SEO Settings
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>
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
              border: '1px solid var(--color-border-main)',
              borderRadius: '4px',
              fontSize: '1rem',
              background: 'var(--color-bg-main)',
              color: textPrimary,
            }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>
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
                border: '1px solid var(--color-border-light)',
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
              <span style={{ color: 'var(--color-text-secondary)' }}>Allow search indexing</span>
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
              <span style={{ color: 'var(--color-text-secondary)' }}>Allow link following</span>
            </label>
          </div>
        </div>

        <div style={{ background: 'var(--color-bg-paper)', borderRadius: '8px', padding: '2rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 1.5rem', color: 'var(--color-text-primary)' }}>
            Analytics
          </h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>
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
              border: '1px solid var(--color-border-main)',
              borderRadius: '4px',
              fontSize: '1rem',
              background: 'var(--color-bg-main)',
              color: textPrimary,
            }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>
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
              border: '1px solid var(--color-border-main)',
              borderRadius: '4px',
              fontSize: '1rem',
              background: 'var(--color-bg-main)',
              color: textPrimary,
            }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>
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
              border: '1px solid var(--color-border-main)',
              borderRadius: '4px',
              fontSize: '1rem',
              background: 'var(--color-bg-main)',
              color: textPrimary,
            }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={() => void loadSettings()}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--color-bg-paper)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            Reset
          </button>

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              background: primaryColor,
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

