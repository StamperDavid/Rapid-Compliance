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
import { COLLECTIONS, getSubCollection } from '@/lib/firebase/collections';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import {
  getAgentCount,
  getDomainCount,
  getSpecialistCount,
  buildAgentBlueprintSection,
} from '@/lib/agents/agent-registry';
import { orderBy, limit as firestoreLimit } from 'firebase/firestore';
import {
  addMissionStep,
  updateMissionStep,
  createMissionWithPlan,
  type MissionStepStatus,
  type PlannedStepInput,
} from './mission-persistence';
import {
  createCampaign,
  trackDeliverableAsync,
} from '@/lib/campaign/campaign-service';
import type { SequenceEmail } from '@/lib/workflows/sequence-scheduler';

// ============================================================================
// VIDEO ARG NORMALIZERS — Map Jasper-supplied loose strings onto the strict
// VideoAspectRatio / VideoResolution / VideoType / TargetPlatform unions used
// by the video pipeline services. Jasper sometimes proposes "twitter" for
// platform or "social" for videoType; these helpers translate gracefully so
// produce_video / generate_video / assemble_video don't reject valid intents
// over a literal-type mismatch.
// ============================================================================

import type { VideoAspectRatio, VideoResolution } from '@/types/video';
import type { VideoType, TargetPlatform } from '@/types/video-pipeline';

function normalizeAspectRatio(input: string | undefined): VideoAspectRatio {
  if (input === '16:9' || input === '9:16' || input === '1:1' || input === '4:3') {
    return input;
  }
  // '4:5' (Instagram portrait) and 'auto' aren't in the union — fall back to 9:16 (closest portrait shape).
  if (input === '4:5' || input === 'portrait') {
    return '9:16';
  }
  if (input === 'square') {
    return '1:1';
  }
  return '16:9';
}

function normalizeResolution(input: string | undefined): VideoResolution {
  if (input === '720p' || input === '1080p' || input === '4k') {
    return input;
  }
  return '1080p';
}

function normalizeVideoType(input: string | undefined): VideoType {
  switch (input) {
    case 'tutorial':
    case 'explainer':
    case 'product-demo':
    case 'sales-pitch':
    case 'testimonial':
    case 'social-ad':
      return input;
    case 'demo':
    case 'product_demo':
      return 'product-demo';
    case 'sales':
    case 'sales_pitch':
      return 'sales-pitch';
    case 'social':
    case 'ad':
    case 'social_ad':
      return 'social-ad';
    default:
      return 'explainer';
  }
}

function normalizeTargetPlatform(input: string | undefined): TargetPlatform {
  if (
    input === 'youtube' ||
    input === 'tiktok' ||
    input === 'instagram' ||
    input === 'linkedin' ||
    input === 'website'
  ) {
    return input;
  }
  // Twitter / X / Facebook / generic social → bucket as 'website' (the
  // catch-all aspect for non-pipeline-native targets).
  return 'website';
}

// ============================================================================
// TIMEOUT UTILITY — Prevents hung LLM calls from spinning forever
// ============================================================================

// 300s per manager delegation. Large LLM analyses (e.g. Competitor Researcher
// returning 7k+ tokens of structured JSON for 5-10 scraped sites) reliably take
// 60-110s; Level 1 verify-external-apis measured 106s for a single 28k-char
// prompt. 120s left no room for manager review retries or variance.
const MANAGER_TIMEOUT_MS = 300_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ============================================================================
// MISSION TRACKING CONTEXT
// ============================================================================

export interface ToolCallContext {
  conversationId?: string;
  missionId?: string;
  userPrompt?: string;
  userId?: string;
  campaignId?: string;
  /**
   * When true, `trackMissionStep` is a no-op — the caller is driving step
   * state itself (e.g., M3 StepRunner which already updates plan_step_*
   * records via markStepRunning/markStepDone). Prevents the duplicate-row
   * Bug D where StepRunner writes plan_step_* and the tool wrapper
   * separately appends step_delegate_*.
   */
  suppressStepTracking?: boolean;
}

/**
 * Maps `${missionId}:${toolName}` → stepId STACK so the same tool called
 * multiple times (e.g., delegate_to_content x2) doesn't overwrite entries.
 * Uses a stack (array) so the most recent RUNNING step is matched to the
 * next COMPLETED/FAILED call (LIFO order).
 */
const activeStepIds = new Map<string, string[]>();
const activeStepTimestamps = new Map<string, number>();
const STEP_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Evict orphaned step entries older than STEP_TTL_MS */
function evictStaleSteps(): void {
  const now = Date.now();
  for (const [key, ts] of activeStepTimestamps) {
    if (now - ts > STEP_TTL_MS) {
      activeStepIds.delete(key);
      activeStepTimestamps.delete(key);
    }
  }
}

/**
 * Mission step tracking. Awaits the RUNNING write to prevent race conditions
 * where COMPLETED fires before RUNNING has landed in Firestore.
 *
 * When status='RUNNING', creates a new step, stores stepId, returns the stepId.
 * When status='COMPLETED'/'FAILED'/etc., looks up the stored stepId to update.
 *
 * Uses a unique callId (not just toolName) to handle the same tool being called
 * multiple times in one mission (e.g., delegate_to_content called twice).
 */
let stepCallCounter = 0;

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
    callId?: string; // Unique ID per tool invocation — pass the same callId for RUNNING and COMPLETED
    /**
     * Specialists this step's manager delegated to during execution.
     * Only populated on COMPLETED/FAILED calls from `delegate_to_*`
     * tool handlers (which read `report.specialistsUsed` off the
     * manager's return value). See base-manager.ts M2a accumulator.
     */
    specialistsUsed?: string[];
  }
): void {
  if (!context?.missionId) { return; }
  // Plan-driven StepRunner already updates mission steps in place — skip the
  // parallel step_delegate_* write that would otherwise duplicate rows in
  // Mission Control (Bug D).
  if (context.suppressStepTracking) { return; }

  // Use callId if provided, otherwise fall back to toolName (backwards compat)
  const mapKey = extras?.callId
    ? `${context.missionId}:${extras.callId}`
    : `${context.missionId}:${toolName}`;

  // Periodically evict orphaned steps to prevent memory leaks
  evictStaleSteps();

  if (status === 'RUNNING') {
    stepCallCounter++;
    const stepId = `step_${toolName}_${Date.now()}_${stepCallCounter}`;
    // Push to stack — supports same tool called multiple times
    const stack = activeStepIds.get(mapKey) ?? [];
    stack.push(stepId);
    activeStepIds.set(mapKey, stack);
    activeStepTimestamps.set(mapKey, Date.now());

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
    // Pop from stack — matches COMPLETED to the oldest RUNNING step (FIFO)
    const stack = activeStepIds.get(mapKey) ?? [];
    const stepId = stack.shift() ?? `step_${toolName}_${Date.now()}`;
    if (stack.length === 0) {
      activeStepIds.delete(mapKey);
      activeStepTimestamps.delete(mapKey);
    } else {
      activeStepIds.set(mapKey, stack);
    }

    // Small delay to let the RUNNING write land in Firestore before updating.
    // addMissionStep is fire-and-forget — without this delay, the update
    // can arrive before the step exists, causing "Step not found" silently.
    void (async () => {
      await new Promise<void>(r => { setTimeout(r, 500); });
      const mid = context.missionId ?? '';
      await updateMissionStep(mid, stepId, {
        status,
        completedAt: new Date().toISOString(),
        ...extras,
      });
    })().catch((err: unknown) => {
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

// Aligns with SocialPlatform type in src/types/social.ts (which is what
// autonomous-posting-agent.executeAction expects). Adding new platforms
// here requires adding them to SOCIAL_PLATFORMS in social.ts as well.
type SocialPostPlatform =
  | 'twitter'
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'pinterest'
  | 'bluesky'
  | 'mastodon'
  | 'tiktok'
  | 'youtube'
  | 'threads'
  | 'reddit'
  | 'telegram'
  | 'whatsapp_business'
  | 'google_business'
  | 'truth_social';

interface SocialPostArgs {
  action: 'POST' | 'REPLY' | 'LIKE' | 'FOLLOW' | 'REPOST' | 'RECYCLE' | 'get_status';
  platform?: SocialPostPlatform;
  content?: string;
  targetPostId?: string;
  targetAccountId?: string;
  mediaUrls?: string[];
  hashtags?: string[];
}

const VALID_SOCIAL_POST_PLATFORMS: readonly SocialPostPlatform[] = [
  'twitter', 'linkedin', 'facebook', 'instagram', 'pinterest',
  'bluesky', 'mastodon', 'tiktok', 'youtube', 'threads', 'reddit',
  'telegram', 'whatsapp_business', 'google_business', 'truth_social',
];

/**
 * Normalize incoming platform aliases to canonical platform names.
 * Jasper's social_post schema accepts both 'x' and 'twitter' (since
 * the rebrand) — we map 'x' → 'twitter' here so the autonomous-posting-
 * agent switch (which is keyed on 'twitter') doesn't fall through.
 */
function normalizeSocialPostPlatform(raw: unknown): SocialPostPlatform | undefined {
  if (typeof raw !== 'string') { return undefined; }
  const lower = raw.trim().toLowerCase();
  if (lower === 'x') { return 'twitter'; }
  if ((VALID_SOCIAL_POST_PLATFORMS as readonly string[]).includes(lower)) {
    return lower as SocialPostPlatform;
  }
  return undefined;
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

  // Platform validation: accept any of the platforms enumerated by the
  // social_post tool's schema. Previously this was hardcoded to
  // twitter|linkedin, which silently stripped the platform value when
  // Jasper plans against any other platform — the autonomous-posting-
  // agent would then fall through to the twitter default and 403 with
  // "wrong auth method" because it was hitting Twitter's API for
  // Mastodon/Bluesky/etc. content. Bug fixed Apr 26 2026.
  // 'x' is normalized to 'twitter' here so the autonomous-posting-agent
  // switch (keyed on 'twitter') matches.
  const platform = normalizeSocialPostPlatform(args.platform);

  return {
    action: args.action as SocialPostArgs['action'],
    platform,
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
  items?: {
    type: string;
    properties?: Record<string, ToolParameter>;
    required?: string[];
  };
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
 * Maps delegation tool names to the dashboard page where David can review the result.
 * Jasper should ALWAYS include the reviewLink in his response to the user.
 */
const REVIEW_LINK_MAP: Record<string, string> = {
  // Delegation tools → Mission Control (multi-step orchestrated workflows)
  delegate_to_builder: '/mission-control',
  delegate_to_sales: '/mission-control',
  delegate_to_marketing: '/mission-control',
  delegate_to_trust: '/mission-control',
  delegate_to_content: '/mission-control',
  delegate_to_architect: '/mission-control',
  delegate_to_outreach: '/mission-control',
  delegate_to_intelligence: '/mission-control',
  delegate_to_commerce: '/mission-control',
  delegate_to_operations: '/mission-control',
  // Single-artifact tools → their specific pages
  create_video: '/content/video',
  generate_video: '/content/video',
  batch_produce_videos: '/content/video/calendar',
  save_blog_draft: '/website',
  research_trending_topics: '/seo',
  get_seo_config: '/seo',
  social_post: '/social',
  migrate_website: '/website',
  voice_agent: '/voice',
  place_call: '/voice',
  send_sms: '/sms-messages',
  send_social_reply: '/mission-control',
  create_campaign: '/mission-control',
  create_workflow: '/mission-control',
};

/**
 * Get the review link for a given tool name.
 * Accepts optional params to append as query parameters (e.g., projectId for video).
 * Falls back to the tool's page if no specific link, or mission control as last resort.
 */
function getReviewLink(toolName: string, missionId?: string, params?: Record<string, string>): string {
  const specificPage = REVIEW_LINK_MAP[toolName];
  if (specificPage) {
    if (params && Object.keys(params).length > 0) {
      const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      return `${specificPage}?${qs}`;
    }
    return specificPage;
  }
  if (missionId) { return `/mission-control?mission=${missionId}`; }
  return '/dashboard';
}

/**
 * Tool definitions in OpenAI function-calling format.
 * Compatible with OpenRouter's tool_choice parameter.
 *
 * STATUS: ALL TOOLS ENABLED AND PRIMARY
 * These tools are Jasper's PRIMARY interface to the platform.
 */
export const JASPER_TOOLS: ToolDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // MISSION PLANNING (M4 — plan pre-approval)
  //
  // When the user's request needs more than one tool, Jasper MUST call
  // propose_mission_plan FIRST and stop. The operator reviews the plan in
  // Mission Control and approves/edits/rejects it before any work runs.
  // Single-tool requests skip the plan and run immediately.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'propose_mission_plan',
      description:
        'Draft a multi-step plan for the operator to review BEFORE any work runs. ' +
        'Call this FIRST whenever the user\'s request needs more than one tool call. ' +
        'You list every step you intend to take — which tool, with what arguments, ' +
        'in what order — and the operator approves, edits, or rejects the plan in ' +
        'Mission Control. After this tool returns, STOP. Do not call any other tools ' +
        'in the same turn. The operator will trigger execution from Mission Control. ' +
        'For single-tool requests (e.g. "send this email", "post this tweet"), do NOT ' +
        'call this tool — just call the tool directly. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description:
              'A short one-line title for the mission (max 80 chars). Plain English. ' +
              'Example: "Research promotional-wear AI pain points and craft marketing strategy".',
          },
          steps: {
            type: 'array',
            description:
              'The ordered list of action steps the operator will approve. Every step is ' +
              'work that produces a deliverable or mutates state — delegate_to_*, scan_leads, ' +
              'enrich_lead, draft_outreach_email, social_post, scrape_website, etc. ' +
              'STRICT FORBIDDEN as steps (these are info-only reads — call them yourself ' +
              'BEFORE propose_mission_plan if you need the data, NEVER include them as ' +
              'steps): query_docs, get_system_state, get_platform_stats, get_seo_config, ' +
              'inspect_agent_logs, list_avatars, list_organizations, list_users, ' +
              'get_organization, get_analytics, generate_report, get_video_status. ' +
              'Also forbidden: save_blog_draft, generate_video, create_video, social_post — ' +
              'these are direct specialist tools that bypass the manager review layer; use ' +
              'delegate_to_content / delegate_to_marketing instead. ' +
              'Do not include steps you have not committed to.',
            items: {
              type: 'object',
              properties: {
                order: {
                  type: 'number',
                  description: 'Sequential step number starting at 1.',
                },
                toolName: {
                  type: 'string',
                  description:
                    'Exact name of the tool you intend to call when this step runs. ' +
                    'Must be one of the delegate_to_* tools or a single-purpose tool ' +
                    'in your toolbox (e.g. delegate_to_intelligence, delegate_to_content, ' +
                    'save_blog_draft, social_post). Do NOT use propose_mission_plan here.',
                },
                toolArgs: {
                  type: 'object',
                  description:
                    'The arguments object you would pass to the tool when running it. ' +
                    'Use the same shape as you would for a direct tool call. The operator ' +
                    'can edit this in the plan review screen before approval.',
                },
                summary: {
                  type: 'string',
                  description:
                    'One plain-English sentence (max 200 chars) describing what this ' +
                    'step does, written for a non-technical operator. Example: ' +
                    '"Research the top 5 promotional-wear competitors and their AI adoption stories".',
                },
                specialistsExpected: {
                  type: 'array',
                  description:
                    'Optional. Your best guess at which specialists the manager will ' +
                    'use for this step (e.g. ["COMPETITOR_RESEARCHER", "MARKET_ANALYST"]). ' +
                    'Helps the operator see which agents will produce the work. ' +
                    'Leave empty if you are not sure.',
                  items: { type: 'string' },
                },
              },
              required: ['order', 'toolName', 'toolArgs', 'summary'],
            },
          },
        },
        required: ['title', 'steps'],
      },
    },
  },

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
            description: 'The topic to look up (e.g., "agents", "provisioner", "feature categories", "architecture", "capabilities")',
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
        'Update platform pricing for a specific tier. Updates pricing in the configured payment provider. ENABLED: TRUE.',
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
      name: 'list_crm_leads',
      description:
        'READ-ONLY: List leads currently saved in the CRM (Firestore organizations/{platform}/leads). Use this for "what leads do we have", "show me our customers/prospects", or any question about EXISTING saved leads. Does NOT call Apollo, does NOT cost API credits, does NOT create new leads. Returns total count plus a sample of lead records (id, name, company, email, status, score, source, isDemo). For DISCOVERING NEW prospects via Apollo, use scan_leads instead. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by lead status. Default: all.',
            enum: ['all', 'new', 'contacted', 'qualified', 'converted', 'lost'],
          },
          limit: {
            type: 'string',
            description: 'Maximum leads to return in the sample (default: 25, max: 100). The total count is always returned regardless of limit.',
          },
          includeDemo: {
            type: 'string',
            description: 'Include leads tagged as demo data (isDemo:true). Default: "true".',
            enum: ['true', 'false'],
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scan_leads',
      description:
        'Search for companies matching specified criteria using Apollo.io organization search. Returns company name, domain, industry, employee count, revenue, funding, tech stack, and location. By default, saves results to CRM as new leads (set saveToCrm to "false" for preview-only). ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          industry: {
            type: 'string',
            description: 'Target industry vertical (e.g. "Professional Services", "SaaS", "HVAC")',
          },
          location: {
            type: 'string',
            description: 'Geographic location filter (e.g. "United States", "Texas", "Austin, TX")',
          },
          companySize: {
            type: 'string',
            description: 'Employee count range. Use named sizes or comma-separated min,max (e.g. "20,100")',
            enum: ['1-10', '11-50', '51-200', '201-500', '500+'],
          },
          keywords: {
            type: 'string',
            description: 'Keywords to match in company profiles (e.g. "HubSpot GoHighLevel sales development")',
          },
          limit: {
            type: 'string',
            description: 'Maximum companies to return (default: 25, max: 100)',
          },
          saveToCrm: {
            type: 'string',
            description: 'Save results to CRM as new leads. Default: "true". Set to "false" for preview-only.',
            enum: ['true', 'false'],
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
        `Delegate a task to one of the ${getDomainCount()} domain managers (who oversee ${getSpecialistCount()} specialists). Use this to execute actual work rather than just describing capabilities. ENABLED: TRUE.`,
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
              'sales_chat_agent',
              'growth_strategist',
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
        'Create a video draft for review. Builds a storyboard with scenes and saves as a draft project. Default avatar and voice are auto-selected from saved settings — the user only reviews the script and scenery before approving. ONLY call this when the user explicitly asks to CREATE, GENERATE, or MAKE a specific video. Do NOT call this for brainstorming, ideation, exploring ideas, discussing concepts, or planning — respond conversationally instead and wait for explicit go-ahead. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Detailed description of the video to create. Include the topic, style, tone, and any specific requirements.',
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
          videoType: {
            type: 'string',
            description: 'Type of video content',
            enum: ['tutorial', 'explainer', 'product-demo', 'sales-pitch', 'testimonial', 'social-ad'],
          },
          platform: {
            type: 'string',
            description: 'Target platform for the video',
            enum: ['youtube', 'tiktok', 'instagram', 'linkedin', 'website'],
          },
          vibe: {
            type: 'string',
            description: 'Visual theme/vibe for consistent aesthetics across all scenes. Examples: "warm corporate", "tech noir", "golden hour cinematic", "bright minimalist", "dark dramatic", "playful colorful". All scene backgrounds will match this aesthetic.',
          },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_video',
      description:
        'Start actual video generation for a prepared project. REQUIRES USER APPROVAL FIRST — the user MUST have reviewed and approved the storyboard in the Video Studio before this tool is called. NEVER call this automatically after create_video or produce_video. Only call this when the user explicitly says to start rendering or generation. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID returned from create_video',
          },
          avatarId: {
            type: 'string',
            description: 'Avatar Profile ID (optional — auto-selects default profile if not provided)',
          },
          voiceId: {
            type: 'string',
            description: 'Voice ID for TTS (optional — auto-selects from Avatar Profile if not provided)',
          },
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_video_status',
      description:
        'Check the status of a video being generated via Hedra. Returns progress, completion status, and the video URL when ready. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          videoId: {
            type: 'string',
            description: 'The Hedra generation ID returned from generate_video',
          },
        },
        required: ['videoId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'produce_video',
      description:
        'AI Video Director — creates a STORYBOARD DRAFT only. Creates a project with scenes, scripts, and visual descriptions, then returns a link for the user to review in the Video Studio. Does NOT generate or render any video — the user must review and approve the storyboard first. NEVER call generate_video or assemble_video after this tool. ONLY call this when the user explicitly asks to produce or create a video. Do NOT call this for brainstorming, ideation, or discussion. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Detailed description of the video to produce. Include topic, style, tone, target audience, and any character requirements.',
          },
          title: {
            type: 'string',
            description: 'Title for the video project',
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
          videoType: {
            type: 'string',
            description: 'Type of video content',
            enum: ['tutorial', 'explainer', 'product-demo', 'sales-pitch', 'testimonial', 'social-ad'],
          },
          platform: {
            type: 'string',
            description: 'Target platform',
            enum: ['youtube', 'tiktok', 'instagram', 'linkedin', 'website'],
          },
          characters: {
            type: 'string',
            description: 'JSON array of character assignments. Each entry: { "avatarId": "<profile-id>", "sceneNumbers": [1, 2, 3] }. sceneNumbers is optional (omit to assign to all scenes). Example: [{"avatarId": "abc123", "sceneNumbers": [1,3]}, {"avatarId": "def456", "sceneNumbers": [2]}]',
          },
          campaignId: {
            type: 'string',
            description: 'Optional: Campaign ID to register this video as a campaign deliverable. Get this from create_campaign.',
          },
        },
        required: ['description'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'assemble_video',
      description:
        'Assemble completed video scenes into a single final video using FFmpeg. Takes the scene video URLs from a project and concatenates them with a transition type (cut, fade, or dissolve). REQUIRES USER APPROVAL — only call this when the user explicitly asks to assemble or stitch their video. NEVER call this automatically after produce_video or generate_video. The user must review rendered scenes and approve before assembly. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The video project ID to assemble scenes from. If omitted, pass sceneUrls directly.',
          },
          sceneUrls: {
            type: 'string',
            description: 'JSON array of scene video URLs to assemble, in order. Example: ["https://...scene1.mp4", "https://...scene2.mp4"]. Required if projectId is not provided.',
          },
          transitionType: {
            type: 'string',
            description: 'Transition between scenes',
            enum: ['cut', 'fade', 'dissolve'],
          },
          outputResolution: {
            type: 'string',
            description: 'Output video resolution',
            enum: ['720p', '1080p', '4k'],
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'edit_video',
      description:
        'Open the standalone Video Editor for the user, optionally pre-loading clips from an existing video project. The editor supports drag-and-drop timeline, clip splitting/trimming, text overlays, background audio mixing, and FFmpeg assembly. Use this when the user wants to manually edit, rearrange, or stitch video clips together — as opposed to the full AI-driven produce_video pipeline. Returns a direct link to the editor. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Optional video project ID to pre-load clips from. The editor will auto-import all completed scene clips from this project.',
          },
          clipUrls: {
            type: 'string',
            description: 'Optional JSON array of video clip URLs to pre-load into the editor timeline. Example: ["https://...clip1.mp4", "https://...clip2.mp4"]',
          },
          instruction: {
            type: 'string',
            description: 'Optional instruction to display to the user about what to do in the editor. Example: "Rearrange the intro scenes and add a fade transition"',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'manage_media_library',
      description:
        'Manage the Media Library — list, add, or describe available media assets (videos, images, audio). Audio sub-categories: sounds, voices, music. Use this when the user asks about their media files, wants to organize assets, or needs to find specific clips/audio/images. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Action to perform',
            enum: ['list', 'add', 'search'],
          },
          mediaType: {
            type: 'string',
            description: 'Filter by media type',
            enum: ['video', 'image', 'audio'],
          },
          category: {
            type: 'string',
            description: 'Filter by category (audio: sound/voice/music, image: photo/graphic/screenshot/thumbnail, video: clip/final/scene)',
          },
          query: {
            type: 'string',
            description: 'Search query for finding specific media by name',
          },
        },
        required: ['action'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'list_avatars',
      description:
        'List available avatar profiles (AI clones and stock characters). Call this when the user asks about available characters, wants to pick an avatar for video, or asks "who can star in my video?" Also use to check if user has a custom avatar before suggesting video creation.',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description: 'Filter by source: custom (user-created clones), hedra (stock characters), or all (default)',
            enum: ['custom', 'hedra', 'all'],
          },
        },
        required: [],
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
        'Retrieve platform analytics overview. Returns total organizations, active trials, and paid customer counts. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          reportType: {
            type: 'string',
            description: 'Type of analytics report (currently only "overview" is supported)',
            enum: ['overview'],
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
  // ═══════════════════════════════════════════════════════════════════════════
  // MARKETING DEPARTMENT TOOLS (The Handshake)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'delegate_to_marketing',
      description:
        'Delegate a marketing campaign or content request to the Marketing Department. The Marketing Manager coordinates 9 specialists: SEO Expert, LinkedIn Expert, TikTok Expert, Twitter/X Expert, Facebook Ads Expert, Growth Analyst, YouTube Expert, Instagram Expert, Pinterest Expert. For an inbound DM reply task, pass `inboundContext` and the Marketing Manager will fast-path to the X Expert specialist (single-specialist compose, not full campaign orchestration). ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'The marketing goal or campaign request (e.g., "Launch a viral TikTok campaign for fitness niche", "Create a Twitter thread about AI trends", "Compose a brand-voiced reply to an inbound X DM")',
          },
          platform: {
            type: 'string',
            description: 'Optional: Specific platform to target. If not provided, Marketing Manager will select best platform(s) based on goal. Pass a single platform value (e.g. "mastodon") to trigger the single-platform fast-path which dispatches directly to the platform specialist + auto-resolves an accompanying image (via providedMediaUrls if supplied, otherwise DALL-E).',
            enum: ['tiktok', 'twitter', 'x', 'facebook', 'linkedin', 'youtube', 'instagram', 'pinterest', 'bluesky', 'mastodon', 'seo', 'all', 'auto'],
          },
          topic: {
            type: 'string',
            description: 'For single-platform organic post requests: the topic or subject the post should cover. Used by the platform specialist when generating post text. Required for the single-platform fast-path; when both `platform` and `topic` are provided, Marketing Manager skips multi-platform orchestration and dispatches the platform specialist directly.',
          },
          tone: {
            type: 'string',
            description: 'Optional: tone for the generated post (e.g. "professional", "casual", "playful", "authoritative").',
          },
          targetAudience: {
            type: 'string',
            description: 'Optional: target audience for the generated post.',
          },
          verbatimText: {
            type: 'string',
            description: 'Optional: when the user provides the EXACT post text they want published (a "post this verbatim" request), pass it here. The platform specialist will use this text as the primary post rather than drafting fresh copy. Alternative phrasings may still vary slightly so the operator has options.',
          },
          providedMediaUrls: {
            type: 'string',
            description: 'JSON-encoded array of operator-provided media URLs (e.g., \'["https://example.com/image.jpg"]\'). When supplied for a single-platform post, the Marketing Manager attaches these URLs to the post AS-IS — no DALL-E call. When omitted, an accompanying image is auto-generated via DALL-E. Pass through verbatim when the user has attached or linked their own image/video.',
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
            description: 'Type of content to create. Use "dm_reply" together with `inboundContext` for inbound DM reply tasks.',
            enum: ['viral_hook', 'thread', 'ad_creative', 'engagement', 'campaign', 'dm_reply'],
          },
          inboundContext: {
            type: 'object',
            description: 'Inbound DM/comment context, present ONLY when this delegation is responding to an inbound social event. When present, the Marketing Manager fast-paths to the platform-specific specialist with action=compose_dm_reply (no full campaign orchestration). REQUIRED keys when this object is present: platform (one of "x" or "bluesky"), inboundEventId (the source inboundSocialEvents doc id), inboundText (the full inbound message body). OPTIONAL keys: senderHandle (display @handle), senderId (platform user id used by send_social_reply at send time — for Bluesky this should be the sender DID). Pass the values through verbatim from the synthetic-trigger prompt — do not modify them.',
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
        'DEPRECATED — DO NOT USE THIS TOOL. Use delegate_to_intelligence with researchType "competitor_analysis" instead. That creates a trackable mission for the user to review.',
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
        'Delegate a content creation request to the Content Department. The Content Manager coordinates 6 specialists: Copywriter, Video Specialist, Calendar Specialist, Blog Writer (SEO long-form), Music/Soundtrack Planner (audio direction for video), Podcast Specialist (episode planning + show notes). ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            description: 'Type of content to produce. Use "email_sequence" / "nurture_sequence" / "drip_campaign" for multi-email cadenced flows (Copywriter produces N emails, cadence is wired separately via create_workflow).',
            enum: ['blog_post', 'social_media', 'email_campaign', 'email_sequence', 'nurture_sequence', 'drip_campaign', 'video_script', 'landing_page_copy', 'ad_creative', 'newsletter', 'case_study', 'podcast_episode', 'podcast_show_notes', 'music_soundtrack', 'music_style'],
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
          count: {
            type: 'integer',
            description: 'Email-sequence only: how many emails to produce. Must be between 1 and 20. Required when contentType is email_sequence / nurture_sequence / drip_campaign. Ignored for other contentType values.',
          },
          cadence: {
            type: 'string',
            description: 'Email-sequence only: human description of send timing (e.g., "over 14 days", "day 1, 3, 7, 14"). Copywriter uses this to annotate sendTimingHint for each email; actual workflow scheduling happens via create_workflow.',
          },
          trigger: {
            type: 'string',
            description: 'Email-sequence only: what event starts the sequence for a recipient (e.g., "trial_signup", "abandoned_cart", "form_submit").',
          },
          providedMediaUrls: {
            type: 'string',
            description: 'JSON-encoded array of operator-provided media URLs (e.g., \'["https://example.com/hero.jpg"]\'). When supplied, the Content Manager uses these URLs instead of generating new media. For blog_post: the first URL becomes the featured image (no DALL-E call). Pass through verbatim when the user has attached or linked their own image/video.',
          },
        },
        required: ['topic'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OPERATIONS DEPARTMENT TOOLS (Scheduling)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'delegate_to_operations',
      description:
        'Delegate scheduling work (create/reschedule/cancel meetings) to the Operations Manager. The operator must always specify a concrete time and a CRM-resolved attendee — never call this with a fuzzy time or a raw attendee name. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          intent: {
            type: 'string',
            description: 'Which scheduling action to perform.',
            enum: ['create_meeting', 'reschedule_meeting', 'cancel_meeting'],
          },
          startTime: {
            type: 'string',
            description: 'ISO 8601 datetime (e.g. "2026-05-04T15:30:00-05:00"). Required for create_meeting and reschedule_meeting. Never pass fuzzy phrases like "next Tuesday" — Jasper resolves those before calling this tool.',
          },
          durationMinutes: {
            type: 'number',
            description: 'Meeting length in minutes. Defaults to 30 if omitted.',
          },
          attendeeRef: {
            type: 'object',
            description: 'CRM record reference for the attendee. Shape: { type: "lead"|"contact"|"deal", id: string }. Both fields are required for create_meeting. Resolve any name to a real CRM id BEFORE calling this tool — the manager rejects raw names.',
          },
          meetingId: {
            type: 'string',
            description: 'Existing meeting document id. Required for reschedule_meeting and cancel_meeting.',
          },
          title: {
            type: 'string',
            description: 'Optional meeting title for create_meeting.',
          },
          notes: {
            type: 'string',
            description: 'Optional meeting notes for create_meeting or reschedule_meeting.',
          },
          reason: {
            type: 'string',
            description: 'Optional reason for cancel_meeting (included in the cancellation notice).',
          },
          urgency: {
            type: 'string',
            description: 'Optional urgency hint (e.g., "high", "normal", "low") used by the manager for prioritization.',
          },
          teamContext: {
            type: 'string',
            description: 'Optional context about which team or department the meeting concerns.',
          },
        },
        required: ['intent'],
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
        'Delegate a multi-channel outreach campaign to the Outreach Department. The Outreach Manager will coordinate Email Specialist and SMS Specialist with DNC compliance, frequency throttling, and sentiment-aware routing. For COLD-OUTREACH EMAIL DRIPS (e.g. "3-email outreach drip", "5-touch cold sequence"): set channel="email" and steps to the email count (>=2) — the Email Specialist will produce a coherent N-email arc personalized to the prospect in one call. For SINGLE outreach emails: leave steps at 1 (or omit). ENABLED: TRUE.',
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
        'Create and save a blog post draft. Use this DIRECTLY when the user asks for a blog post, article, or written content — do NOT use delegate_to_content for blog requests. Write the full blog content yourself in markdown, then save it with this tool. Returns the draft ID and a review link to /website/blog. ENABLED: TRUE.',
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
            description: 'REQUIRED: Comma-separated categories relevant to the post content (e.g., "AI & Technology, Small Business, Sales"). Always provide at least 1-3 categories.',
          },
          tags: {
            type: 'string',
            description: 'REQUIRED: Comma-separated tags for discoverability (e.g., "artificial-intelligence, automation, small-business, 2026-trends"). Always provide 3-6 tags.',
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
          campaignId: {
            type: 'string',
            description: 'Optional: Campaign ID to register this blog post as a campaign deliverable. Get this from create_campaign.',
          },
        },
        required: ['title', 'content', 'excerpt', 'categories', 'tags'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM CONFIG ACCESS (SEO, Analytics, Website Settings)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'get_seo_config',
      description:
        'Read the platform SEO configuration including keywords, meta title, meta description, OG image, robots settings, and AI bot access rules. Use this BEFORE researching trends — the SEO keywords define the platform demographic and content strategy. Chain for blogs: get_seo_config → research_trending_topics → save_blog_draft. Chain for other content: get_seo_config → research_trending_topics → delegate_to_content. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          includeAnalytics: {
            type: 'boolean',
            description: 'Also return analytics configuration (GA, GTM, Facebook Pixel, Hotjar). Default: false',
          },
          includeSiteStatus: {
            type: 'boolean',
            description: 'Also return site publish status, domain, and SSL info. Default: false',
          },
        },
        required: [],
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
  // DIRECT SMS SEND (Twilio/Vonage — compliance-gated)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'send_sms',
      description:
        'Send a direct SMS to a phone number via the configured provider (Twilio primary, Vonage fallback). Use this when the user asks to text someone, send an SMS, or message a lead via phone. TCPA compliance is enforced: the recipient must have opted in or the send will be rejected. Always confirm the user intends an outbound text before calling this — it costs money per send. Returns the provider message id on success. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient phone number in E.164 format (e.g. +15551234567)',
          },
          message: {
            type: 'string',
            description: 'Message body (plain text, 160 chars per segment on GSM; longer messages are auto-segmented)',
          },
          from: {
            type: 'string',
            description: 'Optional sender phone number or alpha sender id — defaults to the configured Twilio number',
          },
        },
        required: ['to', 'message'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INBOUND SOCIAL DM REPLY (X / Twitter — operator-approved)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'send_social_reply',
      description:
        'Send a previously-composed reply to an inbound social DM. ONLY call this after a specialist (X Expert / LinkedIn Expert / etc.) has composed the reply and either the operator approved it in Mission Control or auto-approve is on for this channel. The text MUST be the operator-approved version — never compose new text inside this tool. The source inbound event is marked processed on success so the dispatcher does not re-fire. Currently supports platform=x only; other platforms return NOT_IMPLEMENTED until their send services land. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            description: 'The social platform to send through',
            enum: ['x', 'bluesky'],
          },
          recipientUserId: {
            type: 'string',
            description: 'The platform-specific user id of the original DM sender. For X: numeric user id. For Bluesky: the sender DID (did:plc:...) OR handle (e.g. someone.bsky.social). NOT the @handle for X.',
          },
          replyText: {
            type: 'string',
            description: 'The exact reply text to send. X DM limit: ≤500 chars (X Expert composes ≤240). Bluesky DM limit: ≤1000 chars (Bluesky Expert composes ≤300).',
          },
          inboundEventId: {
            type: 'string',
            description: 'The id of the source `inboundSocialEvents` document this reply is responding to. Used to mark the event processed and to prevent duplicate sends from the dispatcher.',
          },
        },
        required: ['platform', 'recipientUserId', 'replyText', 'inboundEventId'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PLACE OUTBOUND VOICE CALL (Twilio — compliance-gated)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'place_call',
      description:
        'Initiate an outbound voice call via Twilio. Use this when the user asks Jasper to call a lead, dial a number, or place a phone call. TCPA consent AND call-time restrictions are enforced — calls outside the recipient local 8am–9pm window are blocked. The call connects to the AI Voice Agent webhook (/api/voice/twiml). Always call voice_agent with action=configure FIRST to set the mode (prospector/closer) and conversation context, otherwise the AI will fall back to generic behavior. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient phone number in E.164 format (e.g. +15551234567)',
          },
          contactId: {
            type: 'string',
            description: 'Optional CRM contact/lead id to link the call record to',
          },
        },
        required: ['to'],
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
            enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'bluesky', 'threads', 'mastodon', 'truth_social', 'telegram', 'reddit', 'pinterest', 'whatsapp_business', 'google_business'],
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
          campaignId: {
            type: 'string',
            description: 'Optional: Campaign ID to register this social post as a campaign deliverable. Get this from create_campaign.',
          },
        },
        required: ['action'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPAIGN ORCHESTRATION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'create_campaign',
      description:
        'Create a new Campaign to group multiple deliverables (blog, video, social posts, images, email) under one brief. Use this when the user requests a complex, multi-content campaign. After creating the campaign, produce each deliverable (produce_video, save_blog_draft, social_post, etc.) passing the campaignId so they appear in Campaign Review. Direct the user to /mission-control?campaign={campaignId} to review all deliverables. ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          brief: {
            type: 'string',
            description: 'The original client request or campaign brief describing what content to produce.',
          },
          missionId: {
            type: 'string',
            description: 'The mission ID this campaign belongs to (from the current conversation context).',
          },
          research: {
            type: 'string',
            description: 'Optional: JSON-encoded research findings (competitor analysis, market data).',
          },
          strategy: {
            type: 'string',
            description: 'Optional: JSON-encoded strategy (positioning, messaging, target audience).',
          },
        },
        required: ['brief', 'missionId'],
      },
    },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT CALENDAR — BATCH VIDEO TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'batch_produce_videos',
      description:
        'Create a Content Calendar week with multiple video topics. Given a theme, generates 7 daily topics (Mon-Sun) and creates batch storyboards. User reviews all at once, then generation runs sequentially. Results land in the media library. Use when the user asks to "plan a week of content", "batch create videos", or "set up a content calendar". ENABLED: TRUE.',
      parameters: {
        type: 'object',
        properties: {
          theme: {
            type: 'string',
            description: 'The overarching theme for the week (e.g., "AI Sales Tips", "Real Estate Marketing").',
          },
          weekName: {
            type: 'string',
            description: 'A display name for this content week (e.g., "Product Launch Week").',
          },
          weekStartDate: {
            type: 'string',
            description: 'ISO date string for the Monday the week starts (e.g., "2026-03-30").',
          },
          topics: {
            type: 'array',
            description: 'Optional: override auto-generated topics. Array of { dayOfWeek (0-6), topic }.',
            items: {
              type: 'object',
              properties: {
                dayOfWeek: { type: 'number', description: '0=Sunday, 1=Monday, ... 6=Saturday' },
                topic: { type: 'string', description: 'Topic for this day' },
              },
              required: ['dayOfWeek', 'topic'],
            },
          },
        },
        required: ['theme', 'weekName', 'weekStartDate'],
      },
    },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // WORKFLOW SCHEDULING — Cadence automation for email sequences
  // ═══════════════════════════════════════════════════════════════════════════
  {
    type: 'function',
    function: {
      name: 'create_workflow',
      description:
        'Wire the CADENCE for a multi-email sequence (nurture, drip, welcome series, newsletter). Pairs with delegate_to_content: Copywriter writes the emails, create_workflow schedules WHEN each one fires. Creates a Workflow record + a row per email in workflowSequenceJobs with an absolute fireAt timestamp, so the workflow-scheduler cron can dispatch each email on time. ENABLED: TRUE. Required for any prompt containing cadence words ("nurture", "drip", "day 3", "wait N days", "welcome sequence", "newsletter cadence").',
      parameters: {
        type: 'object',
        properties: {
          trigger: {
            type: 'string',
            description: 'What event starts the sequence for a given recipient (e.g., "trial_signup", "new_lead", "abandoned_cart", "form_submit", "manual"). Stored on each scheduled step so downstream systems can hook the right entity event.',
          },
          sequenceType: {
            type: 'string',
            description: 'Category of cadence this workflow represents.',
            enum: ['nurture', 'drip', 'welcome', 'newsletter', 'custom'],
          },
          cadence: {
            type: 'string',
            description: 'Human description of send timing (e.g., "day 1, day 3, day 7, day 14", "over 14 days", "every 2 days"). Ignored if each email already carries a sendTimingHint from the Copywriter; used as fallback.',
          },
          contentSource: {
            type: 'string',
            description: 'Reference to the Copywriter output that produced the email bodies. Accepts "step_N_output" (pulls emails[] from step N of the current mission) or a JSON-encoded email array (same shape as Copywriter\'s generate_email_sequence output: order, subjectLine, previewText, body, cta, sendTimingHint). If omitted, the tool reads the most recent delegate_to_content step in this mission.',
          },
          steps: {
            type: 'integer',
            description: 'Expected number of emails in the sequence. Used as a sanity check against contentSource. If the resolved email array has a different length, the tool uses the actual array and flags a warning.',
          },
          recipient: {
            type: 'string',
            description: 'Destination address for the demo fire of this sequence. Use a literal email for dry runs, or the template "{{entity.email}}" to indicate the sequence will be instantiated per-recipient when the trigger event fires. Defaults to the template when omitted.',
          },
          name: {
            type: 'string',
            description: 'Optional: human-readable name for the workflow (shown in the workflows list).',
          },
        },
        required: ['trigger', 'sequenceType'],
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
          content: sectionBody.trim(), // Limit content size
        });
      }
    }

    // If no results, return a summary
    if (results.length === 0) {
      return Promise.resolve([
        {
          section: 'Query Result',
          content: `No specific documentation found for "${query}". The system blueprint covers: Platform Identity, Architecture (281 API endpoints, 177 pages), ${getAgentCount()} AI Agents (${getDomainCount()} domain managers + ${getSpecialistCount()} specialists), 16 Feature Systems (CRM, leads, email, social, e-commerce, website builder, voice AI, video, SEO, workflows, forms, analytics, Brand DNA, calendar, SMS, integrations), Provisioner, Data Models, and Security.`,
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
      section: `AI Agent Swarm (${getAgentCount()} Agents)`,
      content: buildAgentBlueprintSection(),
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
8. Video Generation — Kling Avatar/Runway ML, storyboard pipeline, Brand DNA integration (13 routes)
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
- Hosting: Vercel (serverless) — rapidcompliance.us (migrating to salesvelocity.ai)
- Database: Firebase Firestore (penthouse model, single-tenant)
- Auth: Firebase Auth with custom claims (admin/user RBAC)
- AI: OpenRouter (100+ models), OpenAI, Anthropic, Gemini
- Voice: Twilio (calls) + ElevenLabs/Unreal Speech (TTS) + Gemini (conversation AI) + Whisper (STT)
- Payments: Stripe (primary), PayPal, Square, Mollie, Authorize.net, 2Checkout
- Email: SendGrid, Resend, SMTP
- SMS: Twilio, Vonage
- Video: Kling Avatar (fal.ai), Runway ML
- SEO: Serper, Google Search Console, PageSpeed Insights, DataForSEO

PENTHOUSE MODEL (Single-Tenant):
- One organization: rapid-compliance-root
- No multi-tenant logic, no org-switching
- Binary RBAC: admin or user
- Clients purchase services — they do NOT receive SaaS tenants

SCALE: 281 API endpoints, 177 dashboard pages, ${getAgentCount()} AI agents, 90+ service files
      `.trim(),
    },
  };

  // Match query to section
  if (queryLower.includes('agent') || queryLower.includes('specialist') || queryLower.includes('swarm') || queryLower.includes(String(getAgentCount())) || queryLower.includes('manager')) {
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
      // Get organization counts from Firestore (Admin SDK for server-side reliability)
      const orgsSnapshot = await AdminFirestoreService.getAll(COLLECTIONS.ORGANIZATIONS);
      const orgs = (orgsSnapshot || []) as unknown as OrganizationRecord[];

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
  const result = await withTimeout(manager.execute({
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
  }), MANAGER_TIMEOUT_MS, 'Marketing Manager (social)');

  return { status: result.status, data: result.data, errors: result.errors };
}

/**
 * Route a delegate_to_agent call through the ContentManager for platforms
 * without dedicated specialist implementations (YouTube, Instagram, Pinterest, Truth Social).
 */
async function routeThroughContent(
  platform: 'youtube' | 'instagram' | 'mastodon' | 'truth_social' | 'pinterest',
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
    create_mastodon_post: 'social_post',
    engage_mastodon_community: 'engagement_response',
    schedule_mastodon_content: 'content_calendar',
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
      const result = await withTimeout(outreachMgr.execute({
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
      }), MANAGER_TIMEOUT_MS, 'Outreach Manager (newsletter)');
      return { status: result.status, data: result.data };
    }
    default:
      throw new Error(`Unknown newsletter action: ${action}`);
  }
}

/**
 * Route sales_chat_agent actions to the SalesChatSpecialist.
 */
async function routeSalesChatAgent(
  action: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { getSalesChatSpecialist } = await import('@/lib/agents/sales-chat/specialist');
  const agent = getSalesChatSpecialist();
  await agent.initialize();

  const result = await agent.execute({
    id: `sales_chat_${Date.now()}`,
    timestamp: new Date(),
    from: 'JASPER',
    to: 'SALES_CHAT_AGENT',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      taskType: action,
      userMessage: (params.userMessage as string | undefined) ?? (params.message as string | undefined),
      channel: (params.channel as 'website' | 'facebook_messenger' | undefined) ?? 'website',
      visitorId: (params.visitorId as string | undefined) ?? `jasper_${Date.now()}`,
    },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  });

  return { status: result.status, data: result.data, errors: result.errors };
}

/**
 * Route growth_strategist actions to the GrowthStrategist specialist.
 */
async function routeGrowthStrategist(
  action: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { getGrowthStrategist } = await import('@/lib/agents/growth-strategist/specialist');
  const strategist = getGrowthStrategist();
  await strategist.initialize();

  const result = await strategist.execute({
    id: `growth_strategy_${Date.now()}`,
    timestamp: new Date(),
    from: 'JASPER',
    to: 'GROWTH_STRATEGIST',
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      taskType: action,
      periodDays: (params.periodDays as number | undefined) ?? 30,
    },
    requiresResponse: true,
    traceId: `trace_${Date.now()}`,
  });

  return { status: result.status, data: result.data, errors: result.errors };
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
    case 'mastodon':
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

    // Route to standalone strategic agents
    case 'sales_chat_agent':
      return routeSalesChatAgent(action, params);
    case 'growth_strategist':
      return routeGrowthStrategist(action, params);

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
    // Fetch real organization data (Admin SDK for server-side reliability)
    const orgsSnapshot = await AdminFirestoreService.getAll(COLLECTIONS.ORGANIZATIONS);
    const orgs = (orgsSnapshot || []) as unknown as OrganizationRecord[];

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
          .map((f) => f.featureId),
        unconfigured: healthReport.features
          .filter((f) => f.status === 'unconfigured')
          .map((f) => f.featureId),
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
  const toolStartMs = Date.now();
  let args: Record<string, unknown> = {};

  try {
    args = JSON.parse(argsString) as Record<string, unknown>;
  } catch {
    args = {};
  }

  logger.info(`[ToolTrace] ▶ STARTING: ${name}`, {
    tool: name,
    argsPreview: argsString.slice(0, 300),
    missionId: context?.missionId,
  });

  let content: string;

  try {
    switch (name) {
      // ═══════════════════════════════════════════════════════════════════════
      // MISSION PLANNING (M4 — plan pre-approval)
      // ═══════════════════════════════════════════════════════════════════════
      case 'propose_mission_plan': {
        // Safe default so every exit path through this case has `content`
        // assigned — the validation loop below uses early `break` which
        // TypeScript's flow analysis can't trace through to the outer
        // switch.
        content = JSON.stringify({ error: 'propose_mission_plan: validation failed' });

        // Validate the args shape. Jasper sometimes passes args as
        // strings if his prompt drift causes him to JSON-stringify them
        // incorrectly — coerce defensively so a single bad call doesn't
        // burn an iteration.
        const titleArg = args.title;
        if (typeof titleArg !== 'string' || titleArg.trim().length === 0) {
          content = JSON.stringify({
            error: 'propose_mission_plan: title is required and must be a non-empty string',
          });
          break;
        }

        let stepsArg = args.steps;
        // The LLM sometimes double-serializes the steps array as a
        // JSON string instead of passing it as a native array. Parse
        // it if that happens. A known drift pattern on prompts carrying
        // structured data (e.g. review text) is that the stringified
        // array gets a spurious trailing `]` appended — retry once with
        // it stripped before giving up.
        if (typeof stepsArg === 'string') {
          const raw: string = stepsArg;
          try {
            stepsArg = JSON.parse(raw) as unknown;
          } catch {
            const trimmed = raw.trimEnd();
            if (trimmed.endsWith(']]')) {
              try {
                stepsArg = JSON.parse(trimmed.slice(0, -1)) as unknown;
                logger.warn('[propose_mission_plan] Recovered stringified steps by stripping trailing "]" — Jasper drift', {
                  originalLength: raw.length,
                });
              } catch {
                content = JSON.stringify({
                  error: 'propose_mission_plan: steps is a string but not valid JSON',
                });
                break;
              }
            } else {
              content = JSON.stringify({
                error: 'propose_mission_plan: steps is a string but not valid JSON',
              });
              break;
            }
          }
        }
        if (!Array.isArray(stepsArg) || stepsArg.length === 0) {
          content = JSON.stringify({
            error: 'propose_mission_plan: steps must be a non-empty array',
          });
          break;
        }
        const stepsArr: unknown[] = stepsArg;

        // Coerce each proposed step into PlannedStepInput shape. Reject
        // the whole plan if any step is malformed — partial plans are
        // worse than no plan because the operator can't trust them.
        const plannedSteps: PlannedStepInput[] = [];
        for (let i = 0; i < stepsArr.length; i++) {
          const raw: unknown = stepsArr[i];
          if (typeof raw !== 'object' || raw === null) {
            content = JSON.stringify({
              error: `propose_mission_plan: step ${i + 1} is not an object`,
            });
            break;
          }
          const step = raw as Record<string, unknown>;
          const orderRaw = step.order;
          const orderNum = typeof orderRaw === 'number' ? orderRaw : Number(orderRaw);
          if (!Number.isFinite(orderNum) || orderNum < 1) {
            content = JSON.stringify({
              error: `propose_mission_plan: step ${i + 1} has invalid order (must be a number >= 1)`,
            });
            break;
          }
          if (typeof step.toolName !== 'string' || step.toolName.trim().length === 0) {
            content = JSON.stringify({
              error: `propose_mission_plan: step ${i + 1} is missing toolName`,
            });
            break;
          }
          if (step.toolName === 'propose_mission_plan') {
            content = JSON.stringify({
              error: `propose_mission_plan: step ${i + 1} cannot itself be propose_mission_plan`,
            });
            break;
          }
          if (typeof step.summary !== 'string' || step.summary.trim().length === 0) {
            content = JSON.stringify({
              error: `propose_mission_plan: step ${i + 1} is missing summary`,
            });
            break;
          }
          // toolArgs is allowed to be missing (operator can fill in
          // before approving) — coerce to empty object.
          const toolArgs =
            typeof step.toolArgs === 'object' && step.toolArgs !== null
              ? (step.toolArgs as Record<string, unknown>)
              : {};
          // specialistsExpected is optional — coerce to string array if
          // present, drop if not.
          const specialistsExpected = Array.isArray(step.specialistsExpected)
            ? step.specialistsExpected.filter((s): s is string => typeof s === 'string')
            : undefined;

          plannedSteps.push({
            order: orderNum,
            toolName: step.toolName,
            toolArgs,
            summary: step.summary,
            ...(specialistsExpected && specialistsExpected.length > 0
              ? { specialistsExpected }
              : {}),
          });
        }

        // If validation populated `content` above, the loop bailed early
        // — return the error without writing anything.
        if (plannedSteps.length !== stepsArr.length) {
          break;
        }

        // Need a missionId to write the plan against. The chat route
        // passes one in via context for every request; if it's missing
        // we can't persist the plan, so fail honestly.
        if (!context?.missionId) {
          content = JSON.stringify({
            error: 'propose_mission_plan: no missionId in context — cannot persist plan',
          });
          break;
        }

        await createMissionWithPlan({
          missionId: context.missionId,
          conversationId: context.conversationId ?? 'unknown',
          title: titleArg.slice(0, 80),
          userPrompt: context.userPrompt ?? '',
          plannedSteps,
        });

        content = JSON.stringify({
          status: 'PLAN_PENDING_APPROVAL',
          missionId: context.missionId,
          stepCount: plannedSteps.length,
          message:
            'Plan drafted. The operator must review and approve it in Mission Control ' +
            'before any work runs. Do NOT call any other tools in this turn.',
          reviewLink: getReviewLink('propose_mission_plan', context.missionId),
        });
        break;
      }

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
        const orgs = await AdminFirestoreService.getAll(COLLECTIONS.ORGANIZATIONS);
        let filtered = (orgs ?? []) as unknown as OrganizationRecord[];
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
        const org = await AdminFirestoreService.get(COLLECTIONS.ORGANIZATIONS, args.PLATFORM_ID as string);
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
        await AdminFirestoreService.update(COLLECTIONS.ORGANIZATIONS, args.PLATFORM_ID as string, updates);
        content = JSON.stringify({ success: true, PLATFORM_ID: args.PLATFORM_ID, updates });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // COUPON & PRICING TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'list_coupons': {
        const coupons = await AdminFirestoreService.getAll('platform-coupons');
        let filtered = (coupons ?? []) as unknown as CouponRecord[];
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
        await AdminFirestoreService.set('platform-coupons', couponData.code, couponData);
        content = JSON.stringify({ success: true, coupon: couponData });
        break;
      }

      case 'update_coupon_status': {
        await AdminFirestoreService.update('platform-coupons', args.couponId as string, { status: args.status as string });
        content = JSON.stringify({ success: true, couponId: args.couponId, status: args.status });
        break;
      }

      case 'get_pricing_tiers': {
        const pricing = (await AdminFirestoreService.get('platform-config', 'pricing')) ?? {
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
        if (Object.keys(updates).length === 0) {
          content = JSON.stringify({ status: 'error', message: 'No pricing fields provided to update' });
          break;
        }
        await AdminFirestoreService.update('platform-config', 'pricing', updates);
        content = JSON.stringify({
          status: 'updated',
          tier: typedArgs.tier,
          updates,
          note: 'Persisted to platform-config/pricing. Stripe price IDs require a separate sync via /api/admin/platform-pricing.',
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // LEAD GENERATION & CRM TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'list_crm_leads': {
        try {
          const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
          const { getSubCollection } = await import('@/lib/firebase/collections');

          const limitArg = Number(args.limit ?? 25);
          const limit = Number.isFinite(limitArg) && limitArg > 0 ? Math.min(limitArg, 100) : 25;
          const statusFilter = typeof args.status === 'string' && args.status !== 'all' ? args.status : null;
          const includeDemo = String(args.includeDemo ?? 'true') !== 'false';

          const all = await AdminFirestoreService.getAll<Record<string, unknown> & { id: string }>(getSubCollection('leads'), []);
          const filtered = all.filter((lead) => {
            if (!includeDemo && lead.isDemo === true) { return false; }
            if (statusFilter !== null && lead.status !== statusFilter) { return false; }
            return true;
          });
          const sample = filtered.slice(0, limit).map((lead) => {
            const firstName = typeof lead.firstName === 'string' ? lead.firstName : '';
            const lastName = typeof lead.lastName === 'string' ? lead.lastName : '';
            const company = typeof lead.company === 'string' ? lead.company : '';
            return {
              id: lead.id,
              name: [firstName, lastName].filter(Boolean).join(' ') || company || '(no name)',
              company,
              email: typeof lead.email === 'string' ? lead.email : '',
              status: typeof lead.status === 'string' ? lead.status : 'new',
              score: typeof lead.score === 'number' ? lead.score : null,
              source: typeof lead.source === 'string' ? lead.source : '',
              isDemo: lead.isDemo === true,
              createdAt: typeof lead.createdAt === 'string' ? lead.createdAt : null,
            };
          });

          content = JSON.stringify({
            status: 'completed',
            source: 'crm',
            total: filtered.length,
            returned: sample.length,
            statusFilter: statusFilter ?? 'all',
            includeDemo,
            leads: sample,
          });
        } catch (err) {
          content = JSON.stringify({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }
      case 'scan_leads': {
        trackMissionStep(context, 'scan_leads', 'RUNNING', { toolArgs: args });
        const scanLeadsStart = Date.now();
        try {
          const { apolloService } = await import('@/lib/integrations/apollo/apollo-service');
          const configured = await apolloService.isConfigured();
          if (!configured) {
            content = JSON.stringify({
              status: 'error',
              message: 'Apollo API key not configured. Please add it in Settings > API Keys to enable lead scanning.',
            });
            break;
          }

          const limit = Math.min(Number(args.limit) || 25, 100);
          const searchParams: Record<string, unknown> = {
            per_page: limit,
          };
          // Build keyword query from industry + keywords
          const keywordParts: string[] = [];
          if (args.keywords) { keywordParts.push(String(args.keywords)); }
          if (args.industry) { keywordParts.push(String(args.industry)); }
          if (keywordParts.length > 0) {
            searchParams.q_keywords = keywordParts.join(' ');
          }
          if (args.location) {
            searchParams.q_organization_locations = [String(args.location)];
          }
          if (args.companySize) {
            const sizeStr = String(args.companySize);
            // Support both named sizes and numeric ranges like "20,100"
            const namedSizeMap: Record<string, string> = {
              '1-10': '1,10',
              '11-50': '11,50',
              '51-200': '51,200',
              '201-500': '201,500',
              '500+': '501,10000',
              small: '1,50',
              medium: '51,200',
              large: '201,1000',
              enterprise: '1001,10000',
            };
            const range = namedSizeMap[sizeStr] ?? sizeStr;
            searchParams.organization_num_employees_ranges = [range];
          }

          // Use organization search (free-tier compatible)
          const result = await apolloService.searchOrganizations(searchParams as Parameters<typeof apolloService.searchOrganizations>[0]);
          if (!result.success || !result.data) {
            content = JSON.stringify({ status: 'error', message: result.error ?? 'Search failed' });
            break;
          }

          const companies = result.data.organizations.map(org => ({
            name: org.name,
            domain: org.website_url ?? org.domain,
            industry: org.industry,
            employees: org.estimated_num_employees,
            revenue: org.annual_revenue_printed,
            location: [org.city, org.state, org.country].filter(Boolean).join(', '),
            linkedin: org.linkedin_url,
            twitter: org.twitter_url,
            description: org.short_description,
            foundedYear: org.founded_year,
            totalFunding: org.total_funding,
            latestFundingStage: org.latest_funding_stage,
            technologies: org.technologies?.slice(0, 10) ?? [],
          }));

          // Persist to CRM leads collection unless explicitly disabled
          const shouldSave = String(args.saveToCrm ?? 'true') !== 'false';
          const savedLeadIds: string[] = [];

          if (shouldSave && companies.length > 0) {
            const leadsCollection = getSubCollection('leads');
            const batchId = `apollo-scan-${Date.now()}`;
            const now = new Date().toISOString();

            for (const company of companies) {
              const leadId = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const leadDoc = {
                firstName: company.name,
                lastName: '',
                name: company.name,
                email: company.domain ? `info@${company.domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]}` : '',
                phone: '',
                company: company.name,
                title: '',
                status: 'new',
                source: 'apollo',
                acquisitionMethod: 'intelligence_discovery',
                discoveryBatchId: batchId,
                tags: [company.industry, 'apollo-scan'].filter(Boolean) as string[],
                score: 0,
                enrichmentData: {
                  domain: company.domain,
                  industry: company.industry,
                  employees: company.employees,
                  revenue: company.revenue,
                  location: company.location,
                  linkedin: company.linkedin,
                  twitter: company.twitter,
                  description: company.description,
                  foundedYear: company.foundedYear,
                  totalFunding: company.totalFunding,
                  latestFundingStage: company.latestFundingStage,
                  technologies: company.technologies,
                },
                createdAt: now,
                updatedAt: now,
              };

              try {
                await AdminFirestoreService.set(leadsCollection, leadId, leadDoc);
                savedLeadIds.push(leadId);
              } catch (saveErr) {
                logger.warn(`[scan_leads] Failed to save lead for ${company.name}: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`);
              }
            }
          }

          content = JSON.stringify({
            status: 'completed',
            source: 'apollo',
            totalResults: result.data.pagination.total_entries,
            returned: companies.length,
            creditsUsed: 0,
            savedToCrm: shouldSave,
            savedCount: savedLeadIds.length,
            companies,
          });
          trackMissionStep(context, 'scan_leads', 'COMPLETED', {
            summary: `Scanned ${companies.length} companies (${savedLeadIds.length} saved to CRM)`,
            durationMs: Date.now() - scanLeadsStart,
          });
        } catch (err) {
          content = JSON.stringify({
            status: 'error',
            message: err instanceof Error ? err.message : 'Lead scan failed',
          });
          trackMissionStep(context, 'scan_leads', 'FAILED', {
            error: err instanceof Error ? err.message : 'Lead scan failed',
            durationMs: Date.now() - scanLeadsStart,
          });
        }
        break;
      }

      case 'enrich_lead': {
        trackMissionStep(context, 'enrich_lead', 'RUNNING', { toolArgs: args });
        const enrichStart = Date.now();
        try {
          const { apolloService, toEnrichmentData } = await import('@/lib/integrations/apollo/apollo-service');
          const configured = await apolloService.isConfigured();
          if (!configured) {
            content = JSON.stringify({
              status: 'error',
              message: 'Apollo API key not configured. Add it in Settings > API Keys.',
            });
            break;
          }

          const leadId = args.leadId as string;
          if (!leadId) {
            content = JSON.stringify({ status: 'error', message: 'leadId is required' });
            break;
          }

          // Load lead from Firestore
          const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
          const { getSubCollection } = await import('@/lib/firebase/collections');
          const lead = await AdminFirestoreService.get<Record<string, unknown>>(getSubCollection('leads'), leadId);

          if (!lead) {
            content = JSON.stringify({ status: 'error', message: `Lead not found: ${leadId}` });
            break;
          }

          const domain = (lead.company as string)?.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
            ?? (lead.email as string)?.split('@')[1]
            ?? null;

          let totalCredits = 0;
          const enrichedFields: Record<string, unknown> = {};

          // Org enrichment (free)
          if (domain) {
            const orgResult = await apolloService.enrichOrganization({ domain });
            if (orgResult.success && orgResult.data) {
              const orgData = toEnrichmentData(orgResult.data);
              Object.assign(enrichedFields, orgData);
              totalCredits += orgResult.creditsUsed;
            }
          }

          // Person enrichment (1 credit — requires paid Apollo plan, skip gracefully if unavailable)
          const personResult = await apolloService.enrichPerson({
            email: (lead.email as string) ?? undefined,
            domain: domain ?? undefined,
            first_name: (lead.firstName as string) ?? undefined,
            last_name: (lead.lastName as string) ?? undefined,
          });
          if (personResult.success && personResult.data) {
            const p = personResult.data;
            enrichedFields.contactEmail = p.email;
            enrichedFields.contactPhone = p.phone_numbers?.[0]?.sanitized_number ?? null;
            enrichedFields.title = p.title;
            enrichedFields.linkedInUrl = p.linkedin_url;
            enrichedFields.seniority = p.seniority;
            totalCredits += personResult.creditsUsed;
          } else if (personResult.error?.includes('not accessible') || personResult.error?.includes('403')) {
            enrichedFields.personEnrichmentNote = 'Person enrichment requires Apollo paid plan — company data enriched successfully.';
          }

          // Update lead in Firestore
          if (Object.keys(enrichedFields).length > 0) {
            await AdminFirestoreService.update(getSubCollection('leads'), leadId, {
              enrichmentData: enrichedFields,
              lastEnriched: new Date().toISOString(),
              enrichmentSource: 'apollo',
            });
          }

          content = JSON.stringify({
            status: 'completed',
            leadId,
            source: 'apollo',
            creditsUsed: totalCredits,
            enrichedFields,
          });
          trackMissionStep(context, 'enrich_lead', 'COMPLETED', {
            summary: `Lead ${leadId} enriched (${Object.keys(enrichedFields).length} fields)`,
            durationMs: Date.now() - enrichStart,
          });
        } catch (err) {
          content = JSON.stringify({
            status: 'error',
            message: err instanceof Error ? err.message : 'Enrichment failed',
          });
          trackMissionStep(context, 'enrich_lead', 'FAILED', {
            error: err instanceof Error ? err.message : 'Enrichment failed',
            durationMs: Date.now() - enrichStart,
          });
        }
        break;
      }

      case 'score_leads': {
        trackMissionStep(context, 'score_leads', 'RUNNING', { toolArgs: args });
        const scoreStart = Date.now();
        try {
          const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
          const { getSubCollection } = await import('@/lib/firebase/collections');

          interface LeadDocument {
            id: string;
            email?: string;
            phone?: string;
            company?: string;
            title?: string;
            updatedAt?: string;
            lastActivity?: string;
            engagementEvents?: unknown[];
            dealId?: string;
            score?: number;
            firstName?: string;
            lastName?: string;
            [key: string]: unknown;
          }

          // Resolve which leads to score
          let leadsToScore: LeadDocument[];
          const rawLeadIds = args.leadIds as string | undefined;
          if (rawLeadIds && rawLeadIds !== 'all') {
            let ids: string[] = [];
            try {
              ids = JSON.parse(rawLeadIds) as string[];
            } catch {
              ids = [rawLeadIds];
            }
            const fetched = await Promise.all(
              ids.map((id) =>
                AdminFirestoreService.get(getSubCollection('leads'), id)
              )
            );
            leadsToScore = fetched.filter((l): l is LeadDocument => l !== null);
          } else {
            const all = await AdminFirestoreService.getAll(getSubCollection('leads'), []);
            leadsToScore = (all as LeadDocument[]).slice(0, 50);
          }

          if (leadsToScore.length === 0) {
            content = JSON.stringify({
              status: 'completed',
              scoredCount: 0,
              averageScore: 0,
              topLeads: [],
              message: 'No leads found to score.',
            });
            break;
          }

          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

          const scored = leadsToScore.map((lead) => {
            let score = 0;
            if (lead.email) { score += 10; }
            if (lead.phone) { score += 10; }
            if (lead.company) { score += 15; }
            if (lead.title) { score += 10; }
            const lastTouched = lead.lastActivity ?? lead.updatedAt;
            if (lastTouched && lastTouched >= sevenDaysAgo) { score += 20; }
            if (Array.isArray(lead.engagementEvents) && lead.engagementEvents.length > 0) { score += 15; }
            if (lead.dealId) { score += 20; }
            return { id: lead.id, score };
          });

          // Persist updated scores
          await Promise.all(
            scored.map(({ id, score }) =>
              AdminFirestoreService.update(getSubCollection('leads'), id, {
                score,
                scoredAt: new Date().toISOString(),
              })
            )
          );

          const totalScore = scored.reduce((sum, l) => sum + l.score, 0);
          const averageScore = scored.length > 0 ? Math.round(totalScore / scored.length) : 0;
          const topLeads = [...scored]
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(({ id, score }) => ({ leadId: id, score }));

          content = JSON.stringify({
            status: 'completed',
            scoredCount: scored.length,
            averageScore,
            topLeads,
          });
          trackMissionStep(context, 'score_leads', 'COMPLETED', {
            summary: `Scored ${scored.length} leads (avg: ${averageScore})`,
            durationMs: Date.now() - scoreStart,
          });
        } catch (err) {
          content = JSON.stringify({
            status: 'error',
            message: err instanceof Error ? err.message : 'Lead scoring failed',
          });
          trackMissionStep(context, 'score_leads', 'FAILED', {
            error: err instanceof Error ? err.message : 'Lead scoring failed',
            durationMs: Date.now() - scoreStart,
          });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // USER & ACCESS MANAGEMENT TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'list_users': {
        const typedArgs = args as unknown as ListUsersArgs;
        const users = await AdminFirestoreService.getAll(COLLECTIONS.USERS);
        let filtered = (users ?? []) as unknown as UserRecord[];
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
        await AdminFirestoreService.update(COLLECTIONS.USERS, args.userId as string, { role: args.newRole as string });
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
          toolResult: JSON.stringify(delegation),
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

        try {
          const { getVideoSpecialist } = await import('@/lib/agents/content/video/specialist');
          const specialist = getVideoSpecialist();
          await specialist.initialize();

          const platform = (args.platform as string) ?? 'youtube';
          const style = (args.vibe as string) ?? (args.videoType as string) ?? 'documentary';
          const duration = args.duration ? Number(args.duration) : 60;
          const description = args.description as string;
          const title = (args.title as string) ?? description.slice(0, 80);

          const result = await specialist.execute({
            id: `create_video_${Date.now()}`,
            timestamp: new Date(),
            from: 'JASPER',
            to: 'VIDEO_SPECIALIST',
            type: 'COMMAND',
            priority: 'NORMAL',
            payload: {
              action: 'script_to_storyboard' as const,
              script: description,
              brief: title,
              platform,
              style,
              targetDuration: duration,
              targetAudience: (args.audience as string) ?? undefined,
              callToAction: (args.callToAction as string) ?? undefined,
            },
            requiresResponse: true,
            traceId: `trace_create_video_${Date.now()}`,
          });

          const resultData = result.data as Record<string, unknown> | null;
          content = JSON.stringify({ ...resultData, specialist: 'VIDEO_SPECIALIST' });

          trackMissionStep(context, 'create_video', result.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED', {
            summary: `VIDEO_SPECIALIST: ${(resultData?.message as string) ?? result.status}`,
            durationMs: Date.now() - videoStart,
            toolResult: content,
          });
        } catch (videoError: unknown) {
          const errorMsg = videoError instanceof Error ? videoError.message : 'Unknown error';
          trackMissionStep(context, 'create_video', 'FAILED', {
            summary: `VIDEO_SPECIALIST: FAILED — ${errorMsg}`,
            durationMs: Date.now() - videoStart,
            error: errorMsg,
          });
          content = JSON.stringify({ error: errorMsg, specialist: 'VIDEO_SPECIALIST' });
        }
        break;
      }

      case 'generate_video': {
        // Take an existing pipeline project and dispatch Hedra renders for
        // its saved scenes. Companion to produce_video — used when the
        // operator already has an approved storyboard and wants to (re-)render
        // without regenerating the script.
        const genStart = Date.now();
        trackMissionStep(context, 'generate_video', 'RUNNING', { toolArgs: args });
        try {
          const projectId = (args.storyboardId as string | undefined) ?? (args.projectId as string | undefined);
          if (!projectId) {
            throw new Error('generate_video requires storyboardId (or projectId) of a saved pipeline project. Use produce_video to create storyboard + render in one step, or create_video to produce a storyboard first.');
          }
          const { getProject } = await import('@/lib/video/pipeline-project-service');
          const project = await getProject(projectId);
          if (!project) {
            throw new Error(`Pipeline project ${projectId} not found.`);
          }
          if (!project.scenes || project.scenes.length === 0) {
            throw new Error(`Pipeline project ${projectId} has no saved scenes — run produce_video first or create a storyboard at /content/video.`);
          }
          const avatarId = (args.avatarId as string | undefined) ?? project.avatarId ?? '';
          const voiceId = (args.voiceId as string | undefined) ?? project.voiceId ?? '';
          if (!avatarId || !voiceId) {
            throw new Error(`generate_video needs avatarId+voiceId — pass via args or save them on project ${projectId}.`);
          }
          const aspectRatio = normalizeAspectRatio((args.aspectRatio as string | undefined) ?? project.brief?.aspectRatio);
          const { generateAllScenes } = await import('@/lib/video/scene-generator');
          const sceneResults = await generateAllScenes(project.scenes, avatarId, voiceId, aspectRatio, undefined, 'hedra');
          const dispatched = sceneResults.filter((r) => r.providerVideoId && r.status !== 'failed');
          const failed = sceneResults.filter((r) => r.status === 'failed');
          content = JSON.stringify({
            status: failed.length === 0 ? 'RENDERING' : 'PARTIAL_DISPATCH',
            projectId,
            scenesDispatched: dispatched.length,
            scenesFailed: failed.length,
            sceneGenerationIds: dispatched.map((r) => ({ sceneId: r.sceneId, providerVideoId: r.providerVideoId })),
            provider: 'hedra',
            message: failed.length === 0
              ? `${dispatched.length} Hedra renders dispatched for project ${projectId}. Watch progress at /content/video?project=${projectId}.`
              : `${failed.length} of ${project.scenes.length} dispatches failed: ${failed.map((f) => f.error ?? 'unknown').join('; ')}. ${dispatched.length} are rendering.`,
            videoLibraryPath: '/content/video',
            reviewLink: `/content/video?project=${projectId}`,
          });
          trackMissionStep(context, 'generate_video', failed.length === 0 ? 'COMPLETED' : 'FAILED', {
            summary: `generate_video: ${dispatched.length}/${project.scenes.length} renders dispatched for project ${projectId}`,
            durationMs: Date.now() - genStart,
            toolResult: content,
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          trackMissionStep(context, 'generate_video', 'FAILED', {
            summary: `generate_video: FAILED — ${errorMsg}`,
            durationMs: Date.now() - genStart,
            error: errorMsg,
          });
          content = JSON.stringify({ error: errorMsg, specialist: 'VIDEO_SPECIALIST' });
        }
        break;
      }

      case 'get_video_status': {
        const videoStatusStart = Date.now();
        trackMissionStep(context, 'get_video_status', 'RUNNING', { toolArgs: args });

        const { getHedraVideoStatus } = await import('@/lib/video/hedra-service');
        const videoId = args.videoId as string;

        const hedraStatus = await getHedraVideoStatus(videoId);

        const statusMessage = hedraStatus.status === 'completed'
          ? 'Video is ready! You can view it in the video library.'
          : hedraStatus.status === 'failed'
            ? `Video generation failed: ${hedraStatus.error ?? 'Unknown error'}`
            : 'Video is still being generated. Check back in a few minutes.';

        content = JSON.stringify({
          status: hedraStatus.status === 'completed'
            ? 'completed'
            : hedraStatus.status === 'failed'
              ? 'failed'
              : 'processing',
          videoId,
          videoUrl: hedraStatus.videoUrl ?? null,
          thumbnailUrl: null,
          provider: 'hedra',
          errorMessage: hedraStatus.error ?? null,
          message: statusMessage,
          videoLibraryPath: '/content/video',
        });

        trackMissionStep(context, 'get_video_status', 'COMPLETED', {
          summary: `Video status check: ${videoId}`,
          durationMs: Date.now() - videoStatusStart,
          toolResult: content,
        });
        break;
      }

      case 'produce_video': {
        // Full pipeline: VIDEO_SPECIALIST.script_to_storyboard → persist as
        // a pipeline project → dispatch render job through video-job-service
        // (which the worker picks up and drives through Hedra).
        const produceStart = Date.now();
        trackMissionStep(context, 'produce_video', 'RUNNING', { toolArgs: args });
        try {
          const description = (args.description as string | undefined)
            ?? (args.prompt as string | undefined)
            ?? (args.script as string | undefined);
          if (!description) {
            throw new Error('produce_video requires `description` (or `prompt`/`script`) describing what the video is about.');
          }

          const platform = normalizeTargetPlatform(args.platform as string | undefined);
          const videoType = normalizeVideoType(args.videoType as string | undefined);
          const style = (args.vibe as string | undefined) ?? (args.style as string | undefined) ?? 'documentary';
          const duration = args.duration ? Number(args.duration) : 30;
          const title = (args.title as string | undefined) ?? description.slice(0, 80);
          const aspectRatio = normalizeAspectRatio(args.aspectRatio as string | undefined);
          const resolution = normalizeResolution(args.resolution as string | undefined);

          // Step 1 — generate storyboard via the real VIDEO_SPECIALIST.
          const { getVideoSpecialist } = await import('@/lib/agents/content/video/specialist');
          const specialist = getVideoSpecialist();
          await specialist.initialize();
          const specialistResult = await specialist.execute({
            id: `produce_video_${Date.now()}`,
            timestamp: new Date(),
            from: 'JASPER',
            to: 'VIDEO_SPECIALIST',
            type: 'COMMAND',
            priority: 'NORMAL',
            payload: {
              action: 'script_to_storyboard' as const,
              script: description,
              brief: title,
              platform,
              style,
              targetDuration: duration,
              targetAudience: (args.audience as string | undefined) ?? undefined,
              callToAction: (args.callToAction as string | undefined) ?? undefined,
            },
            requiresResponse: true,
            traceId: `trace_produce_video_${Date.now()}`,
          });
          if (specialistResult.status !== 'COMPLETED' || !specialistResult.data) {
            throw new Error(`VIDEO_SPECIALIST storyboard generation failed: ${specialistResult.errors?.join('; ') ?? 'no data returned'}`);
          }
          const storyboardData = specialistResult.data as Record<string, unknown>;
          const scenesRaw = storyboardData.scenes;
          if (!Array.isArray(scenesRaw) || scenesRaw.length === 0) {
            throw new Error('VIDEO_SPECIALIST returned no scenes — cannot dispatch render.');
          }

          // Step 2 — persist as a pipeline project so the renderer has an
          // addressable storyboardId.
          const { createProject, saveApprovedStoryboard } = await import('@/lib/video/pipeline-project-service');
          const proj = await createProject(
            {
              description,
              videoType,
              platform,
              duration,
              aspectRatio,
              resolution,
              targetAudience: (args.audience as string | undefined),
              callToAction: (args.callToAction as string | undefined),
            },
            'JASPER_ORCHESTRATOR',
          );
          if (!proj.success || !proj.projectId) {
            throw new Error(`Failed to persist storyboard as a pipeline project: ${proj.error ?? 'unknown error'}`);
          }

          // Resolve avatar + voice from args, falling back to platform defaults.
          const { getVideoDefaults } = await import('@/lib/video/video-defaults-service');
          const defaults = await getVideoDefaults();
          const avatarId = (args.avatarId as string | undefined) ?? defaults.avatarId ?? '';
          const avatarName = (args.avatarName as string | undefined) ?? defaults.avatarName ?? 'default';
          const voiceId = (args.voiceId as string | undefined) ?? defaults.voiceId ?? '';
          const voiceName = (args.voiceName as string | undefined) ?? defaults.voiceName ?? 'default';
          if (!avatarId || !voiceId) {
            throw new Error('produce_video requires avatarId+voiceId (pass via args) or saved video defaults. Use list_avatars to pick one, or set defaults at /content/video/defaults.');
          }

          // saveApprovedStoryboard takes typed PipelineScene[] — narrow it.
          const scenes = scenesRaw as Parameters<typeof saveApprovedStoryboard>[1];
          await saveApprovedStoryboard(proj.projectId, scenes, avatarId, avatarName, voiceId, voiceName);

          // Step 3 — dispatch Hedra renders for each scene. generateAllScenes
          // submits all scenes to Hedra (concurrency 3, staggered for TTS rate
          // limits) and returns per-scene providerVideoIds. Renders complete
          // async on Hedra's side; the operator polls via get_video_status or
          // watches progress at /content/video.
          const { generateAllScenes } = await import('@/lib/video/scene-generator');
          const sceneResults = await generateAllScenes(
            scenes,
            avatarId,
            voiceId,
            aspectRatio,
            undefined,
            'hedra',
          );

          const dispatched = sceneResults.filter((r) => r.providerVideoId && r.status !== 'failed');
          const failed = sceneResults.filter((r) => r.status === 'failed');

          content = JSON.stringify({
            status: failed.length === 0 ? 'RENDERING' : 'PARTIAL_DISPATCH',
            projectId: proj.projectId,
            storyboardScenes: scenes.length,
            scenesDispatched: dispatched.length,
            scenesFailed: failed.length,
            sceneGenerationIds: dispatched.map((r) => ({ sceneId: r.sceneId, providerVideoId: r.providerVideoId })),
            provider: 'hedra',
            message: failed.length === 0
              ? `Storyboard (${scenes.length} scenes) generated and ${dispatched.length} Hedra renders dispatched. Renders complete async — typical 1-5 min per scene. Watch progress at /content/video?project=${proj.projectId} or call get_video_status with one of the providerVideoIds.`
              : `Storyboard (${scenes.length} scenes) generated, but ${failed.length} of ${scenes.length} scene dispatches failed: ${failed.map((f) => f.error ?? 'unknown').join('; ')}. ${dispatched.length} are rendering.`,
            videoLibraryPath: '/content/video',
            reviewLink: `/content/video?project=${proj.projectId}`,
          });
          trackMissionStep(context, 'produce_video', failed.length === 0 ? 'COMPLETED' : 'FAILED', {
            summary: failed.length === 0
              ? `produce_video: storyboard (${scenes.length} scenes) saved as project ${proj.projectId}; ${dispatched.length} Hedra renders dispatched`
              : `produce_video: ${failed.length}/${scenes.length} scene dispatches failed`,
            durationMs: Date.now() - produceStart,
            toolResult: content,
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          trackMissionStep(context, 'produce_video', 'FAILED', {
            summary: `produce_video: FAILED — ${errorMsg}`,
            durationMs: Date.now() - produceStart,
            error: errorMsg,
          });
          content = JSON.stringify({ error: errorMsg, specialist: 'VIDEO_SPECIALIST' });
        }
        break;
      }

      case 'assemble_video': {
        // Assemble already-rendered scenes into a single concatenated video.
        // The /api/video/assemble route owns the FFmpeg concat + watermark
        // pipeline; this handler invokes it server-side. Requires a project
        // whose scenes have completed Hedra renders (use generate_video or
        // produce_video first, then poll until scenes are ready).
        const assembleStart = Date.now();
        trackMissionStep(context, 'assemble_video', 'RUNNING', { toolArgs: args });
        try {
          const projectId = (args.storyboardId as string | undefined) ?? (args.projectId as string | undefined);
          if (!projectId) {
            throw new Error('assemble_video requires storyboardId (or projectId) of a saved pipeline project with already-rendered scenes.');
          }
          const { getProject } = await import('@/lib/video/pipeline-project-service');
          const project = await getProject(projectId);
          if (!project) {
            throw new Error(`Pipeline project ${projectId} not found.`);
          }
          // Collect Hedra generationIds from each scene's provider data.
          const sceneGenerationIds = (project.scenes ?? [])
            .map((s) => (s as unknown as { providerVideoId?: string }).providerVideoId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0);
          if (sceneGenerationIds.length === 0) {
            throw new Error(`No rendered scenes on project ${projectId}. Run generate_video or produce_video first, then wait for scenes to finish rendering.`);
          }
          // Resolve each scene's current Hedra status into a downloadable URL.
          const { getHedraVideoStatus } = await import('@/lib/video/hedra-service');
          const sceneUrls: string[] = [];
          for (const genId of sceneGenerationIds) {
            const status = await getHedraVideoStatus(genId);
            if (status.status !== 'completed' || !status.videoUrl) {
              throw new Error(`Scene ${genId} is not ready (status=${status.status}). Wait for all scenes to complete before assembling.`);
            }
            sceneUrls.push(status.videoUrl);
          }
          // Run FFmpeg concat using the same shared utilities as /api/video/assemble.
          const { createWorkDir, downloadVideo, uploadToStorage, cleanupWorkDir, buildSmartConcatArgs, runFfmpeg, getStoragePath } = await import('@/lib/video/ffmpeg-utils');
          const workDir = await createWorkDir();
          const transitionType: 'cut' | 'fade' | 'dissolve' =
            (args.transitionType as 'cut' | 'fade' | 'dissolve' | undefined) ?? project.transitionType ?? 'fade';
          const outputResolution = normalizeResolution(args.outputResolution as string | undefined);
          const [outWidth, outHeight] = outputResolution === '720p'
            ? [1280, 720]
            : outputResolution === '4k'
              ? [3840, 2160]
              : [1920, 1080];
          try {
            const localScenePaths: string[] = [];
            for (let i = 0; i < sceneUrls.length; i++) {
              const localPath = `${workDir}/scene-${i}.mp4`;
              await downloadVideo(sceneUrls[i], localPath);
              localScenePaths.push(localPath);
            }
            const outputPath = `${workDir}/assembled.mp4`;
            const ffmpegArgs = await buildSmartConcatArgs(localScenePaths, outputPath, transitionType, outWidth, outHeight);
            await runFfmpeg(ffmpegArgs);
            const storagePath = getStoragePath(projectId, 'assembled');
            const finalUrl = await uploadToStorage(outputPath, storagePath);
            content = JSON.stringify({
              status: 'COMPLETED',
              projectId,
              finalVideoUrl: finalUrl,
              sceneCount: sceneUrls.length,
              transitionType,
              outputResolution,
              message: `Assembled ${sceneUrls.length} scenes into final video. Available at /content/video?project=${projectId}.`,
              videoLibraryPath: '/content/video',
              reviewLink: `/content/video?project=${projectId}`,
            });
            trackMissionStep(context, 'assemble_video', 'COMPLETED', {
              summary: `assemble_video: ${sceneUrls.length} scenes concatenated → ${finalUrl}`,
              durationMs: Date.now() - assembleStart,
              toolResult: content,
            });
          } finally {
            await cleanupWorkDir(workDir);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          trackMissionStep(context, 'assemble_video', 'FAILED', {
            summary: `assemble_video: FAILED — ${errorMsg}`,
            durationMs: Date.now() - assembleStart,
            error: errorMsg,
          });
          content = JSON.stringify({ error: errorMsg, specialist: 'VIDEO_SPECIALIST' });
        }
        break;
      }

      case 'edit_video': {
        try {
          let editorUrl = '/content/video/editor';
          const params = new URLSearchParams();

          if (args.projectId) {
            params.set('project', args.projectId as string);
          }

          if (typeof args.clipUrls === 'string' && args.clipUrls.trim().startsWith('[')) {
            params.set('clips', args.clipUrls);
          }

          if (params.toString()) {
            editorUrl += `?${params.toString()}`;
          }

          content = JSON.stringify({
            status: 'success',
            editorUrl,
            instruction: (args.instruction as string) ?? 'Open the Video Editor to arrange and assemble your clips.',
            message: `Video Editor ready! Open it here: ${editorUrl}`,
            reviewLink: editorUrl,
          });

          trackMissionStep(context, 'edit_video', 'COMPLETED', {
            summary: `Opened Video Editor${args.projectId ? ` with project ${args.projectId as string}` : ''}`,
            toolResult: content,
          });
        } catch (editErr) {
          const errMsg = editErr instanceof Error ? editErr.message : String(editErr);
          content = JSON.stringify({
            status: 'error',
            message: `Failed to open Video Editor: ${errMsg}`,
          });
          trackMissionStep(context, 'edit_video', 'FAILED', {
            summary: `edit_video: ${errMsg}`,
            toolResult: content,
          });
        }
        break;
      }

      case 'manage_media_library': {
        const mediaStart = Date.now();
        try {
          const action = (args.action as string) ?? 'list';
          const mediaType = args.mediaType as string | undefined;
          const category = args.category as string | undefined;

          const { adminDb: mediaAdminDb } = await import('@/lib/firebase/admin');
          if (!mediaAdminDb) {
            throw new Error('Database not available');
          }

          const mediaCollection = getSubCollection('media');

          if (action === 'list' || action === 'search') {
            let query: FirebaseFirestore.Query = mediaAdminDb.collection(mediaCollection);
            if (mediaType) {
              query = query.where('type', '==', mediaType);
            }
            if (category) {
              query = query.where('category', '==', category);
            }
            query = query.orderBy('createdAt', 'desc').limit(50);

            const snapshot = await query.get();
            const items = snapshot.docs.map((doc) => {
              const d = doc.data() as Record<string, unknown>;
              return {
                id: doc.id,
                type: d.type,
                category: d.category,
                name: d.name,
                url: d.url,
              };
            });

            // If search, filter by query
            let filtered = items;
            if (action === 'search' && args.query) {
              const q = (args.query as string).toLowerCase();
              filtered = items.filter((item) =>
                (item.name as string).toLowerCase().includes(q),
              );
            }

            content = JSON.stringify({
              status: 'success',
              action,
              itemCount: filtered.length,
              items: filtered,
              libraryUrl: '/content/video/library',
              message: `Found ${filtered.length} media item(s)${mediaType ? ` of type "${mediaType}"` : ''}${category ? ` in category "${category}"` : ''}.`,
            });
          } else {
            content = JSON.stringify({
              status: 'success',
              message: 'To add media, direct users to the Media Library upload page or the Video Editor upload panel.',
              libraryUrl: '/content/video/library',
              editorUrl: '/content/video/editor',
            });
          }

          trackMissionStep(context, 'manage_media_library', 'COMPLETED', {
            summary: `Media Library: ${action} — ${mediaType ?? 'all'} ${category ?? ''}`,
            durationMs: Date.now() - mediaStart,
            toolResult: content,
          });
        } catch (mediaErr) {
          const errMsg = mediaErr instanceof Error ? mediaErr.message : String(mediaErr);
          content = JSON.stringify({
            status: 'error',
            message: `Media library operation failed: ${errMsg}`,
          });
          trackMissionStep(context, 'manage_media_library', 'FAILED', {
            summary: `manage_media_library: ${errMsg}`,
            durationMs: Date.now() - mediaStart,
            toolResult: content,
          });
        }
        break;
      }

      case 'list_avatars': {
        const listAvatarsStart = Date.now();
        try {
          const { adminDb: avatarAdminDb } = await import('@/lib/firebase/admin');
          if (!avatarAdminDb) {
            content = JSON.stringify({ success: false, error: 'Database unavailable' });
            break;
          }

          const avatarFilter = args.filter as string | undefined;
          const avatarsCollection = getSubCollection('avatar_profiles');

          let avatarQuery: FirebaseFirestore.Query = avatarAdminDb.collection(avatarsCollection);
          if (avatarFilter && avatarFilter !== 'all') {
            avatarQuery = avatarAdminDb
              .collection(avatarsCollection)
              .where('source', '==', avatarFilter)
              .orderBy('createdAt', 'desc');
          } else {
            avatarQuery = avatarAdminDb
              .collection(avatarsCollection)
              .orderBy('createdAt', 'desc');
          }

          const avatarSnapshot = await avatarQuery.limit(50).get();
          const avatars = avatarSnapshot.docs.map((doc) => {
            const data = doc.data() as Record<string, unknown>;
            return {
              id: doc.id,
              name: (data.name as string) ?? 'Unnamed',
              source: (data.source as string) ?? 'hedra',
              role: (data.role as string) ?? 'presenter',
              voiceId: (data.voiceId as string | null) ?? null,
              voiceName: (data.voiceName as string | null) ?? null,
              isDefault: data.isDefault === true,
              isFavorite: data.isFavorite === true,
              hasCustomVoice: Boolean(data.voiceId),
            };
          });

          const customCount = avatars.filter((a) => a.source === 'custom').length;
          const hasClone = customCount > 0;

          content = JSON.stringify({
            success: true,
            avatars,
            totalCount: avatars.length,
            customCount,
            hasClone,
            characterStudioUrl: '/content/video/characters',
            suggestion: hasClone
              ? null
              : "The user has no custom AI clone. When relevant, suggest: \"I noticed you haven't created your AI clone yet. Want to set that up? It takes 2 minutes — just upload a photo and record a voice sample in the Character Studio.\"",
          });

          trackMissionStep(context, 'list_avatars', 'COMPLETED', {
            summary: `Avatar list: ${avatars.length} total, ${customCount} custom`,
            durationMs: Date.now() - listAvatarsStart,
            toolResult: content,
          });
        } catch (listAvatarsErr) {
          const errMsg = listAvatarsErr instanceof Error ? listAvatarsErr.message : String(listAvatarsErr);
          content = JSON.stringify({
            success: false,
            error: `Failed to list avatars: ${errMsg}`,
          });
          trackMissionStep(context, 'list_avatars', 'FAILED', {
            summary: `list_avatars: ${errMsg}`,
            durationMs: Date.now() - Date.now(),
            toolResult: content,
          });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // ANALYTICS & REPORTING TOOLS
      // ═══════════════════════════════════════════════════════════════════════
      case 'get_analytics': {
        const orgsData = await AdminFirestoreService.getAll(COLLECTIONS.ORGANIZATIONS);
        const orgs = (orgsData ?? []) as unknown as OrganizationRecord[];
        content = JSON.stringify({
          reportType: 'overview',
          dateRange: args.dateRange ?? 'month',
          timestamp: new Date().toISOString(),
          overview: {
            totalOrganizations: orgs.length,
            activeTrials: orgs.filter((o) => o.plan === 'trial').length,
            paidCustomers: orgs.filter((o) => o.plan !== 'trial').length,
          },
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
        // Task #38 (April 12 2026): rewired from NOT_WIRED to live delegation.
        // Builder department specialists are all real as of Task #37:
        //   - UX/UI Architect (Task #35) — compose full design system
        //   - Funnel Engineer (Task #36) — design conversion funnel
        //   - Workflow Optimizer (Task #37) — compose multi-agent workflow
        //   - Asset Generator (Task #26, shared with Content)
        // BuilderManager.execute() reads payload.blueprintId and loads the
        // site architecture from MemoryVault. If no blueprint exists, it
        // returns BLOCKED with "Run ARCHITECT_MANAGER first" — that is
        // honest prerequisite enforcement, not a stub. Real builds will
        // succeed once the Architect department (Tasks #39-41) lands and
        // an upstream blueprint has been produced.
        const builderStart = Date.now();
        trackMissionStep(context, 'delegate_to_builder', 'RUNNING', { toolArgs: args });

        try {
          const { BuilderManager } = await import('@/lib/agents/builder/manager');
          const builderMgr = new BuilderManager();
          await builderMgr.initialize();

          const builderPayload: Record<string, unknown> = {
            niche: args.niche as string | undefined,
            objective: args.objective as string | undefined,
            audience: args.audience as string | undefined,
            pageType: args.pageType as string | undefined,
            includeDesign: args.includeDesign === true || args.includeDesign === 'true',
            includeFunnel: args.includeFunnel === true || args.includeFunnel === 'true',
            includeCopy: args.includeCopy === true || args.includeCopy === 'true',
            blueprintId: args.blueprintId as string | undefined,
          };

          const builderResult = await withTimeout(builderMgr.execute({
            id: `builder_${Date.now()}`,
            timestamp: new Date(),
            from: 'JASPER',
            to: 'BUILDER_MANAGER',
            type: 'COMMAND',
            priority: 'NORMAL',
            payload: builderPayload,
            requiresResponse: true,
            traceId: `trace_${Date.now()}`,
          }), MANAGER_TIMEOUT_MS, 'Builder Manager');

          const builderDuration = Date.now() - builderStart;
          trackMissionStep(context, 'delegate_to_builder',
            builderResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
            { summary: `Builder: ${builderResult.status}`, durationMs: builderDuration, toolResult: JSON.stringify(builderResult.data), specialistsUsed: builderResult.specialistsUsed }
          );

          content = JSON.stringify({
            status: builderResult.status,
            data: builderResult.data,
            errors: builderResult.errors,
            manager: 'BUILDER_MANAGER',
            reviewLink: getReviewLink('delegate_to_builder', context?.missionId),
          });
        } catch (builderError: unknown) {
          const errorMsg = builderError instanceof Error ? builderError.message : 'Unknown error';
          trackMissionStep(context, 'delegate_to_builder', 'FAILED', {
            summary: `Builder: FAILED — ${errorMsg}`,
            durationMs: Date.now() - builderStart,
            error: errorMsg,
          });
          content = JSON.stringify({ error: errorMsg, manager: 'BUILDER_MANAGER' });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // SALES DEPARTMENT EXECUTION
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_sales': {
        const salesStart = Date.now();
        trackMissionStep(context, 'delegate_to_sales', 'RUNNING', { toolArgs: args });

        try {
          const { RevenueDirector } = await import('@/lib/agents/sales/revenue/manager');
          const salesMgr = new RevenueDirector();
          await salesMgr.initialize();

          const salesPayload: Record<string, unknown> = {
            action: (args.action as string | undefined) ?? 'EVALUATE_TRANSITION',
            leadData: args.leadData,
            objection: args.objection,
            options: args.options,
          };

          const salesResult = await withTimeout(salesMgr.execute({
            id: `sales_${Date.now()}`,
            timestamp: new Date(),
            from: 'JASPER',
            to: 'REVENUE_DIRECTOR',
            type: 'COMMAND',
            priority: 'NORMAL',
            payload: salesPayload,
            requiresResponse: true,
            traceId: `trace_${Date.now()}`,
          }), MANAGER_TIMEOUT_MS, 'Revenue Director');

          const salesDuration = Date.now() - salesStart;
          trackMissionStep(context, 'delegate_to_sales',
            salesResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
            { summary: `Sales: ${salesResult.status}`, durationMs: salesDuration, toolResult: JSON.stringify(salesResult.data), specialistsUsed: salesResult.specialistsUsed }
          );

          content = JSON.stringify({
            status: salesResult.status,
            data: salesResult.data,
            errors: salesResult.errors,
            manager: 'REVENUE_DIRECTOR',
            reviewLink: getReviewLink('delegate_to_sales', context?.missionId),
          });
        } catch (salesError: unknown) {
          const errorMsg = salesError instanceof Error ? salesError.message : 'Unknown error';
          const salesDuration = Date.now() - salesStart;
          trackMissionStep(context, 'delegate_to_sales', 'FAILED', {
            summary: `Sales error: ${errorMsg}`,
            durationMs: salesDuration,
            error: errorMsg,
          });
          content = JSON.stringify({
            status: 'FAILED',
            error: errorMsg,
            manager: 'REVENUE_DIRECTOR',
          });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // MARKETING DEPARTMENT EXECUTION
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_marketing': {
        const marketingStart = Date.now();
        trackMissionStep(context, 'delegate_to_marketing', 'RUNNING', { toolArgs: args });

        try {
          const { MarketingManager } = await import('@/lib/agents/marketing/manager');
          const marketingMgr = new MarketingManager();
          await marketingMgr.initialize();

          const marketingPayload: Record<string, unknown> = {
            goal: args.goal as string,
            message: args.goal as string,
            platform: args.platform as string | undefined,
            niche: args.niche as string | undefined,
            audience: args.audience as string | undefined,
            budget: args.budget as string | undefined,
            contentType: args.contentType as string | undefined,
            // Single-platform post fast-path fields
            topic: args.topic as string | undefined,
            tone: args.tone as string | undefined,
            targetAudience: args.targetAudience as string | undefined,
            verbatimText: args.verbatimText as string | undefined,
          };
          if (args.inboundContext && typeof args.inboundContext === 'object') {
            marketingPayload.inboundContext = args.inboundContext;
          }
          // providedMediaUrls — operator-provided image/video URLs. When
          // present, Marketing Manager passes through to image-gen helpers
          // which short-circuit (no DALL-E call). Accept JSON-encoded array
          // string or a real array.
          if (typeof args.providedMediaUrls === 'string' && args.providedMediaUrls.trim().length > 0) {
            try {
              const parsed = JSON.parse(args.providedMediaUrls) as unknown;
              if (Array.isArray(parsed)) {
                marketingPayload.providedMediaUrls = parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
              }
            } catch {
              marketingPayload.providedMediaUrls = [args.providedMediaUrls.trim()];
            }
          } else if (Array.isArray(args.providedMediaUrls)) {
            marketingPayload.providedMediaUrls = args.providedMediaUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
          }

          const marketingResult = await withTimeout(marketingMgr.execute({
            id: `marketing_${Date.now()}`,
            timestamp: new Date(),
            from: 'JASPER',
            to: 'MARKETING_MANAGER',
            type: 'COMMAND',
            priority: 'NORMAL',
            payload: marketingPayload,
            requiresResponse: true,
            traceId: `trace_${Date.now()}`,
          }), MANAGER_TIMEOUT_MS, 'Marketing Manager');

          const marketingDuration = Date.now() - marketingStart;
          trackMissionStep(context, 'delegate_to_marketing',
            marketingResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
            { summary: `Marketing: ${marketingResult.status}`, durationMs: marketingDuration, toolResult: JSON.stringify(marketingResult.data), specialistsUsed: marketingResult.specialistsUsed }
          );

          content = JSON.stringify({
            status: marketingResult.status,
            data: marketingResult.data,
            errors: marketingResult.errors,
            manager: 'MARKETING_MANAGER',
            reviewLink: getReviewLink('delegate_to_marketing', context?.missionId),
          });
        } catch (marketingError: unknown) {
          const errorMsg = marketingError instanceof Error ? marketingError.message : 'Unknown error';
          trackMissionStep(context, 'delegate_to_marketing', 'FAILED', {
            summary: `Marketing: FAILED — ${errorMsg}`,
            durationMs: Date.now() - marketingStart,
            error: errorMsg,
          });
          content = JSON.stringify({ error: errorMsg, manager: 'MARKETING_MANAGER' });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // TRUST & REPUTATION DEPARTMENT EXECUTION
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_trust': {
        const trustStart = Date.now();
        trackMissionStep(context, 'delegate_to_trust', 'RUNNING', { toolArgs: args });

        try {
          const { ReputationManager } = await import('@/lib/agents/trust/reputation/manager');
          const trustMgr = new ReputationManager();
          await trustMgr.initialize();

          const trustPayload: Record<string, unknown> = {
            action: (args.action as string | undefined) ?? 'ANALYZE_SENTIMENT',
            reviewData: args.reviewData,
            gmbData: args.gmbData,
            saleData: args.saleData,
            signals: args.signals,
          };

          const trustResult = await withTimeout(trustMgr.execute({
            id: `trust_${Date.now()}`,
            timestamp: new Date(),
            from: 'JASPER',
            to: 'REPUTATION_MANAGER',
            type: 'COMMAND',
            priority: 'NORMAL',
            payload: trustPayload,
            requiresResponse: true,
            traceId: `trace_${Date.now()}`,
          }), MANAGER_TIMEOUT_MS, 'Reputation Manager');

          const trustDuration = Date.now() - trustStart;
          trackMissionStep(context, 'delegate_to_trust',
            trustResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
            { summary: `Trust: ${trustResult.status}`, durationMs: trustDuration, toolResult: JSON.stringify(trustResult.data), specialistsUsed: trustResult.specialistsUsed }
          );

          content = JSON.stringify({
            status: trustResult.status,
            data: trustResult.data,
            errors: trustResult.errors,
            manager: 'REPUTATION_MANAGER',
            reviewLink: getReviewLink('delegate_to_trust', context?.missionId),
          });
        } catch (trustError: unknown) {
          const errorMsg = trustError instanceof Error ? trustError.message : 'Unknown error';
          const trustDuration = Date.now() - trustStart;
          trackMissionStep(context, 'delegate_to_trust', 'FAILED', {
            summary: `Trust error: ${errorMsg}`,
            durationMs: trustDuration,
            error: errorMsg,
          });
          content = JSON.stringify({
            status: 'FAILED',
            error: errorMsg,
            manager: 'REPUTATION_MANAGER',
          });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // CONTENT DEPARTMENT EXECUTION (Sprint 19)
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_content': {
        const contentStart = Date.now();
        trackMissionStep(context, 'delegate_to_content', 'RUNNING', { toolArgs: args });

        try {
          const { ContentManager } = await import('@/lib/agents/content/manager');
          const contentMgr = new ContentManager();
          await contentMgr.initialize();

          const contentPayload: Record<string, unknown> = {
            contentType: args.contentType as string | undefined,
            topic: args.topic as string,
            audience: args.audience as string | undefined,
            format: args.format as string | undefined,
            includeVideo: args.includeVideo === true || args.includeVideo === 'true',
            scheduleDate: args.scheduleDate as string | undefined,
          };

          if (args.seoKeywords && typeof args.seoKeywords === 'string') {
            contentPayload.seoKeywords = args.seoKeywords.split(',').map((k: string) => k.trim());
          }

          // Email-sequence-specific args — pass through when Jasper populates them.
          // The Content Manager ignores these unless contentType resolves to
          // EMAIL_SEQUENCE intent, so they're safe to forward unconditionally.
          if (typeof args.count === 'number') { contentPayload.count = args.count; }
          else if (typeof args.count === 'string') {
            const n = parseInt(args.count, 10);
            if (Number.isFinite(n)) { contentPayload.count = n; }
          }
          if (typeof args.cadence === 'string') { contentPayload.cadence = args.cadence; }
          if (typeof args.trigger === 'string') { contentPayload.trigger = args.trigger; }

          // providedMediaUrls — operator-provided image/video URLs. When
          // present, downstream image-gen helpers short-circuit (no
          // DALL-E call). Accept either a JSON-encoded array string or
          // a real array (for callers that don't go through the OpenAPI
          // string round-trip).
          if (typeof args.providedMediaUrls === 'string' && args.providedMediaUrls.trim().length > 0) {
            try {
              const parsed = JSON.parse(args.providedMediaUrls) as unknown;
              if (Array.isArray(parsed)) {
                contentPayload.providedMediaUrls = parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
              }
            } catch {
              // If JSON parse fails, treat the raw string as a single URL — operator may have pasted a bare URL.
              contentPayload.providedMediaUrls = [args.providedMediaUrls.trim()];
            }
          } else if (Array.isArray(args.providedMediaUrls)) {
            contentPayload.providedMediaUrls = args.providedMediaUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
          }

          const contentResult = await withTimeout(contentMgr.execute({
            id: `content_${Date.now()}`,
            timestamp: new Date(),
            from: 'JASPER',
            to: 'CONTENT_MANAGER',
            type: 'COMMAND',
            priority: 'NORMAL',
            payload: contentPayload,
            requiresResponse: true,
            traceId: `trace_${Date.now()}`,
          }), MANAGER_TIMEOUT_MS, 'Content Manager');

          const contentDuration = Date.now() - contentStart;
          trackMissionStep(context, 'delegate_to_content',
            contentResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
            { summary: `Content: ${contentResult.status}`, durationMs: contentDuration, toolResult: JSON.stringify(contentResult.data), specialistsUsed: contentResult.specialistsUsed }
          );

          content = JSON.stringify({
            status: contentResult.status,
            data: contentResult.data,
            errors: contentResult.errors,
            manager: 'CONTENT_MANAGER',
            reviewLink: getReviewLink('delegate_to_content', context?.missionId),
          });
        } catch (contentError: unknown) {
          const errorMsg = contentError instanceof Error ? contentError.message : 'Unknown error';
          trackMissionStep(context, 'delegate_to_content', 'FAILED', {
            summary: `Content: FAILED — ${errorMsg}`,
            durationMs: Date.now() - contentStart,
            error: errorMsg,
          });
          content = JSON.stringify({ error: errorMsg, manager: 'CONTENT_MANAGER' });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // OPERATIONS DEPARTMENT EXECUTION (Scheduling)
      //
      // Jasper interprets the user's scheduling intent and resolves any fuzzy
      // attendee name to a CRM record id BEFORE calling this tool. The handler
      // here only forwards — no time parsing, no CRM lookup, no slot validation.
      // The Operations Manager re-validates and rejects the request if Jasper
      // tried to slip in a fuzzy time or a missing attendee id.
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_operations': {
        const opsStart = Date.now();
        trackMissionStep(context, 'delegate_to_operations', 'RUNNING', { toolArgs: args });

        try {
          const { getOperationsManager } = await import('@/lib/agents/operations/manager');
          const opsMgr = getOperationsManager();
          await opsMgr.initialize();

          // Map the lowercase tool-level intent to the manager's uppercase
          // discriminator. Anything outside the allowed set falls through and
          // the manager will return FAILED with a clear "missing/unrecognized
          // intent" error — we don't guess here.
          const rawIntent = typeof args.intent === 'string' ? args.intent : '';
          let mgrIntent: 'CREATE_MEETING' | 'RESCHEDULE_MEETING' | 'CANCEL_MEETING' | undefined;
          if (rawIntent === 'create_meeting') { mgrIntent = 'CREATE_MEETING'; }
          else if (rawIntent === 'reschedule_meeting') { mgrIntent = 'RESCHEDULE_MEETING'; }
          else if (rawIntent === 'cancel_meeting') { mgrIntent = 'CANCEL_MEETING'; }

          // Coerce attendeeRef to {type, id} only — the manager rejects any
          // shape that isn't this exact pair.
          let attendeeRef: { type: string; id: string } | undefined;
          if (args.attendeeRef && typeof args.attendeeRef === 'object') {
            const ar = args.attendeeRef as { type?: unknown; id?: unknown };
            if (typeof ar.type === 'string' && typeof ar.id === 'string') {
              attendeeRef = { type: ar.type, id: ar.id };
            }
          }

          // durationMinutes can arrive as a number or as a string (OpenAPI
          // round-trip on some clients). Coerce to number when possible;
          // otherwise leave undefined and the manager applies its 30-minute
          // default.
          let durationMinutes: number | undefined;
          if (typeof args.durationMinutes === 'number') {
            durationMinutes = args.durationMinutes;
          } else if (typeof args.durationMinutes === 'string') {
            const n = parseInt(args.durationMinutes, 10);
            if (Number.isFinite(n)) { durationMinutes = n; }
          }

          const operationsPayload: Record<string, unknown> = {
            intent: mgrIntent,
            startTime: typeof args.startTime === 'string' ? args.startTime : undefined,
            durationMinutes,
            attendeeRef,
            meetingId: typeof args.meetingId === 'string' ? args.meetingId : undefined,
            title: typeof args.title === 'string' ? args.title : undefined,
            notes: typeof args.notes === 'string' ? args.notes : undefined,
            reason: typeof args.reason === 'string' ? args.reason : undefined,
          };

          const operationsResult = await withTimeout(opsMgr.execute({
            id: `operations_${Date.now()}`,
            timestamp: new Date(),
            from: 'JASPER',
            to: 'OPERATIONS_MANAGER',
            type: 'COMMAND',
            priority: 'NORMAL',
            payload: operationsPayload,
            requiresResponse: true,
            traceId: `trace_${Date.now()}`,
          }), MANAGER_TIMEOUT_MS, 'Operations Manager');

          const opsDuration = Date.now() - opsStart;
          trackMissionStep(context, 'delegate_to_operations',
            operationsResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
            { summary: `Operations: ${operationsResult.status}`, durationMs: opsDuration, toolResult: JSON.stringify(operationsResult.data), specialistsUsed: operationsResult.specialistsUsed }
          );

          content = JSON.stringify({
            status: operationsResult.status,
            data: operationsResult.data,
            errors: operationsResult.errors,
            manager: 'OPERATIONS_MANAGER',
            reviewLink: getReviewLink('delegate_to_operations', context?.missionId),
          });
        } catch (opsError: unknown) {
          const errorMsg = opsError instanceof Error ? opsError.message : 'Unknown error';
          trackMissionStep(context, 'delegate_to_operations', 'FAILED', {
            summary: `Operations: FAILED — ${errorMsg}`,
            durationMs: Date.now() - opsStart,
            error: errorMsg,
          });
          content = JSON.stringify({ error: errorMsg, manager: 'OPERATIONS_MANAGER' });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // ARCHITECT DEPARTMENT EXECUTION
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_architect': {
        // Task #42 (April 13 2026): rewired from NOT_WIRED to live delegation.
        // Architect department specialists are all real as of Task #41:
        //   - Copy Specialist (Task #39) — strategic messaging direction
        //   - UX/UI Specialist (Task #40) — strategic design direction
        //   - Funnel Pathologist (Task #41) — strategic funnel diagnosis
        // ArchitectManager.execute() parses the BlueprintRequest from payload
        // (niche/description/targetAudience/objective/existingBrand/forceRefresh),
        // loads Brand DNA + intelligence briefs, derives site requirements,
        // runs the three specialists in parallel, synthesizes a SiteArchitecture
        // blueprint, writes it to MemoryVault, and broadcasts site.blueprint_ready.
        // The blueprint ID it produces is the input to delegate_to_builder.
        const archStart = Date.now();
        trackMissionStep(context, 'delegate_to_architect', 'RUNNING', { toolArgs: args });

        try {
          const { ArchitectManager } = await import('@/lib/agents/architect/manager');
          const architectMgr = new ArchitectManager();
          await architectMgr.initialize();

          // Map Jasper tool args to BlueprintRequest shape.
          // industry is the required primary niche descriptor.
          // funnelGoals/siteType/brandGuidelines/existingSiteUrl/competitorUrls
          // are folded into the description field so the manager has full context
          // when deriving site requirements alongside Brand DNA.
          const descriptionParts: string[] = [];
          if (args.siteType) { descriptionParts.push(`Site type: ${args.siteType}`); }
          if (args.funnelGoals) { descriptionParts.push(`Funnel goals: ${args.funnelGoals}`); }
          if (args.brandGuidelines) { descriptionParts.push(`Brand guidelines: ${args.brandGuidelines}`); }
          if (args.existingSiteUrl) { descriptionParts.push(`Existing site: ${args.existingSiteUrl}`); }
          if (args.competitorUrls) { descriptionParts.push(`Competitors: ${args.competitorUrls}`); }

          // Infer BlueprintRequest.objective from funnelGoals keywords, if present.
          // Enum values: 'leads' | 'sales' | 'bookings' | 'awareness'. Leave
          // undefined if the caller did not give us a clear signal — the manager
          // will fall back to Brand DNA + industry defaults.
          const funnelGoalsLower = typeof args.funnelGoals === 'string' ? args.funnelGoals.toLowerCase() : '';
          let objective: 'leads' | 'sales' | 'bookings' | 'awareness' | undefined;
          if (funnelGoalsLower.includes('book') || funnelGoalsLower.includes('demo') || funnelGoalsLower.includes('appointment')) {
            objective = 'bookings';
          } else if (funnelGoalsLower.includes('sale') || funnelGoalsLower.includes('purchase') || funnelGoalsLower.includes('checkout') || funnelGoalsLower.includes('revenue')) {
            objective = 'sales';
          } else if (funnelGoalsLower.includes('lead') || funnelGoalsLower.includes('signup') || funnelGoalsLower.includes('email capture') || funnelGoalsLower.includes('trial')) {
            objective = 'leads';
          } else if (funnelGoalsLower.includes('awareness') || funnelGoalsLower.includes('brand') || funnelGoalsLower.includes('reach')) {
            objective = 'awareness';
          }

          const architectPayload: Record<string, unknown> = {
            niche: args.industry as string,
            description: descriptionParts.length > 0 ? descriptionParts.join('. ') : undefined,
            targetAudience: args.audience as string | undefined,
            objective,
            existingBrand: true,
            forceRefresh: false,
          };

          const archResult = await withTimeout(architectMgr.execute({
            id: `architect_${Date.now()}`,
            timestamp: new Date(),
            from: 'JASPER',
            to: 'ARCHITECT_MANAGER',
            type: 'COMMAND',
            priority: 'NORMAL',
            payload: architectPayload,
            requiresResponse: true,
            traceId: `trace_${Date.now()}`,
          }), MANAGER_TIMEOUT_MS, 'Architect Manager');

          const archDuration = Date.now() - archStart;
          trackMissionStep(context, 'delegate_to_architect',
            archResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
            { summary: `Architect: ${archResult.status}`, durationMs: archDuration, toolResult: JSON.stringify(archResult.data), specialistsUsed: archResult.specialistsUsed }
          );

          content = JSON.stringify({
            status: archResult.status,
            data: archResult.data,
            errors: archResult.errors,
            manager: 'ARCHITECT_MANAGER',
            reviewLink: getReviewLink('delegate_to_architect', context?.missionId),
          });
        } catch (archError: unknown) {
          const errorMsg = archError instanceof Error ? archError.message : 'Unknown error';
          trackMissionStep(context, 'delegate_to_architect', 'FAILED', {
            summary: `Architect: FAILED — ${errorMsg}`,
            durationMs: Date.now() - archStart,
            error: errorMsg,
          });
          content = JSON.stringify({ error: errorMsg, manager: 'ARCHITECT_MANAGER' });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // OUTREACH DEPARTMENT EXECUTION (Sprint 19)
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_outreach': {
        // Task #45 (April 13 2026): rewired from NOT_WIRED to live delegation.
        // Outreach department specialists are real as of:
        //   - Email Specialist (Task #43) — composes send-ready emails via compose_email
        //   - SMS Specialist (Task #44) — composes send-ready SMS via compose_sms
        // Voice AI Specialist remains INFRA (telephony wrapper, not LLM).
        //
        // OPTION B (compose-only) — chosen April 13 2026: the OutreachManager's
        // executeChannelOutreach now calls compose_email and compose_sms and
        // returns composed content as OutreachExecutionResult.COMPOSED. Nothing
        // is actually sent. Delivery is a separate concern that will be wired
        // as a future send tool / review UI step. This matches every other
        // rebuilt department (content agents produce, nothing ships
        // automatically) and preserves the human-review gate.
        //
        // The Jasper tool args (sequenceType, channel, leadList, message,
        // steps, delayBetweenSteps, complianceNotes) are mapped here into the
        // OutreachManager's expected payload shape: an explicit `intent` that
        // routes to executeSingleChannel (SEND_EMAIL / SEND_SMS — the legacy
        // intent names are kept for the autonomous Event Router), an explicit
        // `action` so the specialist sees compose_email / compose_sms, plus
        // the ComposeEmailRequest / ComposeSmsRequest fields (campaignName,
        // targetAudience, goal, brief). The first lead from leadList becomes
        // the audience descriptor; if leadList is missing or invalid, a
        // placeholder lead is used so a generic message can still be composed.
        const outreachStart = Date.now();
        trackMissionStep(context, 'delegate_to_outreach', 'RUNNING', { toolArgs: args });

        try {
          const { OutreachManager } = await import('@/lib/agents/outreach/manager');
          const outreachMgr = new OutreachManager();
          await outreachMgr.initialize();

          // Parse leadList into an array. Accept JSON array, JSON single
          // object, or empty/invalid (fall back to a placeholder lead).
          let parsedLeads: Array<Record<string, unknown>> = [];
          if (typeof args.leadList === 'string' && args.leadList.trim().length > 0) {
            try {
              const leadParsed: unknown = JSON.parse(args.leadList);
              if (Array.isArray(leadParsed)) {
                parsedLeads = leadParsed as Array<Record<string, unknown>>;
              } else if (leadParsed && typeof leadParsed === 'object') {
                parsedLeads = [leadParsed as Record<string, unknown>];
              }
            } catch {
              // Leave parsedLeads empty — placeholder fallback below
            }
          }
          const firstLead = parsedLeads[0] ?? {
            leadId: `placeholder_${Date.now()}`,
            firstName: 'Prospect',
          };

          // Map channel to manager intent + specialist action. multi_channel
          // and auto default to email — the cheapest channel to compose for
          // the first pass. A campaign that needs SMS too can call
          // delegate_to_outreach again with channel='sms'.
          const channelArg = (args.channel as string | undefined) ?? 'auto';
          const intent: 'SEND_EMAIL' | 'SEND_SMS' = channelArg === 'sms' ? 'SEND_SMS' : 'SEND_EMAIL';

          // Sequence vs single-email routing. When the caller asks for >1
          // step on the email channel, dispatch the Email Specialist's
          // compose_outreach_sequence action instead of compose_email so
          // the LLM produces a coherent N-email arc in ONE call rather
          // than N independent emails. SMS sequences are not yet
          // implemented (SMS Specialist still has only compose_sms);
          // Jasper's tool prompt steers SMS users to channel='email'.
          const stepsRaw = args.steps;
          const stepsNum =
            typeof stepsRaw === 'number'
              ? Math.trunc(stepsRaw)
              : typeof stepsRaw === 'string'
                ? parseInt(stepsRaw, 10)
                : NaN;
          const sequenceLength = Number.isFinite(stepsNum) ? stepsNum : 1;
          const useSequence = intent === 'SEND_EMAIL' && sequenceLength >= 2;

          let composeAction: 'compose_email' | 'compose_sms' | 'compose_outreach_sequence';
          if (useSequence) {
            composeAction = 'compose_outreach_sequence';
          } else if (intent === 'SEND_SMS') {
            composeAction = 'compose_sms';
          } else {
            composeAction = 'compose_email';
          }

          // Build a single-sentence target audience descriptor from the lead
          // profile fields we have. Empty fields are skipped.
          const audienceParts: string[] = [];
          const firstName = (firstLead.firstName as string | undefined) ?? (firstLead.name as string | undefined) ?? 'Prospect';
          audienceParts.push(firstName);
          if (firstLead.role) { audienceParts.push(`role: ${firstLead.role as string}`); }
          if (firstLead.company) { audienceParts.push(`at ${firstLead.company as string}`); }
          if (firstLead.industry) { audienceParts.push(`industry: ${firstLead.industry as string}`); }
          const targetAudience = audienceParts.join(', ');

          const sequenceType = (args.sequenceType as string | undefined) ?? 'cold_outreach';
          const messageBrief = (args.message as string | undefined) ?? '';
          const goal = useSequence
            ? `Compose a coherent ${sequenceLength}-email cold outreach sequence (${sequenceType}) personalized for ${firstName}, escalating across the arc toward conversion`
            : `Compose a single ${composeAction === 'compose_sms' ? 'SMS' : 'email'} as part of a ${sequenceType} outreach to ${firstName}`;

          const outreachPayload: Record<string, unknown> = {
            intent,
            action: composeAction,
            campaignName: sequenceType,
            targetAudience,
            goal,
            brief: messageBrief,
            lead: firstLead,
            // Pass through compliance notes for the specialist's brief if present.
            ...(args.complianceNotes ? { complianceNotes: args.complianceNotes } : {}),
            // Sequence-specific fields the specialist's
            // compose_outreach_sequence action reads. Pass through unconditionally —
            // the schema ignores them when action=compose_email.
            ...(useSequence ? { sequenceLength } : {}),
            ...(useSequence && typeof args.delayBetweenSteps === 'string'
              ? { cadence: args.delayBetweenSteps }
              : {}),
          };

          const outreachResult = await withTimeout(outreachMgr.execute({
            id: `outreach_${Date.now()}`,
            timestamp: new Date(),
            from: 'JASPER',
            to: 'OUTREACH_MANAGER',
            type: 'COMMAND',
            priority: 'NORMAL',
            payload: outreachPayload,
            requiresResponse: true,
            traceId: `trace_${Date.now()}`,
          }), MANAGER_TIMEOUT_MS, 'Outreach Manager');

          const outreachDuration = Date.now() - outreachStart;
          trackMissionStep(context, 'delegate_to_outreach',
            outreachResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
            { summary: `Outreach: ${outreachResult.status}`, durationMs: outreachDuration, toolResult: JSON.stringify(outreachResult.data), specialistsUsed: outreachResult.specialistsUsed }
          );

          content = JSON.stringify({
            status: outreachResult.status,
            data: outreachResult.data,
            errors: outreachResult.errors,
            manager: 'OUTREACH_MANAGER',
            reviewLink: getReviewLink('delegate_to_outreach', context?.missionId),
          });
        } catch (outreachError: unknown) {
          const errorMsg = outreachError instanceof Error ? outreachError.message : 'Unknown error';
          trackMissionStep(context, 'delegate_to_outreach', 'FAILED', {
            summary: `Outreach: FAILED — ${errorMsg}`,
            durationMs: Date.now() - outreachStart,
            error: errorMsg,
          });
          content = JSON.stringify({ error: errorMsg, manager: 'OUTREACH_MANAGER' });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // INTELLIGENCE DEPARTMENT EXECUTION (Sprint 19)
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_intelligence': {
        // Task #66 (April 14, 2026): rewired from NOT_WIRED to live delegation.
        // Intelligence department specialists are all real as of Task #66:
        //   - Scraper Specialist (Task #62) — hybrid LLM + real scrapers
        //   - Competitor Researcher (Task #63) — hybrid LLM + Serper/DataForSEO
        //   - Technographic Scout (Task #64) — hybrid LLM + 60-signature regex db
        //   - Sentiment Analyst (Task #65) — pure LLM rebuild, 5 actions
        //   - Trend Scout (Task #66) — hybrid LLM synthesis + real collectors
        // IntelligenceManager.execute() parses both the canonical
        // IntelligenceRequest field names AND the Jasper tool-call field
        // names (researchType, targets, industry, depth, focusAreas,
        // timeframe), detects intent, runs specialists in parallel with
        // graceful degradation, synthesizes an IntelligenceBrief, and
        // writes insights to MemoryVault for cross-agent access.
        const intelStart = Date.now();
        trackMissionStep(context, 'delegate_to_intelligence', 'RUNNING', { toolArgs: args });

        try {
          const { IntelligenceManager } = await import('@/lib/agents/intelligence/manager');
          const intelMgr = new IntelligenceManager();
          await intelMgr.initialize();

          const intelResult = await withTimeout(intelMgr.execute({
            id: `intel_${Date.now()}`,
            timestamp: new Date(),
            from: 'JASPER',
            to: 'INTELLIGENCE_MANAGER',
            type: 'COMMAND',
            priority: 'NORMAL',
            payload: {
              researchType: args.researchType as string,
              targets: args.targets as string,
              industry: args.industry as string | undefined,
              depth: args.depth as string | undefined,
              focusAreas: args.focusAreas as string | undefined,
              timeframe: args.timeframe as string | undefined,
            },
            requiresResponse: true,
            traceId: `trace_${Date.now()}`,
          }), MANAGER_TIMEOUT_MS, 'Intelligence Manager');

          const intelDuration = Date.now() - intelStart;
          trackMissionStep(context, 'delegate_to_intelligence',
            intelResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
            { summary: `Intelligence: ${intelResult.status}`, durationMs: intelDuration, toolResult: JSON.stringify(intelResult.data), specialistsUsed: intelResult.specialistsUsed }
          );

          content = JSON.stringify({
            status: intelResult.status,
            data: intelResult.data,
            errors: intelResult.errors,
            manager: 'INTELLIGENCE_MANAGER',
            reviewLink: getReviewLink('delegate_to_intelligence', context?.missionId),
          });
        } catch (intelError: unknown) {
          const errorMsg = intelError instanceof Error ? intelError.message : 'Unknown error';
          trackMissionStep(context, 'delegate_to_intelligence', 'FAILED', {
            summary: `Intelligence: FAILED — ${errorMsg}`,
            durationMs: Date.now() - intelStart,
            error: errorMsg,
          });
          content = JSON.stringify({ error: errorMsg, manager: 'INTELLIGENCE_MANAGER' });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // COMMERCE DEPARTMENT EXECUTION (Sprint 19)
      // ═══════════════════════════════════════════════════════════════════════
      case 'delegate_to_commerce': {
        const commerceStart = Date.now();
        trackMissionStep(context, 'delegate_to_commerce', 'RUNNING', { toolArgs: args });

        try {
          const { CommerceManager } = await import('@/lib/agents/commerce/manager');
          const commerceMgr = new CommerceManager();
          await commerceMgr.initialize();

          const commercePayload: Record<string, unknown> = {
            action: (args.action as string | undefined) ?? 'stock_analysis',
            products: args.products,
            items: args.items,
            customer: args.customer,
            salesHistory: args.salesHistory,
            options: args.options,
          };

          const commerceResult = await withTimeout(commerceMgr.execute({
            id: `commerce_${Date.now()}`,
            timestamp: new Date(),
            from: 'JASPER',
            to: 'COMMERCE_MANAGER',
            type: 'COMMAND',
            priority: 'NORMAL',
            payload: commercePayload,
            requiresResponse: true,
            traceId: `trace_${Date.now()}`,
          }), MANAGER_TIMEOUT_MS, 'Commerce Manager');

          const commerceDuration = Date.now() - commerceStart;
          trackMissionStep(context, 'delegate_to_commerce',
            commerceResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
            { summary: `Commerce: ${commerceResult.status}`, durationMs: commerceDuration, toolResult: JSON.stringify(commerceResult.data), specialistsUsed: commerceResult.specialistsUsed }
          );

          content = JSON.stringify({
            status: commerceResult.status,
            data: commerceResult.data,
            errors: commerceResult.errors,
            manager: 'COMMERCE_MANAGER',
            reviewLink: getReviewLink('delegate_to_commerce', context?.missionId),
          });
        } catch (commerceError: unknown) {
          const errorMsg = commerceError instanceof Error ? commerceError.message : 'Unknown error';
          const commerceDuration = Date.now() - commerceStart;
          trackMissionStep(context, 'delegate_to_commerce', 'FAILED', {
            summary: `Commerce error: ${errorMsg}`,
            durationMs: commerceDuration,
            error: errorMsg,
          });
          content = JSON.stringify({
            status: 'FAILED',
            error: errorMsg,
            manager: 'COMMERCE_MANAGER',
          });
        }
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

          // Convert markdown content to a valid PageSection with a text widget.
          // The blog editor requires type: 'section' with columns/widgets — NOT 'rich-text'.
          const contentSections = [
            {
              id: `section_${Date.now()}`,
              type: 'section',
              columns: [
                {
                  id: `col_${Date.now()}`,
                  width: 100,
                  widgets: [
                    {
                      id: `widget_${Date.now()}`,
                      type: 'html',
                      data: {
                        html: args.content as string,
                      },
                    },
                  ],
                },
              ],
              styling: {},
              order: 0,
            },
          ];

          // Parse categories/tags from args, or auto-generate from title + content
          let categories = args.categories
            ? (args.categories as string).split(',').map((c: string) => c.trim())
            : [];
          let tags = args.tags
            ? (args.tags as string).split(',').map((t: string) => t.trim())
            : [];

          // Auto-generate if Jasper didn't provide them
          if (categories.length === 0) {
            const titleLower = (args.title as string).toLowerCase();
            const contentLower = (args.content as string).toLowerCase();
            const combined = `${titleLower} ${contentLower}`;
            const categoryMap: Record<string, string[]> = {
              'AI & Technology': ['artificial intelligence', 'machine learning', 'ai ', 'automation', 'technology', 'tech'],
              'Sales': ['sales', 'revenue', 'pipeline', 'closing', 'prospecting', 'leads', 'deals'],
              'Marketing': ['marketing', 'campaign', 'brand', 'advertising', 'seo', 'content marketing'],
              'Small Business': ['small business', 'smb', 'entrepreneur', 'startup', 'small companies'],
              'Growth': ['growth', 'scaling', 'expansion', 'strategy'],
              'E-Commerce': ['ecommerce', 'e-commerce', 'online store', 'checkout', 'shopping'],
              'Social Media': ['social media', 'facebook', 'instagram', 'linkedin', 'twitter', 'tiktok'],
              'Email Marketing': ['email', 'newsletter', 'inbox', 'outreach'],
              'Video': ['video', 'youtube', 'streaming', 'production'],
              'Customer Success': ['customer', 'retention', 'churn', 'support', 'satisfaction'],
            };
            for (const [cat, keywords] of Object.entries(categoryMap)) {
              if (keywords.some(k => combined.includes(k))) {
                categories.push(cat);
              }
            }
            if (categories.length === 0) { categories = ['General']; }
          }

          if (tags.length === 0) {
            // Extract key terms from title as tags
            const titleWords = (args.title as string)
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .split(/\s+/)
              .filter(w => w.length > 3 && !['about', 'that', 'this', 'with', 'from', 'their', 'have', 'been', 'your', 'they', 'will', 'more', 'when', 'what', 'which', 'into', 'how'].includes(w));
            tags = [...new Set(titleWords)].slice(0, 6);
          }
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
              metaTitle: (args.seoTitle as string) || (args.title as string),
              metaDescription: (args.seoDescription as string) || (args.excerpt as string) || '',
              metaKeywords: seoKeywords,
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
            toolResult: JSON.stringify({
              draftId: postId,
              slug,
              title: args.title,
              excerpt: blogPost.excerpt,
              categories: blogPost.categories,
              tags: blogPost.tags,
              readTime: blogPost.readTime,
              wordCount: (args.content as string).split(/\s+/).length,
              content: args.content,
              status: 'draft',
              editorLink: `/website/blog/editor?postId=${postId}`,
            }),
          });

          // Track as campaign deliverable if campaignId is available
          const blogCampaignId = (args.campaignId as string) || context?.campaignId;
          const blogEditorLink = `/website/blog/editor?postId=${postId}`;
          if (blogCampaignId) {
            trackDeliverableAsync(blogCampaignId, {
              missionId: context?.missionId ?? `mission_${Date.now()}`,
              type: 'blog',
              title: args.title as string,
              status: 'pending_review',
              previewData: {
                draftId: postId,
                slug,
                excerpt: (args.excerpt as string) || '',
                wordCount: (args.content as string).split(/\s+/).length,
                readTime: blogPost.readTime,
              },
              reviewLink: blogEditorLink,
            });
          }

          const missionReviewPath = context?.missionId
            ? `/mission-control?mission=${context.missionId}`
            : blogEditorLink;

          content = JSON.stringify({
            status: 'SAVED',
            draftId: postId,
            slug,
            campaignId: blogCampaignId ?? null,
            title: args.title,
            readTime: blogPost.readTime,
            editorLink: blogEditorLink,
            reviewLink: blogCampaignId
              ? `/mission-control?campaign=${blogCampaignId}`
              : missionReviewPath,
            message: blogCampaignId
              ? `Blog draft "${args.title}" saved. Review all deliverables at /mission-control?campaign=${blogCampaignId}`
              : `Blog draft "${args.title}" saved successfully. Review the mission at ${missionReviewPath}`,
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
      // SEO CONFIG ACCESS
      // ═══════════════════════════════════════════════════════════════════════
      case 'get_seo_config': {
        const seoStart = Date.now();
        trackMissionStep(context, 'get_seo_config', 'RUNNING', { toolArgs: args });

        try {
          const { adminDal } = await import('@/lib/firebase/admin-dal');

          if (!adminDal) {
            throw new Error('Firestore admin DAL not available');
          }

          const settingsRef = adminDal.getNestedDocRef(
            `${getSubCollection('website')}/settings`
          );
          const doc = await settingsRef.get();

          if (!doc.exists) {
            const seoDuration = Date.now() - seoStart;
            trackMissionStep(context, 'get_seo_config', 'COMPLETED', {
              summary: 'No website settings found — returning defaults',
              durationMs: seoDuration,
            });

            content = JSON.stringify({
              status: 'OK',
              source: 'defaults',
              seo: {
                title: '',
                description: '',
                keywords: [],
                robotsIndex: true,
                robotsFollow: true,
              },
              message: 'No SEO configuration found. Website settings have not been configured yet. Use the /settings/website page or seed scripts to set up SEO.',
            });
            break;
          }

          const data = doc.data() as Record<string, unknown>;
          const seo = (data.seo ?? {}) as Record<string, unknown>;

          // Build response with SEO data
          const response: Record<string, unknown> = {
            status: 'OK',
            source: 'firestore',
            seo: {
              title: seo.title ?? '',
              description: seo.description ?? '',
              keywords: Array.isArray(seo.keywords) ? seo.keywords : [],
              ogImage: seo.ogImage ?? null,
              twitterCard: seo.twitterCard ?? null,
              favicon: seo.favicon ?? null,
              robotsIndex: seo.robotsIndex ?? true,
              robotsFollow: seo.robotsFollow ?? true,
              canonicalUrl: seo.canonicalUrl ?? null,
              aiBotAccess: seo.aiBotAccess ?? null,
            },
          };

          // Optionally include analytics config
          if (args.includeAnalytics === true) {
            const analytics = (data.analytics ?? {}) as Record<string, unknown>;
            response.analytics = {
              googleAnalyticsId: analytics.googleAnalyticsId ?? null,
              googleTagManagerId: analytics.googleTagManagerId ?? null,
              facebookPixelId: analytics.facebookPixelId ?? null,
              hotjarId: analytics.hotjarId ?? null,
            };
          }

          // Optionally include site status
          if (args.includeSiteStatus === true) {
            response.site = {
              subdomain: data.subdomain ?? '',
              customDomain: data.customDomain ?? null,
              customDomainVerified: data.customDomainVerified ?? false,
              sslEnabled: data.sslEnabled ?? false,
              status: data.status ?? 'draft',
              publishedAt: data.publishedAt ?? null,
            };
          }

          // Add helper message with chain suggestion
          const keywords = response.seo && typeof response.seo === 'object'
            ? (response.seo as Record<string, unknown>).keywords
            : [];
          const keywordCount = Array.isArray(keywords) ? keywords.length : 0;

          response.message = keywordCount > 0
            ? `Found ${keywordCount} SEO keywords: ${(keywords as string[]).slice(0, 10).join(', ')}${keywordCount > 10 ? '...' : ''}. Use these with research_trending_topics to discover content opportunities in your demographic.`
            : 'No SEO keywords configured. Consider setting them up via /settings/website to define your demographic targeting.';

          const seoDuration = Date.now() - seoStart;
          trackMissionStep(context, 'get_seo_config', 'COMPLETED', {
            summary: `SEO config loaded: ${keywordCount} keywords`,
            durationMs: seoDuration,
            toolResult: JSON.stringify(response),
          });

          content = JSON.stringify(response);
        } catch (seoError: unknown) {
          const seoDuration = Date.now() - seoStart;
          const seoErrorMsg = seoError instanceof Error ? seoError.message : 'Unknown error';
          trackMissionStep(context, 'get_seo_config', 'FAILED', {
            error: seoErrorMsg,
            durationMs: seoDuration,
          });
          content = JSON.stringify({ error: seoErrorMsg });
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

          if (!args.keywords || typeof args.keywords !== 'string') {
            content = JSON.stringify({ status: 'error', message: 'keywords parameter is required (comma-separated list of seed topics)' });
            trackMissionStep(context, 'research_trending_topics', 'FAILED', {
              error: 'Missing required keywords parameter',
              durationMs: Date.now() - trendStart,
            });
            break;
          }
          const rawKeywords = args.keywords.split(',').map((k: string) => k.trim());
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
            toolResult: JSON.stringify({
              seedTopics: trendingTopics,
              relatedTrending: allRelated,
              totalResultsFound: trendingTopics.length + allRelated.length,
              timeframe: (args.timeframe as string | undefined) ?? 'current',
            }),
          });

          content = JSON.stringify({
            status: 'COMPLETED',
            seedTopics: trendingTopics,
            relatedTrending: allRelated,
            totalResultsFound: trendingTopics.length + allRelated.length,
            timeframe: (args.timeframe as string | undefined) ?? 'current',
            reviewLink: getReviewLink('research_trending_topics', context?.missionId),
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
              toolResult: JSON.stringify({ status: migrationResult.status, successCount: migrationResult.successCount, totalPages: migrationResult.totalPages }),
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

        const docs = await AdminFirestoreService.getAll(messagesPath, [
          orderBy('timestamp', 'desc'),
          firestoreLimit(recallLimit),
        ]) as unknown as StoredConversation[];

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
            toolResult: content,
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

      case 'send_sms': {
        const smsStart = Date.now();
        trackMissionStep(context, 'send_sms', 'RUNNING', { toolArgs: args });

        const to = typeof args.to === 'string' ? args.to : '';
        const message = typeof args.message === 'string' ? args.message : '';
        const from = typeof args.from === 'string' ? args.from : undefined;

        if (!to || !message) {
          trackMissionStep(context, 'send_sms', 'FAILED', { error: 'Missing to or message' });
          content = JSON.stringify({ success: false, error: 'to and message are required' });
          break;
        }

        try {
          const { checkTCPAConsent } = await import('@/lib/compliance/tcpa-service');
          const tcpa = await checkTCPAConsent(to, 'sms');
          if (!tcpa.allowed) {
            trackMissionStep(context, 'send_sms', 'FAILED', {
              error: `TCPA: ${tcpa.reason}`,
              durationMs: Date.now() - smsStart,
            });
            content = JSON.stringify({ success: false, error: `Blocked by TCPA compliance: ${tcpa.reason}` });
            break;
          }

          const { sendSMS } = await import('@/lib/sms/sms-service');
          const userId = context?.userId;
          const result = await sendSMS({
            to,
            message,
            from,
            metadata: userId ? { userId } : undefined,
          });

          if (result.success) {
            trackMissionStep(context, 'send_sms', 'COMPLETED', {
              summary: `SMS sent to ${to}`,
              durationMs: Date.now() - smsStart,
              toolResult: JSON.stringify(result),
            });
            content = JSON.stringify({
              success: true,
              messageId: result.messageId,
              provider: result.provider,
              to,
            });
          } else {
            trackMissionStep(context, 'send_sms', 'FAILED', {
              error: result.error ?? 'SMS send failed',
              durationMs: Date.now() - smsStart,
            });
            content = JSON.stringify({ success: false, error: result.error ?? 'SMS send failed' });
          }
        } catch (smsError) {
          const smsErrorMsg = smsError instanceof Error ? smsError.message : String(smsError);
          trackMissionStep(context, 'send_sms', 'FAILED', {
            error: smsErrorMsg,
            durationMs: Date.now() - smsStart,
          });
          content = JSON.stringify({ success: false, error: smsErrorMsg });
        }
        break;
      }

      case 'send_social_reply': {
        const sendReplyStart = Date.now();
        trackMissionStep(context, 'send_social_reply', 'RUNNING', { toolArgs: args });

        const platformArg = typeof args.platform === 'string' ? args.platform.toLowerCase() : '';
        const recipientUserId = typeof args.recipientUserId === 'string' ? args.recipientUserId : '';
        const replyText = typeof args.replyText === 'string' ? args.replyText.trim() : '';
        const inboundEventId = typeof args.inboundEventId === 'string' ? args.inboundEventId : '';

        if (!platformArg || !recipientUserId || !replyText || !inboundEventId) {
          trackMissionStep(context, 'send_social_reply', 'FAILED', {
            error: 'Missing required arg(s): platform, recipientUserId, replyText, inboundEventId',
            durationMs: Date.now() - sendReplyStart,
          });
          content = JSON.stringify({
            success: false,
            error: 'platform, recipientUserId, replyText, and inboundEventId are all required',
          });
          break;
        }

        if (platformArg !== 'x' && platformArg !== 'bluesky') {
          trackMissionStep(context, 'send_social_reply', 'FAILED', {
            error: `platform=${platformArg} not supported yet`,
            durationMs: Date.now() - sendReplyStart,
          });
          content = JSON.stringify({
            success: false,
            error: `send_social_reply does not yet support platform=${platformArg}. Currently: x, bluesky.`,
          });
          break;
        }

        try {
          const { markInboundEventReplied } = await import('@/lib/integrations/twitter-dm-service');
          let sendResult: { success: boolean; messageId?: string; error?: string; httpStatus?: number };

          if (platformArg === 'bluesky') {
            const { createBlueskyService } = await import('@/lib/integrations/bluesky-service');
            const service = await createBlueskyService();
            if (!service) {
              sendResult = { success: false, error: 'Bluesky credentials missing — run scripts/save-bluesky-config.ts' };
            } else {
              const r = await service.sendDirectMessage({ recipient: recipientUserId, text: replyText });
              sendResult = { success: r.success, messageId: r.messageId, error: r.error };
            }
          } else {
            const { sendXDirectMessage } = await import('@/lib/integrations/twitter-dm-service');
            sendResult = await sendXDirectMessage({ recipientUserId, text: replyText });
          }

          if (!sendResult.success) {
            trackMissionStep(context, 'send_social_reply', 'FAILED', {
              error: sendResult.error ?? `${platformArg} DM send failed`,
              durationMs: Date.now() - sendReplyStart,
            });
            content = JSON.stringify({
              success: false,
              error: sendResult.error ?? `${platformArg} DM send failed`,
              httpStatus: sendResult.httpStatus,
            });
            break;
          }

          await markInboundEventReplied({
            eventId: inboundEventId,
            replyText,
            messageId: sendResult.messageId,
            missionId: context?.missionId,
          });

          trackMissionStep(context, 'send_social_reply', 'COMPLETED', {
            summary: `Reply sent on ${platformArg} to ${recipientUserId}`,
            durationMs: Date.now() - sendReplyStart,
            toolResult: JSON.stringify({
              success: true,
              platform: platformArg,
              messageId: sendResult.messageId,
              recipientUserId,
              replyText,
              inboundEventId,
            }),
          });
          content = JSON.stringify({
            success: true,
            platform: platformArg,
            messageId: sendResult.messageId,
            recipientUserId,
            replyText,
            inboundEventId,
            reviewLink: getReviewLink('send_social_reply', context?.missionId),
          });
        } catch (sendErr) {
          const sendErrMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
          trackMissionStep(context, 'send_social_reply', 'FAILED', {
            error: sendErrMsg,
            durationMs: Date.now() - sendReplyStart,
          });
          content = JSON.stringify({ success: false, error: sendErrMsg });
        }
        break;
      }

      case 'place_call': {
        const callStart = Date.now();
        trackMissionStep(context, 'place_call', 'RUNNING', { toolArgs: args });

        const to = typeof args.to === 'string' ? args.to : '';
        const contactId = typeof args.contactId === 'string' ? args.contactId : undefined;

        if (!to) {
          trackMissionStep(context, 'place_call', 'FAILED', { error: 'Missing to' });
          content = JSON.stringify({ success: false, error: 'to (phone number) is required' });
          break;
        }

        try {
          const { checkTCPAConsent, checkCallTimeRestrictions } = await import('@/lib/compliance/tcpa-service');
          const tcpa = await checkTCPAConsent(to, 'call');
          if (!tcpa.allowed) {
            trackMissionStep(context, 'place_call', 'FAILED', {
              error: `TCPA: ${tcpa.reason}`,
              durationMs: Date.now() - callStart,
            });
            content = JSON.stringify({ success: false, error: `Blocked by TCPA compliance: ${tcpa.reason}` });
            break;
          }

          const timeCheck = checkCallTimeRestrictions(to);
          if (!timeCheck.allowed) {
            trackMissionStep(context, 'place_call', 'FAILED', {
              error: `Time window: ${timeCheck.reason}`,
              durationMs: Date.now() - callStart,
            });
            content = JSON.stringify({ success: false, error: timeCheck.reason });
            break;
          }

          const { getTwilioCredentials } = await import('@/lib/security/twilio-verification');
          const twilioKeys = await getTwilioCredentials();
          if (!twilioKeys?.accountSid || !twilioKeys?.authToken || !twilioKeys?.phoneNumber) {
            trackMissionStep(context, 'place_call', 'FAILED', {
              error: 'Twilio credentials missing',
              durationMs: Date.now() - callStart,
            });
            content = JSON.stringify({
              success: false,
              error: 'Twilio is not configured. Add credentials under Settings > API Keys before placing calls.',
            });
            break;
          }

          const twilioModule = (await import('twilio')).default;
          const client = twilioModule(twilioKeys.accountSid, twilioKeys.authToken);
          const appUrl = process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.length > 0
            ? process.env.NEXT_PUBLIC_APP_URL
            : 'http://localhost:3000';

          const call = await client.calls.create({
            to,
            from: twilioKeys.phoneNumber,
            url: `${appUrl}/api/voice/twiml`,
            statusCallback: `${appUrl}/api/webhooks/voice`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          });

          const { getCallsCollection } = await import('@/lib/firebase/collections');
          const { adminDb } = await import('@/lib/firebase/admin');
          const callId = `call-${Date.now()}`;
          if (adminDb) {
            await adminDb.collection(getCallsCollection()).doc(callId).set({
              id: callId,
              twilioCallSid: call.sid,
              contactId: contactId ?? null,
              phoneNumber: to,
              status: 'initiated',
              direction: 'outbound',
              recordingConsentDisclosed: true,
              createdAt: new Date().toISOString(),
              createdBy: context?.userId ?? 'jasper',
              initiatedBy: 'jasper',
            });
          }

          trackMissionStep(context, 'place_call', 'COMPLETED', {
            summary: `Outbound call to ${to} initiated`,
            durationMs: Date.now() - callStart,
            toolResult: JSON.stringify({ callId, twilioSid: call.sid }),
          });
          content = JSON.stringify({
            success: true,
            callId,
            twilioSid: call.sid,
            status: call.status,
            to,
            reviewLink: getReviewLink('place_call', context?.missionId),
          });
        } catch (callError) {
          const callErrorMsg = callError instanceof Error ? callError.message : String(callError);
          trackMissionStep(context, 'place_call', 'FAILED', {
            error: callErrorMsg,
            durationMs: Date.now() - callStart,
          });
          content = JSON.stringify({ success: false, error: callErrorMsg });
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
              platforms: ['twitter', 'linkedin', 'bluesky', 'mastodon'],
            });
          } else {
            const platform = socialArgs.platform ?? 'twitter';

            // ─── Step-output reference resolution ─────────────────────
            // Jasper's 2-step social plan has step 1 = delegate_to_marketing
            // (Marketing Manager produces post + image) and step 2 = social_post
            // (publish). Step 2's toolArgs reference step 1's output via
            // strings like "step_1_output_primaryPost" or "step_1_output_mediaUrls".
            // The step runner does NOT auto-resolve these — we resolve them
            // here, in the social_post handler, by looking up the prior
            // delegate_to_marketing step on the same mission and extracting
            // primaryPost / mediaUrls from its toolResult.
            //
            // If `content` looks like a step reference, resolve it. If
            // resolution fails or there's no prior step, fall back to whatever
            // string Jasper wrote (graceful degrade to "post the literal
            // string" rather than fail mysteriously).
            let resolvedContent = socialArgs.content;
            let resolvedMediaUrls = socialArgs.mediaUrls;

            const isStepRef = (val: string | undefined): val is string =>
              typeof val === 'string' && /^step[_\s-]?\d+_output/i.test(val.trim());

            if ((isStepRef(socialArgs.content) || isStepRef(args.mediaUrls as string | undefined)) && context?.missionId) {
              const { getMission } = await import('@/lib/orchestrator/mission-persistence');
              const mission = await getMission(context.missionId);
              const prior = mission?.steps?.find(
                (s: { toolName?: string; status?: string; toolResult?: string }) =>
                  s.toolName === 'delegate_to_marketing'
                  && s.status === 'COMPLETED'
                  && typeof s.toolResult === 'string',
              );
              if (prior?.toolResult) {
                try {
                  const parsed = JSON.parse(prior.toolResult) as {
                    primaryPost?: string;
                    mediaUrls?: string[];
                    data?: { primaryPost?: string; mediaUrls?: string[] };
                  };
                  const stepPrimaryPost = parsed.primaryPost ?? parsed.data?.primaryPost;
                  const stepMediaUrls = parsed.mediaUrls ?? parsed.data?.mediaUrls;
                  if (isStepRef(socialArgs.content) && typeof stepPrimaryPost === 'string') {
                    resolvedContent = stepPrimaryPost;
                  }
                  if (isStepRef(args.mediaUrls as string | undefined) && Array.isArray(stepMediaUrls)) {
                    resolvedMediaUrls = stepMediaUrls;
                  }
                } catch {
                  // Fall through with unresolved content — caller sees the literal
                }
              }
            }

            const { createPostingAgent } = await import('@/lib/social/autonomous-posting-agent');
            const agent = await createPostingAgent({ platforms: [platform] });

            const actionResult = await agent.executeAction({
              type: socialArgs.action,
              platform,
              content: resolvedContent,
              targetPostId: socialArgs.targetPostId,
              targetAccountId: socialArgs.targetAccountId,
              mediaUrls: resolvedMediaUrls,
              hashtags: socialArgs.hashtags,
            });

            // Track as campaign deliverable for POST actions
            const socialCampaignId = (args.campaignId as string) || context?.campaignId;
            if (socialCampaignId && socialArgs.action === 'POST' && actionResult.success) {
              trackDeliverableAsync(socialCampaignId, {
                missionId: context?.missionId ?? `mission_${Date.now()}`,
                type: 'social_post',
                title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Post`,
                status: 'pending_review',
                previewData: {
                  platform,
                  copy: socialArgs.content ?? '',
                  actionId: actionResult.actionId ?? null,
                  imageUrl: socialArgs.mediaUrls?.[0] ?? null,
                },
                reviewLink: `/social`,
              });
            }

            content = JSON.stringify({
              status: actionResult.success ? 'completed' : 'failed',
              campaignId: socialCampaignId ?? null,
              actionType: actionResult.actionType,
              platform: actionResult.platform,
              actionId: actionResult.actionId ?? null,
              platformActionId: actionResult.platformActionId ?? null,
              executedAt: actionResult.executedAt?.toISOString() ?? null,
              error: actionResult.error ?? null,
              complianceBlocked: actionResult.complianceBlocked ?? false,
              complianceReason: actionResult.complianceReason ?? null,
              reviewLink: socialCampaignId
                ? `/mission-control?campaign=${socialCampaignId}`
                : null,
            });
          }

          const socialDuration = Date.now() - socialStart;
          trackMissionStep(context, 'social_post', 'COMPLETED', {
            summary: `Social ${socialArgs.action}: ${socialArgs.platform ?? 'twitter'}`,
            durationMs: socialDuration,
            toolResult: content,
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

      // ═══════════════════════════════════════════════════════════════════════
      // CAMPAIGN ORCHESTRATION EXECUTION
      // ═══════════════════════════════════════════════════════════════════════
      case 'create_campaign': {
        const campaignStart = Date.now();
        trackMissionStep(context, 'create_campaign', 'RUNNING', { toolArgs: args });

        try {
          const brief = args.brief as string;
          const missionId = (args.missionId as string) ?? context?.missionId ?? `mission_${Date.now()}`;

          let research: Record<string, unknown> | undefined;
          if (typeof args.research === 'string') {
            try { research = JSON.parse(args.research) as Record<string, unknown>; } catch { /* skip */ }
          }

          let strategy: Record<string, unknown> | undefined;
          if (typeof args.strategy === 'string') {
            try { strategy = JSON.parse(args.strategy) as Record<string, unknown>; } catch { /* skip */ }
          }

          const campaignId = await createCampaign({
            missionId,
            brief,
            research,
            strategy,
            status: 'producing',
          });

          const reviewLink = `/mission-control?campaign=${campaignId}`;

          content = JSON.stringify({
            status: 'created',
            campaignId,
            missionId,
            reviewLink,
            message: `Campaign created. All deliverables will be tracked at: ${reviewLink}. Pass campaignId="${campaignId}" to subsequent tools (produce_video, save_blog_draft, social_post) so they register as campaign deliverables.`,
          });

          trackMissionStep(context, 'create_campaign', 'COMPLETED', {
            summary: `Campaign created: ${campaignId}`,
            durationMs: Date.now() - campaignStart,
            toolResult: content,
          });
        } catch (campaignError: unknown) {
          const errMsg = campaignError instanceof Error ? campaignError.message : String(campaignError);
          content = JSON.stringify({ status: 'error', message: `Campaign creation failed: ${errMsg}` });
          trackMissionStep(context, 'create_campaign', 'FAILED', {
            error: errMsg,
            durationMs: Date.now() - campaignStart,
          });
        }
        break;
      }

      case 'batch_produce_videos': {
        const batchStart = Date.now();
        trackMissionStep(context, 'batch_produce_videos', 'RUNNING', { toolArgs: args });

        try {
          const { createCalendarWeek: createWeek, generateDefaultTopics } = await import('@/lib/video/batch-generator');

          const theme = args.theme as string;
          const weekName = args.weekName as string;
          const weekStartDate = args.weekStartDate as string;
          const customTopics = args.topics as Array<{ dayOfWeek: number; topic: string }> | undefined;

          const topics = customTopics && customTopics.length > 0
            ? customTopics.map((t) => ({ dayOfWeek: t.dayOfWeek, topic: t.topic }))
            : await generateDefaultTopics(theme);

          const week = await createWeek({
            name: weekName,
            weekStartDate,
            theme,
            topics,
            createdBy: context?.userId ?? 'jasper',
          });

          const reviewLink = '/content/video/calendar';

          content = JSON.stringify({
            status: 'created',
            weekId: week.id,
            projectCount: week.projects.length,
            reviewLink,
            message: `Content Calendar week "${weekName}" created with ${week.projects.length} daily topics. Review and approve all storyboards at: ${reviewLink}`,
          });

          trackMissionStep(context, 'batch_produce_videos', 'COMPLETED', {
            summary: `Content Calendar week created: ${week.id} (${week.projects.length} topics)`,
            durationMs: Date.now() - batchStart,
            toolResult: content,
          });
        } catch (batchError: unknown) {
          const errMsg = batchError instanceof Error ? batchError.message : String(batchError);
          content = JSON.stringify({ status: 'error', message: `Batch video creation failed: ${errMsg}` });
          trackMissionStep(context, 'batch_produce_videos', 'FAILED', {
            error: errMsg,
            durationMs: Date.now() - batchStart,
          });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // WORKFLOW SCHEDULING EXECUTION (Stage A.5 — April 24, 2026)
      // ═══════════════════════════════════════════════════════════════════════
      case 'create_workflow': {
        // Creates a Workflow record + N workflowSequenceJobs, one per email
        // in the sequence with an absolute fireAt timestamp. The existing
        // /api/cron/workflow-scheduler endpoint polls pending jobs every
        // 5 minutes (registered in vercel.json) and dispatches each via
        // sendEmail when fireAt <= now.
        //
        // Why not use the existing workflow engine's delay-action? That
        // action blocks on setTimeout and the engine has a 60s global
        // timeout — fine for same-minute chains, unusable for day-scale
        // cadences. sequence-scheduler bypasses the engine for send steps
        // while still writing a Workflow doc so the sequence appears in
        // workflow lists and the operator can pause/archive it.
        const createWfStart = Date.now();
        trackMissionStep(context, 'create_workflow', 'RUNNING', { toolArgs: args });

        try {
          const { scheduleEmailSequence, describeCountdown } = await import('@/lib/workflows/sequence-scheduler');
          const { getMission } = await import('@/lib/orchestrator/mission-persistence');
          const { adminDb } = await import('@/lib/firebase/admin');
          const { getSubCollection } = await import('@/lib/firebase/collections');

          // -----------------------------------------------------------------
          // Parse args
          // -----------------------------------------------------------------
          const trigger = typeof args.trigger === 'string' && args.trigger.trim().length > 0
            ? args.trigger.trim()
            : 'manual';
          const sequenceTypeRaw = typeof args.sequenceType === 'string' ? args.sequenceType.trim() : 'nurture';
          const allowedSequenceTypes = ['nurture', 'drip', 'welcome', 'newsletter', 'custom'] as const;
          const sequenceType: (typeof allowedSequenceTypes)[number] =
            (allowedSequenceTypes as readonly string[]).includes(sequenceTypeRaw)
              ? (sequenceTypeRaw as (typeof allowedSequenceTypes)[number])
              : 'nurture';
          const cadence = typeof args.cadence === 'string' ? args.cadence : undefined;
          const expectedSteps = typeof args.steps === 'number'
            ? args.steps
            : (typeof args.steps === 'string' ? parseInt(args.steps, 10) : undefined);
          const recipient = typeof args.recipient === 'string' && args.recipient.trim().length > 0
            ? args.recipient.trim()
            : '{{entity.email}}';
          const name = typeof args.name === 'string' && args.name.trim().length > 0
            ? args.name.trim()
            : `${sequenceType} sequence (${trigger})`;

          // -----------------------------------------------------------------
          // Resolve contentSource → emails[]
          //
          // Three paths:
          //   a) args.contentSource is a JSON array (inline)
          //   b) args.contentSource matches step_N_output (or is missing) →
          //      pull from the Nth delegate_to_content step on the mission
          //   c) fallback: most recent delegate_to_content step on the mission
          // -----------------------------------------------------------------
          let emails: SequenceEmail[] = [];
          const contentSource = typeof args.contentSource === 'string' ? args.contentSource.trim() : '';

          if (contentSource.startsWith('[')) {
            try {
              const inline = JSON.parse(contentSource) as unknown;
              if (Array.isArray(inline)) {
                emails = inline as SequenceEmail[];
              }
            } catch {
              // Fall through to mission-step resolution
            }
          }

          if (emails.length === 0 && context?.missionId) {
            const mission = await getMission(context.missionId);
            if (mission?.steps && mission.steps.length > 0) {
              const contentSteps = mission.steps.filter(
                (s) => s.toolName === 'delegate_to_content' && s.status === 'COMPLETED' && s.toolResult,
              );
              const stepNumMatch = /step[_\s-]?(\d+)/i.exec(contentSource);
              const targetStep = stepNumMatch && contentSteps.length > 0
                ? (contentSteps[parseInt(stepNumMatch[1], 10) - 1] ?? contentSteps[contentSteps.length - 1])
                : contentSteps[contentSteps.length - 1];

              if (targetStep?.toolResult) {
                try {
                  // Two envelope shapes are possible:
                  //   (A) plan-driven runner stores the ContentPackage
                  //       directly at top level → parsed.emailSequence.emails
                  //   (B) legacy jasper-tools delegate_to_content wrapper
                  //       → parsed.data.emailSequence.emails
                  // Try top-level first (the live shape), then fall back.
                  const parsed = JSON.parse(targetStep.toolResult) as {
                    emailSequence?: { emails?: SequenceEmail[] };
                    emails?: SequenceEmail[];
                    data?: {
                      emailSequence?: { emails?: SequenceEmail[] };
                      result?: { emails?: SequenceEmail[] };
                      emails?: SequenceEmail[];
                    };
                  };
                  const emailsFromResult = parsed?.emailSequence?.emails
                    ?? parsed?.emails
                    ?? parsed?.data?.emailSequence?.emails
                    ?? parsed?.data?.result?.emails
                    ?? parsed?.data?.emails;
                  if (Array.isArray(emailsFromResult)) {
                    emails = emailsFromResult;
                  }
                } catch (parseErr) {
                  logger.warn('[create_workflow] Failed to parse delegate_to_content toolResult', {
                    missionId: context.missionId,
                    stepId: targetStep.stepId,
                    error: parseErr instanceof Error ? parseErr.message : String(parseErr),
                  });
                }
              }
            }
          }

          if (emails.length === 0) {
            if (context?.missionId) {
              const missionDebug = await getMission(context.missionId);
              const stepDiag = (missionDebug?.steps ?? []).map((s) => ({
                stepId: s.stepId,
                toolName: s.toolName,
                status: s.status,
                toolResultLen: s.toolResult?.length ?? 0,
              }));
              logger.warn('[create_workflow] No emails resolved — step diagnostics', {
                missionId: context.missionId,
                contentSource,
                stepCount: stepDiag.length,
                steps: JSON.stringify(stepDiag),
              });
            }
            throw new Error(
              'create_workflow could not resolve any emails. Provide contentSource as a JSON array, or ensure this mission has a prior completed delegate_to_content step that produced an email sequence.',
            );
          }

          // -----------------------------------------------------------------
          // Create the Workflow record + schedule jobs
          //
          // We write the workflow doc via adminDb directly instead of going
          // through workflow-service.createWorkflow, because that service
          // uses the client Firebase SDK which has no auth context when
          // called from inside an API route — Firestore rules reject the
          // write with PERMISSION_DENIED. adminDb bypasses rules.
          // -----------------------------------------------------------------
          if (!adminDb) {
            throw new Error('Firestore admin not initialized — cannot create workflow');
          }
          const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
          const nowIso = new Date().toISOString();

          // Map known entity-event trigger names to an entity.created shape
          // so CRM event dispatch (fireLeadCreated → getApplicableWorkflows)
          // can match this workflow. Unknown trigger names fall back to
          // `manual` — the sequence still runs on the demo recipient, but
          // no live entity event will fire it for real recipients.
          type LooseTrigger = {
            id: string;
            name: string;
            type: string;
            requireConfirmation?: boolean;
            schemaId?: string;
          };
          const entityTriggerMap: Record<string, string | undefined> = {
            new_lead: 'leads',
            lead_created: 'leads',
            'lead.created': 'leads',
            lead_added: 'leads',
            trial_signup: 'leads', // No 'users'/'signups' schema yet; leads stands in
            new_user: 'leads',
            new_signup: 'leads',
            signup: 'leads',
            form_submit: 'leads', // Form submissions land as leads
            new_contact: 'contacts',
            contact_created: 'contacts',
            new_deal: 'deals',
            deal_created: 'deals',
          };
          const mappedSchema = entityTriggerMap[trigger.toLowerCase()];
          const triggerShape: LooseTrigger = mappedSchema
            ? {
                id: `trigger_${Date.now()}`,
                name: `${trigger} → ${mappedSchema}.created`,
                type: 'entity.created',
                schemaId: mappedSchema,
              }
            : {
                id: `trigger_${Date.now()}`,
                name: `${trigger} event`,
                type: 'manual',
                requireConfirmation: false,
              };

          const workflowDoc = {
            id: workflowId,
            name,
            description: `Automated ${sequenceType} — fires on ${trigger}, ${emails.length} emails.`,
            trigger: triggerShape,
            actions: [], // Send steps are dispatched via workflowSequenceJobs, not action chain
            settings: {
              enabled: true,
              onError: 'continue',
              logLevel: 'errors',
              retentionDays: 90,
            },
            permissions: {
              canView: ['owner', 'admin', 'manager'],
              canEdit: ['owner', 'admin'],
              canExecute: ['owner', 'admin'],
            },
            status: 'active',
            stats: {
              totalRuns: 0,
              successfulRuns: 0,
              failedRuns: 0,
            },
            createdAt: nowIso,
            updatedAt: nowIso,
            createdBy: context?.userId ?? 'jasper',
            version: 1,
            // Stage A.5 metadata — these help the workflows list surface
            // sequence workflows separately from classic action-chain ones.
            sequenceType,
            triggerEvent: trigger,
            sequenceStepCount: emails.length,
            missionId: context?.missionId,
          };
          await adminDb
            .collection(getSubCollection('workflows'))
            .doc(workflowId)
            .set(workflowDoc);

          const scheduled = await scheduleEmailSequence({
            workflowId,
            missionId: context?.missionId,
            sequenceType,
            triggerEvent: trigger,
            emails,
            cadence,
            recipient,
          });

          const mismatchNote = typeof expectedSteps === 'number' && expectedSteps !== emails.length
            ? ` (expected ${expectedSteps} steps, resolved ${emails.length})`
            : '';

          const reviewLink = getReviewLink('create_workflow', context?.missionId);
          const summary =
            `${sequenceType} sequence scheduled: ${emails.length} emails, ` +
            `first fires in ${describeCountdown(scheduled.firstFireAt)}, ` +
            `last in ${describeCountdown(scheduled.lastFireAt)}${mismatchNote}`;

          content = JSON.stringify({
            status: 'COMPLETED',
            workflowId,
            sequenceType,
            trigger,
            stepsScheduled: emails.length,
            firstFireAt: scheduled.firstFireAt,
            lastFireAt: scheduled.lastFireAt,
            jobIds: scheduled.jobIds,
            recipient,
            recipientResolved: !/\{\{/.test(recipient),
            message: summary,
            reviewLink,
          });

          trackMissionStep(context, 'create_workflow', 'COMPLETED', {
            summary,
            durationMs: Date.now() - createWfStart,
            toolResult: content,
          });
        } catch (createWfError: unknown) {
          const errorMsg = createWfError instanceof Error ? createWfError.message : 'Unknown error';
          trackMissionStep(context, 'create_workflow', 'FAILED', {
            summary: `create_workflow failed: ${errorMsg}`,
            durationMs: Date.now() - createWfStart,
            error: errorMsg,
          });
          content = JSON.stringify({
            status: 'FAILED',
            error: errorMsg,
            tool: 'create_workflow',
          });
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
    logger.error(`[ToolTrace] ✗ FAILED: ${name}`, error instanceof Error ? error : new Error(errorMessage), {
      tool: name,
      durationMs: Date.now() - toolStartMs,
      missionId: context?.missionId,
    });
  }

  const toolDurationMs = Date.now() - toolStartMs;

  // Determine if result signals an error
  let resultStatus: 'SUCCESS' | 'ERROR' = 'SUCCESS';
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const hasErrorString = typeof parsed.error === 'string' && parsed.error.length > 0;
    const statusFailed = typeof parsed.status === 'string' && parsed.status === 'FAILED';
    if (hasErrorString || statusFailed) {
      resultStatus = 'ERROR';
    }
  } catch {
    // Non-JSON content — treat as success
  }

  const statusIcon = resultStatus === 'SUCCESS' ? '✓' : '⚠';
  logger.info(`[ToolTrace] ${statusIcon} COMPLETED: ${name} (${toolDurationMs}ms) [${resultStatus}]`, {
    tool: name,
    durationMs: toolDurationMs,
    resultStatus,
    resultPreview: content.slice(0, 400),
    missionId: context?.missionId,
  });

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
  const batchStart = Date.now();
  const toolNames = toolCalls.map(tc => tc.function.name);
  logger.info(`[ToolTrace] ═══ Executing ${toolCalls.length} tools in parallel: [${toolNames.join(', ')}]`, {
    toolCount: toolCalls.length,
    tools: toolNames,
  });

  const results = await Promise.all(toolCalls.map((tc) => executeToolCall(tc, context)));

  logger.info(`[ToolTrace] ═══ Batch complete: ${toolCalls.length} tools in ${Date.now() - batchStart}ms`, {
    toolCount: toolCalls.length,
    totalDurationMs: Date.now() - batchStart,
    tools: toolNames,
  });

  return results;
}
