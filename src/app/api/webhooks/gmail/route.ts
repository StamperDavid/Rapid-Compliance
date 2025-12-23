/**
 * Gmail Push Notification Webhook
 * Receives notifications when new emails arrive
 * https://developers.google.com/gmail/api/guides/push
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEmail, parseEmailHeaders, getEmailBody } from '@/lib/integrations/gmail-service';
import { classifyReply, sendReplyEmail } from '@/lib/outbound/reply-handler';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

export async function POST(request: NextRequest) {
  try {
    // Gmail sends push notifications as JSON
    const body = await request.json();
    
    logger.info('Gmail webhook received', { route: '/api/webhooks/gmail', notification: body });

    // Decode the message
    const message = body.message;
    if (!message || !message.data) {
      return NextResponse.json({ success: true }); // Acknowledge but skip
    }

    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    
    const { emailAddress, historyId } = data;
    
    logger.info('Gmail webhook processing', { route: '/api/webhooks/gmail', emailAddress, historyId });

    // Find user/org for this email address
    const integration = await findIntegrationByEmail(emailAddress);
    if (!integration) {
      logger.debug('No integration found', { route: '/api/webhooks/gmail', emailAddress });
      return NextResponse.json({ success: true });
    }

    // Get the latest emails using history API
    const { getHistory } = await import('@/lib/integrations/gmail-service');
    const history = await getHistory(
      {
        access_token: integration.credentials.access_token,
        refresh_token: integration.credentials.refresh_token,
      },
      integration.lastHistoryId || historyId
    );

    // Process new messages
    for (const item of history) {
      if (item.messagesAdded) {
        for (const msg of item.messagesAdded) {
          await processNewEmail(
            msg.message.id,
            integration.userId,
            integration.organizationId,
            {
              access_token: integration.credentials.access_token,
              refresh_token: integration.credentials.refresh_token,
            }
          );
        }
      }
    }

    // Update last history ID
    await FirestoreService.set(
      COLLECTIONS.INTEGRATIONS,
      integration.id,
      { ...integration, lastHistoryId: historyId },
      false
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Gmail webhook error', error, { route: '/api/webhooks/gmail' });
    return errors.internal('Internal error', error);
  }
}

/**
 * Find integration by email address
 */
async function findIntegrationByEmail(email: string): Promise<any | null> {
  try {
    // Import Firebase query constraints
    const { where } = await import('firebase/firestore');
    
    // Use getAll with proper query constraints
    const integrations = await FirestoreService.getAll(
      COLLECTIONS.INTEGRATIONS,
      [
        where('provider', '==', 'google'),
        where('type', '==', 'gmail'),
        where('status', '==', 'active'),
      ]
    );

    // Find matching email
    return integrations.find((int: any) => int.email === email) || null;
  } catch (error) {
    logger.error('Error finding integration', error, { route: '/api/webhooks/gmail' });
    return null;
  }
}

/**
 * Process a new email
 */
async function processNewEmail(
  messageId: string,
  userId: string,
  organizationId: string,
  tokens: { access_token: string; refresh_token?: string }
): Promise<void> {
  try {
    // Get full email
    const email = await getEmail(tokens, messageId);
    const headers = parseEmailHeaders(email);
    const body = getEmailBody(email);

    logger.info('Processing Gmail email', { route: '/api/webhooks/gmail', subject: headers.subject });

    // Check if this is a reply to our outbound email
    const isReply = headers.inReplyTo || headers.references;
    
    if (!isReply) {
      logger.debug('Not a reply, skipping AI processing', { route: '/api/webhooks/gmail' });
      return;
    }

    // Classify the reply
    const classification = await classifyReply({
      from: headers.from,
      to: headers.to,
      subject: headers.subject,
      body: body.html || body.text,
      threadId: email.threadId,
      inReplyTo: headers.inReplyTo,
      receivedAt: headers.date,
    });

    logger.info('Reply classified', { route: '/api/webhooks/gmail', intent: classification.intent });

    // Handle based on classification
    switch (classification.suggestedAction) {
      case 'send_response':
        // Auto-send if confidence is high enough
        if (classification.confidence > 85 && !classification.requiresHumanReview) {
          const response = classification.suggestedResponse;
          if (response) {
            await sendReplyEmail(
              headers.from,
              `Re: ${headers.subject}`,
              response,
              headers.messageId,
              email.threadId
            );
            logger.info('Auto-sent reply', { route: '/api/webhooks/gmail' });
          }
        } else {
          // Save for human review
          await saveForReview(organizationId, email, classification);
          logger.info('Saved for human review', { route: '/api/webhooks/gmail' });
        }
        break;

      case 'book_meeting':
        // Trigger meeting scheduler
        logger.info('Triggering meeting scheduler', { route: '/api/webhooks/gmail' });
        // TODO: Implement auto-meeting booking
        await saveForReview(organizationId, email, classification);
        break;

      case 'unenroll':
        // Remove from sequences
        logger.info('Unenrolling prospect', { route: '/api/webhooks/gmail' });
        // TODO: Implement unenroll logic
        break;

      default:
        // Save for review
        await saveForReview(organizationId, email, classification);
    }
  } catch (error) {
    logger.error('Error processing Gmail email', error, { route: '/api/webhooks/gmail' });
  }
}

/**
 * Save email for human review
 */
async function saveForReview(
  organizationId: string,
  email: any,
  classification: any
): Promise<void> {
  const headers = parseEmailHeaders(email);
  const body = getEmailBody(email);

  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/inbox`,
    email.id,
    {
      id: email.id,
      from: headers.from,
      to: headers.to,
      subject: headers.subject,
      body: body.html || body.text,
      receivedAt: headers.date,
      classification: {
        intent: classification.intent,
        sentiment: classification.sentiment,
        confidence: classification.confidence,
        suggestedAction: classification.suggestedAction,
        suggestedResponse: classification.suggestedResponse,
      },
      status: 'pending_review',
      createdAt: new Date().toISOString(),
    },
    false
  );
}

