/**
 * Agent Swarm Index
 * STATUS: REGISTRY - Exports all agents for easy importing
 *
 * SWARM STATUS REPORT (Updated Batch 70b)
 *
 * Total Agents: 36 (9 managers + 27 specialists)
 *
 * MANAGERS (9):
 * - IntelligenceManager, MarketingManager, BuilderManager
 * - CommerceManager, OutreachManager, ContentManager
 * - ArchitectManager, RevenueDirector, ReputationManager
 *
 * SPECIALISTS (27):
 * - Intelligence: CompetitorResearcher, SentimentAnalyst, TechnographicScout, ScraperSpecialist
 * - Marketing: TikTokExpert, XExpert, FacebookAdsExpert, LinkedInExpert, SEOExpert, TwitterExpert
 * - Builder: UxUiArchitect, FunnelEngineer, AssetGenerator
 * - Architect: UXUISpecialist, FunnelPathologist, CopySpecialist
 * - Commerce: PricingStrategist, InventoryManagerAgent
 * - Outreach: EmailSpecialist, SmsSpecialist
 * - Content: Copywriter, CalendarCoordinator
 * - Sales: MerchandiserSpecialist, OutreachSpecialist, LeadQualifierSpecialist
 * - Trust: GMBSpecialist, ReviewSpecialist
 *
 * Status Breakdown:
 * - FUNCTIONAL: 9 (Marketing Manager, TikTok, Competitor, Asset Gen, Funnel, UX/UI, Inventory, Copywriter, Calendar)
 * - SHELL: 8 (Other managers)
 * - GHOST: 19 (Remaining specialists)
 */

// Types
export * from './types';

// Base Classes
export { BaseSpecialist } from './base-specialist';
export { BaseManager } from './base-manager';

// ============================================================================
// MANAGERS (L2 Orchestrators)
// ============================================================================

// Core Managers
export { IntelligenceManager } from './intelligence/manager';
export { MarketingManager } from './marketing/manager';
export { BuilderManager } from './builder/manager';
export { CommerceManager } from './commerce/manager';
export { OutreachManager } from './outreach/manager';
export { ContentManager } from './content/manager';

// Additional Managers
export { ArchitectManager } from './architect/manager';
export { RevenueDirector } from './sales/revenue/manager';
export { ReputationManager } from './trust/reputation/manager';

// ============================================================================
// SPECIALISTS (L3 Workers)
// ============================================================================

// Intelligence Specialists
export { CompetitorResearcher } from './intelligence/competitor/specialist';
export { SentimentAnalyst } from './intelligence/sentiment/specialist';
export { TechnographicScout } from './intelligence/technographic/specialist';
export { ScraperSpecialist } from './intelligence/scraper/specialist';

// Marketing Specialists
export { TikTokExpert } from './marketing/tiktok/specialist';
export { XExpert } from './marketing/x/specialist';
export { FacebookAdsExpert } from './marketing/facebook/specialist';
export { LinkedInExpert } from './marketing/linkedin/specialist';
export { SEOExpert } from './marketing/seo/specialist';
export { TwitterExpert } from './marketing/twitter/specialist';

// Builder Specialists
export { UxUiArchitect } from './builder/ux-ui/specialist';
export { FunnelEngineer } from './builder/funnel/specialist';
export { AssetGenerator } from './builder/assets/specialist';

// Architect Specialists (Site Architecture)
export { UXUISpecialist } from './architect/ux-ui/specialist';
export { FunnelPathologist } from './architect/funnel/specialist';
export { CopySpecialist } from './architect/copy/specialist';

// Commerce Specialists
export { PricingStrategist } from './commerce/pricing/specialist';
export { InventoryManagerAgent } from './commerce/inventory/specialist';

// Outreach Specialists
export { EmailSpecialist } from './outreach/email/specialist';
export { SmsSpecialist } from './outreach/sms/specialist';

// Content Specialists
export { Copywriter } from './content/copywriter/specialist';
export { CalendarCoordinator } from './content/calendar/specialist';

// Sales Specialists
export { MerchandiserSpecialist } from './sales/merchandiser/specialist';
export { OutreachSpecialist } from './sales/outreach/specialist';
export { LeadQualifierSpecialist } from './sales/qualifier/specialist';

// Trust Specialists
export { GMBSpecialist } from './trust/gmb/specialist';
export { ReviewSpecialist } from './trust/review/specialist';

// ============================================================================
// AGENT REGISTRY UTILITY
// ============================================================================

/**
 * Complete list of all agent IDs in the swarm
 */
export const AGENT_IDS = {
  // Managers
  INTELLIGENCE_MANAGER: 'INTELLIGENCE_MANAGER',
  MARKETING_MANAGER: 'MARKETING_MANAGER',
  BUILDER_MANAGER: 'BUILDER_MANAGER',
  COMMERCE_MANAGER: 'COMMERCE_MANAGER',
  OUTREACH_MANAGER: 'OUTREACH_MANAGER',
  CONTENT_MANAGER: 'CONTENT_MANAGER',
  ARCHITECT_MANAGER: 'ARCHITECT_MANAGER',
  REVENUE_DIRECTOR: 'REVENUE_DIRECTOR',
  REPUTATION_MANAGER: 'REPUTATION_MANAGER',

  // Intelligence Specialists
  COMPETITOR_RESEARCHER: 'COMPETITOR_RESEARCHER',
  SENTIMENT_ANALYST: 'SENTIMENT_ANALYST',
  TECHNOGRAPHIC_SCOUT: 'TECHNOGRAPHIC_SCOUT',
  SCRAPER_SPECIALIST: 'SCRAPER_SPECIALIST',

  // Marketing Specialists
  TIKTOK_EXPERT: 'TIKTOK_EXPERT',
  X_EXPERT: 'X_EXPERT',
  FACEBOOK_EXPERT: 'FACEBOOK_EXPERT',
  LINKEDIN_EXPERT: 'LINKEDIN_EXPERT',
  SEO_EXPERT: 'SEO_EXPERT',
  TWITTER_EXPERT: 'TWITTER_EXPERT',

  // Builder Specialists
  UX_UI_ARCHITECT: 'UX_UI_ARCHITECT',
  FUNNEL_ENGINEER: 'FUNNEL_ENGINEER',
  ASSET_GENERATOR: 'ASSET_GENERATOR',

  // Architect Specialists
  UX_UI_SPECIALIST: 'UX_UI_SPECIALIST',
  FUNNEL_PATHOLOGIST: 'FUNNEL_PATHOLOGIST',
  COPY_SPECIALIST: 'COPY_SPECIALIST',

  // Commerce Specialists
  PRICING_STRATEGIST: 'PRICING_STRATEGIST',
  INVENTORY_MANAGER: 'INVENTORY_MANAGER',

  // Outreach Specialists
  EMAIL_SPECIALIST: 'EMAIL_SPECIALIST',
  SMS_SPECIALIST: 'SMS_SPECIALIST',

  // Content Specialists
  COPYWRITER: 'COPYWRITER',
  CALENDAR_COORDINATOR: 'CALENDAR_COORDINATOR',

  // Sales Specialists
  MERCHANDISER: 'MERCHANDISER',
  OUTREACH_SPECIALIST: 'OUTREACH_SPECIALIST',
  LEAD_QUALIFIER: 'LEAD_QUALIFIER',

  // Trust Specialists
  GMB_SPECIALIST: 'GMB_SPECIALIST',
  REVIEW_SPECIALIST: 'REVIEW_SPECIALIST',
} as const;

export type AgentId = typeof AGENT_IDS[keyof typeof AGENT_IDS];
