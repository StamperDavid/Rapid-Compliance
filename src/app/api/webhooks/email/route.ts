/**
 * Email Tracking Webhook
 * Handles REAL email events from SendGrid
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  handleEmailBounce,
  handleEmailOpen,
  handleEmailClick,
} from '@/lib/outbound/sequence-scheduler';
import { parseSendGridWebhook, SendGridWebhookEvent } from '@/lib/email/sendgrid-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

export async function POST(request: NextRequest) {
  try {
    // SendGrid sends an array of events
    const body = await request.json();
    
    if (!Array.isArray(body)) {
      return errors.badRequest('Invalid webhook format');
    }

    logger.info('Email webhook received', { route: '/api/webhooks/email', eventCount: body.length });

    // Parse SendGrid events
    const events = parseSendGridWebhook(body);
    
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
  } catch (error: any) {
    logger.error('Email webhook processing error', error, { route: '/api/webhooks/email' });
    return errors.internal('Failed to process webhook', error);
  }
}

/**
 * Process a single SendGrid event
 */
async function processEvent(event: SendGridWebhookEvent): Promise<void> {
  logger.debug('Processing email event', { route: '/api/webhooks/email', event: event.event, email: event.email });

  // Extract metadata from custom args
  const enrollmentId = event.enrollmentId;
  const stepId = event.stepId;
  const organizationId = event.organizationId;

  if (!enrollmentId || !stepId || !organizationId) {
    logger.warn('Event missing metadata', { route: '/api/webhooks/email', event });
    return;
  }

  // Handle different event types
  switch (event.event) {
    case 'delivered':
      logger.info('Email delivered', { route: '/api/webhooks/email', email: event.email });
      // Could track delivery if needed
      break;

    case 'open':
      await handleEmailOpen(enrollmentId, stepId, organizationId);
      break;

    case 'click':
      await handleEmailClick(enrollmentId, stepId, organizationId);
      break;

    case 'bounce':
    case 'dropped':
      await handleEmailBounce(enrollmentId, stepId, organizationId);
      break;

    case 'spamreport':
    case 'unsubscribe':
      // Handle unsubscribe
      await handleEmailBounce(enrollmentId, stepId, organizationId);
      break;

    default:
      logger.debug('Unhandled event type', { route: '/api/webhooks/email', eventType: event.event });
  }
}

