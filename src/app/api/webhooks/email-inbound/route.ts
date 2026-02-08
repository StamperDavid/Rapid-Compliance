/**
 * SendGrid Inbound Parse Webhook
 * Receives and processes inbound emails from SendGrid's Inbound Parse service
 *
 * https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { classifyReply, type ReplyClassification } from '@/lib/outbound/reply-handler';
import { v4 as uuidv4 } from 'uuid';
import { emitBusinessEvent } from '@/lib/orchestration/event-router';

// Type definitions for SendGrid Inbound Parse payload
interface InboundEmailData {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  envelope: string; // JSON string with from/to arrays
  headers: string; // Raw email headers
  attachments?: string; // Number of attachments
  'attachment-info'?: string; // JSON with attachment metadata
}

interface EnvelopeData {
  from: string;
  to: string[];
}

interface ParsedHeaders {
  inReplyTo?: string;
  references?: string;
  messageId?: string;
  date?: string;
}

interface SentEmail {
  id: string;
  to: string;
  subject: string;
  messageId?: string;
  enrollmentId?: string;
  prospectId?: string;
  prospectEmail?: string;
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
    // Rate limiting (high limit for webhooks)
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/webhooks/email-inbound');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    logger.info('Inbound Email Webhook: Received request', { route: '/api/webhooks/email-inbound' });

    // Parse multipart form data
    const formData = await request.formData();

    // Extract email fields
    const emailData: InboundEmailData = {
      from: (formData.get('from') as string) ?? '',
      to: (formData.get('to') as string) ?? '',
      subject: (formData.get('subject') as string) ?? '',
      text: (formData.get('text') as string) ?? '',
      html: (formData.get('html') as string) ?? undefined,
      envelope: (formData.get('envelope') as string) ?? '{}',
      headers: (formData.get('headers') as string) ?? '',
      attachments: (formData.get('attachments') as string) ?? undefined,
      'attachment-info': (formData.get('attachment-info') as string) ?? undefined,
    };

    // Validate required fields
    if (!emailData.from || !emailData.to) {
      logger.warn('Inbound Email Webhook: Missing required fields', {
        route: '/api/webhooks/email-inbound',
        hasFrom: !!emailData.from,
        hasTo: !!emailData.to,
      });
      return NextResponse.json({ success: true }); // Acknowledge but skip
    }

    logger.info('Inbound Email Webhook: Processing email', {
      route: '/api/webhooks/email-inbound',
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
    });

    // Parse envelope and headers
    const envelope = parseEnvelope(emailData.envelope);
    const headers = parseHeaders(emailData.headers);

    // Look up original sent email by In-Reply-To or recipient address
    const originalEmail = await findOriginalEmail(headers.inReplyTo, emailData.to);

    // Classify the inbound email
    const classification = await classifyReply({
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      body: emailData.html ?? emailData.text,
      threadId: headers.inReplyTo ?? headers.messageId ?? '',
      inReplyTo: headers.inReplyTo,
      receivedAt: headers.date ?? new Date().toISOString(),
    });

    logger.info('Inbound Email Webhook: Reply classified', {
      route: '/api/webhooks/email-inbound',
      intent: classification.intent,
      sentiment: classification.sentiment,
      suggestedAction: classification.suggestedAction,
    });

    // Emit event to Event Router
    void emitBusinessEvent('email.reply.received', 'webhook/email-inbound', {
      from: emailData.from,
      leadId: originalEmail?.prospectId ?? null,
      threadId: headers.inReplyTo ?? headers.messageId ?? '',
      subject: emailData.subject,
      classification: {
        intent: classification.intent,
        sentiment: classification.sentiment,
        sentimentScore: classification.sentimentScore,
        confidence: classification.confidence,
        suggestedAction: classification.suggestedAction,
        requiresHumanReview: classification.requiresHumanReview,
      },
    });

    // Take action based on classification
    await processClassifiedReply(
      emailData,
      classification,
      originalEmail,
      envelope,
      headers
    );

    // Log the inbound email to Firestore
    await logInboundEmail(emailData, classification, originalEmail, envelope, headers);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Inbound Email Webhook: Processing error', error instanceof Error ? error : new Error(String(error)), { route: '/api/webhooks/email-inbound' });
    return errors.internal('Failed to process inbound email', error instanceof Error ? error : undefined);
  }
}

/**
 * Parse SendGrid envelope JSON
 */
function parseEnvelope(envelopeJson: string): EnvelopeData {
  try {
    const parsed = JSON.parse(envelopeJson) as unknown;
    if (typeof parsed === 'object' && parsed !== null && 'from' in parsed && 'to' in parsed) {
      return parsed as EnvelopeData;
    }
  } catch (_error) {
    logger.debug('Inbound Email Webhook: Failed to parse envelope', { envelope: envelopeJson });
  }
  return { from: '', to: [] };
}

/**
 * Parse email headers to extract In-Reply-To, References, Message-ID, and Date
 */
function parseHeaders(headersString: string): ParsedHeaders {
  const headers: ParsedHeaders = {};

  // Parse headers line by line
  const lines = headersString.split('\n');
  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const headerName = match[1]?.toLowerCase() ?? '';
      const headerValue = match[2]?.trim() ?? '';

      if (headerName === 'in-reply-to') {
        headers.inReplyTo = extractMessageId(headerValue);
      } else if (headerName === 'references') {
        headers.references = extractMessageId(headerValue);
      } else if (headerName === 'message-id') {
        headers.messageId = extractMessageId(headerValue);
      } else if (headerName === 'date') {
        headers.date = headerValue;
      }
    }
  }

  return headers;
}

/**
 * Extract clean message ID from header value
 */
function extractMessageId(value: string): string {
  // Remove angle brackets if present
  return value.replace(/^<|>$/g, '');
}

/**
 * Find the original sent email by In-Reply-To header or recipient address
 */
async function findOriginalEmail(
  inReplyTo: string | undefined,
  recipientAddress: string
): Promise<SentEmail | null> {
  try {
    const { where } = await import('firebase/firestore');

    // Try to find by Message-ID first (most reliable)
    if (inReplyTo) {
      const sentEmails = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/sentEmails`,
        [where('messageId', '==', inReplyTo)]
      );

      if (sentEmails.length > 0 && isSentEmail(sentEmails[0])) {
        return sentEmails[0];
      }
    }

    // Fall back to finding by recipient address (less reliable)
    const sentEmails = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/sentEmails`,
      [where('to', '==', recipientAddress)]
    );

    // Return the most recent match
    if (sentEmails.length > 0 && isSentEmail(sentEmails[0])) {
      return sentEmails[0];
    }

    return null;
  } catch (error) {
    logger.error('Inbound Email Webhook: Error finding original email', error instanceof Error ? error : new Error(String(error)), { route: '/api/webhooks/email-inbound' });
    return null;
  }
}

/**
 * Type guard for SentEmail
 */
function isSentEmail(value: unknown): value is SentEmail {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'to' in value &&
    typeof (value as SentEmail).id === 'string' &&
    typeof (value as SentEmail).to === 'string'
  );
}

/**
 * Type guard for Prospect
 */
function isProspect(value: unknown): value is Prospect {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    typeof (value as Prospect).id === 'string' &&
    typeof (value as Prospect).email === 'string'
  );
}

/**
 * Type guard for Enrollment
 */
function isEnrollment(value: unknown): value is Enrollment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'prospectId' in value &&
    'sequenceId' in value &&
    'status' in value &&
    typeof (value as Enrollment).id === 'string'
  );
}

/**
 * Process the classified reply and take appropriate action
 */
async function processClassifiedReply(
  emailData: InboundEmailData,
  classification: ReplyClassification,
  originalEmail: SentEmail | null,
  _envelope: EnvelopeData,
  _headers: ParsedHeaders
): Promise<void> {
  const prospectEmail = emailData.from;

  switch (classification.suggestedAction) {
    case 'send_response':
      // Auto-send if confidence is high enough
      if (classification.confidence > 85 && !classification.requiresHumanReview) {
        const response = classification.suggestedResponse;
        if (response) {
          const { sendReplyEmail } = await import('@/lib/outbound/reply-handler');
          await sendReplyEmail(
            prospectEmail,
            `Re: ${emailData.subject}`,
            response,
            originalEmail?.messageId,
            undefined
          );
          logger.info('Inbound Email Webhook: Auto-sent reply', { route: '/api/webhooks/email-inbound' });
        }
      } else {
        logger.info('Inbound Email Webhook: Reply requires human review', { route: '/api/webhooks/email-inbound' });
      }
      break;

    case 'book_meeting':
      // Trigger meeting scheduler
      logger.info('Inbound Email Webhook: Triggering meeting scheduler', { route: '/api/webhooks/email-inbound' });
      break;

    case 'unenroll':
      // Remove from sequences
      logger.info('Inbound Email Webhook: Unenrolling prospect', { route: '/api/webhooks/email-inbound' });
      await unenrollProspectFromSequences(
        prospectEmail,
        classification.intent === 'unsubscribe' ? 'unsubscribed' : 'replied'
      );
      break;

    case 'mark_as_converted':
      // Mark prospect as converted
      logger.info('Inbound Email Webhook: Marking prospect as converted', { route: '/api/webhooks/email-inbound' });
      await unenrollProspectFromSequences(prospectEmail, 'converted');
      break;

    case 'pause_sequence':
      // Pause but don't remove from sequence
      logger.info('Inbound Email Webhook: Pausing sequences for prospect', { route: '/api/webhooks/email-inbound' });
      await pauseProspectSequences(prospectEmail);
      break;

    case 'ignore':
      // Out of office, etc. - no action needed
      logger.info('Inbound Email Webhook: Ignoring (OOO or similar)', { route: '/api/webhooks/email-inbound' });
      break;

    default:
      // Default: save for human review
      logger.info('Inbound Email Webhook: Saving for human review', { route: '/api/webhooks/email-inbound' });
  }
}

/**
 * Unenroll prospect from all active sequences
 */
async function unenrollProspectFromSequences(
  prospectEmail: string,
  reason: 'manual' | 'replied' | 'converted' | 'unsubscribed' | 'bounced'
): Promise<void> {
  try {
    const { where } = await import('firebase/firestore');
    const prospects = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/prospects`,
      [where('email', '==', prospectEmail)]
    );

    if (prospects.length === 0) {
      logger.debug('Inbound Email Webhook: No prospect found for email', { route: '/api/webhooks/email-inbound', email: prospectEmail });
      return;
    }

    const firstProspect = prospects[0];
    if (!isProspect(firstProspect)) {
      logger.debug('Inbound Email Webhook: Invalid prospect data', { route: '/api/webhooks/email-inbound' });
      return;
    }

    const prospectId = firstProspect.id;

    const enrollments = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/enrollments`,
      [
        where('prospectId', '==', prospectId),
        where('status', '==', 'active'),
      ]
    );

    const { SequenceEngine } = await import('@/lib/outbound/sequence-engine');
    for (const enrollment of enrollments) {
      if (!isEnrollment(enrollment)) {
        continue;
      }

      await SequenceEngine['unenrollProspect'](
        prospectId,
        enrollment.sequenceId,
        reason
      );
      logger.info('Inbound Email Webhook: Unenrolled prospect from sequence', {
        route: '/api/webhooks/email-inbound',
        prospectId,
        sequenceId: enrollment.sequenceId,
        reason
      });
    }
  } catch (error) {
    logger.error('Inbound Email Webhook: Error unenrolling prospect', error instanceof Error ? error : new Error(String(error)), { route: '/api/webhooks/email-inbound' });
  }
}

/**
 * Pause prospect sequences (don't unenroll)
 */
async function pauseProspectSequences(
  prospectEmail: string
): Promise<void> {
  try {
    const { where } = await import('firebase/firestore');
    const prospects = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/prospects`,
      [where('email', '==', prospectEmail)]
    );

    if (prospects.length === 0) {return;}

    const firstProspect = prospects[0];
    if (!isProspect(firstProspect)) {
      return;
    }

    const prospectId = firstProspect.id;

    const enrollments = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/enrollments`,
      [
        where('prospectId', '==', prospectId),
        where('status', '==', 'active'),
      ]
    );

    for (const enrollment of enrollments) {
      if (!isEnrollment(enrollment)) {
        continue;
      }

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/enrollments`,
        enrollment.id,
        {
          ...enrollment,
          status: 'paused',
          pausedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        false
      );
      logger.info('Inbound Email Webhook: Paused enrollment', {
        route: '/api/webhooks/email-inbound',
        enrollmentId: enrollment.id
      });
    }
  } catch (error) {
    logger.error('Inbound Email Webhook: Error pausing sequences', error instanceof Error ? error : new Error(String(error)), { route: '/api/webhooks/email-inbound' });
  }
}

/**
 * Log the inbound email to Firestore for inbox review
 */
async function logInboundEmail(
  emailData: InboundEmailData,
  classification: ReplyClassification,
  originalEmail: SentEmail | null,
  _envelope: EnvelopeData,
  headers: ParsedHeaders
): Promise<void> {
  const emailId = `inbound_${uuidv4()}`;

  try {
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/inboundEmails`,
      emailId,
      {
        id: emailId,
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        bodyText: emailData.text,
        bodyHtml: emailData.html,

        // Headers
        inReplyTo: headers.inReplyTo,
        references: headers.references,
        messageId: headers.messageId,
        receivedAt: headers.date ?? new Date().toISOString(),

        // Classification
        classification: {
          intent: classification.intent,
          sentiment: classification.sentiment,
          sentimentScore: classification.sentimentScore,
          confidence: classification.confidence,
          suggestedAction: classification.suggestedAction,
          suggestedResponse: classification.suggestedResponse,
          requiresHumanReview: classification.requiresHumanReview,
          reasoning: classification.reasoning,
        },

        // Original email reference
        originalEmailId: originalEmail?.id,
        enrollmentId: originalEmail?.enrollmentId,
        prospectId: originalEmail?.prospectId,

        // Status
        status: classification.requiresHumanReview ? 'pending_review' : 'processed',
        processedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      false
    );

    logger.info('Inbound Email Webhook: Logged to Firestore', {
      route: '/api/webhooks/email-inbound',
      emailId,
      from: emailData.from,
    });
  } catch (error) {
    logger.error('Inbound Email Webhook: Error logging to Firestore', error instanceof Error ? error : new Error(String(error)), { route: '/api/webhooks/email-inbound' });
  }
}
