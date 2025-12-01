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

export async function POST(request: NextRequest) {
  try {
    // SendGrid sends an array of events
    const body = await request.json();
    
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Invalid webhook format' },
        { status: 400 }
      );
    }

    console.log(`[Email Webhook] Received ${body.length} events from SendGrid`);

    // Parse SendGrid events
    const events = parseSendGridWebhook(body);
    
    // Process each event
    const results = await Promise.allSettled(
      events.map(event => processEvent(event))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[Email Webhook] Processed: ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      success: true,
      processed: successful,
      failed,
    });
  } catch (error: any) {
    console.error('[Email Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Process a single SendGrid event
 */
async function processEvent(event: SendGridWebhookEvent): Promise<void> {
  console.log(`[Email Webhook] Processing ${event.event} event for ${event.email}`);

  // Extract metadata from custom args
  const enrollmentId = event.enrollmentId;
  const stepId = event.stepId;
  const organizationId = event.organizationId;

  if (!enrollmentId || !stepId || !organizationId) {
    console.warn('[Email Webhook] Event missing required metadata:', event);
    return;
  }

  // Handle different event types
  switch (event.event) {
    case 'delivered':
      console.log(`[Email Webhook] Email delivered to ${event.email}`);
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
      console.log(`[Email Webhook] Unhandled event type: ${event.event}`);
  }
}

