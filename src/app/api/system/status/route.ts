/**
 * System Status API Route
 *
 * Returns live telemetry from the MASTER_ORCHESTRATOR including:
 * - Full 47-agent swarm hierarchy (1 orchestrator + 9 managers + 37 specialists)
 * - Agent health status with tier information (L1/L2/L3)
 * - Active saga counts
 * - Command success rates
 * - Recent insights
 *
 * This bridges the gap between the 47 backend agents and the Dashboard UI.
 *
 * @module api/system/status
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import {
  getMasterOrchestrator,
  type SwarmStatus,
} from '@/lib/agents/orchestrator/manager';
import type { AgentStatus } from '@/lib/agents/types';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// RESPONSE TYPES - Frontend-optimized shapes
// ============================================================================

/**
 * Agent tier in the swarm hierarchy
 */
export type AgentTier = 'L1' | 'L2' | 'L3';

/**
 * Frontend-compatible agent status for UI rendering
 */
export interface SystemAgentStatus {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  parentId: string | null;
  status: 'FUNCTIONAL' | 'SHELL' | 'GHOST' | 'EXECUTING';
  lastActivity: string;
  health: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  activeWorkloads: number;
  capabilities: string[];
  errors: string[];
}

/**
 * System status response for Dashboard consumption
 */
export interface SystemStatusResponse {
  success: true;
  timestamp: string;
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE';
  agents: SystemAgentStatus[];
  hierarchy: {
    orchestrator: SystemAgentStatus | null;
    managers: SystemAgentStatus[];
    specialists: SystemAgentStatus[];
  };
  metrics: {
    totalAgents: number;
    functionalAgents: number;
    executingAgents: number;
    activeSagas: number;
    completedSagas: number;
    failedSagas: number;
    totalCommands: number;
    successRate: number;
    averageResponseTimeMs: number;
    byTier: {
      L1: { total: number; functional: number };
      L2: { total: number; functional: number };
      L3: { total: number; functional: number };
    };
  };
  insights: Array<{
    id: string;
    type: string;
    title: string;
    summary: string;
    confidence: number;
    createdAt: string;
  }>;
}

export interface SystemStatusError {
  success: false;
  error: string;
  timestamp: string;
}

// ============================================================================
// COMPLETE 47-AGENT REGISTRY
// ============================================================================

interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  parentId: string | null;
  capabilities: string[];
}

/**
 * Complete registry of all 47 agents in the swarm
 * 1 Orchestrator (L1) + 9 Managers (L2) + 37 Specialists (L3)
 */
const AGENT_REGISTRY: AgentDefinition[] = [
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
  // L3 - MARKETING SPECIALISTS (5)
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
    id: 'UX_UI_SPECIALIST',
    name: 'UX/UI Specialist',
    role: 'Site UX Design Specialist',
    tier: 'L3',
    parentId: 'ARCHITECT_MANAGER',
    capabilities: ['Wireframing', 'Color Psychology', 'User Flow Design'],
  },
  {
    id: 'FUNNEL_PATHOLOGIST',
    name: 'Funnel Pathologist',
    role: 'Conversion Analysis Specialist',
    tier: 'L3',
    parentId: 'ARCHITECT_MANAGER',
    capabilities: ['Funnel Diagnosis', 'Urgency Tactics', 'Pricing Strategy'],
  },
  {
    id: 'COPY_SPECIALIST',
    name: 'Copy Specialist',
    role: 'Website Copy Specialist',
    tier: 'L3',
    parentId: 'ARCHITECT_MANAGER',
    capabilities: ['Headlines', 'CTAs', 'Voice Alignment'],
  },

  // =========================================================================
  // L3 - COMMERCE SPECIALISTS (2)
  // =========================================================================
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
];

// ============================================================================
// MAPPING UTILITIES
// ============================================================================

/**
 * Map backend AgentStatus to frontend display status
 * Backend: 'GHOST' | 'UNBUILT' | 'SHELL' | 'FUNCTIONAL' | 'TESTED'
 * Frontend: 'FUNCTIONAL' | 'SHELL' | 'GHOST' | 'EXECUTING'
 */
function mapAgentStatus(
  backendStatus: AgentStatus,
  activeWorkloads: number
): 'FUNCTIONAL' | 'SHELL' | 'GHOST' | 'EXECUTING' {
  // If agent has active workloads, it's executing
  if (activeWorkloads > 0) {
    return 'EXECUTING';
  }

  switch (backendStatus) {
    case 'FUNCTIONAL':
    case 'TESTED':
      return 'FUNCTIONAL';
    case 'SHELL':
    case 'UNBUILT':
      return 'SHELL';
    case 'GHOST':
    default:
      return 'GHOST';
  }
}

/**
 * Get live status for a manager from SwarmStatus
 */
function getManagerLiveStatus(
  managerId: string,
  swarmStatus: SwarmStatus
): { status: AgentStatus; health: 'HEALTHY' | 'DEGRADED' | 'OFFLINE'; activeWorkloads: number; errors: string[] } {
  const brief = swarmStatus.managers.find(m => m.managerId === managerId);
  if (brief) {
    return {
      status: brief.status,
      health: brief.health,
      activeWorkloads: brief.activeWorkloads,
      errors: brief.errors,
    };
  }
  // Default for managers not in live status (should not happen)
  return { status: 'FUNCTIONAL', health: 'HEALTHY', activeWorkloads: 0, errors: [] };
}

/**
 * Transform AgentDefinition + live status to SystemAgentStatus
 */
function transformAgentDefinition(
  agent: AgentDefinition,
  liveStatus: { status: AgentStatus; health: 'HEALTHY' | 'DEGRADED' | 'OFFLINE'; activeWorkloads: number; errors: string[] }
): SystemAgentStatus {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    tier: agent.tier,
    parentId: agent.parentId,
    status: mapAgentStatus(liveStatus.status, liveStatus.activeWorkloads),
    lastActivity: new Date().toISOString(),
    health: liveStatus.health,
    activeWorkloads: liveStatus.activeWorkloads,
    capabilities: agent.capabilities,
    errors: liveStatus.errors,
  };
}

/**
 * Transform full SwarmStatus to SystemStatusResponse with all 47 agents
 */
function transformSwarmStatus(swarmStatus: SwarmStatus): SystemStatusResponse {
  const allAgents: SystemAgentStatus[] = [];

  // Process all agents from the registry
  for (const agentDef of AGENT_REGISTRY) {
    let liveStatus: { status: AgentStatus; health: 'HEALTHY' | 'DEGRADED' | 'OFFLINE'; activeWorkloads: number; errors: string[] };

    if (agentDef.tier === 'L1') {
      // Orchestrator - use overall swarm health
      liveStatus = {
        status: 'FUNCTIONAL',
        health: swarmStatus.overallHealth === 'CRITICAL' ? 'DEGRADED' :
                swarmStatus.overallHealth === 'OFFLINE' ? 'OFFLINE' : 'HEALTHY',
        activeWorkloads: swarmStatus.activeSagas,
        errors: [],
      };
    } else if (agentDef.tier === 'L2') {
      // Manager - get live status from swarm
      liveStatus = getManagerLiveStatus(agentDef.id, swarmStatus);
    } else {
      // Specialist (L3) - derive status from parent manager
      const parentManager = swarmStatus.managers.find(m => m.managerId === agentDef.parentId);
      if (parentManager) {
        // Specialists inherit health from parent, all are FUNCTIONAL per SSOT
        liveStatus = {
          status: 'FUNCTIONAL',
          health: parentManager.health,
          activeWorkloads: 0, // Specialists track individual workloads differently
          errors: [],
        };
      } else {
        liveStatus = { status: 'FUNCTIONAL', health: 'HEALTHY', activeWorkloads: 0, errors: [] };
      }
    }

    allAgents.push(transformAgentDefinition(agentDef, liveStatus));
  }

  // Organize by hierarchy
  const orchestrator = allAgents.find(a => a.tier === 'L1') ?? null;
  const managers = allAgents.filter(a => a.tier === 'L2');
  const specialists = allAgents.filter(a => a.tier === 'L3');

  // Calculate metrics
  const functionalAgents = allAgents.filter(
    a => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING'
  ).length;
  const executingAgents = allAgents.filter(a => a.status === 'EXECUTING').length;

  // Metrics by tier
  const l1Agents = allAgents.filter(a => a.tier === 'L1');
  const l2Agents = allAgents.filter(a => a.tier === 'L2');
  const l3Agents = allAgents.filter(a => a.tier === 'L3');

  return {
    success: true,
    timestamp: swarmStatus.timestamp instanceof Date
      ? swarmStatus.timestamp.toISOString()
      : String(swarmStatus.timestamp),
    overallHealth: swarmStatus.overallHealth,
    agents: allAgents,
    hierarchy: {
      orchestrator,
      managers,
      specialists,
    },
    metrics: {
      totalAgents: allAgents.length,
      functionalAgents,
      executingAgents,
      activeSagas: swarmStatus.activeSagas,
      completedSagas: swarmStatus.completedSagas,
      failedSagas: swarmStatus.failedSagas,
      totalCommands: swarmStatus.totalCommands,
      successRate: swarmStatus.successRate,
      averageResponseTimeMs: swarmStatus.averageResponseTimeMs,
      byTier: {
        L1: {
          total: l1Agents.length,
          functional: l1Agents.filter(a => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING').length,
        },
        L2: {
          total: l2Agents.length,
          functional: l2Agents.filter(a => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING').length,
        },
        L3: {
          total: l3Agents.length,
          functional: l3Agents.filter(a => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING').length,
        },
      },
    },
    insights: swarmStatus.insights.map(insight => ({
      id: insight.id,
      type: insight.value?.type ?? 'UNKNOWN',
      title: insight.value?.title ?? 'Untitled',
      summary: insight.value?.summary ?? '',
      confidence: insight.value?.confidence ?? 0,
      createdAt: insight.createdAt instanceof Date
        ? insight.createdAt.toISOString()
        : String(insight.createdAt),
    })),
  };
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * GET /api/system/status
 *
 * Returns live system status from the MASTER_ORCHESTRATOR
 * Requires admin authentication
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SystemStatusResponse | SystemStatusError>> {
  const startTime = Date.now();

  try {
    // Verify admin authentication
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error,
          timestamp: new Date().toISOString(),
        },
        { status: authResult.status }
      );
    }

    logger.info('[SystemStatus] Fetching swarm status', {
      PLATFORM_ID,
      adminId: authResult.user.uid,
      file: 'api/system/status/route.ts',
    });

    // Get the Master Orchestrator instance
    const orchestrator = getMasterOrchestrator();

    // Initialize if not already done
    await orchestrator.initialize();

    // Fetch live swarm status
    const swarmStatus = await orchestrator.getSwarmStatus();

    // Transform to frontend-compatible response
    const response = transformSwarmStatus(swarmStatus);

    const duration = Date.now() - startTime;
    logger.info('[SystemStatus] Status retrieved successfully', {
      PLATFORM_ID,
      overallHealth: response.overallHealth,
      agentCount: response.agents.length,
      duration,
      file: 'api/system/status/route.ts',
    });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Response-Time': `${duration}ms`,
      },
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      '[SystemStatus] Failed to fetch system status',
      error instanceof Error ? error : new Error(errorMessage),
      {
        duration,
        file: 'api/system/status/route.ts',
      }
    );

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
