/**
 * SMS Webhook Handler (Twilio)
 * Handles delivery status callbacks from Twilio
 * https://www.twilio.com/docs/sms/tutorials/how-to-confirm-delivery-php#handle-status-callbacks
 */

import { NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

// Twilio status mappings
const TWILIO_STATUS_MAP = {
  'queued': 'queued',
  'sending': 'sending',
  'sent': 'sent',
  'delivered': 'delivered',
  'undelivered': 'failed',
  'failed': 'failed',
} as const;

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (higher limit for webhooks)
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/webhooks/sms');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Twilio sends form-encoded data
    const formData = await request.formData();
    
    const messageSid = formData.get('MessageSid') as string;
    const messageStatus = formData.get('MessageStatus') as string;
    const to = formData.get('To') as string;
    const from = formData.get('From') as string;
    const errorCode = formData.get('ErrorCode') as string | null;
    const errorMessage = formData.get('ErrorMessage') as string | null;
    
    logger.info('SMS webhook received', { 
      route: '/api/webhooks/sms', 
      messageSid, 
      status: messageStatus,
      to 
    });

    if (!messageSid || !messageStatus) {
      return errors.badRequest('Missing required webhook data');
    }

    // Verify webhook signature (optional but recommended)
    // const twilioSignature = request.headers.get('X-Twilio-Signature');
    // if (!verifyTwilioSignature(twilioSignature, request.url, formData)) {
    //   return errors.unauthorized('Invalid webhook signature');
    // }

    // Map Twilio status to our internal status
    const status = TWILIO_STATUS_MAP[messageStatus as keyof typeof TWILIO_STATUS_MAP] || 'sent';

    // Update SMS record in all organizations (find by message SID)
    await updateSMSRecord(messageSid, {
      status,
      lastStatusUpdate: new Date().toISOString(),
      deliveredAt: status === 'delivered' ? new Date().toISOString() : undefined,
      errorCode: errorCode || undefined,
      errorMessage: errorMessage || undefined,
    });

    // If failed, handle bounce logic for sequences
    if (status === 'failed') {
      await handleSMSFailure(messageSid, errorCode, errorMessage);
    }

    logger.info('SMS status updated', { 
      route: '/api/webhooks/sms', 
      messageSid, 
      status 
    });

    // Twilio expects 200 OK
    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('SMS webhook error', error, { route: '/api/webhooks/sms' });
    // Return 200 even on error to prevent Twilio retries for unrecoverable errors
    return NextResponse.json({ success: false, error: error.message });
  }
}

/**
 * Update SMS record in Firestore
 */
async function updateSMSRecord(
  messageSid: string,
  updates: {
    status: string;
    lastStatusUpdate: string;
    deliveredAt?: string;
    errorCode?: string;
    errorMessage?: string;
  }
): Promise<void> {
  try {
    // Find SMS record by messageSid across all organizations
    // This is inefficient but works. In production, you'd store org ID in Twilio metadata
    const orgs = await FirestoreService.getAll(COLLECTIONS.ORGANIZATIONS, []);
    
    for (const org of orgs) {
      try {
        // Search for SMS in this org
        const smsMessages = await FirestoreService.getAll(
          `${COLLECTIONS.ORGANIZATIONS}/${org.id}/smsMessages`,
          []
        );
        
        const smsRecord = smsMessages.find((sms: any) => sms.messageId === messageSid);
        
        if (smsRecord) {
          // Update the record
          await FirestoreService.update(
            `${COLLECTIONS.ORGANIZATIONS}/${org.id}/smsMessages`,
            smsRecord.id,
            {
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          );
          
          logger.info('SMS record updated', { 
            route: '/api/webhooks/sms', 
            orgId: org.id, 
            smsId: smsRecord.id 
          });
          
          return; // Found and updated, exit
        }
      } catch (err) {
        logger.debug('Error searching org for SMS', { orgId: org.id, error: err });
        continue;
      }
    }
    
    logger.warn('SMS record not found', { 
      route: '/api/webhooks/sms', 
      messageSid 
    });
  } catch (error) {
    logger.error('Error updating SMS record', error, { route: '/api/webhooks/sms' });
  }
}

/**
 * Handle SMS failure - unenroll from sequences if needed
 */
async function handleSMSFailure(
  messageSid: string,
  errorCode: string | null,
  errorMessage: string | null
): Promise<void> {
  try {
    logger.warn('SMS delivery failed', { 
      route: '/api/webhooks/sms', 
      messageSid, 
      errorCode, 
      errorMessage 
    });

    // Get SMS record to find associated enrollment
    const orgs = await FirestoreService.getAll(COLLECTIONS.ORGANIZATIONS, []);
    
    for (const org of orgs) {
      const smsMessages = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/${org.id}/smsMessages`,
        []
      );
      
      const smsRecord = smsMessages.find((sms: any) => sms.messageId === messageSid);
      
      if (smsRecord && smsRecord.enrollmentId) {
        // Get the enrollment
        const enrollment = await FirestoreService.get(
          `${COLLECTIONS.ORGANIZATIONS}/${org.id}/enrollments`,
          smsRecord.enrollmentId
        );
        
        if (enrollment) {
          // Update enrollment step action
          const action = enrollment.stepActions?.find((a: any) => a.stepId === smsRecord.stepId);
          if (action) {
            action.status = 'failed';
            action.error = errorMessage || `Error ${errorCode}`;
            action.updatedAt = new Date().toISOString();
            
            await FirestoreService.update(
              `${COLLECTIONS.ORGANIZATIONS}/${org.id}/enrollments`,
              smsRecord.enrollmentId,
              {
                stepActions: enrollment.stepActions,
                updatedAt: new Date().toISOString(),
              }
            );
          }
          
          // For hard failures (invalid number), unenroll from sequence
          const hardFailureCodes = ['21211', '21614', '21617']; // Invalid number, landline, etc.
          if (errorCode && hardFailureCodes.includes(errorCode)) {
            const { SequenceEngine } = await import('@/lib/outbound/sequence-engine');
            await SequenceEngine['unenrollProspect'](
              enrollment.prospectId,
              enrollment.sequenceId,
              org.id,
              'bounced'
            );
            
            logger.info('Prospect unenrolled due to SMS hard bounce', {
              route: '/api/webhooks/sms',
              errorCode,
              enrollmentId: smsRecord.enrollmentId,
            });
          }
        }
        
        return;
      }
    }
  } catch (error) {
    logger.error('Error handling SMS failure', error, { route: '/api/webhooks/sms' });
  }
}

/**
 * Verify Twilio webhook signature (optional security layer)
 */
function verifyTwilioSignature(
  signature: string | null,
  url: string,
  formData: FormData
): boolean {
  // Implementation would use Twilio's webhook validation
  // For now, skip verification (you'd enable this in production)
  return true;
}

