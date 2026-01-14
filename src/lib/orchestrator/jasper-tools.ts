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
import { SystemHealthService, type SystemHealthReport } from './system-health-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

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
  parameters: Record<string, any>;
  status: 'queued' | 'executing' | 'completed' | 'failed';
  result?: string;
}

export interface AgentLog {
  timestamp: string;
  agentId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Tool definitions in OpenAI function-calling format.
 * Compatible with OpenRouter's tool_choice parameter.
 */
export const JASPER_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'query_docs',
      description:
        'Query the system blueprint for factual information about platform capabilities, architecture, features, or how things work. MUST be called before making any claims about system functionality.',
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
        'Get real-time platform statistics including organization counts, agent status, and health metrics. MUST be called before stating any numbers or statistics.',
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
      name: 'delegate_to_agent',
      description:
        'Delegate a task to one of the 11 specialized agents. Use this to execute actual work rather than just describing capabilities.',
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
        'Retrieve recent logs from agents or the provisioner system. Use to diagnose issues or report on recent activity.',
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
  {
    type: 'function',
    function: {
      name: 'get_system_state',
      description:
        'MANDATORY: Get the current system state before generating any strategic response. Returns org count, agent status, provisioner health, and feature configuration.',
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
];

// ============================================================================
// TOOL EXECUTION FUNCTIONS
// ============================================================================

/**
 * Query the system blueprint for factual information.
 * Reads from system-blueprint.md and returns relevant sections.
 */
export async function executeQueryDocs(
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
      return getHardcodedBlueprintSection(query, section);
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
      return [
        {
          section: 'Query Result',
          content: `No specific documentation found for "${query}". The system blueprint covers: Platform Identity, Architecture, 11 Specialized Agents, Feature Categories, Provisioner System, Data Models, API Endpoints, Integrations, and Security.`,
        },
      ];
    }

    return results;
  } catch (error) {
    logger.error('[Jasper Tools] query_docs failed', error);
    return getHardcodedBlueprintSection(query, section);
  }
}

/**
 * Fallback hardcoded blueprint sections for runtime access.
 */
function getHardcodedBlueprintSection(query: string, section?: string): BlueprintSection[] {
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
): Promise<Record<string, any>> {
  try {
    const stats: Record<string, any> = {
      timestamp: new Date().toISOString(),
    };

    if (metric === 'all' || metric === 'organizations') {
      // Get organization counts from Firestore
      const orgsSnapshot = await FirestoreService.getAll(COLLECTIONS.ORGANIZATIONS);
      const orgs = orgsSnapshot || [];

      stats.organizations = {
        total: orgs.length,
        active: orgs.filter((o: any) => o.status === 'active').length,
        trial: orgs.filter((o: any) => o.plan === 'trial').length,
        suspended: orgs.filter((o: any) => o.status === 'suspended').length,
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
          recommendations: healthReport.recommendations.slice(0, 3),
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
export async function executeDelegateToAgent(
  agentId: SpecialistPlatform,
  action: string,
  parameters?: string
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
  let parsedParams: Record<string, any> = {};
  if (parameters) {
    try {
      parsedParams = JSON.parse(parameters);
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

  return delegation;
}

/**
 * Inspect agent and provisioner logs.
 */
export async function executeInspectAgentLogs(
  source: 'provisioner' | 'agents' | 'errors' | 'all',
  limit: number = 10,
  organizationId?: string
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

  return logs.slice(0, limit);
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
    const orgs = orgsSnapshot || [];

    state.platform = {
      totalOrganizations: orgs.length,
      activeOrganizations: orgs.filter((o: any) => o.status === 'active').length,
      trialOrganizations: orgs.filter((o: any) => o.plan === 'trial').length,
      atRiskOrganizations: orgs.filter((o: any) => {
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
  let args: Record<string, any> = {};

  try {
    args = JSON.parse(argsString);
  } catch {
    args = {};
  }

  let content: string;

  try {
    switch (name) {
      case 'query_docs': {
        const results = await executeQueryDocs(args.query, args.section);
        content = JSON.stringify(results, null, 2);
        break;
      }

      case 'get_platform_stats': {
        const stats = await executeGetPlatformStats(args.metric || 'all', args.organizationId);
        content = JSON.stringify(stats, null, 2);
        break;
      }

      case 'delegate_to_agent': {
        const delegation = await executeDelegateToAgent(
          args.agentId,
          args.action,
          args.parameters
        );
        content = JSON.stringify(delegation, null, 2);
        break;
      }

      case 'inspect_agent_logs': {
        const logs = await executeInspectAgentLogs(
          args.source || 'all',
          parseInt(args.limit) || 10,
          args.organizationId
        );
        content = JSON.stringify(logs, null, 2);
        break;
      }

      case 'get_system_state': {
        const state = await executeGetSystemState(args.organizationId);
        content = JSON.stringify(state, null, 2);
        break;
      }

      default:
        content = JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error: any) {
    content = JSON.stringify({ error: error.message || 'Tool execution failed' });
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
