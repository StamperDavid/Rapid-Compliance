/**
 * Email Tracking Webhook
 * Handles REAL email events from SendGrid
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  handleEmailBounce,
  handleEmailOpen,
  handleEmailClick,
} from '@/lib/outbound/sequence-scheduler';
import { parseSendGridWebhook } from '@/lib/email/sendgrid-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { verifySendGridSignature } from '@/lib/security/webhook-verification';

export const dynamic = 'force-dynamic';

// Raw SendGrid event interface matching the library's expected type
interface RawSendGridEvent {
  email: string;
  timestamp: number;
  event: string;
  sg_event_id: string;
  sg_message_id: string;
  url?: string;
  reason?: string;
  type?: string;
  status?: string;
  [key: string]: unknown;
}

// Fully typed SendGrid webhook event for this route
interface EmailWebhookEvent {
  email: string;
  timestamp: number;
  event: 'processed' | 'delivered' | 'open' | 'click' | 'bounce' | 'deferred' | 'dropped' | 'spamreport' | 'unsubscribe';
  sg_event_id: string;
  sg_message_id: string;
  url?: string;
  reason?: string;
  type?: string;
  status?: string;
  enrollmentId?: string;
  stepId?: string;
}

/**
 * Type guard to validate raw SendGrid event structure
 */
function isRawSendGridEvent(value: unknown): value is RawSendGridEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const event = value as Record<string, unknown>;

  return (
    typeof event.email === 'string' &&
    typeof event.timestamp === 'number' &&
    typeof event.event === 'string' &&
    typeof event.sg_event_id === 'string' &&
    typeof event.sg_message_id === 'string'
  );
}

/**
 * Validates and converts unknown array to RawSendGridEvent array
 */
function validateSendGridWebhookPayload(data: unknown[]): RawSendGridEvent[] {
  const validatedEvents: RawSendGridEvent[] = [];

  for (const item of data) {
    if (isRawSendGridEvent(item)) {
      validatedEvents.push(item);
    } else {
      logger.warn('Invalid SendGrid event structure', {
        route: '/api/webhooks/email',
        receivedData: JSON.stringify(item)
      });
    }
  }

  return validatedEvents;
}

function toEmailWebhookEvent(raw: Record<string, unknown>): EmailWebhookEvent {
  return {
    email: String(raw.email ?? ''),
    timestamp: Number(raw.timestamp ?? 0),
    event: raw.event as EmailWebhookEvent['event'],
    sg_event_id: String(raw.sg_event_id ?? ''),
    sg_message_id: String(raw.sg_message_id ?? ''),
    url: raw.url ? String(raw.url) : undefined,
    reason: raw.reason ? String(raw.reason) : undefined,
    type: raw.type ? String(raw.type) : undefined,
    status: raw.status ? String(raw.status) : undefined,
    enrollmentId: raw.enrollmentId ? String(raw.enrollmentId) : undefined,
    stepId: raw.stepId ? String(raw.stepId) : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (high limit for webhooks)
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/webhooks/email');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify SendGrid signature if verification key is configured
    const verificationKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
    if (verificationKey) {
      const signature = request.headers.get('x-twilio-email-event-webhook-signature');
      const timestamp = request.headers.get('x-twilio-email-event-webhook-timestamp');

      if (!signature || !timestamp) {
        logger.warn('SendGrid webhook signature headers missing', {
          route: '/api/webhooks/email',
          hasSignature: !!signature,
          hasTimestamp: !!timestamp,
        });
        return errors.unauthorized('Missing webhook signature headers');
      }

      const isValid = verifySendGridSignature(
        verificationKey,
        signature,
        timestamp,
        rawBody
      );

      if (!isValid) {
        logger.warn('SendGrid webhook signature verification failed', {
          route: '/api/webhooks/email',
        });
        return errors.unauthorized('Invalid webhook signature');
      }

      logger.debug('SendGrid webhook signature verified', {
        route: '/api/webhooks/email',
      });
    } else {
      logger.warn('SendGrid webhook verification key not configured - skipping signature verification', {
        route: '/api/webhooks/email',
        env: process.env.NODE_ENV,
      });
    }

    // Parse the verified payload
    const body: unknown = JSON.parse(rawBody);

    if (!Array.isArray(body)) {
      return errors.badRequest('Invalid webhook format');
    }

    logger.info('Email webhook received', { route: '/api/webhooks/email', eventCount: body.length });

    // Validate and type-narrow the incoming payload
    const validatedEvents = validateSendGridWebhookPayload(body);

    if (validatedEvents.length === 0) {
      logger.warn('No valid SendGrid events found in webhook payload', { route: '/api/webhooks/email' });
      return errors.badRequest('No valid events in webhook payload');
    }

    // Parse SendGrid events and convert to typed events
    const rawEvents = parseSendGridWebhook(validatedEvents);
    const events: EmailWebhookEvent[] = rawEvents.map(e => toEmailWebhookEvent(e as Record<string, unknown>));

    // Process each event
    const results = await Promise.allSettled(
      events.map(event => processEvent(event))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info('Email webhook processed', { route: '/api/webhooks/email', successful, failed });

    return NextResponse.json({
      success: true,
      processed: successful,
      failed,
    });
  } catch (error: unknown) {
    logger.error('Email webhook processing error', error instanceof Error ? error : new Error(String(error)), { route: '/api/webhooks/email' });
    return errors.internal('Failed to process webhook', error instanceof Error ? error : undefined);
  }
}

/**
 * Process a single SendGrid event
 */
async function processEvent(event: EmailWebhookEvent): Promise<void> {
  logger.debug('Processing email event', { route: '/api/webhooks/email', eventType: event.event, email: event.email });

  // Extract metadata from custom args
  const enrollmentId = event.enrollmentId;
  const stepId = event.stepId;

  if (!enrollmentId || !stepId) {
    logger.warn('Event missing metadata', { route: '/api/webhooks/email', eventType: event.event });
    return;
  }

  // Handle different event types
  switch (event.event) {
    case 'delivered':
      logger.info('Email delivered', { route: '/api/webhooks/email', email: event.email });
      // Track delivery status if needed for analytics
      break;

    case 'open':
      await handleEmailOpen(enrollmentId, stepId);
      logger.info('Email opened', { route: '/api/webhooks/email', enrollmentId });
      break;

    case 'click':
      await handleEmailClick(enrollmentId, stepId);
      logger.info('Email clicked', { route: '/api/webhooks/email', enrollmentId, url: event.url });
      break;

    case 'bounce':
    case 'dropped': {
      const bounceReason = event.reason ?? event.type ?? 'Unknown';
      logger.warn('Email bounced', {
        route: '/api/webhooks/email',
        enrollmentId,
        reason: bounceReason,
        bounceType: event.type
      });
      await handleEmailBounce(enrollmentId, stepId, bounceReason);
      break;
    }

    case 'spamreport':
      logger.warn('Spam report', { route: '/api/webhooks/email', enrollmentId, email: event.email });
      await handleEmailBounce(enrollmentId, stepId, 'spam_report');
      break;

    case 'unsubscribe':
      logger.info('Unsubscribe request', { route: '/api/webhooks/email', enrollmentId, email: event.email });
      await handleEmailBounce(enrollmentId, stepId, 'unsubscribed');
      break;

    default:
      logger.debug('Unhandled event type', { route: '/api/webhooks/email', eventType: event.event });
  }
}
