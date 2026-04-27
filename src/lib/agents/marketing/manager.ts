/**
 * Marketing Manager (L2 Orchestrator)
 * STATUS: FUNCTIONAL
 *
 * Industry-Agnostic Cross-Channel Commander for marketing campaign orchestration.
 * Dynamically adapts to ANY business context via MemoryVault Brand DNA.
 *
 * ARCHITECTURE:
 * - Zero hardcoded industry assumptions - all context derived at runtime
 * - Dynamic specialist resolution via SwarmRegistry pattern
 * - SEO-Social feedback loop for keyword integration
 * - Brand voice consistency across all channels
 * - Parallel specialist execution with graceful degradation
 *
 * SPECIALISTS ORCHESTRATED:
 * - TIKTOK_EXPERT: Short-form viral video content
 * - TWITTER_X_EXPERT: Threads, engagement, thought leadership
 * - FACEBOOK_ADS_EXPERT: Paid ads, lead generation, retargeting
 * - LINKEDIN_EXPERT: B2B content, professional networking
 * - YOUTUBE_EXPERT: Long-form video, tutorials, SEO-driven content
 * - INSTAGRAM_EXPERT: Visual storytelling, reels, carousels, stories
 * - PINTEREST_EXPERT: Visual search, keyword-rich pins, seasonal content
 * - PAID_ADS_SPECIALIST: Campaign strategy, budget allocation, ad optimization
 * - SEO_EXPERT: Keyword research, content optimization
 * - GROWTH_ANALYST: Performance analytics, mutation directives, growth tracking
 * - REDDIT_EXPERT: Community engagement, subreddit-aware posts, AMA-style content
 * - THREADS_EXPERT: Meta Threads minimalist posts, thread chains, conversational tone
 * - GOOGLE_BUSINESS_EXPERT: Local business updates, CTA-driven posts, Google Business Profile
 * - TELEGRAM_EXPERT: Telegram channel announcements, broadcasts, longer-form content
 * - WHATSAPP_BUSINESS_EXPERT: WhatsApp Business broadcasts, template messages, opt-in comms
 *
 * @module agents/marketing/manager
 */

import { BaseManager } from '../base-manager';
import type { AgentMessage, AgentReport, ManagerConfig, Signal } from '../types';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getTikTokExpert } from './tiktok/specialist';
import { getTwitterExpert } from './twitter/specialist';
import { getFacebookAdsExpert } from './facebook/specialist';
import { getLinkedInExpert } from './linkedin/specialist';
import { getSEOExpert } from './seo/specialist';
import { getGrowthAnalyst } from './growth-analyst/specialist';
import { getYouTubeExpert } from './youtube/specialist';
import { getInstagramExpert } from './instagram/specialist';
import { getPinterestExpert } from './pinterest/specialist';
import { getBlueskyExpert } from './bluesky/specialist';
import { getMastodonExpert } from './mastodon/specialist';
import { getPaidAdsSpecialist } from './paid-ads/specialist';
import { getRedditExpert } from './reddit/specialist';
import { getThreadsExpert } from './threads/specialist';
import { getGoogleBusinessExpert } from './google-business/specialist';
import { getTelegramExpert } from './telegram/specialist';
import { getWhatsAppBusinessExpert } from './whatsapp-business/specialist';
import {
  getMemoryVault,
  shareInsight,
  checkPendingSignals,
  broadcastSignal,
  type InsightData,
  type SignalEntry,
} from '../shared/memory-vault';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import { logger } from '@/lib/logger/logger';

// Minimal BrandDNA type for this manager (used by getBrandDNA return type)
interface _BrandDNA {
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

// ============================================================================
// SYSTEM PROMPT - Industry-Agnostic Marketing Orchestration
// ============================================================================

const SYSTEM_PROMPT = `You are the Marketing Manager, an industry-agnostic L2 orchestrator for cross-channel marketing campaigns.

## YOUR ROLE
You coordinate 6 specialists to execute unified marketing campaigns for ANY business type.
All industry context, brand voice, and messaging guidelines are loaded dynamically from the organization's Brand DNA.

SPECIALISTS YOU ORCHESTRATE:
- TIKTOK_EXPERT: Short-form viral video, Gen Z/young millennials, trending content
- TWITTER_X_EXPERT: Threads, thought leadership, B2B engagement, real-time conversations
- FACEBOOK_ADS_EXPERT: Paid ads, lead generation, retargeting, older demographics
- LINKEDIN_EXPERT: B2B content, professional networking, executive thought leadership
- YOUTUBE_EXPERT: Long-form video, tutorials, SEO-driven content, subscriber growth
- INSTAGRAM_EXPERT: Visual storytelling, reels, carousels, stories, hashtag strategy
- PINTEREST_EXPERT: Visual search, keyword-rich pins, boards, seasonal content planning
- PAID_ADS_SPECIALIST: Paid campaign strategy, budget allocation, audience targeting, ad optimization across all platforms
- SEO_EXPERT: Keyword research, content optimization, search visibility
- GROWTH_ANALYST: Performance analytics, pattern identification, strategy mutations, growth tracking
- REDDIT_EXPERT: Community engagement, subreddit-aware posts, AMA-style content, organic discussion
- THREADS_EXPERT: Meta Threads minimalist posts, thread chains, conversational tone
- GOOGLE_BUSINESS_EXPERT: Local business updates, CTA-driven posts, Google Business Profile
- TELEGRAM_EXPERT: Telegram channel announcements, broadcasts, longer-form content with formatting
- WHATSAPP_BUSINESS_EXPERT: WhatsApp Business broadcasts, template messages, opt-in audience comms

## INDUSTRY-AGNOSTIC APPROACH
- NEVER assume a specific industry (trucking, SaaS, retail, etc.)
- ALWAYS derive context from the Brand DNA loaded at runtime
- Adapt messaging to match the organization's unique voice and audience
- Use industry-specific terminology ONLY when provided in Brand DNA

## CAMPAIGN ORCHESTRATION FLOW
1. Load Brand DNA (voice, audience, industry context)
2. Parse campaign goal into structured objectives
3. Request SEO keywords from SEO_EXPERT
4. Inject keywords into social content briefs
5. Delegate to relevant platform specialists in parallel
6. Aggregate results into unified CampaignBrief
7. Store insights in MemoryVault for learning

## SEO-SOCIAL FEEDBACK LOOP
Before delegating to social specialists:
1. SEO_EXPERT analyzes the campaign goal
2. Returns target keywords and search intent
3. Keywords are injected into each social specialist's brief
4. Social content naturally incorporates SEO terms

## PLATFORM SELECTION LOGIC

### TikTok (TIKTOK_EXPERT)
Best for: Viral reach, young audiences (16-34), video-first, entertainment, trends

### X/Twitter (TWITTER_X_EXPERT)
Best for: Thought leadership, B2B, real-time engagement, news, professional conversations

### Facebook (FACEBOOK_ADS_EXPERT)
Best for: Paid campaigns, 35-65+ demographics, local business, lead forms, retargeting

### LinkedIn (LINKEDIN_EXPERT)
Best for: B2B sales, executive targeting, professional content, recruitment, partnerships

### YouTube (YOUTUBE_EXPERT)
Best for: Long-form video, tutorials, SEO-driven content, subscriber growth, brand authority

### Instagram (INSTAGRAM_EXPERT)
Best for: Visual storytelling, reels, carousels, stories, hashtag reach, community building

### Pinterest (PINTEREST_EXPERT)
Best for: Visual search, evergreen content, seasonal planning, product discovery, traffic driving

### Paid Advertising (PAID_ADS_SPECIALIST)
Best for: Cross-platform paid campaign strategy, budget allocation, audience targeting, bid optimization, ad creative briefs, ROAS/CPA optimization

### SEO (SEO_EXPERT)
Best for: Keyword strategy, content optimization, organic search visibility

### Reddit (REDDIT_EXPERT)
Best for: Community engagement, subreddit-specific posts, AMA-style content, organic discussion threads

### Threads (THREADS_EXPERT)
Best for: Meta Threads short posts, thread chains, conversational and minimalist content style

### Google Business Profile (GOOGLE_BUSINESS_EXPERT)
Best for: Local business updates, CTA-driven posts on Google Business Profile, Google Maps visibility

### Telegram (TELEGRAM_EXPERT)
Best for: Telegram channel broadcasts, longer-form announcements, Markdown-formatted content, subscriber updates

### WhatsApp Business (WHATSAPP_BUSINESS_EXPERT)
Best for: WhatsApp Business broadcast messages, template-driven communications, opt-in audience outreach

## BRAND VOICE CONSISTENCY
All content must reflect the organization's Brand DNA:
- Tone of voice (warm, professional, direct, casual, etc.)
- Key phrases to use
- Phrases to avoid
- Industry terminology
- Communication style

## OUTPUT: CampaignBrief
Your output aggregates all specialist work into a unified brief with:
- Campaign analysis and objectives
- Platform strategy with rationale
- SEO keyword integration
- Individual specialist outputs
- Cross-platform recommendations
- Confidence scoring`;

// ============================================================================
// CAMPAIGN INTENT DETECTION
// ============================================================================

/**
 * Campaign intents that determine specialist activation
 */
export type CampaignIntent =
  | 'FULL_FUNNEL'           // All specialists for comprehensive campaign
  | 'AWARENESS'             // TikTok + Twitter + LinkedIn
  | 'LEAD_GENERATION'       // Facebook + LinkedIn + SEO
  | 'THOUGHT_LEADERSHIP'    // Twitter + LinkedIn + SEO
  | 'VIRAL_CONTENT'         // TikTok + Twitter
  | 'PAID_ADVERTISING'      // Facebook + LinkedIn
  | 'ORGANIC_GROWTH'        // SEO + All social
  | 'SINGLE_PLATFORM';      // Route to one specialist

/**
 * Keywords that indicate campaign intents
 */
const INTENT_KEYWORDS: Record<CampaignIntent, string[]> = {
  FULL_FUNNEL: [
    'full campaign', 'complete strategy', 'omnichannel', 'comprehensive',
    'all platforms', 'integrated', 'multi-channel', '360',
  ],
  AWARENESS: [
    'awareness', 'brand recognition', 'reach', 'visibility', 'exposure',
    'get the word out', 'introduce', 'launch announcement',
  ],
  LEAD_GENERATION: [
    'lead', 'leads', 'sign up', 'demo', 'trial', 'contact', 'inquiry',
    'form', 'capture', 'convert', 'acquisition',
  ],
  THOUGHT_LEADERSHIP: [
    'thought leader', 'authority', 'expert', 'industry voice', 'insights',
    'perspective', 'opinion', 'expertise', 'credibility',
  ],
  VIRAL_CONTENT: [
    'viral', 'trending', 'buzz', 'shareable', 'explosive', 'mass reach',
    'organic spread', 'word of mouth',
  ],
  PAID_ADVERTISING: [
    'paid', 'ads', 'advertising', 'budget', 'spend', 'roi', 'roas',
    'retarget', 'ppc', 'cpm', 'cpc', 'cpa', 'ad spend', 'ad optimization',
    'campaign budget', 'bid strategy', 'ad creative',
  ],
  ORGANIC_GROWTH: [
    'organic', 'seo', 'search', 'ranking', 'content marketing',
    'inbound', 'natural growth', 'evergreen', 'traffic', 'visitors',
    'unique visitors', 'domain analysis', 'backlinks', 'referring domains',
    'domain rank', 'organic traffic', 'website traffic',
  ],
  SINGLE_PLATFORM: [], // Detected via explicit platform mention
};

/**
 * Specialist mapping by intent
 */
const INTENT_SPECIALISTS: Record<CampaignIntent, string[]> = {
  FULL_FUNNEL: ['SEO_EXPERT', 'TIKTOK_EXPERT', 'TWITTER_X_EXPERT', 'FACEBOOK_ADS_EXPERT', 'LINKEDIN_EXPERT', 'YOUTUBE_EXPERT', 'INSTAGRAM_EXPERT', 'PINTEREST_EXPERT', 'PAID_ADS_SPECIALIST', 'REDDIT_EXPERT', 'THREADS_EXPERT', 'GOOGLE_BUSINESS_EXPERT', 'TELEGRAM_EXPERT', 'WHATSAPP_BUSINESS_EXPERT'],
  AWARENESS: ['TIKTOK_EXPERT', 'TWITTER_X_EXPERT', 'LINKEDIN_EXPERT', 'YOUTUBE_EXPERT', 'INSTAGRAM_EXPERT', 'THREADS_EXPERT', 'REDDIT_EXPERT', 'GOOGLE_BUSINESS_EXPERT'],
  LEAD_GENERATION: ['SEO_EXPERT', 'FACEBOOK_ADS_EXPERT', 'LINKEDIN_EXPERT', 'PINTEREST_EXPERT', 'PAID_ADS_SPECIALIST', 'GOOGLE_BUSINESS_EXPERT'],
  THOUGHT_LEADERSHIP: ['SEO_EXPERT', 'TWITTER_X_EXPERT', 'LINKEDIN_EXPERT', 'YOUTUBE_EXPERT', 'REDDIT_EXPERT', 'THREADS_EXPERT'],
  VIRAL_CONTENT: ['TIKTOK_EXPERT', 'TWITTER_X_EXPERT', 'INSTAGRAM_EXPERT', 'THREADS_EXPERT', 'REDDIT_EXPERT'],
  PAID_ADVERTISING: ['FACEBOOK_ADS_EXPERT', 'LINKEDIN_EXPERT', 'INSTAGRAM_EXPERT', 'PAID_ADS_SPECIALIST'],
  ORGANIC_GROWTH: ['SEO_EXPERT', 'TIKTOK_EXPERT', 'TWITTER_X_EXPERT', 'LINKEDIN_EXPERT', 'YOUTUBE_EXPERT', 'INSTAGRAM_EXPERT', 'PINTEREST_EXPERT', 'THREADS_EXPERT', 'REDDIT_EXPERT', 'GOOGLE_BUSINESS_EXPERT'],
  SINGLE_PLATFORM: [], // Determined dynamically
};

// ============================================================================
// CONFIGURATION - Industry-Agnostic Marketing Orchestration
// ============================================================================

const MARKETING_MANAGER_CONFIG: ManagerConfig = {
  identity: {
    id: 'MARKETING_MANAGER',
    name: 'Marketing Manager',
    role: 'manager',
    status: 'FUNCTIONAL',
    reportsTo: 'JASPER',
    capabilities: [
      'campaign_goal_parsing',
      'intent_detection',
      'dynamic_specialist_resolution',
      'brand_dna_integration',
      'seo_social_feedback_loop',
      'multi_specialist_coordination',
      'cross_platform_campaigns',
      'budget_allocation',
      'campaign_brief_synthesis',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['delegate', 'coordinate', 'aggregate', 'analyze_campaign', 'fetch_brand_dna'],
  outputSchema: {
    type: 'object',
    properties: {
      campaignBrief: { type: 'object' },
      brandContext: { type: 'object' },
      seoGuidance: { type: 'object' },
      delegations: { type: 'array' },
      confidence: { type: 'number' },
    },
    required: ['campaignBrief', 'delegations'],
  },
  maxTokens: 8192,
  temperature: 0.4,
  specialists: [
    'TIKTOK_EXPERT',
    'TWITTER_X_EXPERT',
    'FACEBOOK_ADS_EXPERT',
    'LINKEDIN_EXPERT',
    'YOUTUBE_EXPERT',
    'INSTAGRAM_EXPERT',
    'PINTEREST_EXPERT',
    'BLUESKY_EXPERT',
    'MASTODON_EXPERT',
    'PAID_ADS_SPECIALIST',
    'SEO_EXPERT',
    'GROWTH_ANALYST',
    'REDDIT_EXPERT',
    'THREADS_EXPERT',
    'GOOGLE_BUSINESS_EXPERT',
    'TELEGRAM_EXPERT',
    'WHATSAPP_BUSINESS_EXPERT',
  ],
  delegationRules: [
    // TikTok - Viral, short-form video
    {
      triggerKeywords: ['tiktok', 'viral', 'short video', 'hook', 'trending sound', 'gen z', 'fyp', 'for you page', 'reels'],
      delegateTo: 'TIKTOK_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Twitter/X - Thought leadership, engagement
    {
      triggerKeywords: ['twitter', 'x.com', 'thread', 'tweet', 'engagement', 'ratio', 'reply', 'thought leadership', 'hot take'],
      delegateTo: 'TWITTER_X_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Facebook - Ads, older demographics
    {
      triggerKeywords: ['facebook', 'fb ads', 'meta ads', 'audience', 'retarget', 'lead form', 'local business', 'carousel'],
      delegateTo: 'FACEBOOK_ADS_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // LinkedIn - B2B, professional
    {
      triggerKeywords: ['linkedin', 'b2b', 'professional', 'executive', 'corporate', 'enterprise', 'decision maker', 'c-suite'],
      delegateTo: 'LINKEDIN_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // YouTube - Long-form video, tutorials
    {
      triggerKeywords: ['youtube', 'video', 'tutorial', 'vlog', 'subscriber', 'thumbnail', 'long-form', 'chapter', 'playlist', 'watch time'],
      delegateTo: 'YOUTUBE_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Instagram - Visual, reels, stories
    {
      triggerKeywords: ['instagram', 'ig', 'reel', 'reels', 'carousel', 'story', 'stories', 'hashtag', 'visual', 'influencer'],
      delegateTo: 'INSTAGRAM_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Pinterest - Visual search, pins
    {
      triggerKeywords: ['pinterest', 'pin', 'board', 'pins', 'idea pin', 'rich pin', 'visual search', 'seasonal content', 'pinning'],
      delegateTo: 'PINTEREST_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Bluesky - AT Protocol, decentralized
    {
      triggerKeywords: ['bluesky', 'bsky', 'at protocol', 'atproto', 'skeet', 'skeets'],
      delegateTo: 'BLUESKY_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Mastodon - federated, fediverse
    {
      triggerKeywords: ['mastodon', 'fediverse', 'federated social', 'hachyderm', 'fosstodon', 'mastodon.social', 'toot', 'toots'],
      delegateTo: 'MASTODON_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Paid Advertising - Campaign strategy, budget allocation, ad optimization
    {
      triggerKeywords: ['paid', 'advertising', 'ads', 'campaign budget', 'ad spend', 'ppc', 'cpm', 'cpa', 'roas', 'ad optimization', 'bid strategy', 'ad creative', 'media buy', 'ad campaign', 'paid media'],
      delegateTo: 'PAID_ADS_SPECIALIST',
      priority: 10,
      requiresApproval: false,
    },
    // SEO - Search, keywords, organic
    {
      triggerKeywords: ['seo', 'keyword', 'search engine', 'organic traffic', 'ranking', 'serp', 'google', 'content optimization', 'traffic', 'visitors', 'unique visitors', 'domain analysis', 'backlinks', 'referring domains', 'domain rank', 'website traffic', 'competitor analysis', '.com', '.net', '.org', '.io'],
      delegateTo: 'SEO_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Reddit - Community, subreddit engagement
    {
      triggerKeywords: ['reddit', 'subreddit', 'r/', 'upvote', 'karma', 'AMA', 'crosspost'],
      delegateTo: 'REDDIT_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Threads - Meta Threads platform
    {
      triggerKeywords: ['threads', '@threads', 'threads.net', 'thread post', 'meta threads'],
      delegateTo: 'THREADS_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Google Business Profile - Local listing, maps
    {
      triggerKeywords: ['google business', 'google business profile', 'gbp', 'gmb', 'google my business', 'business profile post', 'local listing', 'maps post'],
      delegateTo: 'GOOGLE_BUSINESS_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Telegram - Channel broadcasts
    {
      triggerKeywords: ['telegram', 't.me', 'telegram channel', 'telegram bot', 'telegram broadcast'],
      delegateTo: 'TELEGRAM_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // WhatsApp Business - Broadcast template messages
    {
      triggerKeywords: ['whatsapp', 'whatsapp business', 'wa broadcast', 'whatsapp template', 'wa.me', 'whatsapp message'],
      delegateTo: 'WHATSAPP_BUSINESS_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
  ],
};

// ============================================================================
// TYPE DEFINITIONS - Industry-Agnostic Campaign Types
// ============================================================================

/**
 * Campaign goal input - intentionally generic to support any industry
 */
export interface CampaignGoal {
  objective: 'awareness' | 'engagement' | 'conversions' | 'leads' | 'retention';
  message: string;
  targetAudience?: {
    demographics?: string;
    psychographics?: string;
    platforms?: string[];
    industrySegment?: string; // Derived from Brand DNA, not hardcoded
  };
  budget?: number | string;
  timeline?: {
    launchDate?: string;
    duration?: string;
  };
  kpis?: string[];
  contentType?: 'video' | 'image' | 'text' | 'mixed';
}

/**
 * Brand context loaded from MemoryVault
 * Provides industry-specific customization at runtime
 */
export interface BrandContext {
  companyDescription: string;
  uniqueValue: string;
  targetAudience: string;
  industry: string;
  toneOfVoice: string;
  communicationStyle: string;
  keyPhrases: string[];
  avoidPhrases: string[];
  competitors: string[];
  loaded: boolean;
}

/**
 * SEO keyword guidance that flows into social content
 */
export interface SEOKeywordGuidance {
  primaryKeywords: string[];
  secondaryKeywords: string[];
  longTailKeywords: string[];
  searchIntent: 'informational' | 'transactional' | 'navigational' | 'commercial';
  contentRecommendations: string[];
  keywordDensityTarget: number;
}

/**
 * Campaign analysis with industry context
 */
export interface CampaignAnalysis {
  objective: string;
  targetAudience: string;
  contentType: string;
  timeline: string;
  budget: string;
  kpis: string[];
  detectedIntent: CampaignIntent;
  industryContext: string; // Derived from Brand DNA
}

/**
 * Platform strategy with SEO integration
 */
export interface PlatformStrategy {
  platforms: string[];
  rationale: string;
  budgetAllocation: Record<string, string>;
  seoKeywords: string[]; // Keywords to inject into social content
}

/**
 * Individual specialist delegation result
 */
export interface DelegationResult {
  specialist: string;
  brief: string;
  status: 'COMPLETED' | 'BLOCKED' | 'PENDING' | 'FAILED';
  result: unknown;
  executionTimeMs?: number;
}

/**
 * Aggregated plan with cross-platform coordination
 */
export interface AggregatedPlan {
  overview: string;
  timeline: string;
  expectedReach: string;
  recommendations: string[];
  brandVoiceCompliance: boolean;
  seoIntegration: boolean;
}

/**
 * The unified CampaignBrief output
 * This is the final deliverable that aggregates all specialist work
 */
export interface CampaignBrief {
  briefId: string;
  createdAt: Date;
  completedAt: Date;

  // Input context
  campaignGoal: CampaignGoal;
  brandContext: BrandContext;
  detectedIntent: CampaignIntent;

  // SEO foundation (runs first)
  seoGuidance: SEOKeywordGuidance | null;

  // Campaign analysis
  campaignAnalysis: CampaignAnalysis;
  platformStrategy: PlatformStrategy;

  // Specialist outputs
  delegations: DelegationResult[];
  specialistOutputs: {
    tiktok: unknown;
    twitter: unknown;
    facebook: unknown;
    linkedin: unknown;
    youtube: unknown;
    instagram: unknown;
    pinterest: unknown;
    paidAds: unknown;
    seo: unknown;
  };

  // Synthesis
  aggregatedPlan: AggregatedPlan;
  crossPlatformRecommendations: string[];

  // Metadata
  confidence: number;
  warnings: string[];
  execution: {
    totalSpecialists: number;
    successfulSpecialists: number;
    failedSpecialists: number;
    totalExecutionTimeMs: number;
  };
}

/**
 * Legacy type alias for backward compatibility
 */
export type CampaignPlan = CampaignBrief;

/**
 * Orchestration modes for the Marketing Manager
 * Controls behavior based on intelligence signals
 */
export type OrchestrationMode =
  | 'CAMPAIGN_SPRINT'   // Default — single campaign execution
  | 'GROWTH_LOOP'       // Continuous: LISTEN → ANALYZE → CREATE → PUBLISH → ENGAGE → repeat
  | 'OPPORTUNISTIC'     // Triggered by TREND_SCOUT — fast-track trending content
  | 'CRISIS_RESPONSE'   // Triggered by SENTIMENT_ANALYST — pause publishing, deploy damage control
  | 'AMPLIFICATION';    // Triggered by positive sentiment — boost frequency

/**
 * Intelligence signal from TREND_SCOUT or SENTIMENT_ANALYST
 */
interface IntelligenceSignalAction {
  mode: OrchestrationMode;
  reason: string;
  signalId: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  payload: Record<string, unknown>;
}

// ============================================================================
// IMPLEMENTATION - Industry-Agnostic Cross-Channel Commander
// ============================================================================

export class MarketingManager extends BaseManager {
  private specialistsRegistered = false;
  private brandContextCache: Map<string, BrandContext> = new Map();
  private currentMode: OrchestrationMode = 'CAMPAIGN_SPRINT';

  constructor() {
    super(MARKETING_MANAGER_CONFIG);
  }

  /**
   * Initialize and register all marketing specialists dynamically
   */
  async initialize(): Promise<void> {
    this.log('INFO', 'Initializing Marketing Manager (Industry-Agnostic Mode)...');

    // Dynamically register all 5 specialists via SwarmRegistry pattern
    await this.registerAllSpecialists();

    this.isInitialized = true;
    this.log('INFO', `Marketing Manager initialized with ${this.specialists.size} specialists`);
  }

  /**
   * Register specialists from their factory functions (SwarmRegistry pattern)
   */
  private async registerAllSpecialists(): Promise<void> {
    if (this.specialistsRegistered) {
      return;
    }

    const specialistFactories = [
      { name: 'TIKTOK_EXPERT', factory: getTikTokExpert },
      { name: 'TWITTER_X_EXPERT', factory: getTwitterExpert },
      { name: 'FACEBOOK_ADS_EXPERT', factory: getFacebookAdsExpert },
      { name: 'LINKEDIN_EXPERT', factory: getLinkedInExpert },
      { name: 'YOUTUBE_EXPERT', factory: getYouTubeExpert },
      { name: 'INSTAGRAM_EXPERT', factory: getInstagramExpert },
      { name: 'PINTEREST_EXPERT', factory: getPinterestExpert },
      { name: 'BLUESKY_EXPERT', factory: getBlueskyExpert },
      { name: 'MASTODON_EXPERT', factory: getMastodonExpert },
      { name: 'PAID_ADS_SPECIALIST', factory: getPaidAdsSpecialist },
      { name: 'SEO_EXPERT', factory: getSEOExpert },
      { name: 'GROWTH_ANALYST', factory: getGrowthAnalyst },
      { name: 'REDDIT_EXPERT', factory: getRedditExpert },
      { name: 'THREADS_EXPERT', factory: getThreadsExpert },
      { name: 'GOOGLE_BUSINESS_EXPERT', factory: getGoogleBusinessExpert },
      { name: 'TELEGRAM_EXPERT', factory: getTelegramExpert },
      { name: 'WHATSAPP_BUSINESS_EXPERT', factory: getWhatsAppBusinessExpert },
    ];

    for (const { name, factory } of specialistFactories) {
      try {
        const specialist = factory();
        await specialist.initialize();
        this.registerSpecialist(specialist);
        this.log('INFO', `Registered specialist: ${name} (${specialist.getStatus()})`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.log('ERROR', `Failed to register specialist ${name}: ${errorMsg}`);
      }
    }

    this.specialistsRegistered = true;
  }

  /**
   * Main execution entry point - orchestrates industry-agnostic campaign
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    const startTime = Date.now();

    // Ensure specialists are registered
    if (!this.specialistsRegistered) {
      await this.registerAllSpecialists();
    }

    try {
      // Check intelligence signals before processing
      const intelligenceActions = await this.checkIntelligenceSignals();

      // If a mode-switching signal was detected, handle it instead of normal execution
      if (intelligenceActions.length > 0) {
        const topAction = intelligenceActions[0];
        if (topAction.mode === 'CRISIS_RESPONSE') {
          return await this.executeCrisisResponse(topAction, taskId);
        }
        if (topAction.mode === 'OPPORTUNISTIC') {
          // Only intercept if the current message isn't already an opportunistic execution
          const isRecursive = (message.payload as CampaignGoal)?.message?.includes('Fast-track for immediate publication');
          if (!isRecursive) {
            return await this.executeOpportunisticMode(topAction, taskId);
          }
        }
        if (topAction.mode === 'AMPLIFICATION') {
          const isRecursive = (message.payload as CampaignGoal)?.message?.includes('Capitalize on positive sentiment wave');
          if (!isRecursive) {
            return await this.executeAmplificationMode(topAction, taskId);
          }
        }
      }

      const rawPayload = (message.payload ?? {}) as Record<string, unknown>;

      // ─── Inbound DM fast-path ────────────────────────────────────────
      // When Jasper passes `inboundContext` on delegate_to_marketing, the
      // task is replying to a single inbound DM, not running a campaign.
      // Skip orchestrateCampaign + SEO loop + multi-specialist fan-out
      // and go straight to the platform-specific specialist's
      // compose_dm_reply action. The send happens AFTER mission completes
      // — either via the operator clicking "Send reply" in Mission
      // Control, or auto-fired by the synthetic-trigger when the
      // `automation/inbound.xDmReply.autoApprove` flag is on.
      const inboundCtx = rawPayload.inboundContext;
      if (inboundCtx && typeof inboundCtx === 'object') {
        return await this.executeInboundDmReply(inboundCtx as Record<string, unknown>, taskId);
      }

      // ─── Single-platform organic post fast-path ──────────────────────
      // When Jasper passes a single string platform + topic (no full
      // campaign goal), skip orchestrateCampaign and dispatch directly to
      // the platform specialist's generate_content. This is the path
      // hit by "Post this to Mastodon: ..." style prompts. Returns
      // { primaryPost, imageUrl, ... } so Mission Control + the publish
      // step have everything they need.
      const singlePlatform = rawPayload.platform;
      const singleTopic = rawPayload.topic ?? rawPayload.message;
      const isSinglePostRequest =
        typeof singlePlatform === 'string' &&
        singlePlatform.length > 0 &&
        typeof singleTopic === 'string' &&
        singleTopic.length > 0 &&
        !rawPayload.platforms; // CampaignGoal.platforms is an array — only fast-path when not multi-platform
      if (isSinglePostRequest) {
        return await this.executeSinglePlatformPost(rawPayload, taskId);
      }

      const payload = rawPayload as unknown as CampaignGoal;

      // Penthouse model system: uses PLATFORM_ID internally where needed

      if (!payload?.message && !payload?.objective) {
        return this.createReport(
          taskId,
          'FAILED',
          null,
          ['No campaign goal or message provided in payload']
        );
      }

      this.log('INFO', `Processing campaign goal: ${payload.objective ?? 'unspecified'}`);

      // Execute full campaign orchestration
      const campaignBrief = await this.orchestrateCampaign(payload, taskId, startTime);

      // Store insights in MemoryVault for cross-agent learning
      await this.storeCampaignInsights(campaignBrief);

      return this.createReport(taskId, 'COMPLETED', campaignBrief);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Campaign coordination failed: ${errorMessage}`);
      logger.error('[MarketingManager] Orchestration failed', error instanceof Error ? error : new Error(errorMessage));
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Handle signals from the Signal Bus
   * Processes intelligence signals from TREND_SCOUT and SENTIMENT_ANALYST
   */
  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;

    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }

    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  /**
   * Check for pending intelligence signals and determine orchestration mode
   * Called before campaign execution to adapt behavior based on real-time intelligence
   */
  async checkIntelligenceSignals(): Promise<IntelligenceSignalAction[]> {
    const actions: IntelligenceSignalAction[] = [];

    try {
      const pendingSignals = await checkPendingSignals('MARKETING_MANAGER');

      for (const signal of pendingSignals) {
        const action = this.classifySignal(signal);
        if (action) {
          actions.push(action);
        }
      }

      // Determine the highest-priority mode
      if (actions.length > 0) {
        const priorityOrder: OrchestrationMode[] = ['CRISIS_RESPONSE', 'OPPORTUNISTIC', 'AMPLIFICATION', 'GROWTH_LOOP', 'CAMPAIGN_SPRINT'];
        for (const mode of priorityOrder) {
          const match = actions.find(a => a.mode === mode);
          if (match) {
            this.currentMode = mode;
            this.log('INFO', `Switching to ${mode} mode: ${match.reason}`);
            break;
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('ERROR', `Failed to check intelligence signals: ${errorMsg}`);
    }

    return actions;
  }

  /**
   * Classify a MemoryVault signal into an orchestration mode action
   */
  private classifySignal(signal: SignalEntry): IntelligenceSignalAction | null {
    const signalType = signal.value.signalType;
    const urgency = signal.value.urgency;

    // TREND_SCOUT signals: TREND_EMERGING with HIGH/CRITICAL urgency → OPPORTUNISTIC
    if (signalType === 'TREND_EMERGING' && (urgency === 'CRITICAL' || urgency === 'HIGH')) {
      return {
        mode: 'OPPORTUNISTIC',
        reason: `Trending topic detected: ${signal.key}`,
        signalId: signal.id,
        urgency,
        payload: signal.value.payload,
      };
    }

    // SENTIMENT_ANALYST signals: negative crisis → CRISIS_RESPONSE
    if (signalType === 'BRAND_SENTIMENT_SHIFT' || signalType === 'CRISIS_DETECTED') {
      const sentiment = signal.value.payload.sentiment as number | undefined;
      const severity = signal.value.payload.severity as string | undefined;

      if (severity === 'critical' || severity === 'warning' || (sentiment !== undefined && sentiment < -0.3)) {
        return {
          mode: 'CRISIS_RESPONSE',
          reason: `Negative sentiment detected: ${signal.key} (severity: ${severity ?? 'unknown'})`,
          signalId: signal.id,
          urgency: 'CRITICAL',
          payload: signal.value.payload,
        };
      }

      // Positive sentiment spike → AMPLIFICATION
      if (sentiment !== undefined && sentiment > 0.5) {
        return {
          mode: 'AMPLIFICATION',
          reason: `Positive sentiment spike: ${signal.key}`,
          signalId: signal.id,
          urgency: 'MEDIUM',
          payload: signal.value.payload,
        };
      }
    }

    return null;
  }

  /**
   * Execute in OPPORTUNISTIC mode — fast-track trending content
   * Triggered by TREND_SCOUT TREND_EMERGING signals
   */
  private async executeOpportunisticMode(
    trendSignal: IntelligenceSignalAction,
    taskId: string
  ): Promise<AgentReport> {
    this.log('INFO', `OPPORTUNISTIC MODE: Fast-tracking content for trend — ${trendSignal.reason}`);

    const trendTopic = trendSignal.payload.title as string ?? trendSignal.reason;

    // Create an urgent campaign goal based on the trend
    const trendGoal: CampaignGoal = {
      objective: 'awareness',
      message: `Create timely content capitalizing on trending topic: ${trendTopic}. Fast-track for immediate publication.`,
      contentType: 'mixed',
      kpis: ['engagement_rate', 'share_velocity', 'trending_participation'],
    };

    // Share insight about the mode switch
    await shareInsight(
      'MARKETING_MANAGER',
      'TREND',
      `Entered OPPORTUNISTIC mode for trend: ${trendTopic}`,
      `Marketing Manager switching to OPPORTUNISTIC mode to capitalize on trending topic.`,
      { confidence: 90, tags: ['trend', 'opportunistic', 'fast-track'] }
    );

    // Execute as a standard campaign but with trend context
    return this.execute({
      id: taskId,
      from: 'MARKETING_MANAGER',
      to: 'MARKETING_MANAGER',
      payload: trendGoal,
      timestamp: new Date(),
      type: 'COMMAND',
      priority: 'HIGH',
      requiresResponse: true,
      traceId: `opportunistic-${taskId}`,
    });
  }

  /**
   * Execute in CRISIS_RESPONSE mode — pause publishing, deploy damage control
   * Triggered by SENTIMENT_ANALYST negative sentiment signals
   */
  private async executeCrisisResponse(
    crisisSignal: IntelligenceSignalAction,
    taskId: string
  ): Promise<AgentReport> {
    this.log('WARN', `CRISIS_RESPONSE MODE: ${crisisSignal.reason}`);

    // Broadcast pause signal to all publishing agents
    await broadcastSignal(
      'MARKETING_MANAGER',
      'PUBLISHING_PAUSE',
      'CRITICAL',
      {
        reason: crisisSignal.reason,
        pausedAt: new Date().toISOString(),
        resumeCondition: 'Manual review required — sentiment must stabilize',
      },
      ['AUTONOMOUS_POSTING_AGENT', 'CONTENT_MANAGER']
    );

    // Share crisis insight for cross-agent visibility
    await shareInsight(
      'MARKETING_MANAGER',
      'PERFORMANCE',
      `CRISIS RESPONSE ACTIVATED: ${crisisSignal.reason}`,
      `Publishing paused. Preparing damage control content. Reason: ${crisisSignal.reason}`,
      { confidence: 95, tags: ['crisis', 'pause', 'damage-control'] }
    );

    return this.createReport(taskId, 'COMPLETED', {
      mode: 'CRISIS_RESPONSE',
      action: 'publishing_paused',
      reason: crisisSignal.reason,
      signalId: crisisSignal.signalId,
      recommendation: 'Review situation before resuming content publishing',
    });
  }

  /**
   * Execute in AMPLIFICATION mode — boost content frequency on positive sentiment
   * Triggered by SENTIMENT_ANALYST positive sentiment spikes
   */
  private async executeAmplificationMode(
    amplifySignal: IntelligenceSignalAction,
    taskId: string
  ): Promise<AgentReport> {
    this.log('INFO', `AMPLIFICATION MODE: ${amplifySignal.reason}`);

    const amplifyGoal: CampaignGoal = {
      objective: 'engagement',
      message: `Capitalize on positive sentiment wave. Increase posting frequency and share positive mentions. Context: ${amplifySignal.reason}`,
      contentType: 'mixed',
      kpis: ['engagement_rate', 'follower_growth', 'positive_sentiment_ratio'],
    };

    await shareInsight(
      'MARKETING_MANAGER',
      'PERFORMANCE',
      `AMPLIFICATION mode activated: ${amplifySignal.reason}`,
      `Boosting content frequency due to positive sentiment spike.`,
      { confidence: 85, tags: ['amplification', 'positive-sentiment', 'boost'] }
    );

    return this.execute({
      id: taskId,
      from: 'MARKETING_MANAGER',
      to: 'MARKETING_MANAGER',
      payload: amplifyGoal,
      timestamp: new Date(),
      type: 'COMMAND',
      priority: 'HIGH',
      requiresResponse: true,
      traceId: `amplification-${taskId}`,
    });
  }

  /**
   * Get the current orchestration mode
   */
  getCurrentMode(): OrchestrationMode {
    return this.currentMode;
  }

  /**
   * Create a properly typed AgentMessage for internal delegation
   */
  private createDelegationMessage(
    id: string,
    to: string,
    payload: unknown
  ): AgentMessage {
    return {
      id,
      from: 'MARKETING_MANAGER',
      to,
      payload,
      timestamp: new Date(),
      type: 'COMMAND',
      priority: 'NORMAL',
      requiresResponse: true,
      traceId: `mm-${id}`,
    };
  }

  // ==========================================================================
  // INBOUND DM REPLY FAST-PATH — single specialist, no campaign orchestration
  // ==========================================================================

  /**
   * Compose a reply to an inbound social DM by delegating to the
   * platform-specific specialist (currently TwitterExpert for X DMs).
   * The send itself happens AFTER mission completes — either via the
   * operator clicking "Send reply" in Mission Control, or auto-fired
   * by the synthetic-trigger when `automation/inbound.xDmReply.autoApprove`
   * is on. Either path uses the `send_social_reply` Jasper tool.
   *
   * The inboundEventId is preserved verbatim in the result so the send
   * step can mark the source `inboundSocialEvents` doc processed.
   */
  private async executeInboundDmReply(
    inboundContext: Record<string, unknown>,
    taskId: string,
  ): Promise<AgentReport> {
    const platform = typeof inboundContext.platform === 'string' ? inboundContext.platform.toLowerCase() : '';
    const inboundEventId = typeof inboundContext.inboundEventId === 'string' ? inboundContext.inboundEventId : '';
    const inboundText = typeof inboundContext.inboundText === 'string' ? inboundContext.inboundText : '';
    const senderHandle = typeof inboundContext.senderHandle === 'string' ? inboundContext.senderHandle : undefined;
    const senderId = typeof inboundContext.senderId === 'string' ? inboundContext.senderId : undefined;

    if (!platform || !inboundEventId || !inboundText) {
      return this.createReport(
        taskId,
        'FAILED',
        null,
        ['inboundContext missing required fields: platform, inboundEventId, inboundText'],
      );
    }

    const SPECIALIST_BY_INBOUND_PLATFORM: Record<string, string> = {
      x: 'TWITTER_X_EXPERT',
      bluesky: 'BLUESKY_EXPERT',
      linkedin: 'LINKEDIN_EXPERT',
      facebook: 'FACEBOOK_ADS_EXPERT',
      instagram: 'INSTAGRAM_EXPERT',
      pinterest: 'PINTEREST_EXPERT',
      mastodon: 'MASTODON_EXPERT',
    };
    const specialistId = SPECIALIST_BY_INBOUND_PLATFORM[platform];
    if (!specialistId) {
      return this.createReport(
        taskId,
        'FAILED',
        null,
        [`Inbound DM reply for platform="${platform}" is not yet wired. Currently supported: ${Object.keys(SPECIALIST_BY_INBOUND_PLATFORM).join(', ')}`],
      );
    }
    this.log('INFO', `Inbound ${platform} DM fast-path: routing to ${specialistId}.compose_dm_reply for event ${inboundEventId}`);

    // Pass brand context through the same way orchestrateCampaign does
    // so the X Expert's compose_dm_reply prompt has tone-of-voice and
    // avoid-phrases. Brand DNA is already baked into the GM systemPrompt
    // per Standing Rule #1 — this is the SECONDARY hint the specialist
    // accepts for runtime-overridable tweaks.
    const brand = await getBrandDNA();
    const brandContext = brand ? {
      industry: brand.industry,
      toneOfVoice: brand.toneOfVoice,
      keyPhrases: brand.keyPhrases,
      avoidPhrases: brand.avoidPhrases,
    } : undefined;

    const expert = await (async () => {
      switch (platform) {
        case 'bluesky': return (await import('./bluesky/specialist')).getBlueskyExpert();
        case 'linkedin': return (await import('./linkedin/specialist')).getLinkedInExpert();
        case 'facebook': return (await import('./facebook/specialist')).getFacebookAdsExpert();
        case 'instagram': return (await import('./instagram/specialist')).getInstagramExpert();
        case 'pinterest': return (await import('./pinterest/specialist')).getPinterestExpert();
        case 'mastodon': return (await import('./mastodon/specialist')).getMastodonExpert();
        case 'x':
        default: return getTwitterExpert();
      }
    })();
    await expert.initialize();

    const composeMessage = this.createDelegationMessage(
      `dm_compose_${Date.now()}`,
      specialistId,
      {
        action: 'compose_dm_reply',
        platform,
        inboundEventId,
        inboundText,
        ...(senderHandle ? { senderHandle } : {}),
        ...(senderId ? { senderId } : {}),
        ...(brandContext ? { brandContext } : {}),
      },
    );

    const composeResult = await expert.execute(composeMessage);

    if (composeResult.status !== 'COMPLETED') {
      return this.createReport(
        taskId,
        'FAILED',
        null,
        composeResult.errors ?? [`${specialistId} compose_dm_reply failed`],
      );
    }

    // Surface the inbound context alongside the composed draft so the
    // operator (and the auto-approve auto-send path) has everything
    // needed to fire send_social_reply without re-reading Firestore.
    return this.createReport(taskId, 'COMPLETED', {
      mode: 'INBOUND_DM_REPLY',
      platform,
      inboundEventId,
      inboundText,
      ...(senderHandle ? { senderHandle } : {}),
      ...(senderId ? { senderId } : {}),
      composedReply: composeResult.data,
      specialistsUsed: [specialistId],
    });
  }

  // ==========================================================================
  // SINGLE-PLATFORM ORGANIC POST FAST-PATH
  // ==========================================================================

  /**
   * Dispatch a single-platform organic post request directly to the platform
   * specialist's generate_content action, then resolve the accompanying image
   * (operator-provided OR auto-generated via DALL-E). Returns the post +
   * image URL together so the publish step (social_post tool) can attach
   * media in one shot.
   *
   * This is the post-side parallel to executeInboundDmReply — same pattern,
   * different action. Skips the multi-platform orchestrateCampaign machinery
   * which is overkill (and produces incorrect plans) for single-platform asks.
   *
   * Image resolution rule (mirrors blog flow):
   *   - If `providedMediaUrls[0]` is set, use it AS-IS — no DALL-E call
   *   - Otherwise, generate via the social-post-image helper
   *   - Image gen failure is non-fatal — the post returns with imageUrl: null
   */
  private async executeSinglePlatformPost(
    payload: Record<string, unknown>,
    taskId: string,
  ): Promise<AgentReport> {
    const platform = String(payload.platform).trim().toLowerCase();
    const topic = String(payload.topic ?? payload.message ?? '').trim();
    const verbatimText = typeof payload.verbatimText === 'string' && payload.verbatimText.trim().length > 0
      ? payload.verbatimText.trim()
      : undefined;
    const tone = typeof payload.tone === 'string' ? payload.tone : undefined;
    const targetAudience = typeof payload.targetAudience === 'string' ? payload.targetAudience : undefined;
    const campaignGoal = typeof payload.campaignGoal === 'string' ? payload.campaignGoal : undefined;
    const providedMediaUrls = Array.isArray(payload.providedMediaUrls)
      ? (payload.providedMediaUrls as unknown[]).filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      : [];
    const operatorImageUrl = providedMediaUrls.length > 0 ? providedMediaUrls[0] : undefined;

    const SPECIALIST_BY_PLATFORM: Record<string, string> = {
      x: 'TWITTER_X_EXPERT',
      twitter: 'TWITTER_X_EXPERT',
      bluesky: 'BLUESKY_EXPERT',
      mastodon: 'MASTODON_EXPERT',
      linkedin: 'LINKEDIN_EXPERT',
      facebook: 'FACEBOOK_ADS_EXPERT',
      instagram: 'INSTAGRAM_EXPERT',
      pinterest: 'PINTEREST_EXPERT',
      reddit: 'REDDIT_EXPERT',
      threads: 'THREADS_EXPERT',
      'google-business': 'GOOGLE_BUSINESS_EXPERT',
      googlebusiness: 'GOOGLE_BUSINESS_EXPERT',
      telegram: 'TELEGRAM_EXPERT',
      whatsapp: 'WHATSAPP_BUSINESS_EXPERT',
      'whatsapp-business': 'WHATSAPP_BUSINESS_EXPERT',
    };
    const specialistId = SPECIALIST_BY_PLATFORM[platform];
    if (!specialistId) {
      return this.createReport(
        taskId,
        'FAILED',
        null,
        [`Single-platform post for platform="${platform}" is not yet wired. Currently supported: ${Object.keys(SPECIALIST_BY_PLATFORM).join(', ')}`],
      );
    }
    this.log('INFO', `Single-platform post fast-path: dispatching to ${specialistId}.generate_content for platform=${platform}`);

    // Brand context for downstream specialist + image gen
    const brand = await getBrandDNA();
    const brandContext = brand ? {
      industry: brand.industry,
      toneOfVoice: brand.toneOfVoice,
      keyPhrases: brand.keyPhrases,
      avoidPhrases: brand.avoidPhrases,
    } : undefined;

    // Dispatch to the specialist
    const expert = await (async () => {
      switch (platform) {
        case 'x':
        case 'twitter': return getTwitterExpert();
        case 'bluesky': return (await import('./bluesky/specialist')).getBlueskyExpert();
        case 'linkedin': return (await import('./linkedin/specialist')).getLinkedInExpert();
        case 'facebook': return (await import('./facebook/specialist')).getFacebookAdsExpert();
        case 'instagram': return (await import('./instagram/specialist')).getInstagramExpert();
        case 'pinterest': return (await import('./pinterest/specialist')).getPinterestExpert();
        case 'mastodon': return (await import('./mastodon/specialist')).getMastodonExpert();
        case 'reddit': return (await import('./reddit/specialist')).getRedditExpert();
        case 'threads': return (await import('./threads/specialist')).getThreadsExpert();
        case 'google-business':
        case 'googlebusiness': return (await import('./google-business/specialist')).getGoogleBusinessExpert();
        case 'telegram': return (await import('./telegram/specialist')).getTelegramExpert();
        case 'whatsapp':
        case 'whatsapp-business': return (await import('./whatsapp-business/specialist')).getWhatsAppBusinessExpert();
        default: throw new Error(`Unhandled platform: ${platform}`);
      }
    })();
    await expert.initialize();

    const generateMessage = this.createDelegationMessage(
      `single_post_generate_${Date.now()}`,
      specialistId,
      {
        action: 'generate_content',
        topic,
        contentType: 'post',
        ...(tone ? { tone } : {}),
        ...(targetAudience ? { targetAudience } : {}),
        ...(campaignGoal ? { campaignGoal } : {}),
        ...(verbatimText ? { verbatimText } : {}),
        ...(brandContext ? { brandContext } : {}),
      },
    );

    const generateResult = await expert.execute(generateMessage);
    if (generateResult.status !== 'COMPLETED') {
      return this.createReport(
        taskId,
        'FAILED',
        null,
        generateResult.errors ?? [`${specialistId} generate_content failed`],
      );
    }

    // Extract the primaryPost from the specialist's structured output. Each
    // specialist's schema differs slightly, but they all expose `primaryPost`
    // when generate_content shipped (post-rebuild specialists) OR a similar
    // first-position post text. We accept either shape.
    const data = generateResult.data as Record<string, unknown> | null | undefined;
    const primaryPost = (() => {
      if (!data || typeof data !== 'object') { return ''; }
      if (typeof data.primaryPost === 'string') { return data.primaryPost; }
      if (typeof data.standaloneTweet === 'string') { return data.standaloneTweet; }
      if (typeof data.pinTitle === 'string' && typeof data.pinDescription === 'string') {
        return `${data.pinTitle}\n\n${data.pinDescription}`;
      }
      return '';
    })();
    if (!primaryPost) {
      return this.createReport(
        taskId,
        'FAILED',
        null,
        [`${specialistId} returned no extractable primary post text. Specialist data shape: ${JSON.stringify(Object.keys(data ?? {}))}`],
      );
    }

    // Resolve the image — operator URL or auto-generate
    let imageUrl: string | null = null;
    let imageOperatorProvided = false;
    try {
      const { generateAndStoreSocialPostImage } = await import('@/lib/content/social-post-image');
      const imageResult = await generateAndStoreSocialPostImage({
        imageId: `socimg_${platform}_${taskId}_${Date.now()}`,
        platform,
        postText: primaryPost,
        topic,
        ...(brandContext?.toneOfVoice ? { brandStyleHint: brandContext.toneOfVoice } : {}),
        ...(operatorImageUrl ? { providedImageUrl: operatorImageUrl } : {}),
      });
      if (imageResult) {
        imageUrl = imageResult.url;
        imageOperatorProvided = imageResult.operatorProvided;
        this.log(
          'INFO',
          `Image resolved (${imageOperatorProvided ? 'operator-provided' : 'DALL-E generated'}): ${imageResult.url}`,
        );
      } else {
        this.log('WARN', 'Image resolution returned null — post will publish without media');
      }
    } catch (err) {
      this.log('WARN', `Image generation failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    }

    return this.createReport(taskId, 'COMPLETED', {
      mode: 'SINGLE_PLATFORM_POST',
      platform,
      topic,
      ...(verbatimText ? { verbatimText } : {}),
      generatedContent: data,
      primaryPost,
      imageUrl,
      imageOperatorProvided,
      mediaUrls: imageUrl ? [imageUrl] : [],
      specialistsUsed: [specialistId],
    });
  }

  // ==========================================================================
  // GROWTH LOOP ORCHESTRATION - Autonomous Continuous Growth Cycle
  // ==========================================================================

  /**
   * Execute a single GROWTH_LOOP cycle
   * Implements the 7-step cycle: LISTEN → ANALYZE → MUTATE → CREATE → PUBLISH → ENGAGE → Wait
   *
   * This is designed to be called by a cron job or external trigger.
   * Each call executes one complete cycle.
   */
  async executeGrowthLoopCycle(taskId: string): Promise<AgentReport> {
    this.currentMode = 'GROWTH_LOOP';
    this.log('INFO', 'Starting GROWTH_LOOP cycle');

    // Ensure specialists are registered
    if (!this.specialistsRegistered) {
      await this.registerAllSpecialists();
    }

    const cycleResults: Record<string, unknown> = {};

    try {
      // Step 1: LISTEN — Dispatch LISTEN tasks to specialists in parallel
      const listenResults = await this.growthLoopListen(taskId);
      cycleResults.listen = listenResults;

      // Step 2: ANALYZE — Send data to GROWTH_ANALYST for pattern analysis
      const analyzeResults = await this.growthLoopAnalyze(taskId);
      cycleResults.analyze = analyzeResults;

      // Step 3: MUTATE — Read mutation directives from GROWTH_ANALYST
      const mutationResults = await this.growthLoopMutate(taskId);
      cycleResults.mutate = mutationResults;

      // Step 4: CREATE — Dispatch content creation (informed by mutations)
      const createResults = await this.growthLoopCreate(taskId, mutationResults);
      cycleResults.create = createResults;

      // Steps 5 (PUBLISH) and 6 (ENGAGE) are handled by the AUTONOMOUS_POSTING_AGENT
      // and per-specialist ENGAGE tasks respectively — triggered async

      // Record cycle completion
      await shareInsight(
        'MARKETING_MANAGER',
        'PERFORMANCE',
        `GROWTH_LOOP cycle completed`,
        `Listen: ${listenResults.specialistsPolled} specialists polled. Analyze: ${analyzeResults.patternsFound} patterns found. Mutations: ${mutationResults.directivesGenerated} directives generated.`,
        { confidence: 80, tags: ['growth-loop', 'cycle-complete'] }
      );

      this.log('INFO', 'GROWTH_LOOP cycle completed successfully');

      return this.createReport(taskId, 'COMPLETED', {
        mode: 'GROWTH_LOOP',
        cycle: cycleResults,
        nextCycleRecommendation: 'Schedule next cycle in 12-24 hours',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('ERROR', `GROWTH_LOOP cycle failed: ${errorMsg}`);
      return this.createReport(taskId, 'FAILED', null, [errorMsg]);
    }
  }

  /**
   * GROWTH_LOOP Step 1: LISTEN
   * Dispatch FETCH_POST_METRICS tasks to all social specialists in parallel
   */
  private async growthLoopListen(
    taskId: string
  ): Promise<{ specialistsPolled: number; results: Array<{ specialist: string; status: string }> }> {
    const socialSpecialists = ['TIKTOK_EXPERT', 'TWITTER_X_EXPERT', 'FACEBOOK_ADS_EXPERT', 'LINKEDIN_EXPERT'];
    const results: Array<{ specialist: string; status: string }> = [];

    const listenPromises = socialSpecialists.map(async (specialistId) => {
      try {
        const specialist = this.specialists.get(specialistId);
        if (specialist) {
          const listenMessage = this.createDelegationMessage(
            `${taskId}_listen_${specialistId}`,
            specialistId,
            { action: 'FETCH_POST_METRICS' }
          );
          await this.delegateWithReview(specialistId, listenMessage);
          results.push({ specialist: specialistId, status: 'completed' });
        } else {
          results.push({ specialist: specialistId, status: 'not_registered' });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ specialist: specialistId, status: `failed: ${errorMsg}` });
      }
    });

    await Promise.all(listenPromises);
    return { specialistsPolled: results.filter(r => r.status === 'completed').length, results };
  }

  /**
   * GROWTH_LOOP Step 2: ANALYZE
   * Send aggregated data to GROWTH_ANALYST for pattern analysis and KPI calculation
   */
  private async growthLoopAnalyze(
    taskId: string
  ): Promise<{ patternsFound: number; kpisCalculated: boolean }> {
    const growthAnalyst = this.specialists.get('GROWTH_ANALYST');
    if (!growthAnalyst) {
      this.log('WARN', 'GROWTH_ANALYST not registered, skipping analysis step');
      return { patternsFound: 0, kpisCalculated: false };
    }

    // Aggregate metrics
    await this.delegateWithReview(
      'GROWTH_ANALYST',
      this.createDelegationMessage(`${taskId}_aggregate`, 'GROWTH_ANALYST', { action: 'AGGREGATE_METRICS' }),
    );

    // Calculate KPIs
    await this.delegateWithReview(
      'GROWTH_ANALYST',
      this.createDelegationMessage(`${taskId}_kpis`, 'GROWTH_ANALYST', { action: 'CALCULATE_KPIS' }),
    );

    // Identify patterns
    const patternReport = await this.delegateWithReview(
      'GROWTH_ANALYST',
      this.createDelegationMessage(`${taskId}_patterns`, 'GROWTH_ANALYST', { action: 'IDENTIFY_PATTERNS' }),
    );

    const patternData = patternReport?.data as Record<string, unknown> | undefined;
    const patternsFound = (patternData?.insights as Array<unknown>)?.length ?? 0;

    return { patternsFound, kpisCalculated: true };
  }

  /**
   * GROWTH_LOOP Step 3: MUTATE
   * Read mutation directives from GROWTH_ANALYST and distribute to specialists
   */
  private async growthLoopMutate(
    taskId: string
  ): Promise<{ directivesGenerated: number; directives: Array<Record<string, unknown>> }> {
    const growthAnalyst = this.specialists.get('GROWTH_ANALYST');
    if (!growthAnalyst) {
      return { directivesGenerated: 0, directives: [] };
    }

    const mutationReport = await this.delegateWithReview(
      'GROWTH_ANALYST',
      this.createDelegationMessage(`${taskId}_mutations`, 'GROWTH_ANALYST', { action: 'GENERATE_MUTATIONS' }),
    );

    const mutationData = mutationReport?.data as Record<string, unknown> | undefined;
    const directives = (mutationData?.mutations as Array<Record<string, unknown>>) ?? [];

    return { directivesGenerated: directives.length, directives };
  }

  /**
   * GROWTH_LOOP Step 4: CREATE
   * Dispatch content creation to specialists, informed by mutation directives
   */
  private async growthLoopCreate(
    taskId: string,
    mutations: { directives: Array<Record<string, unknown>> }
  ): Promise<{ contentPieces: number }> {
    // Build a campaign goal informed by mutation directives
    const mutationContext = mutations.directives
      .map(d => `${d.type as string}: ${d.rationale as string}`)
      .join('; ');

    const growthGoal: CampaignGoal = {
      objective: 'engagement',
      message: `Create content for growth loop cycle. Apply these strategy mutations: ${mutationContext || 'No mutations — continue current strategy.'}`,
      contentType: 'mixed',
      kpis: ['engagement_rate', 'follower_growth', 'content_velocity'],
    };

    // Use existing campaign orchestration for content creation
    const result = await this.orchestrateCampaign(growthGoal, `${taskId}_create`, Date.now());
    const successCount = result?.execution?.successfulSpecialists ?? 0;

    return { contentPieces: successCount };
  }

  /**
   * Generate a report for JASPER
   */
  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  /**
   * Self-assessment - this manager has REAL orchestration logic
   */
  hasRealLogic(): boolean {
    return true;
  }

  /**
   * Lines of code assessment
   */
  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 1200, boilerplate: 120 };
  }

  // ==========================================================================
  // BRAND DNA INTEGRATION - Runtime Industry Context
  // ==========================================================================

  /**
   * Load Brand DNA from MemoryVault for industry-agnostic customization
   */
  private async loadBrandContext(): Promise<BrandContext> {
    // Check cache first
    if (this.brandContextCache.has(PLATFORM_ID)) {
      const cached = this.brandContextCache.get(PLATFORM_ID);
      if (cached) {return cached;}
    }

    try {
      const brandDNA = await getBrandDNA();

      if (!brandDNA) {
        this.log('WARN', `No Brand DNA found for organization ${PLATFORM_ID}, using defaults`);
        return this.createDefaultBrandContext();
      }

      const brandContext: BrandContext = {
        companyDescription: brandDNA.companyDescription ?? '',
        uniqueValue: brandDNA.uniqueValue ?? '',
        targetAudience: brandDNA.targetAudience ?? '',
        industry: brandDNA.industry ?? 'General',
        toneOfVoice: brandDNA.toneOfVoice ?? 'professional',
        communicationStyle: brandDNA.communicationStyle ?? '',
        keyPhrases: brandDNA.keyPhrases ?? [],
        avoidPhrases: brandDNA.avoidPhrases ?? [],
        competitors: brandDNA.competitors ?? [],
        loaded: true,
      };

      // Cache for performance
      this.brandContextCache.set(PLATFORM_ID, brandContext);
      this.log('INFO', `Loaded Brand DNA for organization ${PLATFORM_ID} (Industry: ${brandContext.industry})`);

      return brandContext;
    } catch (error) {
      this.log('ERROR', `Failed to load Brand DNA: ${error instanceof Error ? error.message : String(error)}`);
      return this.createDefaultBrandContext();
    }
  }

  /**
   * Create default brand context when no Brand DNA exists
   */
  private createDefaultBrandContext(): BrandContext {
    return {
      companyDescription: '',
      uniqueValue: '',
      targetAudience: '',
      industry: 'General',
      toneOfVoice: 'professional',
      communicationStyle: 'Clear and helpful',
      keyPhrases: [],
      avoidPhrases: [],
      competitors: [],
      loaded: false,
    };
  }

  // ==========================================================================
  // CAMPAIGN INTENT DETECTION
  // ==========================================================================

  /**
   * Detect campaign intent from the goal message
   */
  private detectCampaignIntent(goal: CampaignGoal, _message: AgentMessage): CampaignIntent {
    const text = `${goal.message ?? ''} ${goal.objective ?? ''} ${JSON.stringify(goal.targetAudience ?? {})}`.toLowerCase();

    // Check for explicit platform mentions (single platform routing)
    const platformMentions = {
      tiktok: text.includes('tiktok'),
      twitter: text.includes('twitter') || text.includes('x.com'),
      facebook: text.includes('facebook') || text.includes('fb '),
      linkedin: text.includes('linkedin'),
      seo: text.includes('seo') || text.includes('search engine') || text.includes('traffic') || text.includes('visitors') || text.includes('backlinks') || text.includes('domain analysis'),
    };

    const platformCount = Object.values(platformMentions).filter(Boolean).length;
    if (platformCount === 1) {
      return 'SINGLE_PLATFORM';
    }

    // Score each intent based on keyword matches
    let bestIntent: CampaignIntent = 'FULL_FUNNEL';
    let bestScore = 0;

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      const score = keywords.filter(kw => text.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent as CampaignIntent;
      }
    }

    // If no clear intent, use objective to determine
    if (bestScore === 0) {
      switch (goal.objective) {
        case 'awareness':
          return 'AWARENESS';
        case 'leads':
          return 'LEAD_GENERATION';
        case 'engagement':
          return 'THOUGHT_LEADERSHIP';
        case 'conversions':
          return 'PAID_ADVERTISING';
        default:
          return 'FULL_FUNNEL';
      }
    }

    return bestIntent;
  }

  /**
   * Resolve which specialists to activate based on intent
   */
  private resolveSpecialistsForIntent(intent: CampaignIntent, goal: CampaignGoal): string[] {
    if (intent === 'SINGLE_PLATFORM') {
      // Find the specific platform mentioned
      const text = goal.message?.toLowerCase() ?? '';
      if (text.includes('tiktok')) {return ['TIKTOK_EXPERT'];}
      if (text.includes('twitter') || text.includes('x.com')) {return ['TWITTER_X_EXPERT'];}
      if (text.includes('facebook') || text.includes('fb ')) {return ['FACEBOOK_ADS_EXPERT'];}
      if (text.includes('linkedin')) {return ['LINKEDIN_EXPERT'];}
      if (text.includes('youtube')) {return ['YOUTUBE_EXPERT'];}
      if (text.includes('instagram') || text.includes(' ig ')) {return ['INSTAGRAM_EXPERT'];}
      if (text.includes('pinterest')) {return ['PINTEREST_EXPERT'];}
      if (text.includes('paid ad') || text.includes('ad spend') || text.includes('ppc') || text.includes('media buy')) {return ['PAID_ADS_SPECIALIST'];}
      if (text.includes('seo')) {return ['SEO_EXPERT'];}
    }

    // Get specialists for this intent
    const requiredSpecialists = INTENT_SPECIALISTS[intent] ?? INTENT_SPECIALISTS.FULL_FUNNEL;

    // Filter to only functional specialists
    return requiredSpecialists.filter(id => {
      const specialist = this.specialists.get(id);
      return specialist?.isFunctional();
    });
  }

  // ==========================================================================
  // CORE CAMPAIGN ORCHESTRATION - Industry-Agnostic Flow
  // ==========================================================================

  /**
   * Main campaign orchestration function
   * Implements: Brand DNA → SEO Keywords → Social Specialists → Synthesis
   */
  private async orchestrateCampaign(
    goal: CampaignGoal,
    taskId: string,
    startTime: number
  ): Promise<CampaignBrief> {
    const warnings: string[] = [];
    const delegations: DelegationResult[] = [];
    const specialistOutputs: CampaignBrief['specialistOutputs'] = {
      tiktok: null,
      twitter: null,
      facebook: null,
      linkedin: null,
      youtube: null,
      instagram: null,
      pinterest: null,
      paidAds: null,
      seo: null,
    };

    // Step 1: Load Brand DNA for industry-agnostic customization
    const brandContext = await this.loadBrandContext();
    this.log('INFO', `Brand context loaded (Industry: ${brandContext.industry})`);

    // Step 2: Detect campaign intent
    const detectedIntent = this.detectCampaignIntent(goal, { id: taskId } as AgentMessage);
    this.log('INFO', `Detected campaign intent: ${detectedIntent}`);

    // Step 3: Analyze campaign goal with brand context
    const campaignAnalysis = this.analyzeCampaignGoal(goal, brandContext, detectedIntent);
    this.log('INFO', `Campaign analysis: ${campaignAnalysis.objective} targeting ${campaignAnalysis.targetAudience}`);

    // Step 4: Get SEO keyword guidance FIRST (for social content injection)
    let seoGuidance: SEOKeywordGuidance | null = null;
    const specialistIds = this.resolveSpecialistsForIntent(detectedIntent, goal);

    if (specialistIds.includes('SEO_EXPERT')) {
      seoGuidance = await this.getSEOKeywordGuidance(goal, brandContext, taskId, delegations, specialistOutputs);
      this.log('INFO', `SEO guidance retrieved: ${seoGuidance?.primaryKeywords.length ?? 0} primary keywords`);
    }

    // Step 5: Determine platform strategy with SEO keywords
    const platformStrategy = this.determinePlatformStrategy(goal, campaignAnalysis, seoGuidance);
    this.log('INFO', `Selected platforms: ${platformStrategy.platforms.join(', ')}`);

    // Step 6: Delegate to social specialists in parallel (with SEO keywords injected)
    await this.delegateToSocialSpecialists(
      goal,
      brandContext,
      platformStrategy,
      seoGuidance,
      taskId,
      delegations,
      specialistOutputs,
      warnings
    );
    this.log('INFO', `Delegated to ${delegations.length} specialists`);

    // Step 7: Aggregate results into unified CampaignBrief
    const aggregatedPlan = this.aggregateResults(delegations, campaignAnalysis, platformStrategy, brandContext);

    // Step 8: Calculate confidence
    const confidence = this.calculateConfidence(delegations, specialistIds.length);

    // Step 9: Build cross-platform recommendations
    const crossPlatformRecommendations = this.generateCrossPlatformRecommendations(
      delegations,
      brandContext,
      seoGuidance
    );

    const completedAt = new Date();
    const totalExecutionTimeMs = Date.now() - startTime;

    return {
      briefId: `campaign_${taskId}`,
      createdAt: new Date(startTime),
      completedAt,
      campaignGoal: goal,
      brandContext,
      detectedIntent,
      seoGuidance,
      campaignAnalysis,
      platformStrategy,
      delegations,
      specialistOutputs,
      aggregatedPlan,
      crossPlatformRecommendations,
      confidence,
      warnings,
      execution: {
        totalSpecialists: delegations.length,
        successfulSpecialists: delegations.filter(d => d.status === 'COMPLETED').length,
        failedSpecialists: delegations.filter(d => d.status === 'FAILED').length,
        totalExecutionTimeMs,
      },
    };
  }

  // ==========================================================================
  // SEO-SOCIAL FEEDBACK LOOP
  // ==========================================================================

  /**
   * Get SEO keyword guidance to inject into social content
   */
  private async getSEOKeywordGuidance(
    goal: CampaignGoal,
    brandContext: BrandContext,
    taskId: string,
    delegations: DelegationResult[],
    specialistOutputs: CampaignBrief['specialistOutputs']
  ): Promise<SEOKeywordGuidance | null> {
    const seoSpecialist = this.specialists.get('SEO_EXPERT');

    if (!seoSpecialist?.isFunctional()) {
      this.log('WARN', 'SEO_EXPERT not functional, skipping keyword guidance');
      return null;
    }

    const startTime = Date.now();

    try {
      // Detect if this is a domain analysis request (traffic, visitors, backlinks, competitor domain)
      const text = (goal.message ?? '').toLowerCase();
      const isDomainAnalysis = /traffic|visitors|backlink|referring domain|domain.?analysis|domain.?rank/.test(text);
      const extractedDomain = this.extractDomainFromMessage(text);

      let seoPayload: Record<string, unknown>;
      let briefDescription: string;

      if (isDomainAnalysis && extractedDomain) {
        // Domain analysis mode — traffic, backlinks, referring domains, competitors
        seoPayload = {
          action: 'domain_analysis',
          domain: extractedDomain,
          keywordLimit: 20,
        };
        briefDescription = `Domain analysis for ${extractedDomain}`;
        this.log('INFO', `Routing to domain_analysis for ${extractedDomain}`);
      } else {
        // Log why domain analysis was NOT triggered
        if (isDomainAnalysis && !extractedDomain) {
          this.log('WARN', `Domain analysis keywords detected but no domain could be extracted from: "${text.slice(0, 120)}"`);
        } else if (!isDomainAnalysis && extractedDomain) {
          this.log('INFO', `Domain "${extractedDomain}" found but no analysis keywords detected — using keyword research`);
        }
        // Default keyword research mode
        seoPayload = {
          action: 'keyword_research',
          seed: this.extractKeywordSeed(goal, brandContext),
          industry: brandContext.industry,
          targetCount: 15,
        };
        briefDescription = 'Keyword research for campaign content optimization';
      }

      const seoMessage: AgentMessage = {
        id: `${taskId}_seo_${isDomainAnalysis ? 'domain' : 'keywords'}`,
        type: 'COMMAND',
        from: this.identity.id,
        to: 'SEO_EXPERT',
        payload: seoPayload,
        timestamp: new Date(),
        priority: 'HIGH',
        requiresResponse: true,
        traceId: taskId,
      };

      const report = await this.delegateWithReview('SEO_EXPERT', seoMessage);

      const executionTimeMs = Date.now() - startTime;

      this.log('INFO', `SEO_EXPERT returned status=${report.status} for ${briefDescription} (${executionTimeMs}ms)`);

      if (report.status === 'COMPLETED' && report.data) {
        if (isDomainAnalysis) {
          const analysisData = report.data as { summary?: string };

          // Surface configuration warnings so Jasper doesn't improvise
          if (analysisData.summary?.includes('[ACTION REQUIRED]') || analysisData.summary?.includes('[ERROR]')) {
            this.log('WARN', `Domain analysis returned with warning: ${analysisData.summary}`);
          }

          // Domain analysis completed — return the full result directly
          delegations.push({
            specialist: 'SEO_EXPERT',
            brief: briefDescription,
            status: 'COMPLETED',
            result: report.data,
            executionTimeMs,
          });

          specialistOutputs.seo = report.data;

          // Build content recommendation — include warning if present
          const recommendation = analysisData.summary?.includes('[ACTION REQUIRED]')
            ? analysisData.summary
            : `Full domain analysis completed for ${extractedDomain}`;

          // Return minimal keyword guidance since the primary output is the domain report
          return {
            primaryKeywords: [],
            secondaryKeywords: [],
            longTailKeywords: [],
            searchIntent: 'informational',
            contentRecommendations: [recommendation],
            keywordDensityTarget: 0,
          };
        }

        const seoData = report.data as { keywords?: Array<{ keyword: string; difficulty: string; searchIntent: string }> };

        // Transform SEO output into guidance format
        const guidance: SEOKeywordGuidance = {
          primaryKeywords: seoData.keywords?.slice(0, 3).map(k => k.keyword) ?? [],
          secondaryKeywords: seoData.keywords?.slice(3, 8).map(k => k.keyword) ?? [],
          longTailKeywords: seoData.keywords?.slice(8).map(k => k.keyword) ?? [],
          searchIntent: this.determineSearchIntent(seoData.keywords ?? []),
          contentRecommendations: this.generateSEOContentRecommendations(seoData.keywords ?? [], brandContext),
          keywordDensityTarget: 0.02, // 2% target
        };

        delegations.push({
          specialist: 'SEO_EXPERT',
          brief: briefDescription,
          status: 'COMPLETED',
          result: guidance,
          executionTimeMs,
        });

        specialistOutputs.seo = seoData;

        return guidance;
      }

      const failReason = report.errors?.join('; ') ?? 'Unknown error';
      this.log('WARN', `SEO_EXPERT ${report.status} for "${briefDescription}": ${failReason}`);

      delegations.push({
        specialist: 'SEO_EXPERT',
        brief: briefDescription,
        status: report.status === 'BLOCKED' ? 'BLOCKED' : 'FAILED',
        result: failReason,
        executionTimeMs,
      });

      return null;
    } catch (error) {
      this.log('ERROR', `SEO keyword guidance failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Extract a domain name from user message text.
   * Handles: example.com, www.example.com, https://example.com,
   * blog.example.com, sub.domain.co.uk
   */
  private extractDomainFromMessage(text: string): string | null {
    // Match URLs or bare domains, capturing the full domain after optional protocol/www
    const domainRegex = /(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})/i;
    const match = text.match(domainRegex);
    if (match) {
      // match[1] captures the full domain: "blog.example.com", "example.co.uk", etc.
      return match[1] ?? null;
    }
    return null;
  }

  /**
   * Extract keyword seed from campaign goal and brand context
   */
  private extractKeywordSeed(goal: CampaignGoal, brandContext: BrandContext): string {
    // Combine campaign message with brand context for comprehensive seed
    const messageParts = [
      goal.message,
      brandContext.companyDescription,
      brandContext.uniqueValue,
      brandContext.industry,
    ].filter(Boolean);

    // Extract key terms (simplified - in production would use NLP)
    return messageParts.join(' ').slice(0, 200);
  }

  /**
   * Determine overall search intent from SEO keywords
   */
  private determineSearchIntent(
    keywords: Array<{ searchIntent?: string }>
  ): 'informational' | 'transactional' | 'navigational' | 'commercial' {
    const intents = keywords
      .map(k => k.searchIntent)
      .filter((intent): intent is string => typeof intent === 'string');

    if (intents.length === 0) {return 'informational';}

    // Count occurrences
    const counts: Record<string, number> = {};
    for (const intent of intents) {
      counts[intent] = (counts[intent] ?? 0) + 1;
    }

    // Return most common
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return (sorted[0]?.[0] ?? 'informational') as 'informational' | 'transactional' | 'navigational' | 'commercial';
  }

  /**
   * Generate content recommendations based on SEO analysis
   */
  private generateSEOContentRecommendations(
    keywords: Array<{ keyword: string; difficulty?: string }>,
    brandContext: BrandContext
  ): string[] {
    const recommendations: string[] = [];

    if (keywords.length > 0) {
      recommendations.push(`Incorporate primary keyword "${keywords[0]?.keyword}" in headlines and hooks`);
    }

    if (brandContext.keyPhrases.length > 0) {
      recommendations.push(`Use brand phrases: ${brandContext.keyPhrases.slice(0, 3).join(', ')}`);
    }

    if (brandContext.avoidPhrases.length > 0) {
      recommendations.push(`Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ')}`);
    }

    recommendations.push('Maintain natural keyword integration - avoid stuffing');
    recommendations.push('Include keywords in first 100 characters where possible');

    return recommendations;
  }

  /**
   * Analyze and parse the campaign goal with brand context
   */
  private analyzeCampaignGoal(
    goal: CampaignGoal,
    brandContext: BrandContext,
    detectedIntent: CampaignIntent
  ): CampaignAnalysis {
    const message = goal.message ?? '';
    const messageLower = message.toLowerCase();

    // Determine objective
    let objective = goal.objective ?? 'awareness';
    if (!goal.objective) {
      if (messageLower.includes('convert') || messageLower.includes('sale') || messageLower.includes('purchase')) {
        objective = 'conversions';
      } else if (messageLower.includes('lead') || messageLower.includes('sign up') || messageLower.includes('demo')) {
        objective = 'leads';
      } else if (messageLower.includes('engage') || messageLower.includes('comment') || messageLower.includes('share')) {
        objective = 'engagement';
      }
    }

    // Determine target audience - prefer Brand DNA over inference
    let targetAudience = brandContext.targetAudience || 'General audience';
    if (goal.targetAudience?.demographics) {
      targetAudience = goal.targetAudience.demographics;
    } else if (!brandContext.targetAudience) {
      // Fallback to inference from message
      if (messageLower.includes('gen z') || messageLower.includes('young')) {
        targetAudience = 'Gen Z and younger Millennials (16-34)';
      } else if (messageLower.includes('millennial')) {
        targetAudience = 'Millennials (25-40)';
      } else if (messageLower.includes('boomer') || messageLower.includes('older')) {
        targetAudience = 'Older demographics (45-65+)';
      } else if (messageLower.includes('b2b') || messageLower.includes('business') || messageLower.includes('professional')) {
        targetAudience = 'Business professionals and decision-makers';
      } else if (messageLower.includes('local')) {
        targetAudience = 'Local community members';
      }
    }

    // Determine content type
    let contentType = goal.contentType ?? 'mixed';
    if (!goal.contentType) {
      if (messageLower.includes('video')) {
        contentType = 'video';
      } else if (messageLower.includes('image') || messageLower.includes('photo')) {
        contentType = 'image';
      } else if (messageLower.includes('thread') || messageLower.includes('tweet') || messageLower.includes('post')) {
        contentType = 'text';
      }
    }

    // Timeline
    const timeline = goal.timeline
      ? `Launch: ${goal.timeline.launchDate ?? 'ASAP'}, Duration: ${goal.timeline.duration ?? 'Ongoing'}`
      : 'ASAP, ongoing until results achieved';

    // Budget
    const budget = typeof goal.budget === 'number'
      ? `$${goal.budget.toLocaleString()}`
      : goal.budget ?? 'Unspecified';

    // KPIs
    const kpis = goal.kpis ?? this.inferKPIs(objective);

    // Industry context from Brand DNA (not hardcoded!)
    const industryContext = brandContext.industry !== 'General'
      ? `${brandContext.industry} industry - ${brandContext.companyDescription}`
      : 'General business context';

    return {
      objective,
      targetAudience,
      contentType,
      timeline,
      budget,
      kpis,
      detectedIntent,
      industryContext,
    };
  }

  /**
   * Infer KPIs based on campaign objective
   */
  private inferKPIs(objective: string): string[] {
    const kpiMap: Record<string, string[]> = {
      awareness: ['Impressions', 'Reach', 'Brand mentions', 'Video views'],
      engagement: ['Likes', 'Comments', 'Shares', 'Engagement rate', 'Reply rate'],
      conversions: ['Conversion rate', 'Cost per conversion', 'ROAS', 'Revenue'],
      leads: ['Lead volume', 'Cost per lead', 'Lead quality score', 'Conversion to SQL'],
    };

    return kpiMap[objective] ?? ['Impressions', 'Engagement rate'];
  }

  /**
   * Determine which platforms should be used for this campaign
   * Now includes LinkedIn scoring and SEO keyword integration
   */
  private determinePlatformStrategy(
    goal: CampaignGoal,
    analysis: CampaignAnalysis,
    seoGuidance: SEOKeywordGuidance | null
  ): PlatformStrategy {
    const platforms: string[] = [];
    const rationales: string[] = [];
    const budgetAllocation: Record<string, string> = {};

    const message = goal.message?.toLowerCase() ?? '';
    const audience = analysis.targetAudience.toLowerCase();
    const contentType = analysis.contentType.toLowerCase();

    // Check for explicit platform mentions
    const explicitPlatforms = goal.targetAudience?.platforms ?? [];

    // TikTok scoring
    let tiktokScore = 0;
    if (explicitPlatforms.some(p => p.toLowerCase() === 'tiktok')) {
      tiktokScore += 50;
    }
    if (message.includes('tiktok') || message.includes('viral') || message.includes('trending')) {
      tiktokScore += 30;
    }
    if (audience.includes('gen z') || audience.includes('16-34') || audience.includes('young')) {
      tiktokScore += 20;
    }
    if (contentType.includes('video') || message.includes('video') || message.includes('short form')) {
      tiktokScore += 15;
    }
    if (message.includes('hook') || message.includes('trending sound')) {
      tiktokScore += 10;
    }

    // X/Twitter scoring
    let xScore = 0;
    if (explicitPlatforms.some(p => ['x', 'twitter'].includes(p.toLowerCase()))) {
      xScore += 50;
    }
    if (message.includes('twitter') || message.includes('tweet') || message.includes(' x ') || message.includes('thread')) {
      xScore += 30;
    }
    if (audience.includes('b2b') || audience.includes('professional') || audience.includes('business')) {
      xScore += 20;
    }
    if (message.includes('thought leadership') || message.includes('engage') || message.includes('conversation')) {
      xScore += 15;
    }
    if (contentType.includes('text') || message.includes('thread')) {
      xScore += 10;
    }

    // Facebook scoring
    let facebookScore = 0;
    if (explicitPlatforms.some(p => ['facebook', 'fb'].includes(p.toLowerCase()))) {
      facebookScore += 50;
    }
    if (message.includes('facebook') || message.includes('fb') || message.includes('meta')) {
      facebookScore += 30;
    }
    if (audience.includes('45-65') || audience.includes('older') || audience.includes('local')) {
      facebookScore += 20;
    }
    if (message.includes('ad') || message.includes('retarget') || message.includes('lead gen')) {
      facebookScore += 15;
    }
    if (analysis.objective === 'leads' || analysis.objective === 'conversions') {
      facebookScore += 10;
    }

    // LinkedIn scoring (NEW)
    let linkedinScore = 0;
    if (explicitPlatforms.some(p => p.toLowerCase() === 'linkedin')) {
      linkedinScore += 50;
    }
    if (message.includes('linkedin') || message.includes('b2b') || message.includes('professional')) {
      linkedinScore += 30;
    }
    if (audience.includes('b2b') || audience.includes('executive') || audience.includes('decision maker')) {
      linkedinScore += 25;
    }
    if (message.includes('enterprise') || message.includes('corporate') || message.includes('c-suite')) {
      linkedinScore += 15;
    }
    if (analysis.objective === 'leads' && audience.includes('professional')) {
      linkedinScore += 10;
    }

    // Select platforms based on scores (threshold: 15)
    if (tiktokScore >= 15) {
      platforms.push('TIKTOK');
      rationales.push(`TikTok (score: ${tiktokScore}) - ${this.getTikTokRationale(message, audience, contentType)}`);
    }
    if (xScore >= 15) {
      platforms.push('X');
      rationales.push(`X/Twitter (score: ${xScore}) - ${this.getXRationale(message, audience, contentType)}`);
    }
    if (facebookScore >= 15) {
      platforms.push('FACEBOOK');
      rationales.push(`Facebook (score: ${facebookScore}) - ${this.getFacebookRationale(message, audience, contentType)}`);
    }
    if (linkedinScore >= 15) {
      platforms.push('LINKEDIN');
      rationales.push(`LinkedIn (score: ${linkedinScore}) - ${this.getLinkedInRationale(message, audience)}`);
    }

    // If no platforms selected, use default based on objective
    if (platforms.length === 0) {
      if (analysis.objective === 'awareness') {
        platforms.push('TIKTOK', 'X');
        rationales.push('Default awareness strategy: TikTok for viral reach + X for engagement');
      } else if (analysis.objective === 'leads' || analysis.objective === 'conversions') {
        platforms.push('FACEBOOK', 'LINKEDIN');
        rationales.push('Default conversion strategy: Facebook + LinkedIn for targeted lead generation');
      } else {
        platforms.push('X', 'LINKEDIN');
        rationales.push('Default engagement strategy: X for conversations + LinkedIn for professional reach');
      }
    }

    // Budget allocation
    if (analysis.budget !== 'Unspecified') {
      const allocation = this.allocateBudget(platforms, analysis);
      Object.assign(budgetAllocation, allocation);
    } else {
      platforms.forEach(p => {
        budgetAllocation[p] = 'To be determined';
      });
    }

    // Extract SEO keywords to inject into social content
    const seoKeywords = seoGuidance
      ? [...seoGuidance.primaryKeywords, ...seoGuidance.secondaryKeywords.slice(0, 2)]
      : [];

    return {
      platforms,
      rationale: rationales.join(' | '),
      budgetAllocation,
      seoKeywords,
    };
  }

  /**
   * Get LinkedIn selection rationale
   */
  private getLinkedInRationale(message: string, audience: string): string {
    const reasons: string[] = [];
    if (message.includes('b2b') || message.includes('professional')) {
      reasons.push('B2B focus');
    }
    if (audience.includes('executive') || audience.includes('decision maker')) {
      reasons.push('executive audience');
    }
    if (message.includes('enterprise') || message.includes('corporate')) {
      reasons.push('enterprise targeting');
    }
    return reasons.length > 0 ? reasons.join(', ') : 'professional platform match';
  }

  /**
   * Get TikTok selection rationale
   */
  private getTikTokRationale(message: string, audience: string, contentType: string): string {
    const reasons: string[] = [];
    if (message.includes('viral') || message.includes('trending')) {
      reasons.push('viral potential');
    }
    if (audience.includes('gen z') || audience.includes('young')) {
      reasons.push('young audience match');
    }
    if (contentType.includes('video') || message.includes('video')) {
      reasons.push('video-first content');
    }
    return reasons.length > 0 ? reasons.join(', ') : 'platform match';
  }

  /**
   * Get X/Twitter selection rationale
   */
  private getXRationale(message: string, audience: string, contentType: string): string {
    const reasons: string[] = [];
    if (message.includes('thought leadership') || message.includes('b2b')) {
      reasons.push('thought leadership');
    }
    if (audience.includes('professional') || audience.includes('business')) {
      reasons.push('professional audience');
    }
    if (message.includes('thread') || contentType.includes('text')) {
      reasons.push('text-based content');
    }
    if (message.includes('engage') || message.includes('conversation')) {
      reasons.push('engagement focus');
    }
    return reasons.length > 0 ? reasons.join(', ') : 'platform match';
  }

  /**
   * Get Facebook selection rationale
   */
  private getFacebookRationale(message: string, audience: string, _contentType: string): string {
    const reasons: string[] = [];
    if (message.includes('ad') || message.includes('retarget')) {
      reasons.push('paid advertising');
    }
    if (audience.includes('older') || audience.includes('local')) {
      reasons.push('demographic match');
    }
    if (message.includes('lead')) {
      reasons.push('lead generation');
    }
    return reasons.length > 0 ? reasons.join(', ') : 'platform match';
  }

  /**
   * Allocate budget across selected platforms
   */
  private allocateBudget(platforms: string[], analysis: CampaignAnalysis): Record<string, string> {
    const allocation: Record<string, string> = {};
    const budgetStr = analysis.budget;

    // Extract numeric budget if possible
    const budgetMatch = budgetStr.match(/\$?([\d,]+)/);
    if (!budgetMatch) {
      platforms.forEach(p => {
        allocation[p] = 'To be determined';
      });
      return allocation;
    }

    const totalBudget = parseInt(budgetMatch[1].replace(/,/g, ''));
    const platformCount = platforms.length;

    // Simple equal split for now - could be more sophisticated
    const perPlatform = Math.floor(totalBudget / platformCount);
    const remainder = totalBudget % platformCount;

    platforms.forEach((platform, index) => {
      const amount = index === 0 ? perPlatform + remainder : perPlatform;
      allocation[platform] = `$${amount.toLocaleString()}`;
    });

    return allocation;
  }

  /**
   * Delegate to social specialists with SEO keywords injected
   * Executes in parallel for performance
   */
  private async delegateToSocialSpecialists(
    goal: CampaignGoal,
    brandContext: BrandContext,
    strategy: PlatformStrategy,
    seoGuidance: SEOKeywordGuidance | null,
    taskId: string,
    delegations: DelegationResult[],
    specialistOutputs: CampaignBrief['specialistOutputs'],
    warnings: string[]
  ): Promise<void> {
    const delegationPromises = strategy.platforms.map(async (platform) => {
      const specialistId = this.getSpecialistId(platform);
      const specialist = this.specialists.get(specialistId);

      if (!specialist?.isFunctional()) {
        warnings.push(`${specialistId} is not functional - skipping`);
        delegations.push({
          specialist: specialistId,
          brief: 'Specialist not available',
          status: 'BLOCKED',
          result: { reason: 'SPECIALIST_NOT_FUNCTIONAL' },
        });
        return;
      }

      // Create platform-specific brief with SEO keywords and brand context
      const brief = this.createPlatformBrief(goal, platform, strategy, brandContext, seoGuidance);
      const startTime = Date.now();

      this.log('INFO', `Delegating to ${specialistId}...`);

      try {
        const message: AgentMessage = {
          id: `${taskId}_${specialistId}`,
          type: 'COMMAND',
          from: this.identity.id,
          to: specialistId,
          payload: this.buildSpecialistPayload(platform, goal, brandContext, seoGuidance, strategy),
          timestamp: new Date(),
          priority: 'NORMAL',
          requiresResponse: true,
          traceId: taskId,
        };

        const report = await this.delegateWithReview(specialistId, message);
        const executionTimeMs = Date.now() - startTime;

        // Map AgentReport status to DelegationResult status
        let delegationStatus: 'COMPLETED' | 'BLOCKED' | 'PENDING' | 'FAILED';
        if (report.status === 'COMPLETED') {
          delegationStatus = 'COMPLETED';
          // Store output by platform
          this.storeSpecialistOutput(platform, report.data, specialistOutputs);
        } else if (report.status === 'BLOCKED') {
          delegationStatus = 'BLOCKED';
        } else if (report.status === 'FAILED') {
          delegationStatus = 'FAILED';
        } else {
          delegationStatus = 'PENDING';
        }

        delegations.push({
          specialist: specialistId,
          brief,
          status: delegationStatus,
          result: report.status === 'COMPLETED' ? report.data : report.errors?.join('; ') ?? 'Unknown error',
          executionTimeMs,
        });

        if (report.status === 'BLOCKED') {
          warnings.push(`${specialistId} blocked - campaign plan is theoretical only`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Delegation failed';
        delegations.push({
          specialist: specialistId,
          brief,
          status: 'FAILED',
          result: errorMessage,
          executionTimeMs: Date.now() - startTime,
        });
        warnings.push(`Failed to delegate to ${specialistId}: ${errorMessage}`);
      }
    });

    // Execute all delegations in parallel
    await Promise.allSettled(delegationPromises);
  }

  /**
   * Build platform-specific payload with brand context and SEO keywords
   */
  private buildSpecialistPayload(
    platform: string,
    goal: CampaignGoal,
    brandContext: BrandContext,
    seoGuidance: SEOKeywordGuidance | null,
    strategy: PlatformStrategy
  ): Record<string, unknown> {
    const basePayload = {
      campaignGoal: goal,
      budget: strategy.budgetAllocation[platform],
      brandContext: {
        industry: brandContext.industry,
        toneOfVoice: brandContext.toneOfVoice,
        keyPhrases: brandContext.keyPhrases,
        avoidPhrases: brandContext.avoidPhrases,
      },
      seoKeywords: seoGuidance ? {
        primary: seoGuidance.primaryKeywords,
        secondary: seoGuidance.secondaryKeywords,
        recommendations: seoGuidance.contentRecommendations,
      } : null,
    };

    // Platform-specific payload structure
    switch (platform) {
      case 'TIKTOK':
        return {
          ...basePayload,
          method: 'generate_viral_hook',
          topic: goal.message,
          targetAudience: goal.targetAudience?.demographics ?? brandContext.targetAudience,
          contentGoal: this.mapObjectiveToContentGoal(goal.objective),
          niche: brandContext.industry,
          brandVoice: this.mapToneToTikTokVoice(brandContext.toneOfVoice),
        };

      case 'X':
        return {
          ...basePayload,
          action: 'build_thread_architecture',
          params: {
            topic: goal.message,
            goal: this.mapObjectiveToTwitterGoal(goal.objective),
            targetAudience: goal.targetAudience?.demographics ?? brandContext.targetAudience,
            tonePreference: this.mapToneToTwitterTone(brandContext.toneOfVoice),
            riskTolerance: 'medium',
          },
        };

      case 'FACEBOOK':
        return {
          ...basePayload,
          action: 'generate_ad_creative',
          objective: this.mapObjectiveToFacebookObjective(goal.objective),
          persona: goal.targetAudience?.demographics ?? brandContext.targetAudience,
          productService: brandContext.companyDescription,
          usp: brandContext.uniqueValue,
          offer: goal.message,
        };

      case 'LINKEDIN':
        return {
          ...basePayload,
          action: 'generate_content',
          topic: goal.message,
          contentType: 'post',
          targetAudience: goal.targetAudience?.demographics ?? brandContext.targetAudience,
          tone: this.mapToneToLinkedInTone(brandContext.toneOfVoice),
        };

      case 'YOUTUBE':
        return {
          ...basePayload,
          action: 'generate_content',
          topic: goal.message,
          contentType: 'video',
          targetAudience: goal.targetAudience?.demographics ?? brandContext.targetAudience,
          tone: this.mapToneToLinkedInTone(brandContext.toneOfVoice),
        };

      case 'INSTAGRAM':
        return {
          ...basePayload,
          action: 'generate_content',
          topic: goal.message,
          contentType: 'post',
          targetAudience: goal.targetAudience?.demographics ?? brandContext.targetAudience,
          tone: brandContext.toneOfVoice,
        };

      case 'PINTEREST':
        return {
          ...basePayload,
          action: 'generate_content',
          topic: goal.message,
          contentType: 'pin',
          targetAudience: goal.targetAudience?.demographics ?? brandContext.targetAudience,
          tone: brandContext.toneOfVoice,
        };

      case 'PAID_ADS':
        return {
          ...basePayload,
          action: 'plan_campaign',
          campaignGoal: this.mapObjectiveToPaidAdsGoal(goal.objective),
          totalBudget: this.extractNumericBudget(strategy.budgetAllocation['PAID_ADS'] ?? '1000'),
          durationDays: 30,
          targetAudience: goal.targetAudience?.demographics ?? brandContext.targetAudience,
          industry: brandContext.industry,
          availablePlatforms: strategy.platforms.filter(p => p !== 'PAID_ADS' && p !== 'SEO'),
        };

      default:
        return basePayload;
    }
  }

  /**
   * Map campaign objective to platform-specific content goals
   */
  private mapObjectiveToContentGoal(objective: string): string {
    const mapping: Record<string, string> = {
      awareness: 'awareness',
      engagement: 'engagement',
      conversions: 'conversion',
      leads: 'conversion',
      retention: 'engagement',
    };
    return mapping[objective] ?? 'awareness';
  }

  private mapObjectiveToTwitterGoal(objective: string): string {
    const mapping: Record<string, string> = {
      awareness: 'viral',
      engagement: 'thought_leadership',
      conversions: 'promotional',
      leads: 'promotional',
      retention: 'educational',
    };
    return mapping[objective] ?? 'thought_leadership';
  }

  private mapObjectiveToFacebookObjective(objective: string): string {
    const mapping: Record<string, string> = {
      awareness: 'awareness',
      engagement: 'awareness',
      conversions: 'direct_sale',
      leads: 'lead_magnet',
      retention: 'retargeting',
    };
    return mapping[objective] ?? 'awareness';
  }

  /**
   * Map brand tone to platform-specific voice settings
   */
  private mapToneToTikTokVoice(tone: string): string {
    const mapping: Record<string, string> = {
      warm: 'friendly',
      professional: 'professional',
      direct: 'edgy',
      friendly: 'casual',
      formal: 'professional',
      casual: 'humorous',
    };
    return mapping[tone] ?? 'casual';
  }

  private mapToneToTwitterTone(tone: string): string {
    const mapping: Record<string, string> = {
      warm: 'friendly',
      professional: 'professional',
      direct: 'provocative',
      friendly: 'friendly',
      formal: 'professional',
      casual: 'casual',
    };
    return mapping[tone] ?? 'professional';
  }

  private mapToneToLinkedInTone(tone: string): string {
    const mapping: Record<string, string> = {
      warm: 'conversational',
      professional: 'professional',
      direct: 'authoritative',
      friendly: 'conversational',
      formal: 'authoritative',
      casual: 'conversational',
    };
    return mapping[tone] ?? 'professional';
  }

  /**
   * Map campaign objective to paid ads campaign goal
   */
  private mapObjectiveToPaidAdsGoal(objective: string): string {
    const mapping: Record<string, string> = {
      awareness: 'awareness',
      engagement: 'traffic',
      conversions: 'conversions',
      leads: 'leads',
      retention: 'traffic',
    };
    return mapping[objective] ?? 'awareness';
  }

  /**
   * Extract numeric budget from a budget string like "$1,000" or "1000"
   */
  private extractNumericBudget(budgetStr: string): number {
    const match = budgetStr.replace(/[,$]/g, '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 1000;
  }

  /**
   * Store specialist output in the appropriate slot
   */
  private storeSpecialistOutput(
    platform: string,
    data: unknown,
    outputs: CampaignBrief['specialistOutputs']
  ): void {
    switch (platform) {
      case 'TIKTOK':
        outputs.tiktok = data;
        break;
      case 'X':
        outputs.twitter = data;
        break;
      case 'FACEBOOK':
        outputs.facebook = data;
        break;
      case 'LINKEDIN':
        outputs.linkedin = data;
        break;
      case 'YOUTUBE':
        outputs.youtube = data;
        break;
      case 'INSTAGRAM':
        outputs.instagram = data;
        break;
      case 'PINTEREST':
        outputs.pinterest = data;
        break;
      case 'PAID_ADS':
        outputs.paidAds = data;
        break;
    }
  }

  /**
   * Get specialist ID from platform name
   */
  private getSpecialistId(platform: string): string {
    const mapping: Record<string, string> = {
      TIKTOK: 'TIKTOK_EXPERT',
      X: 'TWITTER_X_EXPERT',
      TWITTER: 'TWITTER_X_EXPERT',
      FACEBOOK: 'FACEBOOK_ADS_EXPERT',
      LINKEDIN: 'LINKEDIN_EXPERT',
      YOUTUBE: 'YOUTUBE_EXPERT',
      INSTAGRAM: 'INSTAGRAM_EXPERT',
      PINTEREST: 'PINTEREST_EXPERT',
      PAID_ADS: 'PAID_ADS_SPECIALIST',
      SEO: 'SEO_EXPERT',
    };
    return mapping[platform] ?? `${platform}_EXPERT`;
  }

  /**
   * Create platform-specific brief with brand context and SEO keywords
   */
  private createPlatformBrief(
    goal: CampaignGoal,
    platform: string,
    strategy: PlatformStrategy,
    brandContext: BrandContext,
    seoGuidance: SEOKeywordGuidance | null
  ): string {
    const budget = strategy.budgetAllocation[platform] ?? 'Unspecified';
    const keywords = seoGuidance?.primaryKeywords.join(', ') ?? 'None specified';
    const brandVoice = `${brandContext.toneOfVoice} - ${brandContext.communicationStyle}`;

    // Industry context (derived from Brand DNA, never hardcoded)
    const industryContext = brandContext.industry !== 'General'
      ? `Industry: ${brandContext.industry}`
      : 'Industry: General/Multi-purpose';

    if (platform === 'TIKTOK') {
      return `Create TikTok campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
${industryContext}
Brand Voice: ${brandVoice}
SEO Keywords to Incorporate: ${keywords}
Focus: Viral content, trending sounds, hooks
Content Type: Short-form vertical video (15-60s)
Key Phrases to Use: ${brandContext.keyPhrases.slice(0, 3).join(', ') || 'None specified'}
Phrases to Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ') || 'None specified'}`;
    }

    if (platform === 'X') {
      return `Create X/Twitter campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
${industryContext}
Brand Voice: ${brandVoice}
SEO Keywords to Incorporate: ${keywords}
Focus: Thought leadership, engagement, conversations
Content Type: Tweets, threads, reply engagement
Key Phrases to Use: ${brandContext.keyPhrases.slice(0, 3).join(', ') || 'None specified'}
Phrases to Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ') || 'None specified'}`;
    }

    if (platform === 'FACEBOOK') {
      return `Create Facebook campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
${industryContext}
Brand Voice: ${brandVoice}
SEO Keywords to Incorporate: ${keywords}
Focus: Paid ads, audience targeting, retargeting, lead generation
Content Type: Ad creatives, carousel ads, video ads, lead forms
Key Phrases to Use: ${brandContext.keyPhrases.slice(0, 3).join(', ') || 'None specified'}
Phrases to Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ') || 'None specified'}`;
    }

    if (platform === 'LINKEDIN') {
      return `Create LinkedIn campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
${industryContext}
Brand Voice: ${brandVoice}
SEO Keywords to Incorporate: ${keywords}
Focus: B2B content, professional networking, thought leadership
Content Type: Posts, articles, connection outreach
Key Phrases to Use: ${brandContext.keyPhrases.slice(0, 3).join(', ') || 'None specified'}
Phrases to Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ') || 'None specified'}`;
    }

    if (platform === 'YOUTUBE') {
      return `Create YouTube campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
${industryContext}
Brand Voice: ${brandVoice}
SEO Keywords to Incorporate: ${keywords}
Focus: Long-form video, tutorials, SEO-driven content, subscriber growth
Content Type: Videos, thumbnails, descriptions, playlists
Key Phrases to Use: ${brandContext.keyPhrases.slice(0, 3).join(', ') || 'None specified'}
Phrases to Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ') || 'None specified'}`;
    }

    if (platform === 'INSTAGRAM') {
      return `Create Instagram campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
${industryContext}
Brand Voice: ${brandVoice}
SEO Keywords to Incorporate: ${keywords}
Focus: Visual storytelling, reels, carousels, stories, hashtag reach
Content Type: Reels, carousels, feed posts, stories
Key Phrases to Use: ${brandContext.keyPhrases.slice(0, 3).join(', ') || 'None specified'}
Phrases to Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ') || 'None specified'}`;
    }

    if (platform === 'PINTEREST') {
      return `Create Pinterest campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
${industryContext}
Brand Voice: ${brandVoice}
SEO Keywords to Incorporate: ${keywords}
Focus: Visual search, keyword-rich pins, boards, seasonal content planning
Content Type: Standard pins, idea pins, product pins, boards
Key Phrases to Use: ${brandContext.keyPhrases.slice(0, 3).join(', ') || 'None specified'}
Phrases to Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ') || 'None specified'}`;
    }

    if (platform === 'PAID_ADS') {
      return `Create paid advertising campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
${industryContext}
Brand Voice: ${brandVoice}
SEO Keywords to Incorporate: ${keywords}
Focus: Cross-platform paid media strategy, budget allocation, audience targeting, bid optimization
Content Type: Ad creative briefs, campaign structure, audience segments
Key Phrases to Use: ${brandContext.keyPhrases.slice(0, 3).join(', ') || 'None specified'}
Phrases to Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ') || 'None specified'}`;
    }

    return `Create ${platform} campaign strategy:
Campaign Goal: ${goal.message}
${industryContext}
Brand Voice: ${brandVoice}
Budget: ${budget}`;
  }

  /**
   * Aggregate specialist results into unified plan
   */
  private aggregateResults(
    delegations: DelegationResult[],
    analysis: CampaignAnalysis,
    strategy: PlatformStrategy,
    brandContext: BrandContext
  ): AggregatedPlan {
    const completedDelegations = delegations.filter(d => d.status === 'COMPLETED');
    const blockedDelegations = delegations.filter(d => d.status === 'BLOCKED');

    // Overview with brand context (industry-agnostic)
    const platformList = strategy.platforms.join(', ');
    const statusSummary = blockedDelegations.length > 0
      ? `(${blockedDelegations.length} specialist(s) not functional - theoretical plan only)`
      : '(all specialists functional)';

    const industryNote = brandContext.industry !== 'General'
      ? ` for the ${brandContext.industry} industry`
      : '';

    const overview = `Multi-platform ${analysis.objective} campaign${industryNote} across ${platformList} ${statusSummary}. Target: ${analysis.targetAudience}. ${analysis.contentType} content optimized for each platform with consistent ${brandContext.toneOfVoice} brand voice.`;

    // Timeline
    const timeline = `${analysis.timeline}. Coordinated launch across all platforms for maximum impact.`;

    // Expected Reach (estimated)
    const expectedReach = this.estimateReach(strategy.platforms, analysis);

    // Recommendations
    const recommendations = this.generateRecommendations(delegations, analysis, strategy);

    // Brand voice compliance check
    const brandVoiceCompliance = completedDelegations.length > 0;

    // SEO integration check
    const seoIntegration = strategy.seoKeywords.length > 0;

    return {
      overview,
      timeline,
      expectedReach,
      recommendations,
      brandVoiceCompliance,
      seoIntegration,
    };
  }

  /**
   * Estimate campaign reach
   */
  private estimateReach(platforms: string[], analysis: CampaignAnalysis): string {
    const hasBudget = analysis.budget !== 'Unspecified';

    if (!hasBudget) {
      return 'Organic reach: 1,000-10,000 impressions per platform (highly variable based on content quality and timing)';
    }

    // Simple estimation based on platform count and budget
    const platformCount = platforms.length;
    const baseReach = platformCount * 50000; // 50k per platform as baseline
    return `Estimated ${baseReach.toLocaleString()}-${(baseReach * 3).toLocaleString()} impressions across all platforms with paid promotion`;
  }

  /**
   * Generate strategic recommendations (industry-agnostic)
   */
  private generateRecommendations(
    delegations: DelegationResult[],
    analysis: CampaignAnalysis,
    strategy: PlatformStrategy
  ): string[] {
    const recommendations: string[] = [];

    // Check for blocked specialists
    const blockedCount = delegations.filter(d => d.status === 'BLOCKED').length;
    if (blockedCount > 0) {
      recommendations.push(`URGENT: ${blockedCount} specialist(s) not functional - build them to execute this campaign`);
    }

    // Budget recommendations
    if (analysis.budget === 'Unspecified') {
      recommendations.push('Define budget for paid promotion - organic reach alone may not achieve goals');
    }

    // SEO integration recommendation
    if (strategy.seoKeywords.length > 0) {
      recommendations.push(`SEO Integration: Incorporate keywords (${strategy.seoKeywords.slice(0, 2).join(', ')}) naturally in all content`);
    }

    // Platform-specific recommendations
    if (strategy.platforms.includes('TIKTOK')) {
      recommendations.push('TikTok: Focus on first 3 seconds - hook is everything for stopping the scroll');
    }
    if (strategy.platforms.includes('X')) {
      recommendations.push('X/Twitter: Engage in replies and build conversations - algorithm rewards genuine interaction');
    }
    if (strategy.platforms.includes('FACEBOOK')) {
      recommendations.push('Facebook: Set up retargeting pixel early - warm audiences convert significantly better');
    }
    if (strategy.platforms.includes('LINKEDIN')) {
      recommendations.push('LinkedIn: Focus on value-first content - educational posts outperform promotional ones');
    }
    if (strategy.platforms.includes('YOUTUBE')) {
      recommendations.push('YouTube: Optimize title and thumbnail together - they are the primary click drivers in search and suggested');
    }
    if (strategy.platforms.includes('INSTAGRAM')) {
      recommendations.push('Instagram: Reels get 2x the reach of static posts - prioritize short-form video for discovery');
    }
    if (strategy.platforms.includes('PINTEREST')) {
      recommendations.push('Pinterest: Pin content 2-3 months before the season - Pinterest users plan ahead');
    }

    // Cross-platform recommendations
    if (strategy.platforms.length > 1) {
      recommendations.push('Cross-platform: Adapt content format for each platform while maintaining consistent messaging');
      recommendations.push('Timing: Stagger posts by 2-4 hours to maximize reach without audience overlap fatigue');
    }

    // Objective-specific recommendations
    if (analysis.objective === 'conversions') {
      recommendations.push('Conversions: Ensure landing pages are optimized and tracking pixels are installed');
    } else if (analysis.objective === 'leads') {
      recommendations.push('Lead generation: Use platform-native forms where possible - reduces friction');
    } else if (analysis.objective === 'awareness') {
      recommendations.push('Awareness: Track brand search volume as lagging indicator of campaign success');
    } else if (analysis.objective === 'retention') {
      recommendations.push('Retention: Focus on community building and consistent value delivery');
    }

    return recommendations.slice(0, 7);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(delegations: DelegationResult[], expectedSpecialists: number): number {
    let score = 0;
    const maxScore = 100;

    // Delegation success rate (50 points)
    const completedCount = delegations.filter(d => d.status === 'COMPLETED').length;
    const successRate = delegations.length > 0 ? completedCount / delegations.length : 0;
    score += successRate * 50;

    // Specialist coverage (30 points)
    const coverageRatio = expectedSpecialists > 0 ? delegations.length / expectedSpecialists : 0;
    score += Math.min(coverageRatio, 1) * 30;

    // No failures (20 points)
    const failedCount = delegations.filter(d => d.status === 'FAILED').length;
    const noFailures = failedCount === 0 ? 1 : Math.max(0, 1 - failedCount / delegations.length);
    score += noFailures * 20;

    return Math.round((score / maxScore) * 100) / 100;
  }

  // ==========================================================================
  // CROSS-PLATFORM COORDINATION
  // ==========================================================================

  /**
   * Generate cross-platform recommendations based on all specialist outputs
   */
  private generateCrossPlatformRecommendations(
    delegations: DelegationResult[],
    brandContext: BrandContext,
    seoGuidance: SEOKeywordGuidance | null
  ): string[] {
    const recommendations: string[] = [];
    const completedPlatforms = delegations
      .filter(d => d.status === 'COMPLETED')
      .map(d => d.specialist);

    // Cross-platform timing
    if (completedPlatforms.length > 1) {
      recommendations.push(
        'Stagger content across platforms by 2-4 hours to maximize reach without audience fatigue'
      );
    }

    // SEO-social integration
    if (seoGuidance && seoGuidance.primaryKeywords.length > 0) {
      recommendations.push(
        `Use primary keywords (${seoGuidance.primaryKeywords.slice(0, 2).join(', ')}) consistently across all platforms`
      );
    }

    // Brand voice consistency
    if (brandContext.toneOfVoice) {
      recommendations.push(
        `Maintain ${brandContext.toneOfVoice} tone across all platforms - adapt format, not voice`
      );
    }

    // Platform-specific coordination
    if (completedPlatforms.includes('TIKTOK_EXPERT') && completedPlatforms.includes('TWITTER_X_EXPERT')) {
      recommendations.push(
        'Repurpose TikTok video highlights as Twitter/X clips with thread context'
      );
    }

    if (completedPlatforms.includes('LINKEDIN_EXPERT') && completedPlatforms.includes('FACEBOOK_ADS_EXPERT')) {
      recommendations.push(
        'Use LinkedIn for organic B2B reach, Facebook for paid retargeting of engaged audiences'
      );
    }

    // Key phrases reinforcement
    if (brandContext.keyPhrases.length > 0) {
      recommendations.push(
        `Reinforce brand phrases across platforms: "${brandContext.keyPhrases[0]}"`
      );
    }

    // Competitor differentiation
    if (brandContext.competitors.length > 0) {
      recommendations.push(
        'Position content to differentiate from competitors without direct mentions'
      );
    }

    return recommendations.slice(0, 8);
  }

  // ==========================================================================
  // MEMORY VAULT INTEGRATION
  // ==========================================================================

  /**
   * Store campaign insights in MemoryVault for cross-agent learning
   */
  private async storeCampaignInsights(
    campaignBrief: CampaignBrief
  ): Promise<void> {
    try {
      const vault = getMemoryVault();

      // Store campaign brief as STRATEGY entry
      vault.write(
        'STRATEGY',
        `campaign_brief_${campaignBrief.briefId}`,
        campaignBrief,
        this.identity.id,
        {
          priority: 'HIGH',
          tags: ['marketing', 'campaign', campaignBrief.detectedIntent],
        }
      );

      // Share key findings as INSIGHT for other agents
      const insight: InsightData = {
        type: 'CONTENT',
        title: `Campaign Strategy: ${campaignBrief.campaignGoal.objective}`,
        summary: campaignBrief.aggregatedPlan.overview,
        confidence: Math.round(campaignBrief.confidence * 100),
        sources: campaignBrief.delegations.map(d => d.specialist),
        relatedAgents: ['JASPER', 'CONTENT_MANAGER', 'REVENUE_DIRECTOR'],
        actionable: true,
        recommendedActions: campaignBrief.crossPlatformRecommendations.slice(0, 3),
      };

      await shareInsight(
        this.identity.id,
        insight.type,
        insight.title,
        insight.summary,
        {
          confidence: insight.confidence,
          sources: insight.sources,
          relatedAgents: insight.relatedAgents,
          actions: insight.recommendedActions,
          tags: ['marketing', 'campaign', 'strategy'],
        }
      );

      this.log('INFO', `Campaign insights stored for organization ${PLATFORM_ID}`);
    } catch (error) {
      this.log('ERROR', `Failed to store campaign insights: ${error instanceof Error ? error.message : String(error)}`);
      // Non-fatal - don't throw
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createMarketingManager(): MarketingManager {
  return new MarketingManager();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: MarketingManager | null = null;

export function getMarketingManager(): MarketingManager {
  instance ??= createMarketingManager();
  return instance;
}
