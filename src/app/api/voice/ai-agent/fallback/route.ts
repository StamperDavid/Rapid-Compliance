/**
 * AI Voice Agent Fallback Handler
 * Handles graceful fallback to human when AI fails or times out
 *
 * POST/GET /api/voice/ai-agent/fallback
 * - Transfers call to human agent queue
 * - Preserves conversation context for handoff
 */

import { type NextRequest, NextResponse } from 'next/server';
import { voiceAgentHandler } from '@/lib/voice/voice-agent-handler';
import { callTransferService } from '@/lib/voice/call-transfer-service';
import { aiConversationService } from '@/lib/voice/ai-conversation-service';
import { logger } from '@/lib/logger/logger';

/** Conversation context from the voice agent handler */
interface ConversationContext {
  sentiment: string;
  qualificationScore: number;
  turns: Array<{
    role: string;
    content: string;
    timestamp: Date;
  }>;
  customerInfo: {
    name?: string;
    phone?: string;
  };
}

/**
 * Handle fallback request (both GET and POST)
 */
async function handleFallback(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');
    const reason = searchParams.get('reason') ?? 'speech_timeout';

    logger.info('[AI-Fallback] Fallback triggered', {
      callId,
      reason,
      file: 'ai-agent/fallback/route.ts',
    });

    // Get conversation context if available
    let context;
    let summary = 'AI conversation fallback - no context available';

    if (callId) {
      context = voiceAgentHandler.getConversationContext(callId);
      if (context) {
        summary = aiConversationService.generateTransferSummary(callId);
      }
    }

    // Log the fallback for analytics
    await logFallback(callId ?? 'unknown', reason, context);

    // Attempt to transfer with context
    if (callId && context) {
      try {
        await callTransferService.aiToHumanHandoff({
          callId,
          organizationId: 'default', // In production, get from context
          aiAgentId: 'ai-prospector',
          conversationSummary: summary,
          customerSentiment: context.sentiment,
          customerIntent: 'fallback',
          suggestedActions: [
            `Fallback reason: ${reason}`,
            'Continue conversation from where AI left off',
            context.qualificationScore >= 50 ? 'Lead shows potential' : 'Lead needs more qualification',
          ],
          conversationHistory: context.turns.map((t) => ({
            role: t.role,
            content: t.content,
            timestamp: t.timestamp,
          })),
          customerInfo: {
            name: context.customerInfo.name,
            phone: context.customerInfo.phone,
          },
        });
      } catch (transferError) {
        logger.error('[AI-Fallback] Transfer notification failed:', transferError instanceof Error ? transferError : undefined, {
          file: 'ai-agent/fallback/route.ts',
        });
      }

      // End the AI conversation
      voiceAgentHandler.endConversation(callId);
    }

    // Generate transfer TwiML
    const transferNumber = process.env.HUMAN_AGENT_QUEUE_NUMBER ?? '+15551234567';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I'm connecting you with a team member who can assist you. Please hold for just a moment.</Say>
  <Dial timeout="30" action="/api/voice/ai-agent/transfer-complete?callId=${encodeURIComponent(callId ?? '')}">
    <Number url="/api/voice/ai-agent/whisper?callId=${encodeURIComponent(callId ?? '')}">${transferNumber}</Number>
  </Dial>
  <Say voice="Polly.Joanna">I'm sorry, but all of our team members are currently busy. Please try calling back later, or leave a message after the tone.</Say>
  <Record maxLength="120" playBeep="true" action="/api/voice/ai-agent/voicemail?callId=${encodeURIComponent(callId ?? '')}"/>
  <Hangup/>
</Response>`;

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error: unknown) {
    logger.error('[AI-Fallback] Error in fallback handler:', error instanceof Error ? error : undefined, {
      file: 'ai-agent/fallback/route.ts',
    });

    // Ultimate fallback - just try to transfer
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Please hold while I connect you.</Say>
  <Dial timeout="30">
    <Number>${process.env.HUMAN_AGENT_QUEUE_NUMBER ?? '+15551234567'}</Number>
  </Dial>
  <Say voice="Polly.Joanna">We're sorry, please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`;

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleFallback(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleFallback(request);
}

/**
 * Log fallback event for analytics
 */
async function logFallback(
  callId: string,
  reason: string,
  context: ConversationContext | undefined
): Promise<void> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    const logId = `fallback-${callId}-${Date.now()}`;
    await FirestoreService.set(
      'conversationFallbacks',
      logId,
      {
        callId,
        reason,
        hasContext: !!context,
        qualificationScore: context?.qualificationScore ?? null,
        sentiment: context?.sentiment ?? null,
        turnsCount: context?.turns?.length ?? 0,
        timestamp: new Date().toISOString(),
      },
      false
    );
  } catch {
    // Ignore logging errors
  }
}
