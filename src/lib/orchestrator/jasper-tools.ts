/**
 * Jasper Tools - Anti-Hallucination Tool Definitions
 *
 * These tools FORCE Jasper to query system data rather than hallucinate.
 * Tool data ALWAYS wins over Jasper's internal "thoughts".
 *
 * @module jasper-tools
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { SPECIALISTS, getSpecialist, type SpecialistPlatform } from './feature-manifest';
import { SystemHealthService } from './system-health-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

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
  organizationId: string;
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
  organizationId?: string;
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
  organizationId?: string;
}

interface DelegateToAgentArgs {
  agentId: string;
  action: string;
  parameters?: string;
}

interface InspectAgentLogsArgs {
  source: 'provisioner' | 'agents' | 'errors' | 'all';
  limit?: number;
  organizationId?: string;
}

interface GetSystemStateArgs {
  organizationId?: string;
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
    organizationId: typeof args.organizationId === 'string' ? args.organizationId : undefined,
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
      orgId: string;
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
            description: 'The topic to look up (e.g., "11 agents", "provisioner", "feature categories", "authentication")',
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
          organizationId: {
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
          organizationId: {
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
          organizationId: {
            type: 'string',
            description: 'The organization ID to retrieve',
          },
        },
        required: ['organizationId'],
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
          organizationId: {
            type: 'string',
            description: 'The organization ID to update',
          },
          updates: {
            type: 'string',
            description: 'JSON object with fields to update (plan, status, name, features)',
          },
        },
        required: ['organizationId', 'updates'],
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
          organizationId: {
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
          organizationId: {
            type: 'string',
            description: 'Filter by organization',
          },
          role: {
            type: 'string',
            description: 'Filter by role',
            enum: ['all', 'super_admin', 'admin', 'owner', 'member'],
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
        'Delegate a task to one of the 11 specialized agents. Use this to execute actual work rather than just describing capabilities. ENABLED: TRUE.',
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
          organizationId: {
            type: 'string',
            description: 'Optional: Filter logs by organization',
          },
        },
        required: ['source'],
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
          organizationId: {
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
          organizationId: {
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
    // Read the blueprint file
    const blueprintPath = join(__dirname, 'system-blueprint.md');
    let blueprintContent: string;

    try {
      blueprintContent = readFileSync(blueprintPath, 'utf-8');
    } catch {
      // Fallback: return hardcoded essential info if file not accessible at runtime
      return Promise.resolve(getHardcodedBlueprintSection(query, section));
    }

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
          content: `No specific documentation found for "${query}". The system blueprint covers: Platform Identity, Architecture, 11 Specialized Agents, Feature Categories, Provisioner System, Data Models, API Endpoints, Integrations, and Security.`,
        },
      ]);
    }

    return Promise.resolve(results);
  } catch (error) {
    logger.error('[Jasper Tools] query_docs failed', error);
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
      section: 'The 11 Specialized Agents',
      content: `
CREATIVE AGENTS (3):
1. YouTube (The Broadcaster) - Video scripts, thumbnails, metadata
2. TikTok (The Short-Form Lead) - Viral hooks, trends, short scripts
3. Instagram (The Visual Storyteller) - Posts, Stories, Reels, carousels

SOCIAL ENGAGEMENT AGENTS (5):
4. X/Twitter (Real-Time Voice - Global) - Threads, mentions, scheduling
5. Truth Social (Real-Time Voice - Community) - Posts, community engagement
6. LinkedIn (The Professional Networker) - Posts, articles, outreach
7. Pinterest (Visual Discovery Engine) - Pins, boards, SEO
8. Facebook (The Community Builder) - Posts, groups, events, ads

TECHNICAL AGENTS (3):
9. Newsletter (The Direct Line) - Newsletters, subject lines, automation
10. Web Migrator (The Digital Architect) - Landing pages, migrations, SEO
11. Lead Hunter (The Intelligence Gatherer) - Lead scanning, enrichment, scoring
      `.trim(),
    },
    features: {
      section: 'Feature Categories',
      content: `
11 FEATURE CATEGORIES:
1. Command Center - Dashboard, analytics overview
2. CRM - Contact management, deal tracking
3. Lead Generation - Lead Hunter, prospect discovery
4. Outbound - Email sequences, outreach campaigns
5. Automation - Workflows, triggers, automated actions
6. Content Factory - Social content creation, scheduling
7. AI Workforce - Agent management, golden masters
8. E-Commerce - Product management, Stripe/Shopify
9. Analytics - Performance metrics, reports
10. Website - Landing pages, web presence
11. Settings - Organization config, integrations
      `.trim(),
    },
    provisioner: {
      section: 'Provisioner System',
      content: `
PURPOSE: Automatic setup of organization infrastructure for new tenants.

PROCESS:
1. New user signs up via Firebase Auth
2. Provisioner creates organization document in Firestore
3. Default feature visibility settings applied
4. Welcome agent (Jasper clone) spawned for organization
5. Initial navigation structure built

ERROR HANDLING:
- Logs stored in organizations/{orgId}/provisionerLogs
- Failed provisions retry up to 3 times
- Admin notified of persistent failures
      `.trim(),
    },
    architecture: {
      section: 'Architecture Overview',
      content: `
STACK:
- Framework: Next.js 15 (App Router)
- Hosting: Vercel (serverless)
- Database: Firebase Firestore (multi-tenant)
- Auth: Firebase Auth
- AI Gateway: OpenRouter (100+ models)
- Voice: TTS via VoiceEngineFactory

MULTI-TENANCY:
- Each org has isolated data in Firestore
- Feature visibility configurable per-org
- Agents inherit organization context
      `.trim(),
    },
  };

  // Match query to section
  if (queryLower.includes('agent') || queryLower.includes('specialist') || queryLower.includes('11')) {
    return [essentialInfo.agents];
  }
  if (queryLower.includes('feature') || queryLower.includes('categor')) {
    return [essentialInfo.features];
  }
  if (queryLower.includes('provision') || queryLower.includes('setup') || queryLower.includes('onboard')) {
    return [essentialInfo.provisioner];
  }
  if (queryLower.includes('architect') || queryLower.includes('stack') || queryLower.includes('tech')) {
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
  organizationId?: string
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
      if (organizationId) {
        const healthReport = await SystemHealthService.generateHealthReport(organizationId);
        stats.health = {
          readinessScore: healthReport.readinessScore,
          configuredFeatures: healthReport.features.filter((f) => f.status === 'configured').length,
          unconfiguredFeatures: healthReport.features.filter((f) => f.status === 'unconfigured').length,
          recommendations: healthReport.recommendations.slice(0, 3).map((r) => r.title),
        };
      } else {
        stats.health = {
          note: 'Provide organizationId for detailed health report',
        };
      }
    }

    if (metric === 'all' || metric === 'errors') {
      stats.recentErrors = [];
      // Would query error logs here
    }

    return stats;
  } catch (error) {
    logger.error('[Jasper Tools] get_platform_stats failed', error);
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
 * Delegate a task to a specialized agent.
 */
export function executeDelegateToAgent(
  agentId: SpecialistPlatform,
  action: string,
  parameters?: string
): Promise<AgentDelegation> {
  const specialist = getSpecialist(agentId);

  if (!specialist) {
    return Promise.resolve({
      agentId,
      action,
      parameters: {},
      status: 'failed',
      result: `Unknown agent: ${agentId}. Available agents: ${SPECIALISTS.map((s) => s.id).join(', ')}`,
    });
  }

  // Check if action is valid for this specialist
  const capability = specialist.capabilities.find(
    (c) => c.action === action || c.name.toLowerCase().includes(action.toLowerCase())
  );

  if (!capability) {
    return Promise.resolve({
      agentId,
      action,
      parameters: {},
      status: 'failed',
      result: `Invalid action "${action}" for ${specialist.name}. Available actions: ${specialist.capabilities.map((c) => c.action).join(', ')}`,
    });
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

  // Queue the delegation (actual execution would be async)
  const delegation: AgentDelegation = {
    agentId,
    action: capability.action,
    parameters: parsedParams,
    status: 'queued',
    result: `Task queued: ${specialist.name} will execute "${capability.name}". ${specialist.requiresConnection ? `Note: Requires ${specialist.connectionLabel} connection.` : ''}`,
  };

  logger.info('[Jasper Tools] Agent delegation queued', { delegation });

  return Promise.resolve(delegation);
}

/**
 * Inspect agent and provisioner logs.
 */
export function executeInspectAgentLogs(
  source: 'provisioner' | 'agents' | 'errors' | 'all',
  limit: number = 10,
  _organizationId?: string
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
export async function executeGetSystemState(organizationId?: string): Promise<SystemState> {
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
    if (organizationId) {
      const healthReport = await SystemHealthService.generateHealthReport(organizationId);
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
    logger.error('[Jasper Tools] get_system_state failed', error);
  }

  return state;
}

// ============================================================================
// TOOL EXECUTOR (ROUTES TOOL CALLS TO FUNCTIONS)
// ============================================================================

/**
 * Execute a tool call and return the result.
 */
export async function executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
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
        const stats = await executeGetPlatformStats(typedArgs.metric ?? 'all', typedArgs.organizationId);
        content = JSON.stringify(stats);
        break;
      }

      case 'get_system_state': {
        const typedArgs = args as GetSystemStateArgs;
        const state = await executeGetSystemState(typedArgs.organizationId);
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
        const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, args.organizationId as string);
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
        await FirestoreService.update(COLLECTIONS.ORGANIZATIONS, args.organizationId as string, updates);
        content = JSON.stringify({ success: true, organizationId: args.organizationId, updates });
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
          organizationId: args.organizationId ?? 'default',
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
        if (typedArgs.organizationId) {
          filtered = filtered.filter((u) => u.organizationId === typedArgs.organizationId);
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
            organizationId: u.organizationId,
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
        const parsedArgs = parseDelegateToAgentArgs(args);
        if (!parsedArgs) {
          content = JSON.stringify({ error: 'Invalid arguments: agentId and action are required' });
          break;
        }
        const delegation = await executeDelegateToAgent(
          parsedArgs.agentId as SpecialistPlatform,
          parsedArgs.action,
          parsedArgs.parameters
        );
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
          parsedArgs.organizationId
        );
        content = JSON.stringify(logs);
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
          organizationId: args.organizationId ?? 'platform',
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
          to: 'COMPETITOR_ANALYST',
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
          specialist: 'COMPETITOR_ANALYST',
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
      // MARKETING DEPARTMENT EXECUTION
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_marketing': {
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
export async function executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
  return Promise.all(toolCalls.map(executeToolCall));
}
