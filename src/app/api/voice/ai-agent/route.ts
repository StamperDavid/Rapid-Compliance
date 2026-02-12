/**
 * AI Voice Agent API Route
 * Main entry point for AI-powered voice calls
 *
 * POST /api/voice/ai-agent
 * - Initiates new AI agent conversation
 * - Returns TwiML with speech recognition enabled
 */

import { type NextRequest, NextResponse } from 'next/server';
import { voiceAgentHandler, type VoiceAgentConfig } from '@/lib/voice/voice-agent-handler';
import type { VoiceCall } from '@/lib/voice/types';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { verifyTwilioSignature, parseFormBody } from '@/lib/security/webhook-verification';

export const dynamic = 'force-dynamic';

/** Telnyx webhook data structure */
interface TelnyxWebhookData {
  call_control_id?: string;
  from?: { phone_number?: string };
  to?: { phone_number?: string };
}

/**
 * POST /api/voice/ai-agent
 * Initialize AI agent and start conversation
 * Called by Twilio/Telnyx when call is answered
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify Twilio webhook signature
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const signature = request.headers.get('x-twilio-signature');
      if (!signature) {
        logger.warn('[AI-Agent] Missing Twilio signature header', { file: 'ai-agent/route.ts' });
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
      const rawBody = await request.clone().text();
      const url = process.env.WEBHOOK_BASE_URL
        ? `${process.env.WEBHOOK_BASE_URL}/api/voice/ai-agent`
        : request.url;
      const params = parseFormBody(rawBody);
      const isValid = verifyTwilioSignature(authToken, signature, url, params);
      if (!isValid) {
        logger.warn('[AI-Agent] Invalid Twilio signature', { file: 'ai-agent/route.ts' });
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    // Parse webhook payload (Twilio or Telnyx format)
    const contentType = request.headers.get('content-type') ?? '';
    let payload: Record<string, unknown>;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Twilio format
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries()) as Record<string, unknown>;
    } else {
      // Telnyx or JSON format
      payload = await request.json() as Record<string, unknown>;
    }

    // Extract call information (Twilio or Telnyx format)
    const telnyxData = payload.data as TelnyxWebhookData | undefined;
    const callId = String(payload.CallSid ?? telnyxData?.call_control_id ?? '');
    const from = String(payload.From ?? telnyxData?.from?.phone_number ?? '');
    const to = String(payload.To ?? telnyxData?.to?.phone_number ?? '');

    // Get agent config from query params or use defaults
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') ?? 'ai-prospector';
    const mode = (searchParams.get('mode') ?? 'prospector') as 'prospector' | 'closer';

    logger.info('[AI-Agent] Incoming call', {
      callId,
      from,
      mode,
      file: 'ai-agent/route.ts',
    });

    // Load agent configuration from Firestore (or use defaults)
    const config = await loadAgentConfig(agentId, mode);

    // Initialize the voice agent
    await voiceAgentHandler.initialize(config);

    // Create VoiceCall object
    const call: VoiceCall = {
      callId,
      from,
      to,
      status: 'in-progress',
      direction: 'inbound',
      startTime: new Date(),
    };

    // Start AI conversation
    const response = await voiceAgentHandler.startConversation(call);

    // Log conversation training data
    await logConversationData(callId, 'start', {
      mode,
      greeting: response.text,
      responseTime: Date.now() - startTime,
    });

    // Return TwiML response
    return new NextResponse(response.twiml, {
      headers: {
        'Content-Type': 'text/xml',
      },
    });

  } catch (error: unknown) {
    logger.error('[AI-Agent] Error starting conversation:', error instanceof Error ? error : new Error(String(error)), { file: 'ai-agent/route.ts' });

    // Return fallback TwiML that transfers to human
    const transferNumber = process.env.HUMAN_AGENT_QUEUE_NUMBER;
    const fallbackTwiml = transferNumber
      ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">This call may be recorded for quality assurance and training purposes.</Say>
  <Say voice="Polly.Joanna">I apologize, but I'm having technical difficulties. Let me connect you with a team member.</Say>
  <Dial timeout="30">
    <Number>${transferNumber}</Number>
  </Dial>
  <Say voice="Polly.Joanna">I'm sorry, all agents are busy. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`
      : `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">This call may be recorded for quality assurance and training purposes.</Say>
  <Say voice="Polly.Joanna">I apologize, but I'm having technical difficulties and we are unable to transfer your call at this time. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`;

    return new NextResponse(fallbackTwiml, {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}

/**
 * GET /api/voice/ai-agent
 * Return agent status or health check
 */
export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get('callId');

  if (callId) {
    // Return conversation context for specific call
    const context = voiceAgentHandler.getConversationContext(callId);
    if (context) {
      return NextResponse.json({
        callId,
        state: context.state,
        qualificationScore: context.qualificationScore,
        sentiment: context.sentiment,
        turnsCount: context.turns.length,
        objectionCount: context.objectionCount,
        buyingSignals: context.buyingSignals,
      });
    }
    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  }

  // Health check
  return NextResponse.json({
    status: 'healthy',
    service: 'ai-voice-agent',
    modes: ['prospector', 'closer'],
    timestamp: new Date().toISOString(),
  });
}

/**
 * Load agent configuration from Firestore
 */
async function loadAgentConfig(
  agentId: string,
  mode: 'prospector' | 'closer'
): Promise<VoiceAgentConfig> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    // Try to load custom config
    const customConfig = await FirestoreService.get(
      getSubCollection('voiceAgents'),
      agentId
    );

    if (customConfig) {
      return {
        mode,
        agentId,
        ...customConfig,
      } as VoiceAgentConfig;
    }
  } catch {
    // Use defaults if Firestore fetch fails
  }

  // Return default config
  return {
    mode,
    agentId,
    companyName: 'Our Company',
    productName: 'Our Solution',
    valueProposition: 'helping businesses grow and succeed',
    qualificationCriteria: {
      budgetThreshold: 1000,
      requiredFields: ['name', 'company', 'need'],
      disqualifyingResponses: ['not interested', 'remove me', 'do not call'],
    },
    transferRules: {
      onQualified: 'transfer',
    },
    closingConfig: {
      maxDiscountPercent: 15,
      urgencyTactics: true,
      paymentEnabled: false,
    },
    voiceSettings: {
      voice: 'Polly.Joanna',
      language: 'en-US',
    },
    fallbackBehavior: 'transfer',
  };
}

/**
 * Log conversation data for training
 */
async function logConversationData(
  callId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    const logId = `${callId}-${event}-${Date.now()}`;
    await FirestoreService.set(
      getSubCollection('conversationLogs'),
      logId,
      {
        callId,
        event,
        ...data,
        timestamp: new Date().toISOString(),
      },
      false
    );
  } catch (error) {
    logger.error('[AI-Agent] Failed to log conversation data:', error instanceof Error ? error : new Error(String(error)), { file: 'ai-agent/route.ts' });
  }
}
