import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { checkTCPAConsent, checkCallTimeRestrictions } from '@/lib/compliance/tcpa-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getCallsCollection } from '@/lib/firebase/collections';
import { getTwilioCredentials } from '@/lib/security/twilio-verification';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';

const callRequestSchema = z.object({
  to: z.string().min(1, 'Phone number is required'),
  contactId: z.string().optional(),
});

interface TwilioCallInstance {
  sid: string;
  status: string;
}

/**
 * POST /api/voice/call
 * Initiate outbound voice call via Twilio
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/voice/call');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json();
    const parsed = callRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.errors[0]?.message ?? 'Invalid request body'
      );
    }
    const { to, contactId } = parsed.data;

    // TCPA compliance checks before making outbound call
    const tcpaCheck = await checkTCPAConsent(to, 'call');
    if (!tcpaCheck.allowed) {
      logger.warn('Outbound call blocked by TCPA compliance', {
        route: '/api/voice/call',
        to,
        reason: tcpaCheck.reason,
      });
      return NextResponse.json(
        { success: false, error: `TCPA compliance: ${tcpaCheck.reason}` },
        { status: 403 }
      );
    }

    // Check time-of-day restrictions
    const timeCheck = checkCallTimeRestrictions(to);
    if (!timeCheck.allowed) {
      logger.warn('Outbound call blocked by time restriction', {
        route: '/api/voice/call',
        to,
        reason: timeCheck.reason,
      });
      return NextResponse.json(
        { success: false, error: timeCheck.reason },
        { status: 403 }
      );
    }

    // Initialize Twilio client (credentials from Firestore API keys)
    const twilioKeys = await getTwilioCredentials();

    if (!twilioKeys?.accountSid || !twilioKeys?.authToken || !twilioKeys?.phoneNumber) {
      return errors.badRequest('Twilio is not configured. Please add credentials in Settings > API Keys.');
    }

    const client = twilio(twilioKeys.accountSid, twilioKeys.authToken);

    // Make the call
    const call: TwilioCallInstance = await client.calls.create({
      to: to,
      from: twilioKeys.phoneNumber,
      url: `${(process.env.NEXT_PUBLIC_APP_URL !== '' && process.env.NEXT_PUBLIC_APP_URL != null) ? process.env.NEXT_PUBLIC_APP_URL : 'http://localhost:3000'}/api/voice/twiml`,
      statusCallback: `${(process.env.NEXT_PUBLIC_APP_URL !== '' && process.env.NEXT_PUBLIC_APP_URL != null) ? process.env.NEXT_PUBLIC_APP_URL : 'http://localhost:3000'}/api/webhooks/voice`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });

    // Save call record to Firestore
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const callId = `call-${Date.now()}`;

    await FirestoreService.set(
      getCallsCollection(),
      callId,
      {
        id: callId,
        twilioCallSid: call.sid,
        contactId: contactId ?? null,
        phoneNumber: to,
        status: 'initiated',
        direction: 'outbound',
        recordingConsentDisclosed: true,
        createdAt: new Date().toISOString(),
        createdBy: authResult.user.uid,
      },
      false
    );

    logger.info('Outbound call initiated', {
      route: '/api/voice/call',
      callId,
      to,
      twilioSid: call.sid,
    });

    return NextResponse.json({
      success: true,
      callId,
      twilioSid: call.sid,
      status: call.status,
    });
  } catch (error: unknown) {
    logger.error('Voice call error', error instanceof Error ? error : new Error(String(error)), { route: '/api/voice/call' });
    return errors.internal('Failed to initiate call', error instanceof Error ? error : undefined);
  }
}
