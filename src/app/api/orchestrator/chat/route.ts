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
import { OpenRouterProvider, type ChatMessage, type ToolCall, type ChatCompletionResponse } from '@/lib/ai/openrouter-provider';
import { requireAuth } from '@/lib/auth/api-auth';

// Force dynamic rendering - required for Firebase Auth token verification
export const dynamic = 'force-dynamic';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { VoiceEngineFactory } from '@/lib/voice/tts/voice-engine-factory';
import { JASPER_TOOLS, executeToolCalls } from '@/lib/orchestrator/jasper-tools';
import { SystemStateService } from '@/lib/orchestrator/system-state-service';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

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

// Model configuration - can be overridden via environment variable
const DEFAULT_MODEL = process.env.JASPER_DEFAULT_MODEL ?? 'google/gemini-pro-1.5';

// Fallback models in priority order - tried sequentially if primary fails
const FALLBACK_MODELS = [
  'google/gemini-flash-1.5',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku',
];

// Available models for the orchestrator (not exported - use GET endpoint to fetch)
const AVAILABLE_MODELS = {
  // Fast conversational models (recommended for real-time chat)
  'google/gemini-pro-1.5': { name: 'Gemini 1.5 Pro', latency: 'medium', quality: 'ultra', recommended: true },
  'google/gemini-flash-1.5': { name: 'Gemini 1.5 Flash', latency: 'low', quality: 'high' },
  'anthropic/claude-3-haiku': { name: 'Claude 3 Haiku', latency: 'low', quality: 'high' },

  // Balanced models
  'anthropic/claude-3.5-sonnet': { name: 'Claude 3.5 Sonnet', latency: 'medium', quality: 'ultra' },
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
 * Try a chat request with model fallback on 404 errors
 */
async function chatWithFallback<T>(
  modelsToTry: string[],
  chatFn: (model: string) => Promise<T>,
  context: string
): Promise<{ result: T; model: string }> {
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const result = await chatFn(model);
      return { result, model };
    } catch (error: unknown) {
      const err = error as Error;
      const parsed = parseOpenRouterError(err);

      // Log the specific OpenRouter error for debugging
      logger.warn(`[Jasper] OpenRouter error for model ${model}`, {
        context,
        statusCode: parsed?.statusCode,
        errorBody: parsed?.errorBody?.slice(0, 500),
        rawMessage: err?.message,
      });

      // If 404 (model not found), try next model
      if (isModelNotFoundError(err)) {
        logger.warn(`[Jasper] Model ${model} returned 404, trying next fallback`, {
          model,
          fallbacksRemaining: modelsToTry.indexOf(model) < modelsToTry.length - 1,
        });
        lastError = err;
        continue;
      }

      // For other errors, throw immediately
      throw error;
    }
  }

  // All models failed
  throw lastError ?? new Error('All models failed');
}

interface OrchestratorChatRequest {
  message: string;
  context: 'admin' | 'merchant';
  systemPrompt: string;
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  adminStats?: {
    totalOrgs: number;
    activeAgents: number;
    pendingTickets: number;
    trialOrgs?: number;
  };
  merchantInfo?: {
    industry?: string;
    companyName?: string;
    ownerName?: string;
  };
  organizationId?: string;
  // Model selection
  modelId?: string;
  // Voice settings
  voiceEnabled?: boolean;
  voiceId?: string;
  ttsEngine?: 'native' | 'unreal' | 'elevenlabs';
}

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
      console.error('[Jasper] Auth failed - no valid token');
      return authResult;
    }

    const { user } = authResult;

    // Determine admin context based on role
    // admin gets full admin capabilities (tool calling, etc.)
    // user gets standard capabilities
    const isAdminContext = user.role === 'admin';

    logger.info('[Jasper] Authenticated', {
      uid: user.uid,
      email: user.email,
      role: user.role,
      isAdmin: isAdminContext,
    });

    // Parse request body
    const body = await request.json() as OrchestratorChatRequest;
    const {
      message,
      context,
      systemPrompt,
      conversationHistory,
      adminStats,
      merchantInfo,
      organizationId,
      modelId,
      voiceEnabled,
      voiceId,
      ttsEngine,
    } = body;

    if (!message || !systemPrompt) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: message, systemPrompt' },
        { status: 400 }
      );
    }

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

    // Build the enhanced system prompt with real-time context
    const enhancedSystemPrompt = buildEnhancedSystemPrompt(
      systemPrompt,
      context,
      adminStats,
      merchantInfo
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
    const orgId = organizationId ?? (isAdminContext ? 'admin' : DEFAULT_ORG_ID);
    const provider = new OpenRouterProvider(orgId);

    const startTime = Date.now();

    // Determine if we should enable tool calling
    // ALWAYS enable tools for admin context - Jasper needs full platform access
    // Tools are Jasper's PRIMARY interface to the platform (Anti-Hallucination Architecture)
    const useTools = isAdminContext; // Tools ALWAYS enabled for admin

    let finalResponse = '';
    const toolsExecuted: string[] = [];
    let modelUsed = selectedModel;

    // Build model fallback chain: selected model + fallback models
    const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];

    if (useTools) {
      // TOOL-CALLING LOOP: Allows Jasper to query data before responding
      const currentMessages = [...messages];
      let iterationCount = 0;
      const maxIterations = 3; // Prevent infinite loops

      while (iterationCount < maxIterations) {
        iterationCount++;

        const { result: response, model } = await chatWithFallback<ChatCompletionResponse>(
          modelsToTry,
          (m) => provider.chatWithTools({
            model: m as unknown as Parameters<typeof provider.chatWithTools>[0]['model'],
            messages: currentMessages,
            tools: JASPER_TOOLS,
            toolChoice: 'auto',
            temperature: 0.7,
            maxTokens: 4096,
          }),
          `tool-call-iteration-${iterationCount}`
        );
        modelUsed = model;

        // If no tool calls, we have the final response
        if (!response.toolCalls || response.toolCalls.length === 0) {
          finalResponse = response.content;
          break;
        }

        // Execute the tool calls
        logger.info('[Jasper] Executing tool calls', {
          tools: response.toolCalls.map((tc: ToolCall) => tc.function.name),
          iteration: iterationCount,
        });

        const toolResults = await executeToolCalls(response.toolCalls);
        toolsExecuted.push(...response.toolCalls.map((tc: ToolCall) => tc.function.name));

        // Add assistant message with tool calls
        currentMessages.push({
          role: 'assistant',
          content: response.content || '',
          tool_calls: response.toolCalls,
        });

        // Add tool results
        for (const result of toolResults) {
          currentMessages.push({
            role: 'tool',
            content: result.content,
            tool_call_id: result.tool_call_id,
          });
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
    if (organizationId) {
      try {
        await persistConversation(organizationId, context, message, finalResponse, modelUsed);
      } catch (error) {
        logger.warn('[Jasper] Failed to persist conversation', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Generate voice output if enabled
    let audioOutput: OrchestratorChatResponse['audio'];

    if (voiceEnabled && finalResponse) {
      try {
        const ttsResponse = await VoiceEngineFactory.getAudio({
          text: finalResponse,
          organizationId: orgId,
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
 * Build enhanced system prompt with real-time context
 */
function buildEnhancedSystemPrompt(
  basePrompt: string,
  context: 'admin' | 'merchant',
  adminStats?: OrchestratorChatRequest['adminStats'],
  merchantInfo?: OrchestratorChatRequest['merchantInfo']
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
BACKGROUND CAPABILITIES (YOUR INVISIBLE STAFF)
═══════════════════════════════════════════════════════════════════════════════

You have access to internal capabilities that execute in the background. When using them:
- NEVER mention tool names to the user
- ALWAYS speak as if YOU are doing the work
- Example: Say "I'm scanning for prospects now" NOT "I'll activate the lead_scan tool"

Available capabilities (speak as your own actions):
1. Lead scanning and prospect discovery
2. Outreach email drafting
3. Pipeline analysis
4. Content generation for social/marketing
5. Feature configuration status checks

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

  return `${basePrompt}

${contextBlock}

═══════════════════════════════════════════════════════════════════════════════
ABSOLUTE RULES - VIOLATIONS ARE UNACCEPTABLE
═══════════════════════════════════════════════════════════════════════════════

1. NEVER say "I'll have [Agent/Specialist] help with that"
2. NEVER present bulleted option menus
3. NEVER say "Say 'X' to do Y"
4. NEVER ask for permission on routine operations - execute and report
5. ALWAYS speak as yourself - "I'm working on..." not "The system is..."
6. When asked for data, STATE THE DATA. Don't offer ways to ask for it.
7. Keep responses conversational, not robotic
8. Use markdown sparingly - only for emphasis, not structure in short responses

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
  organizationId: string,
  context: 'admin' | 'merchant',
  userMessage: string,
  assistantResponse: string,
  modelUsed: string
): Promise<void> {
  const conversationId = `jasper_${context}`;
  const messageId = `msg_${Date.now()}`;

  const conversationsPath = `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/orchestratorConversations`;

  await FirestoreService.set(
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

  await FirestoreService.set(
    conversationsPath,
    conversationId,
    {
      organizationId,
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
