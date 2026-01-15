/**
 * Gmail Push Notification Webhook
 * Receives notifications when new emails arrive
 * https://developers.google.com/gmail/api/guides/push
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getEmail, parseEmailHeaders, getEmailBody } from '@/lib/integrations/gmail-service';
import { classifyReply, sendReplyEmail, type ReplyClassification } from '@/lib/outbound/reply-handler';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

// Type definitions for Gmail webhook payload
interface GmailPushMessage {
  data: string;
  messageId?: string;
  publishTime?: string;
}

interface GmailPushNotification {
  message: GmailPushMessage;
  subscription?: string;
}

interface GmailPushData {
  emailAddress: string;
  historyId: string;
}

interface GmailTokens {
  access_token: string;
  refresh_token?: string;
}

interface GmailIntegration {
  id: string;
  userId: string;
  organizationId: string;
  email: string;
  provider: string;
  type: string;
  status: string;
  credentials: GmailTokens;
  lastHistoryId?: string;
}

interface GmailHistoryMessage {
  id: string;
  threadId?: string;
}

interface GmailHistoryItem {
  messagesAdded?: Array<{
    message: GmailHistoryMessage;
  }>;
}

interface GmailMessage {
  id: string;
  threadId: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    parts?: unknown[];
    body?: { data?: string };
  };
}

interface Prospect {
  id: string;
  email: string;
}

interface Enrollment {
  id: string;
  prospectId: string;
  sequenceId: string;
  status: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (higher limit for webhooks)
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/webhooks/gmail');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Gmail sends push notifications as JSON
    const body: unknown = await request.json();

    // Type guard for notification structure
    if (!isGmailPushNotification(body)) {
      logger.info('Invalid Gmail webhook payload', { route: '/api/webhooks/gmail', notification: body });
      return NextResponse.json({ success: true }); // Acknowledge but skip
    }

    logger.info('Gmail webhook received', { route: '/api/webhooks/gmail', notification: body });

    // Decode the message
    const message = body.message;
    if (!message?.data) {
      return NextResponse.json({ success: true }); // Acknowledge but skip
    }

    const decodedData = JSON.parse(Buffer.from(message.data, 'base64').toString()) as unknown;

    if (!isGmailPushData(decodedData)) {
      logger.debug('Invalid Gmail push data format', { route: '/api/webhooks/gmail' });
      return NextResponse.json({ success: true });
    }

    const { emailAddress, historyId } = decodedData;

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
      integration.lastHistoryId ?? historyId
    );

    // Type guard for history items
    const typedHistory = Array.isArray(history) ? history : [];

    // Process new messages
    for (const item of typedHistory) {
      if (!isGmailHistoryItem(item)) {
        continue;
      }

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
  } catch (error: unknown) {
    logger.error('Gmail webhook error', error, { route: '/api/webhooks/gmail' });
    return errors.internal('Internal error', error instanceof Error ? error : undefined);
  }
}

// Type guard functions
function isGmailPushNotification(value: unknown): value is GmailPushNotification {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'object' &&
    (value as { message: unknown }).message !== null
  );
}

function isGmailPushData(value: unknown): value is GmailPushData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'emailAddress' in value &&
    'historyId' in value &&
    typeof (value as { emailAddress: unknown }).emailAddress === 'string' &&
    typeof (value as { historyId: unknown }).historyId === 'string'
  );
}

function isGmailHistoryItem(value: unknown): value is GmailHistoryItem {
  return (
    typeof value === 'object' &&
    value !== null
  );
}

function isGmailIntegration(value: unknown): value is GmailIntegration {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'userId' in value &&
    'organizationId' in value &&
    'email' in value &&
    'credentials' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    typeof (value as { userId: unknown }).userId === 'string' &&
    typeof (value as { organizationId: unknown }).organizationId === 'string' &&
    typeof (value as { email: unknown }).email === 'string'
  );
}

function isGmailMessage(value: unknown): value is GmailMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'threadId' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    typeof (value as { threadId: unknown }).threadId === 'string'
  );
}

function isProspect(value: unknown): value is Prospect {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'string'
  );
}

function isEnrollment(value: unknown): value is Enrollment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'sequenceId' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    typeof (value as { sequenceId: unknown }).sequenceId === 'string'
  );
}

/**
 * Find integration by email address
 */
async function findIntegrationByEmail(email: string): Promise<GmailIntegration | null> {
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

    // Find matching email with type guard
    const matchedIntegration = integrations.find((int: unknown) => {
      if (!isGmailIntegration(int)) {
        return false;
      }
      return int.email === email;
    });

    return matchedIntegration && isGmailIntegration(matchedIntegration) ? matchedIntegration : null;
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
    const emailData: unknown = await getEmail(tokens, messageId);

    if (!isGmailMessage(emailData)) {
      logger.debug('Invalid email message format', { route: '/api/webhooks/gmail' });
      return;
    }

    const headers = parseEmailHeaders(emailData);
    const body = getEmailBody(emailData);

    logger.info('Processing Gmail email', { route: '/api/webhooks/gmail', subject: headers.subject });

    // Check if this is a reply to our outbound email
    const isReply = headers.inReplyTo ?? headers.references;

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
      threadId: emailData.threadId,
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
              emailData.threadId
            );
            logger.info('Auto-sent reply', { route: '/api/webhooks/gmail' });
          }
        } else {
          // Save for human review
          await saveForReview(organizationId, emailData, classification);
          logger.info('Saved for human review', { route: '/api/webhooks/gmail' });
        }
        break;

      case 'book_meeting':
        // Trigger meeting scheduler
        logger.info('Triggering meeting scheduler', { route: '/api/webhooks/gmail' });
        // TODO: Implement auto-meeting booking
        await saveForReview(organizationId, emailData, classification);
        break;

      case 'unenroll':
        // Remove from sequences
        logger.info('Unenrolling prospect', { route: '/api/webhooks/gmail' });
        await unenrollProspectFromSequences(
          organizationId,
          headers.from,
          classification.intent === 'unsubscribe' ? 'unsubscribed' : 'replied'
        );
        await saveForReview(organizationId, emailData, classification);
        break;

      case 'mark_as_converted':
        // Mark prospect as converted
        logger.info('Marking prospect as converted', { route: '/api/webhooks/gmail' });
        await unenrollProspectFromSequences(organizationId, headers.from, 'converted');
        await saveForReview(organizationId, emailData, classification);
        break;

      case 'pause_sequence':
        // Pause but don't remove from sequence
        logger.info('Pausing sequences for prospect', { route: '/api/webhooks/gmail' });
        await pauseProspectSequences(organizationId, headers.from);
        await saveForReview(organizationId, emailData, classification);
        break;

      default:
        // Save for review
        await saveForReview(organizationId, emailData, classification);
    }
  } catch (error) {
    logger.error('Error processing Gmail email', error, { route: '/api/webhooks/gmail' });
  }
}

/**
 * Unenroll prospect from all active sequences
 */
async function unenrollProspectFromSequences(
  organizationId: string,
  prospectEmail: string,
  reason: 'manual' | 'replied' | 'converted' | 'unsubscribed' | 'bounced'
): Promise<void> {
  try {
    // Find prospect by email
    const { where } = await import('firebase/firestore');
    const prospects = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/prospects`,
      [where('email', '==', prospectEmail)]
    );

    if (prospects.length === 0) {
      logger.debug('No prospect found for email', { route: '/api/webhooks/gmail', email: prospectEmail });
      return;
    }

    const firstProspect = prospects[0];
    if (!isProspect(firstProspect)) {
      logger.debug('Invalid prospect data', { route: '/api/webhooks/gmail' });
      return;
    }

    const prospectId = firstProspect.id;

    // Find all active enrollments for this prospect
    const enrollments = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrollments`,
      [
        where('prospectId', '==', prospectId),
        where('status', '==', 'active'),
      ]
    );

    // Unenroll from each sequence
    const { SequenceEngine } = await import('@/lib/outbound/sequence-engine');
    for (const enrollment of enrollments) {
      if (!isEnrollment(enrollment)) {
        continue;
      }

      await SequenceEngine['unenrollProspect'](
        prospectId,
        enrollment.sequenceId,
        organizationId,
        reason
      );
      logger.info('Unenrolled prospect from sequence', {
        route: '/api/webhooks/gmail',
        prospectId,
        sequenceId: enrollment.sequenceId,
        reason
      });
    }
  } catch (error) {
    logger.error('Error unenrolling prospect', error, { route: '/api/webhooks/gmail' });
  }
}

/**
 * Pause prospect sequences (don't unenroll)
 */
async function pauseProspectSequences(
  organizationId: string,
  prospectEmail: string
): Promise<void> {
  try {
    const { where } = await import('firebase/firestore');
    const prospects = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/prospects`,
      [where('email', '==', prospectEmail)]
    );

    if (prospects.length === 0) {return;}

    const firstProspect = prospects[0];
    if (!isProspect(firstProspect)) {
      return;
    }

    const prospectId = firstProspect.id;

    // Find all active enrollments
    const enrollments = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrollments`,
      [
        where('prospectId', '==', prospectId),
        where('status', '==', 'active'),
      ]
    );

    // Pause each enrollment
    for (const enrollment of enrollments) {
      if (!isEnrollment(enrollment)) {
        continue;
      }

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/enrollments`,
        enrollment.id,
        {
          ...enrollment,
          status: 'paused',
          pausedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        false
      );
      logger.info('Paused enrollment', {
        route: '/api/webhooks/gmail',
        enrollmentId: enrollment.id
      });
    }
  } catch (error) {
    logger.error('Error pausing sequences', error, { route: '/api/webhooks/gmail' });
  }
}

/**
 * Save email for human review
 */
async function saveForReview(
  organizationId: string,
  email: GmailMessage,
  classification: ReplyClassification
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
