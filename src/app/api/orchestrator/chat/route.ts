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
 * - Tool calling for background agent execution
 * - Real-time stats and context injection
 * - TTS voice synthesis integration
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { requireRole } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { handleAPIError, errors } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { VoiceEngineFactory } from '@/lib/voice/tts/voice-engine-factory';

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

    // Build the enhanced system prompt with real-time context
    const enhancedSystemPrompt = buildEnhancedSystemPrompt(
      systemPrompt,
      context,
      adminStats,
      merchantInfo
    );

    // Convert conversation history to provider format
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: enhancedSystemPrompt },
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

    // Make the API call via OpenRouter
    const response = await provider.chat({
      model: selectedModel as any,
      messages,
      temperature: 0.7,
      maxTokens: 2048,
    });

    const responseTime = Date.now() - startTime;
    const finalResponse = response.content;

    // Log the interaction for analytics
    logger.info('[Jasper] Chat completed via OpenRouter', {
      context,
      model: selectedModel,
      messageLength: message.length,
      responseLength: finalResponse.length,
      usage: response.usage,
      responseTime,
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
        usage: response.usage,
        responseTime,
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
