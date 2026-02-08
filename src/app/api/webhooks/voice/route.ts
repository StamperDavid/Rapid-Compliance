import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { verifyTwilioSignature, parseFormBody } from '@/lib/security/webhook-verification';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

// Type definitions
interface CallRecord {
  id: string;
  twilioCallSid: string;
  status?: string;
  duration?: number;
  recordingUrl?: string;
}

// Type guards
function isCallRecord(value: unknown): value is CallRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'twilioCallSid' in value &&
    typeof (value as CallRecord).id === 'string' &&
    typeof (value as CallRecord).twilioCallSid === 'string'
  );
}

/**
 * POST /api/webhooks/voice
 * Twilio voice status callback webhook
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/webhooks/voice');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify Twilio signature if auth token is configured
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const signature = request.headers.get('x-twilio-signature');
      if (!signature) {
        logger.warn('Missing Twilio signature header', { route: '/api/webhooks/voice' });
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }

      const params = parseFormBody(rawBody);
      const isValid = verifyTwilioSignature(authToken, signature, request.url, params);

      if (!isValid) {
        logger.warn('Invalid Twilio signature', { route: '/api/webhooks/voice' });
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    } else {
      logger.warn('TWILIO_AUTH_TOKEN not configured - skipping signature verification', {
        route: '/api/webhooks/voice',
      });
    }

    // Parse form body
    const params = parseFormBody(rawBody);
    const callSid = params.CallSid;
    const callStatus = params.CallStatus;
    const duration = params.CallDuration;
    const recordingUrl = params.RecordingUrl;

    if (!callSid) {
      return NextResponse.json({ success: false, error: 'CallSid required' }, { status: 400 });
    }

    const calls = await FirestoreService.getAll(
      `organizations/${PLATFORM_ID}/workspaces/default/calls`,
      []
    );

    const call = calls.find((c: unknown) => {
      if (!isCallRecord(c)) {
        return false;
      }
      return c.twilioCallSid === callSid;
    });

    if (call && isCallRecord(call)) {
      await FirestoreService.update(
        `organizations/${PLATFORM_ID}/workspaces/default/calls`,
        call.id,
        {
          status: callStatus,
          duration: duration ? parseInt(duration) : null,
          recordingUrl: recordingUrl ?? null,
          updatedAt: new Date().toISOString(),
        }
      );

      logger.info('Voice call status updated', {
        route: '/api/webhooks/voice',
        callId: call.id,
        status: callStatus,
        duration: duration ? parseInt(duration) : 0,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Voice webhook error', error instanceof Error ? error : undefined, { route: '/api/webhooks/voice' });
    // Return 200 to prevent Twilio from retrying unrecoverable errors
    return NextResponse.json({ success: false, error: 'Internal processing error' }, { status: 200 });
  }
}
