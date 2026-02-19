/**
 * TwiML Voice Response Route
 * Generates dynamic TwiML responses for voice calls
 *
 * GET /api/voice/twiml
 * - Basic TwiML response (legacy support)
 *
 * POST /api/voice/twiml
 * - Dynamic TwiML with AI agent support
 * - Routes to AI Prospector by default
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { voiceAgentHandler, type VoiceAgentConfig } from '@/lib/voice/voice-agent-handler';
import type { VoiceCall } from '@/lib/voice/types';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { verifyTwilioSignature, parseFormBody } from '@/lib/security/webhook-verification';

/**
 * Permissive schema for Telnyx/Twilio JSON webhook payloads.
 * Uses .passthrough() to allow unknown provider-specific fields.
 */
const twilioWebhookPayloadSchema = z.object({
  CallSid: z.string().optional(),
  From: z.string().optional(),
  To: z.string().optional(),
  CallStatus: z.string().optional(),
  AnsweredBy: z.string().optional(),
  data: z.object({
    call_control_id: z.string().optional(),
    from: z.object({ phone_number: z.string().optional() }).optional(),
    to: z.object({ phone_number: z.string().optional() }).optional(),
    state: z.string().optional(),
  }).optional(),
}).passthrough();

/**
 * GET /api/voice/twiml
 * Legacy TwiML response - redirects to AI agent
 */
export function GET(request: NextRequest): NextResponse {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') ?? 'ai'; // 'ai' or 'basic'

  if (mode === 'basic') {
    // Return simple static TwiML for testing
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">This call may be recorded for quality assurance and training purposes.</Say>
  <Say voice="Polly.Joanna">Hello! This is a call from your CRM system. Please hold while we connect you.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">If you'd like to be removed from our calling list, please press 1.</Say>
  <Gather numDigits="1" action="/api/voice/gather">
    <Say voice="Polly.Joanna">Otherwise, please hold.</Say>
  </Gather>
</Response>`;

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Redirect to AI agent
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">/api/voice/ai-agent?mode=prospector</Redirect>
</Response>`;

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

/**
 * POST /api/voice/twiml
 * Dynamic TwiML generation with AI agent support
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Twilio webhook signature
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const signature = request.headers.get('x-twilio-signature');
      if (!signature) {
        logger.warn('[TwiML] Missing Twilio signature header', { file: 'twiml/route.ts' });
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
      const rawBody = await request.clone().text();
      const url = process.env.WEBHOOK_BASE_URL
        ? `${process.env.WEBHOOK_BASE_URL}/api/voice/twiml`
        : request.url;
      const params = parseFormBody(rawBody);
      const isValid = verifyTwilioSignature(authToken, signature, url, params);
      if (!isValid) {
        logger.warn('[TwiML] Invalid Twilio signature', { file: 'twiml/route.ts' });
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    // Parse webhook payload
    const contentType = request.headers.get('content-type') ?? '';
    let payload: z.infer<typeof twilioWebhookPayloadSchema>;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      const rawPayload: Record<string, unknown> = Object.fromEntries(formData.entries());
      const parsedPayload = twilioWebhookPayloadSchema.safeParse(rawPayload);
      payload = parsedPayload.success ? parsedPayload.data : rawPayload;
    } else {
      const rawJson: unknown = await request.json();
      const parsedPayload = twilioWebhookPayloadSchema.safeParse(rawJson);
      if (!parsedPayload.success) {
        logger.warn('[TwiML] Invalid JSON payload structure', { file: 'twiml/route.ts' });
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
      }
      payload = parsedPayload.data;
    }

    // Extract call information
    const callId = String(payload.CallSid ?? payload.data?.call_control_id ?? `call-${Date.now()}`);
    const from = String(payload.From ?? payload.data?.from?.phone_number ?? '');
    const to = String(payload.To ?? payload.data?.to?.phone_number ?? '');
    const callStatus = String(payload.CallStatus ?? payload.data?.state ?? 'ringing');
    const answeredBy = payload.AnsweredBy ? String(payload.AnsweredBy) : undefined;

    // Get configuration from query params
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') ?? 'ai-prospector';
    const mode = (searchParams.get('mode') ?? 'prospector') as 'prospector' | 'closer';
    const useAI = searchParams.get('ai') !== 'false';

    logger.info('[TwiML] Incoming call webhook', {
      callId,
      from,
      callStatus,
      answeredBy,
      useAI,
      file: 'twiml/route.ts',
    });

    // Handle answering machine detection
    if (answeredBy === 'machine_start' || answeredBy === 'machine_end_beep') {
      return handleVoicemailDrop(callId);
    }

    // If AI is disabled, return basic TwiML
    if (!useAI) {
      return generateBasicTwiML();
    }

    // Initialize AI agent and start conversation
    const config: VoiceAgentConfig = await loadAgentConfig(agentId, mode);
    await voiceAgentHandler.initialize(config);

    const call: VoiceCall = {
      callId,
      from,
      to,
      status: 'in-progress',
      direction: 'outbound',
      startTime: new Date(),
      answeredBy: answeredBy as 'human' | 'machine' | 'unknown' | undefined,
    };

    // Start AI conversation
    const response = await voiceAgentHandler.startConversation(call);

    logger.info('[TwiML] AI conversation started', {
      callId,
      mode,
      state: response.state,
      file: 'twiml/route.ts',
    });

    return new NextResponse(response.twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error: unknown) {
    logger.error('[TwiML] Error generating response:', error instanceof Error ? error : new Error(String(error)), { file: 'twiml/route.ts' });

    // Return fallback TwiML
    return generateFallbackTwiML();
  }
}

/**
 * Handle voicemail drop (answering machine detected)
 */
function handleVoicemailDrop(callId: string): NextResponse {
  logger.info('[TwiML] Voicemail detected, dropping message', {
    callId,
    file: 'twiml/route.ts',
  });

  // Use a pre-recorded voicemail message or generate one
  const voicemailAudioUrl = process.env.VOICEMAIL_DROP_URL ??
    'https://api.twilio.com/cowbell.mp3'; // Default placeholder

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Play>${voicemailAudioUrl}</Play>
  <Hangup/>
</Response>`;

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

/**
 * Generate basic TwiML (non-AI)
 */
function generateBasicTwiML(): NextResponse {
  const transferNumber = process.env.HUMAN_AGENT_QUEUE_NUMBER;

  if (!transferNumber) {
    logger.error('[TwiML] HUMAN_AGENT_QUEUE_NUMBER not configured — cannot transfer call', undefined, { file: 'twiml/route.ts' });
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">This call may be recorded for quality assurance and training purposes.</Say>
  <Say voice="Polly.Joanna">Hello! Thank you for taking our call. We are unable to transfer your call at this time. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`;
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">This call may be recorded for quality assurance and training purposes.</Say>
  <Say voice="Polly.Joanna">Hello! Thank you for taking our call. Please hold while we connect you with a representative.</Say>
  <Dial timeout="30">
    <Number>${transferNumber}</Number>
  </Dial>
  <Say voice="Polly.Joanna">We're sorry, all representatives are busy. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`;

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

/**
 * Generate fallback TwiML
 */
function generateFallbackTwiML(): NextResponse {
  const transferNumber = process.env.HUMAN_AGENT_QUEUE_NUMBER;

  if (!transferNumber) {
    logger.error('[TwiML] HUMAN_AGENT_QUEUE_NUMBER not configured — cannot transfer call', undefined, { file: 'twiml/route.ts' });
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">This call may be recorded for quality assurance and training purposes.</Say>
  <Say voice="Polly.Joanna">We're experiencing technical difficulties and are unable to transfer your call at this time. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`;
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">This call may be recorded for quality assurance and training purposes.</Say>
  <Say voice="Polly.Joanna">Hello! We're experiencing technical difficulties. Let me connect you with a team member.</Say>
  <Dial timeout="30">
    <Number>${transferNumber}</Number>
  </Dial>
  <Say voice="Polly.Joanna">We apologize, no one is available right now. Please call back later. Goodbye.</Say>
  <Hangup/>
</Response>`;

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

/**
 * Load agent configuration
 */
async function loadAgentConfig(
  agentId: string,
  mode: 'prospector' | 'closer'
): Promise<VoiceAgentConfig> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

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
    // Use defaults
  }

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
    voiceSettings: {
      voice: 'Polly.Joanna',
      language: 'en-US',
    },
    fallbackBehavior: 'transfer',
  };
}
