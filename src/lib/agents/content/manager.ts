/**
 * Content Manager (L2 Orchestrator)
 * STATUS: FUNCTIONAL
 *
 * Multi-Modal Production Commander - Transforms TechnicalBrief from Architect
 * into production-ready content packages across all modalities (copy, video, visuals).
 *
 * ARCHITECTURE:
 * - Dynamic specialist resolution via SwarmRegistry pattern
 * - Brand DNA integration for tone/voice consistency
 * - TechnicalBrief consumption from ARCHITECT_MANAGER
 * - SEO keyword injection from seoMandates
 * - Parallel specialist execution with graceful degradation
 * - Content validation against Brand DNA "Avoid Phrases"
 *
 * SPECIALISTS ORCHESTRATED:
 * - COPYWRITER: Headlines, ad copy, landing pages, product descriptions
 * - CALENDAR_COORDINATOR: Content scheduling and cross-platform timing
 * - VIDEO_SPECIALIST: Scripts, storyboards, video SEO
 * - ASSET_GENERATOR: Brand visuals, social graphics (from builder domain)
 * - MUSIC_PLANNER: Soundtrack planning, music style recommendations, audio creative direction
 *
 * WORKFLOW:
 * 1. Receive TechnicalBrief via site.blueprint_ready signal
 * 2. Load Brand DNA (toneOfVoice, avoidPhrases, keyPhrases)
 * 3. Extract SEO mandates from TechnicalBrief
 * 4. Delegate to specialists in parallel with SEO context
 * 5. Synthesize into ContentPackage JSON
 * 6. Validate against avoidPhrases
 * 7. Broadcast content.package_ready signal
 *
 * @module agents/content/manager
 */

import { BaseManager } from '../base-manager';
import type { AgentMessage, AgentReport, ManagerConfig, Signal } from '../types';
import { getCopywriter } from './copywriter/specialist';
import { getBlogWriter, type BlogPostResult } from './blog/specialist';
import { getCalendarCoordinator } from './calendar/specialist';
import { VideoSpecialist } from './video/specialist';
import { getAssetGenerator } from '../builder/assets/specialist';
import { getMusicPlanner, type SoundtrackPlanResult } from './music/specialist';
import { getPodcastSpecialist, type EpisodePlanResult } from './podcast/specialist';
import {
  shareInsight,
  broadcastSignal,
  readAgentInsights,
} from '../shared/memory-vault';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import { logger } from '@/lib/logger/logger';
import type { TechnicalBrief, PageSEORequirements } from '../architect/manager';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

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
// SYSTEM PROMPT - Multi-Modal Content Production Orchestration
// ============================================================================

const SYSTEM_PROMPT = `You are the Content Manager, an L2 orchestrator for multi-modal content production.

## YOUR ROLE
You transform architectural blueprints into production-ready content packages. You coordinate specialists
to generate SEO-optimized copy, brand-aligned imagery, video scripts, and structured metadata.

SPECIALISTS YOU ORCHESTRATE:
- COPYWRITER: Headlines (H1-H6), product descriptions, email copy, ad copy, landing pages
- CALENDAR_COORDINATOR: Content scheduling, optimal timing, cross-platform coordination
- VIDEO_SPECIALIST: Script-to-storyboard, audio cues, video SEO, thumbnail strategy
- ASSET_GENERATOR: Logos, banners, social graphics, brand visuals
- MUSIC_PLANNER: Soundtrack planning, music style profiles, audio creative direction
- PODCAST_SPECIALIST: Episode planning, show notes, interview questions, segment outlines

## CONTENT PRODUCTION FLOW
1. RECEIVE: TechnicalBrief from ARCHITECT_MANAGER (site.blueprint_ready signal)
2. LOAD: Brand DNA (toneOfVoice, avoidPhrases, keyPhrases, colorPalette)
3. EXTRACT: SEO mandates from TechnicalBrief (keywords, meta templates)
4. DELEGATE: Parallel execution to specialists with brand + SEO context
5. SYNTHESIZE: Merge outputs into ContentPackage JSON
6. VALIDATE: Check all copy against avoidPhrases
7. BROADCAST: content.package_ready signal for BUILDER_MANAGER

## SEO-COPY INTEGRATION
Before generating any copy:
1. Extract target keywords from TechnicalBrief.seoMandates
2. Inject keywords into COPYWRITER briefs
3. Ensure H1-H6 hierarchy follows SEO best practices
4. Meta descriptions include primary keywords naturally

## VISUAL CONTINUITY
When coordinating ASSET_GENERATOR:
1. Extract brand colors from Brand DNA
2. Pass hex-code palette with every visual request
3. Ensure consistent styling across all assets
4. Generate platform-specific dimensions

## OUTPUT: ContentPackage
Your output is a comprehensive JSON structure containing:
- pageContent: H1-H6 headlines, body copy, CTAs per page
- metadata: Title tags, meta descriptions, OG tags, structured data
- visuals: Asset URLs, alt-text, platform-specific variants
- videoContent: Storyboards, scripts, thumbnails (if applicable)
- socialSnippets: Platform-specific promotional copy
- calendar: Recommended publishing schedule

## CONTENT VALIDATION RULES
Before marking content READY:
1. Check ALL copy against avoidPhrases list
2. Verify toneOfVoice consistency
3. Confirm keyword density targets
4. Validate character limits for meta content
5. Ensure alt-text is descriptive and accessible`;

// ============================================================================
// CONTENT INTENT DETECTION
// ============================================================================

/**
 * Content production intents that determine specialist activation
 */
export type ContentIntent =
  | 'FULL_PACKAGE'         // All specialists for complete content package
  | 'COPY_ONLY'            // Copywriter for text content
  | 'VISUAL_ONLY'          // Asset generation only
  | 'VIDEO_PRODUCTION'     // Video specialist focus
  | 'PODCAST_PRODUCTION'   // Podcast specialist focus
  | 'BLOG_CONTENT'         // Blog Writer for long-form SEO content
  | 'SCHEDULING'           // Calendar coordination
  | 'SEO_REFRESH'          // Update existing content for SEO
  | 'SINGLE_PAGE';         // Content for one specific page

/**
 * Keywords that indicate content intents (reserved for future intent detection)
 */
const _INTENT_KEYWORDS: Record<ContentIntent, string[]> = {
  FULL_PACKAGE: [
    'full content', 'complete package', 'all pages', 'website content',
    'launch package', 'comprehensive', 'everything',
  ],
  COPY_ONLY: [
    'copy', 'headline', 'text', 'write', 'blog', 'article', 'description',
    'landing page copy', 'email', 'ad copy',
  ],
  VISUAL_ONLY: [
    'visual', 'image', 'graphic', 'banner', 'logo', 'asset', 'social graphic',
    'thumbnail', 'favicon',
  ],
  VIDEO_PRODUCTION: [
    'video', 'storyboard', 'script', 'youtube', 'tiktok', 'reel', 'short',
    'b-roll', 'thumbnail',
  ],
  PODCAST_PRODUCTION: [
    'podcast', 'episode', 'show notes', 'interview questions', 'episode plan',
    'segment outline', 'intro script', 'outro script', 'guest research',
  ],
  BLOG_CONTENT: [
    'blog', 'blog post', 'long-form', 'thought leadership', 'editorial',
    'seo article', 'pillar content', 'content marketing',
  ],
  SCHEDULING: [
    'schedule', 'calendar', 'publish', 'timing', 'when to post', 'optimal time',
    'content calendar',
  ],
  SEO_REFRESH: [
    'seo', 'optimize', 'keywords', 'meta', 'search', 'ranking', 'refresh',
  ],
  SINGLE_PAGE: [], // Detected via explicit page mention
};

/**
 * Specialist mapping by intent
 */
const INTENT_SPECIALISTS: Record<ContentIntent, string[]> = {
  FULL_PACKAGE: ['COPYWRITER', 'BLOG_WRITER', 'CALENDAR_COORDINATOR', 'VIDEO_SPECIALIST', 'ASSET_GENERATOR', 'MUSIC_PLANNER'],
  COPY_ONLY: ['COPYWRITER'],
  BLOG_CONTENT: ['BLOG_WRITER'],
  VISUAL_ONLY: ['ASSET_GENERATOR'],
  VIDEO_PRODUCTION: ['VIDEO_SPECIALIST', 'COPYWRITER', 'MUSIC_PLANNER'],
  PODCAST_PRODUCTION: ['PODCAST_SPECIALIST'],
  SCHEDULING: ['CALENDAR_COORDINATOR'],
  SEO_REFRESH: ['COPYWRITER', 'BLOG_WRITER'],
  SINGLE_PAGE: ['COPYWRITER', 'ASSET_GENERATOR'],
};

// ============================================================================
// CONFIGURATION - Multi-Modal Content Production
// ============================================================================

const CONTENT_MANAGER_CONFIG: ManagerConfig = {
  identity: {
    id: 'CONTENT_MANAGER',
    name: 'Content Manager',
    role: 'manager',
    status: 'FUNCTIONAL',
    reportsTo: 'JASPER',
    capabilities: [
      'content_strategy',
      'copywriting_coordination',
      'editorial_calendar',
      'visual_asset_coordination',
      'video_production_planning',
      'seo_content_integration',
      'brand_voice_enforcement',
      'multi_modal_synthesis',
      'content_validation',
      'soundtrack_planning',
      'podcast_planning',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['delegate', 'coordinate', 'validate_content', 'review_content', 'schedule_publish'],
  outputSchema: {
    type: 'object',
    properties: {
      contentPackage: { type: 'object' },
      brandContext: { type: 'object' },
      seoContext: { type: 'object' },
      delegations: { type: 'array' },
      validation: { type: 'object' },
      confidence: { type: 'number' },
    },
    required: ['contentPackage', 'delegations'],
  },
  maxTokens: 8192,
  temperature: 0.4,
  specialists: ['COPYWRITER', 'BLOG_WRITER', 'CALENDAR_COORDINATOR', 'VIDEO_SPECIALIST', 'ASSET_GENERATOR', 'MUSIC_PLANNER', 'PODCAST_SPECIALIST'],
  delegationRules: [
    // Copywriter - Short-form text content
    {
      triggerKeywords: ['copy', 'headline', 'write', 'content', 'description', 'email', 'ad'],
      delegateTo: 'COPYWRITER',
      priority: 10,
      requiresApproval: false,
    },
    // Blog Writer - Long-form SEO blog content
    {
      triggerKeywords: ['blog', 'blog post', 'article', 'long-form', 'thought leadership', 'editorial', 'seo article', 'pillar content'],
      delegateTo: 'BLOG_WRITER',
      priority: 15,
      requiresApproval: false,
    },
    // Calendar - Scheduling
    {
      triggerKeywords: ['calendar', 'schedule', 'publish', 'deadline', 'editorial', 'timing', 'when'],
      delegateTo: 'CALENDAR_COORDINATOR',
      priority: 10,
      requiresApproval: false,
    },
    // Video - Video content
    {
      triggerKeywords: ['video', 'storyboard', 'script', 'youtube', 'tiktok', 'reel', 'short', 'thumbnail'],
      delegateTo: 'VIDEO_SPECIALIST',
      priority: 10,
      requiresApproval: false,
    },
    // Asset Generator - Visual content
    {
      triggerKeywords: ['image', 'graphic', 'banner', 'logo', 'asset', 'visual', 'favicon', 'social graphic'],
      delegateTo: 'ASSET_GENERATOR',
      priority: 10,
      requiresApproval: false,
    },
    // Music Planner - Soundtrack and audio direction
    {
      triggerKeywords: ['music', 'soundtrack', 'audio', 'score', 'jingle', 'sound design', 'tempo', 'bpm', 'instrumentation'],
      delegateTo: 'MUSIC_PLANNER',
      priority: 10,
      requiresApproval: false,
    },
    // Podcast Specialist - Podcast content planning
    {
      triggerKeywords: ['podcast', 'episode', 'show notes', 'interview questions', 'episode plan', 'segment outline', 'guest research'],
      delegateTo: 'PODCAST_SPECIALIST',
      priority: 10,
      requiresApproval: false,
    },
  ],
};

// ============================================================================
// TYPE DEFINITIONS - Content Production Types
// ============================================================================

/**
 * Brand context loaded from MemoryVault
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
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
  };
  loaded: boolean;
}

/**
 * SEO context extracted from TechnicalBrief
 */
export interface SEOContext {
  sitewide: {
    titleSuffix: string;
    defaultDescription: string;
    primaryKeywords: string[];
  };
  perPage: Record<string, PageSEORequirements>;
  technicalRequirements: string[];
}

/**
 * Page content structure
 */
export interface PageContent {
  pageId: string;
  pageName: string;
  path: string;
  headlines: {
    h1: string;
    h2: string[];
    h3: string[];
    h4?: string[];
    h5?: string[];
    h6?: string[];
  };
  bodyCopy: {
    sections: Array<{
      sectionId: string;
      heading: string;
      content: string;
      cta?: string;
    }>;
  };
  metadata: {
    title: string;
    description: string;
    keywords: string[];
    ogTitle: string;
    ogDescription: string;
    ogImage?: string;
    twitterCard?: string;
    structuredData?: Record<string, unknown>;
  };
  visuals: Array<{
    assetId: string;
    type: 'hero' | 'feature' | 'testimonial' | 'cta' | 'icon';
    url?: string;
    altText: string;
    dimensions: { width: number; height: number };
  }>;
}

/**
 * Social media snippets
 */
export interface SocialSnippets {
  twitter: Array<{ text: string; hashtags: string[]; characterCount: number }>;
  linkedin: Array<{ text: string; format: 'post' | 'article' | 'document' }>;
  instagram: Array<{ caption: string; hashtags: string[] }>;
  tiktok: Array<{ hook: string; script: string; hashtags: string[] }>;
  facebook: Array<{ text: string; cta: string }>;
}

/**
 * Video content package
 */
export interface VideoContent {
  videos: Array<{
    videoId: string;
    platform: 'youtube' | 'tiktok' | 'reels' | 'shorts';
    title: string;
    script: string;
    storyboard?: unknown;
    thumbnailConcept: string;
    seo: {
      title: string;
      description: string;
      tags: string[];
    };
  }>;
}

/**
 * Content calendar recommendation
 */
export interface ContentCalendar {
  schedule: Array<{
    contentId: string;
    platform: string;
    suggestedDate: string;
    suggestedTime: string;
    rationale: string;
  }>;
  frequencyRecommendation: Record<string, string>;
}

/**
 * The complete ContentPackage output
 */
export interface ContentPackage {
  packageId: string;
  blueprintId?: string;
  createdAt: Date;
  completedAt: Date;

  // Input context
  brandContext: BrandContext;
  seoContext: SEOContext;
  detectedIntent: ContentIntent;

  // Content outputs
  pageContent: PageContent[];
  socialSnippets: SocialSnippets;
  videoContent: VideoContent | null;
  calendar: ContentCalendar | null;
  blogContent: BlogPostResult | null;
  musicContent: SoundtrackPlanResult | null;
  podcastContent: EpisodePlanResult | null;

  // Validation
  validation: {
    passed: boolean;
    avoidPhraseViolations: Array<{ phrase: string; location: string }>;
    toneConsistency: number;
    seoScore: number;
    accessibilityScore: number;
  };

  // Specialist outputs
  delegations: DelegationResult[];
  specialistOutputs: {
    copywriter: unknown;
    calendar: unknown;
    video: unknown;
    assets: unknown;
    blog: unknown;
    music: unknown;
    podcast: unknown;
  };

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
 * Delegation result
 */
export interface DelegationResult {
  specialist: string;
  brief: string;
  status: 'COMPLETED' | 'BLOCKED' | 'PENDING' | 'FAILED';
  result: unknown;
  executionTimeMs?: number;
}

/**
 * Prospect context for personalized artifact generation (Phase 7)
 */
export interface ProspectContext {
  leadId: string;
  companyName: string;
  companyUrl?: string;
  industry?: string;
  contactName?: string;
  contactEmail: string;
  techStack?: string[];
  painPoints?: string[];
  companySize?: string;
  requestedInfo?: string[];
  scraperData?: Record<string, unknown>;
}

/**
 * Result from contextual artifact generation (Phase 7)
 */
export interface ArtifactGenerationResult {
  leadId: string;
  artifacts: {
    video?: {
      videoId: string;
      platform: string;
      status: 'GENERATED' | 'FAILED';
      script?: string;
      storyboard?: unknown;
    };
    proposal?: {
      proposalId: string;
      status: 'GENERATED' | 'FAILED';
      sections?: string[];
    };
  };
  totalArtifacts: number;
  successfulArtifacts: number;
  generatedAt: Date;
}

/**
 * Content request payload
 */
export interface ContentRequest {
  blueprintId?: string;
  technicalBrief?: TechnicalBrief;
  pages?: string[];
  contentTypes?: ('copy' | 'visuals' | 'video' | 'social')[];
  /**
   * Singular content type sent by Jasper's `delegate_to_content` tool. Free-form
   * string like 'blog_post', 'video', 'podcast', 'email', etc. When present,
   * this takes precedence over `contentTypes` in intent detection so a request
   * for a single blog post doesn't accidentally fire all 6 content specialists.
   */
  contentType?: string;
  topic?: string;
  audience?: string;
  seoKeywords?: string;
  format?: string;
  urgency?: 'low' | 'medium' | 'high';
  targetPlatforms?: string[];
}

// ============================================================================
// IMPLEMENTATION - Multi-Modal Content Production Commander
// ============================================================================

export class ContentManager extends BaseManager {
  private specialistsRegistered = false;
  private brandContextCache: Map<string, BrandContext> = new Map();

  constructor() {
    super(CONTENT_MANAGER_CONFIG);
  }

  /**
   * Initialize and register all content specialists dynamically
   */
  async initialize(): Promise<void> {
    this.log('INFO', 'Initializing Content Manager (Multi-Modal Production Mode)...');

    // Dynamically register all specialists via SwarmRegistry pattern
    await this.registerAllSpecialists();

    this.isInitialized = true;
    this.log('INFO', `Content Manager initialized with ${this.specialists.size} specialists`);
  }

  /**
   * Register specialists from their factory functions (SwarmRegistry pattern)
   */
  private async registerAllSpecialists(): Promise<void> {
    if (this.specialistsRegistered) {
      return;
    }

    const specialistFactories = [
      { name: 'COPYWRITER', factory: getCopywriter },
      { name: 'BLOG_WRITER', factory: getBlogWriter },
      { name: 'CALENDAR_COORDINATOR', factory: getCalendarCoordinator },
      { name: 'VIDEO_SPECIALIST', factory: () => new VideoSpecialist() },
      { name: 'ASSET_GENERATOR', factory: getAssetGenerator },
      { name: 'MUSIC_PLANNER', factory: getMusicPlanner },
      { name: 'PODCAST_SPECIALIST', factory: getPodcastSpecialist },
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
   * Main execution entry point - orchestrates multi-modal content production
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    const startTime = Date.now();

    // Ensure specialists are registered
    if (!this.specialistsRegistered) {
      await this.registerAllSpecialists();
    }

    try {
      const payload = message.payload as ContentRequest;

      this.log('INFO', `Processing content request for organization: ${PLATFORM_ID}`);

      // Execute full content orchestration
      const contentPackage = await this.orchestrateContentProduction(payload, taskId, startTime);

      // Store insights in MemoryVault for cross-agent learning
      await this.storeContentInsights(contentPackage);

      // Broadcast content.package_ready signal if validation passed
      if (contentPackage.validation.passed) {
        await this.broadcastContentReady(contentPackage);
      }

      return this.createReport(taskId, 'COMPLETED', contentPackage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Content production failed: ${errorMessage}`);
      logger.error('[ContentManager] Orchestration failed', error instanceof Error ? error : new Error(errorMessage));
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Handle signals from the Signal Bus (e.g., site.blueprint_ready)
   */
  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;

    // The signal payload is an AgentMessage - check its payload for signal data
    const messagePayload = signal.payload?.payload as Record<string, unknown> | undefined;

    // Handle site.blueprint_ready signal from ARCHITECT_MANAGER
    if (messagePayload?.signalType === 'site.blueprint_ready') {
      this.log('INFO', 'Received site.blueprint_ready signal - initiating content production');

      const blueprintPayload = messagePayload.payload as {
        blueprintId?: string;
        technicalBriefId?: string;
      } | undefined;

      // Fetch the full architecture from vault
      const architecture = await this.fetchArchitectureFromVault(
        blueprintPayload?.blueprintId
      );

      const contentRequest: ContentRequest = {
        blueprintId: blueprintPayload?.blueprintId,
        technicalBrief: architecture?.technicalBrief,
      };

      // Create a proper AgentMessage from the request
      const contentMessage: AgentMessage = {
        id: taskId,
        type: 'COMMAND',
        from: this.identity.id,
        to: this.identity.id,
        payload: contentRequest,
        timestamp: new Date(),
        priority: 'HIGH',
        requiresResponse: true,
        traceId: taskId,
      };

      return this.execute(contentMessage);
    }

    // Handle GENERATE_PROSPECT_ASSETS from Event Router (Phase 7)
    const commandPayload = signal.payload?.payload as Record<string, unknown> | undefined;
    if (commandPayload?.command === 'GENERATE_PROSPECT_ASSETS' ||
        (signal.payload?.type === 'COMMAND' && commandPayload?.command === 'GENERATE_PROSPECT_ASSETS')) {
      const prospectContext: ProspectContext = {
        leadId: (commandPayload.leadId as string) ?? 'unknown',
        companyName: (commandPayload.companyName as string) ?? 'Prospect Company',
        companyUrl: commandPayload.companyUrl as string | undefined,
        industry: commandPayload.industry as string | undefined,
        contactName: commandPayload.contactName as string | undefined,
        contactEmail: (commandPayload.prospectEmail as string) ?? (commandPayload.contactEmail as string) ?? '',
        techStack: commandPayload.techStack as string[] | undefined,
        painPoints: commandPayload.painPoints as string[] | undefined,
        requestedInfo: commandPayload.requestedInfo as string[] | undefined,
        scraperData: commandPayload.scraperData as Record<string, unknown> | undefined,
      };

      const result = await this.handleContextualArtifactGeneration(prospectContext);
      return this.createReport(taskId, result.successfulArtifacts > 0 ? 'COMPLETED' : 'FAILED', result);
    }

    if (signal.payload?.type === 'COMMAND') {
      return this.execute(signal.payload);
    }

    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
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
    return { functional: 900, boilerplate: 150 };
  }

  // ==========================================================================
  // BRAND DNA INTEGRATION - Runtime Brand Context
  // ==========================================================================

  /**
   * Load Brand DNA from MemoryVault for brand-consistent content
   */
  private async loadBrandContext(): Promise<BrandContext> {
    // Check cache first
    if (this.brandContextCache.has(PLATFORM_ID)) {
      const cached = this.brandContextCache.get(PLATFORM_ID);
      if (cached) {
        return cached;
      }
    }

    try {
      const brandDNA = await getBrandDNA();

      if (!brandDNA) {
        this.log('WARN', `No Brand DNA found for org ${PLATFORM_ID}, using defaults`);
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
        colorPalette: {
          primary: '#2563eb', // Default primary color (primaryColor removed from BrandDNA)
          secondary: '#7c3aed',
          accent: '#f59e0b',
          neutral: '#6b7280',
        },
        loaded: true,
      };

      // Cache for performance
      this.brandContextCache.set(PLATFORM_ID, brandContext);
      this.log('INFO', `Loaded Brand DNA for org ${PLATFORM_ID} (Industry: ${brandContext.industry})`);

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
      colorPalette: {
        primary: '#2563eb',
        secondary: '#7c3aed',
        accent: '#f59e0b',
        neutral: '#6b7280',
      },
      loaded: false,
    };
  }

  // ==========================================================================
  // SEO CONTEXT EXTRACTION
  // ==========================================================================

  /**
   * Extract SEO context from TechnicalBrief
   */
  private extractSEOContext(technicalBrief: TechnicalBrief | undefined): SEOContext {
    if (!technicalBrief?.seoMandates) {
      return this.createDefaultSEOContext();
    }

    const mandates = technicalBrief.seoMandates;

    return {
      sitewide: {
        titleSuffix: ' | Brand',
        defaultDescription: 'Welcome to our platform',
        primaryKeywords: mandates.technicalRequirements ?? [],
      },
      perPage: mandates.perPage ?? {},
      technicalRequirements: mandates.technicalRequirements ?? [],
    };
  }

  /**
   * Create default SEO context
   */
  private createDefaultSEOContext(): SEOContext {
    return {
      sitewide: {
        titleSuffix: ' | Brand',
        defaultDescription: 'Welcome to our platform',
        primaryKeywords: [],
      },
      perPage: {},
      technicalRequirements: [
        'Semantic HTML structure',
        'Mobile-first responsive design',
        'Core Web Vitals optimization',
      ],
    };
  }

  // ==========================================================================
  // CONTENT INTENT DETECTION
  // ==========================================================================

  /**
   * Detect content intent from the request
   */
  private detectContentIntent(request: ContentRequest): ContentIntent {
    // Jasper's singular contentType takes precedence — a request that
    // explicitly names ONE content type must not fan out to all 6 specialists.
    if (typeof request.contentType === 'string' && request.contentType.length > 0) {
      const ct = request.contentType.toLowerCase().trim();
      if (ct.includes('blog') || ct === 'article' || ct === 'pillar') {return 'BLOG_CONTENT';}
      if (ct === 'video' || ct === 'reel' || ct === 'short' || ct === 'youtube' || ct === 'tiktok') {return 'VIDEO_PRODUCTION';}
      if (ct === 'podcast' || ct === 'episode') {return 'PODCAST_PRODUCTION';}
      if (ct === 'visuals' || ct === 'image' || ct === 'asset' || ct === 'graphic' || ct === 'banner') {return 'VISUAL_ONLY';}
      if (ct === 'copy' || ct === 'headline' || ct === 'email' || ct === 'ad' || ct === 'social_post') {return 'COPY_ONLY';}
      if (ct === 'calendar' || ct === 'schedule') {return 'SCHEDULING';}
      if (ct === 'seo_refresh' || ct === 'seo') {return 'SEO_REFRESH';}
      // Unrecognized singular type — fall through to legacy paths below.
    }

    // Check for explicit content types
    if (request.contentTypes) {
      if (request.contentTypes.length === 1) {
        switch (request.contentTypes[0]) {
          case 'copy': return 'COPY_ONLY';
          case 'visuals': return 'VISUAL_ONLY';
          case 'video': return 'VIDEO_PRODUCTION';
          case 'social': return 'COPY_ONLY';
        }
      }
      return 'FULL_PACKAGE';
    }

    // Check for single page request
    if (request.pages?.length === 1) {
      return 'SINGLE_PAGE';
    }

    // Default to full package for blueprint-triggered requests
    if (request.blueprintId || request.technicalBrief) {
      return 'FULL_PACKAGE';
    }

    return 'FULL_PACKAGE';
  }

  /**
   * Resolve which specialists to activate based on intent
   */
  private resolveSpecialistsForIntent(intent: ContentIntent): string[] {
    const requiredSpecialists = INTENT_SPECIALISTS[intent] ?? INTENT_SPECIALISTS.FULL_PACKAGE;

    // Filter to only functional specialists
    return requiredSpecialists.filter(id => {
      const specialist = this.specialists.get(id);
      return specialist?.isFunctional();
    });
  }

  // ==========================================================================
  // CORE CONTENT ORCHESTRATION
  // ==========================================================================

  /**
   * Main content orchestration function
   */
  private async orchestrateContentProduction(
    request: ContentRequest,
    taskId: string,
    startTime: number
  ): Promise<ContentPackage> {
    const warnings: string[] = [];
    const delegations: DelegationResult[] = [];
    const specialistOutputs: ContentPackage['specialistOutputs'] = {
      copywriter: null,
      calendar: null,
      video: null,
      blog: null,
      music: null,
      podcast: null,
      assets: null,
    };

    // Step 1: Load Brand DNA
    const brandContext = await this.loadBrandContext();
    this.log('INFO', `Brand context loaded (Tone: ${brandContext.toneOfVoice})`);

    // Step 2: Extract SEO context from TechnicalBrief
    const seoContext = this.extractSEOContext(request.technicalBrief);
    this.log('INFO', `SEO context extracted (${Object.keys(seoContext.perPage).length} pages)`);

    // Step 3: Detect content intent
    const detectedIntent = this.detectContentIntent(request);
    this.log('INFO', `Detected content intent: ${detectedIntent}`);

    // Step 4: Resolve specialists for this intent
    const specialistIds = this.resolveSpecialistsForIntent(detectedIntent);
    this.log('INFO', `Activating specialists: ${specialistIds.join(', ')}`);

    // Step 5: Delegate to specialists in parallel
    const pageContent = await this.delegateToSpecialists(
      request,
      brandContext,
      seoContext,
      specialistIds,
      taskId,
      delegations,
      specialistOutputs,
      warnings
    );

    // Step 6: Generate social snippets
    const socialSnippets = this.generateSocialSnippets(pageContent, brandContext);

    // Step 7: Get video content if applicable
    let videoContent: VideoContent | null = null;
    if (specialistIds.includes('VIDEO_SPECIALIST')) {
      videoContent = await this.generateVideoContent(
        request,
        brandContext,
        taskId,
        delegations,
        specialistOutputs
      );
    }

    // Step 8: Get calendar recommendations if applicable
    let calendar: ContentCalendar | null = null;
    if (specialistIds.includes('CALENDAR_COORDINATOR')) {
      calendar = await this.generateContentCalendar(
        pageContent,
        request.targetPlatforms ?? [],
        taskId,
        delegations,
        specialistOutputs
      );
    }

    // Step 8b: Get blog content if applicable
    let blogContent: BlogPostResult | null = null;
    if (specialistIds.includes('BLOG_WRITER')) {
      blogContent = await this.generateBlogContent(
        request,
        brandContext,
        seoContext,
        taskId,
        delegations,
        specialistOutputs,
      );
    }

    // Step 8c: Get music content if applicable
    let musicContent: SoundtrackPlanResult | null = null;
    if (specialistIds.includes('MUSIC_PLANNER')) {
      musicContent = await this.generateMusicContent(
        request,
        brandContext,
        taskId,
        delegations,
        specialistOutputs,
      );
    }

    // Step 8d: Get podcast content if applicable
    let podcastContent: EpisodePlanResult | null = null;
    if (specialistIds.includes('PODCAST_SPECIALIST')) {
      podcastContent = await this.generatePodcastContent(
        request,
        brandContext,
        taskId,
        delegations,
        specialistOutputs,
      );
    }

    // Step 9: Validate content against Brand DNA
    const validation = this.validateContent(pageContent, socialSnippets, brandContext, seoContext);
    this.log('INFO', `Content validation: ${validation.passed ? 'PASSED' : 'FAILED'}`);

    // Step 10: Calculate confidence
    const confidence = this.calculateConfidence(delegations, specialistIds.length, validation);

    const completedAt = new Date();
    const totalExecutionTimeMs = Date.now() - startTime;

    return {
      packageId: `content_${taskId}`,
      blueprintId: request.blueprintId,
      createdAt: new Date(startTime),
      completedAt,
      brandContext,
      seoContext,
      detectedIntent,
      pageContent,
      socialSnippets,
      videoContent,
      calendar,
      blogContent,
      musicContent,
      podcastContent,
      validation,
      delegations,
      specialistOutputs,
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

  /**
   * Delegate to content specialists in parallel
   */
  private async delegateToSpecialists(
    request: ContentRequest,
    brandContext: BrandContext,
    seoContext: SEOContext,
    specialistIds: string[],
    taskId: string,
    delegations: DelegationResult[],
    specialistOutputs: ContentPackage['specialistOutputs'],
    warnings: string[]
  ): Promise<PageContent[]> {
    const pageContent: PageContent[] = [];

    // Get page definitions from technical brief or create defaults
    const pages = this.extractPageDefinitions(request, seoContext);

    // Generate copy for each page via COPYWRITER
    if (specialistIds.includes('COPYWRITER')) {
      const copywriter = this.specialists.get('COPYWRITER');

      if (copywriter?.isFunctional()) {
        const copyPromises = pages.map(async (page) => {
          const startTime = Date.now();
          const pageSEO = seoContext.perPage[page.id] ?? {};

          try {
            const copyMessage: AgentMessage = {
              id: `${taskId}_copy_${page.id}`,
              type: 'COMMAND',
              from: this.identity.id,
              to: 'COPYWRITER',
              payload: {
                action: 'generate_page_copy',
                pageId: page.id,
                pageName: page.name,
                pagePurpose: page.purpose,
                sections: page.sections.map((s: string) => ({
                  id: s,
                  name: this.formatPageName(s),
                  purpose: `${this.formatPageName(s)} section content`,
                })),
                seoKeywords: pageSEO.keywordFocus ?? [],
                titleTemplate: pageSEO.titleTemplate,
                descriptionTemplate: pageSEO.descriptionTemplate,
                toneOfVoice: brandContext.toneOfVoice,
                keyPhrases: brandContext.keyPhrases,
                avoidPhrases: brandContext.avoidPhrases,
              },
              timestamp: new Date(),
              priority: 'HIGH',
              requiresResponse: true,
              traceId: taskId,
            };

            const report = await copywriter.execute(copyMessage);
            const executionTimeMs = Date.now() - startTime;

            delegations.push({
              specialist: 'COPYWRITER',
              brief: `Generate copy for ${page.name}`,
              status: report.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
              result: report.data,
              executionTimeMs,
            });

            if (report.status === 'COMPLETED' && report.data) {
              const copyData = report.data as {
                headlines?: { h1?: string; h2?: string[]; h3?: string[] };
                sections?: Array<{ sectionId: string; heading: string; content: string; cta?: string }>;
                metadata?: { title?: string; description?: string };
              };

              return this.buildPageContent(page, copyData, pageSEO, brandContext);
            }
          } catch (error) {
            warnings.push(`Failed to generate copy for ${page.name}: ${error instanceof Error ? error.message : String(error)}`);
          }

          // Return fallback page content
          return this.buildFallbackPageContent(page, pageSEO, brandContext);
        });

        const copyResults = await Promise.allSettled(copyPromises);
        for (const result of copyResults) {
          if (result.status === 'fulfilled' && result.value) {
            pageContent.push(result.value);
          }
        }

        specialistOutputs.copywriter = pageContent;
      }
    }

    // Generate visual assets via ASSET_GENERATOR
    if (specialistIds.includes('ASSET_GENERATOR')) {
      await this.generateVisualAssets(
        pageContent,
        brandContext,
        taskId,
        delegations,
        specialistOutputs,
        warnings
      );
    }

    return pageContent;
  }

  /**
   * Extract page definitions from request or create defaults
   */
  private extractPageDefinitions(
    request: ContentRequest,
    seoContext: SEOContext
  ): Array<{ id: string; name: string; purpose: string; sections: string[] }> {
    // If specific pages requested
    if (request.pages?.length) {
      return request.pages.map(pageId => ({
        id: pageId,
        name: this.formatPageName(pageId),
        purpose: `Content for ${this.formatPageName(pageId)} page`,
        sections: ['hero', 'content', 'cta'],
      }));
    }

    // Extract from SEO context (which came from TechnicalBrief)
    if (Object.keys(seoContext.perPage).length > 0) {
      return Object.keys(seoContext.perPage).map(pageId => ({
        id: pageId,
        name: this.formatPageName(pageId),
        purpose: `Content for ${this.formatPageName(pageId)} page`,
        sections: this.inferPageSections(pageId),
      }));
    }

    // Default pages
    return [
      { id: 'homepage', name: 'Homepage', purpose: 'Main landing page', sections: ['hero', 'features', 'testimonials', 'cta'] },
      { id: 'about', name: 'About Us', purpose: 'Company information', sections: ['hero', 'story', 'team', 'values'] },
      { id: 'services', name: 'Services', purpose: 'Service offerings', sections: ['hero', 'services-grid', 'process', 'cta'] },
      { id: 'contact', name: 'Contact', purpose: 'Contact information', sections: ['hero', 'form', 'info', 'map'] },
    ];
  }

  /**
   * Format page ID to display name
   */
  private formatPageName(pageId: string): string {
    return pageId
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Infer page sections based on page type
   */
  private inferPageSections(pageId: string): string[] {
    const sectionMap: Record<string, string[]> = {
      homepage: ['hero', 'features', 'testimonials', 'cta'],
      about: ['hero', 'story', 'team', 'values'],
      services: ['hero', 'services-grid', 'process', 'cta'],
      pricing: ['hero', 'pricing-table', 'faq', 'cta'],
      contact: ['hero', 'form', 'info'],
      blog: ['hero', 'featured', 'categories', 'archive'],
    };

    return sectionMap[pageId.toLowerCase()] ?? ['hero', 'content', 'cta'];
  }

  /**
   * Build page content from copywriter output
   */
  private buildPageContent(
    page: { id: string; name: string; purpose: string; sections: string[] },
    copyData: {
      headlines?: { h1?: string; h2?: string[]; h3?: string[] };
      sections?: Array<{ sectionId: string; heading: string; content: string; cta?: string }>;
      metadata?: { title?: string; description?: string };
    },
    pageSEO: Partial<PageSEORequirements>,
    brandContext: BrandContext
  ): PageContent {
    return {
      pageId: page.id,
      pageName: page.name,
      path: `/${page.id === 'homepage' ? '' : page.id}`,
      headlines: {
        h1: copyData.headlines?.h1 ?? `Welcome to ${brandContext.companyDescription || 'Our Platform'}`,
        h2: copyData.headlines?.h2 ?? [],
        h3: copyData.headlines?.h3 ?? [],
      },
      bodyCopy: {
        sections: copyData.sections ?? page.sections.map((s, i) => ({
          sectionId: s,
          heading: `Section ${i + 1}`,
          content: '',
        })),
      },
      metadata: {
        title: copyData.metadata?.title ?? (pageSEO.titleTemplate?.replace('{brand_name}', brandContext.companyDescription) ?? page.name),
        description: copyData.metadata?.description ?? (pageSEO.descriptionTemplate?.replace('{brand_description}', brandContext.companyDescription) ?? page.purpose),
        keywords: pageSEO.keywordFocus ?? [],
        ogTitle: copyData.metadata?.title ?? page.name,
        ogDescription: copyData.metadata?.description ?? page.purpose,
      },
      visuals: [],
    };
  }

  /**
   * Build fallback page content when copywriter fails
   */
  private buildFallbackPageContent(
    page: { id: string; name: string; purpose: string; sections: string[] },
    pageSEO: Partial<PageSEORequirements>,
    brandContext: BrandContext
  ): PageContent {
    return {
      pageId: page.id,
      pageName: page.name,
      path: `/${page.id === 'homepage' ? '' : page.id}`,
      headlines: {
        h1: page.name,
        h2: [],
        h3: [],
      },
      bodyCopy: {
        sections: page.sections.map((s, i) => ({
          sectionId: s,
          heading: `Section ${i + 1}`,
          content: `[Content for ${s} section]`,
        })),
      },
      metadata: {
        title: pageSEO.titleTemplate?.replace('{brand_name}', brandContext.companyDescription) ?? page.name,
        description: pageSEO.descriptionTemplate?.replace('{brand_description}', brandContext.companyDescription) ?? page.purpose,
        keywords: pageSEO.keywordFocus ?? [],
        ogTitle: page.name,
        ogDescription: page.purpose,
      },
      visuals: [],
    };
  }

  /**
   * Generate visual assets for pages
   */
  private async generateVisualAssets(
    pageContent: PageContent[],
    brandContext: BrandContext,
    taskId: string,
    delegations: DelegationResult[],
    specialistOutputs: ContentPackage['specialistOutputs'],
    warnings: string[]
  ): Promise<void> {
    const assetGenerator = this.specialists.get('ASSET_GENERATOR');

    if (!assetGenerator?.isFunctional()) {
      warnings.push('ASSET_GENERATOR not functional, skipping visual generation');
      return;
    }

    const startTime = Date.now();

    try {
      const assetMessage: AgentMessage = {
        id: `${taskId}_assets`,
        type: 'COMMAND',
        from: this.identity.id,
        to: 'ASSET_GENERATOR',
        payload: {
          action: 'generate_asset_package',
          brandName: brandContext.companyDescription,
          brandColors: brandContext.colorPalette,
          brandStyle: 'modern',
          industry: brandContext.industry,
          pages: pageContent.map(p => ({ id: p.pageId, name: p.pageName })),
        },
        timestamp: new Date(),
        priority: 'NORMAL',
        requiresResponse: true,
        traceId: taskId,
      };

      const report = await assetGenerator.execute(assetMessage);
      const executionTimeMs = Date.now() - startTime;

      delegations.push({
        specialist: 'ASSET_GENERATOR',
        brief: 'Generate brand asset package',
        status: report.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
        result: report.data,
        executionTimeMs,
      });

      specialistOutputs.assets = report.data;

      // Attach generated assets to page content
      if (report.status === 'COMPLETED' && report.data) {
        const assetData = report.data as {
          variations?: Array<{ name: string; url?: string; dimensions?: { width: number; height: number } }>;
        };

        if (assetData.variations) {
          for (const page of pageContent) {
            page.visuals.push({
              assetId: `hero_${page.pageId}`,
              type: 'hero',
              url: assetData.variations[0]?.url,
              altText: `${page.pageName} hero image`,
              dimensions: assetData.variations[0]?.dimensions ?? { width: 1920, height: 1080 },
            });
          }
        }
      }
    } catch (error) {
      warnings.push(`Asset generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate social media snippets from page content
   */
  private generateSocialSnippets(pageContent: PageContent[], brandContext: BrandContext): SocialSnippets {
    const snippets: SocialSnippets = {
      twitter: [],
      linkedin: [],
      instagram: [],
      tiktok: [],
      facebook: [],
    };

    // Generate snippets based on page content
    for (const page of pageContent) {
      const headline = page.headlines.h1;
      const description = page.metadata.description;

      // Twitter - short, punchy
      snippets.twitter.push({
        text: `${headline}\n\n${description.slice(0, 200)}...`,
        hashtags: brandContext.keyPhrases.slice(0, 3).map(p => p.replace(/\s+/g, '')),
        characterCount: headline.length + description.slice(0, 200).length + 5,
      });

      // LinkedIn - professional
      snippets.linkedin.push({
        text: `${headline}\n\n${description}\n\n#${brandContext.industry.replace(/\s+/g, '')}`,
        format: 'post',
      });

      // Instagram - visual-focused
      snippets.instagram.push({
        caption: `${headline} \n\n${description.slice(0, 150)}`,
        hashtags: [
          ...brandContext.keyPhrases.slice(0, 5).map(p => p.replace(/\s+/g, '')),
          brandContext.industry.replace(/\s+/g, ''),
        ],
      });

      // Facebook - conversational
      snippets.facebook.push({
        text: `${headline}\n\n${description}`,
        cta: 'Learn more',
      });
    }

    return snippets;
  }

  /**
   * Generate video content if VIDEO_SPECIALIST is activated
   */
  private async generateVideoContent(
    request: ContentRequest,
    brandContext: BrandContext,
    taskId: string,
    delegations: DelegationResult[],
    specialistOutputs: ContentPackage['specialistOutputs']
  ): Promise<VideoContent | null> {
    const videoSpecialist = this.specialists.get('VIDEO_SPECIALIST');

    if (!videoSpecialist?.isFunctional()) {
      return null;
    }

    const startTime = Date.now();

    try {
      const videoMessage: AgentMessage = {
        id: `${taskId}_video`,
        type: 'COMMAND',
        from: this.identity.id,
        to: 'VIDEO_SPECIALIST',
        payload: {
          action: 'script_to_storyboard',
          script: `Introducing ${brandContext.companyDescription}. ${brandContext.uniqueValue}`,
          brief: `Cold-introduction explainer for ${brandContext.targetAudience ?? 'B2B buyers'}`,
          platform: 'youtube',
          style: 'documentary',
          targetDuration: 75,
          targetAudience: brandContext.targetAudience,
          callToAction: 'Book a 15-minute discovery call',
        },
        timestamp: new Date(),
        priority: 'NORMAL',
        requiresResponse: true,
        traceId: taskId,
      };

      const report = await videoSpecialist.execute(videoMessage);
      const executionTimeMs = Date.now() - startTime;

      delegations.push({
        specialist: 'VIDEO_SPECIALIST',
        brief: 'Generate video storyboard',
        status: report.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
        result: report.data,
        executionTimeMs,
      });

      specialistOutputs.video = report.data;

      if (report.status === 'COMPLETED' && report.data) {
        return {
          videos: [{
            videoId: `video_${taskId}`,
            platform: 'youtube',
            title: `${brandContext.companyDescription} - Introduction`,
            script: `Introducing ${brandContext.companyDescription}`,
            storyboard: report.data,
            thumbnailConcept: 'Brand logo with tagline overlay',
            seo: {
              title: `${brandContext.companyDescription} - Introduction`,
              description: brandContext.uniqueValue,
              tags: brandContext.keyPhrases,
            },
          }],
        };
      }
    } catch (error) {
      this.log('WARN', `Video generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return null;
  }

  /**
   * Generate long-form blog content if BLOG_WRITER is activated.
   * Jasper's `delegate_to_content` tool with `contentType: 'blog_post'` now
   * routes here via `detectContentIntent() === 'BLOG_CONTENT'`. Before this
   * method existed, BLOG_WRITER was registered but had no invocation path
   * (see `scripts/verify-specialist-reachability.ts` + Bug L writeup).
   */
  private async generateBlogContent(
    request: ContentRequest,
    brandContext: BrandContext,
    seoContext: SEOContext,
    taskId: string,
    delegations: DelegationResult[],
    specialistOutputs: ContentPackage['specialistOutputs'],
  ): Promise<BlogPostResult | null> {
    const blogWriter = this.specialists.get('BLOG_WRITER');

    if (!blogWriter?.isFunctional()) {
      return null;
    }

    const startTime = Date.now();

    // Derive target keywords from Jasper's payload first, then SEO context, then fallback
    const seoKeywordsFromCtx = Object.values(seoContext.perPage ?? {})
      .flatMap((p) => p.keywordFocus ?? []);
    let targetKeywords: string[];
    if (typeof request.seoKeywords === 'string' && request.seoKeywords.length > 0) {
      targetKeywords = request.seoKeywords.split(',').map((k) => k.trim()).filter((k) => k.length > 0);
    } else if (seoKeywordsFromCtx.length > 0) {
      targetKeywords = seoKeywordsFromCtx.slice(0, 5);
    } else {
      targetKeywords = [brandContext.companyDescription ?? 'industry insight'];
    }

    const topic = request.topic
      ?? `How ${brandContext.companyDescription ?? 'our industry'} is evolving`;

    const wordCountTarget = request.format === 'short'
      ? 800
      : request.format === 'long'
        ? 1800
        : 1200;

    try {
      const blogMessage: AgentMessage = {
        id: `${taskId}_blog`,
        type: 'COMMAND',
        from: this.identity.id,
        to: 'BLOG_WRITER',
        payload: {
          action: 'write_blog_post',
          topic,
          targetKeywords,
          audience: request.audience ?? brandContext.targetAudience ?? 'business decision makers',
          wordCountTarget,
          toneOverride: brandContext.toneOfVoice,
        },
        timestamp: new Date(),
        priority: 'HIGH',
        requiresResponse: true,
        traceId: taskId,
      };

      const report = await blogWriter.execute(blogMessage);
      const executionTimeMs = Date.now() - startTime;

      delegations.push({
        specialist: 'BLOG_WRITER',
        brief: `Generate blog post on "${topic}"`,
        status: report.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
        result: report.data,
        executionTimeMs,
      });

      specialistOutputs.blog = report.data;

      if (report.status === 'COMPLETED' && report.data) {
        const blogResult = report.data as BlogPostResult;

        // Persist as a Blog Post doc so it shows up in /content/blog listing
        // AND the editor shows the generated content. Returns the postId on
        // success so ContentPackage can carry it for the review link.
        const postId = await this.persistBlogAsPost(blogResult, taskId).catch((err: unknown) => {
          this.log('WARN', `Blog post persistence failed: ${err instanceof Error ? err.message : String(err)}`);
          return null;
        });
        if (postId) {
          (blogResult as BlogPostResult & { blogPostId?: string }).blogPostId = postId;
        }

        return blogResult;
      }
    } catch (error) {
      this.log('WARN', `Blog generation failed: ${error instanceof Error ? error.message : String(error)}`);
      delegations.push({
        specialist: 'BLOG_WRITER',
        brief: `Generate blog post on "${topic}"`,
        status: 'FAILED',
        result: null,
        executionTimeMs: Date.now() - startTime,
      });
    }

    return null;
  }

  /**
   * Persist a BlogPostResult as a BlogPost document in Firestore so it shows
   * up in the /content/blog listing AND the editor displays the real content.
   *
   * Converts BlogPostResult.sections into the site's PageSection[] / Widget[]
   * structure. Each blog section becomes a heading widget + text widget. The
   * CTA and SEO notes are appended as additional widgets. The raw output is
   * also stashed in `rawBlogOutput` for future editor re-import flows.
   *
   * Returns the postId so callers can build links into the editor.
   */
  private async persistBlogAsPost(blog: BlogPostResult, taskId: string): Promise<string | null> {
    if (!adminDb) {
      this.log('WARN', 'Firestore admin not available — blog persistence skipped');
      return null;
    }

    const now = new Date().toISOString();
    const postId = `post_blog_${taskId}_${Date.now()}`;
    const readTimeMinutes = (() => {
      if (!blog.estimatedReadTime) { return 5; }
      const m = /(\d+)/.exec(blog.estimatedReadTime);
      const n = m ? parseInt(m[1], 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : 5;
    })();

    // Build widgets: intro + (heading + text) per section + optional CTA
    const widgets: Array<Record<string, unknown>> = [];
    if (blog.metaDescription) {
      widgets.push({
        id: `intro_${postId}`,
        type: 'text',
        data: { content: blog.metaDescription },
      });
    }
    for (let i = 0; i < blog.sections.length; i++) {
      const s = blog.sections[i];
      const level = s.headingLevel === 'h3' ? 3 : 2;
      widgets.push({
        id: `h_${postId}_${i}`,
        type: 'heading',
        data: { level, text: s.heading },
      });
      widgets.push({
        id: `p_${postId}_${i}`,
        type: 'text',
        data: { content: s.body },
      });
      if (s.keyTakeaway) {
        widgets.push({
          id: `k_${postId}_${i}`,
          type: 'text',
          data: { content: `Key takeaway: ${s.keyTakeaway}` },
        });
      }
    }
    if (blog.cta?.text) {
      widgets.push({
        id: `cta_${postId}`,
        type: 'heading',
        data: { level: 2, text: blog.cta.text },
      });
      if (blog.cta.placement) {
        widgets.push({
          id: `cta_placement_${postId}`,
          type: 'text',
          data: { content: `(Placement: ${blog.cta.placement})` },
        });
      }
    }

    const content = [
      {
        id: `section_${postId}`,
        type: 'section' as const,
        columns: [
          {
            id: `col_${postId}`,
            width: 100,
            widgets,
          },
        ],
      },
    ];

    // Build BlogPost-shaped document. Fields match src/types/website.ts BlogPost interface,
    // plus a non-standard `rawBlogOutput` holding the BLOG_WRITER result for later editor use.
    const postData = {
      id: postId,
      slug: blog.slug,
      title: blog.title,
      excerpt: blog.metaDescription,
      content,
      author: 'system',
      authorName: 'Blog Writer',
      categories: [],
      tags: blog.seoNotes?.secondaryKeywords ?? [],
      featured: false,
      seo: {
        title: blog.title,
        description: blog.metaDescription,
        keywords: [
          blog.seoNotes?.primaryKeyword,
          ...(blog.seoNotes?.secondaryKeywords ?? []),
        ].filter((k): k is string => typeof k === 'string' && k.length > 0),
      },
      status: 'draft' as const,
      views: 0,
      readTime: readTimeMinutes,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      lastEditedBy: 'system',
      // Raw output from BLOG_WRITER preserved on the doc so editor logic can
      // regenerate the widget tree differently later if needed.
      rawBlogOutput: blog,
    };

    const blogPath = `${getSubCollection('website')}/config/blog-posts`;
    await adminDb.collection(blogPath).doc(postId).set(postData);
    this.log('INFO', `Blog post persisted: ${postId} (${blog.title})`);
    return postId;
  }

  /**
   * Generate soundtrack plan if MUSIC_PLANNER is activated. Mirrors the
   * BLOG_WRITER pattern — the specialist was registered but had no invocation
   * path until this commit (Bug L part 2).
   */
  private async generateMusicContent(
    request: ContentRequest,
    brandContext: BrandContext,
    taskId: string,
    delegations: DelegationResult[],
    specialistOutputs: ContentPackage['specialistOutputs'],
  ): Promise<SoundtrackPlanResult | null> {
    const musicPlanner = this.specialists.get('MUSIC_PLANNER');

    if (!musicPlanner?.isFunctional()) {
      return null;
    }

    const startTime = Date.now();

    const projectDescription = request.topic
      ?? `Brand content for ${brandContext.companyDescription ?? 'the business'}`;

    try {
      const musicMessage: AgentMessage = {
        id: `${taskId}_music`,
        type: 'COMMAND',
        from: this.identity.id,
        to: 'MUSIC_PLANNER',
        payload: {
          action: 'plan_soundtrack',
          projectDescription,
          targetAudience: request.audience ?? brandContext.targetAudience,
          brandTone: brandContext.toneOfVoice,
          contentType: request.contentType,
        },
        timestamp: new Date(),
        priority: 'NORMAL',
        requiresResponse: true,
        traceId: taskId,
      };

      const report = await musicPlanner.execute(musicMessage);
      const executionTimeMs = Date.now() - startTime;

      delegations.push({
        specialist: 'MUSIC_PLANNER',
        brief: `Plan soundtrack for "${projectDescription}"`,
        status: report.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
        result: report.data,
        executionTimeMs,
      });

      specialistOutputs.music = report.data;

      if (report.status === 'COMPLETED' && report.data) {
        return report.data as SoundtrackPlanResult;
      }
    } catch (error) {
      this.log('WARN', `Music planning failed: ${error instanceof Error ? error.message : String(error)}`);
      delegations.push({
        specialist: 'MUSIC_PLANNER',
        brief: `Plan soundtrack for "${projectDescription}"`,
        status: 'FAILED',
        result: null,
        executionTimeMs: Date.now() - startTime,
      });
    }

    return null;
  }

  /**
   * Generate podcast episode plan if PODCAST_SPECIALIST is activated.
   * Mirrors BLOG_WRITER pattern. Was registered but unreachable before this
   * commit (Bug L part 3).
   */
  private async generatePodcastContent(
    request: ContentRequest,
    brandContext: BrandContext,
    taskId: string,
    delegations: DelegationResult[],
    specialistOutputs: ContentPackage['specialistOutputs'],
  ): Promise<EpisodePlanResult | null> {
    const podcastSpecialist = this.specialists.get('PODCAST_SPECIALIST');

    if (!podcastSpecialist?.isFunctional()) {
      return null;
    }

    const startTime = Date.now();

    const topic = request.topic
      ?? `Insights on ${brandContext.companyDescription ?? 'our industry'}`;

    const durationMinutes = request.format === 'short'
      ? 15
      : request.format === 'long'
        ? 60
        : 30;

    try {
      const podcastMessage: AgentMessage = {
        id: `${taskId}_podcast`,
        type: 'COMMAND',
        from: this.identity.id,
        to: 'PODCAST_SPECIALIST',
        payload: {
          action: 'plan_episode',
          topic,
          targetAudience: request.audience ?? brandContext.targetAudience,
          episodeFormat: 'solo',
          durationMinutes,
          brandVoice: brandContext.toneOfVoice,
        },
        timestamp: new Date(),
        priority: 'NORMAL',
        requiresResponse: true,
        traceId: taskId,
      };

      const report = await podcastSpecialist.execute(podcastMessage);
      const executionTimeMs = Date.now() - startTime;

      delegations.push({
        specialist: 'PODCAST_SPECIALIST',
        brief: `Plan podcast episode on "${topic}"`,
        status: report.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
        result: report.data,
        executionTimeMs,
      });

      specialistOutputs.podcast = report.data;

      if (report.status === 'COMPLETED' && report.data) {
        return report.data as EpisodePlanResult;
      }
    } catch (error) {
      this.log('WARN', `Podcast planning failed: ${error instanceof Error ? error.message : String(error)}`);
      delegations.push({
        specialist: 'PODCAST_SPECIALIST',
        brief: `Plan podcast episode on "${topic}"`,
        status: 'FAILED',
        result: null,
        executionTimeMs: Date.now() - startTime,
      });
    }

    return null;
  }

  /**
   * Generate content calendar recommendations
   */
  private async generateContentCalendar(
    pageContent: PageContent[],
    targetPlatforms: string[],
    taskId: string,
    delegations: DelegationResult[],
    specialistOutputs: ContentPackage['specialistOutputs']
  ): Promise<ContentCalendar | null> {
    const calendarCoordinator = this.specialists.get('CALENDAR_COORDINATOR');

    if (!calendarCoordinator?.isFunctional()) {
      return null;
    }

    const startTime = Date.now();

    try {
      const calendarMessage: AgentMessage = {
        id: `${taskId}_calendar`,
        type: 'COMMAND',
        from: this.identity.id,
        to: 'CALENDAR_COORDINATOR',
        payload: {
          action: 'plan_calendar',
          contentItems: pageContent.map(p => ({
            id: p.pageId,
            type: 'page_launch',
            title: p.pageName,
          })),
          platforms: targetPlatforms.length > 0 ? targetPlatforms : ['twitter', 'linkedin', 'facebook'],
          duration: '1 month',
          timezone: 'America/New_York',
        },
        timestamp: new Date(),
        priority: 'LOW',
        requiresResponse: true,
        traceId: taskId,
      };

      const report = await calendarCoordinator.execute(calendarMessage);
      const executionTimeMs = Date.now() - startTime;

      delegations.push({
        specialist: 'CALENDAR_COORDINATOR',
        brief: 'Generate content calendar',
        status: report.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
        result: report.data,
        executionTimeMs,
      });

      specialistOutputs.calendar = report.data;

      if (report.status !== 'COMPLETED' || report.data === null || typeof report.data !== 'object') {
        return null;
      }

      // Defensive unwrap: the rebuilt Calendar Coordinator (Task #25) returns
      // { schedule: ScheduleEntry[], frequencyRecommendation: Record<string, string> }
      // matching the ContentCalendar interface exactly. Verify shape at the
      // boundary so malformed specialist output fails closed (null) rather than
      // propagating half-built objects downstream.
      const calendarData = report.data as {
        schedule?: unknown;
        frequencyRecommendation?: unknown;
      };

      if (!Array.isArray(calendarData.schedule)) {
        this.log('WARN', 'Calendar Coordinator returned non-array schedule, treating as failure');
        return null;
      }
      if (
        calendarData.frequencyRecommendation === null ||
        typeof calendarData.frequencyRecommendation !== 'object'
      ) {
        this.log(
          'WARN',
          'Calendar Coordinator returned missing/non-object frequencyRecommendation, treating as failure'
        );
        return null;
      }

      return {
        schedule: calendarData.schedule as ContentCalendar['schedule'],
        frequencyRecommendation: calendarData.frequencyRecommendation as ContentCalendar['frequencyRecommendation'],
      };
    } catch (error) {
      this.log('WARN', `Calendar generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return null;
  }

  // ==========================================================================
  // CONTENT VALIDATION - Brand DNA Compliance
  // ==========================================================================

  /**
   * Validate all content against Brand DNA rules
   */
  private validateContent(
    pageContent: PageContent[],
    socialSnippets: SocialSnippets,
    brandContext: BrandContext,
    _seoContext: SEOContext
  ): ContentPackage['validation'] {
    const violations: Array<{ phrase: string; location: string }> = [];
    let toneScore = 100;
    let seoScore = 100;
    let a11yScore = 100;

    // Check for avoid phrases in all content
    for (const page of pageContent) {
      const allText = this.extractAllText(page);

      for (const avoidPhrase of brandContext.avoidPhrases) {
        if (allText.toLowerCase().includes(avoidPhrase.toLowerCase())) {
          violations.push({
            phrase: avoidPhrase,
            location: `Page: ${page.pageName}`,
          });
          toneScore -= 10;
        }
      }

      // Check meta description length
      if (page.metadata.description.length > 160) {
        seoScore -= 5;
      }
      if (page.metadata.description.length < 120) {
        seoScore -= 3;
      }

      // Check for missing alt text
      for (const visual of page.visuals) {
        if (!visual.altText || visual.altText.length < 10) {
          a11yScore -= 5;
        }
      }
    }

    // Check social snippets
    for (const tweet of socialSnippets.twitter) {
      for (const avoidPhrase of brandContext.avoidPhrases) {
        if (tweet.text.toLowerCase().includes(avoidPhrase.toLowerCase())) {
          violations.push({
            phrase: avoidPhrase,
            location: 'Twitter snippet',
          });
          toneScore -= 5;
        }
      }
    }

    return {
      passed: violations.length === 0 && toneScore >= 70,
      avoidPhraseViolations: violations,
      toneConsistency: Math.max(0, toneScore),
      seoScore: Math.max(0, seoScore),
      accessibilityScore: Math.max(0, a11yScore),
    };
  }

  /**
   * Extract all text from a page for validation
   */
  private extractAllText(page: PageContent): string {
    const texts: string[] = [
      page.headlines.h1,
      ...page.headlines.h2,
      ...page.headlines.h3,
      ...(page.headlines.h4 ?? []),
      page.metadata.title,
      page.metadata.description,
      ...page.bodyCopy.sections.map(s => `${s.heading} ${s.content} ${s.cta ?? ''}`),
    ];

    return texts.join(' ');
  }

  // ==========================================================================
  // CONFIDENCE CALCULATION
  // ==========================================================================

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(
    delegations: DelegationResult[],
    expectedSpecialists: number,
    validation: ContentPackage['validation']
  ): number {
    let confidence = 0.5; // Base confidence

    // Specialist success rate
    const successRate = delegations.filter(d => d.status === 'COMPLETED').length / Math.max(1, expectedSpecialists);
    confidence += successRate * 0.3;

    // Validation score
    if (validation.passed) {
      confidence += 0.15;
    }

    // Tone consistency
    confidence += (validation.toneConsistency / 100) * 0.05;

    return Math.min(1, Math.max(0, confidence));
  }

  // ==========================================================================
  // VAULT INTEGRATION
  // ==========================================================================

  /**
   * Fetch architecture from MemoryVault
   */
  private async fetchArchitectureFromVault(
    blueprintId?: string
  ): Promise<{ technicalBrief: TechnicalBrief } | null> {
    try {
      const insights = await readAgentInsights('ARCHITECT_MANAGER', {
        type: 'CONTENT',
        limit: 5,
      });

      // Find the blueprint insight
      const blueprintInsight = insights.find(i =>
        i.tags.includes('site.blueprint_ready') ||
        i.value.title?.toLowerCase().includes('architecture') ||
        (blueprintId && i.metadata?.blueprintId === blueprintId)
      );

      if (blueprintInsight?.metadata?.technicalBrief) {
        return {
          technicalBrief: blueprintInsight.metadata.technicalBrief as TechnicalBrief,
        };
      }
    } catch (error) {
      this.log('WARN', `Failed to fetch architecture from vault: ${error instanceof Error ? error.message : String(error)}`);
    }

    return null;
  }

  /**
   * Store content insights in MemoryVault
   */
  private async storeContentInsights(contentPackage: ContentPackage): Promise<void> {
    try {
      await shareInsight(
        this.identity.id,
        'CONTENT',
        'Content Package Generated',
        `Generated content package with ${contentPackage.pageContent.length} pages, ` +
        `${contentPackage.socialSnippets.twitter.length} social snippets. ` +
        `Validation: ${contentPackage.validation.passed ? 'PASSED' : 'FAILED'}`,
        {
          confidence: Math.round(contentPackage.confidence * 100),
          relatedAgents: ['BUILDER_MANAGER', 'MARKETING_MANAGER'],
          actions: contentPackage.validation.passed
            ? ['Proceed to BUILDER_MANAGER for site construction']
            : ['Review avoid phrase violations', 'Regenerate content'],
          tags: ['content.package_ready', contentPackage.packageId],
        }
      );

      this.log('INFO', 'Stored content insights in MemoryVault');
    } catch (error) {
      this.log('WARN', `Failed to store insights: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Broadcast content.package_ready signal for downstream managers
   */
  private async broadcastContentReady(contentPackage: ContentPackage): Promise<void> {
    try {
      await broadcastSignal(
        this.identity.id,
        'content.package_ready',
        'MEDIUM',
        {
          packageId: contentPackage.packageId,
          blueprintId: contentPackage.blueprintId,
          pageCount: contentPackage.pageContent.length,
          validationPassed: contentPackage.validation.passed,
          confidence: contentPackage.confidence,
          timestamp: new Date().toISOString(),
        },
        ['BUILDER_MANAGER', 'MARKETING_MANAGER']
      );

      this.log('INFO', 'Broadcast content.package_ready signal');
    } catch (error) {
      this.log('WARN', `Failed to broadcast signal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ==========================================================================
  // PHASE 7: CONTEXTUAL ARTIFACT GENERATION
  // ==========================================================================

  /**
   * Orchestrate personalized artifact generation for prospects.
   * Called by Event Router when a prospect replies with "needs_more_info".
   * Generates personalized video + PDF proposal using scraped company data.
   */
  async handleContextualArtifactGeneration(
    prospectContext: ProspectContext
  ): Promise<ArtifactGenerationResult> {
    const startTime = Date.now();
    this.log('INFO', `Generating contextual artifacts for lead ${prospectContext.leadId}`);

    const result: ArtifactGenerationResult = {
      leadId: prospectContext.leadId,
      artifacts: {},
      totalArtifacts: 2,
      successfulArtifacts: 0,
      generatedAt: new Date(),
    };

    // Generate video and proposal in parallel
    const [videoResult, proposalResult] = await Promise.allSettled([
      this.generatePersonalizedVideo(prospectContext),
      this.generatePersonalizedProposal(prospectContext),
    ]);

    // Process video result
    if (videoResult.status === 'fulfilled' && videoResult.value) {
      result.artifacts.video = videoResult.value;
      result.successfulArtifacts++;
    } else {
      result.artifacts.video = { videoId: '', platform: '', status: 'FAILED' };
    }

    // Process proposal result
    if (proposalResult.status === 'fulfilled' && proposalResult.value) {
      result.artifacts.proposal = proposalResult.value;
      result.successfulArtifacts++;
    } else {
      result.artifacts.proposal = { proposalId: '', status: 'FAILED' };
    }

    // Store artifacts in MemoryVault for Outreach Manager pickup
    await shareInsight(
      this.identity.id,
      'CONTENT',
      `Prospect Artifacts for ${prospectContext.companyName}`,
      `Generated ${result.successfulArtifacts}/${result.totalArtifacts} artifacts for lead ${prospectContext.leadId}. ` +
      `Video: ${result.artifacts.video?.status ?? 'N/A'}, Proposal: ${result.artifacts.proposal?.status ?? 'N/A'}`,
      {
        tags: ['prospect_assets', prospectContext.leadId, prospectContext.contactEmail],
        confidence: result.successfulArtifacts / result.totalArtifacts,
        relatedAgents: ['OUTREACH_MANAGER'],
      }
    );

    this.log('INFO', `Artifact generation completed: ${result.successfulArtifacts}/${result.totalArtifacts} successful (${Date.now() - startTime}ms)`);

    return result;
  }

  /**
   * Generate personalized video using scraped company data
   */
  private async generatePersonalizedVideo(
    context: ProspectContext
  ): Promise<ArtifactGenerationResult['artifacts']['video']> {
    const videoSpecialist = this.specialists.get('VIDEO_SPECIALIST');

    if (!videoSpecialist?.isFunctional()) {
      this.log('WARN', 'VIDEO_SPECIALIST not functional, skipping video generation');
      return { videoId: '', platform: '', status: 'FAILED' };
    }

    try {
      const script = this.buildPersonalizedVideoScript(context);

      const videoMessage: AgentMessage = {
        id: `artifact_video_${context.leadId}_${Date.now()}`,
        type: 'COMMAND',
        from: this.identity.id,
        to: 'VIDEO_SPECIALIST',
        payload: {
          action: 'script_to_storyboard',
          script,
          brief: `Personalized 1:1 outbound video for ${context.contactName ?? 'the prospect'} at ${context.companyName ?? 'the target company'}. Reference the company name, contact name, industry, and any provided pain points in the opening scene.`,
          platform: 'generic',
          style: 'talking_head',
          targetDuration: 60,
          targetAudience: `${context.contactName ?? 'prospect'} at ${context.companyName ?? 'target company'}${context.industry ? ` (${context.industry})` : ''}`,
          callToAction: `Reply to this email to book a 20-minute deep-dive on how we'd help ${context.companyName ?? 'your team'}`,
        },
        timestamp: new Date(),
        priority: 'HIGH',
        requiresResponse: true,
        traceId: context.leadId,
      };

      const report = await videoSpecialist.execute(videoMessage);

      if (report.status === 'COMPLETED' && report.data) {
        return {
          videoId: `video_${context.leadId}_${Date.now()}`,
          platform: 'hedra',
          status: 'GENERATED',
          script,
          storyboard: report.data,
        };
      }

      return { videoId: '', platform: '', status: 'FAILED' };
    } catch (error) {
      this.log('ERROR', `Video generation failed: ${error instanceof Error ? error.message : String(error)}`);
      return { videoId: '', platform: '', status: 'FAILED' };
    }
  }

  /**
   * Generate personalized PDF proposal using copywriter + proposal-generator
   */
  private async generatePersonalizedProposal(
    context: ProspectContext
  ): Promise<ArtifactGenerationResult['artifacts']['proposal']> {
    const copywriter = this.specialists.get('COPYWRITER');

    if (!copywriter?.isFunctional()) {
      this.log('WARN', 'COPYWRITER not functional, skipping proposal generation');
      return { proposalId: '', status: 'FAILED' };
    }

    try {
      const copyMessage: AgentMessage = {
        id: `artifact_proposal_${context.leadId}_${Date.now()}`,
        type: 'COMMAND',
        from: this.identity.id,
        to: 'COPYWRITER',
        payload: {
          action: 'generate_proposal',
          companyName: context.companyName,
          industry: context.industry,
          techStack: context.techStack,
          painPoints: context.painPoints,
          requestedInfo: context.requestedInfo,
        },
        timestamp: new Date(),
        priority: 'HIGH',
        requiresResponse: true,
        traceId: context.leadId,
      };

      const report = await copywriter.execute(copyMessage);

      if (report.status === 'COMPLETED' && report.data) {
        const proposalData = report.data as { sections?: string[] };
        return {
          proposalId: `proposal_${context.leadId}_${Date.now()}`,
          status: 'GENERATED',
          sections: proposalData.sections ?? ['intro', 'solution', 'pricing', 'cta'],
        };
      }

      return { proposalId: '', status: 'FAILED' };
    } catch (error) {
      this.log('ERROR', `Proposal generation failed: ${error instanceof Error ? error.message : String(error)}`);
      return { proposalId: '', status: 'FAILED' };
    }
  }

  /**
   * Build personalized video script using prospect context
   */
  private buildPersonalizedVideoScript(context: ProspectContext): string {
    const companyName = context.companyName ?? 'your organization';
    const industry = context.industry ?? 'your industry';
    const painPoints = context.painPoints?.join(', ') ?? 'common business challenges';

    return `Hi ${context.contactName ?? 'there'},

Thank you for your interest in SalesVelocity.ai. I wanted to personally reach out to ${companyName}.

We understand that companies in ${industry} often face challenges like ${painPoints}.

That's exactly why we built SalesVelocity — to help businesses like yours automate revenue operations and accelerate growth.

Based on your inquiry, I've prepared a custom proposal that addresses your specific needs.

Looking forward to exploring how we can help ${companyName} achieve its goals.

Best regards,
The SalesVelocity Team`;
  }

}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createContentManager(): ContentManager {
  return new ContentManager();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let contentManagerInstance: ContentManager | null = null;

export function getContentManager(): ContentManager {
  contentManagerInstance ??= createContentManager();
  return contentManagerInstance;
}
