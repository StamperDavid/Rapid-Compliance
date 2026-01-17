/**
 * Email Reply Processing API
 * POST /api/outbound/reply/process
 * Process incoming email replies and generate AI responses
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  classifyReply,
  generateReply,
  shouldAutoSend,
  type EmailReply,
  type ProspectContext,
} from '@/lib/outbound/reply-handler';
import { sendEmail } from '@/lib/email/email-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

interface ReplyProcessRequestBody {
  orgId?: string;
  emailReply?: EmailReply;
  prospectContext?: ProspectContext;
  autoSend?: boolean;
}

function isReplyProcessRequestBody(value: unknown): value is ReplyProcessRequestBody {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/outbound/reply/process');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    if (!isReplyProcessRequestBody(body)) {
      return errors.badRequest('Invalid request body');
    }

    const { orgId, emailReply, prospectContext, autoSend = false } = body;

    if (!orgId) {
      return errors.badRequest('Organization ID is required');
    }

    if (!emailReply) {
      return errors.badRequest('Email reply data is required');
    }

    // Extract reply details with explicit types after validation
    const validatedReply: EmailReply = emailReply;

    // NEW PRICING MODEL: All features available to all active subscriptions
    // Feature check no longer needed - everyone gets reply handling!
    // const featureCheck = await requireFeature(request, orgId, 'replyHandler' as any);
    // if (featureCheck) return featureCheck;

    // Classify the reply
    logger.info('Processing reply', { route: '/api/outbound/reply/process', from: validatedReply.from });
    const classification = await classifyReply(validatedReply);

    // Generate suggested response
    let suggestedResponse = null;
    if (classification.suggestedAction === 'send_response' && prospectContext) {
      suggestedResponse = await generateReply(
        validatedReply,
        classification,
        prospectContext
      );
    }

    // Determine if we should auto-send
    const canAutoSend = autoSend && shouldAutoSend(classification);

    // If auto-send is enabled and conditions are met, send the reply
    let sent = false;
    if (canAutoSend && suggestedResponse) {
      try {
        const replyMessageId: string = String(validatedReply.inReplyTo ?? validatedReply.threadId ?? '');
        const emailMetadata: Record<string, string> = {
          organizationId: orgId,
          type: 'reply_handler',
          inReplyTo: replyMessageId,
          references: replyMessageId,
        };
        await sendEmail({
          to: validatedReply.from,
          subject: `Re: ${(validatedReply.subject !== '' && validatedReply.subject != null) ? validatedReply.subject : 'Your inquiry'}`,
          html: suggestedResponse.body,
          text: suggestedResponse.body,
          from: validatedReply.to,
          metadata: emailMetadata,
        });

        logger.info('Auto-sent reply', {
          route: '/api/outbound/reply/process',
          to: validatedReply.from,
          subject: suggestedResponse.subject,
          inReplyTo: replyMessageId,
        });
        sent = true;
      } catch (sendError) {
        logger.error('Failed to auto-send reply', sendError instanceof Error ? sendError : undefined, { route: '/api/outbound/reply/process' });
        sent = false;
      }
    }

    return NextResponse.json({
      success: true,
      classification: {
        intent: classification.intent,
        sentiment: classification.sentiment,
        sentimentScore: classification.sentimentScore,
        confidence: classification.confidence,
        suggestedAction: classification.suggestedAction,
        requiresHumanReview: classification.requiresHumanReview,
        reasoning: classification.reasoning,
      },
      suggestedResponse: suggestedResponse ? {
        subject: suggestedResponse.subject,
        body: suggestedResponse.body,
        confidence: suggestedResponse.confidence,
      } : null,
      autoSent: sent,
      canAutoSend,
      metadata: {
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Reply processing error', error instanceof Error ? error : undefined, { route: '/api/outbound/reply/process' });
    return errors.internal('Failed to process reply', error instanceof Error ? error : undefined);
  }
}

