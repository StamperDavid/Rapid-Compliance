'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { logger } from '@/lib/logger/logger';
import type { SEOTrainingSettings, BrandDNA } from '@/types/organization';

// SaaS Premium Dark Theme Colors
const COLORS = {
  bg: '#000000',
  card: '#0a0a0a',
  border: '#1a1a1a',
  primary: '#6366f1',
  text: '#ffffff',
  muted: '#999999',
  success: '#10b981',
  warning: '#fbbf24',
  error: '#ef4444',
};

// Default SEO Training Settings
const DEFAULT_SEO_SETTINGS: SEOTrainingSettings = {
  targetSearchIntent: 'informational',
  writingStyle: 'conversational',
  targetKeywords: [],
  contentLength: 'medium',
  structurePreferences: {
    useHeaders: true,
    useLists: true,
    useFAQ: false,
    useImages: true,
  },
  audienceExpertiseLevel: 'intermediate',
};

// Type Definitions
interface GeneratedContent {
  type: 'outline' | 'article';
  content: string;
  seoScore: {
    keywordDensity: number;
    readability: number;
    overall: number;
  };
  timestamp: Date;
}

interface HistoryItem {
  id: string;
  topic: string;
  type: 'outline' | 'article';
  generatedAt: Date;
  seoScore: number;
}

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: 'document' | 'example' | 'template';
  uploadedAt: Date;
}

export default function SEOTrainingPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const { theme } = useOrgTheme();
  const primaryColor = theme?.colors?.primary?.main || COLORS.primary;

  // Loading & UI States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'generate' | 'history' | 'knowledge'>('settings');

  // SEO Settings State
  const [settings, setSettings] = useState<SEOTrainingSettings>(DEFAULT_SEO_SETTINGS);
  const [keywordInput, setKeywordInput] = useState('');

  // Brand DNA State
  const [brandDNA, setBrandDNA] = useState<BrandDNA | null>(null);
  const [overrideForSEO, setOverrideForSEO] = useState(false);

  // Testing Sandbox State
  const [testTopic, setTestTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // History & Knowledge State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [orgId]);

  // Data Loading Function
  const loadData = async () => {
    try {
      setLoading(true);

      const { isFirebaseConfigured } = await import('@/lib/firebase/config');
      if (!isFirebaseConfigured) {
        logger.warn('Firebase not configured, using demo data', { file: 'seo/training/page.tsx' });
        loadDemoData();
        setLoading(false);
        return;
      }

      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      // Load SEO training settings from Firestore
      const seoSettings = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/toolTraining`,
        'seo'
      );
      if (seoSettings) {
        setSettings(seoSettings as SEOTrainingSettings);
      }

      // Load organization Brand DNA
      const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, orgId);
      if (org?.brandDNA) {
        setBrandDNA(org.brandDNA as BrandDNA);
      }

      // Load generation history
      const { orderBy } = await import('firebase/firestore');
      const historyResult = await FirestoreService.getAllPaginated(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/seoHistory`,
        [orderBy('generatedAt', 'desc')],
        50
      );
      setHistory((historyResult.data || []) as HistoryItem[]);

      // Load knowledge base items
      const knowledgeResult = await FirestoreService.getAllPaginated(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/seoKnowledge`,
        [orderBy('uploadedAt', 'desc')],
        50
      );
      setKnowledge((knowledgeResult.data || []) as KnowledgeItem[]);

    } catch (error) {
      logger.error('Error loading SEO training data:', error instanceof Error ? error : undefined, { file: 'seo/training/page.tsx' });
      loadDemoData();
    } finally {
      setLoading(false);
    }
  };

  // Demo Data Loader
  const loadDemoData = () => {
    setBrandDNA({
      companyDescription: 'Leading AI-powered sales platform helping businesses automate their customer relationships.',
      uniqueValue: 'Golden Master architecture for infinite scalability with zero hallucinations',
      targetAudience: 'Sales teams, B2B SaaS companies, and growing businesses',
      toneOfVoice: 'professional',
      communicationStyle: 'Clear, authoritative, and solution-focused',
      keyPhrases: ['AI-powered', 'sales automation', 'customer success'],
      avoidPhrases: ['cheap', 'basic', 'simple tool'],
      industry: 'SaaS / Technology',
      competitors: ['Salesforce', 'HubSpot', 'Pipedrive'],
    });

    setHistory([
      {
        id: 'hist-1',
        topic: 'How to Improve Sales Conversion Rates',
        type: 'article',
        generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        seoScore: 85,
      },
      {
        id: 'hist-2',
        topic: 'CRM Best Practices for 2024',
        type: 'outline',
        generatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        seoScore: 78,
      },
      {
        id: 'hist-3',
        topic: 'AI in Sales: Complete Guide',
        type: 'article',
        generatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        seoScore: 92,
      },
    ]);

    setKnowledge([
      {
        id: 'know-1',
        title: 'SEO Writing Guidelines',
        content: 'Comprehensive guide for SEO-optimized content creation...',
        type: 'document',
        uploadedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'know-2',
        title: 'Sample Blog Post Template',
        content: 'Introduction hook, key points, CTA structure...',
        type: 'template',
        uploadedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
    ]);

    logger.info('Demo data loaded for SEO training', { file: 'seo/training/page.tsx' });
  };

  // Save Settings to Firestore
  const handleSaveSettings = async () => {
    try {
      setSaving(true);

      const { isFirebaseConfigured } = await import('@/lib/firebase/config');
      if (!isFirebaseConfigured) {
        alert('Settings saved (demo mode)');
        setSaving(false);
        return;
      }

      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/toolTraining`,
        'seo',
        {
          ...settings,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.id || 'system',
        },
        true
      );

      logger.info('SEO training settings saved', { file: 'seo/training/page.tsx' });
      alert('SEO training settings saved successfully!');

    } catch (error) {
      logger.error('Error saving SEO settings:', error instanceof Error ? error : undefined, { file: 'seo/training/page.tsx' });
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Keyword Management
  const handleAddKeyword = () => {
    if (keywordInput.trim() && !settings.targetKeywords.includes(keywordInput.trim())) {
      setSettings(prev => ({
        ...prev,
        targetKeywords: [...prev.targetKeywords, keywordInput.trim()],
      }));
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setSettings(prev => ({
      ...prev,
      targetKeywords: prev.targetKeywords.filter(k => k !== keyword),
    }));
  };

  const handleKeywordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  // Content Generation
  const generateContent = async (type: 'outline' | 'article') => {
    if (!testTopic.trim()) {
      alert('Please enter a topic or keyword to generate content.');
      return;
    }

    setIsGenerating(true);

    try {
      const systemPrompt = buildSEOPrompt(type);
      const content = await callAIProvider(testTopic, systemPrompt, type);
      const seoScore = calculateSEOScore(content, settings.targetKeywords);

      const generated: GeneratedContent = {
        type,
        content,
        seoScore,
        timestamp: new Date(),
      };

      setGeneratedContent(generated);
      await saveToHistory(testTopic, type, seoScore.overall);

    } catch (error) {
      logger.error('Error generating SEO content:', error instanceof Error ? error : undefined, { file: 'seo/training/page.tsx' });
      alert('Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Build SEO System Prompt
  const buildSEOPrompt = (type: 'outline' | 'article'): string => {
    let prompt = `You are an expert SEO content writer.\n\n`;

    // Add Brand DNA context if available and not overridden
    if (brandDNA && !overrideForSEO) {
      prompt += `## Brand Context\n`;
      prompt += `Company: ${brandDNA.companyDescription}\n`;
      prompt += `Target Audience: ${brandDNA.targetAudience}\n`;
      prompt += `Industry: ${brandDNA.industry}\n`;
      prompt += `Tone: ${brandDNA.toneOfVoice}\n`;
      prompt += `Key Phrases to Use: ${brandDNA.keyPhrases.join(', ')}\n`;
      prompt += `Phrases to Avoid: ${brandDNA.avoidPhrases.join(', ')}\n\n`;
    }

    prompt += `## SEO Settings\n`;
    prompt += `Search Intent: ${settings.targetSearchIntent}\n`;
    prompt += `Writing Style: ${settings.writingStyle}\n`;
    prompt += `Content Length: ${settings.contentLength}\n`;
    prompt += `Audience Expertise: ${settings.audienceExpertiseLevel}\n`;

    if (settings.targetKeywords.length > 0) {
      prompt += `Target Keywords: ${settings.targetKeywords.join(', ')}\n`;
    }

    prompt += `\n## Structure Preferences\n`;
    if (settings.structurePreferences.useHeaders) prompt += `- Use H2 and H3 headers\n`;
    if (settings.structurePreferences.useLists) prompt += `- Include bullet points and numbered lists\n`;
    if (settings.structurePreferences.useFAQ) prompt += `- Include a FAQ section\n`;
    if (settings.structurePreferences.useImages) prompt += `- Suggest image placements with [IMAGE: description]\n`;

    if (type === 'outline') {
      prompt += `\n## Task\nGenerate a detailed SEO-optimized outline for the given topic. Include:\n`;
      prompt += `- Compelling title with primary keyword\n`;
      prompt += `- Meta description (155 chars max)\n`;
      prompt += `- H2 and H3 structure\n`;
      prompt += `- Key points for each section\n`;
      prompt += `- Suggested word count per section\n`;
    } else {
      prompt += `\n## Task\nWrite a complete SEO-optimized article for the given topic. Include:\n`;
      prompt += `- Engaging title with primary keyword\n`;
      prompt += `- Hook introduction\n`;
      prompt += `- Well-structured body with headers\n`;
      prompt += `- Actionable conclusion with CTA\n`;
      prompt += `- Natural keyword placement throughout\n`;
    }

    return prompt;
  };

  // AI Provider Call
  const callAIProvider = async (topic: string, systemPrompt: string, type: 'outline' | 'article'): Promise<string> => {
    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      const adminKeys = await FirestoreService.get('admin', 'platform-api-keys');

      if (adminKeys?.openrouter?.apiKey) {
        const { OpenRouterProvider } = await import('@/lib/ai/openrouter-provider');
        const provider = new OpenRouterProvider({ apiKey: adminKeys.openrouter.apiKey });

        const response = await provider.chat({
          model: 'anthropic/claude-3.5-sonnet' as any,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate a ${type} for this topic: ${topic}` },
          ],
          temperature: 0.7,
        });

        return response.content;
      }

      // Fallback to Gemini
      const { sendChatMessage } = await import('@/lib/ai/gemini-service');
      const response = await sendChatMessage(
        [{ role: 'user', parts: [{ text: `Generate a ${type} for this topic: ${topic}` }] }] as any,
        systemPrompt
      );

      return response.text;

    } catch {
      // Return demo content for testing when no AI provider available
      if (type === 'outline') {
        return `# ${topic}\n\n## Meta Description\nDiscover everything you need to know about ${topic}. Learn best practices, tips, and strategies to succeed.\n\n## Outline\n\n### H2: Introduction to ${topic}\n- Hook the reader\n- Define key terms\n- Overview of what's covered\n\n### H2: Why ${topic} Matters\n- Statistics and data\n- Real-world impact\n- Common challenges\n\n### H2: Best Practices for ${topic}\n- Tip 1: Research first\n- Tip 2: Create a strategy\n- Tip 3: Measure results\n\n### H2: Common Mistakes to Avoid\n- Mistake 1\n- Mistake 2\n- Mistake 3\n\n### H2: Conclusion & Next Steps\n- Key takeaways\n- Call to action\n- Resources`;
      } else {
        return `# ${topic}: A Complete Guide\n\nAre you looking to master ${topic}? You're in the right place. In this comprehensive guide, we'll explore everything you need to know about ${topic}, from basic concepts to advanced strategies.\n\n## Why ${topic} Matters\n\n${topic} has become increasingly important in today's fast-paced business environment. Companies that excel at ${topic} see significant improvements in their results.\n\n## Best Practices for ${topic}\n\n### 1. Start with Research\n\nBefore diving in, take time to understand your audience and goals.\n\n### 2. Create a Clear Strategy\n\nA well-defined strategy helps you stay focused and measure progress.\n\n### 3. Measure and Optimize\n\nTrack your results regularly and make data-driven adjustments.\n\n## Common Mistakes to Avoid\n\n- **Rushing the process**: Take time to plan properly\n- **Ignoring data**: Let metrics guide your decisions\n- **Forgetting the audience**: Always keep user needs in focus\n\n## Conclusion\n\n${topic} doesn't have to be complicated. By following these best practices and avoiding common pitfalls, you can achieve great results.\n\n**Ready to get started?** Contact us today to learn how we can help you succeed with ${topic}.`;
      }
    }
  };

  // Calculate SEO Score
  const calculateSEOScore = (content: string, keywords: string[]): { keywordDensity: number; readability: number; overall: number } => {
    const words = content.split(/\s+/).length;
    const sentences = content.split(/[.!?]+/).length;

    // Keyword density calculation
    let keywordCount = 0;
    keywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi');
      const matches = content.match(regex);
      keywordCount += matches ? matches.length : 0;
    });
    const keywordDensity = keywords.length > 0
      ? Math.min(100, Math.round((keywordCount / words) * 100 * 10))
      : 50;

    // Readability score (simplified Flesch-Kincaid approximation)
    const avgWordsPerSentence = words / Math.max(sentences, 1);
    const readability = Math.min(100, Math.max(0, Math.round(100 - (avgWordsPerSentence - 15) * 3)));

    // Structure bonus
    const hasHeaders = content.includes('##') || content.includes('# ');
    const hasLists = content.includes('- ') || content.includes('* ') || /\d+\.\s/.test(content);
    const structureBonus = (hasHeaders ? 10 : 0) + (hasLists ? 10 : 0);

    // Overall score
    const overall = Math.min(100, Math.round((keywordDensity + readability + structureBonus) / 2.2));

    return { keywordDensity, readability, overall };
  };

  // Save to History
  const saveToHistory = async (topic: string, type: 'outline' | 'article', seoScore: number) => {
    try {
      const { isFirebaseConfigured } = await import('@/lib/firebase/config');
      if (!isFirebaseConfigured) return;

      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

      const historyItem = {
        topic,
        type,
        generatedAt: new Date().toISOString(),
        seoScore,
        userId: user?.id || 'system',
      };

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/seoHistory`,
        `history_${Date.now()}`,
        historyItem,
        false
      );

      setHistory(prev => [{
        id: `history_${Date.now()}`,
        ...historyItem,
        generatedAt: new Date(),
      }, ...prev]);

    } catch (error) {
      logger.error('Error saving to history:', error instanceof Error ? error : undefined, { file: 'seo/training/page.tsx' });
    }
  };

  // Copy to Clipboard
  const handleCopyToClipboard = useCallback(async () => {
    if (!generatedContent) return;

    try {
      await navigator.clipboard.writeText(generatedContent.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      alert('Failed to copy to clipboard');
    }
  }, [generatedContent]);

  // Reusable Styles
  const cardStyle: React.CSSProperties = {
    backgroundColor: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '0.75rem',
    padding: '1.5rem',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: COLORS.border,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '0.5rem',
    color: COLORS.text,
    fontSize: '0.875rem',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    backgroundColor: primaryColor,
    color: COLORS.text,
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.875rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    color: COLORS.muted,
    fontSize: '0.875rem',
    fontWeight: '600',
  };

  // Loading State
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <p style={{ color: COLORS.muted }}>Loading SEO Training Lab...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: COLORS.bg, color: COLORS.text }}>
      {/* Header Section */}
      <div style={{ padding: '2rem', borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            SEO Content AI Training Lab
          </h1>
          <p style={{ color: COLORS.muted, marginBottom: '1.5rem' }}>
            Configure AI settings for SEO-optimized content generation, test your setup, and refine your content strategy
          </p>

          {/* Status Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Target Intent', value: settings.targetSearchIntent, color: primaryColor },
              { label: 'Writing Style', value: settings.writingStyle },
              { label: 'Target Keywords', value: settings.targetKeywords.length },
              { label: 'Content Generated', value: history.length },
            ].map((stat, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'uppercase', marginBottom: '0.5rem' }}>{stat.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: stat.color || COLORS.text, textTransform: 'capitalize' }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.card }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem', display: 'flex', gap: '2rem' }}>
          {(['settings', 'generate', 'history', 'knowledge'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '1rem 0',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? `2px solid ${primaryColor}` : '2px solid transparent',
                color: activeTab === tab ? COLORS.text : COLORS.muted,
                fontWeight: activeTab === tab ? '600' : '400',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {tab === 'settings' ? 'Settings' : tab === 'generate' ? 'Generate Test' : tab === 'history' ? 'History' : 'Knowledge'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>
              {/* SEO Settings Panel */}
              <div style={cardStyle}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                  SEO-Specific Settings
                </h2>

                {/* Row 1: Intent & Style */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={labelStyle}>Target Search Intent</label>
                    <select
                      value={settings.targetSearchIntent}
                      onChange={e => setSettings(prev => ({ ...prev, targetSearchIntent: e.target.value as any }))}
                      style={selectStyle}
                    >
                      <option value="informational">Informational</option>
                      <option value="transactional">Transactional</option>
                      <option value="navigational">Navigational</option>
                      <option value="commercial">Commercial</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Writing Style</label>
                    <select
                      value={settings.writingStyle}
                      onChange={e => setSettings(prev => ({ ...prev, writingStyle: e.target.value as any }))}
                      style={selectStyle}
                    >
                      <option value="scientific">Scientific</option>
                      <option value="conversational">Conversational</option>
                      <option value="journalistic">Journalistic</option>
                      <option value="technical">Technical</option>
                    </select>
                  </div>
                </div>

                {/* Target Keywords */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={labelStyle}>Target Keywords</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={e => setKeywordInput(e.target.value)}
                      onKeyPress={handleKeywordKeyPress}
                      placeholder="Enter keyword and press Enter"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button onClick={handleAddKeyword} style={{ ...buttonStyle, padding: '0.75rem 1rem' }}>
                      Add
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {settings.targetKeywords.map((keyword, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.375rem 0.75rem',
                          backgroundColor: COLORS.border,
                          borderRadius: '9999px',
                          fontSize: '0.875rem',
                        }}
                      >
                        {keyword}
                        <button
                          onClick={() => handleRemoveKeyword(keyword)}
                          style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer', padding: 0 }}
                        >
                          x
                        </button>
                      </span>
                    ))}
                    {settings.targetKeywords.length === 0 && (
                      <span style={{ color: COLORS.muted, fontSize: '0.875rem' }}>No keywords added</span>
                    )}
                  </div>
                </div>

                {/* Row 2: Length & Expertise */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={labelStyle}>Content Length Preference</label>
                    <select
                      value={settings.contentLength}
                      onChange={e => setSettings(prev => ({ ...prev, contentLength: e.target.value as any }))}
                      style={selectStyle}
                    >
                      <option value="short">Short (500-800 words)</option>
                      <option value="medium">Medium (800-1500 words)</option>
                      <option value="long">Long (1500-2500 words)</option>
                      <option value="comprehensive">Comprehensive (2500+ words)</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Audience Expertise Level</label>
                    <select
                      value={settings.audienceExpertiseLevel}
                      onChange={e => setSettings(prev => ({ ...prev, audienceExpertiseLevel: e.target.value as any }))}
                      style={selectStyle}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                </div>

                {/* Structure Preferences */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ ...labelStyle, marginBottom: '1rem' }}>Structure Preferences</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {[
                      { key: 'useHeaders', label: 'Headers (H2, H3)' },
                      { key: 'useLists', label: 'Bullet & Numbered Lists' },
                      { key: 'useFAQ', label: 'FAQ Section' },
                      { key: 'useImages', label: 'Image Suggestions' },
                    ].map(({ key, label }) => (
                      <label
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          cursor: 'pointer',
                          padding: '0.75rem',
                          backgroundColor: COLORS.border,
                          borderRadius: '0.5rem',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={settings.structurePreferences[key as keyof typeof settings.structurePreferences]}
                          onChange={e => setSettings(prev => ({
                            ...prev,
                            structurePreferences: { ...prev.structurePreferences, [key]: e.target.checked },
                          }))}
                          style={{ width: '1rem', height: '1rem', accentColor: primaryColor }}
                        />
                        <span style={{ fontSize: '0.875rem' }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  style={{ ...buttonStyle, width: '100%', opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>

              {/* Brand DNA Inheritance Panel */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Brand DNA Inheritance</h2>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: `${primaryColor}20`,
                    color: primaryColor,
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}>
                    Inherited from Global Brand DNA
                  </span>
                </div>

                {brandDNA ? (
                  <>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={labelStyle}>Company Description</label>
                      <p style={{ color: COLORS.text, fontSize: '0.875rem', lineHeight: '1.6' }}>
                        {brandDNA.companyDescription}
                      </p>
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={labelStyle}>Target Audience</label>
                      <p style={{ color: COLORS.text, fontSize: '0.875rem', lineHeight: '1.6' }}>
                        {brandDNA.targetAudience}
                      </p>
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={labelStyle}>Industry</label>
                      <p style={{ color: COLORS.text, fontSize: '0.875rem' }}>
                        {brandDNA.industry}
                      </p>
                    </div>

                    {/* Override Toggle */}
                    <div style={{
                      padding: '1rem',
                      backgroundColor: COLORS.border,
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Override for SEO Only</div>
                        <div style={{ fontSize: '0.75rem', color: COLORS.muted }}>Ignore Brand DNA when generating SEO content</div>
                      </div>
                      <button
                        onClick={() => setOverrideForSEO(!overrideForSEO)}
                        style={{
                          width: '48px',
                          height: '24px',
                          borderRadius: '12px',
                          backgroundColor: overrideForSEO ? primaryColor : '#333',
                          border: 'none',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background-color 0.2s',
                        }}
                      >
                        <span style={{
                          position: 'absolute',
                          top: '2px',
                          left: overrideForSEO ? '26px' : '2px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: COLORS.text,
                          transition: 'left 0.2s',
                        }} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.muted }}>
                    <p>No Brand DNA configured yet.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                      Go to Settings to configure your brand identity.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Generate Test Tab */}
          {activeTab === 'generate' && (
            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
              {/* Testing Sandbox Input */}
              <div style={cardStyle}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Testing Sandbox</h2>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={labelStyle}>Topic / Primary Keyword</label>
                  <input
                    type="text"
                    value={testTopic}
                    onChange={e => setTestTopic(e.target.value)}
                    placeholder="e.g., How to Improve Sales Conversion Rates"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    onClick={() => generateContent('outline')}
                    disabled={isGenerating || !testTopic.trim()}
                    style={{
                      ...buttonStyle,
                      width: '100%',
                      backgroundColor: COLORS.border,
                      border: `1px solid ${COLORS.border}`,
                      opacity: isGenerating || !testTopic.trim() ? 0.5 : 1,
                      cursor: isGenerating || !testTopic.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isGenerating ? 'Generating...' : 'Generate Outline'}
                  </button>
                  <button
                    onClick={() => generateContent('article')}
                    disabled={isGenerating || !testTopic.trim()}
                    style={{
                      ...buttonStyle,
                      width: '100%',
                      opacity: isGenerating || !testTopic.trim() ? 0.5 : 1,
                      cursor: isGenerating || !testTopic.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isGenerating ? 'Generating...' : 'Generate Full Article'}
                  </button>
                </div>

                {/* SEO Score Preview */}
                {generatedContent && (
                  <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: COLORS.border, borderRadius: '0.5rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>SEO Score Preview</h3>
                    {[
                      { label: 'Overall Score', value: generatedContent.seoScore.overall, color: generatedContent.seoScore.overall >= 80 ? COLORS.success : generatedContent.seoScore.overall >= 60 ? COLORS.warning : COLORS.error, height: '6px', bold: true },
                      { label: 'Keyword Density', value: generatedContent.seoScore.keywordDensity, color: primaryColor, height: '4px', bold: false },
                      { label: 'Readability', value: generatedContent.seoScore.readability, color: primaryColor, height: '4px', bold: false },
                    ].map((score, idx) => (
                      <div key={idx} style={{ marginBottom: idx < 2 ? '0.75rem' : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: COLORS.muted }}>{score.label}</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: score.bold ? '600' : '400', color: score.bold ? score.color : COLORS.text }}>{score.value}%</span>
                        </div>
                        <div style={{ height: score.height, backgroundColor: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${score.value}%`, height: '100%', backgroundColor: score.color, borderRadius: '3px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Content Preview */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Content Preview</h2>
                  {generatedContent && (
                    <button
                      onClick={handleCopyToClipboard}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: copySuccess ? COLORS.success : COLORS.border,
                        color: COLORS.text,
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                      }}
                    >
                      {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                  )}
                </div>
                {isGenerating ? (
                  <div style={{ textAlign: 'center', padding: '4rem', color: COLORS.muted }}>
                    Generating SEO-optimized content with your settings...
                  </div>
                ) : generatedContent ? (
                  <div style={{ maxHeight: '600px', overflowY: 'auto', padding: '1rem', backgroundColor: COLORS.bg, borderRadius: '0.5rem' }}>
                    <div style={{ lineHeight: '1.8', fontSize: '0.9375rem' }} dangerouslySetInnerHTML={{ __html: formatMarkdown(generatedContent.content) }} />
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '4rem', color: COLORS.muted }}>
                    Enter a topic and click a generate button to see the preview.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Generation History</h2>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: COLORS.muted }}>
                  No content generated yet. Go to the Generate Test tab to create your first SEO content.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {history.map(item => (
                    <div key={item.id} style={{ padding: '1.25rem', backgroundColor: COLORS.border, borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>{item.topic}</h3>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: COLORS.muted }}>
                          <span style={{ textTransform: 'capitalize' }}>{item.type}</span>
                          <span>{new Date(item.generatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: item.seoScore >= 80 ? `${COLORS.success}20` : item.seoScore >= 60 ? `${COLORS.warning}20` : `${COLORS.error}20`,
                        color: item.seoScore >= 80 ? COLORS.success : item.seoScore >= 60 ? COLORS.warning : COLORS.error,
                        borderRadius: '0.375rem',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                      }}>
                        SEO: {item.seoScore}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Knowledge Tab */}
          {activeTab === 'knowledge' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>SEO Knowledge Base</h2>
                  <p style={{ color: COLORS.muted, fontSize: '0.875rem' }}>Upload documents, templates, and examples to improve content generation</p>
                </div>
                <button style={buttonStyle} onClick={() => alert('Knowledge upload coming soon!')}>
                  Upload Knowledge
                </button>
              </div>
              {knowledge.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: COLORS.muted }}>
                  No knowledge items uploaded yet. Upload SEO guidelines, writing templates, or example articles.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {knowledge.map(item => (
                    <div key={item.id} style={{ padding: '1.25rem', backgroundColor: COLORS.border, borderRadius: '0.5rem' }}>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: '600', marginBottom: '0.5rem' }}>{item.title}</h3>
                      <div style={{ fontSize: '0.75rem', color: COLORS.muted }}>
                        <span style={{ textTransform: 'capitalize' }}>{item.type}</span> - {new Date(item.uploadedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// Markdown to HTML Formatter
function formatMarkdown(content: string): string {
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 style="font-size: 1.125rem; font-weight: 600; margin: 1.5rem 0 0.75rem; color: #fff;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size: 1.25rem; font-weight: 600; margin: 1.75rem 0 0.75rem; color: #fff;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 1rem; color: #fff;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 600;">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="margin-left: 1.5rem; margin-bottom: 0.375rem; color: #ccc;">$1</li>')
    .replace(/^\* (.+)$/gm, '<li style="margin-left: 1.5rem; margin-bottom: 0.375rem; color: #ccc;">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left: 1.5rem; margin-bottom: 0.375rem; color: #ccc;">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin-bottom: 1rem; color: #e5e5e5;">')
    .replace(/\n/g, '<br/>');

  return `<p style="margin-bottom: 1rem; color: #e5e5e5;">${html}</p>`;
}
