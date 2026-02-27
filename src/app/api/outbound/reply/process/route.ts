/**
 * Email Reply Processing API
 * POST /api/outbound/reply/process
 * Process incoming email replies and generate AI responses
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
import { ensureCompliance } from '@/lib/compliance/can-spam-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

const EmailReplySchema = z.object({
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
  threadId: z.string(),
  inReplyTo: z.string().optional(),
  receivedAt: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
});

const ProspectContextSchema = z.object({
  prospectName: z.string(),
  companyName: z.string(),
  conversationHistory: z.array(EmailReplySchema),
  originalOutreach: z.object({
    subject: z.string(),
    body: z.string(),
    sentAt: z.string(),
  }),
  product: z.string().optional(),
  valueProposition: z.string().optional(),
});

const ReplyProcessSchema = z.object({
  emailReply: EmailReplySchema,
  prospectContext: ProspectContextSchema.optional(),
  autoSend: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/outbound/reply/process');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = ReplyProcessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { emailReply: validatedReply, prospectContext: validatedContext, autoSend } = parsed.data;

    // Penthouse model: All features available

    // Classify the reply
    logger.info('Processing reply', { route: '/api/outbound/reply/process', from: validatedReply.from });
    const classification = await classifyReply(validatedReply as EmailReply);

    // Generate suggested response
    let suggestedResponse = null;
    if (classification.suggestedAction === 'send_response' && validatedContext) {
      suggestedResponse = await generateReply(
        validatedReply as EmailReply,
        classification,
        validatedContext as ProspectContext
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
          type: 'reply_handler',
          inReplyTo: replyMessageId,
          references: replyMessageId,
        };
        // CAN-SPAM: Ensure compliance footer on auto-sent replies
        const compliantHtml = ensureCompliance(suggestedResponse.body, validatedReply.from);

        await sendEmail({
          to: validatedReply.from,
          subject: `Re: ${(validatedReply.subject !== '' && validatedReply.subject != null) ? validatedReply.subject : 'Your inquiry'}`,
          html: compliantHtml,
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
        logger.error('Failed to auto-send reply', sendError instanceof Error ? sendError : new Error(String(sendError)), { route: '/api/outbound/reply/process' });
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
    logger.error('Reply processing error', error instanceof Error ? error : new Error(String(error)), { route: '/api/outbound/reply/process' });
    return errors.internal('Failed to process reply', error instanceof Error ? error : new Error(String(error)));
  }
}

