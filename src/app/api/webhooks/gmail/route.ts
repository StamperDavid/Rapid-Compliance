/**
 * Gmail Push Notification Webhook
 * Receives notifications when new emails arrive
 * https://developers.google.com/gmail/api/guides/push
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEmail, parseEmailHeaders, getEmailBody } from '@/lib/integrations/gmail-service';
import { classifyReply, sendReplyEmail } from '@/lib/outbound/reply-handler';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

export async function POST(request: NextRequest) {
  try {
    // Gmail sends push notifications as JSON
    const body = await request.json();
    
    console.log('[Gmail Webhook] Received notification:', body);

    // Decode the message
    const message = body.message;
    if (!message || !message.data) {
      return NextResponse.json({ success: true }); // Acknowledge but skip
    }

    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    
    const { emailAddress, historyId } = data;
    
    console.log('[Gmail Webhook] New email for:', emailAddress, 'History ID:', historyId);

    // Find user/org for this email address
    const integration = await findIntegrationByEmail(emailAddress);
    if (!integration) {
      console.log('[Gmail Webhook] No integration found for:', emailAddress);
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
    console.error('[Gmail Webhook] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
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
    console.error('[Gmail Webhook] Error finding integration:', error);
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

    console.log('[Gmail Webhook] Processing email:', headers.subject);

    // Check if this is a reply to our outbound email
    const isReply = headers.inReplyTo || headers.references;
    
    if (!isReply) {
      console.log('[Gmail Webhook] Not a reply, skipping AI processing');
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

    console.log('[Gmail Webhook] Reply classified as:', classification.intent);

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
            console.log('[Gmail Webhook] Auto-sent reply');
          }
        } else {
          // Save for human review
          await saveForReview(organizationId, email, classification);
          console.log('[Gmail Webhook] Saved for human review');
        }
        break;

      case 'book_meeting':
        // Trigger meeting scheduler
        console.log('[Gmail Webhook] Triggering meeting scheduler');
        // TODO: Implement auto-meeting booking
        await saveForReview(organizationId, email, classification);
        break;

      case 'unenroll':
        // Remove from sequences
        console.log('[Gmail Webhook] Unenrolling prospect');
        // TODO: Implement unenroll logic
        break;

      default:
        // Save for review
        await saveForReview(organizationId, email, classification);
    }
  } catch (error) {
    console.error('[Gmail Webhook] Error processing email:', error);
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

