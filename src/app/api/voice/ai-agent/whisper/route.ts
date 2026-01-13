/**
 * AI Voice Agent Whisper Handler
 * Provides context whisper to human agent before connecting the call
 *
 * POST /api/voice/ai-agent/whisper
 * - Plays a brief context message to the human agent
 * - Includes qualification score, sentiment, and key info
 */

import { NextRequest, NextResponse } from 'next/server';
import { voiceAgentHandler } from '@/lib/voice/voice-agent-handler';
import { logger } from '@/lib/logger/logger';

/**
 * POST /api/voice/ai-agent/whisper
 * Generate whisper message for human agent
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');

    // Get conversation context
    let whisperMessage = 'Incoming transfer from AI agent.';

    if (callId) {
      const context = voiceAgentHandler.getConversationContext(callId);

      if (context) {
        // Build concise whisper message for agent
        const name = context.customerInfo.name ?? 'Unknown caller';
        const company = context.customerInfo.company ?? '';
        const score = context.qualificationScore;
        const sentiment = context.sentiment;

        // Qualification level
        let qualLevel = 'needs qualification';
        if (score >= 70) qualLevel = 'highly qualified';
        else if (score >= 50) qualLevel = 'moderately qualified';

        // Build message
        whisperMessage = `Incoming transfer. ${name}${company ? ` from ${company}` : ''}. `;
        whisperMessage += `Qualification: ${qualLevel}. Sentiment: ${sentiment}. `;

        // Add key buying signals or objections
        if (context.buyingSignals.length > 0) {
          whisperMessage += `Buying signals detected. `;
        }
        if (context.objectionCount > 0) {
          whisperMessage += `${context.objectionCount} objections raised. `;
        }

        // Add last topic if available
        const lastCustomerTurn = context.turns.filter(t => t.role === 'customer').pop();
        if (lastCustomerTurn) {
          const topic = lastCustomerTurn.content.substring(0, 50);
          whisperMessage += `Last discussed: ${topic}.`;
        }

        logger.info('[AI-Whisper] Generated whisper for agent', {
          callId,
          qualificationScore: score,
          sentiment,
          file: 'ai-agent/whisper/route.ts',
        });
      }
    }

    // Generate TwiML for whisper
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">${escapeXML(whisperMessage)}</Say>
  <Say voice="Polly.Matthew">Press 1 to accept, or hang up to decline.</Say>
  <Gather numDigits="1" action="/api/voice/ai-agent/accept-transfer?callId=${encodeURIComponent(callId ?? '')}" timeout="10">
    <Say voice="Polly.Matthew">Waiting for your response.</Say>
  </Gather>
</Response>`;

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error: any) {
    logger.error('[AI-Whisper] Error generating whisper:', error, {
      file: 'ai-agent/whisper/route.ts',
    });

    // Simple fallback whisper
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Incoming transfer from AI agent. Press 1 to accept.</Say>
  <Gather numDigits="1" timeout="10"/>
</Response>`;

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
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
