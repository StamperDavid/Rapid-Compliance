/**
 * Orchestrator Chat API - Jasper Brain Activation with OpenRouter
 *
 * This endpoint handles live AI calls for the Jasper orchestrator via OpenRouter,
 * enabling access to 100+ models including Gemini, Claude, GPT-4, and Llama.
 *
 * Features:
 * - OpenRouter API integration for multi-model support
 * - Model selection with default to google/gemini-2.0-flash-exp for fast conversational flow
 * - Conversation history for stateful memory
 * - ANTI-HALLUCINATION: Tool calling for verified data retrieval
 * - Real-time stats and context injection
 * - TTS voice synthesis integration
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OpenRouterProvider, type ChatMessage, type ToolCall } from '@/lib/ai/openrouter-provider';
import { requireRole } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { handleAPIError, errors } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { VoiceEngineFactory } from '@/lib/voice/tts/voice-engine-factory';
import { JASPER_TOOLS, executeToolCalls } from '@/lib/orchestrator/jasper-tools';
import { SystemStateService } from '@/lib/orchestrator/system-state-service';

// Default model for Jasper - Gemini 1.5 Pro (stable)
const DEFAULT_MODEL = 'google/gemini-pro-1.5';

// Fallback model if primary fails
const FALLBACK_MODEL = 'anthropic/claude-3-haiku';

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

    // Authentication - Require valid Firebase ID token with admin role
    const authResult = await requireRole(request, ['super_admin', 'admin', 'owner']);

    if (authResult instanceof NextResponse) {
      console.error('[Jasper] Auth failed - no valid token or insufficient role');
      return authResult;
    }

    const { user } = authResult;
    const isAdminContext = user.role === 'super_admin' || user.role === 'admin';

    console.log('[Jasper] Authenticated:', {
      uid: user.uid,
      email: user.email,
      role: user.role,
      isAdmin: isAdminContext,
    });

    // Parse request body
    const body: OrchestratorChatRequest = await request.json();
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
    const selectedModel = modelId || DEFAULT_MODEL;

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
      stateContext = await SystemStateService.generateStateContext(organizationId);
    }

    // Convert conversation history to provider format with tool support
    const messages: ChatMessage[] = [
      { role: 'system', content: enhancedSystemPrompt + stateContext },
      ...conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Initialize OpenRouter provider
    const orgId = organizationId || (isAdminContext ? 'admin' : 'default');
    const provider = new OpenRouterProvider(orgId);

    const startTime = Date.now();

    // Determine if we should enable tool calling
    // ALWAYS enable tools for admin context - Jasper needs full platform access
    // Tools are Jasper's PRIMARY interface to the platform (Anti-Hallucination Architecture)
    const useTools = isAdminContext; // Tools ALWAYS enabled for admin

    let finalResponse: string;
    let toolsExecuted: string[] = [];

    if (useTools) {
      // TOOL-CALLING LOOP: Allows Jasper to query data before responding
      let currentMessages = [...messages];
      let iterationCount = 0;
      const maxIterations = 3; // Prevent infinite loops

      while (iterationCount < maxIterations) {
        iterationCount++;

        const response = await provider.chatWithTools({
          model: selectedModel as any,
          messages: currentMessages,
          tools: JASPER_TOOLS,
          toolChoice: 'auto',
          temperature: 0.7,
          maxTokens: 4096,
        });

        // If no tool calls, we have the final response
        if (!response.toolCalls || response.toolCalls.length === 0) {
          finalResponse = response.content;
          break;
        }

        // Execute the tool calls
        logger.info('[Jasper] Executing tool calls', {
          tools: response.toolCalls.map((tc) => tc.function.name),
          iteration: iterationCount,
        });

        const toolResults = await executeToolCalls(response.toolCalls);
        toolsExecuted.push(...response.toolCalls.map((tc) => tc.function.name));

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
          const finalAttempt = await provider.chatWithTools({
            model: selectedModel as any,
            messages: currentMessages,
            tools: JASPER_TOOLS,
            toolChoice: 'none', // Force text response
            temperature: 0.7,
            maxTokens: 4096,
          });
          finalResponse = finalAttempt.content;
        }
      }

      // Fallback if somehow no response was set
      finalResponse = finalResponse! || 'I encountered an issue retrieving the data. Please try again.';
    } else {
      // Standard chat without tools for conversational queries
      const response = await provider.chat({
        model: selectedModel as any,
        messages: messages as any,
        temperature: 0.7,
        maxTokens: 2048,
      });
      finalResponse = response.content;
    }

    const responseTime = Date.now() - startTime;

    // Log the interaction for analytics
    logger.info('[Jasper] Chat completed via OpenRouter', {
      context,
      model: selectedModel,
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
        await persistConversation(organizationId, context, message, finalResponse, selectedModel);
      } catch (error) {
        logger.warn('[Jasper] Failed to persist conversation', { error });
      }
    }

    // Generate voice output if enabled
    let audioOutput: OrchestratorChatResponse['audio'] | undefined;

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
        logger.warn('[Jasper] TTS generation failed', { error: ttsError });
        // Continue without audio - don't fail the whole request
      }
    }

    const responseData: OrchestratorChatResponse = {
      success: true,
      response: finalResponse,
      metadata: {
        model: selectedModel,
        responseTime,
        toolExecuted: toolsExecuted.length > 0 ? toolsExecuted.join(', ') : undefined,
      },
      audio: audioOutput,
    };

    return NextResponse.json(responseData);
  } catch (error: any) {
    // Log the FULL error to the terminal for debugging
    console.error('[Jasper] OpenRouter API FAILED:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      cause: error?.cause,
    });
    logger.error('[Jasper] Chat error', error, { route: '/api/orchestrator/chat' });

    // Return the raw error message to the client for debugging
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unknown API error',
        errorDetails: {
          name: error?.name,
          stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
        },
      },
      { status: 500 }
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

Business: ${merchantInfo.companyName || 'Not specified'}
Industry: ${merchantInfo.industry || 'General'}
Owner: ${merchantInfo.ownerName || 'Business Owner'}

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
export async function GET() {
  return NextResponse.json({
    success: true,
    defaultModel: DEFAULT_MODEL,
    models: AVAILABLE_MODELS,
  });
}
