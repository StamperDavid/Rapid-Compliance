/**
 * SEO Management
 * Site-wide SEO settings, robots.txt, analytics integration
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import AdminBar from '@/components/AdminBar';
import type { SiteConfig } from '@/types/website';

export default function SEOManagementPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [settings, setSettings] = useState<Partial<SiteConfig> | null>(null);
  const [robotsTxt, setRobotsTxt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [orgId]);

  async function loadSettings() {
    try {
      setLoading(true);

      // Load site settings
      const response = await fetch(`/api/website/settings?organizationId=${orgId}`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || {});
        setRobotsTxt(data.settings?.robotsTxt || getDefaultRobotsTxt());
      } else {
        // Initialize defaults
        setSettings({
          seo: {
            title: '',
            description: '',
            keywords: [],
            ogImage: '',
            favicon: '',
            robotsIndex: true,
            robotsFollow: true,
          },
          analytics: {},
        });
        setRobotsTxt(getDefaultRobotsTxt());
      }
    } catch (error) {
      console.error('[SEO] Load error:', error);
    } finally {
      setLoading(false);
    }
  }

  function getDefaultRobotsTxt(): string {
    return `User-agent: *
Allow: /

Sitemap: https://yoursite.com/sitemap.xml`;
  }

  async function saveSettings() {
    if (!settings) {return;}

    try {
      setSaving(true);

      const response = await fetch('/api/website/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          settings: {
            ...settings,
            robotsTxt,
          },
        }),
      });

      if (!response.ok) {throw new Error('Failed to save settings');}

      alert('SEO settings saved successfully!');
    } catch (error) {
      console.error('[SEO] Save error:', error);
      alert('Failed to save SEO settings');
    } finally {
      setSaving(false);
    }
  }

  function updateSEO(field: string, value: any) {
    if (!settings) {return;}

    setSettings({
      ...settings,
      seo: {
        ...settings.seo,
        [field]: value,
      } as any,
    });
  }

  function updateAnalytics(field: string, value: any) {
    if (!settings) {return;}

    setSettings({
      ...settings,
      analytics: {
        ...settings.analytics,
        [field]: value,
      },
    });
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <AdminBar />
        <div>Loading SEO settings...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <AdminBar />
        <div>Failed to load SEO settings</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#f5f5f5' }}>
      <AdminBar />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem', color: '#111' }}>
            SEO & Analytics
          </h1>
          <p style={{ margin: 0, color: '#666' }}>
            Manage site-wide SEO settings and analytics integrations
          </p>
        </div>

        {/* Site-wide SEO */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 1.5rem', color: '#212529' }}>
            Site-wide SEO
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Site Title:
              </label>
              <input
                type="text"
                value={settings.seo?.title || ''}
                onChange={(e) => updateSEO('title', e.target.value)}
                placeholder="Your Site Title"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
              <small style={{ display: 'block', marginTop: '0.25rem', color: '#6c757d' }}>
                Recommended: 50-60 characters
              </small>
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Site Description:
              </label>
              <textarea
                value={settings.seo?.description || ''}
                onChange={(e) => updateSEO('description', e.target.value)}
                placeholder="Describe your site..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <small style={{ display: 'block', marginTop: '0.25rem', color: '#6c757d' }}>
                Recommended: 150-160 characters
              </small>
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Keywords (comma-separated):
              </label>
              <input
                type="text"
                value={settings.seo?.keywords?.join(', ') || ''}
                onChange={(e) => updateSEO('keywords', e.target.value.split(',').map(k => k.trim()))}
                placeholder="keyword1, keyword2, keyword3"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Default OG Image URL:
              </label>
              <input
                type="text"
                value={settings.seo?.ogImage || ''}
                onChange={(e) => updateSEO('ogImage', e.target.value)}
                placeholder="https://yoursite.com/og-image.jpg"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
              <small style={{ display: 'block', marginTop: '0.25rem', color: '#6c757d' }}>
                Recommended: 1200x630px for social sharing
              </small>
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Favicon URL:
              </label>
              <input
                type="text"
                value={settings.seo?.favicon || ''}
                onChange={(e) => updateSEO('favicon', e.target.value)}
                placeholder="https://yoursite.com/favicon.ico"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '2rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={settings.seo?.robotsIndex !== false}
                  onChange={(e) => updateSEO('robotsIndex', e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Allow Search Engines to Index
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={settings.seo?.robotsFollow !== false}
                  onChange={(e) => updateSEO('robotsFollow', e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Allow Search Engines to Follow Links
              </label>
            </div>
          </div>
        </div>

        {/* Analytics Integration */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 1.5rem', color: '#212529' }}>
            Analytics & Tracking
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Google Analytics ID (GA4):
              </label>
              <input
                type="text"
                value={settings.analytics?.googleAnalyticsId || ''}
                onChange={(e) => updateAnalytics('googleAnalyticsId', e.target.value)}
                placeholder="G-XXXXXXXXXX"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Google Tag Manager ID:
              </label>
              <input
                type="text"
                value={settings.analytics?.googleTagManagerId || ''}
                onChange={(e) => updateAnalytics('googleTagManagerId', e.target.value)}
                placeholder="GTM-XXXXXX"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Facebook Pixel ID:
              </label>
              <input
                type="text"
                value={settings.analytics?.facebookPixelId || ''}
                onChange={(e) => updateAnalytics('facebookPixelId', e.target.value)}
                placeholder="XXXXXXXXXXXXXXX"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#495057',
              }}>
                Hotjar Site ID:
              </label>
              <input
                type="text"
                value={settings.analytics?.hotjarId || ''}
                onChange={(e) => updateAnalytics('hotjarId', e.target.value)}
                placeholder="XXXXXXX"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              />
            </div>
          </div>
        </div>

        {/* Robots.txt */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 1.5rem', color: '#212529' }}>
            Robots.txt
          </h2>

          <div>
            <textarea
              value={robotsTxt}
              onChange={(e) => setRobotsTxt(e.target.value)}
              rows={10}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                resize: 'vertical',
              }}
            />
            <small style={{ display: 'block', marginTop: '0.5rem', color: '#6c757d' }}>
              This will be served at /robots.txt
            </small>
          </div>
        </div>

        {/* Sitemap Info */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem', color: '#212529' }}>
            Sitemap
          </h2>
          <p style={{ margin: '0 0 1rem', color: '#495057' }}>
            Your sitemap is automatically generated and includes all published pages.
          </p>
          <div style={{
            padding: '1rem',
            background: '#f8f9fa',
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontFamily: 'monospace',
            color: '#495057',
          }}>
            {settings.subdomain 
              ? `https://${settings.subdomain}.yourplatform.com/sitemap.xml`
              : settings.customDomain
              ? `https://${settings.customDomain}/sitemap.xml`
              : 'Configure your domain to see sitemap URL'}
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={saveSettings}
            disabled={saving}
            style={{
              padding: '0.75rem 2rem',
              background: saving ? '#95a5a6' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
            }}
          >
            {saving ? 'Saving...' : 'Save SEO Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

