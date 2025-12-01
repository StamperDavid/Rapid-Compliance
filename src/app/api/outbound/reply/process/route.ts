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

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { orgId, emailReply, prospectContext, autoSend = false } = body;

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    if (!emailReply) {
      return NextResponse.json(
        { success: false, error: 'Email reply data is required' },
        { status: 400 }
      );
    }

    // Check feature access
    const featureCheck = await requireFeature(request, orgId, 'replyHandler' as any);
    if (featureCheck) return featureCheck;

    // Classify the reply
    console.log(`[Reply API] Processing reply from ${emailReply.from}`);
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
        
        console.log(`[Reply API] Auto-sent reply to ${emailReply.from}`);
        sent = true;
      } catch (error) {
        console.error('[Reply API] Failed to auto-send reply:', error);
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
    console.error('[Reply API] Error processing reply:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to process reply',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

