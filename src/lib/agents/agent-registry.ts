/**
 * Dynamic Agent Registry — Single Source of Truth
 *
 * All agent counts, hierarchy descriptions, and swarm summaries derive from
 * this array. Adding or removing an agent here auto-updates every consumer.
 *
 * @module lib/agents/agent-registry
 */

// ============================================================================
// TYPES
// ============================================================================

/** Agent tier in the swarm hierarchy */
export type AgentTier = 'L1' | 'L2' | 'L3' | 'STANDALONE';

/** Definition of an agent in the registry */
export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  parentId: string | null;
  capabilities: string[];
}

// ============================================================================
// COMPLETE AGENT REGISTRY
// ============================================================================

/**
 * Authoritative registry of every agent in the platform.
 * Counts are computed from this array — never hardcoded elsewhere.
 */
export const AGENT_REGISTRY: AgentDefinition[] = [
  // =========================================================================
  // L1 - MASTER ORCHESTRATOR (1)
  // =========================================================================
  {
    id: 'MASTER_ORCHESTRATOR',
    name: 'Master Orchestrator',
    role: 'Swarm CEO',
    tier: 'L1',
    parentId: null,
    capabilities: ['Goal Processing', 'Saga Orchestration', 'Domain Routing', 'Cross-Manager Coordination'],
  },

  // =========================================================================
  // L2 - MANAGERS (9)
  // =========================================================================
  {
    id: 'INTELLIGENCE_MANAGER',
    name: 'Intelligence Manager',
    role: 'Research & Analysis Commander',
    tier: 'L2',
    parentId: 'MASTER_ORCHESTRATOR',
    capabilities: ['Competitor Research', 'Market Analysis', 'Trend Detection', 'Sentiment Analysis'],
  },
  {
    id: 'MARKETING_MANAGER',
    name: 'Marketing Manager',
    role: 'Cross-Channel Marketing Commander',
    tier: 'L2',
    parentId: 'MASTER_ORCHESTRATOR',
    capabilities: ['Social Media Campaigns', 'SEO Strategy', 'Content Marketing', 'Brand DNA Integration'],
  },
  {
    id: 'BUILDER_MANAGER',
    name: 'Builder Manager',
    role: 'Site Construction Commander',
    tier: 'L2',
    parentId: 'MASTER_ORCHESTRATOR',
    capabilities: ['Blueprint-to-Deployment', 'Pixel Injection', 'Asset Generation', 'Vercel Deployment'],
  },
  {
    id: 'COMMERCE_MANAGER',
    name: 'Commerce Manager',
    role: 'Transactional Commerce Commander',
    tier: 'L2',
    parentId: 'MASTER_ORCHESTRATOR',
    capabilities: ['Checkout Orchestration', 'Subscription Management', 'Inventory Control', 'Revenue Reporting'],
  },
  {
    id: 'OUTREACH_MANAGER',
    name: 'Outreach Manager',
    role: 'Omni-Channel Communication Commander',
    tier: 'L2',
    parentId: 'MASTER_ORCHESTRATOR',
    capabilities: ['Email Sequences', 'SMS Campaigns', 'Channel Escalation', 'DNC Compliance'],
  },
  {
    id: 'CONTENT_MANAGER',
    name: 'Content Manager',
    role: 'Multi-Modal Production Commander',
    tier: 'L2',
    parentId: 'MASTER_ORCHESTRATOR',
    capabilities: ['SEO-to-Copy Injection', 'Brand DNA Compliance', 'Content Validation', 'Multi-Format Output'],
  },
  {
    id: 'ARCHITECT_MANAGER',
    name: 'Architect Manager',
    role: 'Strategic Infrastructure Commander',
    tier: 'L2',
    parentId: 'MASTER_ORCHESTRATOR',
    capabilities: ['Site Blueprinting', 'Technical Brief Generation', 'Industry Templates', 'Signal Broadcasting'],
  },
  {
    id: 'REVENUE_DIRECTOR',
    name: 'Revenue Director',
    role: 'Sales Operations Commander',
    tier: 'L2',
    parentId: 'MASTER_ORCHESTRATOR',
    capabilities: ['Pipeline Management', 'Lead Qualification', 'Deal Closing', 'Objection Handling'],
  },
  {
    id: 'REPUTATION_MANAGER',
    name: 'Reputation Manager',
    role: 'Brand Defense Commander',
    tier: 'L2',
    parentId: 'MASTER_ORCHESTRATOR',
    capabilities: ['Review Management', 'GMB Optimization', 'Trust Scoring', 'Sentiment Response'],
  },

  // =========================================================================
  // L3 - INTELLIGENCE SPECIALISTS (5)
  // =========================================================================
  {
    id: 'COMPETITOR_RESEARCHER',
    name: 'Competitor Researcher',
    role: 'Competitive Intelligence Specialist',
    tier: 'L3',
    parentId: 'INTELLIGENCE_MANAGER',
    capabilities: ['SWOT Analysis', 'Competitor Tracking', 'Market Positioning'],
  },
  {
    id: 'SENTIMENT_ANALYST',
    name: 'Sentiment Analyst',
    role: 'Brand Sentiment Specialist',
    tier: 'L3',
    parentId: 'INTELLIGENCE_MANAGER',
    capabilities: ['Sentiment Scoring', 'Trend Detection', 'Social Listening'],
  },
  {
    id: 'TECHNOGRAPHIC_SCOUT',
    name: 'Technographic Scout',
    role: 'Tech Stack Intelligence Specialist',
    tier: 'L3',
    parentId: 'INTELLIGENCE_MANAGER',
    capabilities: ['Tech Stack Analysis', 'Integration Discovery', 'Vendor Mapping'],
  },
  {
    id: 'SCRAPER_SPECIALIST',
    name: 'Scraper Specialist',
    role: 'Web Data Extraction Specialist',
    tier: 'L3',
    parentId: 'INTELLIGENCE_MANAGER',
    capabilities: ['Web Scraping', 'Data Extraction', 'Content Aggregation'],
  },
  {
    id: 'TREND_SCOUT',
    name: 'Trend Scout',
    role: 'Market Trends Specialist',
    tier: 'L3',
    parentId: 'INTELLIGENCE_MANAGER',
    capabilities: ['Trend Detection', 'Pattern Recognition', 'Market Forecasting'],
  },

  // =========================================================================
  // L3 - MARKETING SPECIALISTS (6)
  // =========================================================================
  {
    id: 'TIKTOK_EXPERT',
    name: 'TikTok Expert',
    role: 'TikTok Content Specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['Viral Content', 'Trend Riding', 'Short-Form Video'],
  },
  {
    id: 'TWITTER_EXPERT',
    name: 'Twitter/X Expert',
    role: 'Twitter Content Specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['Thread Writing', 'Engagement Strategy', 'Hashtag Optimization'],
  },
  {
    id: 'FACEBOOK_EXPERT',
    name: 'Facebook Ads Expert',
    role: 'Facebook Advertising Specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['Ad Copy', 'Audience Targeting', 'Campaign Optimization'],
  },
  {
    id: 'LINKEDIN_EXPERT',
    name: 'LinkedIn Expert',
    role: 'B2B LinkedIn Specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['B2B Posts', 'Professional Outreach', 'Thought Leadership'],
  },
  {
    id: 'SEO_EXPERT',
    name: 'SEO Expert',
    role: 'Search Optimization Specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['Keyword Research', 'On-Page SEO', 'Technical SEO'],
  },
  {
    id: 'GROWTH_ANALYST',
    name: 'Growth Analyst',
    role: 'Growth Analytics Specialist',
    tier: 'L3',
    parentId: 'MARKETING_MANAGER',
    capabilities: ['Metrics Aggregation', 'KPI Calculation', 'Pattern Identification', 'Weekly Reports'],
  },

  // =========================================================================
  // L3 - BUILDER SPECIALISTS (4)
  // =========================================================================
  {
    id: 'UX_UI_ARCHITECT',
    name: 'UX/UI Architect',
    role: 'Interface Design Specialist',
    tier: 'L3',
    parentId: 'BUILDER_MANAGER',
    capabilities: ['Design Systems', 'Component Libraries', 'Accessibility'],
  },
  {
    id: 'FUNNEL_ENGINEER',
    name: 'Funnel Engineer',
    role: 'Conversion Funnel Specialist',
    tier: 'L3',
    parentId: 'BUILDER_MANAGER',
    capabilities: ['Landing Pages', 'A/B Testing', 'Conversion Optimization'],
  },
  {
    id: 'ASSET_GENERATOR',
    name: 'Asset Generator',
    role: 'Digital Asset Specialist',
    tier: 'L3',
    parentId: 'BUILDER_MANAGER',
    capabilities: ['Logo Generation', 'Social Graphics', 'Brand Assets'],
  },
  {
    id: 'WORKFLOW_OPTIMIZER',
    name: 'Workflow Optimizer',
    role: 'Process Automation Specialist',
    tier: 'L3',
    parentId: 'BUILDER_MANAGER',
    capabilities: ['Automation Design', 'Workflow Mapping', 'Efficiency Analysis'],
  },

  // =========================================================================
  // L3 - ARCHITECT SPECIALISTS (3)
  // =========================================================================
  {
    id: 'UX_UI_STRATEGIST',
    name: 'UX/UI Strategist',
    role: 'Site UX Design Strategist',
    tier: 'L3',
    parentId: 'ARCHITECT_MANAGER',
    capabilities: ['Wireframing', 'Color Psychology', 'User Flow Design'],
  },
  {
    id: 'FUNNEL_STRATEGIST',
    name: 'Funnel Strategist',
    role: 'Conversion Analysis Strategist',
    tier: 'L3',
    parentId: 'ARCHITECT_MANAGER',
    capabilities: ['Funnel Diagnosis', 'Urgency Tactics', 'Pricing Strategy'],
  },
  {
    id: 'COPY_STRATEGIST',
    name: 'Copy Strategist',
    role: 'Website Copy Strategist',
    tier: 'L3',
    parentId: 'ARCHITECT_MANAGER',
    capabilities: ['Headlines', 'CTAs', 'Voice Alignment'],
  },

  // =========================================================================
  // L3 - COMMERCE SPECIALISTS (4)
  // =========================================================================
  {
    id: 'PAYMENT_SPECIALIST',
    name: 'Payment Specialist',
    role: 'Checkout & Payments Specialist',
    tier: 'L3',
    parentId: 'COMMERCE_MANAGER',
    capabilities: ['Checkout Sessions', 'Payment Intents', 'Refunds', 'Stripe Integration'],
  },
  {
    id: 'CATALOG_MANAGER',
    name: 'Catalog Manager',
    role: 'Product Catalog Specialist',
    tier: 'L3',
    parentId: 'COMMERCE_MANAGER',
    capabilities: ['Product CRUD', 'Variant Management', 'Catalog Search', 'Inventory Tracking'],
  },
  {
    id: 'PRICING_STRATEGIST',
    name: 'Pricing Strategist',
    role: 'Dynamic Pricing Specialist',
    tier: 'L3',
    parentId: 'COMMERCE_MANAGER',
    capabilities: ['Price Optimization', 'Discount Strategy', 'Revenue Modeling'],
  },
  {
    id: 'INVENTORY_MANAGER',
    name: 'Inventory Manager',
    role: 'Stock Management Specialist',
    tier: 'L3',
    parentId: 'COMMERCE_MANAGER',
    capabilities: ['Demand Forecasting', 'Stock Alerts', 'Reorder Optimization'],
  },

  // =========================================================================
  // L3 - OUTREACH SPECIALISTS (2)
  // =========================================================================
  {
    id: 'EMAIL_SPECIALIST',
    name: 'Email Specialist',
    role: 'Email Campaign Specialist',
    tier: 'L3',
    parentId: 'OUTREACH_MANAGER',
    capabilities: ['Email Sequences', 'Personalization', 'Deliverability'],
  },
  {
    id: 'SMS_SPECIALIST',
    name: 'SMS Specialist',
    role: 'SMS Outreach Specialist',
    tier: 'L3',
    parentId: 'OUTREACH_MANAGER',
    capabilities: ['SMS Campaigns', 'Compliance', 'Opt-Out Management'],
  },

  // =========================================================================
  // L3 - CONTENT SPECIALISTS (3)
  // =========================================================================
  {
    id: 'COPYWRITER',
    name: 'Copywriter',
    role: 'Content Copywriting Specialist',
    tier: 'L3',
    parentId: 'CONTENT_MANAGER',
    capabilities: ['Headlines', 'Product Descriptions', 'Ad Copy'],
  },
  {
    id: 'CALENDAR_COORDINATOR',
    name: 'Calendar Coordinator',
    role: 'Content Scheduling Specialist',
    tier: 'L3',
    parentId: 'CONTENT_MANAGER',
    capabilities: ['Content Scheduling', 'Optimal Timing', 'Cross-Platform Coordination'],
  },
  {
    id: 'VIDEO_SPECIALIST',
    name: 'Video Specialist',
    role: 'Video Production Specialist',
    tier: 'L3',
    parentId: 'CONTENT_MANAGER',
    capabilities: ['Storyboards', 'Script Writing', 'Video SEO'],
  },

  // =========================================================================
  // L3 - SALES SPECIALISTS (5)
  // =========================================================================
  {
    id: 'MERCHANDISER',
    name: 'Merchandiser Specialist',
    role: 'Product Merchandising Specialist',
    tier: 'L3',
    parentId: 'REVENUE_DIRECTOR',
    capabilities: ['Product Display', 'Category Management', 'Upsell Strategy'],
  },
  {
    id: 'OUTREACH_SPECIALIST',
    name: 'Sales Outreach Specialist',
    role: 'Sales Outreach Specialist',
    tier: 'L3',
    parentId: 'REVENUE_DIRECTOR',
    capabilities: ['Cold Outreach', 'Meeting Booking', 'Follow-Up Sequences'],
  },
  {
    id: 'LEAD_QUALIFIER',
    name: 'Lead Qualifier',
    role: 'Lead Qualification Specialist',
    tier: 'L3',
    parentId: 'REVENUE_DIRECTOR',
    capabilities: ['Lead Scoring', 'ICP Matching', 'Qualification Criteria'],
  },
  {
    id: 'DEAL_CLOSER',
    name: 'Deal Closer',
    role: 'Deal Closing Specialist',
    tier: 'L3',
    parentId: 'REVENUE_DIRECTOR',
    capabilities: ['Proposal Generation', 'Negotiation', 'Contract Handling'],
  },
  {
    id: 'OBJ_HANDLER',
    name: 'Objection Handler',
    role: 'Sales Objection Specialist',
    tier: 'L3',
    parentId: 'REVENUE_DIRECTOR',
    capabilities: ['Objection Responses', 'Battlecards', 'Competitive Positioning'],
  },

  // =========================================================================
  // L3 - TRUST/REPUTATION SPECIALISTS (4)
  // =========================================================================
  {
    id: 'GMB_SPECIALIST',
    name: 'GMB Specialist',
    role: 'Google My Business Specialist',
    tier: 'L3',
    parentId: 'REPUTATION_MANAGER',
    capabilities: ['GMB Optimization', 'Local SEO', 'Business Profile Management'],
  },
  {
    id: 'REVIEW_SPECIALIST',
    name: 'Review Specialist',
    role: 'Review Collection Specialist',
    tier: 'L3',
    parentId: 'REPUTATION_MANAGER',
    capabilities: ['Review Solicitation', 'Rating Analysis', 'Response Templates'],
  },
  {
    id: 'REV_MGR',
    name: 'Review Manager Specialist',
    role: 'Review Response Specialist',
    tier: 'L3',
    parentId: 'REPUTATION_MANAGER',
    capabilities: ['AI Response Generation', 'Sentiment-Based Replies', 'Escalation Handling'],
  },
  {
    id: 'CASE_STUDY',
    name: 'Case Study Builder',
    role: 'Case Study Specialist',
    tier: 'L3',
    parentId: 'REPUTATION_MANAGER',
    capabilities: ['Success Stories', 'ROI Documentation', 'Testimonial Collection'],
  },

  // =========================================================================
  // STANDALONE AGENTS (6) - Operate outside the swarm hierarchy
  // =========================================================================
  {
    id: 'JASPER',
    name: 'Jasper',
    role: 'Internal AI Assistant & Swarm Commander',
    tier: 'STANDALONE',
    parentId: null,
    capabilities: ['Swarm Command', 'Executive Briefings', 'System Orchestration', 'Employee Management', 'Strategic Guidance'],
  },
  {
    id: 'VOICE_AGENT_HANDLER',
    name: 'Voice Agent',
    role: 'Voice AI Agent',
    tier: 'STANDALONE',
    parentId: null,
    capabilities: ['AI Phone Conversations', 'Lead Qualification (Voice)', 'Deal Closing (Voice)', 'Warm Transfer'],
  },
  {
    id: 'AUTONOMOUS_POSTING_AGENT',
    name: 'Autonomous Posting Agent',
    role: 'Social Media Automation',
    tier: 'STANDALONE',
    parentId: null,
    capabilities: ['LinkedIn Posting', 'Twitter Posting', 'Content Scheduling', 'Queue Management'],
  },
  {
    id: 'CHAT_SESSION_SERVICE',
    name: 'Chat Session Service',
    role: 'Agent Infrastructure',
    tier: 'STANDALONE',
    parentId: null,
    capabilities: ['Session Management', 'Conversation Monitoring', 'Agent Instance Lifecycle', 'Golden Master Spawning'],
  },
  {
    id: 'AI_CHAT_SALES_AGENT',
    name: 'AI Chat Sales Agent',
    role: 'Customer-Facing Sales Agent',
    tier: 'STANDALONE',
    parentId: null,
    capabilities: ['Website Chat', 'Facebook Messenger', 'Lead Qualification', 'Product Questions', 'Trial Guidance', 'Demo Scheduling'],
  },
  {
    id: 'GROWTH_STRATEGIST',
    name: 'Growth Strategist',
    role: 'Chief Growth Officer',
    tier: 'STANDALONE',
    parentId: null,
    capabilities: ['Business Review', 'SEO Strategy', 'Ad Spend Analysis', 'Demographic Targeting', 'Channel Attribution', 'Strategic Briefing'],
  },
];

// ============================================================================
// COMPUTED STATS (calculated once at module init)
// ============================================================================

const l1Agents = AGENT_REGISTRY.filter(a => a.tier === 'L1');
const l2Agents = AGENT_REGISTRY.filter(a => a.tier === 'L2');
const l3Agents = AGENT_REGISTRY.filter(a => a.tier === 'L3');
const standaloneAgents = AGENT_REGISTRY.filter(a => a.tier === 'STANDALONE');
const swarmAgents = AGENT_REGISTRY.filter(a => a.tier !== 'STANDALONE');

/** Display names for L2 manager domains */
const DOMAIN_DISPLAY_NAMES: Record<string, string> = {
  INTELLIGENCE_MANAGER: 'Intelligence',
  MARKETING_MANAGER: 'Marketing',
  BUILDER_MANAGER: 'Builder',
  COMMERCE_MANAGER: 'Commerce',
  OUTREACH_MANAGER: 'Outreach',
  CONTENT_MANAGER: 'Content',
  ARCHITECT_MANAGER: 'Architecture',
  REVENUE_DIRECTOR: 'Revenue',
  REPUTATION_MANAGER: 'Reputation',
};

// ============================================================================
// GETTER FUNCTIONS
// ============================================================================

/** Total number of agents (all tiers) */
export function getAgentCount(): number {
  return AGENT_REGISTRY.length;
}

/** Number of agents in the swarm hierarchy (L1 + L2 + L3, excludes standalone) */
export function getSwarmAgentCount(): number {
  return swarmAgents.length;
}

/** Number of standalone agents */
export function getStandaloneCount(): number {
  return standaloneAgents.length;
}

/** Number of L2 managers (also = number of domains) */
export function getManagerCount(): number {
  return l2Agents.length;
}

/** Number of L3 specialists */
export function getSpecialistCount(): number {
  return l3Agents.length;
}

/** Number of L1 orchestrators */
export function getOrchestratorCount(): number {
  return l1Agents.length;
}

/** Number of domains (= number of L2 managers) */
export function getDomainCount(): number {
  return l2Agents.length;
}

/** Get all agents of a specific tier */
export function getAgentsByTier(tier: AgentTier): AgentDefinition[] {
  return AGENT_REGISTRY.filter(a => a.tier === tier);
}

/** Get a specific agent by ID */
export function getAgentById(id: string): AgentDefinition | undefined {
  return AGENT_REGISTRY.find(a => a.id === id);
}

/** Get all specialists under a specific manager */
export function getSpecialistsByManager(managerId: string): AgentDefinition[] {
  return AGENT_REGISTRY.filter(a => a.tier === 'L3' && a.parentId === managerId);
}

/** Get display names for all domains (derived from L2 managers) */
export function getDomainNames(): string[] {
  return l2Agents.map(m => DOMAIN_DISPLAY_NAMES[m.id] ?? m.name);
}

/**
 * Human-readable swarm summary.
 * Example: "52-agent AI swarm across 9 domains"
 */
export function getSwarmSummary(): string {
  return `${getAgentCount()}-agent AI swarm across ${getDomainCount()} domains`;
}

/**
 * Human-readable hierarchy breakdown.
 * Example: "1 Master Orchestrator + 9 Domain Managers + 36 Specialists + 6 Standalone"
 */
export function getHierarchySummary(): string {
  return `${l1Agents.length} Master Orchestrator + ${l2Agents.length} Domain Managers + ${l3Agents.length} Specialists + ${standaloneAgents.length} Standalone`;
}

/** Full stats breakdown object */
export function getAgentRegistryStats(): {
  total: number;
  orchestrators: number;
  managers: number;
  specialists: number;
  standalone: number;
  swarm: number;
  domains: number;
} {
  return {
    total: AGENT_REGISTRY.length,
    orchestrators: l1Agents.length,
    managers: l2Agents.length,
    specialists: l3Agents.length,
    standalone: standaloneAgents.length,
    swarm: swarmAgents.length,
    domains: l2Agents.length,
  };
}

/**
 * Build the hardcoded blueprint agent section dynamically.
 * Used by jasper-tools.ts getHardcodedBlueprintSection().
 */
export function buildAgentBlueprintSection(): string {
  const lines: string[] = [];
  lines.push(`${getAgentCount()} TOTAL AGENTS: ${getHierarchySummary()}`);
  lines.push('');
  lines.push(`MASTER ORCHESTRATOR (L1): ${l1Agents[0]?.role ?? 'Swarm CEO'} — command dispatch, saga workflows, intent-based domain routing`);
  lines.push('');
  lines.push(`${l2Agents.length} DOMAIN MANAGERS (L2):`);

  l2Agents.forEach((manager, idx) => {
    const specs = getSpecialistsByManager(manager.id);
    const specNames = specs.map(s => s.name).join(', ');
    lines.push(`${idx + 1}. ${manager.name} — ${specs.length} specialists (${specNames})`);
  });

  lines.push('');
  lines.push(`STANDALONE AGENTS (${standaloneAgents.length}):`);
  standaloneAgents.forEach(agent => {
    const capSummary = agent.capabilities.slice(0, 2).join(', ');
    lines.push(`- ${agent.name} (${agent.role} — ${capSummary})`);
  });

  return lines.join('\n');
}
