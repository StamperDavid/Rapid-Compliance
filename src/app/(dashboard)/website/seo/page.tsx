/**
 * SEO Management
 * Site-wide SEO settings, robots.txt, AI bot access controls, llms.txt, analytics
 */

'use client';


import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SubpageNav from '@/components/ui/SubpageNav';
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
  Info,
  Shield,
  Sparkles,
} from 'lucide-react';
import type { SiteConfig } from '@/types/website';
import { logger } from '@/lib/logger/logger';

interface SettingsResponse {
  settings?: Partial<SiteConfig> & {
    robotsTxt?: string;
    llmsTxt?: string;
  };
}

/** Known AI crawler bots with their user-agent strings and labels */
const AI_BOTS = [
  { userAgent: 'GPTBot', label: 'GPTBot', description: 'OpenAI GPT crawler' },
  { userAgent: 'ChatGPT-User', label: 'ChatGPT', description: 'ChatGPT browsing mode' },
  { userAgent: 'Google-Extended', label: 'Gemini', description: 'Google Gemini training' },
  { userAgent: 'Claude-Web', label: 'Claude', description: 'Anthropic Claude crawler' },
  { userAgent: 'anthropic-ai', label: 'Anthropic', description: 'Anthropic AI crawler' },
  { userAgent: 'CCBot', label: 'CCBot', description: 'Common Crawl (AI training)' },
  { userAgent: 'PerplexityBot', label: 'Perplexity', description: 'Perplexity AI search' },
  { userAgent: 'Bytespider', label: 'Bytespider', description: 'ByteDance AI crawler' },
  { userAgent: 'cohere-ai', label: 'Cohere', description: 'Cohere AI crawler' },
] as const;

export default function SEOManagementPage() {
  const authFetch = useAuthFetch();

  const [settings, setSettings] = useState<Partial<SiteConfig> | null>(null);
  const [robotsTxt, setRobotsTxt] = useState('');
  const [llmsTxt, setLlmsTxt] = useState('');
  const [aiBotAccess, setAiBotAccess] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);

      const response = await authFetch('/api/website/settings');
      if (response.ok) {
        const data = await response.json() as SettingsResponse;
        setSettings(data.settings ?? {});
        const robotsTxtValue = data.settings?.robotsTxt ?? '';
        setRobotsTxt(robotsTxtValue !== '' ? robotsTxtValue : getDefaultRobotsTxt());
        setLlmsTxt(data.settings?.llmsTxt ?? '');
        setAiBotAccess(data.settings?.seo?.aiBotAccess ?? {});
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
      logger.error('[SEO] Load error', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

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

      const response = await authFetch('/api/website/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            ...settings,
            robotsTxt,
            llmsTxt: llmsTxt || undefined,
            seo: {
              ...settings.seo,
              aiBotAccess,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error: unknown) {
      logger.error('[SEO] Save error', error instanceof Error ? error : new Error(String(error)));
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

  function toggleAiBot(userAgent: string) {
    setAiBotAccess((prev) => ({
      ...prev,
      [userAgent]: prev[userAgent] === false ? true : prev[userAgent] === true ? false : false,
    }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading SEO settings...</span>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">Failed to load SEO settings</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] p-8">
      <div>
        <SubpageNav items={[
          { label: 'SEO', href: '/website/seo' },
          { label: 'AI Search', href: '/website/seo/ai-search' },
          { label: 'Competitors', href: '/website/seo/competitors' },
          { label: 'Domains', href: '/website/domains' },
          { label: 'Site Settings', href: '/website/settings' },
        ]} />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Search className="w-5 h-5 text-[var(--color-text-primary)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">SEO & Analytics</h1>
              <p className="text-[var(--color-text-secondary)]">Manage site-wide SEO settings and analytics integrations</p>
            </div>
          </div>
        </motion.div>

        {/* Site-wide SEO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Site-wide SEO</h2>
          </div>

          <div className="space-y-5">
            {/* Site Title */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Site Title
              </label>
              <input
                type="text"
                value={settings.seo?.title ?? ''}
                onChange={(e) => updateSEO('title', e.target.value)}
                placeholder="Your Site Title"
                className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
              />
              <p className="mt-1.5 text-xs text-[var(--color-text-disabled)] flex items-center gap-1">
                <Info className="w-3 h-3" />
                Recommended: 50-60 characters
              </p>
            </div>

            {/* Site Description */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Site Description
              </label>
              <textarea
                value={settings.seo?.description ?? ''}
                onChange={(e) => updateSEO('description', e.target.value)}
                placeholder="Describe your site..."
                rows={3}
                className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none"
              />
              <p className="mt-1.5 text-xs text-[var(--color-text-disabled)] flex items-center gap-1">
                <Info className="w-3 h-3" />
                Recommended: 150-160 characters
              </p>
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Keywords (comma-separated)
              </label>
              <input
                type="text"
                value={settings.seo?.keywords?.join(', ') ?? ''}
                onChange={(e) => updateSEO('keywords', e.target.value.split(',').map(k => k.trim()))}
                placeholder="keyword1, keyword2, keyword3"
                className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
              />
            </div>

            {/* OG Image */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
                {/* Image is a lucide-react icon component, not an img tag */}
                <Image className="w-4 h-4 text-[var(--color-text-secondary)]" aria-label="Image icon" />
                Default OG Image URL
              </label>
              <input
                type="text"
                value={settings.seo?.ogImage ?? ''}
                onChange={(e) => updateSEO('ogImage', e.target.value)}
                placeholder="https://yoursite.com/og-image.jpg"
                className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
              />
              <p className="mt-1.5 text-xs text-[var(--color-text-disabled)] flex items-center gap-1">
                <Info className="w-3 h-3" />
                Recommended: 1200x630px for social sharing
              </p>
            </div>

            {/* Favicon */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
                Favicon URL
              </label>
              <input
                type="text"
                value={settings.seo?.favicon ?? ''}
                onChange={(e) => updateSEO('favicon', e.target.value)}
                placeholder="https://yoursite.com/favicon.ico"
                className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
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
                  <div className="w-5 h-5 rounded border border-border-light bg-surface-elevated peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all flex items-center justify-center">
                    {settings.seo?.robotsIndex !== false && (
                      <CheckCircle className="w-3.5 h-3.5 text-[var(--color-text-primary)]" />
                    )}
                  </div>
                </div>
                <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
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
                  <div className="w-5 h-5 rounded border border-border-light bg-surface-elevated peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all flex items-center justify-center">
                    {settings.seo?.robotsFollow !== false && (
                      <CheckCircle className="w-3.5 h-3.5 text-[var(--color-text-primary)]" />
                    )}
                  </div>
                </div>
                <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                  Allow Search Engines to Follow Links
                </span>
              </label>
            </div>
          </div>
        </motion.div>

        {/* AI Bot Access Control */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">AI Bot Access Control</h2>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            Control which AI crawlers can access your site content for training and search indexing. Blocked bots will receive a Disallow directive in robots.txt.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {AI_BOTS.map((bot) => {
              const isAllowed = aiBotAccess[bot.userAgent] !== false;
              return (
                <button
                  key={bot.userAgent}
                  type="button"
                  onClick={() => toggleAiBot(bot.userAgent)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                    isAllowed
                      ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'
                      : 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    isAllowed ? 'bg-emerald-400' : 'bg-red-400'
                  }`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {bot.label}
                    </div>
                    <div className="text-xs text-[var(--color-text-disabled)] truncate">
                      {bot.description}
                    </div>
                  </div>
                  <span className={`ml-auto text-xs font-medium flex-shrink-0 ${
                    isAllowed ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {isAllowed ? 'Allow' : 'Block'}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Analytics Integration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-secondary" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Analytics & Tracking</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Google Analytics */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Google Analytics ID (GA4)
              </label>
              <input
                type="text"
                value={settings.analytics?.googleAnalyticsId ?? ''}
                onChange={(e) => updateAnalytics('googleAnalyticsId', e.target.value)}
                placeholder="G-XXXXXXXXXX"
                className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary/50 transition-all font-mono text-sm"
              />
            </div>

            {/* GTM */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Google Tag Manager ID
              </label>
              <input
                type="text"
                value={settings.analytics?.googleTagManagerId ?? ''}
                onChange={(e) => updateAnalytics('googleTagManagerId', e.target.value)}
                placeholder="GTM-XXXXXX"
                className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary/50 transition-all font-mono text-sm"
              />
            </div>

            {/* Facebook Pixel */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Facebook Pixel ID
              </label>
              <input
                type="text"
                value={settings.analytics?.facebookPixelId ?? ''}
                onChange={(e) => updateAnalytics('facebookPixelId', e.target.value)}
                placeholder="XXXXXXXXXXXXXXX"
                className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary/50 transition-all font-mono text-sm"
              />
            </div>

            {/* Hotjar */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Hotjar Site ID
              </label>
              <input
                type="text"
                value={settings.analytics?.hotjarId ?? ''}
                onChange={(e) => updateAnalytics('hotjarId', e.target.value)}
                placeholder="XXXXXXX"
                className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary/50 transition-all font-mono text-sm"
              />
            </div>
          </div>
        </motion.div>

        {/* Robots.txt */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Bot className="w-5 h-5 text-success" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Robots.txt</h2>
          </div>

          <div>
            <textarea
              value={robotsTxt}
              onChange={(e) => setRobotsTxt(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-success placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-success/50 focus:border-success/50 transition-all font-mono text-sm resize-none"
            />
            <p className="mt-2 text-xs text-[var(--color-text-disabled)]">
              Custom robots.txt overrides auto-generated directives. Leave empty to use auto-generated rules with AI bot controls above.
            </p>
          </div>
        </motion.div>

        {/* llms.txt */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">llms.txt</h2>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            An AI-readable description of your site for LLM crawlers and AI search engines. Leave empty to auto-generate from your site data.
          </p>

          <div>
            <textarea
              value={llmsTxt}
              onChange={(e) => setLlmsTxt(e.target.value)}
              rows={10}
              placeholder="Leave empty to auto-generate from your published pages, blog posts, and SEO settings..."
              className="w-full px-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-violet-300 placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all font-mono text-sm resize-none"
            />
            <p className="mt-2 text-xs text-[var(--color-text-disabled)]">
              Served at /llms.txt — helps AI models understand your site content and structure.
            </p>
          </div>
        </motion.div>

        {/* Sitemap Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-surface-paper backdrop-blur-xl border border-border-light p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Sitemap</h2>
          </div>

          <p className="text-[var(--color-text-secondary)] mb-4">
            Your sitemap is automatically generated and includes all published pages.
          </p>

          <div className="px-4 py-3 bg-surface-elevated border border-border-light rounded-xl font-mono text-sm text-primary">
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
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text-primary)] font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
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
