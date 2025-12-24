/**
 * Email Tracking Webhook
 * Handles REAL email events from SendGrid
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  handleEmailBounce,
  handleEmailOpen,
  handleEmailClick,
  handleEmailReply,
} from '@/lib/outbound/sequence-scheduler';
import { parseSendGridWebhook, SendGridWebhookEvent } from '@/lib/email/sendgrid-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (high limit for webhooks)
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/webhooks/email');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

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
      // Track delivery status if needed for analytics
      break;

    case 'open':
      await handleEmailOpen(enrollmentId, stepId, organizationId);
      logger.info('Email opened', { route: '/api/webhooks/email', enrollmentId });
      break;

    case 'click':
      await handleEmailClick(enrollmentId, stepId, organizationId);
      logger.info('Email clicked', { route: '/api/webhooks/email', enrollmentId, url: event.url });
      break;

    case 'bounce':
    case 'dropped':
      const bounceReason = event.reason || event.type || 'Unknown';
      logger.warn('Email bounced', { 
        route: '/api/webhooks/email', 
        enrollmentId, 
        reason: bounceReason,
        bounceType: event.type 
      });
      await handleEmailBounce(enrollmentId, stepId, organizationId, bounceReason);
      break;

    case 'spamreport':
      logger.warn('Spam report', { route: '/api/webhooks/email', enrollmentId, email: event.email });
      await handleEmailBounce(enrollmentId, stepId, organizationId, 'spam_report');
      break;

    case 'unsubscribe':
      logger.info('Unsubscribe request', { route: '/api/webhooks/email', enrollmentId, email: event.email });
      await handleEmailBounce(enrollmentId, stepId, organizationId, 'unsubscribed');
      break;

    default:
      logger.debug('Unhandled event type', { route: '/api/webhooks/email', eventType: event.event });
  }
}

