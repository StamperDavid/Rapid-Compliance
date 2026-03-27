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
import { requireAuth } from '@/lib/auth/api-auth';

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
// Claude 3.5 Sonnet is the ONLY reliable model for 45+ tool calling via OpenRouter.
// Gemini 1.5 Pro was tested extensively and IGNORES tools, causing hallucinations.
// DO NOT change this without verifying tool calling works end-to-end.
const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';

// Fallback models — Claude models ONLY. Gemini does not reliably call tools.
const FALLBACK_MODELS = [
  'anthropic/claude-3-haiku',
];

// Available models for the orchestrator (not exported - use GET endpoint to fetch)
const AVAILABLE_MODELS = {
  // Recommended: Best tool-calling reliability with large tool sets
  'anthropic/claude-3.5-sonnet': { name: 'Claude 3.5 Sonnet', latency: 'medium', quality: 'ultra', recommended: true },
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
 * Try a chat request with model fallback on 404 errors and retry on network failures.
 *
 * Retry strategy:
 * - Network errors (fetch failed, timeout, DNS): retry up to MAX_RETRIES times with delay
 * - 404 (model not found): try next model in the fallback chain
 * - All other HTTP errors: throw immediately (no retry)
 */
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

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
  systemPrompt: z.string().min(1, 'systemPrompt is required'),
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

    // Authentication - Require valid Firebase ID token
    // Allow all authenticated users - admin vs merchant context determined below
    const authResult = await requireAuth(request);

    if (authResult instanceof NextResponse) {
      logger.error('[Jasper] Auth failed - no valid token', new Error('Auth failed - no valid token'), { file: 'orchestrator/chat/route.ts' });
      return authResult;
    }

    const { user } = authResult;

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
      systemPrompt,
      conversationHistory,
      adminStats,
      merchantInfo,
      modelId,
      voiceEnabled,
      voiceId,
      ttsEngine,
      requestId,
    } = parsedBody.data;

    // Determine model to use
    const selectedModel = modelId ?? DEFAULT_MODEL;

    // Validate model exists in our list or allow any OpenRouter model
    const isKnownModel = selectedModel in AVAILABLE_MODELS;
    if (!isKnownModel) {
      logger.info('[Jasper] Using custom model', { model: selectedModel });
    }

    // Classify the query to determine if state reflection is needed
    const queryClassification = SystemStateService.classifyQuery(message);
    logger.info('[Jasper] Query classified', {
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

    // Build the enhanced system prompt with real-time context
    const enhancedSystemPrompt = buildEnhancedSystemPrompt(
      systemPrompt,
      context,
      adminStats,
      merchantInfo,
      enabledModules,
      configContext
    );

    // For factual queries, inject verified state context
    let stateContext = '';
    if (queryClassification.requiresStateReflection) {
      stateContext = await SystemStateService.generateStateContext();
    }

    // Convert conversation history to provider format with tool support
    const messages: ChatMessage[] = [
      { role: 'system', content: enhancedSystemPrompt + stateContext },
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Initialize OpenRouter provider
    const provider = new OpenRouterProvider(PLATFORM_ID);

    const startTime = Date.now();

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

    // Mission tracking — derive missionId from client requestId when available.
    // This ensures retries with the same requestId reuse the same missionId,
    // preventing duplicate missions in Firestore (set() overwrites same doc).
    const missionId = requestId
      ? `mission_${requestId}`
      : `mission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const conversationId = `jasper_${context}`;
    const missionContext: ToolCallContext = { conversationId, missionId, userPrompt: message, userId: user.uid };
    let missionCreated = false;

    // Tools that trigger a live mission on Mission Control
    const missionTriggerTools = [
      'delegate_to_builder', 'delegate_to_sales', 'delegate_to_marketing',
      'delegate_to_agent', 'delegate_to_trust', 'delegate_to_content',
      'delegate_to_architect', 'delegate_to_outreach', 'delegate_to_intelligence',
      'delegate_to_commerce', 'create_video', 'generate_video', 'produce_video', 'assemble_video', 'generate_content',
      'scan_leads', 'enrich_lead', 'draft_outreach_email',
      'voice_agent', 'social_post', 'research_competitors',
    ];

    // Build model fallback chain: selected model + fallback models
    const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];

    logger.info('[Jasper] Tool configuration', {
      useTools,
      toolCount: JASPER_TOOLS.length,
      model: selectedModel,
      fallbacks: modelsToTry.slice(1),
    });

    if (useTools) {
      // TOOL-CALLING LOOP: Allows Jasper to query data before responding
      const currentMessages = [...messages];
      let iterationCount = 0;
      const maxIterations = 3; // Prevent infinite loops

      while (iterationCount < maxIterations) {
        iterationCount++;

        // Force tool use on the first iteration for ALL non-conversational queries.
        // Jasper must ALWAYS delegate — he never answers from training data.
        // Only pure conversational queries (greetings, yes/no, thanks) skip this.
        const isConversational = queryClassification.queryType === 'conversational';
        const shouldForceTools = iterationCount === 1 && !isConversational;
        const iterationToolChoice = shouldForceTools ? ('required' as const) : ('auto' as const);

        const { result: response, model } = await chatWithFallback<ChatCompletionResponse>(
          modelsToTry,
          (m) => provider.chatWithTools({
            model: m as unknown as Parameters<typeof provider.chatWithTools>[0]['model'],
            messages: currentMessages,
            tools: JASPER_TOOLS,
            toolChoice: iterationToolChoice,
            temperature: 0.7,
            maxTokens: 4096,
          }),
          `tool-call-iteration-${iterationCount}`
        );
        modelUsed = model;

        // If no tool calls, we have the final response
        if (!response.toolCalls || response.toolCalls.length === 0) {
          logger.info('[Jasper] No tool calls in iteration — returning text response', {
            iteration: iterationCount,
            model: modelUsed,
            finishReason: response.finishReason,
            responsePreview: response.content.slice(0, 200),
          });
          finalResponse = response.content;
          break;
        }

        // Execute the tool calls
        logger.info('[Jasper] Executing tool calls', {
          tools: response.toolCalls.map((tc: ToolCall) => tc.function.name),
          iteration: iterationCount,
        });

        // Create mission BEFORE tools execute so steps can write to it
        if (!missionCreated && response.toolCalls.some((tc: ToolCall) => missionTriggerTools.includes(tc.function.name))) {
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

      // Fallback if somehow no response was set
      if (!finalResponse) {
        finalResponse = 'I encountered an issue retrieving the data. Please try again.';
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
    if (missionCreated) {
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

    // Log the interaction for analytics
    logger.info('[Jasper] Chat completed via OpenRouter', {
      context,
      requestedModel: selectedModel,
      actualModel: modelUsed,
      modelFallbackOccurred: modelUsed !== selectedModel,
      messageLength: message.length,
      responseLength: finalResponse.length,
      responseTime,
      toolsUsed: useTools,
      toolsExecuted: toolsExecuted.length > 0 ? toolsExecuted : undefined,
      queryType: queryClassification.queryType,
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

  block += `RULES FOR CONFIGURATION AWARENESS:
- Before delegating work that needs an unconfigured service, tell the user what's needed
- Use the "Setup:" instructions above to walk the user through it step-by-step right in the conversation
- Example: "Email campaigns need SendGrid. Here's how to set it up: Go to app.sendgrid.com/settings/api_keys, click 'Create API Key'..."
- After giving steps, add: "Once you've pasted the key in [Settings > API Keys](/settings/api-keys), I'll take it from there."
- Do NOT repeatedly remind about services the user isn't trying to use
- If a feature works fine without a specific key (e.g., AI works via OpenRouter), don't nag about OpenAI/Anthropic
- When ALL required services for a task are ready, proceed immediately without mentioning configuration
- Keep setup guidance concise — 2-3 sentences max. Link to Settings > API Keys for the detailed page.

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
