/**
 * SEO Management
 * Site-wide SEO settings, robots.txt, analytics integration
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

'use client';

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  BarChart3,
  FileText,
  Globe,
  Image,
  Link2,
  Bot,
  Save,
  Loader2,
  CheckCircle,
  Info
} from 'lucide-react';
import type { SiteConfig } from '@/types/website';

interface SettingsResponse {
  settings?: Partial<SiteConfig> & {
    robotsTxt?: string;
  };
}

export default function SEOManagementPage() {
  const orgId = DEFAULT_ORG_ID;

  const [settings, setSettings] = useState<Partial<SiteConfig> | null>(null);
  const [robotsTxt, setRobotsTxt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/website/settings?organizationId=${orgId}`);
      if (response.ok) {
        const data = await response.json() as SettingsResponse;
        setSettings(data.settings ?? {});
        const robotsTxtValue = data.settings?.robotsTxt ?? '';
        setRobotsTxt(robotsTxtValue !== '' ? robotsTxtValue : getDefaultRobotsTxt());
      } else {
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
    } catch (error: unknown) {
      console.error('[SEO] Load error:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function getDefaultRobotsTxt(): string {
    return `User-agent: *
Allow: /

Sitemap: https://yoursite.com/sitemap.xml`;
  }

  async function saveSettings(): Promise<void> {
    if (!settings) {
      return;
    }

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

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error: unknown) {
      console.error('[SEO] Save error:', error);
    } finally {
      setSaving(false);
    }
  }

  function updateSEO(field: string, value: string | string[] | boolean) {
    if (!settings) {
      return;
    }

    setSettings({
      ...settings,
      seo: {
        ...settings.seo,
        [field]: value,
      } as SiteConfig['seo'],
    });
  }

  function updateAnalytics(field: string, value: string) {
    if (!settings) {
      return;
    }

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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading SEO settings...</span>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Failed to load SEO settings</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">SEO & Analytics</h1>
              <p className="text-gray-400">Manage site-wide SEO settings and analytics integrations</p>
            </div>
          </div>
        </motion.div>

        {/* Site-wide SEO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-semibold text-white">Site-wide SEO</h2>
          </div>

          <div className="space-y-5">
            {/* Site Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Site Title
              </label>
              <input
                type="text"
                value={settings.seo?.title ?? ''}
                onChange={(e) => updateSEO('title', e.target.value)}
                placeholder="Your Site Title"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              />
              <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Recommended: 50-60 characters
              </p>
            </div>

            {/* Site Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Site Description
              </label>
              <textarea
                value={settings.seo?.description ?? ''}
                onChange={(e) => updateSEO('description', e.target.value)}
                placeholder="Describe your site..."
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none"
              />
              <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Recommended: 150-160 characters
              </p>
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Keywords (comma-separated)
              </label>
              <input
                type="text"
                value={settings.seo?.keywords?.join(', ') ?? ''}
                onChange={(e) => updateSEO('keywords', e.target.value.split(',').map(k => k.trim()))}
                placeholder="keyword1, keyword2, keyword3"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              />
            </div>

            {/* OG Image */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                {/* Image is a lucide-react icon component, not an img tag */}
                <Image className="w-4 h-4 text-gray-400" aria-label="Image icon" />
                Default OG Image URL
              </label>
              <input
                type="text"
                value={settings.seo?.ogImage ?? ''}
                onChange={(e) => updateSEO('ogImage', e.target.value)}
                placeholder="https://yoursite.com/og-image.jpg"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              />
              <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Recommended: 1200x630px for social sharing
              </p>
            </div>

            {/* Favicon */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-gray-400" />
                Favicon URL
              </label>
              <input
                type="text"
                value={settings.seo?.favicon ?? ''}
                onChange={(e) => updateSEO('favicon', e.target.value)}
                placeholder="https://yoursite.com/favicon.ico"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              />
            </div>

            {/* Robot Checkboxes */}
            <div className="flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={settings.seo?.robotsIndex !== false}
                    onChange={(e) => updateSEO('robotsIndex', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 rounded border border-white/20 bg-white/5 peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all flex items-center justify-center">
                    {settings.seo?.robotsIndex !== false && (
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  Allow Search Engines to Index
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={settings.seo?.robotsFollow !== false}
                    onChange={(e) => updateSEO('robotsFollow', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 rounded border border-white/20 bg-white/5 peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all flex items-center justify-center">
                    {settings.seo?.robotsFollow !== false && (
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  Allow Search Engines to Follow Links
                </span>
              </label>
            </div>
          </div>
        </motion.div>

        {/* Analytics Integration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Analytics & Tracking</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Google Analytics */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Google Analytics ID (GA4)
              </label>
              <input
                type="text"
                value={settings.analytics?.googleAnalyticsId ?? ''}
                onChange={(e) => updateAnalytics('googleAnalyticsId', e.target.value)}
                placeholder="G-XXXXXXXXXX"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all font-mono text-sm"
              />
            </div>

            {/* GTM */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Google Tag Manager ID
              </label>
              <input
                type="text"
                value={settings.analytics?.googleTagManagerId ?? ''}
                onChange={(e) => updateAnalytics('googleTagManagerId', e.target.value)}
                placeholder="GTM-XXXXXX"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all font-mono text-sm"
              />
            </div>

            {/* Facebook Pixel */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Facebook Pixel ID
              </label>
              <input
                type="text"
                value={settings.analytics?.facebookPixelId ?? ''}
                onChange={(e) => updateAnalytics('facebookPixelId', e.target.value)}
                placeholder="XXXXXXXXXXXXXXX"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all font-mono text-sm"
              />
            </div>

            {/* Hotjar */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Hotjar Site ID
              </label>
              <input
                type="text"
                value={settings.analytics?.hotjarId ?? ''}
                onChange={(e) => updateAnalytics('hotjarId', e.target.value)}
                placeholder="XXXXXXX"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all font-mono text-sm"
              />
            </div>
          </div>
        </motion.div>

        {/* Robots.txt */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Bot className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold text-white">Robots.txt</h2>
          </div>

          <div>
            <textarea
              value={robotsTxt}
              onChange={(e) => setRobotsTxt(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-emerald-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-mono text-sm resize-none"
            />
            <p className="mt-2 text-xs text-gray-500">
              This will be served at /robots.txt
            </p>
          </div>
        </motion.div>

        {/* Sitemap Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Sitemap</h2>
          </div>

          <p className="text-gray-400 mb-4">
            Your sitemap is automatically generated and includes all published pages.
          </p>

          <div className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl font-mono text-sm text-blue-300">
            {settings.subdomain
              ? `https://${settings.subdomain}.yourplatform.com/sitemap.xml`
              : settings.customDomain
              ? `https://${settings.customDomain}/sitemap.xml`
              : 'Configure your domain to see sitemap URL'}
          </div>
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex justify-end"
        >
          <button
            onClick={() => void saveSettings()}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save SEO Settings
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
