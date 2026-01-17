import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

// Type definitions
interface Organization {
  id: string;
  name?: string;
}

interface CallRecord {
  id: string;
  twilioCallSid: string;
  status?: string;
  duration?: number;
  recordingUrl?: string;
}

// Type guards
function isOrganization(value: unknown): value is Organization {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as Organization).id === 'string'
  );
}

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

    // Find call record by Twilio SID
    const orgs = await FirestoreService.getAll('organizations', []);

    for (const org of orgs) {
      if (!isOrganization(org)) {
        continue;
      }

      const calls = await FirestoreService.getAll(
        `organizations/${org.id}/workspaces/default/calls`,
        []
      );

      const call = calls.find((c: unknown) => {
        if (!isCallRecord(c)) {
          return false;
        }
        return c.twilioCallSid === callSid;
      });

      if (call && isCallRecord(call)) {
        // Update call record
        await FirestoreService.update(
          `organizations/${org.id}/workspaces/default/calls`,
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

        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Voice webhook error', error instanceof Error ? error : undefined, { route: '/api/webhooks/voice' });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
