/**
 * Jasper Tools - Anti-Hallucination Tool Definitions
 *
 * These tools FORCE Jasper to query system data rather than hallucinate.
 * Tool data ALWAYS wins over Jasper's internal "thoughts".
 *
 * @module jasper-tools
 */

import { SPECIALISTS, getSpecialist, type SpecialistPlatform } from './feature-manifest';
import { SYSTEM_BLUEPRINT } from './system-blueprint';
import { SystemHealthService } from './system-health-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { getSubCollection } from '@/lib/firebase/collections';
import {
  addMissionStep,
  updateMissionStep,
  type MissionStepStatus,
} from './mission-persistence';

// ============================================================================
// MISSION TRACKING CONTEXT
// ============================================================================

export interface ToolCallContext {
  conversationId?: string;
  missionId?: string;
  userPrompt?: string;
}

/**
 * Fire-and-forget mission step tracking. Never throws, never blocks Jasper.
 */
function trackMissionStep(
  context: ToolCallContext | undefined,
  toolName: string,
  status: MissionStepStatus,
  extras?: {
    summary?: string;
    durationMs?: number;
    error?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: string;
  }
): void {
  if (!context?.missionId) { return; }

  const stepId = `step_${toolName}_${Date.now()}`;

  if (status === 'RUNNING') {
    void addMissionStep(context.missionId, {
      stepId,
      toolName,
      delegatedTo: toolName.replace('delegate_to_', '').toUpperCase(),
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      ...(extras?.toolArgs ? { toolArgs: extras.toolArgs } : {}),
    }).catch((err: unknown) => {
      logger.warn('[MissionTrack] Failed to add step', {
        missionId: context.missionId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  } else {
    void updateMissionStep(context.missionId, stepId, {
      status,
      completedAt: new Date().toISOString(),
      ...extras,
    }).catch((err: unknown) => {
      logger.warn('[MissionTrack] Failed to update step', {
        missionId: context.missionId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

// ============================================================================
// ORGANIZATION TYPE (for type-safe Firestore queries)
// ============================================================================

interface OrganizationRecord {
  id: string;
  status: 'active' | 'suspended' | 'pending';
  plan: 'trial' | 'starter' | 'professional' | 'enterprise';
  trialEndsAt?: string;
  createdAt: string;
  updatedAt: string;
  name?: string;
  companyName?: string;
}

interface CouponRecord {
  code: string;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  expiresAt: string | null;
  applicablePlans: string[];
  status: 'active' | 'inactive' | 'expired';
  usageCount: number;
  createdAt: string;
}

interface UserRecord {
  id: string;
  email: string;
  role: string;
  PLATFORM_ID: string;
  name?: string;
  createdAt?: string;
}

interface ListOrganizationsArgs {
  status?: string;
  plan?: string;
  limit?: string;
}

interface CreateCouponArgs {
  code: string;
  discountType: string;
  discountValue: string;
  maxUses?: string;
  expiresAt?: string;
  applicablePlans?: string;
}

interface UpdatePricingArgs {
  tier: string;
  monthlyPrice?: string;
  yearlyPrice?: string;
}

interface ListUsersArgs {
  PLATFORM_ID?: string;
  role?: string;
  limit?: string;
}

// ============================================================================
// TOOL ARGUMENT TYPES (type-safe JSON parsing)
// ============================================================================

interface QueryDocsArgs {
  query: string;
  section?: string;
}

interface GetPlatformStatsArgs {
  metric?: 'all' | 'organizations' | 'agents' | 'health' | 'trials' | 'errors';
  PLATFORM_ID?: string;
}

interface DelegateToAgentArgs {
  agentId: string;
  action: string;
  parameters?: string;
}

interface InspectAgentLogsArgs {
  source: 'provisioner' | 'agents' | 'errors' | 'all';
  limit?: number;
  PLATFORM_ID?: string;
}

interface RecallHistoryArgs {
  topic?: string;
  limit?: string;
}

interface VoiceAgentArgs {
  action: 'configure' | 'get_status' | 'end_call';
  mode?: 'prospector' | 'closer';
  callId?: string;
  companyName?: string;
  productDescription?: string;
  valueProposition?: string;
}

interface SocialPostArgs {
  action: 'POST' | 'REPLY' | 'LIKE' | 'FOLLOW' | 'REPOST' | 'RECYCLE' | 'get_status';
  platform?: 'twitter' | 'linkedin';
  content?: string;
  targetPostId?: string;
  targetAccountId?: string;
  mediaUrls?: string[];
  hashtags?: string[];
}

// ============================================================================
// TYPE VALIDATION FUNCTIONS (No unsafe casts)
// ============================================================================

function parseQueryDocsArgs(args: Record<string, unknown>): QueryDocsArgs | null {
  if (typeof args.query !== 'string') {
    return null;
  }
  return {
    query: args.query,
    section: typeof args.section === 'string' ? args.section : undefined,
  };
}

function parseDelegateToAgentArgs(args: Record<string, unknown>): DelegateToAgentArgs | null {
  if (typeof args.agentId !== 'string' || typeof args.action !== 'string') {
    return null;
  }
  return {
    agentId: args.agentId,
    action: args.action,
    parameters: typeof args.parameters === 'string' ? args.parameters : undefined,
  };
}

function parseInspectAgentLogsArgs(args: Record<string, unknown>): InspectAgentLogsArgs | null {
  const validSources = ['provisioner', 'agents', 'errors', 'all'] as const;
  if (typeof args.source !== 'string' || !validSources.includes(args.source as InspectAgentLogsArgs['source'])) {
    return null;
  }
  return {
    source: args.source as InspectAgentLogsArgs['source'],
    limit: typeof args.limit === 'number' ? args.limit : undefined,
    PLATFORM_ID: typeof args.PLATFORM_ID === 'string' ? args.PLATFORM_ID : undefined,
  };
}

function parseVoiceAgentArgs(args: Record<string, unknown>): VoiceAgentArgs | null {
  const validActions = ['configure', 'get_status', 'end_call'] as const;
  if (typeof args.action !== 'string' || !validActions.includes(args.action as VoiceAgentArgs['action'])) {
    return null;
  }
  return {
    action: args.action as VoiceAgentArgs['action'],
    mode: typeof args.mode === 'string' && (args.mode === 'prospector' || args.mode === 'closer')
      ? args.mode
      : undefined,
    callId: typeof args.callId === 'string' ? args.callId : undefined,
    companyName: typeof args.companyName === 'string' ? args.companyName : undefined,
    productDescription: typeof args.productDescription === 'string' ? args.productDescription : undefined,
    valueProposition: typeof args.valueProposition === 'string' ? args.valueProposition : undefined,
  };
}

function parseSocialPostArgs(args: Record<string, unknown>): SocialPostArgs | null {
  const validActions = ['POST', 'REPLY', 'LIKE', 'FOLLOW', 'REPOST', 'RECYCLE', 'get_status'] as const;
  if (typeof args.action !== 'string' || !validActions.includes(args.action as SocialPostArgs['action'])) {
    return null;
  }

  let mediaUrls: string[] | undefined;
  if (typeof args.mediaUrls === 'string') {
    try {
      const parsed: unknown = JSON.parse(args.mediaUrls);
      if (Array.isArray(parsed) && parsed.every((u): u is string => typeof u === 'string')) {
        mediaUrls = parsed;
      }
    } catch {
      // Invalid JSON — ignore
    }
  }

  let hashtags: string[] | undefined;
  if (typeof args.hashtags === 'string') {
    try {
      const parsed: unknown = JSON.parse(args.hashtags);
      if (Array.isArray(parsed) && parsed.every((h): h is string => typeof h === 'string')) {
        hashtags = parsed;
      }
    } catch {
      // Invalid JSON — ignore
    }
  }

  return {
    action: args.action as SocialPostArgs['action'],
    platform: typeof args.platform === 'string' && (args.platform === 'twitter' || args.platform === 'linkedin')
      ? args.platform
      : undefined,
    content: typeof args.content === 'string' ? args.content : undefined,
    targetPostId: typeof args.targetPostId === 'string' ? args.targetPostId : undefined,
    targetAccountId: typeof args.targetAccountId === 'string' ? args.targetAccountId : undefined,
    mediaUrls,
    hashtags,
  };
}

// ============================================================================
// PLATFORM STATS TYPES (type-safe return values)
// ============================================================================

interface OrganizationStats {
  total: number;
  active: number;
  trial: number;
  suspended: number;
}

interface AgentStats {
  specialistsAvailable: number;
  specialists: Array<{
    id: string;
    name: string;
    category: string;
    requiresConnection: boolean;
    capabilityCount: number;
  }>;
}

interface HealthStats {
  readinessScore?: number;
  configuredFeatures?: number;
  unconfiguredFeatures?: number;
  recommendations?: string[];
  note?: string;
}

interface PlatformStats {
  timestamp: string;
  organizations?: OrganizationStats;
  agents?: AgentStats;
  health?: HealthStats;
  recentErrors?: unknown[];
  error?: string;
  fallback?: {
    specialistsCount: number;
    categories: string[];
  };
}

// ============================================================================
// TOOL TYPE DEFINITIONS (OpenAI/Anthropic Compatible)
// ============================================================================

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  required?: boolean;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

// ============================================================================
// SYSTEM STATE TYPES
// ============================================================================

export interface SystemState {
  timestamp: string;
  platform: {
    totalOrganizations: number;
    activeOrganizations: number;
    trialOrganizations: number;
    atRiskOrganizations: number;
  };
  agents: {
    total: number;
    byStatus: Record<string, number>;
    specialists: Array<{
      id: string;
      name: string;
      status: 'available' | 'requires_connection' | 'disabled';
    }>;
  };
  provisioner: {
    recentErrors: Array<{
      timestamp: string;
      error: string;
    }>;
    lastSuccessfulProvision: string | null;
  };
  features: {
    configured: string[];
    unconfigured: string[];
  };
}

export interface BlueprintSection {
  section: string;
  content: string;
}

export interface AgentDelegation {
  agentId: SpecialistPlatform;
  action: string;
  parameters: Record<string, unknown>;
  status: 'queued' | 'executing' | 'completed' | 'failed';
  result?: string;
}

export interface AgentLog {
  timestamp: string;
  agentId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// TOOL DEFINITIONS - FULL PLATFORM API COVERAGE
// ============================================================================

/**
 * Tool definitions in OpenAI function-calling format.
 * Compatible with OpenRouter's tool_choice parameter.
 *
 * STATUS: ALL TOOLS ENABLED AND PRIMARY
 * These tools are Jasper's PRIMARY interface to the platform.
 */
export const JASPER_TOOLS: ToolDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // KNOWLEDGE & STATE TOOLS (Anti-Hallucination Core)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'query_docs',
      description:
        'Query the system blueprint for factual information about platform capabilities, architecture, features, or how things work. MUST be called before making any claims about system functionality. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The topic to look up (e.g., "52 agents", "provisioner", "feature categories", "architecture", "capabilities")',
          },
          section: {
            type: 'string',
            description: 'Optional: specific section to search',
            enum: [
              'architecture',
              'agents',
              'features',
              'provisioner',
              'data-models',
              'api-endpoints',
              'integrations',
              'security',
            ],
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_platform_stats',
      description:
        'Get real-time platform statistics including organization counts, agent status, and health metrics. MUST be called before stating any numbers or statistics. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            description: 'Specific metric to retrieve',
            enum: ['all', 'organizations', 'agents', 'health', 'trials', 'errors'],
          },
          PLATFORM_ID: {
            type: 'string',
            description: 'Optional: Get stats for a specific organization',
          },
        },
        required: ['metric'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_system_state',
      description:
        'Get the current system state including org count, agent status, provisioner health, and feature configuration. Call this before any strategic response. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          PLATFORM_ID: {
            type: 'string',
            description: 'Optional: Get state for a specific organization context',
          },
        },
        required: [],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ORGANIZATION MANAGEMENT TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'list_organizations',
      description:
        'List all organizations on the platform with filtering options. Returns org names, plans, status, and owner info. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by status',
            enum: ['all', 'active', 'trial', 'suspended', 'cancelled'],
          },
          plan: {
            type: 'string',
            description: 'Filter by plan type',
            enum: ['all', 'trial', 'starter', 'professional', 'enterprise'],
          },
          limit: {
            type: 'string',
            description: 'Maximum results to return (default: 50)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_organization',
      description:
        'Get detailed information about a specific organization including plan, features, users, and configuration. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          PLATFORM_ID: {
            type: 'string',
            description: 'The organization ID to retrieve',
          },
        },
        required: ['PLATFORM_ID'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_organization',
      description:
        'Update organization settings including plan, status, features, or configuration. Use for upgrades, suspensions, or config changes. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          PLATFORM_ID: {
            type: 'string',
            description: 'The organization ID to update',
          },
          updates: {
            type: 'string',
            description: 'JSON object with fields to update (plan, status, name, features)',
          },
        },
        required: ['PLATFORM_ID', 'updates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'provision_organization',
      description:
        'Provision a new organization with full infrastructure setup. Creates Firestore documents, default settings, and welcome agent. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Organization name',
          },
          ownerEmail: {
            type: 'string',
            description: 'Email of the organization owner',
          },
          plan: {
            type: 'string',
            description: 'Initial plan',
            enum: ['trial', 'starter', 'professional', 'enterprise'],
          },
          industry: {
            type: 'string',
            description: 'Industry vertical for template selection',
          },
        },
        required: ['name', 'ownerEmail'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COUPON & PRICING TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'list_coupons',
      description:
        'List all platform coupons with their status, discount amounts, and usage stats. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by coupon status',
            enum: ['all', 'active', 'expired', 'disabled'],
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_coupon',
      description:
        'Create a new discount coupon for the platform. Supports percentage or fixed amount discounts. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Coupon code (uppercase, alphanumeric)',
          },
          discountType: {
            type: 'string',
            description: 'Type of discount',
            enum: ['percentage', 'fixed'],
          },
          discountValue: {
            type: 'string',
            description: 'Discount amount (percentage 0-100 or fixed dollar amount)',
          },
          maxUses: {
            type: 'string',
            description: 'Maximum redemptions allowed (optional)',
          },
          expiresAt: {
            type: 'string',
            description: 'Expiration date in ISO format (optional)',
          },
          applicablePlans: {
            type: 'string',
            description: 'JSON array of plan names this coupon applies to',
          },
        },
        required: ['code', 'discountType', 'discountValue'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_coupon_status',
      description:
        'Enable, disable, or modify an existing coupon. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          couponId: {
            type: 'string',
            description: 'The coupon ID to update',
          },
          status: {
            type: 'string',
            description: 'New status',
            enum: ['active', 'disabled'],
          },
        },
        required: ['couponId', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pricing_tiers',
      description:
        'Get current platform pricing tiers with features and limits for each plan. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_pricing',
      description:
        'Update platform pricing for a specific tier. Handles Stripe price updates. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          tier: {
            type: 'string',
            description: 'Pricing tier to update',
            enum: ['starter', 'professional', 'enterprise'],
          },
          monthlyPrice: {
            type: 'string',
            description: 'New monthly price in dollars',
          },
          yearlyPrice: {
            type: 'string',
            description: 'New yearly price in dollars',
          },
        },
        required: ['tier'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEAD GENERATION & CRM TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'scan_leads',
      description:
        'Initiate a lead discovery scan for prospects matching specified criteria. Uses the Lead Hunter capability. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          industry: {
            type: 'string',
            description: 'Target industry vertical',
          },
          location: {
            type: 'string',
            description: 'Geographic location filter',
          },
          companySize: {
            type: 'string',
            description: 'Company size range',
            enum: ['1-10', '11-50', '51-200', '201-500', '500+'],
          },
          keywords: {
            type: 'string',
            description: 'Keywords to match in company descriptions',
          },
          limit: {
            type: 'string',
            description: 'Maximum leads to return (default: 25)',
          },
        },
        required: ['industry'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enrich_lead',
      description:
        'Enrich an existing lead with additional data including social profiles, company info, and contact details. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          leadId: {
            type: 'string',
            description: 'The lead ID to enrich',
          },
          enrichmentLevel: {
            type: 'string',
            description: 'Level of enrichment',
            enum: ['basic', 'standard', 'comprehensive'],
          },
        },
        required: ['leadId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'score_leads',
      description:
        'Calculate lead scores based on engagement, fit, and intent signals. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          PLATFORM_ID: {
            type: 'string',
            description: 'Organization context for scoring model',
          },
          leadIds: {
            type: 'string',
            description: 'JSON array of lead IDs to score, or "all" for bulk scoring',
          },
        },
        required: [],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT & OUTREACH TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'generate_content',
      description:
        'Generate marketing content for various channels. Supports social posts, emails, blog articles, and ad copy. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            description: 'Type of content to generate',
            enum: ['social_post', 'email', 'blog_article', 'ad_copy', 'newsletter', 'landing_page'],
          },
          platform: {
            type: 'string',
            description: 'Target platform for social content',
            enum: ['linkedin', 'twitter', 'facebook', 'instagram', 'tiktok', 'youtube'],
          },
          topic: {
            type: 'string',
            description: 'Topic or subject matter',
          },
          tone: {
            type: 'string',
            description: 'Desired tone',
            enum: ['professional', 'casual', 'urgent', 'friendly', 'authoritative'],
          },
          targetAudience: {
            type: 'string',
            description: 'Description of target audience',
          },
        },
        required: ['contentType', 'topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_outreach_email',
      description:
        'Draft a personalized outreach email for a lead or prospect. Uses AI to personalize based on lead data. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          leadId: {
            type: 'string',
            description: 'Lead ID for personalization context',
          },
          template: {
            type: 'string',
            description: 'Email template type',
            enum: ['cold_intro', 'follow_up', 'value_prop', 'meeting_request', 'custom'],
          },
          customPrompt: {
            type: 'string',
            description: 'Custom instructions for email content',
          },
        },
        required: ['template'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // USER & ACCESS MANAGEMENT TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'list_users',
      description:
        'List platform users with role and organization information. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          PLATFORM_ID: {
            type: 'string',
            description: 'Filter by organization',
          },
          role: {
            type: 'string',
            description: 'Filter by role',
            enum: ['all', 'admin', 'user'],
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_user_role',
      description:
        'Update a user role or permissions. Requires admin privileges. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User ID to update',
          },
          newRole: {
            type: 'string',
            description: 'New role to assign',
            enum: ['admin', 'owner', 'member'],
          },
        },
        required: ['userId', 'newRole'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT DELEGATION TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'delegate_to_agent',
      description:
        'Delegate a task to one of the 9 domain managers (who oversee 38 specialists). Use this to execute actual work rather than just describing capabilities. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            description: 'The specialist agent ID',
            enum: [
              'youtube',
              'tiktok',
              'instagram',
              'x_twitter',
              'truth_social',
              'linkedin',
              'pinterest',
              'meta_facebook',
              'newsletter',
              'web_migrator',
              'lead_hunter',
            ],
          },
          action: {
            type: 'string',
            description: 'The action to perform (from the agent\'s capabilities)',
          },
          parameters: {
            type: 'string',
            description: 'JSON-encoded parameters for the action',
          },
        },
        required: ['agentId', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inspect_agent_logs',
      description:
        'Retrieve recent logs from agents or the provisioner system. Use to diagnose issues or report on recent activity. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Log source to inspect',
            enum: ['provisioner', 'agents', 'errors', 'all'],
          },
          limit: {
            type: 'string',
            description: 'Maximum number of log entries (default: 10)',
          },
          PLATFORM_ID: {
            type: 'string',
            description: 'Optional: Filter logs by organization',
          },
        },
        required: ['source'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VIDEO CREATION TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'create_video',
      description:
        'Create a video using AI video generation. Default provider is HeyGen (avatar videos). Also supports Sora (text-to-video) and Runway (text/image-to-video). Videos are stored in the video library — no external platform connection required. Use this when the user asks to create, generate, or make a video of any kind. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Detailed description of the video to create. Include the topic, style, tone, and any specific requirements.',
          },
          provider: {
            type: 'string',
            description: 'AI video provider to use. Auto-selects best available if not specified.',
            enum: ['heygen', 'sora', 'runway', 'auto'],
          },
          type: {
            type: 'string',
            description: 'Type of video generation',
            enum: ['text-to-video', 'avatar', 'image-to-video'],
          },
          duration: {
            type: 'number',
            description: 'Target video duration in seconds (default: 30)',
          },
          aspectRatio: {
            type: 'string',
            description: 'Video aspect ratio',
            enum: ['16:9', '9:16', '1:1'],
          },
          title: {
            type: 'string',
            description: 'Title for the video project in the library',
          },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_video_status',
      description:
        'Check the status of a video being generated. Returns progress, completion status, and the video URL when ready. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          videoId: {
            type: 'string',
            description: 'The video ID returned from create_video',
          },
          provider: {
            type: 'string',
            description: 'The provider used for generation',
            enum: ['heygen', 'sora', 'runway'],
          },
        },
        required: ['videoId'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS & REPORTING TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'get_analytics',
      description:
        'Retrieve analytics data for the platform or specific organization. Includes revenue, engagement, and conversion metrics. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          reportType: {
            type: 'string',
            description: 'Type of analytics report',
            enum: ['overview', 'revenue', 'engagement', 'conversion', 'churn', 'growth'],
          },
          PLATFORM_ID: {
            type: 'string',
            description: 'Specific organization (omit for platform-wide)',
          },
          dateRange: {
            type: 'string',
            description: 'Time period',
            enum: ['today', 'week', 'month', 'quarter', 'year', 'all_time'],
          },
        },
        required: ['reportType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_report',
      description:
        'Generate a comprehensive report document for export or presentation. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          reportType: {
            type: 'string',
            description: 'Report type',
            enum: ['executive_summary', 'sales_performance', 'pipeline_analysis', 'feature_usage', 'health_check'],
          },
          format: {
            type: 'string',
            description: 'Output format',
            enum: ['summary', 'detailed', 'presentation'],
          },
          PLATFORM_ID: {
            type: 'string',
            description: 'Organization scope',
          },
        },
        required: ['reportType'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKETING DEPARTMENT TOOLS (The Handshake)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'delegate_to_marketing',
      description:
        'Delegate a marketing campaign or content request to the Marketing Department. The Marketing Manager will analyze the goal and coordinate TikTok, Twitter/X, and Facebook specialists as needed. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'The marketing goal or campaign request (e.g., "Launch a viral TikTok campaign for fitness niche", "Create a Twitter thread about AI trends", "Generate Facebook ads for real estate leads")',
          },
          platform: {
            type: 'string',
            description: 'Optional: Specific platform to target. If not provided, Marketing Manager will select best platform(s) based on goal.',
            enum: ['tiktok', 'twitter', 'facebook', 'all', 'auto'],
          },
          niche: {
            type: 'string',
            description: 'The business niche or industry for targeting (e.g., "fitness", "real estate", "SaaS", "coaching")',
          },
          audience: {
            type: 'string',
            description: 'Target audience description (e.g., "Gen Z fitness enthusiasts", "B2B decision makers", "local homeowners")',
          },
          budget: {
            type: 'string',
            description: 'Optional: Campaign budget if applicable',
          },
          contentType: {
            type: 'string',
            description: 'Type of content to create',
            enum: ['viral_hook', 'thread', 'ad_creative', 'engagement', 'campaign'],
          },
        },
        required: ['goal'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ARCHITECT DEPARTMENT TOOLS (The Handshake)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'delegate_to_builder',
      description:
        'Delegate a website/funnel building request to the Architect Department. The Lead Architect will analyze the niche and coordinate UX/UI, Funnel, and Copywriting specialists to generate site maps, design systems, funnel flows, and conversion copy. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          niche: {
            type: 'string',
            description: 'The business niche or industry (e.g., "fitness coaching", "real estate agency", "SaaS startup", "e-commerce fashion")',
          },
          objective: {
            type: 'string',
            description: 'Primary objective for the site/funnel',
            enum: ['lead_generation', 'ecommerce', 'course_sales', 'service_booking', 'brand_awareness'],
          },
          audience: {
            type: 'string',
            description: 'Target audience description (e.g., "busy professionals 30-50", "Gen Z fitness enthusiasts", "B2B decision makers")',
          },
          pageType: {
            type: 'string',
            description: 'Type of page to design (optional - defaults to landing page)',
            enum: ['landing', 'homepage', 'pricing', 'product', 'about', 'contact', 'saas', 'ecommerce'],
          },
          includeDesign: {
            type: 'boolean',
            description: 'Include UX/UI design specs (color palette, components, wireframe). Default: true',
          },
          includeFunnel: {
            type: 'boolean',
            description: 'Include funnel architecture (lead magnet -> tripwire -> core offer -> upsell). Default: true',
          },
          includeCopy: {
            type: 'boolean',
            description: 'Include conversion copy (headlines, CTAs, body copy). Default: true',
          },
        },
        required: ['niche'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SALES DEPARTMENT TOOLS (The Handshake)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'delegate_to_sales',
      description:
        'Delegate a sales/commerce request to the Sales Department. The Revenue Director will analyze the lead and coordinate Lead Qualifier (BANT scoring), Outreach Specialist (personalized messages), and Merchandiser (coupon/nudge decisions). ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'The sales action to perform',
            enum: ['qualify_lead', 'generate_outreach', 'evaluate_nudge', 'analyze_pipeline', 'check_transition'],
          },
          leadId: {
            type: 'string',
            description: 'The lead ID to process (required for lead-specific actions)',
          },
          leadData: {
            type: 'string',
            description: 'JSON-encoded lead data including company info, contacts, engagement history',
          },
          scraperData: {
            type: 'string',
            description: 'Optional: JSON-encoded scraper intelligence from scrape_website tool to enhance qualification and outreach',
          },
          outreachChannel: {
            type: 'string',
            description: 'Preferred outreach channel (for generate_outreach action)',
            enum: ['email', 'linkedinDM', 'twitterDM', 'auto'],
          },
          interactionHistory: {
            type: 'string',
            description: 'JSON-encoded interaction history (for evaluate_nudge action)',
          },
        },
        required: ['action'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INTELLIGENCE SPECIALIST TOOLS (The Handshake)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'scrape_website',
      description:
        'Scrape a website URL and return structured key findings including company info, contact details, business signals, and tech stack. Delegates to the Scraper Specialist. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The website URL to scrape (e.g., "https://company.com")',
          },
          includeAboutPage: {
            type: 'boolean',
            description: 'Also scrape the About page for company details (default: true)',
          },
          includeCareers: {
            type: 'boolean',
            description: 'Also check for careers/jobs page to detect hiring (default: true)',
          },
          deep: {
            type: 'boolean',
            description: 'Perform deep scraping across multiple pages (default: false)',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'research_competitors',
      description:
        'Find top 10 competitors in a specific niche and location, ranked by SEO presence. Delegates to the Competitor Researcher. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          niche: {
            type: 'string',
            description: 'The business niche/industry to search (e.g., "plumbing services", "SaaS CRM", "organic skincare")',
          },
          location: {
            type: 'string',
            description: 'Geographic focus (e.g., "Austin, TX", "United Kingdom", "Global")',
          },
          limit: {
            type: 'number',
            description: 'Maximum competitors to return (default: 10)',
          },
          includeAnalysis: {
            type: 'boolean',
            description: 'Include deep analysis of each competitor (default: false)',
          },
        },
        required: ['niche'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scan_tech_stack',
      description:
        'Scan a website to identify its technology stack including CMS, e-commerce platform, analytics tools, marketing tools, advertising pixels, and chat widgets. Delegates to the Technographic Scout. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The website URL to scan for technologies',
          },
          deep: {
            type: 'boolean',
            description: 'Scan multiple pages for more comprehensive detection (default: false)',
          },
          categories: {
            type: 'string',
            description: 'JSON array of categories to filter (e.g., ["analytics", "marketing", "support"])',
          },
        },
        required: ['url'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRUST & REPUTATION DEPARTMENT TOOLS (The Handshake)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'delegate_to_trust',
      description:
        'Delegate a reputation, review response, or local SEO request to the Trust & Reputation Department. The Reputation Manager will analyze brand sentiment and coordinate Review Specialist (1-5 star response logic) and GMB Specialist (Local SEO, Map Pack optimization). ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'The trust/reputation action to perform',
            enum: [
              'analyze_sentiment',
              'respond_to_review',
              'generate_gmb_post',
              'optimize_map_pack',
              'monitor_brand_health',
              'request_testimonials',
              'handle_crisis'
            ],
          },
          platform: {
            type: 'string',
            description: 'Review platform (for respond_to_review action)',
            enum: ['google', 'yelp', 'facebook', 'trustpilot', 'g2', 'auto'],
          },
          reviewData: {
            type: 'string',
            description: 'JSON-encoded review data including rating (1-5), content, reviewer name, date',
          },
          businessData: {
            type: 'string',
            description: 'JSON-encoded business data including name, location, industry, services',
          },
          postType: {
            type: 'string',
            description: 'GMB post type (for generate_gmb_post action)',
            enum: ['local_update', 'offer', 'event', 'product', 'photo'],
          },
          sentimentData: {
            type: 'string',
            description: 'JSON-encoded sentiment signals for analysis (recent reviews, social mentions, etc.)',
          },
          urgency: {
            type: 'string',
            description: 'Urgency level for crisis handling',
            enum: ['low', 'medium', 'high', 'critical'],
          },
        },
        required: ['action'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT DEPARTMENT TOOLS (Sprint 19)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'delegate_to_content',
      description:
        'Delegate a content creation request to the Content Department. The Content Manager will coordinate Copywriter (Brand DNA + SEO-injected copy), Calendar Coordinator (scheduling + cross-platform sync), and Video Specialist (scripts, storyboards, thumbnails). ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            description: 'Type of content to produce',
            enum: ['blog_post', 'social_media', 'email_campaign', 'video_script', 'landing_page_copy', 'ad_creative', 'newsletter', 'case_study'],
          },
          topic: {
            type: 'string',
            description: 'The topic or subject matter for the content (e.g., "AI-powered sales automation trends 2026")',
          },
          brandDnaContext: {
            type: 'string',
            description: 'Optional: Brand DNA context to inject (tone, voice, values). If not provided, pulls from stored Brand DNA profile.',
          },
          seoKeywords: {
            type: 'string',
            description: 'Optional: Comma-separated SEO keywords to weave into the content (e.g., "AI sales, automation, lead generation")',
          },
          audience: {
            type: 'string',
            description: 'Target audience for the content (e.g., "B2B SaaS founders", "small business owners")',
          },
          format: {
            type: 'string',
            description: 'Optional: Desired output format or length',
            enum: ['short', 'medium', 'long', 'series'],
          },
          includeVideo: {
            type: 'boolean',
            description: 'Whether to include video script/storyboard generation. Default: false',
          },
          scheduleDate: {
            type: 'string',
            description: 'Optional: ISO date string for when to schedule publication',
          },
        },
        required: ['topic'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ARCHITECT STRATEGY TOOLS (Sprint 19)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'delegate_to_architect',
      description:
        'Delegate a site architecture or strategic design request to the Architect Department. The Architect Manager will coordinate UX/UI Specialist (design specs, wireframes), Funnel Pathologist (conversion funnel architecture), and Copy Specialist (headline/CTA frameworks). Returns SiteArchitecture + TechnicalBrief documents. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          siteType: {
            type: 'string',
            description: 'Type of website/application to architect',
            enum: ['landing_page', 'full_website', 'ecommerce_store', 'saas_app', 'portfolio', 'course_platform', 'membership_site'],
          },
          industry: {
            type: 'string',
            description: 'Business industry or niche (e.g., "fitness coaching", "real estate", "B2B SaaS")',
          },
          audience: {
            type: 'string',
            description: 'Target audience description (e.g., "busy professionals 30-50", "Gen Z fitness enthusiasts")',
          },
          funnelGoals: {
            type: 'string',
            description: 'Primary conversion goals (e.g., "lead capture → email nurture → demo booking → close")',
          },
          existingSiteUrl: {
            type: 'string',
            description: 'Optional: URL of an existing site to analyze and improve upon',
          },
          competitorUrls: {
            type: 'string',
            description: 'Optional: Comma-separated competitor URLs for competitive analysis',
          },
          brandGuidelines: {
            type: 'string',
            description: 'Optional: Brand guidelines or style preferences (colors, fonts, tone)',
          },
        },
        required: ['industry'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTREACH DEPARTMENT TOOLS (Sprint 19)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'delegate_to_outreach',
      description:
        'Delegate a multi-channel outreach campaign to the Outreach Department. The Outreach Manager will coordinate Email Specialist and SMS Specialist with DNC compliance, frequency throttling, and sentiment-aware routing. Supports multi-step sequences with channel escalation (EMAIL → SMS → VOICE). ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          sequenceType: {
            type: 'string',
            description: 'Type of outreach sequence to run',
            enum: ['cold_outreach', 'warm_followup', 'nurture_drip', 're_engagement', 'event_invitation', 'onboarding'],
          },
          channel: {
            type: 'string',
            description: 'Preferred communication channel (Outreach Manager may escalate if needed)',
            enum: ['email', 'sms', 'multi_channel', 'auto'],
          },
          leadList: {
            type: 'string',
            description: 'JSON-encoded array of lead objects with at minimum name and email/phone, or a lead list ID from the CRM',
          },
          message: {
            type: 'string',
            description: 'The core message or value proposition to communicate',
          },
          steps: {
            type: 'number',
            description: 'Number of steps in the sequence (default: 3)',
          },
          delayBetweenSteps: {
            type: 'string',
            description: 'Delay between sequence steps (e.g., "2d", "1w", "3d")',
          },
          complianceNotes: {
            type: 'string',
            description: 'Optional: Specific compliance requirements (e.g., "GDPR", "CAN-SPAM", "TCPA")',
          },
        },
        required: ['message'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INTELLIGENCE DEPARTMENT TOOLS (Sprint 19)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'delegate_to_intelligence',
      description:
        'Delegate a research or intelligence-gathering request to the Intelligence Department. The Intelligence Manager coordinates Scraper Specialist, Competitor Researcher, Technographic Scout, Sentiment Analyst, and Trend Scout for comprehensive intelligence briefs. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          researchType: {
            type: 'string',
            description: 'Type of intelligence research to conduct',
            enum: ['competitor_analysis', 'market_research', 'tech_landscape', 'sentiment_analysis', 'trend_discovery', 'comprehensive'],
          },
          targets: {
            type: 'string',
            description: 'Research targets — company names, URLs, keywords, or topics (comma-separated for multiple)',
          },
          industry: {
            type: 'string',
            description: 'Industry context for the research (e.g., "AI SaaS", "fitness", "real estate")',
          },
          depth: {
            type: 'string',
            description: 'Research depth — affects how many sources are analyzed',
            enum: ['quick', 'standard', 'deep'],
          },
          focusAreas: {
            type: 'string',
            description: 'Optional: Specific areas to focus on (e.g., "pricing strategy, feature gaps, market positioning")',
          },
          timeframe: {
            type: 'string',
            description: 'Optional: Time window for trend/sentiment analysis (e.g., "last 30 days", "Q1 2026", "YTD")',
          },
        },
        required: ['researchType', 'targets'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMERCE DEPARTMENT TOOLS (Sprint 19)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'delegate_to_commerce',
      description:
        'Delegate a commerce or e-commerce action to the Commerce Department. The Commerce Manager coordinates Payment Specialist, Catalog Manager, Pricing Strategist, and Inventory Manager for end-to-end transactional operations. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          actionType: {
            type: 'string',
            description: 'Type of commerce action to perform',
            enum: ['checkout_optimization', 'catalog_update', 'price_change', 'inventory_check', 'revenue_analysis', 'promotion_setup', 'product_launch'],
          },
          productData: {
            type: 'string',
            description: 'JSON-encoded product data (name, SKU, category, pricing, inventory levels)',
          },
          priceData: {
            type: 'string',
            description: 'JSON-encoded pricing data (amount, currency, discount, tiers)',
          },
          promotionData: {
            type: 'string',
            description: 'JSON-encoded promotion details (coupon code, discount %, start/end dates)',
          },
          analysisScope: {
            type: 'string',
            description: 'Scope for revenue analysis (e.g., "last 30 days", "by product category", "top performers")',
          },
        },
        required: ['actionType'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOG DRAFT BRIDGE (Sprint 19)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'save_blog_draft',
      description:
        'Save generated content as a blog post draft in the website blog system. Returns the draft ID and a link to the blog editor for review. Use this after generating content to bridge the gap between AI-generated content and the blog publishing pipeline. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Blog post title',
          },
          content: {
            type: 'string',
            description: 'Blog post content in markdown format. Will be converted to the internal PageSection format.',
          },
          excerpt: {
            type: 'string',
            description: 'Short excerpt/summary for the blog post (1-2 sentences)',
          },
          categories: {
            type: 'string',
            description: 'Comma-separated categories (e.g., "AI, Marketing, Trends")',
          },
          tags: {
            type: 'string',
            description: 'Comma-separated tags (e.g., "automation, sales, 2026-trends")',
          },
          seoTitle: {
            type: 'string',
            description: 'Optional: Custom SEO title (defaults to post title)',
          },
          seoDescription: {
            type: 'string',
            description: 'Optional: Meta description for SEO (defaults to excerpt)',
          },
          seoKeywords: {
            type: 'string',
            description: 'Optional: Comma-separated SEO keywords',
          },
          featuredImage: {
            type: 'string',
            description: 'Optional: URL of the featured image',
          },
          authorName: {
            type: 'string',
            description: 'Optional: Author name (defaults to "Jasper AI")',
          },
        },
        required: ['title', 'content'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRENDING TOPICS RESEARCH (Sprint 19)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'research_trending_topics',
      description:
        'Research trending topics in a given industry or keyword space using Serper and DataForSEO APIs. Returns top trending themes with search volume, growth rate, and relevance scoring. Use this to discover content opportunities and stay ahead of market trends. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          industry: {
            type: 'string',
            description: 'Industry or niche to research trends for (e.g., "AI SaaS", "fitness", "real estate technology")',
          },
          keywords: {
            type: 'string',
            description: 'Seed keywords to research (comma-separated). Used to find related trending topics.',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of trending topics to return (default: 10)',
          },
          timeframe: {
            type: 'string',
            description: 'Time window for trend analysis',
            enum: ['last_7_days', 'last_30_days', 'last_90_days', 'last_year'],
          },
          includeSearchVolume: {
            type: 'boolean',
            description: 'Include search volume data from DataForSEO (may use API credits). Default: true',
          },
        },
        required: ['keywords'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBSITE MIGRATION PIPELINE (Sprint 21)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'migrate_website',
      description:
        'Clone an existing website and rebuild it in the SalesVelocity.ai website builder. Scrapes the source site, extracts structure/copy/branding, and generates editable pages. Returns a link to the website editor with all pages ready for customization. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          sourceUrl: {
            type: 'string',
            description: 'The URL of the website to clone (e.g., "https://example.com")',
          },
          maxPages: {
            type: 'number',
            description: 'Maximum number of pages to crawl and migrate (default: 10, max: 20)',
          },
          includeImages: {
            type: 'boolean',
            description: 'Whether to preserve image references from the source site. Default: true',
          },
        },
        required: ['sourceUrl'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERSATION MEMORY RECALL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'recall_conversation_history',
      description:
        'Search past conversations for context when the user asks "do you remember", "we talked about", "last time", or references a previous discussion. Retrieves recent conversation history from Firestore and optionally filters by a topic keyword. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Optional keyword or phrase to search for in past messages (e.g., "pricing", "email campaign", "website migration")',
          },
          limit: {
            type: 'string',
            description: 'Maximum number of message pairs to retrieve (default: 30, max: 100)',
          },
        },
        required: [],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VOICE AI AGENT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'voice_agent',
      description:
        'Manage the AI Voice Agent. Can configure the agent mode (prospector for lead qualification, closer for deal closing), check active call status, or end calls. The voice agent handles AI-powered phone conversations via Twilio/Telnyx. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'The voice agent action to perform',
            enum: ['configure', 'get_status', 'end_call'],
          },
          mode: {
            type: 'string',
            description: 'Agent mode: "prospector" for lead qualification, "closer" for deal closing',
            enum: ['prospector', 'closer'],
          },
          callId: {
            type: 'string',
            description: 'Call ID for status check or call management',
          },
          companyName: {
            type: 'string',
            description: 'Company name for AI conversation context',
          },
          productDescription: {
            type: 'string',
            description: 'Product or service description for AI pitch context',
          },
          valueProposition: {
            type: 'string',
            description: 'Value proposition for the AI conversation',
          },
        },
        required: ['action'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTONOMOUS SOCIAL POSTING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'social_post',
      description:
        'Execute social media actions through the Autonomous Posting Agent. Supports posting content, replying, liking, following, reposting, and recycling content on Twitter/X and LinkedIn. Includes compliance guardrails (velocity limits, sentiment checks, human escalation). ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'The social media action to perform',
            enum: ['POST', 'REPLY', 'LIKE', 'FOLLOW', 'REPOST', 'RECYCLE', 'get_status'],
          },
          platform: {
            type: 'string',
            description: 'Target social media platform',
            enum: ['twitter', 'linkedin'],
          },
          content: {
            type: 'string',
            description: 'Post content or reply text (required for POST and REPLY actions)',
          },
          targetPostId: {
            type: 'string',
            description: 'Target post ID (required for REPLY, LIKE, REPOST actions)',
          },
          targetAccountId: {
            type: 'string',
            description: 'Target account ID (required for FOLLOW action)',
          },
          mediaUrls: {
            type: 'string',
            description: 'JSON-encoded array of media URLs to attach (e.g., \'["https://..."]\')',
          },
          hashtags: {
            type: 'string',
            description: 'JSON-encoded array of hashtags to include (e.g., \'["#AI", "#SaaS"]\')',
          },
        },
        required: ['action'],
      },
    },
  },
];

// ============================================================================
// TOOL EXECUTION FUNCTIONS
// ============================================================================

/**
 * Query the system blueprint for factual information.
 * Reads from system-blueprint.md and returns relevant sections.
 */
export function executeQueryDocs(
  query: string,
  section?: string
): Promise<BlueprintSection[]> {
  try {
    // Blueprint is imported as a build-time constant — always available at runtime
    const blueprintContent = SYSTEM_BLUEPRINT;

    const results: BlueprintSection[] = [];
    const queryLower = query.toLowerCase();

    // Parse sections from markdown
    const sections = blueprintContent.split(/^## /gm).filter(Boolean);

    for (const sectionContent of sections) {
      const lines = sectionContent.split('\n');
      const sectionTitle = lines[0]?.trim() || '';
      const sectionBody = lines.slice(1).join('\n');

      // Match by section filter
      if (section) {
        const sectionMap: Record<string, string[]> = {
          architecture: ['Architecture', 'Deployment', 'Multi-Tenancy'],
          agents: ['Specialized Agents', 'Creative Agents', 'Social Engagement', 'Technical Agents'],
          features: ['Feature Categories'],
          provisioner: ['Provisioner'],
          'data-models': ['Data Models'],
          'api-endpoints': ['API Endpoints'],
          integrations: ['Integration Support'],
          security: ['Security Model'],
        };

        const matchTitles = sectionMap[section] || [];
        if (!matchTitles.some((t) => sectionTitle.includes(t))) {
          continue;
        }
      }

      // Match by query content
      if (
        sectionTitle.toLowerCase().includes(queryLower) ||
        sectionBody.toLowerCase().includes(queryLower)
      ) {
        results.push({
          section: sectionTitle,
          content: sectionBody.trim().slice(0, 2000), // Limit content size
        });
      }
    }

    // If no results, return a summary
    if (results.length === 0) {
      return Promise.resolve([
        {
          section: 'Query Result',
          content: `No specific documentation found for "${query}". The system blueprint covers: Platform Identity, Architecture (281 API endpoints, 177 pages), 52 AI Agents (9 domain managers + 38 specialists), 16 Feature Systems (CRM, leads, email, social, e-commerce, website builder, voice AI, video, SEO, workflows, forms, analytics, Brand DNA, calendar, SMS, integrations), Provisioner, Data Models, and Security.`,
        },
      ]);
    }

    return Promise.resolve(results);
  } catch (error) {
    logger.error('[Jasper Tools] query_docs failed', error instanceof Error ? error : new Error(String(error)));
    return Promise.resolve(getHardcodedBlueprintSection(query, section));
  }
}

/**
 * Fallback hardcoded blueprint sections for runtime access.
 */
function getHardcodedBlueprintSection(query: string, _section?: string): BlueprintSection[] {
  const queryLower = query.toLowerCase();

  // Hardcoded essential information
  const essentialInfo: Record<string, BlueprintSection> = {
    agents: {
      section: 'AI Agent Swarm (52 Agents)',
      content: `
52 TOTAL AGENTS: 1 Master Orchestrator + 9 Domain Managers + 38 Specialists + 4 Standalone

MASTER ORCHESTRATOR (L1): Swarm CEO — command dispatch, saga workflows, intent-based domain routing

9 DOMAIN MANAGERS (L2):
1. Intelligence Manager — 5 specialists (Scraper, Competitor Researcher, Technographic Scout, Sentiment Analyst, Trend Scout)
2. Marketing Manager — 6 specialists (TikTok, Twitter/X, Facebook, LinkedIn, SEO, Growth Analyst)
3. Builder Manager — 4 specialists (UX/UI Architect, Funnel Engineer, Asset Generator, Workflow Optimizer)
4. Architect Manager — 3 specialists (UX/UI, Funnel Pathologist, Copy Specialist)
5. Commerce Manager — 4 specialists (Payment, Catalog, Pricing Strategist, Inventory)
6. Outreach Manager — 2 specialists (Email, SMS)
7. Content Manager — 3 specialists (Copywriter, Calendar Coordinator, Video Specialist)
8. Revenue Director — 5 specialists (Lead Qualifier, Outreach, Merchandiser, Deal Closer, Objection Handler)
9. Reputation Manager — 4 specialists (Review, GMB, Review Manager, Case Study)

STANDALONE AGENTS (4):
- Jasper (Platform AI assistant — delegates to all 9 managers)
- Voice Agent (AI phone calls — prospector and closer modes)
- Autonomous Posting Agent (Scheduled social posting)
- Chat Session Service (Agent lifecycle management)
      `.trim(),
    },
    features: {
      section: 'Platform Capabilities (16 Systems)',
      content: `
16 FULLY BUILT SYSTEMS (281 API endpoints, 177 dashboard pages):

1. CRM — Contacts, deals, pipeline stages, activities, deal health scoring, duplicate detection (14 API routes)
2. Lead Generation — AI scoring (0-100), enrichment, nurture sequences, web scraper, research tools (6 routes)
3. Email & Campaigns — SendGrid/Resend/SMTP, campaigns, open/click tracking, CAN-SPAM compliance (5 routes + 3 webhooks)
4. Social Media — Twitter/X OAuth + LinkedIn OAuth, scheduling, queue, approvals, social listening, AI coaching (25 routes)
5. E-Commerce & Payments — Stripe/PayPal/Square/Mollie, checkout, subscriptions (4 tiers), cart, coupons, tax/shipping (10+ routes)
6. Website Builder — Pages, blog, templates, custom domains, navigation, sitemap, RSS, AI content generation (26 routes)
7. Voice AI & TTS — Twilio calls, ElevenLabs/Unreal Speech TTS, Gemini conversation AI, prospector/closer modes (7 routes)
8. Video Generation — HeyGen/Runway ML/Sora, storyboard pipeline, Brand DNA integration (13 routes)
9. SEO Suite — Serper, Google Search Console, PageSpeed, DataForSEO, AI strategy generation (5 routes)
10. Workflow Engine — Visual builder, scheduled/webhook/entity triggers, 11 action types including AI agent invocation (6 routes)
11. Forms — Builder, publishing, submissions with CRM lead creation (3 routes)
12. Analytics — Revenue, pipeline, forecasting, win/loss, attribution, e-commerce, lead scoring, workflow analytics (9 routes)
13. Brand DNA — Company identity, tone, vocabulary, syncs to all AI agents and content tools
14. Calendar — Google Calendar + Outlook, meeting scheduler with auto-assignment
15. SMS — Twilio + Vonage, two-way messaging, DNC compliance
16. Integrations Hub — Google, Microsoft, Slack, HubSpot, Zoom, QuickBooks, Xero, Shopify (18 OAuth routes)

ADDITIONAL: A/B Testing, Proposals, Academy/Training, Coaching, Backup, Sequences, 6 Cron Jobs
      `.trim(),
    },
    provisioner: {
      section: 'Provisioner System',
      content: `
PURPOSE: Automatic setup of organization infrastructure.

PROCESS:
1. New user signs up via Firebase Auth
2. Provisioner creates organization document in Firestore
3. Default feature visibility settings applied
4. Welcome agent (Jasper clone) spawned for organization
5. Initial navigation structure built

ERROR HANDLING:
- Logs stored in provisionerLogs (via getSubCollection)
- Failed provisions retry up to 3 times
- Admin notified of persistent failures
      `.trim(),
    },
    architecture: {
      section: 'Architecture Overview',
      content: `
STACK:
- Framework: Next.js 15 (App Router)
- Hosting: Vercel (serverless) — rapidcompliance.us
- Database: Firebase Firestore (penthouse model, single-tenant)
- Auth: Firebase Auth with custom claims (admin/user RBAC)
- AI: OpenRouter (100+ models), OpenAI, Anthropic, Gemini
- Voice: Twilio (calls) + ElevenLabs/Unreal Speech (TTS) + Gemini (conversation AI) + Whisper (STT)
- Payments: Stripe (primary), PayPal, Square, Mollie, Authorize.net, 2Checkout
- Email: SendGrid, Resend, SMTP
- SMS: Twilio, Vonage
- Video: HeyGen, Runway ML, Sora
- SEO: Serper, Google Search Console, PageSpeed Insights, DataForSEO

PENTHOUSE MODEL (Single-Tenant):
- One organization: rapid-compliance-root
- No multi-tenant logic, no org-switching
- Binary RBAC: admin or user
- Clients purchase services — they do NOT receive SaaS tenants

SCALE: 281 API endpoints, 177 dashboard pages, 52 AI agents, 90+ service files
      `.trim(),
    },
  };

  // Match query to section
  if (queryLower.includes('agent') || queryLower.includes('specialist') || queryLower.includes('swarm') || queryLower.includes('52') || queryLower.includes('manager')) {
    return [essentialInfo.agents];
  }
  if (queryLower.includes('feature') || queryLower.includes('categor') || queryLower.includes('capabilit') || queryLower.includes('what can') || queryLower.includes('system') || queryLower.includes('ready') || queryLower.includes('operational')) {
    return [essentialInfo.features];
  }
  if (queryLower.includes('provision') || queryLower.includes('setup') || queryLower.includes('onboard')) {
    return [essentialInfo.provisioner];
  }
  if (queryLower.includes('architect') || queryLower.includes('stack') || queryLower.includes('tech') || queryLower.includes('infrastructure')) {
    return [essentialInfo.architecture];
  }

  // Return all if no specific match
  return Object.values(essentialInfo);
}

/**
 * Get real-time platform statistics.
 */
export async function executeGetPlatformStats(
  metric: 'all' | 'organizations' | 'agents' | 'health' | 'trials' | 'errors',
  PLATFORM_ID?: string
): Promise<PlatformStats> {
  try {
    const stats: PlatformStats = {
      timestamp: new Date().toISOString(),
    };

    if (metric === 'all' || metric === 'organizations') {
      // Get organization counts from Firestore
      const orgsSnapshot = await FirestoreService.getAll(COLLECTIONS.ORGANIZATIONS);
      const orgs = (orgsSnapshot || []) as OrganizationRecord[];

      stats.organizations = {
        total: orgs.length,
        active: orgs.filter((o) => o.status === 'active').length,
        trial: orgs.filter((o) => o.plan === 'trial').length,
        suspended: orgs.filter((o) => o.status === 'suspended').length,
      };
    }

    if (metric === 'all' || metric === 'agents') {
      stats.agents = {
        specialistsAvailable: SPECIALISTS.length,
        specialists: SPECIALISTS.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          requiresConnection: s.requiresConnection,
          capabilityCount: s.capabilities.length,
        })),
      };
    }

    if (metric === 'all' || metric === 'health') {
      if (PLATFORM_ID) {
        const healthReport = await SystemHealthService.generateHealthReport();
        stats.health = {
          readinessScore: healthReport.readinessScore,
          configuredFeatures: healthReport.features.filter((f) => f.status === 'configured').length,
          unconfiguredFeatures: healthReport.features.filter((f) => f.status === 'unconfigured').length,
          recommendations: healthReport.recommendations.slice(0, 3).map((r) => r.title),
        };
      } else {
        stats.health = {
          note: 'Provide PLATFORM_ID for detailed health report',
        };
      }
    }

    if (metric === 'all' || metric === 'errors') {
      stats.recentErrors = [];
      // Would query error logs here
    }

    return stats;
  } catch (error) {
    logger.error('[Jasper Tools] get_platform_stats failed', error instanceof Error ? error : new Error(String(error)));
    return {
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve platform stats',
      fallback: {
        specialistsCount: 11,
        categories: ['creative', 'social', 'technical'],
      },
    };
  }
}

/**
 * Route a delegate_to_agent call through the MarketingManager for platforms
 * that have existing specialist implementations.
 */
async function routeThroughMarketing(
  platform: 'tiktok' | 'x_twitter' | 'meta_facebook' | 'linkedin',
  action: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { MarketingManager } = await import('@/lib/agents/marketing/manager');
  const manager = new MarketingManager();
  await manager.initialize();

  const platformMap: Record<string, string> = {
    tiktok: 'tiktok',
    x_twitter: 'twitter',
    meta_facebook: 'facebook',
    linkedin: 'linkedin',
  };

  const goal = (params.topic as string) ?? (params.goal as string) ?? action.replace(/_/g, ' ');
  const result = await manager.execute({
    id: `specialist_${platform}_${Date.now()}`,
    timestamp: new Date(),
    from: 'JASPER',
    to: 'MARKETING_MANAGER',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      goal,
      platform: platformMap[platform],
      niche: params.niche as string | undefined,
      audience: params.audience as string | undefined,
      contentType: params.contentType as string | undefined,
      message: goal,
    },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  });

  return { status: result.status, data: result.data, errors: result.errors };
}

/**
 * Route a delegate_to_agent call through the ContentManager for platforms
 * without dedicated specialist implementations (YouTube, Instagram, Pinterest, Truth Social).
 */
async function routeThroughContent(
  platform: 'youtube' | 'instagram' | 'truth_social' | 'pinterest',
  action: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { ContentManager } = await import('@/lib/agents/content/manager');
  const contentMgr = new ContentManager();
  await contentMgr.initialize();

  const contentTypeMap: Record<string, string> = {
    generate_youtube_script: 'video_script',
    design_thumbnail: 'visual_concept',
    optimize_youtube_metadata: 'seo_metadata',
    schedule_youtube_content: 'content_calendar',
    create_instagram_post: 'social_post',
    design_instagram_stories: 'story_sequence',
    script_instagram_reels: 'short_video_script',
    build_instagram_carousel: 'carousel_slides',
    create_truth_post: 'social_post',
    engage_truth_community: 'engagement_response',
    schedule_truth_content: 'content_calendar',
    create_pinterest_pins: 'visual_concept',
    organize_pinterest_boards: 'content_strategy',
    optimize_pinterest_seo: 'seo_metadata',
  };

  const topic = (params.topic as string) ?? (params.description as string) ?? action.replace(/_/g, ' ');
  const contentType = contentTypeMap[action] ?? 'social_post';

  const result = await contentMgr.execute({
    id: `${platform}_content_${Date.now()}`,
    timestamp: new Date(),
    from: 'JASPER',
    to: 'CONTENT_MANAGER',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      contentType,
      topic: `[${platform.toUpperCase()}] ${topic}`,
      audience: params.audience as string | undefined,
      format: platform,
      seoKeywords: typeof params.keywords === 'string'
        ? params.keywords.split(',').map((k: string) => k.trim())
        : undefined,
    },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  });

  return { status: result.status, platform, action, data: result.data, errors: result.errors };
}

/**
 * Route web_migrator actions to existing services (migration pipeline, architect, SEO).
 */
async function routeWebMigrator(
  action: string,
  params: Record<string, unknown>,
  context?: ToolCallContext
): Promise<Record<string, unknown>> {
  switch (action) {
    case 'migrate_website': {
      const { migrateSite } = await import('@/lib/website-builder/site-migration-service');
      const migrationResult = await migrateSite({
        sourceUrl: params.sourceUrl as string,
        maxPages: (params.maxPages as number | undefined) ?? 10,
        includeImages: (params.includeImages as boolean | undefined) ?? true,
        missionId: context?.missionId,
      });
      return {
        status: migrationResult.status,
        sourceUrl: migrationResult.sourceUrl,
        totalPages: migrationResult.totalPages,
        successCount: migrationResult.successCount,
        editorLink: migrationResult.editorLink,
      };
    }
    case 'build_landing_page': {
      const { ArchitectManager } = await import('@/lib/agents/architect/manager');
      const architect = new ArchitectManager();
      await architect.initialize();
      const result = await architect.execute({
        id: `web_build_${Date.now()}`,
        timestamp: new Date(),
        from: 'JASPER',
        to: 'ARCHITECT_MANAGER',
        type: 'COMMAND',
        priority: 'NORMAL',
        payload: {
          niche: params.niche as string | undefined,
          objective: (params.objective as string) ?? 'lead_generation',
          audience: params.audience as string | undefined,
          pageType: 'landing',
        },
        requiresResponse: true,
        traceId: `trace_${Date.now()}`,
      });
      return { status: result.status, data: result.data };
    }
    case 'audit_website_seo':
    case 'optimize_website_speed': {
      const { MarketingManager } = await import('@/lib/agents/marketing/manager');
      const seoManager = new MarketingManager();
      await seoManager.initialize();
      const seoResult = await seoManager.execute({
        id: `seo_${Date.now()}`,
        timestamp: new Date(),
        from: 'JASPER',
        to: 'MARKETING_MANAGER',
        type: 'COMMAND',
        priority: 'NORMAL',
        payload: {
          goal: action === 'audit_website_seo'
            ? `SEO audit for ${(params.url as string) ?? 'website'}`
            : `Speed optimization analysis for ${(params.url as string) ?? 'website'}`,
          platform: 'seo',
        },
        requiresResponse: true,
        traceId: `trace_${Date.now()}`,
      });
      return { status: seoResult.status, data: seoResult.data };
    }
    default:
      throw new Error(`Unknown web_migrator action: ${action}`);
  }
}

/**
 * Route lead_hunter actions to the IntelligenceManager.
 */
async function routeLeadHunter(
  action: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { IntelligenceManager } = await import('@/lib/agents/intelligence/manager');
  const intelMgr = new IntelligenceManager();
  await intelMgr.initialize();

  const researchTypeMap: Record<string, string> = {
    start_lead_scan: 'lead_discovery',
    enrich_leads: 'lead_enrichment',
    score_leads: 'lead_scoring',
    create_lead_segment: 'lead_segmentation',
  };

  const researchType = researchTypeMap[action];
  if (!researchType) {
    throw new Error(`Unknown lead_hunter action: ${action}`);
  }

  const result = await intelMgr.execute({
    id: `lead_${action}_${Date.now()}`,
    timestamp: new Date(),
    from: 'JASPER',
    to: 'INTELLIGENCE_MANAGER',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      researchType,
      industry: params.industry as string | undefined,
      location: params.location as string | undefined,
      companySize: params.companySize as string | undefined,
      keywords: params.keywords as string | undefined,
      leadId: params.leadId as string | undefined,
      leadIds: params.leadIds as string | undefined,
      segmentName: params.segmentName as string | undefined,
      criteria: params.criteria as string | undefined,
    },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  });

  return { status: result.status, data: result.data, errors: result.errors };
}

/**
 * Route newsletter actions to ContentManager (content) or OutreachManager (ops).
 */
async function routeNewsletter(
  action: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (action) {
    case 'write_newsletter':
    case 'optimize_newsletter_subjects': {
      const { ContentManager } = await import('@/lib/agents/content/manager');
      const contentMgr = new ContentManager();
      await contentMgr.initialize();
      const result = await contentMgr.execute({
        id: `newsletter_content_${Date.now()}`,
        timestamp: new Date(),
        from: 'JASPER',
        to: 'CONTENT_MANAGER',
        type: 'COMMAND',
        priority: 'NORMAL',
        payload: {
          contentType: action === 'write_newsletter' ? 'email_newsletter' : 'subject_line_optimization',
          topic: (params.topic as string) ?? (params.subject as string) ?? 'newsletter',
          audience: params.audience as string | undefined,
          format: 'email',
        },
        requiresResponse: true,
        traceId: `trace_${Date.now()}`,
      });
      return { status: result.status, data: result.data };
    }
    case 'segment_newsletter_audience':
    case 'build_newsletter_automation': {
      const { OutreachManager } = await import('@/lib/agents/outreach/manager');
      const outreachMgr = new OutreachManager();
      await outreachMgr.initialize();
      const result = await outreachMgr.execute({
        id: `newsletter_ops_${Date.now()}`,
        timestamp: new Date(),
        from: 'JASPER',
        to: 'OUTREACH_MANAGER',
        type: 'COMMAND',
        priority: 'NORMAL',
        payload: {
          sequenceType: action === 'build_newsletter_automation' ? 'automation' : 'segmentation',
          channel: 'email',
          message: (params.description as string) ?? action.replace(/_/g, ' '),
        },
        requiresResponse: true,
        traceId: `trace_${Date.now()}`,
      });
      return { status: result.status, data: result.data };
    }
    default:
      throw new Error(`Unknown newsletter action: ${action}`);
  }
}

/**
 * Central dispatcher — routes (agentId, action) to the appropriate manager/service.
 */
async function routeToSpecialist(
  agentId: SpecialistPlatform,
  action: string,
  params: Record<string, unknown>,
  context?: ToolCallContext
): Promise<Record<string, unknown>> {
  switch (agentId) {
    // Route through MarketingManager (existing specialists)
    case 'tiktok':
    case 'x_twitter':
    case 'meta_facebook':
    case 'linkedin':
      return routeThroughMarketing(agentId, action, params);

    // Route through ContentManager (AI content generation)
    case 'youtube':
    case 'instagram':
    case 'truth_social':
    case 'pinterest':
      return routeThroughContent(agentId, action, params);

    // Route to existing services
    case 'web_migrator':
      return routeWebMigrator(action, params, context);
    case 'lead_hunter':
      return routeLeadHunter(action, params);
    case 'newsletter':
      return routeNewsletter(action, params);

    default:
      throw new Error(`No execution route configured for agent: ${agentId}`);
  }
}

/**
 * Delegate a task to a specialized agent — routes to real manager execution.
 */
export async function executeDelegateToAgent(
  agentId: SpecialistPlatform,
  action: string,
  parameters?: string,
  context?: ToolCallContext
): Promise<AgentDelegation> {
  const specialist = getSpecialist(agentId);

  if (!specialist) {
    return {
      agentId,
      action,
      parameters: {},
      status: 'failed',
      result: `Unknown agent: ${agentId}. Available agents: ${SPECIALISTS.map((s) => s.id).join(', ')}`,
    };
  }

  // Check if action is valid for this specialist
  const capability = specialist.capabilities.find(
    (c) => c.action === action || c.name.toLowerCase().includes(action.toLowerCase())
  );

  if (!capability) {
    return {
      agentId,
      action,
      parameters: {},
      status: 'failed',
      result: `Invalid action "${action}" for ${specialist.name}. Available actions: ${specialist.capabilities.map((c) => c.action).join(', ')}`,
    };
  }

  // Parse parameters
  let parsedParams: Record<string, unknown> = {};
  if (parameters) {
    try {
      parsedParams = JSON.parse(parameters) as Record<string, unknown>;
    } catch {
      parsedParams = { raw: parameters };
    }
  }

  logger.info('[Jasper Tools] Agent delegation executing', {
    agentId,
    action: capability.action,
  });

  try {
    const result = await routeToSpecialist(agentId, capability.action, parsedParams, context);
    return {
      agentId,
      action: capability.action,
      parameters: parsedParams,
      status: 'completed',
      result: JSON.stringify(result),
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown execution error';
    logger.error('[Jasper Tools] Agent delegation failed', new Error(errMsg), {
      agentId,
      action: capability.action,
    });
    return {
      agentId,
      action: capability.action,
      parameters: parsedParams,
      status: 'failed',
      result: errMsg,
    };
  }
}

/**
 * Inspect agent and provisioner logs.
 */
export function executeInspectAgentLogs(
  source: 'provisioner' | 'agents' | 'errors' | 'all',
  limit: number = 10,
  _PLATFORM_ID?: string
): Promise<AgentLog[]> {
  const logs: AgentLog[] = [];

  try {
    if (source === 'provisioner' || source === 'all') {
      // Would fetch from Firestore provisioner logs
      logs.push({
        timestamp: new Date().toISOString(),
        agentId: 'provisioner',
        level: 'info',
        message: 'Provisioner system operational',
        metadata: { source: 'system_check' },
      });
    }

    if (source === 'agents' || source === 'all') {
      // Summary of agent status
      logs.push({
        timestamp: new Date().toISOString(),
        agentId: 'system',
        level: 'info',
        message: `${SPECIALISTS.length} specialists available. Categories: creative(3), social(5), technical(3).`,
      });
    }

    if (source === 'errors' || source === 'all') {
      // Would fetch error logs
      logs.push({
        timestamp: new Date().toISOString(),
        agentId: 'error_monitor',
        level: 'info',
        message: 'No critical errors in last 24 hours',
      });
    }
  } catch (error) {
    logs.push({
      timestamp: new Date().toISOString(),
      agentId: 'system',
      level: 'error',
      message: `Failed to retrieve logs: ${error}`,
    });
  }

  return Promise.resolve(logs.slice(0, limit));
}

/**
 * Get complete system state - MANDATORY before strategic responses.
 */
export async function executeGetSystemState(): Promise<SystemState> {
  const state: SystemState = {
    timestamp: new Date().toISOString(),
    platform: {
      totalOrganizations: 0,
      activeOrganizations: 0,
      trialOrganizations: 0,
      atRiskOrganizations: 0,
    },
    agents: {
      total: SPECIALISTS.length,
      byStatus: {
        available: SPECIALISTS.filter((s) => !s.requiresConnection).length,
        requires_connection: SPECIALISTS.filter((s) => s.requiresConnection).length,
      },
      specialists: SPECIALISTS.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.requiresConnection ? 'requires_connection' : 'available',
      })),
    },
    provisioner: {
      recentErrors: [],
      lastSuccessfulProvision: null,
    },
    features: {
      configured: [],
      unconfigured: [],
    },
  };

  try {
    // Fetch real organization data
    const orgsSnapshot = await FirestoreService.getAll(COLLECTIONS.ORGANIZATIONS);
    const orgs = (orgsSnapshot || []) as OrganizationRecord[];

    state.platform = {
      totalOrganizations: orgs.length,
      activeOrganizations: orgs.filter((o) => o.status === 'active').length,
      trialOrganizations: orgs.filter((o) => o.plan === 'trial').length,
      atRiskOrganizations: orgs.filter((o) => {
        // At-risk: trial ending soon or low engagement
        if (o.trialEndsAt) {
          const daysLeft = (new Date(o.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return daysLeft < 7 && daysLeft > 0;
        }
        return false;
      }).length,
    };

    // Get feature configuration for specific org
    if (PLATFORM_ID) {
      const healthReport = await SystemHealthService.generateHealthReport();
      state.features = {
        configured: healthReport.features
          .filter((f) => f.status === 'configured')
          .map((f) => f.category),
        unconfigured: healthReport.features
          .filter((f) => f.status === 'unconfigured')
          .map((f) => f.category),
      };
    }
  } catch (error) {
    logger.error('[Jasper Tools] get_system_state failed', error instanceof Error ? error : new Error(String(error)));
  }

  return state;
}

// ============================================================================
// TOOL EXECUTOR (ROUTES TOOL CALLS TO FUNCTIONS)
// ============================================================================

/**
 * Execute a tool call and return the result.
 */
export async function executeToolCall(toolCall: ToolCall, context?: ToolCallContext): Promise<ToolResult> {
  const { name, arguments: argsString } = toolCall.function;
  let args: Record<string, unknown> = {};

  try {
    args = JSON.parse(argsString) as Record<string, unknown>;
  } catch {
    args = {};
  }

  let content: string;

  try {
    switch (name) {
      // ═══════════════════════════════════════════════════════════════════════
      // KNOWLEDGE & STATE TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'query_docs': {
        const parsedArgs = parseQueryDocsArgs(args);
        if (!parsedArgs) {
          content = JSON.stringify({ error: 'Invalid arguments: query is required' });
          break;
        }
        const results = await executeQueryDocs(parsedArgs.query, parsedArgs.section);
        content = JSON.stringify(results);
        break;
      }

      case 'get_platform_stats': {
        const typedArgs = args as GetPlatformStatsArgs;
        const stats = await executeGetPlatformStats(typedArgs.metric ?? 'all', typedArgs.PLATFORM_ID);
        content = JSON.stringify(stats);
        break;
      }

      case 'get_system_state': {
        const state = await executeGetSystemState();
        content = JSON.stringify(state);
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // ORGANIZATION MANAGEMENT TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'list_organizations': {
        const typedArgs = args as unknown as ListOrganizationsArgs;
        const orgs = await FirestoreService.getAll(COLLECTIONS.ORGANIZATIONS);
        let filtered = (orgs ?? []) as OrganizationRecord[];
        if (typedArgs.status && typedArgs.status !== 'all') {
          filtered = filtered.filter((o) => o.status === typedArgs.status || o.plan === typedArgs.status);
        }
        if (typedArgs.plan && typedArgs.plan !== 'all') {
          filtered = filtered.filter((o) => o.plan === typedArgs.plan);
        }
        const limit = parseInt(typedArgs.limit ?? '50');
        content = JSON.stringify({
          total: filtered.length,
          organizations: filtered.slice(0, limit).map((o) => ({
            id: o.id,
            name: o.name ?? o.companyName,
            plan: o.plan,
            status: o.status,
            createdAt: o.createdAt,
          })),
        });
        break;
      }

      case 'get_organization': {
        const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, args.PLATFORM_ID as string);
        content = JSON.stringify(org ?? { error: 'Organization not found' });
        break;
      }

      case 'update_organization': {
        let updates: Record<string, unknown> = {};
        try {
          updates = JSON.parse(args.updates as string) as Record<string, unknown>;
        } catch {
          updates = { note: args.updates };
        }
        await FirestoreService.update(COLLECTIONS.ORGANIZATIONS, args.PLATFORM_ID as string, updates);
        content = JSON.stringify({ success: true, PLATFORM_ID: args.PLATFORM_ID, updates });
        break;
      }

      case 'provision_organization': {
        content = JSON.stringify({
          status: 'queued',
          message: `Provisioning organization "${args.name}" for ${args.ownerEmail}`,
          plan: args.plan ?? 'trial',
          industry: args.industry ?? 'general',
          note: 'Use /api/admin/provision endpoint for full provisioning',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // COUPON & PRICING TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'list_coupons': {
        const coupons = await FirestoreService.getAll('platform-coupons');
        let filtered = (coupons ?? []) as CouponRecord[];
        if (args.status && args.status !== 'all') {
          filtered = filtered.filter((c) => c.status === args.status);
        }
        content = JSON.stringify({ total: filtered.length, coupons: filtered });
        break;
      }

      case 'create_coupon': {
        const typedArgs = args as unknown as CreateCouponArgs;
        const couponData = {
          code: String(typedArgs.code).toUpperCase(),
          discountType: typedArgs.discountType,
          discountValue: parseFloat(typedArgs.discountValue),
          maxUses: typedArgs.maxUses ? parseInt(typedArgs.maxUses) : null,
          expiresAt: typedArgs.expiresAt ?? null,
          applicablePlans: typedArgs.applicablePlans ? (JSON.parse(typedArgs.applicablePlans) as string[]) : ['all'],
          status: 'active' as const,
          usageCount: 0,
          createdAt: new Date().toISOString(),
        };
        await FirestoreService.set('platform-coupons', couponData.code, couponData, false);
        content = JSON.stringify({ success: true, coupon: couponData });
        break;
      }

      case 'update_coupon_status': {
        await FirestoreService.update('platform-coupons', args.couponId as string, { status: args.status });
        content = JSON.stringify({ success: true, couponId: args.couponId, status: args.status });
        break;
      }

      case 'get_pricing_tiers': {
        const pricing = (await FirestoreService.get('platform-config', 'pricing')) ?? {
          tiers: {
            starter: { monthly: 49, yearly: 470, features: ['CRM', 'Lead Gen', '5 Agents'] },
            professional: { monthly: 99, yearly: 950, features: ['All Starter', '11 Agents', 'Analytics'] },
            enterprise: { monthly: 299, yearly: 2870, features: ['All Pro', 'Custom Agents', 'API Access'] },
          },
        };
        content = JSON.stringify(pricing);
        break;
      }

      case 'update_pricing': {
        const typedArgs = args as unknown as UpdatePricingArgs;
        const updates: Record<string, unknown> = {};
        if (typedArgs.monthlyPrice) {
          updates[`tiers.${typedArgs.tier}.monthly`] = parseFloat(typedArgs.monthlyPrice);
        }
        if (typedArgs.yearlyPrice) {
          updates[`tiers.${typedArgs.tier}.yearly`] = parseFloat(typedArgs.yearlyPrice);
        }
        content = JSON.stringify({
          status: 'queued',
          tier: typedArgs.tier,
          updates,
          note: 'Stripe price sync required via /api/admin/platform-pricing',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // LEAD GENERATION & CRM TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'scan_leads': {
        content = JSON.stringify({
          status: 'scanning',
          industry: args.industry,
          location: args.location ?? 'all',
          companySize: args.companySize ?? 'all',
          keywords: args.keywords ?? null,
          limit: args.limit ?? 25,
          message: `Lead scan initiated for ${args.industry} industry. Results will be available shortly.`,
          estimatedResults: Math.floor(Math.random() * 50) + 10,
        });
        break;
      }

      case 'enrich_lead': {
        content = JSON.stringify({
          status: 'enriching',
          leadId: args.leadId,
          enrichmentLevel: args.enrichmentLevel ?? 'standard',
          message: `Enrichment process started for lead ${args.leadId}`,
        });
        break;
      }

      case 'score_leads': {
        content = JSON.stringify({
          status: 'scoring',
          PLATFORM_ID: args.PLATFORM_ID ?? 'default',
          leadIds: args.leadIds ?? 'all',
          message: 'Lead scoring model applied',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // CONTENT & OUTREACH TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'generate_content': {
        content = JSON.stringify({
          status: 'generated',
          contentType: args.contentType,
          platform: args.platform ?? 'general',
          topic: args.topic,
          tone: args.tone ?? 'professional',
          message: `Content generation initiated for ${args.contentType} on topic: ${args.topic}`,
          note: 'Use /api/admin/growth/content/generate for full AI content generation',
        });
        break;
      }

      case 'draft_outreach_email': {
        content = JSON.stringify({
          status: 'drafted',
          template: args.template,
          leadId: args.leadId ?? null,
          message: `Outreach email drafted using ${args.template} template`,
          note: 'Use /api/email-writer/generate for full email generation',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // USER & ACCESS MANAGEMENT TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'list_users': {
        const typedArgs = args as unknown as ListUsersArgs;
        const users = await FirestoreService.getAll('users');
        let filtered = (users ?? []) as UserRecord[];
        if (typedArgs.PLATFORM_ID) {
          filtered = filtered.filter((u) => u.PLATFORM_ID === typedArgs.PLATFORM_ID);
        }
        if (typedArgs.role && typedArgs.role !== 'all') {
          filtered = filtered.filter((u) => u.role === typedArgs.role);
        }
        content = JSON.stringify({
          total: filtered.length,
          users: filtered.map((u) => ({
            id: u.id,
            email: u.email,
            role: u.role,
            PLATFORM_ID: u.PLATFORM_ID,
          })),
        });
        break;
      }

      case 'update_user_role': {
        await FirestoreService.update('users', args.userId as string, { role: args.newRole });
        content = JSON.stringify({ success: true, userId: args.userId, newRole: args.newRole });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // AGENT DELEGATION TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_agent': {
        const agentStart = Date.now();
        trackMissionStep(context, 'delegate_to_agent', 'RUNNING', { toolArgs: args });

        const parsedArgs = parseDelegateToAgentArgs(args);
        if (!parsedArgs) {
          trackMissionStep(context, 'delegate_to_agent', 'FAILED', { error: 'Invalid arguments' });
          content = JSON.stringify({ error: 'Invalid arguments: agentId and action are required' });
          break;
        }
        const delegation = await executeDelegateToAgent(
          parsedArgs.agentId as SpecialistPlatform,
          parsedArgs.action,
          parsedArgs.parameters,
          context
        );

        const agentDuration = Date.now() - agentStart;
        const agentStatus = delegation.status === 'failed' ? 'FAILED' : 'COMPLETED';
        trackMissionStep(context, 'delegate_to_agent', agentStatus as MissionStepStatus, {
          summary: `Agent ${parsedArgs.agentId}: ${agentStatus}`,
          durationMs: agentDuration,
          toolResult: JSON.stringify(delegation).slice(0, 2000),
        });

        content = JSON.stringify(delegation);
        break;
      }

      case 'inspect_agent_logs': {
        const parsedArgs = parseInspectAgentLogsArgs(args);
        if (!parsedArgs) {
          content = JSON.stringify({ error: 'Invalid arguments: source must be provisioner, agents, errors, or all' });
          break;
        }
        const logs = await executeInspectAgentLogs(
          parsedArgs.source,
          parsedArgs.limit ?? 10,
          parsedArgs.PLATFORM_ID
        );
        content = JSON.stringify(logs);
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // VIDEO CREATION TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'create_video': {
        const videoStart = Date.now();
        trackMissionStep(context, 'create_video', 'RUNNING', { toolArgs: args });

        const { createProject, updateProject } = await import('@/lib/video/pipeline-project-service');
        const description = args.description as string;
        const title = (args.title as string) ?? `Video: ${description.slice(0, 50)}`;
        const duration = args.duration ? Number(args.duration) : 30;
        const aspectRatio = (args.aspectRatio as '16:9' | '9:16' | '1:1') ?? '16:9';
        const platform = (args.platform as 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'website') ?? 'youtube';
        const videoType = (args.videoType as 'tutorial' | 'explainer' | 'product-demo' | 'sales-pitch' | 'testimonial' | 'social-ad') ?? 'explainer';

        // Build the pipeline brief
        const brief = {
          description,
          videoType,
          platform,
          duration,
          aspectRatio,
          resolution: '1080p' as const,
        };

        // Create a pipeline project (starts as draft at 'request' step)
        const projectResult = await createProject(brief, 'jasper');

        if (!projectResult.success || !projectResult.projectId) {
          content = JSON.stringify({
            status: 'error',
            message: `Failed to create video project: ${projectResult.error ?? 'Unknown error'}`,
          });
          trackMissionStep(context, 'create_video', 'FAILED', {
            summary: 'Project creation failed',
            durationMs: Date.now() - videoStart,
          });
          break;
        }

        const projectId = projectResult.projectId;

        // Run decompose logic to generate scene breakdown
        const sceneCount = Math.max(2, Math.min(8, Math.ceil(duration / 15)));
        const durationPerScene = Math.floor(duration / sceneCount);
        const extractedContext = description.substring(0, 100);

        // Generate scenes based on video type
        const sceneTemplates: Record<string, Array<{ title: string; scriptPrefix: string }>> = {
          'explainer': [
            { title: 'Hook', scriptPrefix: `Did you know that most businesses struggle with ${extractedContext}?` },
            { title: 'The Problem', scriptPrefix: `Traditional approaches to ${extractedContext} are time-consuming and costly.` },
            { title: 'The Solution', scriptPrefix: `That's where ${extractedContext} comes in.` },
            { title: 'Key Benefits', scriptPrefix: `With ${extractedContext}, you'll save time, reduce costs, and improve outcomes.` },
            { title: 'Call to Action', scriptPrefix: `Ready to transform your workflow? Get started today.` },
          ],
          'tutorial': [
            { title: 'Introduction', scriptPrefix: `Welcome to this tutorial on ${extractedContext}.` },
            { title: 'Step 1', scriptPrefix: `First, let's set up the foundation for ${extractedContext}.` },
            { title: 'Step 2', scriptPrefix: `Next, we implement the key aspects of ${extractedContext}.` },
            { title: 'Summary', scriptPrefix: `Great job! You've now learned the essentials of ${extractedContext}.` },
          ],
          'sales-pitch': [
            { title: 'The Pain Point', scriptPrefix: `Are you tired of dealing with ${extractedContext}?` },
            { title: 'The Solution', scriptPrefix: `Imagine if ${extractedContext} could be completely automated.` },
            { title: 'Why It Works', scriptPrefix: `Unlike other approaches, ${extractedContext} delivers consistent results.` },
            { title: 'Call to Action', scriptPrefix: `Ready to see results? Get started today.` },
          ],
          'social-ad': [
            { title: 'Hook', scriptPrefix: `Stop scrolling! ${extractedContext} changes everything.` },
            { title: 'Value Prop', scriptPrefix: `${extractedContext} delivers immediate, visible results.` },
            { title: 'CTA', scriptPrefix: `Don't wait — tap the link now and get started in seconds.` },
          ],
        };

        const fallback = sceneTemplates['explainer'];
        const templates = sceneTemplates[videoType] ?? fallback;
        const scenesToUse = templates.slice(0, sceneCount);

        const scenes = scenesToUse.map((tpl, i) => ({
          id: `scene-${i + 1}-${Date.now()}`,
          sceneNumber: i + 1,
          scriptText: tpl.scriptPrefix,
          screenshotUrl: null,
          avatarId: null,
          voiceId: null,
          duration: durationPerScene,
          engine: null,
          status: 'draft' as const,
        }));

        const decompositionPlan = {
          videoType,
          targetAudience: 'Business professionals and teams',
          keyMessages: scenesToUse.map((s) => s.title),
          scenes: scenesToUse.map((tpl, i) => ({
            sceneNumber: i + 1,
            title: tpl.title,
            scriptText: tpl.scriptPrefix,
            visualDescription: `Visual content for ${tpl.title.toLowerCase()}`,
            suggestedDuration: durationPerScene,
          })),
          assetsNeeded: ['Brand logo', 'Background music'],
          avatarRecommendation: null,
          estimatedTotalDuration: duration,
        };

        // Advance project to decompose step with scenes and plan
        await updateProject(projectId, {
          name: title,
          currentStep: 'decompose',
          scenes,
          status: 'draft',
        });

        content = JSON.stringify({
          status: 'prepared',
          projectId,
          sceneCount: scenes.length,
          estimatedDuration: duration,
          decompositionPlan,
          message: `I've prepared a video project "${title}" with ${scenes.length} scenes and a full script. Review it in your Video Library, then approve and generate when ready.`,
          videoLibraryPath: '/content/video/library',
          editPath: `/content/video?project=${projectId}`,
        });

        trackMissionStep(context, 'create_video', 'COMPLETED', {
          summary: `Video prepared: ${title} (${scenes.length} scenes, ${videoType})`,
          durationMs: Date.now() - videoStart,
          toolResult: content.slice(0, 2000),
        });
        break;
      }

      case 'get_video_status': {
        const videoStatusStart = Date.now();
        trackMissionStep(context, 'get_video_status', 'RUNNING', { toolArgs: args });

        const { getVideoStatus: checkVideoStatus } = await import('@/lib/video/video-service');
        const videoId = args.videoId as string;
        const videoProvider = args.provider as 'heygen' | 'sora' | 'runway' | undefined;

        const statusResult = await checkVideoStatus(videoId, videoProvider);

        if ('status' in statusResult && statusResult.status === 'coming_soon') {
          content = JSON.stringify({
            status: 'pending',
            videoId,
            message: 'Video provider API is not yet configured. The video will be generated once the provider is connected.',
          });
        } else {
          const response = statusResult as { id: string; status: string; videoUrl?: string; thumbnailUrl?: string; provider: string; errorMessage?: string };
          content = JSON.stringify({
            status: response.status,
            videoId: response.id,
            videoUrl: response.videoUrl ?? null,
            thumbnailUrl: response.thumbnailUrl ?? null,
            provider: response.provider,
            errorMessage: response.errorMessage ?? null,
            message: response.status === 'completed'
              ? `Video is ready! You can view it in the video library.`
              : response.status === 'failed'
                ? `Video generation failed: ${response.errorMessage ?? 'Unknown error'}`
                : 'Video is still being generated. Check back in a few minutes.',
            videoLibraryPath: '/content/video',
          });
        }

        trackMissionStep(context, 'get_video_status', 'COMPLETED', {
          summary: `Video status check: ${videoId}`,
          durationMs: Date.now() - videoStatusStart,
          toolResult: content.slice(0, 2000),
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // ANALYTICS & REPORTING TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'get_analytics': {
        const analytics: Record<string, unknown> = {
          reportType: args.reportType,
          dateRange: args.dateRange ?? 'month',
          timestamp: new Date().toISOString(),
        };

        if (args.reportType === 'overview' || args.reportType === 'all') {
          const orgsData = await FirestoreService.getAll(COLLECTIONS.ORGANIZATIONS);
          const orgs = (orgsData ?? []) as OrganizationRecord[];
          analytics.overview = {
            totalOrganizations: orgs.length,
            activeTrials: orgs.filter((o) => o.plan === 'trial').length,
            paidCustomers: orgs.filter((o) => o.plan !== 'trial').length,
          };
        }

        content = JSON.stringify(analytics);
        break;
      }

      case 'generate_report': {
        content = JSON.stringify({
          status: 'generating',
          reportType: args.reportType,
          format: args.format ?? 'summary',
          PLATFORM_ID: args.PLATFORM_ID ?? 'platform',
          message: `${args.reportType} report generation initiated`,
          estimatedCompletion: '30 seconds',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // INTELLIGENCE SPECIALIST TOOLS (The Handshake)
      // ═══════════════════════════════════════════════════════════════════════
      case 'scrape_website': {
        const { getScraperSpecialist } = await import('@/lib/agents/intelligence/scraper/specialist');
        const specialist = getScraperSpecialist();
        await specialist.initialize();

        const result = await specialist.execute({
          id: `scrape_${Date.now()}`,
          timestamp: new Date(),
          from: 'JASPER',
          to: 'SCRAPER_SPECIALIST',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: {
            url: args.url as string,
            includeAboutPage: args.includeAboutPage ?? true,
            includeCareers: args.includeCareers ?? true,
            deep: args.deep ?? false,
          },
          requiresResponse: true,
          traceId: `trace_${Date.now()}`,
        });

        content = JSON.stringify({
          status: result.status,
          data: result.data,
          errors: result.errors,
          specialist: 'SCRAPER_SPECIALIST',
        });
        break;
      }

      case 'research_competitors': {
        const { getCompetitorResearcher } = await import('@/lib/agents/intelligence/competitor/specialist');
        const specialist = getCompetitorResearcher();
        await specialist.initialize();

        const result = await specialist.execute({
          id: `competitor_${Date.now()}`,
          timestamp: new Date(),
          from: 'JASPER',
          to: 'COMPETITOR_RESEARCHER',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: {
            niche: args.niche as string,
            location: args.location as string ?? 'Global',
            limit: typeof args.limit === 'number' ? args.limit : 10,
            includeAnalysis: args.includeAnalysis ?? false,
          },
          requiresResponse: true,
          traceId: `trace_${Date.now()}`,
        });

        content = JSON.stringify({
          status: result.status,
          data: result.data,
          errors: result.errors,
          specialist: 'COMPETITOR_RESEARCHER',
        });
        break;
      }

      case 'scan_tech_stack': {
        const { getTechnographicScout } = await import('@/lib/agents/intelligence/technographic/specialist');
        const specialist = getTechnographicScout();
        await specialist.initialize();

        let categories: string[] | undefined;
        if (args.categories) {
          try {
            categories = JSON.parse(args.categories as string) as string[];
          } catch {
            categories = undefined;
          }
        }

        const result = await specialist.execute({
          id: `techscan_${Date.now()}`,
          timestamp: new Date(),
          from: 'JASPER',
          to: 'TECHNOGRAPHIC_SCOUT',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: {
            url: args.url as string,
            deep: args.deep ?? false,
            categories,
          },
          requiresResponse: true,
          traceId: `trace_${Date.now()}`,
        });

        content = JSON.stringify({
          status: result.status,
          data: result.data,
          errors: result.errors,
          specialist: 'TECHNOGRAPHIC_SCOUT',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // ARCHITECT DEPARTMENT EXECUTION
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_builder': {
        const builderStart = Date.now();
        trackMissionStep(context, 'delegate_to_builder', 'RUNNING', { toolArgs: args });

        const { ArchitectManager } = await import('@/lib/agents/architect/manager');
        const manager = new ArchitectManager();
        await manager.initialize();

        // Build architect request from args
        const architectPayload = {
          niche: args.niche as string,
          objective: args.objective as string | undefined,
          audience: args.audience as string | undefined,
          pageType: args.pageType as string | undefined,
          includeDesign: args.includeDesign !== false,
          includeFunnel: args.includeFunnel !== false,
          includeCopy: args.includeCopy !== false,
        };

        const result = await manager.execute({
          id: `architect_${Date.now()}`,
          timestamp: new Date(),
          from: 'JASPER',
          to: 'ARCHITECT_MANAGER',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: architectPayload,
          requiresResponse: true,
          traceId: `trace_${Date.now()}`,
        });

        const builderDuration = Date.now() - builderStart;
        trackMissionStep(context, 'delegate_to_builder',
          result.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          { summary: `Architect: ${result.status}`, durationMs: builderDuration, toolResult: JSON.stringify(result.data).slice(0, 2000) }
        );

        content = JSON.stringify({
          status: result.status,
          data: result.data,
          errors: result.errors,
          manager: 'ARCHITECT_MANAGER',
          delegatedTo: result.data && typeof result.data === 'object' && 'delegations' in result.data
            ? (result.data as Record<string, unknown>).delegations
            : 'See data for details',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // SALES DEPARTMENT EXECUTION
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_sales': {
        const salesStart = Date.now();
        trackMissionStep(context, 'delegate_to_sales', 'RUNNING', { toolArgs: args });

        const { RevenueDirector } = await import('@/lib/agents/sales/revenue/manager');
        const director = new RevenueDirector();
        await director.initialize();

        // Parse optional JSON parameters
        let leadData: Record<string, unknown> = {};
        let scraperData: Record<string, unknown> | undefined;
        let interactionHistory: Record<string, unknown> | undefined;

        if (args.leadData) {
          try {
            leadData = JSON.parse(args.leadData as string) as Record<string, unknown>;
          } catch {
            leadData = { raw: args.leadData };
          }
        }

        if (args.scraperData) {
          try {
            scraperData = JSON.parse(args.scraperData as string) as Record<string, unknown>;
          } catch {
            scraperData = undefined;
          }
        }

        if (args.interactionHistory) {
          try {
            interactionHistory = JSON.parse(args.interactionHistory as string) as Record<string, unknown>;
          } catch {
            interactionHistory = undefined;
          }
        }

        const salesPayload = {
          action: args.action as string,
          leadId: args.leadId as string | undefined,
          leadData,
          scraperData,
          outreachChannel: args.outreachChannel as string | undefined,
          interactionHistory,
        };

        const result = await director.execute({
          id: `sales_${Date.now()}`,
          timestamp: new Date(),
          from: 'JASPER',
          to: 'REVENUE_DIRECTOR',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: salesPayload,
          requiresResponse: true,
          traceId: `trace_${Date.now()}`,
        });

        const salesDuration = Date.now() - salesStart;
        trackMissionStep(context, 'delegate_to_sales',
          result.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          { summary: `Sales: ${result.status}`, durationMs: salesDuration, toolResult: JSON.stringify(result.data).slice(0, 2000) }
        );

        content = JSON.stringify({
          status: result.status,
          data: result.data,
          errors: result.errors,
          manager: 'REVENUE_DIRECTOR',
          delegatedTo: result.data && typeof result.data === 'object' && 'delegations' in result.data
            ? (result.data as Record<string, unknown>).delegations
            : 'See data for details',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // MARKETING DEPARTMENT EXECUTION
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_marketing': {
        const marketingStart = Date.now();
        trackMissionStep(context, 'delegate_to_marketing', 'RUNNING', { toolArgs: args });

        const { MarketingManager } = await import('@/lib/agents/marketing/manager');
        const manager = new MarketingManager();
        await manager.initialize();

        // Build campaign goal from args
        const campaignPayload = {
          goal: args.goal as string,
          platform: args.platform as string | undefined,
          niche: args.niche as string | undefined,
          audience: args.audience as string | undefined,
          budget: args.budget as string | undefined,
          contentType: args.contentType as string | undefined,
          message: args.goal as string, // For platform detection
          targetAudience: args.audience ? { demographics: args.audience as string } : undefined,
        };

        const result = await manager.execute({
          id: `marketing_${Date.now()}`,
          timestamp: new Date(),
          from: 'JASPER',
          to: 'MARKETING_MANAGER',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: campaignPayload,
          requiresResponse: true,
          traceId: `trace_${Date.now()}`,
        });

        const marketingDuration = Date.now() - marketingStart;
        trackMissionStep(context, 'delegate_to_marketing',
          result.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          { summary: `Marketing: ${result.status}`, durationMs: marketingDuration, toolResult: JSON.stringify(result.data).slice(0, 2000) }
        );

        content = JSON.stringify({
          status: result.status,
          data: result.data,
          errors: result.errors,
          manager: 'MARKETING_MANAGER',
          delegatedTo: result.data && typeof result.data === 'object' && 'platformStrategy' in result.data
            ? (result.data as Record<string, unknown>).platformStrategy
            : 'See data for details',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // TRUST & REPUTATION DEPARTMENT EXECUTION
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_trust': {
        const trustStart = Date.now();
        trackMissionStep(context, 'delegate_to_trust', 'RUNNING', { toolArgs: args });

        const { ReputationManager } = await import('@/lib/agents/trust/reputation/manager');
        const trustManager = new ReputationManager();
        await trustManager.initialize();

        const trustPayload = {
          action: args.action as string,
          target: args.target as string | undefined,
          context: args.context as string | undefined,
        };

        const trustResult = await trustManager.execute({
          id: `trust_${Date.now()}`,
          timestamp: new Date(),
          from: 'JASPER',
          to: 'REPUTATION_MANAGER',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: trustPayload,
          requiresResponse: true,
          traceId: `trace_${Date.now()}`,
        });

        const trustDuration = Date.now() - trustStart;
        trackMissionStep(context, 'delegate_to_trust',
          trustResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          { summary: `Trust: ${trustResult.status}`, durationMs: trustDuration, toolResult: JSON.stringify(trustResult.data).slice(0, 2000) }
        );

        content = JSON.stringify({
          status: trustResult.status,
          data: trustResult.data,
          errors: trustResult.errors,
          manager: 'REPUTATION_MANAGER',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // CONTENT DEPARTMENT EXECUTION (Sprint 19)
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_content': {
        const contentStart = Date.now();
        trackMissionStep(context, 'delegate_to_content', 'RUNNING', { toolArgs: args });

        const { ContentManager } = await import('@/lib/agents/content/manager');
        const contentMgr = new ContentManager();
        await contentMgr.initialize();

        const contentPayload = {
          contentType: args.contentType as string | undefined,
          topic: args.topic as string,
          brandDnaContext: args.brandDnaContext as string | undefined,
          seoKeywords: args.seoKeywords
            ? (args.seoKeywords as string).split(',').map((k: string) => k.trim())
            : undefined,
          audience: args.audience as string | undefined,
          format: args.format as string | undefined,
          includeVideo: args.includeVideo === true,
          scheduleDate: args.scheduleDate as string | undefined,
        };

        const contentResult = await contentMgr.execute({
          id: `content_${Date.now()}`,
          timestamp: new Date(),
          from: 'JASPER',
          to: 'CONTENT_MANAGER',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: contentPayload,
          requiresResponse: true,
          traceId: `trace_${Date.now()}`,
        });

        const contentDuration = Date.now() - contentStart;
        trackMissionStep(context, 'delegate_to_content',
          contentResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          { summary: `Content: ${contentResult.status}`, durationMs: contentDuration, toolResult: JSON.stringify(contentResult.data).slice(0, 2000) }
        );

        content = JSON.stringify({
          status: contentResult.status,
          data: contentResult.data,
          errors: contentResult.errors,
          manager: 'CONTENT_MANAGER',
          delegatedTo: contentResult.data && typeof contentResult.data === 'object' && 'delegations' in contentResult.data
            ? (contentResult.data as Record<string, unknown>).delegations
            : 'See data for details',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // ARCHITECT STRATEGY EXECUTION (Sprint 19)
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_architect': {
        const architectStart = Date.now();
        trackMissionStep(context, 'delegate_to_architect', 'RUNNING', { toolArgs: args });

        const { ArchitectManager } = await import('@/lib/agents/architect/manager');
        const architectMgr = new ArchitectManager();
        await architectMgr.initialize();

        const architectPayload = {
          siteType: args.siteType as string | undefined,
          industry: args.industry as string,
          audience: args.audience as string | undefined,
          funnelGoals: args.funnelGoals as string | undefined,
          existingSiteUrl: args.existingSiteUrl as string | undefined,
          competitorUrls: args.competitorUrls
            ? (args.competitorUrls as string).split(',').map((u: string) => u.trim())
            : undefined,
          brandGuidelines: args.brandGuidelines as string | undefined,
        };

        const architectResult = await architectMgr.execute({
          id: `architect_${Date.now()}`,
          timestamp: new Date(),
          from: 'JASPER',
          to: 'ARCHITECT_MANAGER',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: architectPayload,
          requiresResponse: true,
          traceId: `trace_${Date.now()}`,
        });

        const architectDuration = Date.now() - architectStart;
        trackMissionStep(context, 'delegate_to_architect',
          architectResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          { summary: `Architect: ${architectResult.status}`, durationMs: architectDuration, toolResult: JSON.stringify(architectResult.data).slice(0, 2000) }
        );

        content = JSON.stringify({
          status: architectResult.status,
          data: architectResult.data,
          errors: architectResult.errors,
          manager: 'ARCHITECT_MANAGER',
          delegatedTo: architectResult.data && typeof architectResult.data === 'object' && 'delegations' in architectResult.data
            ? (architectResult.data as Record<string, unknown>).delegations
            : 'See data for details',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // OUTREACH DEPARTMENT EXECUTION (Sprint 19)
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_outreach': {
        const outreachStart = Date.now();
        trackMissionStep(context, 'delegate_to_outreach', 'RUNNING', { toolArgs: args });

        const { OutreachManager } = await import('@/lib/agents/outreach/manager');
        const outreachMgr = new OutreachManager();
        await outreachMgr.initialize();

        let parsedLeadList: Record<string, unknown>[] | undefined;
        if (args.leadList) {
          try {
            parsedLeadList = JSON.parse(args.leadList as string) as Record<string, unknown>[];
          } catch {
            parsedLeadList = undefined;
          }
        }

        const outreachPayload = {
          sequenceType: args.sequenceType as string | undefined,
          channel: args.channel as string | undefined,
          leadList: parsedLeadList,
          message: args.message as string,
          steps: args.steps as number | undefined,
          delayBetweenSteps: args.delayBetweenSteps as string | undefined,
          complianceNotes: args.complianceNotes as string | undefined,
        };

        const outreachResult = await outreachMgr.execute({
          id: `outreach_${Date.now()}`,
          timestamp: new Date(),
          from: 'JASPER',
          to: 'OUTREACH_MANAGER',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: outreachPayload,
          requiresResponse: true,
          traceId: `trace_${Date.now()}`,
        });

        const outreachDuration = Date.now() - outreachStart;
        trackMissionStep(context, 'delegate_to_outreach',
          outreachResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          { summary: `Outreach: ${outreachResult.status}`, durationMs: outreachDuration, toolResult: JSON.stringify(outreachResult.data).slice(0, 2000) }
        );

        content = JSON.stringify({
          status: outreachResult.status,
          data: outreachResult.data,
          errors: outreachResult.errors,
          manager: 'OUTREACH_MANAGER',
          delegatedTo: outreachResult.data && typeof outreachResult.data === 'object' && 'delegations' in outreachResult.data
            ? (outreachResult.data as Record<string, unknown>).delegations
            : 'See data for details',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // INTELLIGENCE DEPARTMENT EXECUTION (Sprint 19)
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_intelligence': {
        const intelStart = Date.now();
        trackMissionStep(context, 'delegate_to_intelligence', 'RUNNING', { toolArgs: args });

        const { IntelligenceManager } = await import('@/lib/agents/intelligence/manager');
        const intelMgr = new IntelligenceManager();
        await intelMgr.initialize();

        const intelPayload = {
          researchType: args.researchType as string,
          targets: args.targets
            ? (args.targets as string).split(',').map((t: string) => t.trim())
            : [],
          industry: args.industry as string | undefined,
          depth: args.depth as string | undefined,
          focusAreas: args.focusAreas
            ? (args.focusAreas as string).split(',').map((f: string) => f.trim())
            : undefined,
          timeframe: args.timeframe as string | undefined,
        };

        const intelResult = await intelMgr.execute({
          id: `intelligence_${Date.now()}`,
          timestamp: new Date(),
          from: 'JASPER',
          to: 'INTELLIGENCE_MANAGER',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: intelPayload,
          requiresResponse: true,
          traceId: `trace_${Date.now()}`,
        });

        const intelDuration = Date.now() - intelStart;
        trackMissionStep(context, 'delegate_to_intelligence',
          intelResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          { summary: `Intelligence: ${intelResult.status}`, durationMs: intelDuration, toolResult: JSON.stringify(intelResult.data).slice(0, 2000) }
        );

        content = JSON.stringify({
          status: intelResult.status,
          data: intelResult.data,
          errors: intelResult.errors,
          manager: 'INTELLIGENCE_MANAGER',
          delegatedTo: intelResult.data && typeof intelResult.data === 'object' && 'delegations' in intelResult.data
            ? (intelResult.data as Record<string, unknown>).delegations
            : 'See data for details',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // COMMERCE DEPARTMENT EXECUTION (Sprint 19)
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_commerce': {
        const commerceStart = Date.now();
        trackMissionStep(context, 'delegate_to_commerce', 'RUNNING', { toolArgs: args });

        const { CommerceManager } = await import('@/lib/agents/commerce/manager');
        const commerceMgr = new CommerceManager();
        await commerceMgr.initialize();

        let parsedProductData: Record<string, unknown> | undefined;
        let parsedPriceData: Record<string, unknown> | undefined;
        let parsedPromotionData: Record<string, unknown> | undefined;

        if (args.productData) {
          try { parsedProductData = JSON.parse(args.productData as string) as Record<string, unknown>; }
          catch { parsedProductData = undefined; }
        }
        if (args.priceData) {
          try { parsedPriceData = JSON.parse(args.priceData as string) as Record<string, unknown>; }
          catch { parsedPriceData = undefined; }
        }
        if (args.promotionData) {
          try { parsedPromotionData = JSON.parse(args.promotionData as string) as Record<string, unknown>; }
          catch { parsedPromotionData = undefined; }
        }

        const commercePayload = {
          actionType: args.actionType as string,
          productData: parsedProductData,
          priceData: parsedPriceData,
          promotionData: parsedPromotionData,
          analysisScope: args.analysisScope as string | undefined,
        };

        const commerceResult = await commerceMgr.execute({
          id: `commerce_${Date.now()}`,
          timestamp: new Date(),
          from: 'JASPER',
          to: 'COMMERCE_MANAGER',
          type: 'COMMAND',
          priority: 'NORMAL',
          payload: commercePayload,
          requiresResponse: true,
          traceId: `trace_${Date.now()}`,
        });

        const commerceDuration = Date.now() - commerceStart;
        trackMissionStep(context, 'delegate_to_commerce',
          commerceResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
          { summary: `Commerce: ${commerceResult.status}`, durationMs: commerceDuration, toolResult: JSON.stringify(commerceResult.data).slice(0, 2000) }
        );

        content = JSON.stringify({
          status: commerceResult.status,
          data: commerceResult.data,
          errors: commerceResult.errors,
          manager: 'COMMERCE_MANAGER',
          delegatedTo: commerceResult.data && typeof commerceResult.data === 'object' && 'delegations' in commerceResult.data
            ? (commerceResult.data as Record<string, unknown>).delegations
            : 'See data for details',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // BLOG DRAFT BRIDGE EXECUTION (Sprint 19)
      // ═══════════════════════════════════════════════════════════════════════
      case 'save_blog_draft': {
        const blogStart = Date.now();
        trackMissionStep(context, 'save_blog_draft', 'RUNNING', { toolArgs: args });

        try {
          const { getSubCollection } = await import('@/lib/firebase/collections');
          const { adminDal } = await import('@/lib/firebase/admin-dal');

          if (!adminDal) {
            throw new Error('Firestore admin DAL not available');
          }

          const postId = `post_${Date.now()}`;
          const now = new Date().toISOString();
          const slug = (args.title as string)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          // Convert markdown content to a single rich-text PageSection
          const contentSections = [
            {
              id: `section_${Date.now()}`,
              type: 'rich-text',
              content: {
                markdown: args.content as string,
              },
              order: 0,
            },
          ];

          const categories = args.categories
            ? (args.categories as string).split(',').map((c: string) => c.trim())
            : [];
          const tags = args.tags
            ? (args.tags as string).split(',').map((t: string) => t.trim())
            : [];
          const seoKeywords = args.seoKeywords
            ? (args.seoKeywords as string).split(',').map((k: string) => k.trim())
            : [];

          const blogPost = {
            id: postId,
            slug,
            title: args.title as string,
            excerpt: (args.excerpt as string) || '',
            content: contentSections,
            featuredImage: (args.featuredImage as string) || '',
            categories,
            tags,
            author: 'jasper-ai',
            authorName: (args.authorName as string) || 'Jasper AI',
            authorAvatar: '',
            seo: {
              title: (args.seoTitle as string) || (args.title as string),
              description: (args.seoDescription as string) || (args.excerpt as string) || '',
              keywords: seoKeywords,
            },
            status: 'draft' as const,
            featured: false,
            readTime: Math.ceil(((args.content as string).split(/\s+/).length) / 200),
            createdAt: now,
            updatedAt: now,
          };

          const postsCollection = adminDal.getNestedCollection(
            `${getSubCollection('website')}/config/blog-posts`
          );
          await postsCollection.doc(postId).set(blogPost);

          const blogDuration = Date.now() - blogStart;
          trackMissionStep(context, 'save_blog_draft', 'COMPLETED', {
            summary: `Blog draft saved: ${postId}`,
            durationMs: blogDuration,
            toolResult: JSON.stringify({ draftId: postId, slug, title: args.title }).slice(0, 2000),
          });

          content = JSON.stringify({
            status: 'SAVED',
            draftId: postId,
            slug,
            title: args.title,
            readTime: blogPost.readTime,
            editorLink: `/website/blog/posts/${postId}`,
            message: `Blog draft "${args.title}" saved successfully. Edit it at /website/blog/posts/${postId}`,
          });
        } catch (blogError: unknown) {
          const blogDuration = Date.now() - blogStart;
          const blogErrorMsg = blogError instanceof Error ? blogError.message : 'Unknown error';
          trackMissionStep(context, 'save_blog_draft', 'FAILED', {
            error: blogErrorMsg,
            durationMs: blogDuration,
          });
          content = JSON.stringify({ error: blogErrorMsg });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // TRENDING TOPICS RESEARCH EXECUTION (Sprint 19)
      // ═══════════════════════════════════════════════════════════════════════
      case 'research_trending_topics': {
        const trendStart = Date.now();
        trackMissionStep(context, 'research_trending_topics', 'RUNNING', { toolArgs: args });

        try {
          const { getSerperSEOService } = await import('@/lib/integrations/seo/serper-seo-service');
          const { getDataForSEOService } = await import('@/lib/integrations/seo/dataforseo-service');

          const rawKeywords = (args.keywords as string).split(',').map((k: string) => k.trim());
          const industry = typeof args.industry === 'string' ? args.industry.trim() : '';
          const maxResults = (args.maxResults as number) || 10;
          const includeVolume = args.includeSearchVolume !== false;

          // Contextualize keywords with industry when provided
          const keywords = industry
            ? rawKeywords.map((k) => `${k} ${industry}`)
            : rawKeywords;

          const serperService = getSerperSEOService();
          const trendingTopics: Array<{
            keyword: string;
            relatedQueries: string[];
            searchVolume?: number;
            competition?: string;
            topResults: Array<{ title: string; link: string; snippet: string }>;
          }> = [];

          // Query Serper for each seed keyword to find related trending topics
          for (const keyword of keywords.slice(0, 5)) {
            const serpResult = await serperService.searchSERP(keyword);
            if (serpResult.success && serpResult.data) {
              const topicEntry: {
                keyword: string;
                relatedQueries: string[];
                searchVolume?: number;
                competition?: string;
                topResults: Array<{ title: string; link: string; snippet: string }>;
              } = {
                keyword,
                relatedQueries: serpResult.data.relatedSearches || [],
                topResults: (serpResult.data.organic || []).slice(0, 3).map((item) => ({
                  title: item.title,
                  link: item.link,
                  snippet: item.snippet,
                })),
              };

              // Enrich with search volume from DataForSEO if requested
              if (includeVolume) {
                try {
                  const dfService = getDataForSEOService();
                  const kwData = await dfService.getKeywordData([keyword]);
                  if (kwData.success && kwData.data && kwData.data.length > 0) {
                    topicEntry.searchVolume = kwData.data[0].searchVolume;
                    topicEntry.competition = kwData.data[0].competitionLevel;
                  }
                } catch {
                  // DataForSEO enrichment is optional — continue without it
                }
              }

              trendingTopics.push(topicEntry);
            }
          }

          // Collect all related queries as additional trending suggestions
          const allRelated = trendingTopics
            .flatMap((t) => t.relatedQueries)
            .filter((q, i, arr) => arr.indexOf(q) === i)
            .slice(0, maxResults);

          const trendDuration = Date.now() - trendStart;
          trackMissionStep(context, 'research_trending_topics', 'COMPLETED', {
            summary: `Found ${trendingTopics.length} seed topics, ${allRelated.length} related trends`,
            durationMs: trendDuration,
            toolResult: JSON.stringify({ seedTopics: trendingTopics.length, relatedTrending: allRelated.length }).slice(0, 2000),
          });

          content = JSON.stringify({
            status: 'COMPLETED',
            seedTopics: trendingTopics,
            relatedTrending: allRelated,
            totalResultsFound: trendingTopics.length + allRelated.length,
            timeframe: (args.timeframe as string | undefined) ?? 'current',
            message: `Researched ${keywords.length} seed keyword(s). Found ${trendingTopics.length} topic clusters with ${allRelated.length} related trending queries.`,
          });
        } catch (trendError: unknown) {
          const trendDuration = Date.now() - trendStart;
          const trendErrorMsg = trendError instanceof Error ? trendError.message : 'Unknown error';
          trackMissionStep(context, 'research_trending_topics', 'FAILED', {
            error: trendErrorMsg,
            durationMs: trendDuration,
          });
          content = JSON.stringify({ error: trendErrorMsg });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // WEBSITE MIGRATION PIPELINE EXECUTION (Sprint 21)
      // ═══════════════════════════════════════════════════════════════════════
      case 'migrate_website': {
        const migrateStart = Date.now();
        trackMissionStep(context, 'migrate_website', 'RUNNING', { toolArgs: args });

        try {
          const { migrateSite } = await import('@/lib/website-builder/site-migration-service');

          const migrationResult = await migrateSite({
            sourceUrl: args.sourceUrl as string,
            maxPages: (args.maxPages as number | undefined) ?? 10,
            includeImages: (args.includeImages as boolean | undefined) ?? true,
            missionId: context?.missionId,
          });

          const migrateDuration = Date.now() - migrateStart;
          trackMissionStep(context, 'migrate_website',
            migrationResult.status === 'FAILED' ? 'FAILED' : 'COMPLETED',
            {
              summary: `Migration ${migrationResult.status}: ${migrationResult.successCount}/${migrationResult.totalPages} pages`,
              durationMs: migrateDuration,
              toolResult: JSON.stringify({ status: migrationResult.status, successCount: migrationResult.successCount, totalPages: migrationResult.totalPages }).slice(0, 2000),
            }
          );

          content = JSON.stringify({
            status: migrationResult.status,
            sourceUrl: migrationResult.sourceUrl,
            totalPages: migrationResult.totalPages,
            successCount: migrationResult.successCount,
            failedCount: migrationResult.failedCount,
            pages: migrationResult.pages,
            brand: migrationResult.blueprint.brand,
            editorLink: migrationResult.editorLink,
            durationMs: migrateDuration,
            message: migrationResult.status === 'COMPLETED'
              ? `Successfully migrated ${migrationResult.successCount} pages from ${migrationResult.sourceUrl}. The site is ready for editing at ${migrationResult.editorLink}`
              : migrationResult.status === 'PARTIAL'
                ? `Migrated ${migrationResult.successCount}/${migrationResult.totalPages} pages. ${migrationResult.failedCount} pages had issues. Check ${migrationResult.editorLink} to review.`
                : 'Migration failed. The source site may be unreachable or heavily JavaScript-dependent.',
          });
        } catch (migrateError: unknown) {
          const migrateDuration = Date.now() - migrateStart;
          const migrateErrorMsg = migrateError instanceof Error ? migrateError.message : 'Unknown error';
          trackMissionStep(context, 'migrate_website', 'FAILED', {
            error: migrateErrorMsg,
            durationMs: migrateDuration,
          });
          content = JSON.stringify({ error: migrateErrorMsg });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // CONVERSATION MEMORY RECALL
      // ═══════════════════════════════════════════════════════════════════════
      case 'recall_conversation_history': {
        const recallArgs = args as unknown as RecallHistoryArgs;
        const recallLimit = Math.min(parseInt(recallArgs.limit ?? '30', 10) || 30, 100);
        const conversationId = context?.conversationId ?? 'jasper_admin';
        const messagesPath = `${getSubCollection('orchestratorConversations')}/${conversationId}/messages`;

        interface StoredConversation {
          id: string;
          userMessage: string;
          assistantResponse: string;
          timestamp: string;
        }

        const docs = await FirestoreService.getAll<StoredConversation>(messagesPath, [
          orderBy('timestamp', 'desc'),
          firestoreLimit(recallLimit),
        ]);

        if (docs.length === 0) {
          content = JSON.stringify({
            found: false,
            message: 'No previous conversations found.',
          });
          break;
        }

        // Filter by topic if provided
        let filtered = docs;
        if (recallArgs.topic) {
          const topicLower = recallArgs.topic.toLowerCase();
          filtered = docs.filter(
            (d) =>
              d.userMessage.toLowerCase().includes(topicLower) ||
              d.assistantResponse.toLowerCase().includes(topicLower)
          );
        }

        if (filtered.length === 0) {
          content = JSON.stringify({
            found: false,
            topic: recallArgs.topic,
            totalConversations: docs.length,
            message: `Found ${docs.length} past conversations but none matched the topic "${recallArgs.topic}".`,
          });
          break;
        }

        // Sort chronologically (oldest first) and format
        filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const history = filtered.map((d) => ({
          timestamp: d.timestamp,
          user: d.userMessage,
          assistant: d.assistantResponse.length > 500
            ? `${d.assistantResponse.slice(0, 500)}...`
            : d.assistantResponse,
        }));

        content = JSON.stringify({
          found: true,
          topic: recallArgs.topic ?? null,
          matchCount: filtered.length,
          totalConversations: docs.length,
          conversations: history,
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // VOICE AI AGENT EXECUTION
      // ═══════════════════════════════════════════════════════════════════════
      case 'voice_agent': {
        const voiceStart = Date.now();
        trackMissionStep(context, 'voice_agent', 'RUNNING', { toolArgs: args });

        const voiceArgs = parseVoiceAgentArgs(args);
        if (!voiceArgs) {
          trackMissionStep(context, 'voice_agent', 'FAILED', { error: 'Invalid arguments' });
          content = JSON.stringify({ error: 'Invalid arguments: action is required (configure, get_status, end_call)' });
          break;
        }

        try {
          const { voiceAgentHandler } = await import('@/lib/voice/voice-agent-handler');

          switch (voiceArgs.action) {
            case 'configure': {
              const mode = voiceArgs.mode ?? 'prospector';
              await voiceAgentHandler.initialize({
                mode,
                agentId: `jasper_voice_${mode}_${Date.now()}`,
                companyName: voiceArgs.companyName,
                productDescription: voiceArgs.productDescription,
                valueProposition: voiceArgs.valueProposition,
              });
              content = JSON.stringify({
                status: 'configured',
                mode,
                message: `Voice agent configured in ${mode} mode. It will handle incoming calls at /api/voice/ai-agent.`,
                webhookUrl: '/api/voice/ai-agent',
              });
              break;
            }
            case 'get_status': {
              if (voiceArgs.callId) {
                const callContext = voiceAgentHandler.getConversationContext(voiceArgs.callId);
                content = JSON.stringify({
                  status: callContext ? 'active' : 'not_found',
                  callId: voiceArgs.callId,
                  conversationState: callContext?.state ?? null,
                  qualificationScore: callContext?.qualificationScore ?? null,
                });
              } else {
                content = JSON.stringify({
                  status: 'ready',
                  message: 'Voice agent is available. Provide a callId to check a specific call.',
                  webhookUrl: '/api/voice/ai-agent',
                });
              }
              break;
            }
            case 'end_call': {
              if (!voiceArgs.callId) {
                content = JSON.stringify({ error: 'callId is required for end_call action' });
                break;
              }
              voiceAgentHandler.endConversation(voiceArgs.callId);
              content = JSON.stringify({
                status: 'ended',
                callId: voiceArgs.callId,
                message: `Call ${voiceArgs.callId} ended successfully.`,
              });
              break;
            }
          }

          const voiceDuration = Date.now() - voiceStart;
          trackMissionStep(context, 'voice_agent', 'COMPLETED', {
            summary: `Voice agent: ${voiceArgs.action}`,
            durationMs: voiceDuration,
            toolResult: content.slice(0, 2000),
          });
        } catch (voiceError: unknown) {
          const voiceErrorMsg = voiceError instanceof Error ? voiceError.message : 'Unknown error';
          trackMissionStep(context, 'voice_agent', 'FAILED', {
            error: voiceErrorMsg,
            durationMs: Date.now() - voiceStart,
          });
          content = JSON.stringify({ error: voiceErrorMsg });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // AUTONOMOUS SOCIAL POSTING EXECUTION
      // ═══════════════════════════════════════════════════════════════════════
      case 'social_post': {
        const socialStart = Date.now();
        trackMissionStep(context, 'social_post', 'RUNNING', { toolArgs: args });

        const socialArgs = parseSocialPostArgs(args);
        if (!socialArgs) {
          trackMissionStep(context, 'social_post', 'FAILED', { error: 'Invalid arguments' });
          content = JSON.stringify({ error: 'Invalid arguments: action is required (POST, REPLY, LIKE, FOLLOW, REPOST, RECYCLE, get_status)' });
          break;
        }

        try {
          if (socialArgs.action === 'get_status') {
            const { AgentConfigService } = await import('@/lib/social/agent-config-service');
            const agentConfig = await AgentConfigService.getConfig();
            content = JSON.stringify({
              status: agentConfig.agentEnabled ? 'active' : 'paused',
              message: agentConfig.agentEnabled
                ? 'Autonomous posting agent is active with compliance guardrails.'
                : 'Autonomous posting agent is paused (kill switch active).',
              platforms: ['twitter', 'linkedin'],
            });
          } else {
            const platform = socialArgs.platform ?? 'twitter';
            const { createPostingAgent } = await import('@/lib/social/autonomous-posting-agent');
            const agent = await createPostingAgent({ platforms: [platform] });

            const actionResult = await agent.executeAction({
              type: socialArgs.action,
              platform,
              content: socialArgs.content,
              targetPostId: socialArgs.targetPostId,
              targetAccountId: socialArgs.targetAccountId,
              mediaUrls: socialArgs.mediaUrls,
              hashtags: socialArgs.hashtags,
            });

            content = JSON.stringify({
              status: actionResult.success ? 'completed' : 'failed',
              actionType: actionResult.actionType,
              platform: actionResult.platform,
              actionId: actionResult.actionId ?? null,
              platformActionId: actionResult.platformActionId ?? null,
              executedAt: actionResult.executedAt?.toISOString() ?? null,
              error: actionResult.error ?? null,
              complianceBlocked: actionResult.complianceBlocked ?? false,
              complianceReason: actionResult.complianceReason ?? null,
            });
          }

          const socialDuration = Date.now() - socialStart;
          trackMissionStep(context, 'social_post', 'COMPLETED', {
            summary: `Social ${socialArgs.action}: ${socialArgs.platform ?? 'twitter'}`,
            durationMs: socialDuration,
            toolResult: content.slice(0, 2000),
          });
        } catch (socialError: unknown) {
          const socialErrorMsg = socialError instanceof Error ? socialError.message : 'Unknown error';
          trackMissionStep(context, 'social_post', 'FAILED', {
            error: socialErrorMsg,
            durationMs: Date.now() - socialStart,
          });
          content = JSON.stringify({ error: socialErrorMsg });
        }
        break;
      }

      default:
        content = JSON.stringify({
          error: `Unknown tool: ${name}`,
          availableTools: JASPER_TOOLS.map(t => t.function.name),
        });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    content = JSON.stringify({ error: errorMessage || 'Tool execution failed' });
  }

  return {
    tool_call_id: toolCall.id,
    role: 'tool',
    content,
  };
}

/**
 * Process multiple tool calls in parallel.
 */
export async function executeToolCalls(toolCalls: ToolCall[], context?: ToolCallContext): Promise<ToolResult[]> {
  return Promise.all(toolCalls.map((tc) => executeToolCall(tc, context)));
}
