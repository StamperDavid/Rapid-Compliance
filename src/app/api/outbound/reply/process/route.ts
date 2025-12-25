/**
 * Email Reply Processing API
 * POST /api/outbound/reply/process
 * Process incoming email replies and generate AI responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { requireFeature } from '@/lib/subscription/middleware';
import { 
  classifyReply, 
  generateReply, 
  shouldAutoSend,
  EmailReply,
  ProspectContext 
} from '@/lib/outbound/reply-handler';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/outbound/reply/process');
    if (rateLimitResponse) return rateLimitResponse;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { orgId, emailReply, prospectContext, autoSend = false } = body;

    if (!orgId) {
      return errors.badRequest('Organization ID is required');
    }

    if (!emailReply) {
      return errors.badRequest('Email reply data is required');
    }

    // NEW PRICING MODEL: All features available to all active subscriptions
    // Feature check no longer needed - everyone gets reply handling!
    // const featureCheck = await requireFeature(request, orgId, 'replyHandler' as any);
    // if (featureCheck) return featureCheck;

    // Classify the reply
    logger.info('Processing reply', { route: '/api/outbound/reply/process', from: emailReply.from });
    const classification = await classifyReply(emailReply as EmailReply);

    // Generate suggested response
    let suggestedResponse = null;
    if (classification.suggestedAction === 'send_response') {
      suggestedResponse = await generateReply(
        emailReply as EmailReply,
        classification,
        prospectContext as ProspectContext
      );
    }

    // Determine if we should auto-send
    const canAutoSend = autoSend && shouldAutoSend(classification);

    // If auto-send is enabled and conditions are met, send the reply
    let sent = false;
    if (canAutoSend && suggestedResponse) {
      try {
        // TODO: Send email using email service
        // await sendEmail({
        //   to: emailReply.from,
        //   subject: suggestedResponse.subject,
        //   body: suggestedResponse.body,
        // });
        
        logger.info('Auto-sent reply', { route: '/api/outbound/reply/process', to: emailReply.from });
        sent = true;
      } catch (error) {
        logger.error('Failed to auto-send reply', error, { route: '/api/outbound/reply/process' });
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
  } catch (error: any) {
    logger.error('Reply processing error', error, { route: '/api/outbound/reply/process' });
    return errors.internal('Failed to process reply', error);
  }
}

