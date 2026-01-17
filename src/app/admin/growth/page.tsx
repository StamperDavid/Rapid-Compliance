/**
 * Admin Growth Dashboard - "God Mode"
 * Platform Admin dogfooding: SEO, Content Factory, Scraper Tools
 * Use the system to promote the system!
 */

'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { logger } from '@/lib/logger/logger';

interface SEOSettings {
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
}

interface ContentItem {
  id: string;
  type: 'blog' | 'social' | 'video';
  title: string;
  status: 'draft' | 'scheduled' | 'published';
  scheduledAt?: string;
  platform?: string;
  createdAt: string;
}

interface ScraperJob {
  id: string;
  url: string;
  type: 'competitor' | 'keywords' | 'backlinks';
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: Record<string, unknown>;
  createdAt: string;
}

interface APIResponse {
  seo?: SEOSettings;
  content?: ContentItem[];
  scraperJobs?: ScraperJob[];
}

interface GenerateContentResponse {
  content: ContentItem;
}

interface StartScraperResponse {
  job: ScraperJob;
}

export default function AdminGrowthPage() {
  useAdminAuth();

  const [activeTab, setActiveTab] = useState<'seo' | 'content' | 'scraper'>('seo');
  const [loading, setLoading] = useState(true);

  // SEO State
  const [seoSettings, setSeoSettings] = useState<SEOSettings>({
    title: 'AI Sales Platform - GoHighLevel Killer',
    description: 'The only AI-native business automation platform you need. Voice agents, CRM, content factory, and more.',
    keywords: ['AI sales', 'voice agents', 'CRM automation', 'GoHighLevel alternative'],
    ogImage: '',
  });

  // Content Factory State
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [newContentType, setNewContentType] = useState<'blog' | 'social'>('blog');
  const [contentTopic, setContentTopic] = useState('');
  const [generating, setGenerating] = useState(false);

  // Scraper State
  const [scraperJobs, setScraperJobs] = useState<ScraperJob[]>([]);
  const [scraperUrl, setScraperUrl] = useState('');
  const [scraperType, setScraperType] = useState<'competitor' | 'keywords' | 'backlinks'>('competitor');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      // Load platform SEO settings
      const response = await fetch('/api/admin/growth/settings');
      if (response.ok) {
        const data = (await response.json()) as APIResponse;
        if (data.seo) {
          setSeoSettings(data.seo);
        }
        if (data.content) {
          setContentItems(data.content);
        }
        if (data.scraperJobs) {
          setScraperJobs(data.scraperJobs);
        }
      }
    } catch (error) {
      logger.error('[AdminGrowth] Load data failed', error instanceof Error ? error : new Error(String(error)), { file: 'growth/page.tsx' });
    } finally {
      setLoading(false);
    }
  }

  async function saveSEOSettings() {
    try {
      const response = await fetch('/api/admin/growth/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seoSettings),
      });
      if (response.ok) {
        logger.info('[AdminGrowth] SEO settings saved successfully', { file: 'growth/page.tsx' });
      }
    } catch (error) {
      logger.error('[AdminGrowth] Save SEO failed', error instanceof Error ? error : new Error(String(error)), { file: 'growth/page.tsx' });
    }
  }

  async function generateContent() {
    if (!contentTopic.trim()) {
      return;
    }

    try {
      setGenerating(true);
      const response = await fetch('/api/admin/growth/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newContentType,
          topic: contentTopic,
          brandVoice: 'professional yet approachable',
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as GenerateContentResponse;
        setContentItems([data.content, ...contentItems]);
        setContentTopic('');
      }
    } catch (error) {
      logger.error('[AdminGrowth] Generate content failed', error instanceof Error ? error : new Error(String(error)), { file: 'growth/page.tsx' });
    } finally {
      setGenerating(false);
    }
  }

  async function startScraperJob() {
    if (!scraperUrl.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/admin/growth/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: scraperUrl,
          type: scraperType,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as StartScraperResponse;
        setScraperJobs([data.job, ...scraperJobs]);
        setScraperUrl('');
      }
    } catch (error) {
      logger.error('[AdminGrowth] Start scraper failed', error instanceof Error ? error : new Error(String(error)), { file: 'growth/page.tsx' });
    }
  }

  const tabStyle = (isActive: boolean) => ({
    padding: '0.75rem 1.5rem',
    background: isActive ? '#3b82f6' : '#e5e7eb',
    color: isActive ? 'white' : '#374151',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    fontWeight: isActive ? '600' : '400',
    fontSize: '0.9rem',
  });

  const cardStyle = {
    background: 'white',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.9rem',
    marginBottom: '0.5rem',
  };

  const buttonStyle = (primary = true) => ({
    padding: '0.75rem 1.5rem',
    background: primary ? '#3b82f6' : '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '0.9rem',
  });

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <div>Loading Growth Dashboard...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: '#f3f4f6' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem', color: '#111827' }}>
            Growth Dashboard - God Mode
          </h1>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Dogfooding: Use the platform to promote the platform. SEO, Content Factory, Competitive Intel.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0' }}>
          <button style={tabStyle(activeTab === 'seo')} onClick={() => setActiveTab('seo')}>
            SEO & Analytics
          </button>
          <button style={tabStyle(activeTab === 'content')} onClick={() => setActiveTab('content')}>
            Content Factory
          </button>
          <button style={tabStyle(activeTab === 'scraper')} onClick={() => setActiveTab('scraper')}>
            Scraper & Intel
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ background: 'white', borderRadius: '0 8px 8px 8px', padding: '2rem' }}>
          {/* SEO Tab */}
          {activeTab === 'seo' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', margin: '0 0 1.5rem', color: '#111827' }}>
                Platform SEO Settings
              </h2>

              <div style={cardStyle}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Site Title:
                </label>
                <input
                  type="text"
                  value={seoSettings.title}
                  onChange={(e) => setSeoSettings({ ...seoSettings, title: e.target.value })}
                  style={inputStyle}
                  placeholder="Your Platform Title"
                />

                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', marginTop: '1rem' }}>
                  Meta Description:
                </label>
                <textarea
                  value={seoSettings.description}
                  onChange={(e) => setSeoSettings({ ...seoSettings, description: e.target.value })}
                  style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                  placeholder="SEO-friendly description..."
                />

                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', marginTop: '1rem' }}>
                  Keywords (comma-separated):
                </label>
                <input
                  type="text"
                  value={seoSettings.keywords.join(', ')}
                  onChange={(e) => setSeoSettings({
                    ...seoSettings,
                    keywords: e.target.value.split(',').map(k => k.trim()),
                  })}
                  style={inputStyle}
                  placeholder="AI sales, voice agents, CRM..."
                />

                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', marginTop: '1rem' }}>
                  OG Image URL:
                </label>
                <input
                  type="text"
                  value={seoSettings.ogImage}
                  onChange={(e) => setSeoSettings({ ...seoSettings, ogImage: e.target.value })}
                  style={inputStyle}
                  placeholder="https://yourplatform.com/og-image.jpg"
                />
              </div>

              <div style={cardStyle}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Analytics Integration</h3>

                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Google Analytics ID (GA4):
                </label>
                <input
                  type="text"
                  value={seoSettings.googleAnalyticsId ?? ''}
                  onChange={(e) => setSeoSettings({ ...seoSettings, googleAnalyticsId: e.target.value })}
                  style={inputStyle}
                  placeholder="G-XXXXXXXXXX"
                />

                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', marginTop: '1rem' }}>
                  Google Tag Manager ID:
                </label>
                <input
                  type="text"
                  value={seoSettings.googleTagManagerId ?? ''}
                  onChange={(e) => setSeoSettings({ ...seoSettings, googleTagManagerId: e.target.value })}
                  style={inputStyle}
                  placeholder="GTM-XXXXXX"
                />
              </div>

              <button onClick={() => void saveSEOSettings()} style={buttonStyle()}>
                Save SEO Settings
              </button>
            </div>
          )}

          {/* Content Factory Tab */}
          {activeTab === 'content' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', margin: '0 0 1.5rem', color: '#111827' }}>
                AI Content Factory
              </h2>

              <div style={cardStyle}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Generate New Content</h3>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <button
                    onClick={() => setNewContentType('blog')}
                    style={{
                      ...buttonStyle(newContentType === 'blog'),
                      background: newContentType === 'blog' ? '#3b82f6' : '#e5e7eb',
                      color: newContentType === 'blog' ? 'white' : '#374151',
                    }}
                  >
                    Blog Post
                  </button>
                  <button
                    onClick={() => setNewContentType('social')}
                    style={{
                      ...buttonStyle(newContentType === 'social'),
                      background: newContentType === 'social' ? '#3b82f6' : '#e5e7eb',
                      color: newContentType === 'social' ? 'white' : '#374151',
                    }}
                  >
                    Social Post
                  </button>
                </div>

                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Topic / Prompt:
                </label>
                <textarea
                  value={contentTopic}
                  onChange={(e) => setContentTopic(e.target.value)}
                  style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                  placeholder={newContentType === 'blog'
                    ? 'Write about why AI voice agents are replacing SDRs...'
                    : 'Create a LinkedIn post about our new power dialer feature...'}
                />

                <button
                  onClick={() => void generateContent()}
                  disabled={generating || !contentTopic.trim()}
                  style={{
                    ...buttonStyle(),
                    opacity: generating || !contentTopic.trim() ? 0.5 : 1,
                    cursor: generating || !contentTopic.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {generating ? 'Generating...' : `Generate ${newContentType === 'blog' ? 'Blog Post' : 'Social Post'}`}
                </button>
              </div>

              <div style={cardStyle}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Content Queue</h3>

                {contentItems.length === 0 ? (
                  <p style={{ color: '#6b7280', margin: 0 }}>No content generated yet. Create your first piece above!</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {contentItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          padding: '1rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{item.title}</div>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                            {item.type.toUpperCase()} - {item.status}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button style={{ ...buttonStyle(false), padding: '0.5rem 1rem' }}>Edit</button>
                          <button style={{ ...buttonStyle(), padding: '0.5rem 1rem' }}>Publish</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Video Factory Coming Soon */}
              <div style={{ ...cardStyle, background: '#f9fafb', border: '2px dashed #d1d5db' }}>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#6b7280' }}>
                  Video Factory (Coming Soon)
                </h3>
                <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}>
                  AI-generated video content with Sora/HeyGen integration. Avatar-based demos, testimonials, and more.
                </p>
              </div>
            </div>
          )}

          {/* Scraper Tab */}
          {activeTab === 'scraper' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', margin: '0 0 1.5rem', color: '#111827' }}>
                Competitive Intelligence Scraper
              </h2>

              <div style={cardStyle}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Start New Scraper Job</h3>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  {(['competitor', 'keywords', 'backlinks'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setScraperType(type)}
                      style={{
                        ...buttonStyle(scraperType === type),
                        background: scraperType === type ? '#3b82f6' : '#e5e7eb',
                        color: scraperType === type ? 'white' : '#374151',
                        textTransform: 'capitalize',
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  {scraperType === 'competitor' && 'Competitor URL:'}
                  {scraperType === 'keywords' && 'Target URL for Keyword Analysis:'}
                  {scraperType === 'backlinks' && 'Domain to Analyze:'}
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <input
                    type="text"
                    value={scraperUrl}
                    onChange={(e) => setScraperUrl(e.target.value)}
                    style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                    placeholder={scraperType === 'competitor'
                      ? 'https://gohighlevel.com'
                      : scraperType === 'keywords'
                      ? 'https://competitor.com/blog'
                      : 'competitor.com'}
                  />
                  <button
                    onClick={() => void startScraperJob()}
                    disabled={!scraperUrl.trim()}
                    style={{
                      ...buttonStyle(),
                      opacity: !scraperUrl.trim() ? 0.5 : 1,
                    }}
                  >
                    Start Scrape
                  </button>
                </div>
              </div>

              <div style={cardStyle}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Scraper Jobs</h3>

                {scraperJobs.length === 0 ? (
                  <p style={{ color: '#6b7280', margin: 0 }}>No scraper jobs yet. Start one above!</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {scraperJobs.map((job) => (
                      <div
                        key={job.id}
                        style={{
                          padding: '1rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{job.url}</div>
                            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                              Type: {job.type.toUpperCase()} | Status:{' '}
                              <span style={{
                                color: job.status === 'completed' ? '#059669' :
                                       job.status === 'failed' ? '#dc2626' :
                                       job.status === 'running' ? '#2563eb' : '#6b7280'
                              }}>
                                {job.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          {job.status === 'completed' && (
                            <button style={{ ...buttonStyle(), padding: '0.5rem 1rem' }}>
                              View Results
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Intel Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div style={cardStyle}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#111827' }}>GoHighLevel</h4>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    Last scraped: Never
                  </div>
                  <button style={{ ...buttonStyle(false), marginTop: '1rem', padding: '0.5rem 1rem' }}>
                    Analyze
                  </button>
                </div>
                <div style={cardStyle}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#111827' }}>HubSpot</h4>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    Last scraped: Never
                  </div>
                  <button style={{ ...buttonStyle(false), marginTop: '1rem', padding: '0.5rem 1rem' }}>
                    Analyze
                  </button>
                </div>
                <div style={cardStyle}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#111827' }}>Salesforce</h4>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    Last scraped: Never
                  </div>
                  <button style={{ ...buttonStyle(false), marginTop: '1rem', padding: '0.5rem 1rem' }}>
                    Analyze
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
