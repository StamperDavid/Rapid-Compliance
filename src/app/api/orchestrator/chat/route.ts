/**
 * Orchestrator Chat API - Jasper Brain Activation with OpenRouter
 *
 * This endpoint handles live AI calls for the Jasper orchestrator via OpenRouter,
 * enabling access to 100+ models including Gemini, Claude, GPT-4, and Llama.
 *
 * Features:
 * - OpenRouter API integration for multi-model support
 * - Model fallback chain: if primary model returns 404, automatically tries fallbacks
 * - Configurable default model via JASPER_DEFAULT_MODEL env var
 * - Conversation history for stateful memory
 * - ANTI-HALLUCINATION: Tool calling for verified data retrieval
 * - Real-time stats and context injection
 * - TTS voice synthesis integration
 * - Detailed OpenRouter error logging for debugging
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { OpenRouterProvider, type ChatMessage, type ToolCall, type ChatCompletionResponse } from '@/lib/ai/openrouter-provider';
import { requireAuthOrSynthetic } from '@/lib/auth/api-auth';

// Force dynamic rendering - required for Firebase Auth token verification
export const dynamic = 'force-dynamic';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { VoiceEngineFactory } from '@/lib/voice/tts/voice-engine-factory';
import { JASPER_TOOLS, executeToolCalls, type ToolCallContext, type ToolResult } from '@/lib/orchestrator/jasper-tools';
import { SystemStateService } from '@/lib/orchestrator/system-state-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getSubCollection } from '@/lib/firebase/collections';
import { createMission, finalizeMission } from '@/lib/orchestrator/mission-persistence';
import { getAgentCount, getDomainCount } from '@/lib/agents/agent-registry';
import { getActiveJasperGoldenMaster } from '@/lib/orchestrator/jasper-golden-master';
import { expandIntent } from '@/lib/orchestrator/intent-expander';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * OpenRouter error metadata structure
 */
interface OpenRouterErrorMetadata {
  provider_name?: string;
  [key: string]: unknown;
}

/**
 * OpenRouter error object structure
 */
interface OpenRouterErrorObject {
  code?: string;
  message?: string;
  metadata?: OpenRouterErrorMetadata;
}

/**
 * Parsed OpenRouter error body (JSON structure)
 */
interface OpenRouterErrorBody {
  error?: OpenRouterErrorObject;
  [key: string]: unknown;
}

/**
 * OpenRouter error details for logging
 */
interface OpenRouterErrorDetails {
  statusCode: number;
  code?: string;
  message?: string;
  provider?: string;
  rawBody?: string;
}

/**
 * Structured error object for catch blocks
 */
interface StructuredError {
  message: string;
  name: string;
  stack?: string;
  cause?: unknown;
}

// ============================================================================
// Configuration
// ============================================================================

// Model configuration — HARDCODED, not overridable by env vars.
// Claude Sonnet 4 is the current reliable model for tool calling via OpenRouter.
// Gemini was tested extensively and IGNORES tools, causing hallucinations.
// DO NOT change this without verifying tool calling works end-to-end.
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4';

// Fallback models — Claude models ONLY. Gemini does not reliably call tools.
const FALLBACK_MODELS = [
  'anthropic/claude-opus-4.6',
  'anthropic/claude-sonnet-4.6',
];

// Available models for the orchestrator (not exported - use GET endpoint to fetch)
const AVAILABLE_MODELS = {
  // Recommended: Best tool-calling reliability with large tool sets
  'anthropic/claude-opus-4.6': { name: 'Claude Opus 4.6', latency: 'medium', quality: 'ultra', recommended: true },
  'anthropic/claude-3-haiku': { name: 'Claude 3 Haiku', latency: 'low', quality: 'high' },

  // Google models (fast but less reliable tool calling through OpenRouter)
  'google/gemini-pro-1.5': { name: 'Gemini 1.5 Pro', latency: 'medium', quality: 'ultra' },
  'google/gemini-flash-1.5': { name: 'Gemini 1.5 Flash', latency: 'low', quality: 'high' },
  'openai/gpt-4-turbo': { name: 'GPT-4 Turbo', latency: 'medium', quality: 'ultra' },

  // Power models (for complex reasoning)
  'anthropic/claude-3-opus': { name: 'Claude 3 Opus', latency: 'high', quality: 'ultra' },
  'openai/gpt-4': { name: 'GPT-4', latency: 'high', quality: 'ultra' },

  // Cost-effective models
  'meta-llama/llama-3.1-70b-instruct': { name: 'Llama 3.1 70B', latency: 'medium', quality: 'high' },
  'meta-llama/llama-3.1-8b-instruct': { name: 'Llama 3.1 8B', latency: 'low', quality: 'good' },
} as const;

/**
 * Parse OpenRouter error from exception message
 */
function parseOpenRouterError(error: Error): { statusCode: number; errorBody: string } | null {
  const match = error.message.match(/OpenRouter API error: (\d+) - (.+)/s);
  if (match) {
    return {
      statusCode: parseInt(match[1], 10),
      errorBody: match[2],
    };
  }
  return null;
}

/**
 * Check if error is a model-not-found error (404)
 */
function isModelNotFoundError(error: Error): boolean {
  const parsed = parseOpenRouterError(error);
  return parsed?.statusCode === 404;
}

/**
 * Check if an error is a network-level failure (DNS, timeout, connection refused)
 * as opposed to an HTTP error from OpenRouter.
 */
function isNetworkError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes('socket hang up') ||
    msg.includes('network')
  );
}

/**
 * Check if error is a transient server error (502/503/429) — retry after delay.
 * These are OpenRouter outages or rate limits, not permanent failures.
 */
function isTransientError(error: Error): boolean {
  const parsed = parseOpenRouterError(error);
  if (!parsed) { return false; }
  return parsed.statusCode === 502 || parsed.statusCode === 503 || parsed.statusCode === 429;
}

/**
 * Try a chat request with model fallback on 404 errors and retry on network failures.
 *
 * Retry strategy:
 * - Network errors (fetch failed, timeout, DNS): retry up to MAX_RETRIES times with delay
 * - 404 (model not found): try next model in the fallback chain
 * - All other HTTP errors: throw immediately (no retry)
 */
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const TRANSIENT_RETRY_DELAY_MS = 5000; // Longer delay for 502/503/429

async function chatWithFallback<T>(
  modelsToTry: string[],
  chatFn: (model: string) => Promise<T>,
  context: string
): Promise<{ result: T; model: string }> {
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        const result = await chatFn(model);
        return { result, model };
      } catch (error: unknown) {
        const err = error as Error;
        const parsed = parseOpenRouterError(err);

        // Log the specific error for debugging
        logger.warn(`[Jasper] OpenRouter error for model ${model}`, {
          context,
          attempt,
          statusCode: parsed?.statusCode,
          errorBody: parsed?.errorBody?.slice(0, 500),
          rawMessage: err?.message,
        });

        // Network errors: retry with delay
        if (isNetworkError(err) && attempt <= MAX_RETRIES) {
          logger.info(`[Jasper] Network error on attempt ${attempt}/${MAX_RETRIES + 1}, retrying in ${RETRY_DELAY_MS}ms...`, {
            model,
            context,
            error: err.message,
          });
          await new Promise<void>((resolve) => { setTimeout(resolve, RETRY_DELAY_MS); });
          continue;
        }

        // Transient server errors (502/503/429): retry with longer delay
        if (isTransientError(err) && attempt <= MAX_RETRIES) {
          logger.info(`[Jasper] Transient error (${parsed?.statusCode}) on attempt ${attempt}/${MAX_RETRIES + 1}, retrying in ${TRANSIENT_RETRY_DELAY_MS}ms...`, {
            model,
            context,
            error: err.message,
          });
          await new Promise<void>((resolve) => { setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS); });
          continue;
        }

        // If 404 (model not found), break inner retry loop and try next model
        if (isModelNotFoundError(err)) {
          logger.warn(`[Jasper] Model ${model} returned 404, trying next fallback`, {
            model,
            fallbacksRemaining: modelsToTry.indexOf(model) < modelsToTry.length - 1,
          });
          lastError = err;
          break;
        }

        // For other errors (including exhausted retries), throw immediately
        throw error;
      }
    }
  }

  // All models failed
  throw lastError ?? new Error('All models failed');
}

const orchestratorChatSchema = z.object({
  message: z.string().min(1, 'message is required'),
  context: z.enum(['admin', 'merchant']),
  // systemPrompt from frontend is now ignored — Jasper reads its system prompt
  // from the Golden Master in Firestore (Brand DNA baked in at seed time).
  // Field kept as optional for legacy frontend compatibility; value is discarded.
  systemPrompt: z.string().optional(),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
  adminStats: z.object({
    totalOrgs: z.number(),
    activeAgents: z.number(),
    pendingTickets: z.number(),
    trialOrgs: z.number().optional(),
  }).optional(),
  merchantInfo: z.object({
    industry: z.string().optional(),
    companyName: z.string().optional(),
    ownerName: z.string().optional(),
  }).optional(),
  modelId: z.string().optional(),
  voiceEnabled: z.boolean().optional(),
  voiceId: z.string().optional(),
  ttsEngine: z.enum(['elevenlabs', 'unreal']).optional(),
  /** Client-generated idempotency key. Retries with the same requestId reuse the same missionId. */
  requestId: z.string().optional(),
  /** Image / video URLs the operator attached to this message via the chat composer.
   * Surfaced to Jasper as operator-provided media so he can pass them down to
   * delegate_to_marketing / delegate_to_content / save_blog_draft as
   * providedMediaUrls — using them as-is, no DALL-E spend. */
  attachedMediaUrls: z.array(z.string().url()).max(8).optional(),
});

type OrchestratorChatRequest = z.infer<typeof orchestratorChatSchema>;

interface OrchestratorChatResponse {
  success: boolean;
  response: string;
  metadata: {
    model: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    toolExecuted?: string;
    responseTime?: number;
    missionId?: string;
    reviewLink?: string;
  };
  // Voice output (base64 audio if voiceEnabled)
  audio?: {
    data: string;
    format: string;
    durationSeconds: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/orchestrator/chat');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication. Accepts either a real Firebase ID token (UI traffic)
    // or a synthetic-trigger from a backend driver (cron / webhook) that
    // is rebuilding inbound DM auto-reply via the proper Jasper path.
    // The synthetic-trigger scope `inbound_dm_reply` is explicitly opted
    // in here — a leaked CRON_SECRET cannot be used to invoke this
    // route under a different scope.
    const authResult = await requireAuthOrSynthetic(request, ['inbound_dm_reply']);

    if (authResult instanceof NextResponse) {
      logger.error('[Jasper] Auth failed - no valid token', new Error('Auth failed - no valid token'), { file: 'orchestrator/chat/route.ts' });
      return authResult;
    }

    const { user, isSynthetic, syntheticScope } = authResult;
    if (isSynthetic) {
      logger.info('[Jasper] Synthetic-trigger authenticated', {
        scope: syntheticScope,
        syntheticUid: user.uid,
      });
    }

    // All authenticated users get Jasper tool access
    // Jasper is the primary interface for every employee on the platform
    // Individual tools handle their own permission checks as needed
    const isAdminContext = Boolean(user.uid);

    logger.info('[Jasper] Authenticated', {
      uid: user.uid,
      email: user.email,
      role: user.role,
      isAdmin: isAdminContext,
    });

    // Parse and validate request body
    const rawBody: unknown = await request.json();
    const parsedBody = orchestratorChatSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      logger.warn('[Jasper] Invalid request body', {
        errors: parsedBody.error.errors[0]?.message,
        file: 'orchestrator/chat/route.ts',
      });
      return NextResponse.json(
        { success: false, error: parsedBody.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }
    const {
      message,
      context,
      // systemPrompt from frontend is ignored — Jasper uses his Golden Master prompt
      conversationHistory,
      adminStats,
      merchantInfo,
      modelId,
      voiceEnabled,
      voiceId,
      ttsEngine,
      requestId,
      attachedMediaUrls,
    } = parsedBody.data;

    // Determine model to use
    const selectedModel = modelId ?? DEFAULT_MODEL;

    // Validate model exists in our list or allow any OpenRouter model
    const isKnownModel = selectedModel in AVAILABLE_MODELS;
    if (!isKnownModel) {
      logger.info('[Jasper] Using custom model', { model: selectedModel });
    }

    // ── Intent classification: LLM Expander is the SINGLE SOURCE OF TRUTH ──
    //
    // Apr 22 2026 refactor: the legacy regex classifier (FACTUAL_PATTERNS et al.
    // in system-state-service.ts) has been retired. Pattern matching is not
    // intent reading — it pretends to be intelligent while dressing up keyword
    // hits as "classification." Now: the GM-backed Intent Expander reads the
    // user's actual message and emits queryType + tool list in one call.
    //
    // Trivial greetings ("hi", "thanks", "ok") still get a regex fast-path so
    // we don't burn an LLM call on one-word acknowledgements. Everything else
    // goes to the LLM. If the LLM call fails, the safe fallback is advisory
    // mode — Jasper asks a clarifying question rather than guessing at action.
    const TRIVIAL_GREETING_RE = /^(hi|hello|hey|thanks?|thank\s+you|yes|no|ok|okay|got\s+it|sure|cool|nice|great|perfect|awesome|good\s+(morning|afternoon|evening))[\s.!?]*$/i;
    const isTrivialGreeting = TRIVIAL_GREETING_RE.test(message.trim());

    const expandedIntent = isTrivialGreeting ? null : await expandIntent(message);

    const queryClassification: {
      queryType: 'factual' | 'advisory' | 'action' | 'strategic' | 'conversational';
      requiresStateReflection: boolean;
      suggestedTools: string[];
    } = isTrivialGreeting
      ? { queryType: 'conversational', requiresStateReflection: false, suggestedTools: [] }
      : expandedIntent
        ? {
            queryType: expandedIntent.queryType,
            // Inject state context when Jasper needs grounded data — for reads
            // and for advisory conversations where he might be asked about state.
            requiresStateReflection: expandedIntent.queryType === 'factual'
              || expandedIntent.queryType === 'advisory'
              || expandedIntent.queryType === 'strategic',
            suggestedTools: expandedIntent.tools,
          }
        : {
            // Expander failed (network / parse). Safe default: talk to the user.
            queryType: 'advisory',
            requiresStateReflection: true,
            suggestedTools: [],
          };

    logger.info('[Jasper] Query classified', {
      source: isTrivialGreeting ? 'greeting-fast-path' : (expandedIntent ? 'llm-expander' : 'fallback-advisory'),
      queryType: queryClassification.queryType,
      requiresStateReflection: queryClassification.requiresStateReflection,
      suggestedTools: queryClassification.suggestedTools,
    });

    // Load feature config for Jasper context awareness
    let enabledModules: string[] | null = null;
    try {
      const { getFeatureConfig: loadFeatureConfig } = await import('@/lib/services/feature-service');
      const featureConfig = await loadFeatureConfig();
      if (featureConfig) {
        enabledModules = Object.entries(featureConfig.modules)
          .filter(([, enabled]) => enabled)
          .map(([id]) => id);
      }
    } catch {
      // Non-critical — Jasper will assume all features enabled
    }

    // Load API key configuration status so Jasper knows what's ready
    let configContext = '';
    try {
      configContext = await getConfigurationContext();
    } catch {
      // Non-critical — Jasper will discover missing keys via tool errors
    }

    // Load Jasper's Golden Master. The GM is REQUIRED — Brand DNA is baked
    // into the GM at seed time per the standing rule in CLAUDE.md, so there
    // is no legitimate fallback path. If the GM is missing or empty, fail
    // loudly so the problem is fixed at the source (re-run the seed script)
    // rather than silently serving a stale frontend-sent prompt.
    const jasperGM = await getActiveJasperGoldenMaster();
    const gmPrompt = jasperGM?.systemPrompt;
    const hasValidGM = typeof gmPrompt === 'string' && gmPrompt.length > 100;

    if (!hasValidGM) {
      logger.error(
        '[Jasper] No valid Golden Master found — cannot serve chat request',
        new Error('Jasper GM missing or empty'),
        {
          gmId: jasperGM?.id ?? 'none',
          promptLength: gmPrompt?.length ?? 0,
          remediation: 'Run: npx tsx scripts/seed-jasper-orchestrator-gm.ts --force',
        },
      );
      return NextResponse.json(
        {
          error: 'Jasper is not available — Golden Master not configured',
          detail: 'Run `npx tsx scripts/seed-jasper-orchestrator-gm.ts --force` to seed Jasper\'s Golden Master with Brand DNA baked in, then retry.',
        },
        { status: 503 },
      );
    }

    // Brand DNA is already baked into gmPrompt at seed time — no runtime merge.
    const basePrompt = gmPrompt;

    logger.info('[RequestTrace] Jasper GM loaded', {
      source: 'GOLDEN_MASTER',
      gmId: jasperGM?.id,
      gmVersion: jasperGM?.version,
      promptLength: basePrompt.length,
    });

    // Build the enhanced system prompt with real-time context
    const enhancedSystemPrompt = buildEnhancedSystemPrompt(
      basePrompt,
      context,
      adminStats,
      merchantInfo,
      enabledModules,
      configContext
    );

    // For factual/strategic/advisory queries, inject verified state context
    let stateContext = '';
    if (queryClassification.requiresStateReflection) {
      stateContext = await SystemStateService.generateStateContext();
    }

    // For advisory queries, inject guidance to have a conversation instead of executing
    let advisoryContext = '';
    if (queryClassification.queryType === 'advisory') {
      advisoryContext = `

IMPORTANT — ADVISORY MODE:
The user is asking for your advice, recommendations, or opinion. They are NOT asking you to execute anything.
DO NOT call any tools that create data (scan_leads, delegate_to_outreach, delegate_to_marketing, delegate_to_content, etc.).
Instead, have a strategic conversation:
1. Explain your recommended approach and WHY it makes sense for their situation
2. Outline the specific steps you WOULD take if they approve
3. Ask if they want you to proceed with execution
Only execute tools if the user explicitly says to go ahead (e.g., "yes do it", "go ahead", "let's do that", "execute that plan").
You MAY call read-only tools like get_system_state or query_docs to inform your recommendation.`;
    }

    // Operator-attached media: when the user dragged files into the chat composer,
    // their URLs flow through here. Jasper sees them in the system prompt and is
    // expected to pass them to delegate_to_marketing / delegate_to_content /
    // save_blog_draft as providedMediaUrls so the system uses them as-is and
    // skips DALL-E generation.
    let mediaContext = '';
    if (attachedMediaUrls && attachedMediaUrls.length > 0) {
      mediaContext = `

## OPERATOR-PROVIDED MEDIA (attached to this message)
The user attached the following media URLs to this message via the chat composer.
When you plan tools that involve content posting, blog featured images, or social-post
images, pass these URLs through as \`providedMediaUrls\` so the system uses them as-is
without generating new images. Do NOT trigger DALL-E or any image generator while these
URLs are available.

${attachedMediaUrls.map((u, i) => `- [${i + 1}] ${u}`).join('\n')}
`;
    }

    // Convert conversation history to provider format with tool support
    const messages: ChatMessage[] = [
      { role: 'system', content: enhancedSystemPrompt + stateContext + advisoryContext + mediaContext },
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Initialize OpenRouter provider
    const provider = new OpenRouterProvider(PLATFORM_ID);

    const startTime = Date.now();
    const traceId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    logger.info(`[RequestTrace] ═══════════════════════════════════════════`, {
      traceId,
      event: 'REQUEST_START',
      uid: user.uid,
      model: selectedModel,
      messagePreview: message.slice(0, 200),
      queryType: queryClassification.queryType,
    });

    // Determine if we should enable tool calling
    // ALWAYS enable tools for admin context - Jasper needs full platform access
    // Tools are Jasper's PRIMARY interface to the platform (Anti-Hallucination Architecture)
    const useTools = isAdminContext; // Tools ALWAYS enabled for admin

    let finalResponse = '';
    const toolsExecuted: string[] = [];
    // Accumulates all ToolResult objects across every iteration of the tool-calling loop.
    // Used post-loop to derive mission status in-memory, avoiding a Firestore race condition.
    const allToolResults: ToolResult[] = [];
    let lastReviewLink: string | undefined;
    let modelUsed = selectedModel;
    // M4: set when Jasper calls propose_mission_plan in any iteration.
    // Once true: (a) we break out of the tool loop after the current
    // iteration so Jasper can't accidentally chain more tool calls, and
    // (b) we skip finalizeMission so the mission stays in
    // PLAN_PENDING_APPROVAL instead of being marked COMPLETED.
    let planDrafted = false;

    // Mission tracking — derive missionId from client requestId when available.
    // This ensures retries with the same requestId reuse the same missionId,
    // preventing duplicate missions in Firestore (set() overwrites same doc).
    const missionId = requestId
      ? `mission_${requestId}`
      : `mission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const conversationId = `jasper_${context}`;
    const missionContext: ToolCallContext = { conversationId, missionId, userPrompt: message, userId: user.uid };
    let missionCreated = false;

    // Tools that trigger a live mission on Mission Control.
    //
    // RULE (April 15, 2026): Jasper delegates to MANAGERS only. He is not
    // allowed to call specialists directly. Removed from this list because
    // they bypass the manager review layer:
    //   - create_video          (bypassed Content Manager → Video Specialist)
    //   - research_competitors  (bypassed Intelligence Manager → Competitor Researcher)
    //   - scrape_website        (bypassed Intelligence Manager → Scraper Specialist)
    //   - scan_tech_stack       (bypassed Intelligence Manager → Technographic Scout)
    // Jasper must now use delegate_to_content / delegate_to_intelligence for
    // those tasks. The tool definitions still exist in jasper-tools.ts because
    // purpose-built chat endpoints (Lead Research, Discovery Hub) use them —
    // but Jasper's main chat does NOT trigger missions from them.
    const missionTriggerTools = [
      // M4: plan-first path. When Jasper drafts a plan, we still need a
      // missionId reserved so propose_mission_plan can write against it.
      'propose_mission_plan',
      'delegate_to_builder', 'delegate_to_sales', 'delegate_to_marketing',
      'delegate_to_agent', 'delegate_to_trust', 'delegate_to_content',
      'delegate_to_architect', 'delegate_to_outreach', 'delegate_to_intelligence',
      'delegate_to_commerce', 'generate_video', 'produce_video', 'assemble_video', 'generate_content',
      'scan_leads', 'enrich_lead', 'draft_outreach_email',
      'voice_agent', 'social_post',
      'create_campaign',
      'save_blog_draft', 'research_trending_topics', 'batch_produce_videos',
      'migrate_website',
    ];

    // Build model fallback chain: selected model + fallback models
    const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];

    logger.info('[Jasper] Tool configuration', {
      useTools,
      toolCount: JASPER_TOOLS.length,
      model: selectedModel,
      fallbacks: modelsToTry.slice(1),
    });

    // ═══════════════════════════════════════════════════════════════════════
    // INTENT DETECTION & PHASED EXECUTION PLANNER
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Two-layer system:
    // 1. LLM Intent Expander (primary) — Claude Haiku understands the user's
    //    business goal and maps it to the correct tools. Handles vague inputs
    //    like "help me beat my competitors" that regex can't parse.
    // 2. Regex keyword matching (fallback + merge) — catches obvious keywords
    //    instantly. Results are merged with the LLM expander output.
    //
    // The union of both layers ensures maximum tool coverage.
    // Phase order ensures research data feeds into campaign content.
    // ═══════════════════════════════════════════════════════════════════════

    // ── Late-inject advisory mode context if needed ──
    // The expander already classified this as advisory. Append the explicit
    // "do not execute, have a conversation instead" guardrail to Jasper's
    // system prompt so he knows to talk rather than act.
    if (queryClassification.queryType === 'advisory') {
      const advisoryGuardrail = `

IMPORTANT — ADVISORY MODE:
The user is asking for your advice, recommendations, or opinion. They are NOT asking you to execute anything.
DO NOT call any tools that create data (scan_leads, delegate_to_outreach, delegate_to_marketing, delegate_to_content, etc.).
Instead, have a strategic conversation:
1. Explain your recommended approach and WHY it makes sense for their situation
2. Outline the specific steps you WOULD take if they approve
3. Ask if they want you to proceed with execution
Only execute tools if the user explicitly says to go ahead (e.g., "yes do it", "go ahead", "let's do that", "execute that plan").
You MAY call read-only tools like get_system_state, query_docs, or list_crm_leads to inform your recommendation.`;

      if (messages.length > 0 && messages[0].role === 'system') {
        const current = messages[0].content;
        messages[0].content = (typeof current === 'string' ? current : '') + advisoryGuardrail;
      }
    }

    // ── Required tool set comes ENTIRELY from the expander now ──
    // No regex merging. The LLM picks tools based on intent, period.
    const requiredTools = new Set<string>(expandedIntent?.tools ?? []);

    // Dependency-ordered phases. scrape_website removed April 15, 2026 —
    // Jasper now uses delegate_to_intelligence for scraping which goes
    // through the Intelligence Manager review gate.
    const PHASE_ORDER: Record<string, number> = {
      delegate_to_intelligence: 1,
      scan_leads: 1,
      get_seo_config: 1,
      research_trending_topics: 1,
      enrich_lead: 2,
      score_leads: 2,
      delegate_to_content: 3,
      delegate_to_marketing: 3,
      produce_video: 3,
      delegate_to_builder: 3,
      create_campaign: 3,
      delegate_to_outreach: 4,
    };

    // Build phased execution plan
    const phasedPlan = new Map<number, string[]>();
    for (const tool of requiredTools) {
      const phase = PHASE_ORDER[tool] ?? 1;
      const existing = phasedPlan.get(phase) ?? [];
      existing.push(tool);
      phasedPlan.set(phase, existing);
    }

    const isComplexRequest = requiredTools.size >= 3 || (expandedIntent?.isComplex ?? false);

    logger.info('[Jasper] Intent detection (LLM + regex merged)', {
      expanderUsed: Boolean(expandedIntent),
      expanderTools: expandedIntent?.tools ?? [],
      expanderIsAdvisory: expandedIntent?.isAdvisory ?? false,
      expanderReasoning: expandedIntent?.reasoning,
      finalQueryType: queryClassification.queryType,
      tools: [...requiredTools],
      isComplexRequest,
      phases: JSON.stringify(Object.fromEntries(phasedPlan)),
    });

    let pendingToolReminders = 0;
    const MAX_REMINDERS = 4; // One per phase

    if (useTools) {
      // ═════════════════════════════════════════════════════════════════════
      // DELEGATION MODEL: Jasper = Commander, delegates to Department Managers
      //
      // For complex requests (3+ tools detected), Jasper ONLY sees:
      //   - Manager delegation tools (delegate_to_X)
      //   - Simple query tools (get_X, list_X)
      //   - Lead tools (no manager for these yet)
      //
      // This prevents Jasper from calling specialist tools directly
      // (scrape_website, save_blog_draft, social_post, etc.) and forces
      // him to delegate to managers who coordinate specialists internally.
      //
      // For simple requests, Jasper keeps full tool access.
      // ═════════════════════════════════════════════════════════════════════

      // Commander-level tools: delegation + queries + admin + lead management
      //
      // STANDING RULE (April 15, 2026): Jasper delegates to MANAGERS only.
      // He is not allowed to call specialists directly. DO NOT add any of
      // these tool names back to this allowlist under any circumstance —
      // they bypass the manager review layer and break the training loop:
      //   - create_video, scrape_website, research_competitors, scan_tech_stack
      // If Jasper needs that capability, use delegate_to_content or
      // delegate_to_intelligence. Those tool definitions still exist in
      // jasper-tools.ts because Lead Research and Discovery Hub endpoints
      // use them, but Jasper's own allowlist excludes them.
      const COMMANDER_TOOL_NAMES = new Set([
        // Plan-first gate: required in the allowlist so the architectural
        // plan-gate (route.ts ~L860) can force this tool on iteration 1 of
        // any action request. Without it, activeTools omits propose_mission_plan
        // for complex requests and the gate silently falls back to 'required',
        // which lets Jasper bypass plan approval entirely.
        'propose_mission_plan',
        // Department delegation (managers handle specialist coordination)
        'delegate_to_intelligence',   // Research, competitor analysis, trends, scraping, tech scans
        'delegate_to_content',        // Blog, landing page copy, assets, video creation
        'delegate_to_marketing',      // Social posts, SEO, ads
        'delegate_to_sales',          // Lead qualification, pipeline, deal closing
        'delegate_to_outreach',       // Email/SMS/voice outreach sequences, email campaigns/drips
        'delegate_to_builder',        // Website building, landing pages
        'delegate_to_architect',      // Site architecture
        'delegate_to_trust',          // Reputation management
        'delegate_to_commerce',       // E-commerce, payments
        'delegate_to_agent',          // Generic agent delegation
        // Simple data queries (no delegation needed)
        'query_docs', 'get_platform_stats', 'get_system_state',
        'get_analytics', 'generate_report', 'get_seo_config',
        'list_avatars', 'get_video_status', 'list_users',
        'list_organizations', 'get_organization', 'get_pricing_tiers',
        'recall_conversation_history',
        // Lead management (no manager for these yet — keep accessible)
        'list_crm_leads', 'scan_leads', 'enrich_lead', 'score_leads',
        // Campaign container (lightweight — just creates tracking record)
        'create_campaign',
        // Admin CRUD
        'update_organization', 'provision_organization',
        'create_coupon', 'update_coupon_status', 'update_pricing',
        'update_user_role', 'inspect_agent_logs',
      ]);

      const COMMANDER_TOOLS = JASPER_TOOLS.filter(
        t => COMMANDER_TOOL_NAMES.has(t.function.name)
      );

      // Use commander tools for complex requests, full tools for simple ones
      const activeTools = isComplexRequest ? COMMANDER_TOOLS : JASPER_TOOLS;

      logger.info('[Jasper] Tool set selected', {
        mode: isComplexRequest ? 'commander (delegation only)' : 'full',
        toolCount: activeTools.length,
        totalAvailable: JASPER_TOOLS.length,
      });

      const currentMessages = [...messages];

      // For complex requests, inject delegation instructions
      if (isComplexRequest) {
        const delegationPrompt = `
═══════════════════════════════════════════════════════════════════════════════
COMMANDER MODE — DELEGATE TO DEPARTMENT MANAGERS
═══════════════════════════════════════════════════════════════════════════════

This is a complex multi-part request. You are a COMMANDER. You delegate to
department managers — you do NOT do specialist work yourself.

DELEGATION ORDER (follow this sequence):
1. delegate_to_intelligence — ALL research in ONE call. Pass ALL target URLs
   and ALL research topics in the "targets" parameter as a comma-separated list.
   Set researchType to "comprehensive" and depth to "deep".
   The Intelligence Manager coordinates scrapers, researchers, and analysts.
   WAIT for results before step 3.

2. scan_leads + score_leads — lead generation and scoring.
   Can run in parallel with step 1.

3. delegate_to_content — blog posts, video storyboards, landing page copy.
   delegate_to_marketing — social media posts, email campaigns.
   These managers read intelligence findings from the data vault automatically.
   Call them AFTER step 1 completes so they have research data to work with.

4. delegate_to_outreach — personalized outreach emails/sequences.
   Call AFTER step 2 leads are scored so it knows who to target.

CRITICAL RULES:
- ONE call per department. Brief each manager with the FULL scope of their work.
  Do NOT call the same manager multiple times for different parts of the task.
  WRONG: 3 separate calls to delegate_to_intelligence for 3 URLs
  RIGHT: 1 call with targets: "url1.com,url2.com,url3.com"
- Only delegate to departments the user actually requested. If the user did not
  ask for website building, do NOT call delegate_to_builder.
- WAIT for intelligence results before calling content/marketing managers.
- Each manager coordinates their own specialists — you do NOT micromanage.
- After delegating all departments, provide a Mission Control link.
═══════════════════════════════════════════════════════════════════════════════`;

        const systemMsg = currentMessages.find(m => m.role === 'system');
        if (systemMsg && typeof systemMsg.content === 'string') {
          systemMsg.content = `${systemMsg.content}\n\n${delegationPrompt}`;
        } else {
          currentMessages.unshift({ role: 'system', content: delegationPrompt });
        }
      }

      let iterationCount = 0;
      const maxIterations = 30;

      while (iterationCount < maxIterations) {
        iterationCount++;

        // Force tool use on first iteration and after phase nudges.
        // Advisory and conversational queries should NEVER force tools — the user is asking a question.
        const isNonActionQuery = queryClassification.queryType === 'conversational' || queryClassification.queryType === 'advisory';
        const lastMsg = currentMessages[currentMessages.length - 1];
        const wasNudged = typeof lastMsg?.content === 'string' && lastMsg.content.startsWith('SYSTEM: Phase');
        const shouldForceTools = (iterationCount === 1 && !isNonActionQuery) || (wasNudged && !isNonActionQuery);

        // Architectural plan-first gate: on the very first iteration of any
        // action request, force Jasper to call propose_mission_plan specifically
        // (not just "any tool"). Previous behavior used toolChoice='required'
        // which let the LLM pick any tool — observed Apr 21 when Jasper
        // bypassed plan approval entirely and fired 5 tools directly
        // (delegate_to_intelligence + save_blog_draft + scan_leads +
        // get_seo_config + delegate_to_content), hallucinating lead data.
        // The M4 rule to use propose_mission_plan is in the GM prompt, but
        // LLM compliance with long prompts is unreliable. Forcing the
        // specific tool name at the API layer is deterministic — the
        // operator ALWAYS sees a plan before work runs. If the request is
        // truly one step, Jasper produces a 1-step plan, still reviewable.
        //
        // Only 'action' and 'strategic' queries need a mission. Factual reads
        // ("what leads do we have") should call their suggested read tools and
        // answer in chat — forcing propose_mission_plan on them creates orphan
        // PLAN_PENDING missions for simple questions (Apr 22 QA pass bug X).
        const planGateEngaged = iterationCount === 1
          && (queryClassification.queryType === 'action'
            || queryClassification.queryType === 'strategic');
        const hasProposeMissionPlanAvailable = activeTools.some(
          (t) => t.function.name === 'propose_mission_plan',
        );
        const iterationToolChoice = planGateEngaged && hasProposeMissionPlanAvailable
          ? ({ type: 'function' as const, function: { name: 'propose_mission_plan' } })
          : shouldForceTools
            ? ('required' as const)
            : ('auto' as const);

        const { result: response, model } = await chatWithFallback<ChatCompletionResponse>(
          modelsToTry,
          (m) => provider.chatWithTools({
            model: m as unknown as Parameters<typeof provider.chatWithTools>[0]['model'],
            messages: currentMessages,
            tools: activeTools,
            toolChoice: iterationToolChoice,
            temperature: 0.7,
            maxTokens: 4096,
          }),
          `tool-call-iteration-${iterationCount}`
        );
        modelUsed = model;

        // If no tool calls, check if required tools are still pending (phase-aware)
        if (!response.toolCalls || response.toolCalls.length === 0) {
          const firedToolSet = new Set(toolsExecuted);

          // Find the earliest incomplete phase
          let currentPhase = 0;
          const pendingByPhase: string[] = [];

          for (const [phase, tools] of [...phasedPlan.entries()].sort(([a], [b]) => a - b)) {
            const phaseIncomplete: string[] = [];
            for (const tool of tools) {
              if (!firedToolSet.has(tool)) {
                phaseIncomplete.push(tool);
              }
            }
            if (phaseIncomplete.length > 0 && currentPhase === 0) {
              currentPhase = phase;
              pendingByPhase.push(...phaseIncomplete);
            }
          }

          // Phase nudging is for ACTION/strategic missions only — it forces
          // Jasper to march through every regex-suggested phase tool. For
          // factual reads, the LLM already has its answer after one tool call;
          // nudging it to "complete phase 1" makes it call extra tools the
          // user never asked for (Apr 22 bug Z: forced scan_leads → wrote 25
          // unwanted leads to CRM). Per the principle "Jasper's only job is
          // intent interpretation," let the LLM finish answering when it's
          // done — don't keep poking it with phase reminders.
          const allowNudge = !isNonActionQuery && queryClassification.queryType !== 'factual';
          if (pendingByPhase.length > 0 && pendingToolReminders < MAX_REMINDERS && allowNudge) {
            pendingToolReminders++;
            const phaseLabels: Record<number, string> = {
              1: 'Research & Discovery',
              2: 'Analysis',
              3: 'Content Creation',
              4: 'Outreach',
            };
            const phaseLabel = phaseLabels[currentPhase] ?? `Phase ${currentPhase}`;

            logger.info('[Jasper] Phase incomplete — nudging model', {
              phase: currentPhase,
              phaseLabel,
              pendingTools: pendingByPhase,
              reminder: pendingToolReminders,
              iteration: iterationCount,
            });

            // Save assistant text, then inject phase-specific nudge
            currentMessages.push({
              role: 'assistant',
              content: response.content || '',
            });
            currentMessages.push({
              role: 'user',
              content: `SYSTEM: Phase ${currentPhase} (${phaseLabel}) is NOT complete. You must call these tools before moving on: ${pendingByPhase.join(', ')}. The user explicitly requested these. Call them NOW.`,
            });

            // Continue the main loop — next iteration will force tool use
            // because shouldForceTools is false but we override below
            continue;
          }

          // All phases complete or max reminders reached — return text response
          logger.info('[Jasper] Returning text response', {
            iteration: iterationCount,
            model: modelUsed,
            finishReason: response.finishReason,
            responsePreview: response.content.slice(0, 200),
            pendingToolsRemaining: pendingByPhase,
            totalToolsExecuted: toolsExecuted.length,
          });
          finalResponse = response.content;
          break;
        }

        // Execute the tool calls
        const iterationStartMs = Date.now();
        logger.info(`[RequestTrace] ── Iteration ${iterationCount}: executing ${response.toolCalls.length} tool(s)`, {
          traceId,
          iteration: iterationCount,
          tools: response.toolCalls.map((tc: ToolCall) => tc.function.name),
          toolChoice: typeof iterationToolChoice === 'string' ? iterationToolChoice : `force:${iterationToolChoice.function.name}`,
        });

        // Create mission BEFORE tools execute so steps can write to it.
        // SKIP this for propose_mission_plan — that tool creates its own
        // mission with PLAN_PENDING_APPROVAL status and pre-filled steps.
        // Creating an empty IN_PROGRESS mission first causes a race
        // condition where Mission Control loads the empty version before
        // the plan version lands.
        //
        // ALSO SKIP for read-class queries (factual/advisory/conversational).
        // A user asking "what leads do we have" should never manufacture an
        // orphan mission just because Jasper called scan_leads to look.
        // Only action/strategic queries — where the user actually committed
        // to having work done — should create missions (Apr 22 bug AA).
        const isReadClassQuery = queryClassification.queryType === 'factual'
          || queryClassification.queryType === 'advisory'
          || queryClassification.queryType === 'conversational';
        const isPlanProposal = response.toolCalls.some((tc: ToolCall) => tc.function.name === 'propose_mission_plan');
        if (!missionCreated && !isPlanProposal && !isReadClassQuery && response.toolCalls.some((tc: ToolCall) => missionTriggerTools.includes(tc.function.name))) {
          const now = new Date().toISOString();
          const titleSnippet = message.slice(0, 80) + (message.length > 80 ? '...' : '');
          try {
            await createMission({
              missionId,
              conversationId,
              status: 'IN_PROGRESS',
              title: titleSnippet,
              userPrompt: message,
              steps: [],
              createdAt: now,
              updatedAt: now,
            });
            missionCreated = true;
          } catch (err: unknown) {
            logger.warn('[Jasper] Mission creation failed (non-blocking)', {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        const toolResults = await executeToolCalls(response.toolCalls, missionContext);
        allToolResults.push(...toolResults);
        toolsExecuted.push(...response.toolCalls.map((tc: ToolCall) => tc.function.name));

        // Add assistant message with tool calls
        currentMessages.push({
          role: 'assistant',
          content: response.content || '',
          tool_calls: response.toolCalls,
        });

        // Add tool results and extract reviewLink
        for (const result of toolResults) {
          currentMessages.push({
            role: 'tool',
            content: result.content,
            tool_call_id: result.tool_call_id,
          });

          // Extract reviewLink from tool result JSON (if present)
          try {
            const parsed = JSON.parse(result.content) as Record<string, unknown>;
            if (typeof parsed.reviewLink === 'string' && parsed.reviewLink) {
              lastReviewLink = parsed.reviewLink;
            }
          } catch {
            // Not JSON or no reviewLink — skip
          }
        }

        // Log iteration summary
        const iterDurationMs = Date.now() - iterationStartMs;
        const iterToolNames = response.toolCalls.map((tc: ToolCall) => tc.function.name);
        const iterResultStatuses = toolResults.map(r => {
          try {
            const p = JSON.parse(r.content) as Record<string, unknown>;
            return (typeof p.error === 'string' && p.error.length > 0) ? 'ERROR' : 'OK';
          } catch { return 'OK'; }
        });
        logger.info(`[RequestTrace] ── Iteration ${iterationCount} complete: ${iterDurationMs}ms`, {
          traceId,
          iteration: iterationCount,
          durationMs: iterDurationMs,
          toolResults: iterToolNames.map((name, i) => `${name}:${iterResultStatuses[i]}`),
          totalToolsExecutedSoFar: toolsExecuted.length,
        });

        // M4: if Jasper drafted a plan, end the chat turn here. The
        // operator must approve the plan in Mission Control before any
        // execution happens. We do NOT continue the tool loop because
        // (a) the operator hasn't seen the plan yet, and (b) Jasper's
        // own instructions tell him to stop after proposing.
        if (iterToolNames.includes('propose_mission_plan')) {
          planDrafted = true;
          finalResponse =
            `Plan drafted. ${response.toolCalls.length > 1 ? 'Note: I had to discard the other tool calls in this turn — only the plan was saved. ' : ''}` +
            `Open Mission Control to review the steps, edit anything you want changed, and click approve when ready. ` +
            `${lastReviewLink ?? `/mission-control?mission=${missionId}`}`;
          break;
        }

        // If this was the last iteration, force a response
        if (iterationCount >= maxIterations) {
          const { result: finalAttempt, model: finalModel } = await chatWithFallback<ChatCompletionResponse>(
            modelsToTry,
            (m) => provider.chatWithTools({
              model: m as unknown as Parameters<typeof provider.chatWithTools>[0]['model'],
              messages: currentMessages,
              tools: JASPER_TOOLS,
              toolChoice: 'none', // Force text response
              temperature: 0.7,
              maxTokens: 4096,
            }),
            'final-forced-response'
          );
          modelUsed = finalModel;
          finalResponse = finalAttempt.content;
        }
      }

      // Fallback if somehow no response was set — summarize what tools ran
      if (!finalResponse) {
        if (toolsExecuted.length > 0) {
          finalResponse = `Done — executed ${toolsExecuted.length} tools (${toolsExecuted.join(', ')}). ${lastReviewLink ? `Review results here: ${lastReviewLink}` : 'Check Mission Control for details.'}`;
        } else {
          finalResponse = 'Something went wrong — no tools were called. Try rephrasing your request.';
        }
      }
    } else {
      // Standard chat without tools for conversational queries
      const { result: response, model } = await chatWithFallback<ChatCompletionResponse>(
        modelsToTry,
        (m) => provider.chat({
          model: m as unknown as Parameters<typeof provider.chat>[0]['model'],
          messages: messages as Parameters<typeof provider.chat>[0]['messages'],
          temperature: 0.7,
          maxTokens: 2048,
        }),
        'standard-chat'
      );
      modelUsed = model;
      finalResponse = response.content;
    }

    const responseTime = Date.now() - startTime;

    // Finalize mission — derive status from in-memory tool results (avoids Firestore race condition
    // caused by fire-and-forget trackMissionStep writes that may not have landed yet).
    //
    // M4: skip finalization entirely when Jasper drafted a plan — the
    // mission is in PLAN_PENDING_APPROVAL status and execution will be
    // kicked off later when the operator approves the plan. Marking it
    // COMPLETED here would lose the plan.
    if (missionCreated && !planDrafted) {
      try {
        let missionStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED';

        if (allToolResults.length > 0) {
          // A result is considered failed when its JSON content contains a top-level "error" key.
          // This is the uniform contract used by every error path in executeToolCall, including
          // the outer catch-all. Results without a parseable "error" key are treated as successful.
          const allResultsFailed = allToolResults.every((r) => {
            try {
              const parsed = JSON.parse(r.content) as Record<string, unknown>;
              return typeof parsed.error === 'string' && parsed.error.length > 0;
            } catch {
              // Non-JSON content is not an error signal — treat as success
              return false;
            }
          });

          if (allResultsFailed) {
            missionStatus = 'FAILED';
          }
        }

        await finalizeMission(missionId, missionStatus);
      } catch (err: unknown) {
        logger.warn('[Jasper] Mission finalization failed (non-blocking)', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // POST-LOOP ENFORCEMENT: Failure acknowledgment + Mission Control link
    //
    // The LLM may narrate success even when tools failed (hallucination).
    // Code-level enforcement: scan results for errors and append a truthful
    // summary that the LLM cannot override.
    // ═══════════════════════════════════════════════════════════════════════
    if (toolsExecuted.length > 0) {
      // Identify failed tools from results
      const failedTools: string[] = [];
      for (let i = 0; i < allToolResults.length; i++) {
        try {
          const parsed = JSON.parse(allToolResults[i].content) as Record<string, unknown>;
          if (typeof parsed.error === 'string' && parsed.error.length > 0) {
            failedTools.push(`${toolsExecuted[i]}: ${parsed.error}`);
          }
        } catch {
          // Non-JSON — not an error
        }
      }

      // Append failure notice if any tools errored
      if (failedTools.length > 0) {
        finalResponse += `\n\n---\n**⚠ ${failedTools.length} task(s) did not complete:**\n${failedTools.map(f => `- ${f}`).join('\n')}\n\nYou can retry these individually or ask me to try again.`;
        logger.warn('[Jasper] Appended failure notice to response', { failedTools });
      }

      // Always append Mission Control link when a mission was created
      if (missionCreated) {
        finalResponse += `\n\n📋 **[View full mission details in Mission Control](/mission-control)**`;
      }
    }

    // Log the interaction for analytics
    logger.info(`[RequestTrace] ═══════════════════════════════════════════`, {
      traceId,
      event: 'REQUEST_COMPLETE',
      totalDurationMs: responseTime,
      model: modelUsed,
      modelFallbackOccurred: modelUsed !== selectedModel,
      queryType: queryClassification.queryType,
      toolsExecutedCount: toolsExecuted.length,
      toolsExecuted: toolsExecuted.length > 0 ? toolsExecuted : undefined,
      missionId: missionCreated ? missionId : undefined,
      reviewLink: lastReviewLink,
      responsePreview: finalResponse.slice(0, 200),
    });

    // Optionally persist to Firestore for long-term memory
    try {
      await persistConversation(context, message, finalResponse, modelUsed);
    } catch (error) {
      logger.warn('[Jasper] Failed to persist conversation', { error: error instanceof Error ? error.message : String(error) });
    }

    // Generate voice output if enabled
    let audioOutput: OrchestratorChatResponse['audio'];

    if (voiceEnabled && finalResponse) {
      try {
        const ttsResponse = await VoiceEngineFactory.getAudio({
          text: finalResponse,
          engine: ttsEngine,
          voiceId: voiceId,
        });

        audioOutput = {
          data: ttsResponse.audio,
          format: ttsResponse.format,
          durationSeconds: ttsResponse.durationSeconds,
        };

        logger.info('[Jasper] TTS generated', {
          engine: ttsResponse.engine,
          durationSeconds: ttsResponse.durationSeconds,
          charactersUsed: ttsResponse.charactersUsed,
        });
      } catch (ttsError) {
        logger.warn('[Jasper] TTS generation failed', { error: ttsError instanceof Error ? ttsError.message : String(ttsError) });
        // Continue without audio - don't fail the whole request
      }
    }

    const responseData: OrchestratorChatResponse = {
      success: true,
      response: finalResponse,
      metadata: {
        model: modelUsed,
        responseTime,
        toolExecuted: toolsExecuted.length > 0 ? toolsExecuted.join(', ') : undefined,
        missionId: missionCreated ? missionId : undefined,
        reviewLink: lastReviewLink,
      },
      audio: audioOutput,
    };

    // Log if fallback occurred for monitoring
    if (modelUsed !== selectedModel) {
      logger.info(`[Jasper] Model fallback: ${selectedModel} → ${modelUsed}`);
    }

    return NextResponse.json(responseData);
  } catch (error: unknown) {
    const structuredError = error as StructuredError;

    // Parse OpenRouter-specific error details
    const parsedError = parseOpenRouterError(structuredError as Error);
    let openRouterDetails: OpenRouterErrorDetails | undefined;

    if (parsedError) {
      try {
        const errorJson = JSON.parse(parsedError.errorBody) as OpenRouterErrorBody;
        openRouterDetails = {
          statusCode: parsedError.statusCode,
          code: errorJson.error?.code,
          message: errorJson.error?.message,
          provider: errorJson.error?.metadata?.provider_name,
        };
      } catch {
        openRouterDetails = {
          statusCode: parsedError.statusCode,
          rawBody: parsedError.errorBody.slice(0, 500),
        };
      }
    }

    // Log the FULL error to the terminal for debugging
    logger.error('[Jasper] OpenRouter API FAILED', structuredError instanceof Error ? structuredError : new Error(String(structuredError)), {
      message: structuredError.message,
      openRouterDetails: openRouterDetails ? JSON.stringify(openRouterDetails) : undefined,
      stack: structuredError.stack,
      name: structuredError.name,
      cause: structuredError.cause ? String(structuredError.cause) : undefined,
    });
    logger.error('[Jasper] Chat error', structuredError instanceof Error ? structuredError : new Error(String(structuredError)), {
      route: '/api/orchestrator/chat',
      openRouterDetails: openRouterDetails ? JSON.stringify(openRouterDetails) : undefined,
    });

    // Return structured error response
    return NextResponse.json(
      {
        success: false,
        error: structuredError.message ?? 'Unknown API error',
        errorDetails: {
          name: structuredError.name,
          openRouter: openRouterDetails,
          stack: process.env.NODE_ENV === 'development' ? structuredError.stack : undefined,
        },
      },
      { status: openRouterDetails?.statusCode ?? 500 }
    );
  }
}

/**
 * Feature-to-API-key mapping.
 * Maps each user-facing capability to the API key(s) it requires.
 * Jasper uses this to know what's ready vs what needs setup.
 */
interface ServiceCheck {
  label: string;
  capability: string;
  /** Short setup instructions Jasper can relay to the user when the key is missing */
  setupGuide?: string;
}

const SERVICE_CAPABILITY_MAP: Record<string, ServiceCheck> = {
  openrouter:   { label: 'OpenRouter (AI models)',         capability: 'AI chat, content generation, analysis', setupGuide: 'Go to openrouter.ai/keys, create an account, generate an API key, and paste it in Settings > API Keys under "OpenRouter".' },
  openai:       { label: 'OpenAI',                         capability: 'GPT models, vision analysis', setupGuide: 'Go to platform.openai.com/api-keys, sign in, click "Create new secret key", copy it, and paste in Settings > API Keys under "OpenAI".' },
  anthropic:    { label: 'Anthropic Claude',               capability: 'Claude models', setupGuide: 'Go to console.anthropic.com/settings/keys, create a key, and paste it in Settings > API Keys under "Anthropic".' },
  gemini:       { label: 'Google Gemini',                  capability: 'Gemini models, multimodal', setupGuide: 'Go to aistudio.google.com/apikey, create a Gemini API key, and paste it in Settings > API Keys under "Gemini".' },
  stripe:       { label: 'Stripe',                         capability: 'Payment processing, subscriptions', setupGuide: 'Go to dashboard.stripe.com/apikeys. Copy both the Publishable key (pk_) and Secret key (sk_) and paste them in Settings > API Keys under "Stripe".' },
  paypal:       { label: 'PayPal',                         capability: 'PayPal checkout', setupGuide: 'Go to developer.paypal.com/dashboard/applications, create a REST API app, and copy the Client ID into Settings > API Keys under "PayPal".' },
  square:       { label: 'Square',                         capability: 'Square payments', setupGuide: 'Go to developer.squareup.com, create an application, copy the Access Token, and paste it in Settings > API Keys under "Square".' },
  sendgrid:     { label: 'SendGrid',                       capability: 'Email campaigns, transactional email', setupGuide: 'Go to app.sendgrid.com/settings/api_keys, click "Create API Key", select "Full Access", copy the key, and paste it in Settings > API Keys under "SendGrid".' },
  resend:       { label: 'Resend',                         capability: 'Email delivery', setupGuide: 'Go to resend.com/api-keys, generate a key, and paste it in Settings > API Keys under "Resend".' },
  twilio:       { label: 'Twilio',                         capability: 'Voice calls, SMS messaging', setupGuide: 'Go to console.twilio.com. Copy your Account SID and Auth Token from the dashboard, buy a phone number, and add all three in Settings > API Keys under "Twilio".' },
  telnyx:       { label: 'Telnyx',                         capability: 'Voice calls, SMS (cost-effective)', setupGuide: 'Go to portal.telnyx.com, create an API key under Auth, buy a number, and add them in Settings > API Keys under "Telnyx".' },
  bandwidth:    { label: 'Bandwidth',                      capability: 'Voice calls, SMS', setupGuide: 'Go to app.bandwidth.com, get your Account ID and API credentials, and add them in Settings > API Keys under "Bandwidth".' },
  vonage:       { label: 'Vonage',                         capability: 'Voice calls, SMS', setupGuide: 'Go to dashboard.nexmo.com, copy your API Key and Secret, and paste them in Settings > API Keys under "Vonage".' },
  hedra:        { label: 'Hedra',                          capability: 'AI avatar video generation', setupGuide: 'Go to hedra.com/api-profile, sign up, generate an API key, and paste it in Settings > API Keys under "Hedra".' },
  kling:        { label: 'Kling',                          capability: 'Cinematic video generation', setupGuide: 'Go to klingai.com, get your Access Key and Secret Key from your account settings, and add them in Settings > API Keys under "Kling".' },
  fal:          { label: 'Fal.ai',                         capability: 'Image generation (Flux, SDXL)', setupGuide: 'Go to fal.ai/dashboard/keys, create an API key, and paste it in Settings > API Keys under "Fal.ai".' },
  'google-ai-studio': { label: 'Google AI Studio (Imagen)', capability: 'Photorealistic image generation', setupGuide: 'Go to aistudio.google.com/apikey, create a key with Imagen access, and add it in Settings > API Keys under "Google AI Studio".' },
  elevenlabs:   { label: 'ElevenLabs',                     capability: 'Voice AI, text-to-speech', setupGuide: 'Go to elevenlabs.io/app/settings/api-keys, generate a key, and paste it in Settings > API Keys under "ElevenLabs".' },
  deepgram:     { label: 'Deepgram',                       capability: 'Speech-to-text transcription', setupGuide: 'Go to console.deepgram.com, create a project, generate an API key, and paste it in Settings > API Keys under "Deepgram".' },
  apollo:       { label: 'Apollo.io',                      capability: 'Lead enrichment, prospect data', setupGuide: 'Go to app.apollo.io/settings/integrations/api, copy your API key, and paste it in Settings > API Keys under "Apollo".' },
  clearbit:     { label: 'Clearbit',                       capability: 'Company enrichment data', setupGuide: 'Go to dashboard.clearbit.com/api, copy your API key, and add it in Settings > API Keys under "Clearbit".' },
  serper:       { label: 'Serper',                         capability: 'SEO research, Google search data', setupGuide: 'Go to serper.dev/api-key, sign up, copy your key, and paste it in Settings > API Keys under "Serper".' },
  dataforseo:   { label: 'DataForSEO',                     capability: 'Keyword rankings, SERP data', setupGuide: 'Go to app.dataforseo.com/api-dashboard, copy your login and password, and add them in Settings > API Keys under "DataForSEO".' },
  twitter:      { label: 'Twitter/X',                      capability: 'Social posting, analytics', setupGuide: 'Go to developer.x.com, create a project/app, get your API Key, Secret, and Bearer Token, and add them in Settings > API Keys under "Twitter/X".' },
  linkedin:     { label: 'LinkedIn',                       capability: 'Social posting, networking', setupGuide: 'Go to linkedin.com/developers, create an app, get your Client ID and Secret, and add them in Settings > API Keys under "LinkedIn".' },
  slack:        { label: 'Slack',                          capability: 'Team notifications', setupGuide: 'Go to api.slack.com/apps, create an app, add an Incoming Webhook, copy the URL, and paste it in Settings > API Keys under "Slack".' },
  googleCloud:  { label: 'Google Cloud',                   capability: 'AI fine-tuning, cloud storage', setupGuide: 'Go to console.cloud.google.com. Create a project, enable Vertex AI + Cloud Storage APIs, create a service account, download the JSON key, and add the project ID + key in Settings > API Keys under "Google Cloud".' },
  minimax:      { label: 'MiniMax',                        capability: 'AI music generation', setupGuide: 'Go to minimaxi.com, sign up, get your API key from account settings, and paste it in Settings > API Keys under "MiniMax".' },
  shopify:      { label: 'Shopify',                        capability: 'E-commerce catalog sync', setupGuide: 'In your Shopify admin, go to Settings > Apps > Develop apps, create a custom app with product read permissions, copy the Access Token, and add it with your shop domain in Settings > API Keys under "Shopify".' },
  woocommerce:  { label: 'WooCommerce',                    capability: 'E-commerce catalog sync', setupGuide: 'In your WordPress admin, go to WooCommerce > Settings > Advanced > REST API, create a key with Read access, and add the Consumer Key, Secret, and site URL in Settings > API Keys under "WooCommerce".' },
};

/**
 * Check which API keys are configured and build a context block for Jasper.
 * This gives Jasper proactive awareness of what tools will work vs what needs
 * setup, so he can guide users instead of failing reactively.
 */
async function getConfigurationContext(): Promise<string> {
  const { apiKeyService } = await import('@/lib/api-keys/api-key-service');

  const configured: string[] = [];
  const notConfigured: string[] = [];

  for (const [service, info] of Object.entries(SERVICE_CAPABILITY_MAP)) {
    try {
      const isReady = await apiKeyService.isServiceConfigured(service as Parameters<typeof apiKeyService.isServiceConfigured>[0]);
      if (isReady) {
        configured.push(`- ${info.label}: ✓ READY (${info.capability})`);
      } else {
        const guide = info.setupGuide ? `\n    Setup: ${info.setupGuide}` : '';
        notConfigured.push(`- ${info.label}: ✗ NOT SET UP → needed for: ${info.capability}${guide}`);
      }
    } catch {
      // Skip services that error during check
    }
  }

  // Don't inject if nothing to report
  if (configured.length === 0 && notConfigured.length === 0) {
    return '';
  }

  let block = `
═══════════════════════════════════════════════════════════════════════════════
API & INTEGRATION CONFIGURATION STATUS (Live from Firestore)
═══════════════════════════════════════════════════════════════════════════════

`;

  if (configured.length > 0) {
    block += `READY TO USE (${configured.length} services):
${configured.join('\n')}

`;
  }

  if (notConfigured.length > 0) {
    block += `NOT YET CONFIGURED (${notConfigured.length} services):
${notConfigured.join('\n')}

`;
  }

  block += `RULES FOR CONFIGURATION:
- ALWAYS call tools immediately when the user asks. Do NOT warn about unconfigured services before trying.
- If a tool FAILS because a service is not configured, THEN tell the user what's needed and how to set it up.
- Use the "Setup:" instructions above ONLY after a tool returns a configuration error.
- Never refuse to act based on the status list above — it is informational, not a gate.
- When ALL required services for a task are ready, proceed immediately without mentioning configuration.

═══════════════════════════════════════════════════════════════════════════════
`;

  return block;
}

/**
 * Build enhanced system prompt with real-time context
 */
function buildEnhancedSystemPrompt(
  basePrompt: string,
  context: 'admin' | 'merchant',
  adminStats?: OrchestratorChatRequest['adminStats'],
  merchantInfo?: OrchestratorChatRequest['merchantInfo'],
  enabledModules?: string[] | null,
  configurationContext?: string
): string {
  const timestamp = new Date().toISOString();

  let contextBlock = '';

  if (context === 'admin' && adminStats) {
    contextBlock = `
═══════════════════════════════════════════════════════════════════════════════
LIVE PLATFORM STATE (Updated: ${timestamp})
═══════════════════════════════════════════════════════════════════════════════

VERIFIED METRICS - USE THESE EXACT NUMBERS:
- Total Organizations: ${adminStats.totalOrgs}
- Active AI Agents: ${adminStats.activeAgents}
- Pending Support Tickets: ${adminStats.pendingTickets}
${adminStats.trialOrgs !== undefined ? `- Trial Organizations: ${adminStats.trialOrgs}` : ''}

RESPONSE RULES FOR DATA QUERIES:
When asked "how many organizations" or any count/total question:
→ Respond immediately with the exact number above
→ DO NOT deflect, suggest alternatives, or offer menus
→ Example: "I see ${adminStats.totalOrgs} organizations active right now."

═══════════════════════════════════════════════════════════════════════════════
BACKGROUND CAPABILITIES (YOUR AGENT TEAMS — DELEGATE TO THEM)
═══════════════════════════════════════════════════════════════════════════════

You command a ${getAgentCount()}-agent AI swarm across ${getDomainCount()} domains. You DELEGATE all work to them:
- NEVER mention tool names, agent names, or specialist names to the user
- ALWAYS delegate via tools, then tell David what you've tasked the team to do
- ALWAYS include a link to the page where David can review the completed work
- Example: Say "I've got the team researching that now — I'll update you when it's ready at /seo"
- Example: Say "The content team is drafting that video. Review it here: /content/video"

MULTI-STEP TASK PROTOCOL:
When a request requires multiple steps (research + content, analysis + action):
1. Break down the task explicitly — "I'm assigning two tasks:"
2. List each sub-task with what team/specialist handles it
3. Include a review link for EACH sub-task in your response
4. NEVER say "building..." or "working on..." without specifying WHAT is being built
5. Example: "I've assigned two tasks:
   - **Market Research**: The intelligence team is analyzing your target demographic → [Review in Mission Control](/mission-control)
   - **Video Creation**: The content team is drafting a video storyboard → [Review & Approve Video](/mission-control)"

APPROVAL WORKFLOW:
- When creating content (videos, emails, social posts), you create DRAFTS for review
- Tell the user to review and approve before anything executes or renders
- Include the review link so they can go straight to the approval page
- NEVER imply that content is already being rendered or sent — it's a DRAFT until approved

Your 16 operational systems (speak as your own actions):
1. CRM — Contact/deal management, pipeline tracking, deal health scoring, duplicate detection
2. Lead Generation — AI scoring (0-100), enrichment, nurture sequences, web scraping, research
3. Email & Campaigns — SendGrid/Resend/SMTP, campaign management, open/click tracking
4. Social Media — Twitter/X + LinkedIn posting, scheduling, approvals, social listening, AI coaching
5. E-Commerce — Stripe/PayPal/Square checkout, subscriptions, product catalog, coupons, orders
6. Website Builder — Page editor, blog, templates, custom domains, sitemap, AI content
7. Voice AI — Twilio calls, ElevenLabs/Unreal Speech TTS, Gemini conversation, prospector/closer modes
8. Video Generation — Kling Avatar/Runway ML, storyboard pipeline, Brand DNA integration
9. SEO — Domain analysis, Google Search Console, keyword tracking, AI strategy
10. Workflows — Visual builder, triggers (scheduled/webhook/entity), 11 action types
11. Forms — Builder, publishing, submission analytics, CRM lead creation
12. Analytics — Revenue, pipeline, forecasting, attribution, e-commerce, lead scoring
13. Brand DNA — Central identity system feeding all AI agents and content tools
14. Calendar — Google Calendar + Outlook, meeting scheduler
15. SMS — Twilio + Vonage messaging
16. Integrations — Google, Microsoft, Slack, HubSpot, Zoom, QuickBooks, Xero, Shopify

═══════════════════════════════════════════════════════════════════════════════
`;
  } else if (context === 'merchant' && merchantInfo) {
    contextBlock = `
═══════════════════════════════════════════════════════════════════════════════
MERCHANT CONTEXT (Updated: ${timestamp})
═══════════════════════════════════════════════════════════════════════════════

Business: ${merchantInfo.companyName ?? 'Not specified'}
Industry: ${merchantInfo.industry ?? 'General'}
Owner: ${merchantInfo.ownerName ?? 'Business Owner'}

You are this business's dedicated operations partner. Speak with authority
about their specific industry and business context.

═══════════════════════════════════════════════════════════════════════════════
`;
  }

  // Build feature awareness block
  let featureBlock = '';
  if (enabledModules && enabledModules.length > 0) {
    const MODULE_LABELS: Record<string, string> = {
      crm_pipeline: 'CRM & Pipeline',
      sales_automation: 'Sales Automation',
      email_outreach: 'Email & Campaigns',
      social_media: 'Social Media',
      storefront: 'Online Storefront',
      website_builder: 'Website Builder',
      video_production: 'Video Production',
      forms_surveys: 'Forms & Surveys',
      proposals_docs: 'Proposals & Documents',
      advanced_analytics: 'Advanced Analytics',
      workflows: 'Workflows & Automation',
      conversations: 'Conversations & Chat',
    };

    const ALL_MODULES = Object.keys(MODULE_LABELS);
    const disabledModules = ALL_MODULES.filter((m) => !enabledModules.includes(m));

    featureBlock = `
═══════════════════════════════════════════════════════════════════════════════
ACTIVE FEATURE MODULES (Client Configuration)
═══════════════════════════════════════════════════════════════════════════════

ENABLED: ${enabledModules.map((m) => MODULE_LABELS[m] ?? m).join(', ')}
${disabledModules.length > 0 ? `DISABLED: ${disabledModules.map((m) => MODULE_LABELS[m] ?? m).join(', ')}` : ''}

RULES:
- Only suggest, promote, or delegate to ENABLED features
- Do NOT mention, recommend, or push DISABLED features
- If the user asks about a disabled feature, explain it can be enabled in Settings > Features
- Tailor your advice and tool usage to the enabled feature set

═══════════════════════════════════════════════════════════════════════════════
`;
  }

  return `${basePrompt}

${contextBlock}
${featureBlock}
${configurationContext ?? ''}
═══════════════════════════════════════════════════════════════════════════════
ABSOLUTE RULES - VIOLATIONS ARE UNACCEPTABLE
═══════════════════════════════════════════════════════════════════════════════

1. NEVER say "I'll have [Agent/Specialist] help with that"
2. NEVER present bulleted option menus or numbered lists of options
3. NEVER say "Say 'X' to do Y"
4. NEVER ask for permission on routine operations - delegate and report
5. ALWAYS speak as yourself - "I've put the team on it" not "The system is..."
6. When asked for data, STATE THE DATA. Don't offer ways to ask for it.
7. Keep responses conversational, not robotic
8. Use markdown sparingly - only for emphasis, not structure in short responses
9. NEVER do work yourself - ALWAYS delegate to agent teams via tools
10. ALWAYS include the reviewLink from tool responses as a clickable markdown link.
    Tool responses contain a "reviewLink" field (e.g. "/video", "/website/blog").
    You MUST render it as: [Review it here](/video) — never say "at the link provided"
11. When David asks you to create/research/build/analyze anything, call the
    delegation tool FIRST, then report what you delegated and include the reviewLink
12. Treat EVERY request as a delegation command — you are a commander, not a worker
13. NEVER say "Would you like me to..." — just DO it or report what you DID
14. NEVER say "I apologize" — diagnose and fix instead
15. CONVERSATIONAL MODE: When David wants to brainstorm, discuss ideas, think through
    options, or have a conversation — TALK to him naturally. Do NOT call tools. Do NOT
    create anything. Do NOT delegate. Just have the conversation like a smart colleague
    would. Only call tools when David explicitly asks you to CREATE or PRODUCE something.
16. NEVER lie about what you did. If you called a tool and created something, own it.
    If you didn't call a tool, don't pretend you did. Tool data is the only source of truth.
17. TOOL ROUTING — CRITICAL: When a user request includes BOTH content creation AND
    research/leads/outreach tasks, you MUST call MULTIPLE tools. There is no single
    combined tool — each department gets its own delegation, and they run in parallel
    because no department's output feeds another's input:
    - delegate_to_content — for blog, video script, email copy, landing page copy
    - delegate_to_marketing — for social posts and channel promotion
    - delegate_to_intelligence — for competitor research, trends, scraping
    - scan_leads — for finding new lead prospects
    - enrich_lead — for enriching existing leads with data
    - score_leads — for scoring leads
    - draft_outreach_email — for personalized cold outreach emails
    - get_seo_config — for pulling SEO configuration
    - research_competitors — for competitive intelligence
    - research_trending_topics — for trending topic discovery
    Call ALL relevant tools in your first response. Do NOT wait for one to finish
    before calling others. A 5-part request = 5+ tool calls, not 1.

═══════════════════════════════════════════════════════════════════════════════
ZERO-TOLERANCE ANTI-HALLUCINATION — READ THIS CAREFULLY
═══════════════════════════════════════════════════════════════════════════════

YOU MUST NEVER MAKE A FACTUAL CLAIM WITHOUT TOOL DATA TO BACK IT UP.

This means:
- NEVER say "APIs are not configured" unless a tool returned that exact error
- NEVER say "authentication is required" unless a tool told you so
- NEVER say "the system can't do X" unless you called a tool and it failed
- NEVER say "we need to connect/configure/set up X" unless a tool confirmed it's missing
- NEVER invent reasons for failure — report the EXACT error from the tool

IF A TOOL FAILS: Report the EXACT error message. Do not interpret, embellish, or guess.
IF A TOOL SUCCEEDS: Report the actual result. Do not add caveats that aren't in the data.
IF YOU DIDN'T CALL A TOOL: You have ZERO basis to make claims. Call the tool first.

WRONG: "The video APIs appear to be experiencing configuration issues"
RIGHT: [Call create_video tool, read the error] "Scene 1 failed with: Kling Avatar returned an error — check your fal.ai API key"

WRONG: "Unable to pull trending data due to incomplete API connections"
RIGHT: [Call research_trending_topics tool, read the error] "The Serper API key isn't configured in enrichment settings"

WRONG: "SEO page is in draft status and not indexing"
RIGHT: [Call get_seo_config tool, read the result] "No SEO settings document exists yet. We need to configure keywords at /settings/website"

You are FORBIDDEN from saying something is broken, misconfigured, unavailable,
or not working UNLESS you called the relevant tool and it returned an error.
Tool data is the ONLY source of truth. Your assumptions are ALWAYS wrong.

═══════════════════════════════════════════════════════════════════════════════
VOICE MODE OPTIMIZATION
═══════════════════════════════════════════════════════════════════════════════

Your responses may be spoken aloud via text-to-speech. Keep this in mind:
- Keep responses concise and natural-sounding
- Avoid excessive formatting that doesn't translate to speech
- Use natural pauses (periods, commas) for rhythm
- Numbers and data should be stated clearly
`;
}

/**
 * Persist conversation to Firestore for long-term memory
 */
async function persistConversation(
  context: 'admin' | 'merchant',
  userMessage: string,
  assistantResponse: string,
  modelUsed: string
): Promise<void> {
  const conversationId = `jasper_${context}`;
  const messageId = `msg_${Date.now()}`;

  const conversationsPath = getSubCollection('orchestratorConversations');

  await AdminFirestoreService.set(
    `${conversationsPath}/${conversationId}/messages`,
    messageId,
    {
      userMessage,
      assistantResponse,
      modelUsed,
      timestamp: new Date().toISOString(),
      context,
    },
    false
  );

  await AdminFirestoreService.set(
    conversationsPath,
    conversationId,
    {
      context,
      lastMessageAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastModelUsed: modelUsed,
    },
    true
  );
}

/**
 * GET endpoint to retrieve available models
 */
export function GET() {
  return NextResponse.json({
    success: true,
    defaultModel: DEFAULT_MODEL,
    models: AVAILABLE_MODELS,
  });
}
