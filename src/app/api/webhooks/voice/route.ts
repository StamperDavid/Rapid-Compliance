import { NextRequest, NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';

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
      const calls = await FirestoreService.getAll(
        `organizations/${org.id}/workspaces/default/calls`,
        []
      );
      
      const call = calls.find((c: any) => c.twilioCallSid === callSid);
      
      if (call) {
        // Update call record
        await FirestoreService.update(
          `organizations/${org.id}/workspaces/default/calls`,
          call.id,
          {
            status: callStatus,
            duration: duration ? parseInt(duration) : null,
            recordingUrl: recordingUrl || null,
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
  } catch (error: any) {
    logger.error('Voice webhook error', error, { route: '/api/webhooks/voice' });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

