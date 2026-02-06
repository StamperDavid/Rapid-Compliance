import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

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
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const duration = formData.get('CallDuration') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;

    if (!callSid) {
      return NextResponse.json({ success: false, error: 'CallSid required' }, { status: 400 });
    }

    const calls = await FirestoreService.getAll(
      `organizations/${DEFAULT_ORG_ID}/workspaces/default/calls`,
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
        `organizations/${DEFAULT_ORG_ID}/workspaces/default/calls`,
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Voice webhook error', error instanceof Error ? error : undefined, { route: '/api/webhooks/voice' });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
