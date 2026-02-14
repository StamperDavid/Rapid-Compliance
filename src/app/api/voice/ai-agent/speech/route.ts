/**
 * AI Voice Agent Speech Handler
 * Processes real-time speech recognition results and generates AI responses
 *
 * POST /api/voice/ai-agent/speech
 * - Receives speech transcription from Twilio/Telnyx
 * - Processes through AI conversation service
 * - Returns TwiML with AI response
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { voiceAgentHandler } from '@/lib/voice/voice-agent-handler';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { verifyTwilioSignature, parseFormBody } from '@/lib/security/webhook-verification';

/** Telnyx speech recognition data structure */
interface TelnyxSpeechPayload {
  data?: {
    payload?: {
      speech?: {
        transcript?: string;
        confidence?: number;
      };
    };
    speech?: {
      transcript?: string;
      confidence?: number;
    };
  };
}

/**
 * POST /api/voice/ai-agent/speech
 * Process speech input and generate AI response
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify Twilio signature — fail-closed (reject if missing or invalid)
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const signature = request.headers.get('x-twilio-signature');
      if (!signature) {
        logger.warn('[AI-Speech] Missing Twilio signature', { file: 'ai-agent/speech/route.ts' });
        return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });
      }
      const rawBody = await request.clone().text();
      const url = process.env.WEBHOOK_BASE_URL
        ? `${process.env.WEBHOOK_BASE_URL}/api/voice/ai-agent/speech`
        : request.url;
      const params = parseFormBody(rawBody);
      const isValid = verifyTwilioSignature(authToken, signature, url, params);
      if (!isValid) {
        logger.warn('[AI-Speech] Invalid Twilio signature', { file: 'ai-agent/speech/route.ts' });
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      logger.error('[AI-Speech] TWILIO_AUTH_TOKEN not configured in production', undefined, { file: 'ai-agent/speech/route.ts' });
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get callId from query params
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');

    if (!callId) {
      logger.error('[AI-Speech] Missing callId', undefined, { file: 'ai-agent/speech/route.ts' });
      return new NextResponse(generateErrorTwiML('Missing call identifier'), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Parse webhook payload
    const contentType = request.headers.get('content-type') ?? '';
    let speechResult: string;
    let confidence: number = 0;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Twilio format
      const formData = await request.formData();
      speechResult = String(formData.get('SpeechResult') ?? '');
      confidence = parseFloat(String(formData.get('Confidence') ?? '0'));

      // Log Twilio speech data
      logger.info('[AI-Speech] Twilio speech received', {
        callId,
        speechResult: speechResult.substring(0, 100),
        confidence,
        file: 'ai-agent/speech/route.ts',
      });
    } else {
      // Telnyx format
      const payload = await request.json() as TelnyxSpeechPayload;
      const data = payload.data;

      // Telnyx provides speech in payload.data.payload.speech
      speechResult = data?.payload?.speech?.transcript ?? data?.speech?.transcript ?? '';
      confidence = data?.payload?.speech?.confidence ?? data?.speech?.confidence ?? 0;

      logger.info('[AI-Speech] Telnyx speech received', {
        callId,
        speechResult: speechResult.substring(0, 100),
        confidence,
        file: 'ai-agent/speech/route.ts',
      });
    }

    // Handle empty speech result
    if (!speechResult || speechResult.trim() === '') {
      logger.warn('[AI-Speech] Empty speech result', { callId, file: 'ai-agent/speech/route.ts' });
      return new NextResponse(generateRetryTwiML(callId), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Handle low confidence (might be noise)
    if (confidence > 0 && confidence < 0.3) {
      logger.warn('[AI-Speech] Low confidence speech', {
        callId,
        confidence,
        file: 'ai-agent/speech/route.ts',
      });
      return new NextResponse(generateClarificationTwiML(callId), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Process through AI and generate response
    const response = await voiceAgentHandler.processCustomerInput(callId, speechResult);

    // Track response time
    const responseTime = Date.now() - startTime;
    if (responseTime > 2000) {
      logger.warn('[AI-Speech] Response time exceeded 2s', {
        callId,
        responseTime,
        file: 'ai-agent/speech/route.ts',
      });
    }

    // Log for training data
    await logSpeechTurn(callId, speechResult, response.text, responseTime, response.state ?? 'UNKNOWN');

    logger.info('[AI-Speech] Response generated', {
      callId,
      state: response.state,
      action: response.action,
      qualificationScore: response.qualificationScore,
      responseTime,
      file: 'ai-agent/speech/route.ts',
    });

    // Return TwiML response
    return new NextResponse(response.twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error: unknown) {
    logger.error('[AI-Speech] Error processing speech:', error instanceof Error ? error : new Error(String(error)), { file: 'ai-agent/speech/route.ts' });

    // Return fallback TwiML
    return new NextResponse(generateFallbackTwiML(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

/**
 * Generate TwiML for retry (no speech detected)
 */
function generateRetryTwiML(callId: string): string {
  const actionUrl = `/api/voice/ai-agent/speech?callId=${encodeURIComponent(callId)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" language="en-US" timeout="5" speechTimeout="auto" enhanced="true">
    <Say voice="Polly.Joanna">I'm sorry, I didn't catch that. Could you please repeat what you said?</Say>
  </Gather>
  <Say voice="Polly.Joanna">I'm still not hearing you. Let me connect you with someone who can help.</Say>
  <Redirect>/api/voice/ai-agent/fallback?callId=${encodeURIComponent(callId)}</Redirect>
</Response>`;
}

/**
 * Generate TwiML for clarification (low confidence)
 */
function generateClarificationTwiML(callId: string): string {
  const actionUrl = `/api/voice/ai-agent/speech?callId=${encodeURIComponent(callId)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" language="en-US" timeout="5" speechTimeout="auto" enhanced="true">
    <Say voice="Polly.Joanna">I want to make sure I understand you correctly. Could you please speak a little more clearly?</Say>
  </Gather>
  <Redirect>/api/voice/ai-agent/fallback?callId=${encodeURIComponent(callId)}</Redirect>
</Response>`;
}

/**
 * Generate error TwiML
 */
function generateErrorTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I apologize, but I encountered an error. ${escapeXML(message)}. Let me connect you with a team member.</Say>
  <Dial timeout="30">
    <Number>${process.env.HUMAN_AGENT_QUEUE_NUMBER ?? '+15551234567'}</Number>
  </Dial>
  <Say voice="Polly.Joanna">I'm sorry, all agents are busy. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

/**
 * Generate fallback TwiML (transfer to human)
 */
function generateFallbackTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I apologize, but I'm having technical difficulties. Let me connect you with a team member who can help.</Say>
  <Dial timeout="30">
    <Number>${process.env.HUMAN_AGENT_QUEUE_NUMBER ?? '+15551234567'}</Number>
  </Dial>
  <Say voice="Polly.Joanna">I'm sorry, all agents are currently busy. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

/**
 * Escape XML special characters
 */
function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Log speech turn for training data
 */
async function logSpeechTurn(
  callId: string,
  customerSpeech: string,
  agentResponse: string,
  responseTime: number,
  state: string
): Promise<void> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    // Penthouse model - use environment-aware path
    const logId = `${callId}-turn-${Date.now()}`;
    await FirestoreService.set(
      getSubCollection('conversationLogs'),
      logId,
      {
        callId,
        event: 'speech_turn',
        customerSpeech,
        agentResponse,
        responseTime,
        state,
        timestamp: new Date().toISOString(),
      },
      false
    );
  } catch {
    // Ignore logging errors to not affect call flow
  }
}
