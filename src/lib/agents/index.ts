/**
 * Agent Swarm Index
 * STATUS: REGISTRY - Exports all agents for easy importing
 *
 * SWARM STATUS REPORT (Updated - 100% Swarm Completion)
 *
 * Total Agents: 52 (48 swarm + 4 standalone + 2 standalone new = 52 deployed)
 *   Swarm: 1 Orchestrator (L1) + 9 Managers (L2) + 38 Specialists (L3) = 48
 *   Standalone: Jasper, Voice Agent, Autonomous Posting, Chat Session Service,
 *               AI Chat Sales Agent, Growth Strategist = 6
 *
 * ORCHESTRATOR (1):
 * - MasterOrchestrator (Swarm CEO) - L1 orchestrator coordinating all managers
 *
 * MANAGERS (9):
 * - IntelligenceManager, MarketingManager, BuilderManager
 * - CommerceManager, OutreachManager, ContentManager
 * - ArchitectManager, RevenueDirector, ReputationManager
 *
 * SPECIALISTS (38):
 * - Intelligence: CompetitorResearcher, SentimentAnalyst, TechnographicScout, ScraperSpecialist, TrendScout
 * - Marketing: TikTokExpert, TwitterExpert, FacebookAdsExpert, LinkedInExpert, SEOExpert, GrowthAnalyst
 * - Builder: UxUiArchitect, FunnelEngineer, AssetGenerator, WorkflowOptimizer
 * - Architect: UXUISpecialist, FunnelPathologist, CopySpecialist
 * - Commerce: PricingStrategist, InventoryManagerAgent
 * - Outreach: EmailSpecialist, SmsSpecialist
 * - Content: Copywriter, CalendarCoordinator, VideoSpecialist
 * - Sales: MerchandiserSpecialist, OutreachSpecialist, LeadQualifierSpecialist, DealCloserSpecialist, ObjectionHandlerSpecialist
 * - Trust: GMBSpecialist, ReviewSpecialist, ReviewManagerSpecialist, CaseStudyBuilderSpecialist
 *
 * STANDALONE (6):
 * - Jasper (internal AI assistant), Voice Agent, Autonomous Posting, Chat Session Service
 * - AI Chat Sales Agent (customer-facing website/FB Messenger)
 * - Growth Strategist (Chief Growth Officer)
 *
 * Status Breakdown:
 * - FUNCTIONAL: 52 (100% operational)
 * - SHELL: 0 (All agents fully operational)
 * - GHOST: 0 (All specialists implemented)
 */

// Types
export * from './types';

// Base Classes
export { BaseSpecialist } from './base-specialist';
export { BaseManager } from './base-manager';

// ============================================================================
// SHARED MEMORY INFRASTRUCTURE
// ============================================================================

// Memory Vault - Cross-Agent Communication
export {
  MemoryVault,
  getMemoryVault,
  shareInsight,
  broadcastSignal,
  readAgentInsights,
  checkPendingSignals,
  type MemoryCategory,
  type MemoryPriority,
  type MemoryEntry,
  type InsightEntry,
  type InsightData,
  type SignalEntry,
  type SignalData,
  type ContentEntry,
  type ContentData,
  type CrossAgentEntry,
  type CrossAgentData,
} from './shared/memory-vault';

// ============================================================================
// MASTER ORCHESTRATOR (L1 Swarm CEO)
// ============================================================================

export {
  MasterOrchestrator,
  getMasterOrchestrator,
  type Command,
  type CommandType,
  type CommandResult,
  type ManagerId,
  type Saga,
  type SagaStep,
  type SagaStatus,
  type SagaTemplate,
  type IntentCategory,
  type RoutingRule,
  type UserGoal,
  type DecomposedTask,
  type GoalProcessingResult,
  type ManagerBrief,
  type SwarmStatus,
} from './orchestrator/manager';

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
export { TrendScout } from './intelligence/trend/specialist';

// Marketing Specialists
export { TikTokExpert } from './marketing/tiktok/specialist';
export { FacebookAdsExpert } from './marketing/facebook/specialist';
export { LinkedInExpert } from './marketing/linkedin/specialist';
export { SEOExpert } from './marketing/seo/specialist';
export { TwitterExpert, TwitterExpert as XExpert } from './marketing/twitter/specialist';
export { GrowthAnalyst } from './marketing/growth-analyst/specialist';

// Builder Specialists
export { UxUiArchitect } from './builder/ux-ui/specialist';
export { FunnelEngineer } from './builder/funnel/specialist';
export { AssetGenerator } from './builder/assets/specialist';
export { WorkflowOptimizer } from './builder/workflow/specialist';

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
export { VideoSpecialist } from './content/video/specialist';

// Sales Specialists
export { MerchandiserSpecialist } from './sales/merchandiser/specialist';
export { OutreachSpecialist } from './sales/outreach/specialist';
export { LeadQualifierSpecialist } from './sales/qualifier/specialist';
export { DealCloserSpecialist } from './sales/deal-closer/specialist';
export { ObjectionHandlerSpecialist } from './sales/objection-handler/specialist';

// Trust Specialists
export { GMBSpecialist } from './trust/gmb/specialist';
export { ReviewSpecialist } from './trust/review/specialist';
export { ReviewManagerSpecialist } from './trust/review-manager/specialist';
export { CaseStudyBuilderSpecialist } from './trust/case-study/specialist';

// ============================================================================
// STANDALONE AGENTS (outside swarm hierarchy)
// ============================================================================

// AI Chat Sales Agent (customer-facing website chat + Facebook Messenger)
export { SalesChatSpecialist } from './sales-chat/specialist';

// Growth Strategist (Chief Growth Officer - cross-domain business intelligence)
export { GrowthStrategist } from './growth-strategist/specialist';

// ============================================================================
// AGENT REGISTRY UTILITY
// ============================================================================

/**
 * Complete list of all agent IDs in the swarm
 */
export const AGENT_IDS = {
  // Master Orchestrator (L1)
  MASTER_ORCHESTRATOR: 'MASTER_ORCHESTRATOR',

  // Managers (L2)
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
  TREND_SCOUT: 'TREND_SCOUT',

  // Marketing Specialists
  TIKTOK_EXPERT: 'TIKTOK_EXPERT',
  TWITTER_EXPERT: 'TWITTER_EXPERT',
  FACEBOOK_EXPERT: 'FACEBOOK_EXPERT',
  LINKEDIN_EXPERT: 'LINKEDIN_EXPERT',
  SEO_EXPERT: 'SEO_EXPERT',
  GROWTH_ANALYST: 'GROWTH_ANALYST',

  // Builder Specialists
  UX_UI_ARCHITECT: 'UX_UI_ARCHITECT',
  FUNNEL_ENGINEER: 'FUNNEL_ENGINEER',
  ASSET_GENERATOR: 'ASSET_GENERATOR',
  WORKFLOW_OPTIMIZER: 'WORKFLOW_OPTIMIZER',

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
  VIDEO_SPECIALIST: 'VIDEO_SPECIALIST',

  // Sales Specialists
  MERCHANDISER: 'MERCHANDISER',
  OUTREACH_SPECIALIST: 'OUTREACH_SPECIALIST',
  LEAD_QUALIFIER: 'LEAD_QUALIFIER',
  DEAL_CLOSER: 'DEAL_CLOSER',
  OBJ_HANDLER: 'OBJ_HANDLER',

  // Trust Specialists
  GMB_SPECIALIST: 'GMB_SPECIALIST',
  REVIEW_SPECIALIST: 'REVIEW_SPECIALIST',
  REV_MGR: 'REV_MGR',
  CASE_STUDY: 'CASE_STUDY',

  // Standalone Agents
  AI_CHAT_SALES_AGENT: 'AI_CHAT_SALES_AGENT',
  GROWTH_STRATEGIST: 'GROWTH_STRATEGIST',
} as const;

export type AgentId = typeof AGENT_IDS[keyof typeof AGENT_IDS];
