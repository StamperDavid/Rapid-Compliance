'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useToast } from '@/hooks/useToast';

// Minimal type definitions for this component
interface SocialTrainingSettings {
  emojiUsage: 'none' | 'light' | 'heavy';
  ctaStyle: 'soft' | 'direct' | 'question';
  contentThemes: string[];
  hashtagStrategy: string;
  postingPersonality: string;
  platformPreferences?: {
    twitter?: { maxLength: number; style: string };
    linkedin?: { format: string; tone: string };
    instagram?: { captionStyle: string; hashtagCount: number };
  };
}

interface BrandDNA {
  companyDescription?: string;
  uniqueValue?: string;
  targetAudience?: string;
  toneOfVoice?: string;
  communicationStyle?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
  industry?: string;
  competitors?: string[];
}

type TabType = 'settings' | 'generate' | 'history' | 'knowledge';
type PlatformType = 'twitter' | 'linkedin' | 'instagram';
type EmojiUsage = 'none' | 'light' | 'heavy';
type CTAStyle = 'soft' | 'direct' | 'question';

interface GeneratedPost {
  id: string;
  platform: PlatformType;
  content: string;
  hashtags: string[];
  characterCount: number;
  generatedAt: string;
  topic: string;
}

interface HistoryItem {
  id: string;
  platform: PlatformType;
  content: string;
  topic: string;
  generatedAt: string;
  saved: boolean;
}

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: 'document' | 'example' | 'template';
  uploadedAt: string;
}

const PLATFORM_LIMITS: Record<PlatformType, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
};

const PLATFORM_ICONS: Record<PlatformType, string> = {
  twitter: 'X',
  linkedin: 'in',
  instagram: 'IG',
};

const CONTENT_THEME_OPTIONS = [
  'Industry News', 'Product Updates', 'Behind the Scenes', 'Customer Stories',
  'Tips & Tricks', 'Thought Leadership', 'Company Culture', 'Events',
  'Tutorials', 'Announcements', 'Engagement Posts', 'Polls & Questions'
];

export default function SocialMediaTrainingPage() {
  const { user: _user } = useAuth();
  const { theme } = useOrgTheme();
  const toast = useToast();

  // UI State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [activePlatformTab, setActivePlatformTab] = useState<PlatformType>('twitter');

  // Settings State
  const [emojiUsage, setEmojiUsage] = useState<EmojiUsage>('light');
  const [ctaStyle, setCtaStyle] = useState<CTAStyle>('soft');
  const [contentThemes, setContentThemes] = useState<string[]>(['Industry News', 'Product Updates']);
  const [hashtagStrategy, setHashtagStrategy] = useState('');
  const [postingPersonality, setPostingPersonality] = useState('');

  // Platform-specific settings
  const [twitterSettings, setTwitterSettings] = useState({ maxLength: 280, style: 'conversational' });
  const [linkedinSettings, setLinkedinSettings] = useState({ format: 'professional', tone: 'thought-leader' });
  const [instagramSettings, setInstagramSettings] = useState({ captionStyle: 'storytelling', hashtagCount: 15 });

  // Brand DNA State
  const [brandDNA, setBrandDNA] = useState<Partial<BrandDNA> | null>(null);
  const [overrideForSocial, setOverrideForSocial] = useState(false);
  const [socialBrandOverrides, setSocialBrandOverrides] = useState({
    companyDescription: '',
    toneOfVoice: '' as BrandDNA['toneOfVoice'] | undefined,
    keyPhrases: [] as string[],
  });

  // Generate Test State
  const [generatePlatform, setGeneratePlatform] = useState<PlatformType>('twitter');
  const [generateTopic, setGenerateTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);

  // History & Knowledge State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);

  // Knowledge Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadType, setUploadType] = useState<'document' | 'example' | 'template'>('document');
  const [uploading, setUploading] = useState(false);

  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  // Load settings via API
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/social/training');
      const data = await res.json() as {
        success: boolean;
        settings?: SocialTrainingSettings;
        brandDNA?: BrandDNA;
        history?: HistoryItem[];
        knowledge?: KnowledgeItem[];
      };

      if (!data.success) {
        // Fallback to demo data if API fails
        loadDemoData();
        return;
      }

      if (data.settings) {
        setEmojiUsage(data.settings.emojiUsage || 'light');
        setCtaStyle(data.settings.ctaStyle || 'soft');
        setContentThemes(data.settings.contentThemes || []);
        setHashtagStrategy(data.settings.hashtagStrategy || '');
        setPostingPersonality(data.settings.postingPersonality || '');

        if (data.settings.platformPreferences?.twitter) {
          setTwitterSettings(data.settings.platformPreferences.twitter);
        }
        if (data.settings.platformPreferences?.linkedin) {
          setLinkedinSettings(data.settings.platformPreferences.linkedin);
        }
        if (data.settings.platformPreferences?.instagram) {
          setInstagramSettings(data.settings.platformPreferences.instagram);
        }
      }

      if (data.brandDNA) {
        setBrandDNA(data.brandDNA);
      }

      setHistory(data.history ?? []);
      setKnowledgeItems(data.knowledge ?? []);
    } catch {
      // Fallback to demo data
      loadDemoData();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const loadDemoData = () => {
    setBrandDNA({
      companyDescription: 'AI-powered sales platform that transforms how businesses engage with customers',
      toneOfVoice: 'professional',
      keyPhrases: ['AI-powered', 'customer success', 'data-driven insights', 'seamless integration'],
      targetAudience: 'B2B SaaS companies and sales teams',
      uniqueValue: 'Golden Master architecture for infinite scalability',
    });

    setContentThemes(['Product Updates', 'Thought Leadership', 'Customer Stories']);
    setHashtagStrategy('Use 3-5 relevant hashtags for Twitter, 5-10 for LinkedIn, and 15-20 for Instagram. Focus on industry-specific and branded hashtags.');
    setPostingPersonality('Knowledgeable, approachable, and forward-thinking. We share insights that help sales teams succeed while maintaining a human touch.');

    setHistory([
      {
        id: 'demo-1',
        platform: 'twitter',
        content: 'Just shipped our new AI-powered lead scoring feature! Now you can prioritize your hottest leads automatically. #SalesTech #AI',
        topic: 'Product launch',
        generatedAt: new Date(Date.now() - 86400000).toISOString(),
        saved: true,
      },
      {
        id: 'demo-2',
        platform: 'linkedin',
        content: 'The future of sales isn\'t about working harder - it\'s about working smarter. Our latest case study shows how AI-driven insights helped one team increase conversions by 47%.',
        topic: 'Case study promotion',
        generatedAt: new Date(Date.now() - 172800000).toISOString(),
        saved: true,
      },
    ]);

    setKnowledgeItems([
      {
        id: 'k-1',
        title: 'Brand Voice Guidelines',
        content: 'Our voice is professional yet approachable...',
        type: 'document',
        uploadedAt: new Date(Date.now() - 604800000).toISOString(),
      },
      {
        id: 'k-2',
        title: 'Sample LinkedIn Post - Product Launch',
        content: 'Excited to announce...',
        type: 'example',
        uploadedAt: new Date(Date.now() - 432000000).toISOString(),
      },
    ]);
  };

  // Save settings via API
  const saveSettings = async () => {
    try {
      setSaving(true);

      const res = await fetch('/api/social/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emojiUsage,
          ctaStyle,
          contentThemes,
          hashtagStrategy,
          postingPersonality,
          platformPreferences: {
            twitter: twitterSettings,
            linkedin: linkedinSettings,
            instagram: instagramSettings,
          },
        }),
      });
      const data = await res.json() as { success: boolean; error?: string };

      if (data.success) {
        toast.success('Settings saved successfully!');
      } else {
        toast.error(data.error ?? 'Failed to save settings.');
      }
    } catch {
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Generate sample post via API
  const generateSamplePost = async () => {
    if (!generateTopic.trim()) {
      toast.warning('Please enter a topic or prompt for the post.');
      return;
    }

    setIsGenerating(true);
    setGeneratedPost(null);

    try {
      const res = await fetch('/api/social/training/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: generatePlatform,
          topic: generateTopic,
        }),
      });
      const data = await res.json() as { success: boolean; post?: GeneratedPost; error?: string };

      if (data.success && data.post) {
        setGeneratedPost(data.post);
      } else {
        toast.error(data.error ?? 'Failed to generate post.');
      }
    } catch {
      toast.error('Failed to generate post. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy generated post to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard.');
    }
  };

  // Save generated post to history via API (PUT)
  const saveToHistory = async (post: GeneratedPost) => {
    try {
      const res = await fetch('/api/social/training', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: post.id,
          platform: post.platform,
          content: post.content,
          topic: post.topic,
          hashtags: post.hashtags,
          characterCount: post.characterCount,
          generatedAt: post.generatedAt,
        }),
      });
      const data = await res.json() as { success: boolean };

      if (data.success) {
        setHistory(prev => [{
          id: post.id,
          platform: post.platform,
          content: post.content,
          topic: post.topic,
          generatedAt: post.generatedAt,
          saved: true,
        }, ...prev]);
        toast.success('Saved to history!');
      } else {
        toast.error('Failed to save to history.');
      }
    } catch {
      toast.error('Failed to save to history.');
    }
  };

  // Toggle content theme
  const toggleContentTheme = (theme: string) => {
    setContentThemes(prev =>
      prev.includes(theme)
        ? prev.filter(t => t !== theme)
        : [...prev, theme]
    );
  };

  // Upload knowledge item via API
  const uploadKnowledgeItem = async () => {
    if (!uploadTitle.trim() || !uploadContent.trim()) {
      toast.warning('Please fill in both title and content.');
      return;
    }

    setUploading(true);
    try {
      const res = await fetch('/api/social/training/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadTitle.trim(),
          content: uploadContent.trim(),
          type: uploadType,
        }),
      });
      const data = await res.json() as { success: boolean; item?: KnowledgeItem; error?: string };

      if (data.success && data.item) {
        const newItem = data.item;
        setKnowledgeItems(prev => [newItem, ...prev]);
        setShowUploadModal(false);
        setUploadTitle('');
        setUploadContent('');
        setUploadType('document');
        toast.success('Knowledge item uploaded!');
      } else {
        toast.error(data.error ?? 'Failed to upload knowledge item.');
      }
    } catch {
      toast.error('Failed to upload knowledge item.');
    } finally {
      setUploading(false);
    }
  };

  // Delete knowledge item via API
  const deleteKnowledgeItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/social/training/knowledge?id=${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      const data = await res.json() as { success: boolean };

      if (data.success) {
        setKnowledgeItems(prev => prev.filter(k => k.id !== itemId));
        toast.success('Knowledge item deleted.');
      } else {
        toast.error('Failed to delete knowledge item.');
      }
    } catch {
      toast.error('Failed to delete knowledge item.');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        backgroundColor: 'var(--color-bg-main)',
      }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading Social Media AI Training Lab...</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg-main)',
      color: 'var(--color-text-primary)',
    }}>
      {/* Header */}
      <div style={{
        padding: '2rem',
        borderBottom: '1px solid var(--color-border-light)',
        backgroundColor: 'var(--color-bg-main)',
      }}>
        <div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            color: 'var(--color-text-primary)',
          }}>
            Social Media AI Training Lab
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
            Configure how your AI generates social media content across platforms
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        borderBottom: '1px solid var(--color-border-light)',
        backgroundColor: 'var(--color-bg-main)',
      }}>
        <div style={{
          padding: '0 2rem',
          display: 'flex',
          gap: '2rem',
        }}>
          {(['settings', 'generate', 'history', 'knowledge'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '1rem 0',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? `2px solid ${primaryColor}` : '2px solid transparent',
                color: activeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeTab === tab ? '600' : '400',
                cursor: 'pointer',
                fontSize: '0.875rem',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'settings' ? 'Settings' :
               tab === 'generate' ? 'Generate Test' :
               tab === 'history' ? 'History' : 'Knowledge'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '2rem' }}>
        <div>

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>
              {/* Left Column - Settings */}
              <div>
                {/* Brand DNA Inheritance Section */}
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.75rem',
                  marginBottom: '1.5rem',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                        Brand DNA
                      </h2>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: 'rgba(var(--color-primary-rgb), 0.15)',
                        border: '1px solid rgba(var(--color-primary-rgb), 0.3)',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        color: primaryColor,
                      }}>
                        Inherited from Global Brand DNA
                      </span>
                    </div>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={overrideForSocial}
                        onChange={(e) => setOverrideForSocial(e.target.checked)}
                        style={{ accentColor: primaryColor }}
                      />
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        Override for Social Only
                      </span>
                    </label>
                  </div>

                  {brandDNA && (
                    <div style={{
                      display: 'grid',
                      gap: '1rem',
                      opacity: overrideForSocial ? 0.5 : 1,
                    }}>
                      <div>
                        <label style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-text-disabled)',
                          textTransform: 'uppercase',
                          display: 'block',
                          marginBottom: '0.25rem',
                        }}>
                          Company Description
                        </label>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                          {brandDNA.companyDescription ?? 'Not set'}
                        </p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-text-disabled)',
                            textTransform: 'uppercase',
                            display: 'block',
                            marginBottom: '0.25rem',
                          }}>
                            Tone of Voice
                          </label>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                            {brandDNA.toneOfVoice ?? 'Not set'}
                          </p>
                        </div>
                        <div>
                          <label style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-text-disabled)',
                            textTransform: 'uppercase',
                            display: 'block',
                            marginBottom: '0.25rem',
                          }}>
                            Key Phrases
                          </label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {(brandDNA.keyPhrases ?? []).slice(0, 4).map((phrase, idx) => (
                              <span
                                key={idx}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: 'var(--color-bg-paper)',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.75rem',
                                  color: 'var(--color-text-secondary)',
                                }}
                              >
                                {phrase}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {overrideForSocial && (
                    <div style={{
                      marginTop: '1.5rem',
                      paddingTop: '1.5rem',
                      borderTop: '1px solid var(--color-border-light)',
                    }}>
                      <h3 style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--color-text-primary)',
                        marginBottom: '1rem',
                      }}>
                        Social-Specific Overrides
                      </h3>
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            color: 'var(--color-text-secondary)',
                            marginBottom: '0.5rem',
                          }}>
                            Company Description (Social)
                          </label>
                          <textarea
                            value={socialBrandOverrides.companyDescription}
                            onChange={(e) => setSocialBrandOverrides(prev => ({
                              ...prev,
                              companyDescription: e.target.value,
                            }))}
                            placeholder="How do you describe your company on social media?"
                            rows={2}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              backgroundColor: 'var(--color-bg-paper)',
                              border: '1px solid var(--color-border-strong)',
                              borderRadius: '0.5rem',
                              color: 'var(--color-text-primary)',
                              fontSize: '0.875rem',
                              resize: 'vertical',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Social-Specific Settings */}
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.75rem',
                  marginBottom: '1.5rem',
                }}>
                  <h2 style={{
                    fontSize: '1.125rem',
                    fontWeight: 'bold',
                    marginBottom: '1.5rem',
                    color: 'var(--color-text-primary)',
                  }}>
                    Social-Specific Settings
                  </h2>

                  {/* Emoji Usage */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--color-text-primary)',
                      marginBottom: '0.75rem',
                    }}>
                      Emoji Usage
                    </label>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      {(['none', 'light', 'heavy'] as EmojiUsage[]).map(option => (
                        <label
                          key={option}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1rem',
                            backgroundColor: emojiUsage === option ? 'rgba(var(--color-primary-rgb), 0.15)' : 'var(--color-bg-paper)',
                            border: `1px solid ${emojiUsage === option ? primaryColor : 'var(--color-border-strong)'}`,
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="emojiUsage"
                            value={option}
                            checked={emojiUsage === option}
                            onChange={() => setEmojiUsage(option)}
                            style={{ accentColor: primaryColor }}
                          />
                          <span style={{
                            fontSize: '0.875rem',
                            color: emojiUsage === option ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            textTransform: 'capitalize',
                          }}>
                            {option}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* CTA Style */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--color-text-primary)',
                      marginBottom: '0.75rem',
                    }}>
                      Call-to-Action Style
                    </label>
                    <select
                      value={ctaStyle}
                      onChange={(e) => setCtaStyle(e.target.value as CTAStyle)}
                      style={{
                        width: '100%',
                        maxWidth: '300px',
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.5rem',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                      }}
                    >
                      <option value="soft">Soft - Subtle, non-pushy CTAs</option>
                      <option value="direct">Direct - Clear, action-oriented CTAs</option>
                      <option value="question">Question - Engaging questions to drive discussion</option>
                    </select>
                  </div>

                  {/* Content Themes */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--color-text-primary)',
                      marginBottom: '0.75rem',
                    }}>
                      Content Themes
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {CONTENT_THEME_OPTIONS.map(themeOption => (
                        <button
                          key={themeOption}
                          onClick={() => toggleContentTheme(themeOption)}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: contentThemes.includes(themeOption)
                              ? 'rgba(var(--color-primary-rgb), 0.15)'
                              : 'var(--color-bg-paper)',
                            border: `1px solid ${contentThemes.includes(themeOption) ? primaryColor : 'var(--color-border-strong)'}`,
                            borderRadius: '9999px',
                            color: contentThemes.includes(themeOption) ? primaryColor : 'var(--color-text-secondary)',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                          }}
                        >
                          {themeOption}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hashtag Strategy */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--color-text-primary)',
                      marginBottom: '0.75rem',
                    }}>
                      Hashtag Strategy
                    </label>
                    <textarea
                      value={hashtagStrategy}
                      onChange={(e) => setHashtagStrategy(e.target.value)}
                      placeholder="Describe how hashtags should be used (e.g., number per platform, types of hashtags, branded vs. generic)"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.5rem',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  {/* Posting Personality */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--color-text-primary)',
                      marginBottom: '0.75rem',
                    }}>
                      Posting Personality
                    </label>
                    <textarea
                      value={postingPersonality}
                      onChange={(e) => setPostingPersonality(e.target.value)}
                      placeholder="Describe the personality and voice for social posts (e.g., witty, authoritative, friendly, thought-provoking)"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.5rem',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>

                {/* Platform-Specific Settings */}
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.75rem',
                  marginBottom: '1.5rem',
                }}>
                  <h2 style={{
                    fontSize: '1.125rem',
                    fontWeight: 'bold',
                    marginBottom: '1rem',
                    color: 'var(--color-text-primary)',
                  }}>
                    Platform-Specific Settings
                  </h2>

                  {/* Platform Tabs */}
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '1.5rem',
                    borderBottom: '1px solid var(--color-border-light)',
                    paddingBottom: '0.5rem',
                  }}>
                    {(['twitter', 'linkedin', 'instagram'] as PlatformType[]).map(platform => (
                      <button
                        key={platform}
                        onClick={() => setActivePlatformTab(platform)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: activePlatformTab === platform ? primaryColor : 'transparent',
                          border: 'none',
                          borderRadius: '0.375rem',
                          color: activePlatformTab === platform ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                          fontWeight: activePlatformTab === platform ? '600' : '400',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: activePlatformTab === platform ? 'rgba(var(--color-text-primary-rgb), 0.2)' : 'var(--color-bg-paper)',
                          borderRadius: '0.25rem',
                          fontSize: '0.625rem',
                          fontWeight: 'bold',
                        }}>
                          {PLATFORM_ICONS[platform]}
                        </span>
                        {platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Twitter Settings */}
                  {activePlatformTab === 'twitter' && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          color: 'var(--color-text-secondary)',
                          marginBottom: '0.5rem',
                        }}>
                          Max Character Length
                        </label>
                        <input
                          type="number"
                          value={twitterSettings.maxLength}
                          onChange={(e) => setTwitterSettings(prev => ({
                            ...prev,
                            maxLength: parseInt(e.target.value) || 280,
                          }))}
                          max={280}
                          style={{
                            width: '150px',
                            padding: '0.75rem',
                            backgroundColor: 'var(--color-bg-paper)',
                            border: '1px solid var(--color-border-strong)',
                            borderRadius: '0.5rem',
                            color: 'var(--color-text-primary)',
                            fontSize: '0.875rem',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          color: 'var(--color-text-secondary)',
                          marginBottom: '0.5rem',
                        }}>
                          Writing Style
                        </label>
                        <select
                          value={twitterSettings.style}
                          onChange={(e) => setTwitterSettings(prev => ({
                            ...prev,
                            style: e.target.value,
                          }))}
                          style={{
                            width: '100%',
                            maxWidth: '300px',
                            padding: '0.75rem',
                            backgroundColor: 'var(--color-bg-paper)',
                            border: '1px solid var(--color-border-strong)',
                            borderRadius: '0.5rem',
                            color: 'var(--color-text-primary)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <option value="conversational">Conversational</option>
                          <option value="professional">Professional</option>
                          <option value="witty">Witty & Punchy</option>
                          <option value="informative">Informative</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* LinkedIn Settings */}
                  {activePlatformTab === 'linkedin' && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          color: 'var(--color-text-secondary)',
                          marginBottom: '0.5rem',
                        }}>
                          Post Format
                        </label>
                        <select
                          value={linkedinSettings.format}
                          onChange={(e) => setLinkedinSettings(prev => ({
                            ...prev,
                            format: e.target.value,
                          }))}
                          style={{
                            width: '100%',
                            maxWidth: '300px',
                            padding: '0.75rem',
                            backgroundColor: 'var(--color-bg-paper)',
                            border: '1px solid var(--color-border-strong)',
                            borderRadius: '0.5rem',
                            color: 'var(--color-text-primary)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <option value="professional">Professional Article Style</option>
                          <option value="story">Personal Story</option>
                          <option value="listicle">Listicle / Numbered Points</option>
                          <option value="question">Question-Led Engagement</option>
                        </select>
                      </div>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          color: 'var(--color-text-secondary)',
                          marginBottom: '0.5rem',
                        }}>
                          Tone
                        </label>
                        <select
                          value={linkedinSettings.tone}
                          onChange={(e) => setLinkedinSettings(prev => ({
                            ...prev,
                            tone: e.target.value,
                          }))}
                          style={{
                            width: '100%',
                            maxWidth: '300px',
                            padding: '0.75rem',
                            backgroundColor: 'var(--color-bg-paper)',
                            border: '1px solid var(--color-border-strong)',
                            borderRadius: '0.5rem',
                            color: 'var(--color-text-primary)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <option value="thought-leader">Thought Leader</option>
                          <option value="educator">Educator</option>
                          <option value="motivator">Motivator</option>
                          <option value="connector">Connector</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Instagram Settings */}
                  {activePlatformTab === 'instagram' && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          color: 'var(--color-text-secondary)',
                          marginBottom: '0.5rem',
                        }}>
                          Caption Style
                        </label>
                        <select
                          value={instagramSettings.captionStyle}
                          onChange={(e) => setInstagramSettings(prev => ({
                            ...prev,
                            captionStyle: e.target.value,
                          }))}
                          style={{
                            width: '100%',
                            maxWidth: '300px',
                            padding: '0.75rem',
                            backgroundColor: 'var(--color-bg-paper)',
                            border: '1px solid var(--color-border-strong)',
                            borderRadius: '0.5rem',
                            color: 'var(--color-text-primary)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <option value="storytelling">Storytelling</option>
                          <option value="minimal">Minimal / Clean</option>
                          <option value="educational">Educational</option>
                          <option value="conversational">Conversational</option>
                        </select>
                      </div>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          color: 'var(--color-text-secondary)',
                          marginBottom: '0.5rem',
                        }}>
                          Hashtag Count
                        </label>
                        <input
                          type="number"
                          value={instagramSettings.hashtagCount}
                          onChange={(e) => setInstagramSettings(prev => ({
                            ...prev,
                            hashtagCount: parseInt(e.target.value) || 15,
                          }))}
                          min={0}
                          max={30}
                          style={{
                            width: '150px',
                            padding: '0.75rem',
                            backgroundColor: 'var(--color-bg-paper)',
                            border: '1px solid var(--color-border-strong)',
                            borderRadius: '0.5rem',
                            color: 'var(--color-text-primary)',
                            fontSize: '0.875rem',
                          }}
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.5rem' }}>
                          Recommended: 15-20 hashtags for optimal reach
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <button
                  onClick={() => void saveSettings()}
                  disabled={saving}
                  style={{
                    padding: '0.875rem 2rem',
                    backgroundColor: saving ? 'var(--color-border-strong)' : primaryColor,
                    color: 'var(--color-text-primary)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>

              {/* Right Column - Quick Test Sandbox */}
              <div style={{
                padding: '1.5rem',
                backgroundColor: 'var(--color-bg-main)',
                border: '1px solid var(--color-border-light)',
                borderRadius: '0.75rem',
                height: 'fit-content',
                position: 'sticky',
                top: '2rem',
              }}>
                <h2 style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  marginBottom: '1rem',
                  color: 'var(--color-text-primary)',
                }}>
                  Quick Test
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                  Test your settings by generating a sample post
                </p>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    marginBottom: '0.5rem',
                  }}>
                    Platform
                  </label>
                  <select
                    value={generatePlatform}
                    onChange={(e) => setGeneratePlatform(e.target.value as PlatformType)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-paper)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: '0.5rem',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="twitter">Twitter / X</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="instagram">Instagram</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    marginBottom: '0.5rem',
                  }}>
                    Topic / Prompt
                  </label>
                  <input
                    type="text"
                    value={generateTopic}
                    onChange={(e) => setGenerateTopic(e.target.value)}
                    placeholder="e.g., New feature launch"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-paper)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: '0.5rem',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <button
                  onClick={() => void generateSamplePost()}
                  disabled={isGenerating}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: isGenerating ? 'var(--color-border-strong)' : primaryColor,
                    color: 'var(--color-text-primary)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    marginBottom: '1.5rem',
                  }}
                >
                  {isGenerating ? 'Generating...' : 'Generate Sample Post'}
                </button>

                {generatedPost && (
                  <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-paper)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: '0.5rem',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                    }}>
                      <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                      }}>
                        Preview ({generatedPost.platform})
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        color: generatedPost.characterCount > PLATFORM_LIMITS[generatedPost.platform]
                          ? 'var(--color-error)'
                          : 'var(--color-success)',
                      }}>
                        {generatedPost.characterCount} / {PLATFORM_LIMITS[generatedPost.platform]}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-text-primary)',
                      whiteSpace: 'pre-wrap',
                      marginBottom: '1rem',
                      lineHeight: '1.5',
                    }}>
                      {generatedPost.content}
                    </p>
                    {generatedPost.hashtags.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                          Hashtags: {generatedPost.hashtags.length}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => void generateSamplePost()}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.375rem',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={() => void copyToClipboard(generatedPost.content)}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.375rem',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Generate Test Tab */}
          {activeTab === 'generate' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Left - Input */}
              <div style={{
                padding: '1.5rem',
                backgroundColor: 'var(--color-bg-main)',
                border: '1px solid var(--color-border-light)',
                borderRadius: '0.75rem',
              }}>
                <h2 style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  marginBottom: '1.5rem',
                  color: 'var(--color-text-primary)',
                }}>
                  Generate Test Post
                </h2>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--color-text-primary)',
                    marginBottom: '0.75rem',
                  }}>
                    Platform
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {(['twitter', 'linkedin', 'instagram'] as PlatformType[]).map(platform => (
                      <button
                        key={platform}
                        onClick={() => setGeneratePlatform(platform)}
                        style={{
                          flex: 1,
                          padding: '1rem',
                          backgroundColor: generatePlatform === platform
                            ? 'rgba(var(--color-primary-rgb), 0.15)'
                            : 'var(--color-bg-paper)',
                          border: `1px solid ${generatePlatform === platform ? primaryColor : 'var(--color-border-strong)'}`,
                          borderRadius: '0.5rem',
                          color: generatePlatform === platform ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: generatePlatform === platform
                            ? primaryColor
                            : 'var(--color-border-strong)',
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                        }}>
                          {PLATFORM_ICONS[platform]}
                        </span>
                        <span style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>
                          {platform}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                          {PLATFORM_LIMITS[platform]} chars
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--color-text-primary)',
                    marginBottom: '0.75rem',
                  }}>
                    Topic / Prompt
                  </label>
                  <textarea
                    value={generateTopic}
                    onChange={(e) => setGenerateTopic(e.target.value)}
                    placeholder="Describe what you want to post about..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-paper)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: '0.5rem',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <button
                  onClick={() => void generateSamplePost()}
                  disabled={isGenerating || !generateTopic.trim()}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: (isGenerating || !generateTopic.trim()) ? 'var(--color-border-strong)' : primaryColor,
                    color: 'var(--color-text-primary)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: (isGenerating || !generateTopic.trim()) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isGenerating ? 'Generating...' : 'Generate Sample Post'}
                </button>
              </div>

              {/* Right - Preview */}
              <div style={{
                padding: '1.5rem',
                backgroundColor: 'var(--color-bg-main)',
                border: '1px solid var(--color-border-light)',
                borderRadius: '0.75rem',
              }}>
                <h2 style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  marginBottom: '1.5rem',
                  color: 'var(--color-text-primary)',
                }}>
                  Preview
                </h2>

                {!generatedPost && !isGenerating && (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: 'var(--color-text-disabled)',
                  }}>
                    <p>Enter a topic and click generate to see a preview</p>
                  </div>
                )}

                {isGenerating && (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: 'var(--color-text-secondary)',
                  }}>
                    <p>Generating your post...</p>
                  </div>
                )}

                {generatedPost && !isGenerating && (
                  <div>
                    {/* Platform-styled preview */}
                    <div style={{
                      padding: '1.5rem',
                      backgroundColor: generatePlatform === 'linkedin' ? 'var(--color-info)' :
                                       generatePlatform === 'instagram' ? 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' :
                                       'var(--color-bg-paper)',
                      background: generatePlatform === 'instagram'
                        ? 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
                        : undefined,
                      borderRadius: '0.75rem',
                      marginBottom: '1rem',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '1rem',
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: 'var(--color-border-strong)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          color: 'var(--color-text-primary)',
                        }}>
                          {PLATFORM_ICONS[generatePlatform]}
                        </div>
                        <div>
                          <p style={{ fontWeight: '600', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                            Your Brand
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'rgba(var(--color-text-primary-rgb), 0.7)' }}>
                            @yourbrand
                          </p>
                        </div>
                      </div>
                      <p style={{
                        fontSize: '0.9375rem',
                        color: 'var(--color-text-primary)',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.6',
                      }}>
                        {generatedPost.content}
                      </p>
                    </div>

                    {/* Stats */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '1rem',
                      marginBottom: '1.5rem',
                    }}>
                      <div style={{
                        padding: '1rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        borderRadius: '0.5rem',
                        textAlign: 'center',
                      }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>
                          Characters
                        </p>
                        <p style={{
                          fontSize: '1.25rem',
                          fontWeight: 'bold',
                          color: generatedPost.characterCount > PLATFORM_LIMITS[generatedPost.platform]
                            ? 'var(--color-error)'
                            : 'var(--color-success)',
                        }}>
                          {generatedPost.characterCount}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                          / {PLATFORM_LIMITS[generatedPost.platform]}
                        </p>
                      </div>
                      <div style={{
                        padding: '1rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        borderRadius: '0.5rem',
                        textAlign: 'center',
                      }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>
                          Hashtags
                        </p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                          {generatedPost.hashtags.length}
                        </p>
                      </div>
                      <div style={{
                        padding: '1rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        borderRadius: '0.5rem',
                        textAlign: 'center',
                      }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>
                          Platform
                        </p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                          {generatedPost.platform}
                        </p>
                      </div>
                    </div>

                    {/* Hashtag Preview */}
                    {generatedPost.hashtags.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <p style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-text-disabled)',
                          marginBottom: '0.5rem',
                          textTransform: 'uppercase',
                        }}>
                          Hashtags
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {generatedPost.hashtags.map((tag, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '0.25rem 0.75rem',
                                backgroundColor: 'rgba(var(--color-primary-rgb), 0.15)',
                                border: '1px solid rgba(var(--color-primary-rgb), 0.3)',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                color: primaryColor,
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        onClick={() => void generateSamplePost()}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.5rem',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                        }}
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={() => void copyToClipboard(generatedPost.content)}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.5rem',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                        }}
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => void saveToHistory(generatedPost)}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          backgroundColor: primaryColor,
                          border: 'none',
                          borderRadius: '0.5rem',
                          color: 'var(--color-text-primary)',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1.5rem',
                color: 'var(--color-text-primary)',
              }}>
                Generation History
              </h2>

              {history.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.75rem',
                  color: 'var(--color-text-disabled)',
                }}>
                  <p>No generated posts yet.</p>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    Go to the Generate Test tab to create some content.
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gap: '1rem' }}>
                {history.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '1.5rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '0.75rem',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '1rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: 'var(--color-bg-paper)',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          color: 'var(--color-text-secondary)',
                          textTransform: 'capitalize',
                        }}>
                          {item.platform}
                        </span>
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                          {item.topic}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                        {new Date(item.generatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-text-primary)',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.5',
                      marginBottom: '1rem',
                    }}>
                      {item.content}
                    </p>
                    <button
                      onClick={() => void copyToClipboard(item.content)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.375rem',
                        color: 'var(--color-text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge Tab */}
          {activeTab === 'knowledge' && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}>
                <div>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    marginBottom: '0.5rem',
                    color: 'var(--color-text-primary)',
                  }}>
                    Knowledge Base
                  </h2>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    Upload examples, guidelines, and templates to improve AI generation
                  </p>
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: primaryColor,
                    color: 'var(--color-text-primary)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Upload Document
                </button>
              </div>

              {knowledgeItems.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.75rem',
                  color: 'var(--color-text-disabled)',
                }}>
                  <p>No knowledge items yet.</p>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    Upload brand guidelines, example posts, or templates to train the AI.
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {knowledgeItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '1.5rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '0.75rem',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.75rem',
                    }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: item.type === 'document' ? 'rgba(var(--color-primary-rgb), 0.15)' :
                                         item.type === 'example' ? 'rgba(var(--color-success-rgb), 0.15)' :
                                         'rgba(var(--color-warning-rgb), 0.15)',
                        border: `1px solid ${item.type === 'document' ? 'rgba(var(--color-primary-rgb), 0.3)' :
                                             item.type === 'example' ? 'rgba(var(--color-success-rgb), 0.3)' :
                                             'rgba(var(--color-warning-rgb), 0.3)'}`,
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        color: item.type === 'document' ? primaryColor :
                               item.type === 'example' ? 'var(--color-success)' :
                               'var(--color-warning)',
                        textTransform: 'capitalize',
                      }}>
                        {item.type}
                      </span>
                    </div>
                    <h3 style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: 'var(--color-text-primary)',
                      marginBottom: '0.5rem',
                    }}>
                      {item.title}
                    </h3>
                    <p style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-text-secondary)',
                      marginBottom: '0.75rem',
                    }}>
                      {item.content.substring(0, 100)}...
                    </p>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '0.5rem',
                    }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
                        Uploaded: {new Date(item.uploadedAt).toLocaleDateString()}
                      </p>
                      <button
                        onClick={() => void deleteKnowledgeItem(item.id)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.25rem',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.625rem',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload Knowledge Modal */}
              {showUploadModal && (
                <div style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 50,
                }}>
                  <div style={{
                    backgroundColor: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '0.75rem',
                    padding: '2rem',
                    width: '100%',
                    maxWidth: '500px',
                  }}>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color: 'var(--color-text-primary)',
                      marginBottom: '1.5rem',
                    }}>
                      Upload Knowledge Document
                    </h3>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        color: 'var(--color-text-secondary)',
                        marginBottom: '0.5rem',
                      }}>
                        Title
                      </label>
                      <input
                        type="text"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="e.g., Brand Voice Guidelines"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          backgroundColor: 'var(--color-bg-paper)',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.5rem',
                          color: 'var(--color-text-primary)',
                          fontSize: '0.875rem',
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        color: 'var(--color-text-secondary)',
                        marginBottom: '0.5rem',
                      }}>
                        Type
                      </label>
                      <select
                        value={uploadType}
                        onChange={(e) => setUploadType(e.target.value as 'document' | 'example' | 'template')}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          backgroundColor: 'var(--color-bg-paper)',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.5rem',
                          color: 'var(--color-text-primary)',
                          fontSize: '0.875rem',
                        }}
                      >
                        <option value="document">Document - Brand guidelines, policies</option>
                        <option value="example">Example - Sample posts to learn from</option>
                        <option value="template">Template - Reusable post structures</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        color: 'var(--color-text-secondary)',
                        marginBottom: '0.5rem',
                      }}>
                        Content
                      </label>
                      <textarea
                        value={uploadContent}
                        onChange={(e) => setUploadContent(e.target.value)}
                        placeholder="Paste the content of the document, example post, or template..."
                        rows={8}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          backgroundColor: 'var(--color-bg-paper)',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.5rem',
                          color: 'var(--color-text-primary)',
                          fontSize: '0.875rem',
                          resize: 'vertical',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => {
                          setShowUploadModal(false);
                          setUploadTitle('');
                          setUploadContent('');
                          setUploadType('document');
                        }}
                        style={{
                          padding: '0.75rem 1.5rem',
                          backgroundColor: 'transparent',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.5rem',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => void uploadKnowledgeItem()}
                        disabled={uploading || !uploadTitle.trim() || !uploadContent.trim()}
                        style={{
                          padding: '0.75rem 1.5rem',
                          backgroundColor: (uploading || !uploadTitle.trim() || !uploadContent.trim())
                            ? 'var(--color-border-strong)'
                            : primaryColor,
                          color: 'var(--color-text-primary)',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          cursor: (uploading || !uploadTitle.trim() || !uploadContent.trim())
                            ? 'not-allowed'
                            : 'pointer',
                        }}
                      >
                        {uploading ? 'Uploading...' : 'Upload'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
