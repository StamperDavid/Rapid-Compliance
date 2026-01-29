/**
 * Agent Factory Registry
 * STATUS: PRODUCTION-READY
 *
 * Provides a unified registry for dynamic agent instantiation.
 * Maps all 47 AGENT_IDS to their corresponding getter functions.
 *
 * USAGE:
 * ```typescript
 * const agent = getAgentInstance('MARKETING_MANAGER');
 * await agent.initialize();
 * const report = await agent.execute(message);
 * ```
 *
 * SECURITY:
 * - All agents are validated against AGENT_IDS before instantiation
 * - Returns null for invalid/unknown agent IDs
 *
 * @module agents/agent-factory
 */

import { AGENT_IDS, type AgentId } from './index';
import type { BaseSpecialist } from './base-specialist';

// ============================================================================
// AGENT GETTER IMPORTS - All 47 Agents
// ============================================================================

// Orchestrator (L1)
import { getMasterOrchestrator } from './orchestrator/manager';

// Managers (L2)
import { getIntelligenceManager } from './intelligence/manager';
import { getMarketingManager } from './marketing/manager';
import { getBuilderManager } from './builder/manager';
import { getCommerceManager } from './commerce/manager';
import { getOutreachManager } from './outreach/manager';
import { getContentManager } from './content/manager';
import { getArchitectManager } from './architect/manager';
import { getRevenueDirector } from './sales/revenue/manager';
import { getReputationManager } from './trust/reputation/manager';

// Intelligence Specialists (L3)
import { getCompetitorResearcher } from './intelligence/competitor/specialist';
import { getSentimentAnalyst } from './intelligence/sentiment/specialist';
import { getTechnographicScout } from './intelligence/technographic/specialist';
import { getScraperSpecialist } from './intelligence/scraper/specialist';
import { getTrendScout } from './intelligence/trend/specialist';

// Marketing Specialists (L3)
import { getTikTokExpert } from './marketing/tiktok/specialist';
import { getTwitterExpert } from './marketing/twitter/specialist';
import { getFacebookAdsExpert } from './marketing/facebook/specialist';
import { getLinkedInExpert } from './marketing/linkedin/specialist';
import { getSEOExpert } from './marketing/seo/specialist';

// Builder Specialists (L3)
import { getUxUiArchitect } from './builder/ux-ui/specialist';
import { getFunnelEngineer } from './builder/funnel/specialist';
import { getAssetGenerator } from './builder/assets/specialist';
import { getWorkflowOptimizer } from './builder/workflow/specialist';

// Architect Specialists (L3)
import { getUXUISpecialist } from './architect/ux-ui/specialist';
import { getFunnelPathologist } from './architect/funnel/specialist';
import { getCopySpecialist } from './architect/copy/specialist';

// Commerce Specialists (L3)
import { getPricingStrategist } from './commerce/pricing/specialist';
import { getInventoryManager } from './commerce/inventory/specialist';

// Outreach Specialists (L3)
import { getEmailSpecialist } from './outreach/email/specialist';
import { getSmsSpecialist } from './outreach/sms/specialist';

// Content Specialists (L3)
import { getCopywriter } from './content/copywriter/specialist';
import { getCalendarCoordinator } from './content/calendar/specialist';
import { getVideoSpecialist } from './content/video/specialist';

// Sales Specialists (L3)
import { getMerchandiserSpecialist } from './sales/merchandiser/specialist';
import { getOutreachSpecialist } from './sales/outreach/specialist';
import { getLeadQualifierSpecialist } from './sales/qualifier/specialist';
import { getDealCloserSpecialist } from './sales/deal-closer/specialist';
import { getObjectionHandlerSpecialist } from './sales/objection-handler/specialist';

// Trust Specialists (L3)
import { getGMBSpecialist } from './trust/gmb/specialist';
import { getReviewSpecialist } from './trust/review/specialist';
import { getReviewManagerSpecialist } from './trust/review-manager/specialist';
import { getCaseStudyBuilderSpecialist } from './trust/case-study/specialist';

// ============================================================================
// AGENT FACTORY REGISTRY
// ============================================================================

/**
 * Agent getter function type
 */
type AgentGetter = () => BaseSpecialist;

/**
 * Registry mapping AgentId to getter functions
 * Uses const assertion for type safety
 */
const AGENT_FACTORY_REGISTRY: Record<AgentId, AgentGetter> = {
  // Orchestrator (L1)
  [AGENT_IDS.MASTER_ORCHESTRATOR]: getMasterOrchestrator,

  // Managers (L2)
  [AGENT_IDS.INTELLIGENCE_MANAGER]: getIntelligenceManager,
  [AGENT_IDS.MARKETING_MANAGER]: getMarketingManager,
  [AGENT_IDS.BUILDER_MANAGER]: getBuilderManager,
  [AGENT_IDS.COMMERCE_MANAGER]: getCommerceManager,
  [AGENT_IDS.OUTREACH_MANAGER]: getOutreachManager,
  [AGENT_IDS.CONTENT_MANAGER]: getContentManager,
  [AGENT_IDS.ARCHITECT_MANAGER]: getArchitectManager,
  [AGENT_IDS.REVENUE_DIRECTOR]: getRevenueDirector,
  [AGENT_IDS.REPUTATION_MANAGER]: getReputationManager,

  // Intelligence Specialists (L3)
  [AGENT_IDS.COMPETITOR_RESEARCHER]: getCompetitorResearcher,
  [AGENT_IDS.SENTIMENT_ANALYST]: getSentimentAnalyst,
  [AGENT_IDS.TECHNOGRAPHIC_SCOUT]: getTechnographicScout,
  [AGENT_IDS.SCRAPER_SPECIALIST]: getScraperSpecialist,
  [AGENT_IDS.TREND_SCOUT]: getTrendScout,

  // Marketing Specialists (L3)
  [AGENT_IDS.TIKTOK_EXPERT]: getTikTokExpert,
  [AGENT_IDS.TWITTER_EXPERT]: getTwitterExpert,
  [AGENT_IDS.FACEBOOK_EXPERT]: getFacebookAdsExpert,
  [AGENT_IDS.LINKEDIN_EXPERT]: getLinkedInExpert,
  [AGENT_IDS.SEO_EXPERT]: getSEOExpert,

  // Builder Specialists (L3)
  [AGENT_IDS.UX_UI_ARCHITECT]: getUxUiArchitect,
  [AGENT_IDS.FUNNEL_ENGINEER]: getFunnelEngineer,
  [AGENT_IDS.ASSET_GENERATOR]: getAssetGenerator,
  [AGENT_IDS.WORKFLOW_OPTIMIZER]: getWorkflowOptimizer,

  // Architect Specialists (L3)
  [AGENT_IDS.UX_UI_SPECIALIST]: getUXUISpecialist,
  [AGENT_IDS.FUNNEL_PATHOLOGIST]: getFunnelPathologist,
  [AGENT_IDS.COPY_SPECIALIST]: getCopySpecialist,

  // Commerce Specialists (L3)
  [AGENT_IDS.PRICING_STRATEGIST]: getPricingStrategist,
  [AGENT_IDS.INVENTORY_MANAGER]: getInventoryManager,

  // Outreach Specialists (L3)
  [AGENT_IDS.EMAIL_SPECIALIST]: getEmailSpecialist,
  [AGENT_IDS.SMS_SPECIALIST]: getSmsSpecialist,

  // Content Specialists (L3)
  [AGENT_IDS.COPYWRITER]: getCopywriter,
  [AGENT_IDS.CALENDAR_COORDINATOR]: getCalendarCoordinator,
  [AGENT_IDS.VIDEO_SPECIALIST]: getVideoSpecialist,

  // Sales Specialists (L3)
  [AGENT_IDS.MERCHANDISER]: getMerchandiserSpecialist,
  [AGENT_IDS.OUTREACH_SPECIALIST]: getOutreachSpecialist,
  [AGENT_IDS.LEAD_QUALIFIER]: getLeadQualifierSpecialist,
  [AGENT_IDS.DEAL_CLOSER]: getDealCloserSpecialist,
  [AGENT_IDS.OBJ_HANDLER]: getObjectionHandlerSpecialist,

  // Trust Specialists (L3)
  [AGENT_IDS.GMB_SPECIALIST]: getGMBSpecialist,
  [AGENT_IDS.REVIEW_SPECIALIST]: getReviewSpecialist,
  [AGENT_IDS.REV_MGR]: getReviewManagerSpecialist,
  [AGENT_IDS.CASE_STUDY]: getCaseStudyBuilderSpecialist,
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if a string is a valid AgentId
 */
export function isValidAgentId(agentId: string): agentId is AgentId {
  return Object.values(AGENT_IDS).includes(agentId as AgentId);
}

/**
 * Get an agent instance by ID
 * @param agentId - The agent ID from AGENT_IDS
 * @returns The agent instance or null if invalid
 */
export function getAgentInstance(agentId: string): BaseSpecialist | null {
  if (!isValidAgentId(agentId)) {
    return null;
  }

  const getter = AGENT_FACTORY_REGISTRY[agentId];
  if (!getter) {
    return null;
  }

  return getter();
}

/**
 * Get all valid agent IDs
 */
export function getAllAgentIds(): AgentId[] {
  return Object.values(AGENT_IDS);
}

/**
 * Get agent IDs by tier
 */
export function getAgentIdsByTier(tier: 'L1' | 'L2' | 'L3'): AgentId[] {
  const tierMap: Record<string, AgentId[]> = {
    L1: [AGENT_IDS.MASTER_ORCHESTRATOR],
    L2: [
      AGENT_IDS.INTELLIGENCE_MANAGER,
      AGENT_IDS.MARKETING_MANAGER,
      AGENT_IDS.BUILDER_MANAGER,
      AGENT_IDS.COMMERCE_MANAGER,
      AGENT_IDS.OUTREACH_MANAGER,
      AGENT_IDS.CONTENT_MANAGER,
      AGENT_IDS.ARCHITECT_MANAGER,
      AGENT_IDS.REVENUE_DIRECTOR,
      AGENT_IDS.REPUTATION_MANAGER,
    ],
    L3: [
      // Intelligence
      AGENT_IDS.COMPETITOR_RESEARCHER,
      AGENT_IDS.SENTIMENT_ANALYST,
      AGENT_IDS.TECHNOGRAPHIC_SCOUT,
      AGENT_IDS.SCRAPER_SPECIALIST,
      AGENT_IDS.TREND_SCOUT,
      // Marketing
      AGENT_IDS.TIKTOK_EXPERT,
      AGENT_IDS.TWITTER_EXPERT,
      AGENT_IDS.FACEBOOK_EXPERT,
      AGENT_IDS.LINKEDIN_EXPERT,
      AGENT_IDS.SEO_EXPERT,
      // Builder
      AGENT_IDS.UX_UI_ARCHITECT,
      AGENT_IDS.FUNNEL_ENGINEER,
      AGENT_IDS.ASSET_GENERATOR,
      AGENT_IDS.WORKFLOW_OPTIMIZER,
      // Architect
      AGENT_IDS.UX_UI_SPECIALIST,
      AGENT_IDS.FUNNEL_PATHOLOGIST,
      AGENT_IDS.COPY_SPECIALIST,
      // Commerce
      AGENT_IDS.PRICING_STRATEGIST,
      AGENT_IDS.INVENTORY_MANAGER,
      // Outreach
      AGENT_IDS.EMAIL_SPECIALIST,
      AGENT_IDS.SMS_SPECIALIST,
      // Content
      AGENT_IDS.COPYWRITER,
      AGENT_IDS.CALENDAR_COORDINATOR,
      AGENT_IDS.VIDEO_SPECIALIST,
      // Sales
      AGENT_IDS.MERCHANDISER,
      AGENT_IDS.OUTREACH_SPECIALIST,
      AGENT_IDS.LEAD_QUALIFIER,
      AGENT_IDS.DEAL_CLOSER,
      AGENT_IDS.OBJ_HANDLER,
      // Trust
      AGENT_IDS.GMB_SPECIALIST,
      AGENT_IDS.REVIEW_SPECIALIST,
      AGENT_IDS.REV_MGR,
      AGENT_IDS.CASE_STUDY,
    ],
  };

  return tierMap[tier] ?? [];
}

/**
 * Get the total count of registered agents
 */
export function getAgentCount(): number {
  return Object.keys(AGENT_FACTORY_REGISTRY).length;
}

/**
 * Export the registry for advanced use cases
 */
export { AGENT_FACTORY_REGISTRY };
