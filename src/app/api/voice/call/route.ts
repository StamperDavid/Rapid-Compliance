import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * POST /api/voice/call
 * Initiate outbound voice call via Twilio
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/voice/call');
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { to, organizationId, contactId } = body;

    if (!to || !organizationId) {
      return errors.badRequest('Phone number and organizationId are required');
    }

    // Initialize Twilio client
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return errors.badRequest('Twilio is not configured. Please add credentials in settings.');
    }

    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);

    // Make the call
    const call = await client.calls.create({
      to: to,
      from: fromNumber,
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/voice/twiml`,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/voice`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });

    // Save call record to Firestore
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const callId = `call-${Date.now()}`;
    
    await FirestoreService.set(
      `organizations/${organizationId}/workspaces/default/calls`,
      callId,
      {
        id: callId,
        twilioCallSid: call.sid,
        contactId: contactId || null,
        phoneNumber: to,
        status: 'initiated',
        direction: 'outbound',
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
  } catch (error: any) {
    logger.error('Voice call error', error, { route: '/api/voice/call' });
    return errors.internal('Failed to initiate call', error);
  }
}

