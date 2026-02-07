/**
 * SMS Webhook Handler (Twilio)
 * Handles delivery status callbacks from Twilio
 * https://www.twilio.com/docs/sms/tutorials/how-to-confirm-delivery-php#handle-status-callbacks
 */

import { type NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { verifyTwilioSignature, parseFormBody } from '@/lib/security/webhook-verification';

export const dynamic = 'force-dynamic';

interface SMSMessage {
  id: string;
  messageId: string;
  enrollmentId?: string;
  stepId?: string;
  status?: string;
}

interface Enrollment {
  id: string;
  prospectId: string;
  sequenceId: string;
  status: string;
  stepActions?: StepAction[];
}

interface StepAction {
  stepId: string;
  status: string;
  error?: string;
  updatedAt?: string;
}

// Twilio status mappings
const TWILIO_STATUS_MAP = {
  'queued': 'queued',
  'sending': 'sending',
  'sent': 'sent',
  'delivered': 'delivered',
  'undelivered': 'failed',
  'failed': 'failed',
} as const;

// Type guards
function isSMSMessage(value: unknown): value is SMSMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'messageId' in value &&
    typeof (value as SMSMessage).id === 'string' &&
    typeof (value as SMSMessage).messageId === 'string'
  );
}

function isEnrollment(value: unknown): value is Enrollment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'prospectId' in value &&
    'sequenceId' in value &&
    typeof (value as Enrollment).id === 'string'
  );
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (higher limit for webhooks)
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/webhooks/sms');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify Twilio signature if auth token is configured
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const signature = request.headers.get('x-twilio-signature');
      if (!signature) {
        logger.warn('Missing Twilio signature header', {
          route: '/api/webhooks/sms'
        });
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }

      // Get the full URL - use request.url or construct from WEBHOOK_BASE_URL
      const url = process.env.WEBHOOK_BASE_URL
        ? `${process.env.WEBHOOK_BASE_URL}/api/webhooks/sms`
        : request.url;

      // Parse the form body to get params for verification
      const params = parseFormBody(rawBody);

      // Verify the signature
      const isValid = verifyTwilioSignature(authToken, signature, url, params);
      if (!isValid) {
        logger.warn('Invalid Twilio webhook signature', {
          route: '/api/webhooks/sms',
          url
        });
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }

      logger.info('Twilio signature verified', {
        route: '/api/webhooks/sms'
      });
    } else {
      logger.warn('TWILIO_AUTH_TOKEN not configured - skipping signature verification', {
        route: '/api/webhooks/sms'
      });
    }

    // Parse form body into params
    const params = parseFormBody(rawBody);

    const messageSid = params['MessageSid'];
    const messageStatus = params['MessageStatus'];
    const _to = params['To'];
    const _from = params['From'];
    const errorCode = params['ErrorCode'] ?? null;
    const errorMessage = params['ErrorMessage'] ?? null;

    logger.info('SMS webhook received', {
      route: '/api/webhooks/sms',
      messageSid,
      status: messageStatus,
      to: _to
    });

    if (!messageSid || !messageStatus) {
      return errors.badRequest('Missing required webhook data');
    }

    // Map Twilio status to our internal status
    const status = TWILIO_STATUS_MAP[messageStatus as keyof typeof TWILIO_STATUS_MAP] ?? 'sent';

    // Update SMS record in all organizations (find by message SID)
    await updateSMSRecord(messageSid, {
      status,
      lastStatusUpdate: new Date().toISOString(),
      deliveredAt: status === 'delivered' ? new Date().toISOString() : undefined,
      errorCode: errorCode ?? undefined,
      errorMessage: errorMessage ?? undefined,
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('SMS webhook error', error instanceof Error ? error : new Error(String(error)), { route: '/api/webhooks/sms' });
    // Return 200 even on error to prevent Twilio retries for unrecoverable errors
    return NextResponse.json({ success: false, error: errorMessage });
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
    const smsMessages = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/smsMessages`,
      []
    );

    const smsRecord = smsMessages.find((sms: unknown) => {
      if (!isSMSMessage(sms)) {
        return false;
      }
      return sms.messageId === messageSid;
    });

    if (smsRecord && isSMSMessage(smsRecord)) {
      await FirestoreService.update(
        `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/smsMessages`,
        smsRecord.id,
        {
          ...updates,
          updatedAt: new Date().toISOString(),
        }
      );

      logger.info('SMS record updated', {
        route: '/api/webhooks/sms',
        smsId: smsRecord.id
      });

      return;
    }

    logger.warn('SMS record not found', {
      route: '/api/webhooks/sms',
      messageSid
    });
  } catch (error) {
    logger.error('Error updating SMS record', error instanceof Error ? error : new Error(String(error)), { route: '/api/webhooks/sms' });
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

    const smsMessages = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/smsMessages`,
      []
    );

    const smsRecord = smsMessages.find((sms: unknown) => {
      if (!isSMSMessage(sms)) {
        return false;
      }
      return sms.messageId === messageSid;
    });

    if (smsRecord && isSMSMessage(smsRecord) && smsRecord.enrollmentId) {
      const enrollment = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/enrollments`,
        smsRecord.enrollmentId
      );

      if (enrollment && isEnrollment(enrollment)) {
        const stepActions = enrollment.stepActions ?? [];
        const action = stepActions.find((a: StepAction) => a.stepId === smsRecord.stepId);
        if (action) {
          action.status = 'failed';
          action.error = errorMessage ?? `Error ${errorCode}`;
          action.updatedAt = new Date().toISOString();

          await FirestoreService.update(
            `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/enrollments`,
            smsRecord.enrollmentId,
            {
              stepActions,
              updatedAt: new Date().toISOString(),
            }
          );
        }

        // For hard failures (invalid number), unenroll from sequence
        const hardFailureCodes = ['21211', '21614', '21617'];
        if (errorCode && hardFailureCodes.includes(errorCode)) {
          const { SequenceEngine } = await import('@/lib/outbound/sequence-engine');
          await SequenceEngine['unenrollProspect'](
            enrollment.prospectId,
            enrollment.sequenceId,
            'bounced'
          );

          logger.info('Prospect unenrolled due to SMS hard bounce', {
            route: '/api/webhooks/sms',
            errorCode,
            enrollmentId: smsRecord.enrollmentId,
          });
        }
      }
    }
  } catch (error) {
    logger.error('Error handling SMS failure', error instanceof Error ? error : new Error(String(error)), { route: '/api/webhooks/sms' });
  }
}
